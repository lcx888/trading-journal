import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 🔧 兼容性配置：支持 iOS 12+, Android 5+ 等旧版浏览器
    target: ['es2015', 'chrome63', 'firefox67', 'safari11', 'edge79'],
    
    // 🚀 代码分割优化 - 减少首屏加载体积
    rollupOptions: {
      output: {
        // 优化文件名，便于缓存
        chunkFileNames: 'assets/[name]-[hash:8].js',
        entryFileNames: 'assets/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8].[ext]',
        
manualChunks: (id) => {
          // 移动端代码单独打包（体积极小）
          if (id.includes('/mobile/')) {
            return 'mobile';
          }
          // React 核心（必须首屏加载）
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Ant Design 全家桶（仅桌面端需要）
          if (id.includes('node_modules/antd/') ||
              id.includes('node_modules/@ant-design/')) {
            return 'vendor-antd';
          }
          // ECharts（仅图表页面需要）
          if (id.includes('node_modules/echarts/') ||
              id.includes('node_modules/echarts-for-react/') ||
              id.includes('node_modules/zrender/')) {
            return 'vendor-echarts';
          }
          // XLSX（仅导入页面需要）
          if (id.includes('node_modules/xlsx/')) {
            return 'vendor-xlsx';
          }
          // 工具库
          if (id.includes('node_modules/dayjs/') ||
              id.includes('node_modules/react-markdown/') ||
              id.includes('node_modules/lucide-react/') ||
              id.includes('node_modules/@react-spring/')) {
            return 'vendor-utils';
          }
        },
      },
    },
    
    // 警告阈值
    chunkSizeWarningLimit: 400,
    
    // CSS 兼容性
    cssTarget: ['chrome61', 'safari11'],
    
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    
    // 压缩配置
    minify: 'esbuild',
    
    // 关闭 sourcemap（生产环境）
    sourcemap: false,
    
    // 资源内联阈值（小于 4KB 的资源内联为 base64）
    assetsInlineLimit: 4096,
  },
  
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    // 排除大型库
    exclude: ['echarts', 'xlsx', '@sentry/react'],
  },
  
  // esbuild 转译配置
  esbuild: {
    target: 'es2015',
    // 生产环境移除 console
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  
  // 服务器配置
  server: {
    // 预热常用文件
    warmup: {
      clientFiles: ['./src/App.jsx', './src/pages/Home.jsx'],
    },
  },
})
