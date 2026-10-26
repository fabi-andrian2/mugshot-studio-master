import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

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