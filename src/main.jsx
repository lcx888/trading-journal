import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './errorMonitor.js' // 全局错误监控 - 需要最先加载
import App from './App.jsx'

// ============================================
// 移动端最小宽度智能缩放 (360px)
// 当屏幕宽度小于 360px 时，自动按比例缩放整个页面
// ============================================
const MIN_VIEWPORT_WIDTH = 360;

const adjustViewport = () => {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  
  const screenWidth = window.screen.width;
  const windowWidth = window.innerWidth;
  const actualWidth = Math.min(screenWidth, windowWidth);
  
  if (actualWidth < MIN_VIEWPORT_WIDTH) {
    // 计算缩放比例
    const scale = actualWidth / MIN_VIEWPORT_WIDTH;
    viewport.setAttribute('content', 
      `width=${MIN_VIEWPORT_WIDTH}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=1.0, user-scalable=yes`
    );
  } else {
    // 恢复正常 viewport
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, minimum-scale=1.0, shrink-to-fit=no'
    );
  }
};

// 初始化时调整
adjustViewport();

// 监听屏幕方向变化
window.addEventListener('orientationchange', () => {
  setTimeout(adjustViewport, 100);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
