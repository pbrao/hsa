import React from 'react';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>HSA Receipt Tracker</h1>
      </header>
      <main className="app-main">
        <section className="file-input-section">
          <h2>Upload Your File</h2>
          <label htmlFor="file-upload" className="file-input-label">
            Choose File
          </label>
          <input id="file-upload" type="file" className="file-input" />
          {/* We'll add file handling logic later */}
        </section>
      </main>
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Your Company</p>
      </footer>
    </div>
  );
}

export default App;
