// 🚀 性能标记：JS 模块开始加载
if (window.__perfMetrics) window.__perfMetrics.mark('JS模块开始');

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './errorMonitor.js' // 全局错误监控 - 需要最先加载
import App from './App.jsx'

// 🚀 性能标记：所有 import 完成
if (window.__perfMetrics) window.__perfMetrics.mark('Import完成');

// ============================================
// 移动端兼容性修复
// ============================================

// 1. 动态 vh 单位（解决移动端地址栏导致的 100vh 问题）
const setVhVariable = () => {
  try {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  } catch (e) {
    // 静默失败
  }
};
setVhVariable();
window.addEventListener('resize', setVhVariable);
window.addEventListener('orientationchange', () => setTimeout(setVhVariable, 100));

// 2. 移动端最小宽度智能缩放 (360px)
const MIN_VIEWPORT_WIDTH = 360;

const adjustViewport = () => {
  try {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    
    const screenWidth = window.screen.width;
    const windowWidth = window.innerWidth;
    const actualWidth = Math.min(screenWidth, windowWidth);
    
    if (actualWidth < MIN_VIEWPORT_WIDTH) {
      const scale = actualWidth / MIN_VIEWPORT_WIDTH;
      viewport.setAttribute('content', 
        'width=' + MIN_VIEWPORT_WIDTH + ', initial-scale=' + scale + ', minimum-scale=' + scale + ', maximum-scale=1.0, user-scalable=yes'
      );
    } else {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, minimum-scale=1.0, shrink-to-fit=no'
      );
    }
  } catch (e) {
    // 静默失败
  }
};

adjustViewport();
window.addEventListener('orientationchange', () => setTimeout(adjustViewport, 100));

// 3. 渲染应用（包装在 try-catch 中）
try {
  if (window.__perfMetrics) window.__perfMetrics.mark('React渲染开始');
  
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    
    // 🚀 性能标记：首次渲染完成（使用 requestIdleCallback 或 setTimeout）
    var markRenderComplete = function() {
      if (window.__perfMetrics) window.__perfMetrics.mark('React渲染完成');
    };
    if (window.requestIdleCallback) {
      requestIdleCallback(markRenderComplete);
    } else {
      setTimeout(markRenderComplete, 0);
    }
  } else {
    console.error('Root element not found');
  }
} catch (e) {
  console.error('App render failed:', e);
  if (window.__mobileDebug) window.__mobileDebug.log('ERROR', 'Render: ' + (e.message || e));
  
  // 显示错误信息给用户
  var root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="padding:20px;color:#fff;background:#1a1a1a;font-family:sans-serif;"><h2>页面加载失败</h2><p>' + (e.message || e) + '</p><p>请刷新页面重试</p></div>';
  }
}
