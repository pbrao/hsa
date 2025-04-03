// Bring back Hono and CORS if needed for structure, although not strictly necessary for a single function export
import { Hono } from 'hono'; // Can remove if not using Hono routing/middleware features
import { cors } from 'hono/cors'; // Can remove if not using Hono CORS

// --- onRequest Handler (Primary Export) ---
export const onRequestPost = async (context) => {
  // Log entry point
  console.log("Worker: onRequestPost invoked for path:", context.request.url);

  // --- Environment Variable Check ---
  if (!context.env.GEMINI_API_KEY) {
    console.error("Worker: GEMINI_API_KEY environment variable not set.");
    const errorPayload = { error: 'Server configuration error: API key missing.' };
    return new Response(JSON.stringify(errorPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } // Add CORS
    });
  }
  const geminiApiKey = context.env.GEMINI_API_KEY;
  // Ensure you are using a model that supports PDF input, like 1.5 Pro
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;
  console.log("Worker: API Key found. Using Gemini URL:", geminiApiUrl);

  // Define the extraction prompt
  const prompt = `
    Analyze the content of the provided PDF document, which is an HSA receipt or medical bill.
    Extract the following information precisely:
    1. Provider Name: The name of the clinic, hospital, doctor, or pharmacy.
    2. Date of Service: The specific date the service was rendered or the item was purchased. Format as YYYY-MM-DD if possible, otherwise use the format present. If multiple dates exist, use the primary service date or the latest one shown.
    3. Cost of Service: The total amount paid or due by the patient for the service/item. Extract only the final numerical value, excluding currency symbols initially.

    Return the extracted information ONLY in a valid JSON object format like this:
    {
      "provider_name": "...",
      "date_of_service": "...",
      "cost_of_service": "..."
    }
    Do not include any explanatory text, markdown formatting (like \`\`\`json), or anything else before or after the JSON object itself.
    If any piece of information cannot be reasonably determined from the document, use the string "Not Found" as the value for that specific key in the JSON object.
  `;

  try {
    // --- Get File from Request ---
    console.log("Worker: Attempting to read formData...");
    const formData = await context.request.formData();
    const file = formData.get('pdfFile'); // Key must match frontend FormData key
    console.log("Worker: formData read.");

    if (!file || !(file instanceof File)) {
      console.error("Worker: No PDF file found in formData.");
      const errorPayload = { error: 'No PDF file provided in the request.', debug_prompt: prompt };
      return new Response(JSON.stringify(errorPayload), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    if (file.type !== 'application/pdf') {
        console.error(`Worker: Invalid file type received: ${file.type}`);
        const errorPayload = { error: 'Invalid file type. Only PDF is accepted.', debug_prompt: prompt };
        return new Response(JSON.stringify(errorPayload), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
    console.log(`Worker: Received file: ${file.name}, Type: ${file.type}, Size: ${file.size}`);

    // --- Read File and Convert to Base64 ---
    console.log("Worker: Reading file ArrayBuffer...");
    const arrayBuffer = await file.arrayBuffer();
    console.log("Worker: Converting ArrayBuffer to Base64...");
    const base64String = arrayBufferToBase64(arrayBuffer);
    console.log("Worker: Base64 conversion complete."); // Don't log base64 string

    // --- Prepare Payload for Gemini ---
    const requestPayload = {
      contents: [
        {
          parts: [
            { text: prompt }, // The detailed prompt
            {
              inline_data: { // The PDF data
                mime_type: 'application/pdf',
                data: base64String,
              },
            },
          ],
        },
      ],
      // Optional: Add generationConfig if needed, e.g., to encourage JSON output
      // generationConfig: {
      //   "response_mime_type": "application/json",
      // }
    };
    console.log("Worker: Request payload prepared for Gemini (including PDF data).");

    // --- Call Gemini API ---
    console.log("Worker: Sending request to Gemini API...");
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    console.log(`Worker: Received response from Gemini API. Status: ${geminiResponse.status}`);

    // --- Process Gemini Response ---
    const rawGeminiText = await geminiResponse.text();
    console.log("Worker: Raw text response from Gemini:", rawGeminiText);

    let responsePayload;
    let responseStatus;

    if (!geminiResponse.ok) {
      console.error(`Worker: Gemini API Error (${geminiResponse.status}): ${rawGeminiText}`);
      let details = rawGeminiText;
      try {
          const googleError = JSON.parse(rawGeminiText);
          details = googleError?.error?.message || rawGeminiText;
      } catch(e) { /* Ignore parsing error, use raw text */ } // Keep error parsing

      responseStatus = 500;
      responsePayload = {
          error: `Gemini API request failed: ${geminiResponse.statusText}`,
          details: details,
          debug_prompt: prompt,
          debug_raw_response: rawGeminiText
      };
      console.log("Worker: Preparing 500 JSON response due to Gemini API error.");

    } else {
      // Attempt to parse the successful response as JSON
      try {
        // Clean potential markdown formatting before parsing
        const cleanJsonString = rawGeminiText.trim().replace(/^```json\s*|```$/g, '');
        const jsonData = JSON.parse(cleanJsonString);
        console.log("Worker: Successfully parsed LLM response as JSON.");

        responseStatus = 200;
        responsePayload = {
            extracted_data: jsonData, // Nest the parsed data
            debug_prompt: prompt,
            debug_raw_response: rawGeminiText // Still include raw for comparison
        };
        console.log("Worker: Preparing 200 JSON response with extracted data and debug info.");

      } catch (parseError) {
        console.error("Worker: Failed to parse successful LLM response as JSON:", parseError);
        // LLM succeeded but didn't return valid JSON as requested
        responseStatus = 500; // Treat as server-side issue
        responsePayload = {
            error: 'LLM response was not in the expected JSON format.',
            details: parseError.message,
            debug_prompt: prompt,
            debug_raw_response: rawGeminiText // Crucial to see what was returned
        };
        console.log("Worker: Preparing 500 JSON response due to LLM JSON parse error.");
      }
    }

    // Return the response
    return new Response(JSON.stringify(responsePayload), {
        status: responseStatus,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // Add CORS
        }
    });

  } catch (error) {
    // This catches errors during file processing, fetch call, etc.
    console.error('Worker: Unhandled error in onRequestPost logic:', error);
    const errorPayload = {
        error: 'An unexpected error occurred during worker execution.',
        details: error.message,
        stack_trace_debug: error.stack, // For Cloudflare logs
        // Try to include the prompt even in top-level errors
        debug_prompt: typeof prompt !== 'undefined' ? prompt : 'Prompt definition failed or unavailable.',
        debug_raw_response: null // Raw response likely unavailable here
    };
    console.log("Worker: Preparing 500 JSON response due to unhandled error.");
    return new Response(JSON.stringify(errorPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } // Add CORS
    });
  }
};

// --- Helper Function ---
// Uncomment or add this back
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary); // btoa is available in Cloudflare Workers environment
}
