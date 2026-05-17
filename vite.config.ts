import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 保留 /api 前缀，给网关做路由匹配（网关 StripPrefix=1 会再剥离）
        timeout: 180000,
        proxyTimeout: 180000,
      },
    },
  },
})
