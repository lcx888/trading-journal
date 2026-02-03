/**
 * App.jsx - 轻量级入口组件
 * 首页不加载 Ant Design，仅登录后才加载（优化首屏性能）
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/zh-cn';

import { getMe, verifyEmail, confirmEmailChange } from './services/auth';
import { getAuthToken } from './services/api';

// dayjs 配置
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('zh-cn');

// 懒加载：公开页面（不需要 antd）
const Home = lazy(() => import('./pages/Home'));
const Docs = lazy(() => import('./pages/Docs'));
const Pricing = lazy(() => import('./pages/Pricing'));

// 懒加载：需要 antd 的组件
const Auth = lazy(() => import('./pages/Auth'));
const AppShell = lazy(() => import('./AppShell'));

// 简单的加载指示器（不依赖 antd）
const SimpleLoading = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#050505',
    color: '#F0B90B',
    fontFamily: 'system-ui, sans-serif'
  }}>
    <img src="/logo.svg" alt="Logo" style={{ width: 120, height: 40, marginBottom: 24, objectFit: 'contain' }} />
    <div style={{
      width: 40,
      height: 40,
      border: '3px solid rgba(240, 185, 11, 0.2)',
      borderTopColor: '#F0B90B',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// 错误提示（不依赖 antd）
const ErrorMessage = ({ message, onRetry }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#050505',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    padding: 20,
    textAlign: 'center'
  }}>
    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
    <h2 style={{ margin: '0 0 12px', color: '#F6465D' }}>出错了</h2>
    <p style={{ color: '#9ca3af', margin: '0 0 20px' }}>{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          padding: '12px 32px',
          background: '#F0B90B',
          color: '#000',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        重试
      </button>
    )}
  </div>
);

export default function App() {
  // 路由状态
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.slice(1) || '/';
    return hash;
  });
  
  // 用户状态
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1) || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      // 处理邮箱验证回调
      const urlParams = new URLSearchParams(window.location.search);
      const verifyToken = urlParams.get('verify');
      const confirmToken = urlParams.get('confirm_email');

      if (verifyToken) {
        try {
          await verifyEmail(verifyToken);
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        } catch (e) {
          console.error('Email verification failed:', e);
        }
      }

      if (confirmToken) {
        try {
          await confirmEmailChange(confirmToken);
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        } catch (e) {
          console.error('Email confirmation failed:', e);
        }
      }

      // 检查 token
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getMe();
        setUser(userData);
      } catch (e) {
        console.error('Auth check failed:', e);
        // Token 无效，清除
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 导航函数
  const navigate = (path) => {
    window.location.hash = path;
  };

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    navigate('/');
  };

  // 登录成功
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    navigate('/app');
  };

  // 加载中
  if (loading) {
    return <SimpleLoading />;
  }

  // 错误状态
  if (error) {
    return <ErrorMessage message={error} onRetry={() => { setError(null); window.location.reload(); }} />;
  }

  // 路由渲染
  const renderRoute = () => {
    // 公开页面（不需要登录，不加载 antd）
    if (route === '/' || route === '') {
      return (
        <Suspense fallback={<SimpleLoading />}>
          <Home 
            onStart={() => navigate(user ? '/app' : '/login')} 
            onDocs={() => navigate('/docs')}
          />
        </Suspense>
      );
    }

    if (route === '/docs') {
      return (
        <Suspense fallback={<SimpleLoading />}>
          <Docs onBack={() => navigate('/')} onStart={() => navigate(user ? '/app' : '/login')} />
        </Suspense>
      );
    }

    if (route === '/pricing') {
      return (
        <Suspense fallback={<SimpleLoading />}>
          <Pricing />
        </Suspense>
      );
    }

    // 登录/注册页面
    if (route === '/login' || route === '/register') {
      if (user) {
        navigate('/app');
        return <SimpleLoading />;
      }
      return (
        <Suspense fallback={<SimpleLoading />}>
          <Auth onSuccess={handleLoginSuccess} onBack={() => navigate('/')} />
        </Suspense>
      );
    }

    // 需要登录的页面
    if (route.startsWith('/app')) {
      if (!user) {
        navigate('/login');
        return <SimpleLoading />;
      }
      return (
        <Suspense fallback={<SimpleLoading />}>
          <AppShell user={user} onLogout={handleLogout} />
        </Suspense>
      );
    }

    // 未知路由，跳转首页
    navigate('/');
    return <SimpleLoading />;
  };

  return renderRoute();
}
