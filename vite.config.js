
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repo = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : ''
export default defineConfig({
  plugins: [react()],
  base: repo ? `/${repo}/` : '/',
})
