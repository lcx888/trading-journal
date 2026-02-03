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
          // ========== 首屏必须加载 ==========
          // React 核心
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'core-react';
          }
          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'core-react';
          }
          // scheduler (React 依赖)
          if (id.includes('node_modules/scheduler')) {
            return 'core-react';
          }
          
          // ========== Ant Design 拆分 ==========
          // 图标 - 体积大，单独拆分
          if (id.includes('@ant-design/icons')) {
            return 'ui-antd-icons';
          }
          // rc-* 底层组件
          if (id.includes('node_modules/rc-')) {
            return 'ui-antd-base';
          }
          // antd 核心
          if (id.includes('node_modules/antd/')) {
            return 'ui-antd';
          }
          // @ant-design 其他包
          if (id.includes('node_modules/@ant-design/')) {
            return 'ui-antd-base';
          }
          
          // ========== 大型库 - 按需加载 ==========
          // ECharts（仅图表页面需要）
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'lib-echarts';
          }
          
          // XLSX（仅导入页面需要）
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/codepage')) {
            return 'lib-xlsx';
          }
          
          // Markdown（仅文档/AI页面需要）
          if (id.includes('node_modules/react-markdown') || 
              id.includes('node_modules/remark') || 
              id.includes('node_modules/unified') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/mdast') ||
              id.includes('node_modules/hast') ||
              id.includes('node_modules/unist')) {
            return 'lib-markdown';
          }
          
          // Sentry（错误监控，可延迟）
          if (id.includes('node_modules/@sentry')) {
            return 'lib-sentry';
          }
          
          // ========== 工具库 ==========
          // dayjs
          if (id.includes('node_modules/dayjs')) {
            return 'util-dayjs';
          }
          
          // Lucide 图标
          if (id.includes('node_modules/lucide-react')) {
            return 'util-icons';
          }
          
          // React Spring 动画
          if (id.includes('node_modules/@react-spring')) {
            return 'util-animation';
          }
          
          // ========== 其他 ==========
          if (id.includes('node_modules/')) {
            return 'vendor';
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
