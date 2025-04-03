

import React, { useState } from 'react';
// No other imports needed for this change

function App() {
  // Add back selectedFile state
  const [selectedFile, setSelectedFile] = useState(null);
  // Add back extractedData state
  const [extractedData, setExtractedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  // Add state for debug info
  const [debugPrompt, setDebugPrompt] = useState('');
  const [debugRawResponse, setDebugRawResponse] = useState('');

  // Add back handleFileChange function
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    // Reset state when a new file is selected or selection is cleared
    setSelectedFile(null);
    // Clear all results/errors/debug on new file selection
    setExtractedData(null);
    setProcessingError('');
    setDebugPrompt('');
    setDebugRawResponse('');

    // Accept only PDF for now, adjust if needed later
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      console.log("PDF file selected:", file.name);
    } else {
      setSelectedFile(null); // Ensure state is null if not PDF
      if (file) { // Only show error if a file was selected but wasn't PDF
          alert('Please select a PDF file.');
      }
    }
  };


  // Modify the upload handler
  const handleUpload = async () => {
    console.log('[handleUpload] Function started.'); // Step 1

    // Add back check for selectedFile
    if (!selectedFile) {
      alert("Please select a PDF file first!");
      return; // Stop if no file is selected
    }

    console.log('[handleUpload] Setting processing state to true...'); // Step 2
    setIsProcessing(true);
    // Clear previous results/errors/debug
    setExtractedData(null);
    setProcessingError('');
    setDebugPrompt('');
    setDebugRawResponse('');
    console.log('[handleUpload] State cleared and isProcessing set.'); // Step 3

    // Add back FormData creation
    console.log('[handleUpload] Creating FormData...'); // New Step 3a
    const formData = new FormData();
    // Use the key expected by the worker (needs to be updated later)
    formData.append('pdfFile', selectedFile);
    console.log('[handleUpload] Appended file to FormData.'); // New Step 3b


    let response;
    let rawResponseText = '';

    try {
      console.log('[handleUpload] Entering try block. Preparing fetch...'); // Step 4
      console.log('[handleUpload] Sending POST request to /extract with file data...'); // Step 5 (Updated log)
      response = await fetch('/extract', {
        method: 'POST',
        // Send the FormData object as the body
        body: formData,
        // NOTE: Do NOT set Content-Type header manually when sending FormData;
        // the browser sets it correctly (multipart/form-data) with the boundary.
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


      // --- Conditional State Setting ---
      if (!response.ok) {
        console.error('[handleUpload] Response status is NOT OK.');
        // Set error and debug info ONLY on error
        const errorMessage = result?.error || `Request failed with status ${response.status}`;
        const errorDetails = result?.details ? ` Details: ${result.details}` : '';
        setProcessingError(`${errorMessage}${errorDetails}`);
        if (result?.debug_prompt) setDebugPrompt(result.debug_prompt);
        setDebugRawResponse(result?.debug_raw_response || rawResponseText); // Show raw response on error
        console.error(`[handleUpload] Error state set.`);
        // No need to throw here, error state is set
      } else {
        // Response is OK (2xx status)
        console.log('[handleUpload] Response status is OK.');
        if (result?.extracted_data) {
            // SUCCESS CASE: Extracted data found
            setExtractedData(result.extracted_data);
            console.log("[handleUpload] Successfully set extractedData state.");
            // DO NOT set debug info here for clean success display
        } else {
            // OK response but missing expected data - treat as error/debug case
            console.warn("[handleUpload] Response OK, but extracted_data missing from worker response.");
            setProcessingError("Processing succeeded, but the expected data structure was not returned by the worker.");
            // Set debug info in this specific failure case
            if (result?.debug_prompt) setDebugPrompt(result.debug_prompt);
            setDebugRawResponse(result?.debug_raw_response || rawResponseText);
        }
      }
      // --- End Conditional State Setting ---

    } catch (error) { // Catches fetch errors, JSON parse errors, etc.
      console.error('[handleUpload] Caught error in main try block:', error); // Step 17 (Catch Block)
      let finalErrorMessage = `Failed to process request: ${error.message}`;
      setProcessingError(finalErrorMessage);
      console.log('[handleUpload] Set processingError state in catch block.'); // Step 17a (Catch Block)

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
      } else if (rawResponseText && !debugRawResponse) {
          // If error occurred but rawResponseText wasn't JSON, still set it for debug
          setDebugRawResponse(rawResponseText);
          console.log('[handleUpload] Set debugRawResponse state with raw text during error handling (non-JSON).');
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
          {/* Update section title */}
          <h2>Upload PDF Receipt</h2>
          {/* Add back file input */}
          <input
            id="file-upload"
            type="file"
            accept="application/pdf" // Specify PDF acceptance
            onChange={handleFileChange}
            className="file-input" // Add class if you have specific styles
            aria-label="PDF upload input"
            disabled={isProcessing} // Disable while processing
          />
          {/* Add back selected file display */}
          {selectedFile && !isProcessing && ( // Show only if file selected and not processing
             <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>Selected: {selectedFile.name}</p>
          )}
          {/* Update button text and disabled logic */}
          <button
             onClick={handleUpload}
             // Disable if no file selected OR if processing
             disabled={!selectedFile || isProcessing}
             style={{ marginTop: '1rem' }}
          >
            {/* Update button text */}
            {isProcessing ? 'Processing...' : 'Process Receipt'}
          </button>
        </section>

        {/* Results section - Conditional Rendering */}
        <section className="results-section">
          {/* Title changes based on state */}
          <h2>{extractedData ? "Extracted Data" : "Processing Details"}</h2>

          {isProcessing && (
            <p>Analyzing PDF with AI, please wait...</p> // Updated loading text
          )}

          {/* Display Extracted Data on Success */}
          {extractedData && !isProcessing && !processingError && (
            <div className="extracted-data-box">
              {/* Use pre for formatted JSON */}
              <pre className="extracted-json-display">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </div>
          )}

          {/* Display Error and Debug Info ONLY if there's an error */}
          {processingError && !isProcessing && (
            <>
              <div className="error-box">
                <strong>Error:</strong> {processingError}
              </div>
              {/* Show Debug Prompt only if error occurred and prompt exists */}
              {debugPrompt && (
                <div className="debug-info-box">
                    <h3>Debug: Prompt Sent to LLM</h3>
                    <pre className="debug-prompt-display">{debugPrompt}</pre>
                </div>
              )}
              {/* Show Debug Raw Response only if error occurred and raw response exists */}
              {debugRawResponse && (
                 <div className="debug-info-box">
                    <h3>Debug: Raw Response from LLM</h3>
                    <pre className="debug-raw-response-display">{debugRawResponse}</pre>
                 </div>
              )}
            </>
          )}

          {/* Placeholder Text */}
          {!isProcessing && !processingError && !extractedData && (
            <p>Upload a PDF receipt and click "Process Receipt" to see the extracted JSON data.</p>
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
