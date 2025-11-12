import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; color: white; background: #1e293b;">
      <h1>Error Loading App</h1>
      <p>${error.message}</p>
      <p>Check console for details.</p>
    </div>
  `;
} 