
// Remove Hono and CORS imports for this test
// import { Hono } from 'hono';
// import { cors } from 'hono/cors';

// Remove Hono app instantiation and routes
// const app = new Hono();
// app.use('*', cors());
// app.post('/', async (c) => { ... });

// --- Bare Minimum onRequest Handler ---
export const onRequest = async (context) => {
  // Log entry point - THIS IS THE MOST IMPORTANT LOG
  console.log("Worker: onRequest invoked for path:", context.request.url);
  console.log("Worker: Method:", context.request.method);

  // Log environment variables (optional check)
  try {
    console.log("Worker: Checking for GEMINI_API_KEY presence:", !!context.env.GEMINI_API_KEY);
  } catch (e) {
    console.error("Worker: Error accessing context.env:", e);
  }

  // Immediately return a simple JSON response
  const responsePayload = {
    message: "Function invoked successfully!",
    path: context.request.url,
    method: context.request.method,
    timestamp: new Date().toISOString(),
  };

  console.log("Worker: Attempting to return simple JSON response.");

  try {
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Add CORS headers manually for this direct response
        'Access-Control-Allow-Origin': '*', // Adjust in production
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Allow methods
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (responseError) {
      console.error("Worker: Error creating simple response:", responseError);
      // Fallback plain text error if Response creation fails
      return new Response("Worker failed to create response.", { status: 500 });
  }
};

// Remove the helper function for now as it's not used
/*
function arrayBufferToBase64(buffer) {
  // ...
}
*/

// Remove the previous top-level try/catch around app.fetch as we removed 'app'
/*
export const onRequest = async (context) => {
  try {
    // ... app.fetch ...
  } catch (err) {
    // ... error handling ...
  }
};
*/
