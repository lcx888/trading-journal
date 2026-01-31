import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './errorMonitor.js' // 全局错误监控 - 需要最先加载
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
