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
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;
  console.log("Worker: API Key found. Using Gemini URL:", geminiApiUrl);

  const prompt = "hello, how are you?"; // Static prompt for testing

  try {
    console.log("Worker: Using static prompt:", prompt);

    // --- Prepare Payload for Gemini ---
    const requestPayload = {
      contents: [ { parts: [ { text: prompt } ] } ]
    };
    console.log("Worker: Request payload prepared for Gemini.");

    // --- Call Gemini API ---
    console.log("Worker: Sending request to Gemini API...");
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    console.log(`Worker: Received response from Gemini API. Status: ${geminiResponse.status}`);

    // --- Process Gemini Response (Focus on Raw Text) ---
    const rawGeminiText = await geminiResponse.text(); // Get raw text response first
    console.log("Worker: Raw text response from Gemini:", rawGeminiText);

    // Prepare response payload (success or error)
    let responsePayload;
    let responseStatus;

    if (!geminiResponse.ok) {
      console.error(`Worker: Gemini API Error (${geminiResponse.status}): ${rawGeminiText}`);
      let details = rawGeminiText;
      try {
          const googleError = JSON.parse(rawGeminiText);
          details = googleError?.error?.message || rawGeminiText;
      } catch(e) { /* Ignore parsing error, use raw text */ }

      responseStatus = 500;
      responsePayload = {
          error: `Gemini API request failed: ${geminiResponse.statusText}`,
          details: details,
          debug_prompt: prompt,
          debug_raw_response: rawGeminiText // Include raw response even on error
      };
      console.log("Worker: Preparing 500 JSON response due to Gemini API error.");

    } else {
      // Success case
      responseStatus = 200;
      responsePayload = {
          // No 'extracted_data' as we removed JSON parsing expectation for LLM response
          message: "Successfully received response from LLM.", // Add a success message
          debug_prompt: prompt,
          debug_raw_response: rawGeminiText // Return the raw text received
      };
      console.log("Worker: Preparing 200 JSON response with debug info.");
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
    // This catches errors during the fetch call or response processing
    console.error('Worker: Unhandled error in onRequestPost logic:', error);
    const errorPayload = {
        error: 'An unexpected error occurred during worker execution.',
        details: error.message,
        stack_trace_debug: error.stack, // For Cloudflare logs
        debug_prompt: prompt, // Include prompt if available
        debug_raw_response: null
    };
    console.log("Worker: Preparing 500 JSON response due to unhandled error.");
    return new Response(JSON.stringify(errorPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } // Add CORS
    });
  }
};

// Keep the helper function if you plan to reintroduce file uploads later
/*
function arrayBufferToBase64(buffer) {
  // ...
}
*/
