import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 代码分割配置
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom'],
          // Ant Design 组件库
          'vendor-antd': ['antd', '@ant-design/icons'],
          // 图表库
          'vendor-echarts': ['echarts', 'echarts-for-react'],
          // 工具库
          'vendor-utils': ['dayjs', 'xlsx', 'react-markdown'],
        },
      },
    },
    // 提高警告阈值
    chunkSizeWarningLimit: 600,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'antd', 'echarts'],
  },
})
