import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Apply CORS middleware to allow requests from your Pages domain
// In production, you might restrict the origin more specifically
app.use('*', cors());

// Define the POST handler for the /extract route
app.post('/', async (c) => {
  console.log("Worker: Received POST request to /extract"); // Log entry

  // --- Environment Variable Check ---
  if (!c.env.GEMINI_API_KEY) {
    console.error("Worker: GEMINI_API_KEY environment variable not set.");
    return c.json({ error: 'Server configuration error: API key missing.' }, 500);
  }
  const geminiApiKey = c.env.GEMINI_API_KEY;
  // Use the latest Gemini 1.5 Pro model endpoint
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;
  console.log("Worker: API Key found. Using Gemini URL:", geminiApiUrl); // Log URL

  try {
    // --- Get File from Request ---
    console.log("Worker: Attempting to read formData...");
    const formData = await c.req.formData();
    const file = formData.get('pdfFile'); // Ensure this key matches the frontend FormData
    console.log("Worker: formData read.");

    if (!file || !(file instanceof File)) {
      console.error("Worker: No PDF file found in formData.");
      return c.json({ error: 'No PDF file provided in the request.' }, 400);
    }
    if (file.type !== 'application/pdf') {
        console.error(`Worker: Invalid file type received: ${file.type}`);
        return c.json({ error: 'Invalid file type. Only PDF is accepted.' }, 400);
    }
    console.log(`Worker: Received file: ${file.name}, Type: ${file.type}, Size: ${file.size}`);

    // --- Read File and Convert to Base64 ---
    console.log("Worker: Reading file ArrayBuffer...");
    const arrayBuffer = await file.arrayBuffer();
    console.log("Worker: Converting ArrayBuffer to Base64...");
    const base64String = arrayBufferToBase64(arrayBuffer); // Helper function defined below
    console.log("Worker: Base64 conversion complete (first 50 chars):", base64String.substring(0, 50));

    // --- Prepare Prompt and Payload for Gemini ---
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
      Do not include any explanatory text before or after the JSON object.
      If any piece of information cannot be found, use "Not Found" as the value for that key.
    `; // Keep your full prompt here
    console.log("Worker: Prompt prepared.");

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: base64String,
              },
            },
          ],
        },
      ],
      // Optional: Add generationConfig if needed
      // generationConfig: {
      //   "response_mime_type": "application/json", // Request JSON output directly
      // }
    };
     console.log("Worker: Request payload prepared for Gemini.");


    // --- Call Gemini API ---
    console.log("Worker: Sending request to Gemini API...");
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });
    console.log(`Worker: Received response from Gemini API. Status: ${geminiResponse.status}`);

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`Worker: Gemini API Error (${geminiResponse.status}): ${errorBody}`);
      // Try to parse error details from Google's response if possible
      let details = errorBody;
      try {
          const googleError = JSON.parse(errorBody);
          details = googleError?.error?.message || errorBody;
      } catch(e) { /* Ignore parsing error, use raw text */ }
      // Log before returning error
      console.log("Worker: Returning 500 due to Gemini API error.");
      return c.json({ error: `Gemini API request failed: ${geminiResponse.statusText}`, details: details }, 500);
    }

    console.log("Worker: Reading Gemini response JSON...");
    const geminiResult = await geminiResponse.json();
    console.log("Worker: Gemini response JSON parsed.");

    // --- Process Gemini Response ---
    let extractedText = '';
    // Check standard path and potential variations in response structure
    if (geminiResult.candidates?.[0]?.content?.parts?.[0]?.text) {
        extractedText = geminiResult.candidates[0].content.parts[0].text;
        console.log("Worker: Extracted text from Gemini response.");
    } else {
        console.error("Worker: Unexpected Gemini response structure:", JSON.stringify(geminiResult, null, 2));
        // Include prompt in this error response too
        console.log("Worker: Returning 500 due to unexpected Gemini structure.");
        return c.json({
             error: 'Failed to parse response from LLM.',
             details: "Unexpected response structure.",
             debug_prompt: prompt // Add prompt here
            }, 500);
    }

    // Attempt to parse the extracted text as JSON
    let jsonData;
    let cleanJsonString = '';
    try {
      console.log("Worker: Cleaning and parsing extracted text as JSON...");
      // Clean potential markdown formatting
      cleanJsonString = extractedText.trim().replace(/^```json\s*|```$/g, '');
      jsonData = JSON.parse(cleanJsonString);
      console.log("Worker: Successfully parsed LLM response JSON.");

      // Basic validation of expected keys (optional but recommended)
      if (typeof jsonData.provider_name === 'undefined' || typeof jsonData.date_of_service === 'undefined' || typeof jsonData.cost_of_service === 'undefined') {
          console.warn("LLM response JSON missing expected keys. Raw:", cleanJsonString);
          // Decide whether to return partial data or error out
          // return c.json({ error: 'LLM response JSON missing expected keys.', raw_response: cleanJsonString }, 500);
      }

      // Log before returning success
      console.log("Worker: Returning 200 with extracted data and debug info.");
      // Modify the successful response to include debug info
      return c.json({
          extracted_data: jsonData, // Nest the actual data
          debug_prompt: prompt,
          debug_raw_response: cleanJsonString // Return the cleaned text before parsing
        }, 200);

    } catch (parseError) {
      console.error("Worker: Failed to parse LLM response as JSON:", parseError);
      console.error("Worker: Raw LLM Text:", extractedText);
      // Log before returning error
      console.log("Worker: Returning 500 due to LLM response JSON parse error.");
      // Modify the JSON parse error response to include debug info
      return c.json({
          error: 'LLM response was not valid JSON.',
          debug_prompt: prompt, // Add prompt here
          debug_raw_response: extractedText // Return the raw text received
        }, 500);
    }

  } catch (error) {
    // Log any top-level errors in the main try block
    console.error('Worker: Unhandled error in POST handler:', error);
    console.log("Worker: Returning 500 due to unhandled server error.");
    // Avoid leaking detailed internal errors unless necessary for debugging
    // Add error message detail for better debugging
    return c.json({ error: 'An unexpected error occurred on the server.', details: error.message }, 500);
  }
});

// --- Helper Function: ArrayBuffer to Base64 ---
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary); // btoa is available in Cloudflare Workers environment
}

// Export the Hono app for Cloudflare Pages Functions
export const onRequestPost = app.fetch; // Use specific export for Pages Functions
