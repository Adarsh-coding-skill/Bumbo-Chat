import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import FindChat from './component/Pages/FindChat.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
   <FindChat/>
  </StrictMode>,
)
