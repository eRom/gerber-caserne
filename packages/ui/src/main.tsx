import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold text-zinc-50">agent-brain</h1>
    </div>
  </StrictMode>,
);
