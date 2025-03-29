

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
    console.log('[handleUpload] Function started.'); // Step 1

    console.log('[handleUpload] Setting processing state to true...'); // Step 2
    setIsProcessing(true);
    setProcessingError('');
    setDebugPrompt('');
    setDebugRawResponse('');
    console.log('[handleUpload] State cleared and isProcessing set.'); // Step 3

    let response;
    let rawResponseText = '';

    try {
      console.log('[handleUpload] Entering try block. Preparing fetch...'); // Step 4
      console.log('[handleUpload] Sending POST request to /extract...'); // Step 5
      response = await fetch('/extract', {
        method: 'POST',
      });
      console.log('[handleUpload] Fetch call completed.'); // Step 6

      console.log(`[handleUpload] Received response status: ${response.status} ${response.statusText}`); // Step 7

      console.log('[handleUpload] Attempting to read response text...'); // Step 8
      rawResponseText = await response.text();
      console.log('[handleUpload] Received raw response text from worker:', rawResponseText); // Step 9

      let result;
      console.log('[handleUpload] Attempting to parse worker response text as JSON...'); // Step 10
      try {
          if (!rawResponseText) {
              console.warn('[handleUpload] Worker response body is empty.'); // Step 11a (Warning)
              throw new Error("Response body from worker is empty.");
          }
          result = JSON.parse(rawResponseText);
          console.log('[handleUpload] Successfully parsed JSON from worker:', result); // Step 11b (Success)
      } catch (jsonError) {
          console.error('[handleUpload] Failed to parse response text from worker as JSON:', jsonError); // Step 11c (Error)
          throw new Error(`Failed to parse JSON response from worker. Status: ${response.status}. Raw text: ${rawResponseText}`);
      }

      console.log('[handleUpload] Checking for debug info in parsed worker response...'); // Step 12
      if (result?.debug_prompt) {
        setDebugPrompt(result.debug_prompt);
        console.log('[handleUpload] Set debugPrompt state.'); // Step 12a
      }
      setDebugRawResponse(result?.debug_raw_response || rawResponseText);
      console.log('[handleUpload] Set debugRawResponse state.'); // Step 12b


      console.log(`[handleUpload] Checking if response status is OK (status: ${response.status})...`); // Step 13
      if (!response.ok) {
        console.error('[handleUpload] Response status is NOT OK.'); // Step 14a (Error Path)
        const errorMessage = result?.error || `Request failed with status ${response.status}`;
        const errorDetails = result?.details ? ` Details: ${result.details}` : '';
        console.error(`[handleUpload] Throwing error: ${errorMessage}${errorDetails}`); // Step 14b (Error Path)
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      // If response.ok is true:
      console.log('[handleUpload] Response status is OK.'); // Step 15 (Success Path)
      console.log("[handleUpload] Request successful, displaying debug info."); // Step 16 (Success Path)


    } catch (error) {
      console.error('[handleUpload] Caught error in main try block:', error); // Step 17 (Catch Block)
      let finalErrorMessage = `Failed to process request: ${error.message}`;
      setProcessingError(finalErrorMessage);
      console.log('[handleUpload] Set processingError state.'); // Step 17a (Catch Block)

      // Ensure raw response debug state is set even on error if available
      if (rawResponseText && !debugRawResponse) {
          console.log('[handleUpload] Attempting to set debug info from raw text during error handling...'); // Step 17b (Catch Block)
          try {
              const errorResult = JSON.parse(rawResponseText);
              if (errorResult?.debug_prompt) {
                  setDebugPrompt(errorResult.debug_prompt);
                  console.log('[handleUpload] Set debugPrompt state during error handling.'); // Step 17c (Catch Block)
              }
              if (errorResult?.debug_raw_response) {
                  setDebugRawResponse(errorResult.debug_raw_response);
                  console.log('[handleUpload] Set debugRawResponse state during error handling.'); // Step 17d (Catch Block)
              }
          } catch (e) {
              console.warn('[handleUpload] Could not parse raw text for debug info during error handling. Setting raw text directly.'); // Step 17e (Catch Block)
              setDebugRawResponse(rawResponseText);
          }
      }
    } finally {
      console.log('[handleUpload] Entering finally block.'); // Step 18
      setIsProcessing(false);
      console.log('[handleUpload] Set isProcessing state to false. Function finished.'); // Step 19
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
