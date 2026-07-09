import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      // Monorepo: shared/data/config.json client'a doğrudan import edilir (bkz. src/gameConfig.ts).
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
});
