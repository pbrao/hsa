import React from 'react';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Welcome to Your React App</h1>
        <p>A simple, modern single-page application.</p>
      </header>
      <main className="app-main">
        <section>
          <h2>Getting Started</h2>
          <p>Edit <code>src/App.jsx</code> and save to see changes.</p>
        </section>
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
