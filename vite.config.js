import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Configuration nécessaire pour Mugshot Studio avec Tauri
  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,

    // Cargo gère ce dossier : Vite ne doit pas le surveiller.
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})