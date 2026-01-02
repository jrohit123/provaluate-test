import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 🔎 Debug: log env values at startup
/*console.log('ENV', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_PYTHON_URL: import.meta.env.VITE_PYTHON_URL,
});*/

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
