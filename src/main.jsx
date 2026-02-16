import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './Context/AuthContext.jsx';

// ─── DEMO MODE ─────────────────────────────────────────────────────────────
// Authentication is fully bypassed.  The app starts immediately in Demo Mode
// with mock data.  No API calls, no WebSocket, no tokens required.
// ────────────────────────────────────────────────────────────────────────────

const DemoBootstrap = ({ children }) => {
  const { setAuth } = useAuth();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Inject a demo user into AuthContext so downstream code never sees null
    setAuth({ userId: 'demo-user', jwtToken: 'DEMO-TOKEN' });
    localStorage.setItem('userId', 'demo-user');
    setReady(true);
    console.log('🎭 Demo Mode — authentication bypassed');
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-700 font-medium">Starting Demo Mode…</p>
          <p className="text-emerald-600 text-sm mt-2">Loading mock data engine</p>
        </div>
      </div>
    );
  }

  return children;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <DemoBootstrap>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DemoBootstrap>
  </AuthProvider>
);
