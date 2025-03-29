

import React, { useState } from 'react';
// No other imports needed for this change

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  // Add state for worker interaction
  const [extractedData, setExtractedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    // Reset state when a new file is selected or selection is cleared
    setSelectedFile(null);
    setExtractedData(null); // Clear previous results
    setProcessingError(''); // Clear previous errors

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

    setIsProcessing(true); // Set loading state
    setExtractedData(null); // Clear previous results
    setProcessingError(''); // Clear previous errors

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

      if (!response.ok) {
        // Use error message from worker response if available, otherwise provide a default
        const errorMessage = result?.error || `Request failed with status ${response.status}`;
        const errorDetails = result?.details ? ` Details: ${result.details}` : '';
         // If the worker sent back raw LLM text on JSON parse failure, include it
        const rawResponse = result?.raw_response ? ` Raw LLM Response: ${result.raw_response}` : '';
        throw new Error(`${errorMessage}${errorDetails}${rawResponse}`);
      }

      // Success! Store the extracted data
      setExtractedData(result);

    } catch (error) {
      console.error('Error processing file:', error);
      // Display a user-friendly message, potentially logging the full error
      setProcessingError(`Failed to process PDF: ${error.message}`);
      setExtractedData(null); // Clear data on error
    } finally {
      setIsProcessing(false); // Reset loading state regardless of outcome
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

        {/* Add section for results/errors */}
        <section className="results-section">
          <h2>Extracted Information</h2>
          {/* Show loading indicator */}
          {isProcessing && (
            <p>Analyzing PDF with AI, please wait...</p>
          )}
          {/* Show error message */}
          {processingError && (
            <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '4px', backgroundColor: 'rgba(255,0,0,0.1)', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              <strong>Error:</strong> {processingError}
            </div>
          )}
          {/* Show extracted data */}
          {extractedData && !isProcessing && (
            <div>
              <p>Successfully extracted data:</p>
              {/* Display JSON nicely formatted */}
              <pre className="extracted-json-display">
                {JSON.stringify(extractedData, null, 2)}
              </pre>
            </div>
          )}
          {/* Show initial placeholder text */}
          {!isProcessing && !processingError && !extractedData && (
            <p>Upload a PDF receipt and click "Process Receipt" to see results here.</p>
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
