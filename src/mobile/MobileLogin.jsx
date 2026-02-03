/**
 * MobileLogin.jsx - 轻量级移动端登录页
 * 不依赖 Ant Design
 */
import { useState } from 'react';
import { login, register } from '../services/auth';

export default function MobileLogin({ onSuccess }) {
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('请填写完整信息');
      return;
    }

    setLoading(true);
    try {
      const result = mode === 'login' 
        ? await login(email, password)
        : await register(email, password);
      
      if (result.token) {
        localStorage.setItem('auth_token', result.token);
      }
      
      onSuccess(result.user || result);
    } catch (err) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const goToFullWeb = () => {
    localStorage.setItem('force_full_version', 'true');
    window.location.reload();
  };

  return (
    <div className="m-login-page">
      <div className="m-login-header">
        <img src="/logo.svg" alt="TradeWhy" className="m-login-logo" />
        <p className="m-login-subtitle">交易复盘 · AI 教练</p>
      </div>

      <form className="m-login-form" onSubmit={handleSubmit}>
        <div className="m-tabs">
          <button 
            type="button"
            className={`m-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button 
            type="button"
            className={`m-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        {error && (
          <div className="m-error">{error}</div>
        )}

        <div className="m-input-group">
          <label className="m-label">邮箱</label>
          <input
            type="email"
            className="m-input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="m-input-group">
          <label className="m-label">密码</label>
          <input
            type="password"
            className="m-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        <button 
          type="submit" 
          className="m-submit-btn"
          disabled={loading}
        >
          {loading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
        </button>
      </form>

      <div className="m-login-footer">
        <button className="m-link-btn" onClick={goToFullWeb}>
          🖥️ 使用完整版 Web
        </button>
      </div>

      <div className="m-login-tip">
        💡 移动版仅提供数据查看功能<br/>
        完整功能请使用电脑访问
      </div>
    </div>
  );
}
