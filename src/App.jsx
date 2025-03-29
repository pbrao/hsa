

import React, { useState } from 'react';
// No other imports needed for this change

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  // Add state for worker interaction
  const [extractedData, setExtractedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  // Add state for debug info
  const [debugPrompt, setDebugPrompt] = useState('');
  const [debugRawResponse, setDebugRawResponse] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    // Reset state when a new file is selected or selection is cleared
    setSelectedFile(null);
    setExtractedData(null);
    setProcessingError('');
    // Clear debug info as well
    setDebugPrompt('');
    setDebugRawResponse('');

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

  // Update the upload handler to call the worker
  const handleUpload = async () => { // Make the function async
    if (!selectedFile) {
      alert("Please select a PDF file first!");
      return;
    }

    setIsProcessing(true);
    setExtractedData(null);
    setProcessingError('');
    // Clear debug info before new request
    setDebugPrompt('');
    setDebugRawResponse('');

    const formData = new FormData();
    // Key must match the key expected by the worker: 'pdfFile'
    formData.append('pdfFile', selectedFile);

    try {
      // The endpoint is relative because we use Pages Functions.
      // It corresponds to /functions/extract.js
      const response = await fetch('/extract', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json(); // Always try to parse JSON

      // Store debug info regardless of response.ok, if available
      if (result?.debug_prompt) {
        setDebugPrompt(result.debug_prompt);
      }
      if (result?.debug_raw_response) {
        setDebugRawResponse(result.debug_raw_response);
      }

      if (!response.ok) {
        const errorMessage = result?.error || `Request failed with status ${response.status}`;
        const errorDetails = result?.details ? ` Details: ${result.details}` : '';
        // Raw response is now handled by the state variable above
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      // Success! Store the extracted data (now nested)
      if (result?.extracted_data) {
          setExtractedData(result.extracted_data);
      } else {
          // Handle case where response is ok, but data structure is wrong
          throw new Error("Received success status, but extracted data is missing in the response.");
      }


    } catch (error) {
      console.error('Error processing file:', error);
      setProcessingError(`Failed to process PDF: ${error.message}`);
      setExtractedData(null); // Clear data on error
      // Debug info might already be set from the try block's initial parsing
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
        <section className="upload-section">
          <h2>Upload Your PDF Receipt</h2>
          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="file-input"
            aria-label="PDF upload input"
            // Disable input while processing
            disabled={isProcessing}
          />
          {selectedFile && (
             <p>Selected: {selectedFile.name}</p>
          )}
          <button
             onClick={handleUpload}
             // Disable button if no file or if processing
             disabled={!selectedFile || isProcessing}
             style={{ marginTop: '1rem' }}
          >
            {/* Change button text based on state */}
            {isProcessing ? 'Processing...' : 'Process Receipt'}
          </button>
        </section>

        {/* Modify results/errors section to include debug info */}
        <section className="results-section">
          <h2>Processing Details</h2>
          {/* Show loading indicator */}
          {isProcessing && (
            <p>Analyzing PDF with AI, please wait...</p>
          )}
          {/* Show error message */}
          {processingError && (
            <div className="error-box">
              <strong>Error:</strong> {processingError}
            </div>
          )}

          {/* Show extracted data */}
          {extractedData && !isProcessing && (
            <div className="extracted-data-box">
              <h3>Successfully Extracted Data:</h3>
              <pre className="extracted-json-display">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </div>
          )}

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


          {/* Show initial placeholder text */}
          {!isProcessing && !processingError && !extractedData && !debugPrompt && !debugRawResponse && (
            <p>Upload a PDF receipt and click "Process Receipt" to see results and debug information here.</p>
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
