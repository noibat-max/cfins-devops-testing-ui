import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// QA Workbench UI dev server. The API (qa-platform-api) runs on :8000; the UI
// talks to it directly via VITE_API_BASE (see src/lib/api.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
