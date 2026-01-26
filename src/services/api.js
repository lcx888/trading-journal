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
  
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!res.ok) {
    let message = '请求失败';
    try {
      const text = await res.text();
      // 检测是否返回了 HTML 而不是 JSON（常见的部署配置错误）
      if (text.startsWith('<!') || text.startsWith('<html')) {
        console.error(`API 配置错误: ${url} 返回了 HTML 而不是 JSON。请检查服务器配置。`);
        message = '服务器配置错误：API 返回了 HTML 页面。请检查后端服务是否正常运行，以及 Nginx/代理配置是否正确。';
      } else {
        try {
          const err = JSON.parse(text);
          if (err?.message) message = err.message;
        } catch (e) {
          message = text || '请求失败';
        }
      }
    } catch (e) {
      // ignore parse error
    }
    throw new Error(message);
  }
  
  if (res.status === 204) return null;
  
  // 同样检查成功响应是否返回了 HTML
  const contentType = res.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    const text = await res.text();
    if (text.startsWith('<!') || text.startsWith('<html')) {
      console.error(`API 配置错误: ${url} 返回了 HTML 而不是 JSON`);
      throw new Error('服务器配置错误：API 返回了 HTML 页面，请检查部署配置');
    }
    // 尝试解析为 JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('服务器返回了非 JSON 格式的响应');
    }
  }
  
  return res.json();
};

// 认证 API 包装器（类 axios 风格）
export const authApi = {
  get: async (path) => {
    const data = await apiRequest(path);
    return { data };
  },
  post: async (path, body) => {
    const data = await apiRequest(path, { method: 'POST', body });
    return { data };
  },
  patch: async (path, body) => {
    const data = await apiRequest(path, { method: 'PATCH', body });
    return { data };
  },
  delete: async (path) => {
    const data = await apiRequest(path, { method: 'DELETE' });
    return { data };
  },
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
  
  // 获取分析历史列表
  getHistory: () => 
    apiRequest('/ai/history'),
  
  // 获取单个分析详情
  getAnalysis: (id) => 
    apiRequest(`/ai/history/${id}`),
  
  // 删除分析记录
  deleteAnalysis: (id) => 
    apiRequest(`/ai/history/${id}`, { method: 'DELETE' }),
};
