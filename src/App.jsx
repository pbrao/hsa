
// Remove useState if no longer needed, or keep if selectedFile state is used elsewhere
import React, { useState } from 'react';
// Remove pdfjs-dist import and worker config
// import * as pdfjsLib from 'pdfjs-dist';
// pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();


function App() {
  // Keep selectedFile state, remove others
  const [selectedFile, setSelectedFile] = useState(null);
  // Remove pdfText, isLoading, error states
  // const [pdfText, setPdfText] = useState('');
  // const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState('');

  // Simplify the file change handler
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      console.log("PDF file selected:", file.name);
      // Placeholder: Ready to send 'file' to a backend for processing into JSON
    } else {
      setSelectedFile(null);
      if (file) { // Only show error if a file was selected but wasn't PDF
          alert('Please select a PDF file.');
      }
    }
  };

  // Add back a placeholder upload handler
  const handleUpload = () => {
    if (!selectedFile) {
      alert("Please select a PDF file first!");
      return;
    }
    // --- Placeholder for sending the file to a backend API ---
    console.log("Initiating upload/processing for:", selectedFile.name);
    alert(`Placeholder: Would now send ${selectedFile.name} to backend for JSON extraction.`);
    // Example using FormData (how you might structure the request)
    // const formData = new FormData();
    // formData.append('pdfFile', selectedFile);
    // fetch('/api/extract-pdf', { // Replace with your actual API endpoint
    //   method: 'POST',
    //   body: formData,
    // })
    // .then(response => response.json())
    // .then(data => {
    //   console.log('Processing result (JSON):', data);
    //   // Handle the JSON data from the backend
    // })
    // .catch(error => {
    //   console.error('Error uploading/processing file:', error);
    //   alert('Failed to process PDF.');
    // });
    // --- End Placeholder ---
  };


  return (
    <div className="app-container">
      <header className="app-header">
         {/* Ensure the H1 is present if it was accidentally removed */}
         <h1>HSA Receipt Tracker</h1>
      </header>
      <main className="app-main">
        <section className="upload-section">
          <h2>Upload Your PDF Receipt</h2>
          <input
            id="file-upload"
            type="file"
            accept="application/pdf" // Accept only PDF files
            onChange={handleFileChange}
            className="file-input" // Keep class if needed for styling
            aria-label="PDF upload input"
          />
          {selectedFile && (
             <p>Selected: {selectedFile.name}</p>
          )}
          {/* Add the upload button back */}
          <button
             onClick={handleUpload}
             disabled={!selectedFile}
             style={{ marginTop: '1rem' }}
          >
            Process Receipt
          </button>
        </section>

        {/* Remove the entire pdf-content-section */}
        {/*
        {(isLoading || pdfText) && (
          <section className="pdf-content-section">
            <h2>Extracted Text</h2>
            {isLoading ? (
              <p>Loading and parsing PDF...</p>
            ) : (
              <pre className="pdf-text-display">{pdfText}</pre>
            )}
          </section>
        )}
        */}
      </main>
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Your Company</p>
      </footer>
    </div>
  );
}

export default App;
