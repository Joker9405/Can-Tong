import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// 渲染根組件
createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)