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
        manualChunks: (id) => {
          // React 核心 - 必须首屏加载
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // React Router - 必须首屏加载
          if (id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          
          // Ant Design 拆分：核心 vs 图标
          if (id.includes('@ant-design/icons')) {
            return 'vendor-antd-icons'; // 图标单独拆分
          }
          if (id.includes('node_modules/antd/')) {
            return 'vendor-antd';
          }
          
          // ECharts - 仅 Dashboard/TradeList 等页面需要
          if (id.includes('node_modules/echarts')) {
            return 'vendor-echarts';
          }
          
          // XLSX - 仅导入数据页面需要
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          
          // Markdown 相关 - 仅文档/AI分析页面需要
          if (id.includes('node_modules/react-markdown') || 
              id.includes('node_modules/remark') || 
              id.includes('node_modules/unified') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/mdast') ||
              id.includes('node_modules/hast')) {
            return 'vendor-markdown';
          }
          
          // dayjs 及其插件
          if (id.includes('node_modules/dayjs')) {
            return 'vendor-dayjs';
          }
          
          // Sentry 错误监控 - 延迟加载（体积较大）
          if (id.includes('node_modules/@sentry')) {
            return 'vendor-sentry';
          }
          
          // rc-* 组件（Ant Design 底层依赖）
          if (id.includes('node_modules/rc-')) {
            return 'vendor-antd-rc';
          }
          
          // Lucide 图标
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
          
          // React Spring 动画
          if (id.includes('node_modules/@react-spring')) {
            return 'vendor-animation';
          }
          
          // 其他小型第三方库 - 合并到一个包
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
    
    // 提高警告阈值
    chunkSizeWarningLimit: 500,
    
    // CSS 兼容性
    cssTarget: ['chrome61', 'safari11'],
    
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    
    // 压缩配置
    minify: 'esbuild',
    
    // 生成 sourcemap 便于调试（生产环境可关闭）
    sourcemap: false,
  },
  
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'antd'],
    // 排除大型库，让它们按需加载
    exclude: ['echarts', 'xlsx'],
  },
  
  // esbuild 转译配置
  esbuild: {
    target: 'es2015',
    // 移除 console.log（生产环境）
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})
