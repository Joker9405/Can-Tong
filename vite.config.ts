import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 配置：啟用 React 插件
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist'
  }
})