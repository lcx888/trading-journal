import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 🔧 兼容性配置：支持 iOS 12+, Android 5+ 等旧版浏览器
    target: ['es2015', 'chrome63', 'firefox67', 'safari11', 'edge79'],
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
    // CSS 兼容性
    cssTarget: ['chrome61', 'safari11'],
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'antd', 'echarts'],
  },
  // esbuild 转译配置
  esbuild: {
    target: 'es2015',
  },
})
