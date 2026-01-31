/**
 * 全局错误监控脚本
 * 监听 JS 运行时错误和 Promise 未处理异常
 */

const ERROR_REPORT_URL = '/api/error-report'; // 错误上报 API 端点

// 收集基础信息
const getBaseInfo = () => ({
  url: window.location.href,
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString(),
  screenSize: `${window.screen.width}x${window.screen.height}`,
  viewportSize: `${window.innerWidth}x${window.innerHeight}`,
});

// 发送错误报告
const sendErrorReport = (errorData) => {
  const payload = {
    ...getBaseInfo(),
    ...errorData,
  };

  // 优先使用 sendBeacon（页面关闭时也能发送）
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(ERROR_REPORT_URL, blob);
  } else {
    // 降级使用 fetch
    fetch(ERROR_REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // 允许页面关闭后继续发送
    }).catch(() => {
      // 静默失败，避免错误上报本身产生错误
    });
  }

  // 开发环境打印到控制台
  if (import.meta.env.DEV) {
    console.group('🚨 错误监控捕获');
    console.log('错误数据:', payload);
    console.groupEnd();
  }
};

// 监听 JS 运行时错误
window.onerror = (message, source, lineno, colno, error) => {
  sendErrorReport({
    type: 'js_error',
    message: message,
    source: source,
    line: lineno,
    column: colno,
    stack: error?.stack || '',
  });
  
  // 返回 false 让错误继续传播到控制台
  return false;
};

// 监听 Promise 未处理异常
window.onunhandledrejection = (event) => {
  const reason = event.reason;
  sendErrorReport({
    type: 'promise_error',
    message: reason?.message || String(reason),
    stack: reason?.stack || '',
  });
};

// 监听资源加载错误（图片、脚本等）
window.addEventListener('error', (event) => {
  const target = event.target;
  if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
    sendErrorReport({
      type: 'resource_error',
      tagName: target.tagName,
      src: target.src || target.href || '',
      message: `资源加载失败: ${target.src || target.href}`,
    });
  }
}, true);

console.log('✅ 全局错误监控已启用');

export default { sendErrorReport };
