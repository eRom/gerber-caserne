import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Sidebar } from '@/components/sidebar';
import { Dashboard } from '@/pages/dashboard';
import { ProjectView } from '@/pages/project-view';
import { NoteDetail } from '@/pages/note-detail';
import { NoteNew } from '@/pages/note-new';

export function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects/:slug" element={<ProjectView />} />
            <Route path="/projects/:slug/notes/new" element={<NoteNew />} />
            <Route path="/projects/:slug/notes/:id" element={<NoteDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
