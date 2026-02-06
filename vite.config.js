import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 使用 esbuild 压缩（比 terser 快 20-40x）
    minify: 'esbuild',
    // 精细化代码分割
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React 核心 + 相关依赖（必须在同一个 chunk）
          if (
            id.includes('node_modules/react-dom') || 
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-is') ||
            id.includes('node_modules/scheduler') ||
            id.includes('node_modules/use-sync-external-store')
          ) {
            return 'vendor-react';
          }
          // Ant Design 全部依赖 - 单独分包
          if (
            id.includes('node_modules/antd') || 
            id.includes('node_modules/@ant-design/') ||
            id.includes('node_modules/rc-') ||
            id.includes('node_modules/@rc-component') ||
            id.includes('node_modules/@babel/runtime') ||
            id.includes('node_modules/@ctrl/tinycolor') ||
            id.includes('node_modules/@emotion') ||
            id.includes('node_modules/classnames') ||
            id.includes('node_modules/async-validator') ||
            id.includes('node_modules/scroll-into-view-if-needed') ||
            id.includes('node_modules/copy-to-clipboard') ||
            id.includes('node_modules/resize-observer-polyfill') ||
            id.includes('node_modules/compute-scroll-into-view') ||
            id.includes('node_modules/throttle-debounce') ||
            id.includes('node_modules/json2mq') ||
            id.includes('node_modules/toggle-selection') ||
            id.includes('node_modules/stylis')
          ) {
            return 'vendor-antd';
          }
          // ECharts - 单独分包
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender') || id.includes('node_modules/echarts-for-react')) {
            return 'vendor-echarts';
          }
          // TipTap 富文本编辑器 - 单独分包
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
            return 'vendor-tiptap';
          }
          // XLSX - 单独分包
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/cfb') || id.includes('node_modules/codepage')) {
            return 'vendor-xlsx';
          }
          // react-markdown
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark') || id.includes('node_modules/rehype') || id.includes('node_modules/unified') || id.includes('node_modules/mdast') || id.includes('node_modules/micromark') || id.includes('node_modules/hast')) {
            return 'vendor-markdown';
          }
          // lucide-react
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
          // dayjs
          if (id.includes('node_modules/dayjs')) {
            return 'vendor-dayjs';
          }
        },
      },
    },
    // 合理的 chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'antd', 'dayjs'],
  },
})
