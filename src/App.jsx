
// Add useState import
import React, { useState } from 'react';
// Import pdfjs-dist and configure worker
import * as pdfjsLib from 'pdfjs-dist';
// Use the minified worker build. The URL constructor with import.meta.url tells Vite to handle this asset correctly.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();


function App() {
  // Add state variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(''); // Optional: for error messages

  // Implement the file change handler
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setPdfText(''); // Clear previous text
      setError(''); // Clear previous errors
      setIsLoading(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target.result);
        try {
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // textContent.items is an array of { str: 'text', ... }
            fullText += textContent.items.map(item => item.str).join(' ') + '\n'; // Add newline between pages
          }
          setPdfText(fullText);
        } catch (err) {
          console.error("Error parsing PDF:", err);
          setError(`Error parsing PDF: ${err.message}. Ensure it's a valid PDF file.`);
          setPdfText(''); // Clear text on error
        } finally {
          setIsLoading(false);
        }
      };
      reader.onerror = (err) => {
        console.error("FileReader error:", err);
        setError('Error reading file.');
        setIsLoading(false);
      }
      reader.readAsArrayBuffer(file);

    } else {
      setSelectedFile(null);
      setPdfText('');
      setError(file ? 'Please select a PDF file.' : ''); // Show error if a non-PDF is selected
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
      </header>
      <main className="app-main">
        <section className="upload-section"> {/* Changed class name for consistency */}
          <h2>Upload Your PDF Receipt</h2>
          {/* Removed the custom label, using default input appearance */}
          <input
            id="file-upload"
            type="file"
            accept="application/pdf" // Accept only PDF files
            onChange={handleFileChange}
            className="file-input" // Keep class if needed for styling
            aria-label="PDF upload input"
          />
          {selectedFile && !isLoading && !error && (
             <p>Selected: {selectedFile.name}</p>
          )}
          {error && (
            <p style={{ color: 'red' }}>{error}</p>
          )}
        </section>

        {/* Add section for loading indicator and text display */}
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
      </main>
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Your Company</p>
      </footer>
    </div>
  );
}

export default App;
