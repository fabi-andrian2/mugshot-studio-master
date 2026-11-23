import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ProjectShell from './app/ProjectShell.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProjectShell />
  </StrictMode>,
)