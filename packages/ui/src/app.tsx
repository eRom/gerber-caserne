import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Sidebar } from '@/components/sidebar';
import { Dashboard } from '@/pages/dashboard';

export function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
