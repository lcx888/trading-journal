// 生产环境使用相对路径（前后端同域），开发环境使用本地后端
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '');

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

export const setAuthToken = (token) => {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
};

export const apiRequest = async (path, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let message = '请求失败';
    try {
      const err = await res.json();
      if (err?.message) message = err.message;
    } catch (e) {
      // ignore parse error
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
};

// AI 分析 API
export const aiApi = {
  // 分析交易数据
  analyze: (recordId, dateRange) => 
    apiRequest('/ai/analyze', { method: 'POST', body: { recordId, dateRange } }),
  
  // 分析单笔交易
  analyzeTrade: (tradeId) => 
    apiRequest(`/ai/analyze-trade/${tradeId}`, { method: 'POST' }),
  
  // AI 问答
  chat: (message, chatHistory = []) => 
    apiRequest('/ai/chat', { method: 'POST', body: { message, chatHistory } }),
  
  // 每日总结
  dailySummary: (date) => 
    apiRequest('/ai/daily-summary', { method: 'POST', body: { date } }),
};
