// Bring back Hono and CORS if needed for structure, although not strictly necessary for a single function export
import { Hono } from 'hono'; // Can remove if not using Hono routing/middleware features
import { cors } from 'hono/cors'; // Can remove if not using Hono CORS
// Import Supabase client
import { createClient } from '@supabase/supabase-js';

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

  // Supabase Credentials Check
  const supabaseUrl = context.env.SUPABASE_URL;
  const supabaseKey = context.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
      console.error("Worker: SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables not set.");
      const errorPayload = { error: 'Server configuration error: Database credentials missing.' };
      return new Response(JSON.stringify(errorPayload), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
  }
  console.log("Worker: Supabase credentials found.");

  // --- Initialize Supabase Client ---
  // Use service_role key for server-side operations
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Worker: Supabase client initialized.");

  // Define the extraction prompt
  // Define the extraction prompt
  const prompt = `
    Analyze the content of the provided PDF document, which is an HSA receipt or medical bill.
    Extract the following information precisely:
    1. Provider Name: The name of the clinic, hospital, doctor, or pharmacy. If this cannot be reasonably determined, use the string "Not Found".
    2. Date of Service: The specific date the service was rendered or the item was purchased. Look for labels like 'Service Date', 'Date', 'Transaction Date'. Format as YYYY-MM-DD if possible, otherwise use the format present. If multiple dates exist, use the primary service date or the latest one shown. **It is crucial to return a date value; do not return "Not Found" for this field.** Make the best determination possible from the document content.
    3. Cost of Service: The total amount paid or due by the patient for the service/item. Extract only the final numerical value, excluding currency symbols initially. If this cannot be reasonably determined, use the string "Not Found".

    Return the extracted information ONLY in a valid JSON object format like this:
    {
      "provider_name": "...",
      "date_of_service": "...",
      "cost_of_service": "..."
    }
    Do not include any explanatory text, markdown formatting (like \`\`\`json), or anything else before or after the JSON object itself.
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
        console.log("Worker: Successfully parsed LLM response as JSON:", jsonData);

        // --- Prepare Data for Database Insertion ---
        // Basic cleaning/validation - enhance as needed
        const provider = jsonData.provider_name || "Not Found";
        const dateOfService = jsonData.date_of_service; // Get the date value

        // --- ADD SPECIFIC LOGGING BEFORE VALIDATION ---
        console.log(`Worker: Validating dateOfService. Value: "${dateOfService}", Type: ${typeof dateOfService}`);
        // --- END SPECIFIC LOGGING ---

        // --- VALIDATION FOR date_of_service ---
        if (!dateOfService || dateOfService === "Not Found") {
            console.error("Worker: Validation failed - date_of_service is missing or 'Not Found'. Parsed JSON:", jsonData); // Log the whole JSON object on failure
            throw new Error("LLM did not provide a valid 'date_of_service'. Cannot insert into database.");
        }
        // --- END VALIDATION ---

        let cost = NaN;
        if (jsonData.cost_of_service && jsonData.cost_of_service !== "Not Found") {
            // Remove common currency symbols and commas, then parse
            const costString = String(jsonData.cost_of_service).replace(/[$,]/g, '');
            cost = parseFloat(costString);
        }
         // Check if cost is valid number, else default or handle error
        if (isNaN(cost)) {
            console.warn("Worker: Could not parse cost_of_service to a valid number. Raw:", jsonData.cost_of_service);
            // Decide how to handle: set to 0, null, or throw error? Setting to 0 for now.
            cost = 0;
            // Alternatively, throw an error:
            // throw new Error(`Invalid cost_of_service format: ${jsonData.cost_of_service}`);
        }
        // TODO: Add validation for dateOfService format if required by DB

        const recordToInsert = {
            service_provider: provider,
            date_of_service: dateOfService, // Use the validated date
            cost_of_service: cost
            // created_at is handled by DB default
            // submitted_for_payment_date, payment_received_date are NULL initially
        };

        // --- Insert into Supabase ---
        console.log("Worker: Attempting to insert into Supabase:", recordToInsert);
        const { data: dbData, error: dbError } = await supabase
          .from('hsa_receipts') // Your table name
          .insert([recordToInsert]) // insert expects an array
          .select(); // Optional: get the inserted row back

        if (dbError) {
          // Handle database insertion error
          console.error("Worker: Supabase insert error:", dbError);
          // Throw an error to be caught by the outer catch block
          // This prevents sending a 200 OK to the client if DB fails
          throw new Error(`Database insert failed: ${dbError.message}`);
        }

        console.log("Worker: Supabase insert successful:", dbData);

        // --- Prepare Success Response ---
        responseStatus = 200;
        responsePayload = {
            extracted_data: jsonData, // Original LLM JSON
            db_insert_status: "Success", // Add confirmation
            db_inserted_record: dbData ? dbData[0] : null, // Optionally return inserted record
            debug_prompt: prompt,
            debug_raw_response: rawGeminiText
        };
        console.log("Worker: Preparing 200 JSON response with extracted data and DB confirmation.");

      } catch (parseOrDbError) {
        // Catch errors from JSON parsing, VALIDATION, OR database insertion
        console.error("Worker: Error during LLM JSON parsing, validation, or DB insert:", parseOrDbError);
        responseStatus = 500; // Treat as server-side issue
        responsePayload = {
            error: `Processing failed after successful LLM response: ${parseOrDbError.message}`, // Error message will now include validation failure
            details: parseOrDbError.message, // Redundant but okay
            debug_prompt: prompt,
            debug_raw_response: rawGeminiText // Crucial to see what LLM returned
        };
        console.log("Worker: Preparing 500 JSON response due to post-LLM processing error.");
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
