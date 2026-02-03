/**
 * MobileLogin.jsx - 极简登录页
 * 对齐 Web 端视觉风格
 */
import { useState } from 'react';
import { login, register } from '../services/auth';

export default function MobileLogin({ onSuccess }) {
  const [mode, setMode] = useState('login');
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
      
      if (result.token) localStorage.setItem('auth_token', result.token);
      onSuccess(result.user || result);
    } catch (err) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="m-login-container">
      <div className="m-login-hero">
        <img src="/logo.svg" alt="TradeWhy" style={{height: 32, marginBottom: 16}} />
        <div className="text-sec" style={{fontSize: 13, marginBottom: 48}}>
          像顶级对冲基金一样复盘
        </div>

        <form onSubmit={handleSubmit} style={{width: '100%', maxWidth: 320}}>
          {error && (
            <div style={{
              background: 'var(--m-loss-dim)', 
              color: 'var(--m-loss)', 
              padding: 12, 
              borderRadius: 8, 
              fontSize: 13,
              marginBottom: 16,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <input
            type="email"
            className="m-input-field"
            placeholder="邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          
          <input
            type="password"
            className="m-input-field"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          <button type="submit" className="m-btn-primary" disabled={loading}>
            {loading ? '处理中...' : (mode === 'login' ? '登 录' : '注 册')}
          </button>

          <button 
            type="button" 
            className="m-btn-text"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? '没有账号？立即注册' : '已有账号？立即登录'}
          </button>
        </form>
      </div>

      <div style={{textAlign: 'center', marginTop: 'auto'}}>
        <button 
          className="text-ter" 
          style={{background: 'none', border: 'none', fontSize: 12, padding: 12}}
          onClick={() => {
            localStorage.setItem('force_full_version', 'true');
            window.location.reload();
          }}
        >
          切换至完整版 Web
        </button>
      </div>
    </div>
  );
}
