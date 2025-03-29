import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Apply CORS middleware to allow requests from your Pages domain
// In production, you might restrict the origin more specifically
app.use('*', cors());

// Define the POST handler for the /extract route
app.post('/', async (c) => {
  // --- Environment Variable Check ---
  if (!c.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable not set.");
    return c.json({ error: 'Server configuration error: API key missing.' }, 500);
  }
  const geminiApiKey = c.env.GEMINI_API_KEY;
  // Use the latest Gemini 1.5 Pro model endpoint
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;

  try {
    // --- Get File from Request ---
    const formData = await c.req.formData();
    const file = formData.get('pdfFile'); // Ensure this key matches the frontend FormData

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No PDF file provided in the request.' }, 400);
    }
    if (file.type !== 'application/pdf') {
        return c.json({ error: 'Invalid file type. Only PDF is accepted.' }, 400);
    }

    // --- Read File and Convert to Base64 ---
    const arrayBuffer = await file.arrayBuffer();
    const base64String = arrayBufferToBase64(arrayBuffer); // Helper function defined below

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
    `;

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

    // --- Call Gemini API ---
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`Gemini API Error (${geminiResponse.status}): ${errorBody}`);
      // Try to parse error details from Google's response if possible
      let details = errorBody;
      try {
          const googleError = JSON.parse(errorBody);
          details = googleError?.error?.message || errorBody;
      } catch(e) { /* Ignore parsing error, use raw text */ }
      return c.json({ error: `Gemini API request failed: ${geminiResponse.statusText}`, details: details }, 500);
    }

    const geminiResult = await geminiResponse.json();

    // --- Process Gemini Response ---
    let extractedText = '';
    // Check standard path and potential variations in response structure
    if (geminiResult.candidates?.[0]?.content?.parts?.[0]?.text) {
        extractedText = geminiResult.candidates[0].content.parts[0].text;
    } else {
        console.error("Unexpected Gemini response structure:", JSON.stringify(geminiResult, null, 2));
        // Include prompt in this error response too
        return c.json({
             error: 'Failed to parse response from LLM.',
             details: "Unexpected response structure.",
             debug_prompt: prompt // Add prompt here
            }, 500);
    }

    // Attempt to parse the extracted text as JSON
    try {
      // Clean potential markdown formatting
      const cleanJsonString = extractedText.trim().replace(/^```json\s*|```$/g, '');
      const jsonData = JSON.parse(cleanJsonString);

      // Basic validation of expected keys (optional but recommended)
      if (typeof jsonData.provider_name === 'undefined' || typeof jsonData.date_of_service === 'undefined' || typeof jsonData.cost_of_service === 'undefined') {
          console.warn("LLM response JSON missing expected keys. Raw:", cleanJsonString);
          // Decide whether to return partial data or error out
          // return c.json({ error: 'LLM response JSON missing expected keys.', raw_response: cleanJsonString }, 500);
      }

      // Modify the successful response to include debug info
      return c.json({
          extracted_data: jsonData, // Nest the actual data
          debug_prompt: prompt,
          debug_raw_response: cleanJsonString // Return the cleaned text before parsing
        }, 200);

    } catch (parseError) {
      console.error("Failed to parse LLM response as JSON:", parseError);
      console.error("Raw LLM Text:", extractedText);
      // Modify the JSON parse error response to include debug info
      return c.json({
          error: 'LLM response was not valid JSON.',
          debug_prompt: prompt, // Add prompt here
          debug_raw_response: extractedText // Return the raw text received
        }, 500);
    }

  } catch (error) {
    console.error('Error processing request:', error);
    // Avoid leaking detailed internal errors unless necessary for debugging
    return c.json({ error: 'An unexpected error occurred on the server.' }, 500);
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
