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
          // ECharts - 大体积，单独分包（懒加载页面使用）
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender') || id.includes('node_modules/echarts-for-react')) {
            return 'vendor-echarts';
          }
          // TipTap 富文本编辑器 - 单独分包
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
            return 'vendor-tiptap';
          }
          // XLSX - 单独分包（仅导入页使用）
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/cfb') || id.includes('node_modules/codepage')) {
            return 'vendor-xlsx';
          }
          // 其余所有 node_modules 打成一个 vendor 包（React + Antd + 其他）
          if (id.includes('node_modules/')) {
            return 'vendor';
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
