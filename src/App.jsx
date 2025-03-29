

import React, { useState } from 'react';
// No other imports needed for this change

function App() {
  // Remove selectedFile state
  // const [selectedFile, setSelectedFile] = useState(null);
  // Remove extractedData state
  // const [extractedData, setExtractedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  // Add state for debug info
  const [debugPrompt, setDebugPrompt] = useState('');
  const [debugRawResponse, setDebugRawResponse] = useState('');

  // Remove handleFileChange function
  /*
  const handleFileChange = (event) => {
    // ... removed ...
  };
  */

  // Modify the upload handler
  const handleUpload = async () => {
    // Remove check for selectedFile
    /*
    if (!selectedFile) {
      alert("Please select a PDF file first!");
      return;
    }
    */

    setIsProcessing(true);
    // Remove setExtractedData
    // setExtractedData(null);
    setProcessingError('');
    // Clear debug info before new request
    setDebugPrompt('');
    setDebugRawResponse('');

    const formData = new FormData();
    // Key must match the key expected by the worker: 'pdfFile'
    formData.append('pdfFile', selectedFile);

    let response; // Define response outside try block to access in finally
    let rawResponseText = ''; // Variable to store raw text

    try {
      console.log('Frontend: Sending request to /extract...');
      // The endpoint is relative because we use Pages Functions.
      // It corresponds to /functions/extract.js
      // Send POST request without a body
      response = await fetch('/extract', {
        method: 'POST',
        // No body needed as the worker uses a static prompt now
        // headers: { 'Content-Type': 'application/json' } // Optional: Can set header if needed, but worker ignores body
      });

      console.log(`Frontend: Received response status: ${response.status} ${response.statusText}`);

      // Get raw text first to see what was actually returned
      rawResponseText = await response.text();
      console.log('Frontend: Received raw response text from worker:', rawResponseText);

      // Now, try to parse the raw text as JSON
      let result;
      try {
          if (!rawResponseText) {
              throw new Error("Response body from worker is empty.");
          }
          result = JSON.parse(rawResponseText); // Parse the text we already fetched
          console.log('Frontend: Successfully parsed JSON from worker:', result);
      } catch (jsonError) {
          console.error('Frontend: Failed to parse response text from worker as JSON:', jsonError);
          // Throw a more informative error including the raw text
          throw new Error(`Failed to parse JSON response from worker. Status: ${response.status}. Raw text: ${rawResponseText}`);
      }


      // Store debug info regardless of response.ok, if available from parsed JSON
      if (result?.debug_prompt) {
        setDebugPrompt(result.debug_prompt);
      }
      // Use the raw text for debug_raw_response if parsing failed but text exists,
      // otherwise use the parsed value if available.
      setDebugRawResponse(result?.debug_raw_response || rawResponseText);


      if (!response.ok) {
        // We already parsed 'result', use it for error details
        const errorMessage = result?.error || `Request failed with status ${response.status}`;
        const errorDetails = result?.details ? ` Details: ${result.details}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      // --- Remove extracted_data logic ---
      /*
      // Success! Store the extracted data (now nested)
      if (result?.extracted_data) {
          setExtractedData(result.extracted_data);
      } else {
          // Handle case where response is ok, but data structure is wrong
          throw new Error("Received success status, but extracted data is missing in the response.");
      }
      */
      console.log("Frontend: Request successful, displaying debug info.");


    } catch (error) {
      console.error('Frontend: Error during fetch or processing:', error);
      // Ensure error message is set, potentially including raw text if available and not already in message
      let finalErrorMessage = `Failed to process request: ${error.message}`; // Update error message context
      if (rawResponseText && !error.message.includes(rawResponseText)) {
          // Append raw text if it wasn't part of the JSON parse error message
          // finalErrorMessage += ` (Raw Response: ${rawResponseText})`;
          // Raw response is now displayed separately, so maybe don't append here.
      }
       setProcessingError(finalErrorMessage);
      // Remove setExtractedData
      // setExtractedData(null); // Clear data on error
      // Debug info might already be set from the try block's initial parsing
      // Ensure raw response debug state is set even on error if available
      if (rawResponseText && !debugRawResponse) {
          // Attempt to parse worker response JSON even on error to get debug fields
          try {
              const errorResult = JSON.parse(rawResponseText);
              if (errorResult?.debug_prompt) setDebugPrompt(errorResult.debug_prompt);
              if (errorResult?.debug_raw_response) setDebugRawResponse(errorResult.debug_raw_response);
          } catch (e) {
              // If parsing fails, just set the raw text as the debug response
              setDebugRawResponse(rawResponseText);
          }
      }

    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="app-container">
      <header className="app-header">
         <h1>HSA Receipt Tracker</h1>
      </header>
      <main className="app-main">
        {/* Modify upload section */}
        <section className="upload-section">
          <h2>Trigger LLM Test</h2>
          {/* Remove file input and selected file display */}
          {/*
          <input ... />
          {selectedFile && ( <p>...</p> )}
          */}
          <p>Click the button to send a static prompt ("hello, how are you?") to the LLM via the Cloudflare Worker.</p>
          <button
             onClick={handleUpload}
             // Only disable when processing
             disabled={isProcessing}
             style={{ marginTop: '1rem' }}
          >
            {isProcessing ? 'Sending...' : 'Send Test Prompt'}
          </button>
        </section>

        {/* Modify results/errors section to include debug info */}
        <section className="results-section">
          <h2>Processing Details</h2>
          {isProcessing && (
            <p>Sending request and waiting for LLM response...</p> // Update loading text
          )}
          {/* Show error message */}
          {processingError && (
            <div className="error-box">
              <strong>Error:</strong> {processingError}
            </div>
          )}

          {/* --- Remove Extracted Data Section --- */}
          {/*
          {extractedData && !isProcessing && (
            <div className="extracted-data-box">
              <h3>Successfully Extracted Data:</h3>
              <pre className="extracted-json-display">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </div>
          )}
          */}

          {/* Show Debug Prompt */}
          {debugPrompt && (
            <div className="debug-info-box">
                <h3>Debug: Prompt Sent to LLM</h3>
                <pre className="debug-prompt-display">{debugPrompt}</pre>
            </div>
          )}

          {/* Show Debug Raw Response */}
          {debugRawResponse && (
             <div className="debug-info-box">
                <h3>Debug: Raw Response from LLM</h3>
                <pre className="debug-raw-response-display">{debugRawResponse}</pre>
             </div>
          )}


          {/* Adjust placeholder text */}
          {!isProcessing && !processingError && !debugPrompt && !debugRawResponse && (
            <p>Click the "Send Test Prompt" button to see the prompt sent and raw response received from the LLM.</p>
          )}
        </section>

      </main>
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Your Company</p>
      </footer>
    </div>
  );
}

export default App;
