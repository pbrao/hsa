import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Apply CORS middleware to allow requests from your Pages domain
// In production, you might restrict the origin more specifically
app.use('*', cors());

// Define the POST handler for the /extract route
app.post('/', async (c) => {
  console.log("Worker: Received POST request to /extract (Simplified Debug Mode)");

  // --- Environment Variable Check ---
  if (!c.env.GEMINI_API_KEY) {
    console.error("Worker: GEMINI_API_KEY environment variable not set.");
    return c.json({ error: 'Server configuration error: API key missing.' }, 500);
  }
  const geminiApiKey = c.env.GEMINI_API_KEY;
  // Use the latest Gemini 1.5 Pro model endpoint
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`;
  console.log("Worker: API Key found. Using Gemini URL:", geminiApiUrl);

  try {
    // --- Define Simple Prompt ---
    const prompt = "hello, how are you?"; // Simple test prompt
    console.log("Worker: Using simple prompt:", prompt);

    // --- Prepare Simplified Payload for Gemini ---
    const requestPayload = {
      contents: [
        {
          parts: [ { text: prompt } ] // Only include the text part
        }
      ]
      // Optional: Add generationConfig if needed
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

    // --- Process Gemini Response (Focus on Raw Text) ---
    const rawGeminiText = await geminiResponse.text(); // Get raw text response first
    console.log("Worker: Raw text response from Gemini:", rawGeminiText);

    if (!geminiResponse.ok) {
      console.error(`Worker: Gemini API Error (${geminiResponse.status}): ${rawGeminiText}`);
      let details = rawGeminiText;
      try {
          const googleError = JSON.parse(rawGeminiText);
          details = googleError?.error?.message || rawGeminiText;
      } catch(e) { /* Ignore parsing error, use raw text */ }
      console.log("Worker: Returning 500 due to Gemini API error.");
      // Return error details along with debug info
      return c.json({
          error: `Gemini API request failed: ${geminiResponse.statusText}`,
          details: details,
          debug_prompt: prompt,
          debug_raw_response: rawGeminiText // Include raw response even on error
        }, 500);
    }

    // --- Return Debug Info (using raw text directly) ---
    console.log("Worker: Returning 200 with debug info (raw LLM response).");
    return c.json({
        // No 'extracted_data' in this simplified version
        debug_prompt: prompt,
        // Directly return the raw text received from Gemini
        debug_raw_response: rawGeminiText
      }, 200);

  } catch (error) {
    // Log any top-level errors in the main try block
    console.error('Worker: Unhandled error in POST handler:', error);
    console.log("Worker: Returning 500 due to unhandled server error.");
    return c.json({
        error: 'An unexpected error occurred on the server.',
        details: error.message,
        debug_prompt: "hello, how are you?", // Include prompt even in top-level error
        debug_raw_response: null // No response received in this case
      }, 500);
  }
});

// --- Helper Function: ArrayBuffer to Base64 ---
// This function is no longer needed for the simplified test, but keep it for when you revert
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary); // btoa is available in Cloudflare Workers environment
}

// Export the Hono app for Cloudflare Pages Functions with Top-Level Error Catching
// TEMPORARY CHANGE FOR DEBUGGING: Handle ALL methods
export const onRequest = async (context) => {
  // Add a log specific to this handler
  console.log("Worker: onRequest (all methods) handler invoked.");

  // You might want to check context.request.method here if needed
  // For now, just proceed with the existing logic or return a simple test message

  try {
    // Delegate the request to the Hono application
    return await app.fetch(context.request, context.env, context);
  } catch (err) {
    // This catches errors thrown BEFORE or DURING Hono's processing
    // (e.g., middleware errors, routing errors, or unhandled exceptions in app.fetch)
    console.error("Worker: Top-level unhandled exception caught in onRequest:", err); // Updated log message

    // Manually construct a JSON Response object because Hono's context 'c' might not be available
    const errorResponse = {
      error: "Worker script execution failed unexpectedly.",
      details: err.message,
      // Include stack trace for better debugging in Cloudflare logs
      // Avoid sending stack trace to the client in production for security
      stack_trace_debug: err.stack // Consider removing/disabling this in production
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        // Add CORS headers manually if needed, as Hono middleware might not have run
        'Access-Control-Allow-Origin': '*', // IMPORTANT: Restrict this in production
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // Match allowed methods
        'Access-Control-Allow-Headers': 'Content-Type', // Match allowed headers
       }
    });
  }
};
