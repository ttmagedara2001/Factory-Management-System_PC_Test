import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

// ─── DEMO MODE ─────────────────────────────────────────────────────────────
// Fully standalone frontend — no authentication, no API, no WebSocket.
// All sensor data is generated locally by MockDataService.
// ────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

