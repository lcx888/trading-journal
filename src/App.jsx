import { useState, useEffect, useMemo, lazy, Suspense, startTransition } from 'react';
import { ConfigProvider, Layout, Menu, Select, Spin, Button, Dropdown, Tooltip, Drawer } from 'antd';
import {
  DashboardOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  RobotOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CrownOutlined,
  AlertOutlined,
  LoadingOutlined,
  MenuOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/zh-cn';

// 加载 dayjs 插件，确保正确处理时区
dayjs.extend(utc);
dayjs.extend(timezone);

// 懒加载页面组件 - 优化首屏加载速度
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TradeList = lazy(() => import('./pages/TradeList'));
const ImportData = lazy(() => import('./pages/ImportData'));
const Settings = lazy(() => import('./pages/Settings'));
const AIAnalysis = lazy(() => import('./pages/AIAnalysis'));
const TradeCalendar = lazy(() => import('./pages/TradeCalendar'));
const TradingRecords = lazy(() => import('./pages/TradingRecords'));
const TradingStrategies = lazy(() => import('./pages/TradingStrategies'));
const RiskControl = lazy(() => import('./pages/RiskControl'));
const Auth = lazy(() => import('./pages/Auth'));
const Admin = lazy(() => import('./pages/Admin'));
const Home = lazy(() => import('./pages/Home'));
const Docs = lazy(() => import('./pages/Docs'));
const Pricing = lazy(() => import('./pages/Pricing'));

import StorageService from './services/storage';
import { getMe, logout, verifyEmail, confirmEmailChange } from './services/auth';
import { getAuthToken } from './services/api';
import { getSubscriptionStatus, clearSubscriptionCache } from './services/subscription';
import { UpgradeModal, SidebarFooter } from './components/UpgradePrompt';

dayjs.locale('zh-cn');

const { Header, Sider, Content } = Layout;

// 生成用户头像 URL
const getAvatarUrl = (email) => {
  const seed = email || 'user';
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0d0d10`;
};

// 币安风格菜单
const buildMenuItems = (user) => {
  const items = [
    { 
      key: 'dashboard', 
      icon: <DashboardOutlined />, 
      label: '总览',
    },
    { 
      key: 'trades', 
      icon: <UnorderedListOutlined />, 
      label: '交易',
    },
    { 
      key: 'ai-analysis', 
      icon: <RobotOutlined />, 
      label: (
        <span className="flex items-center gap-2">
          AI 教练
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[var(--color-brand-bg)] text-[var(--color-brand)] rounded">PRO</span>
        </span>
      ),
    },
    { 
      key: 'risk-control', 
      icon: <AlertOutlined />, 
      label: '风控测试',
    },
    { 
      key: 'data', 
      icon: <DatabaseOutlined />, 
      label: '数据',
      children: [
        { key: 'records', icon: <FolderOutlined />, label: '账本管理' },
        { key: 'import', icon: <FileAddOutlined />, label: '导入数据' },
        { key: 'strategies', icon: <ThunderboltOutlined />, label: '策略库' },
        { key: 'calendar', icon: <ClockCircleOutlined />, label: '交易日历' },
      ]
    },
    { 
      key: 'settings', 
      icon: <SettingOutlined />, 
      label: '设置',
    },
  ];
  
  if (user?.role === 'admin' || user?.role === 'superadmin') {
    items.push({ 
      key: 'admin', 
      icon: <SafetyCertificateOutlined />, 
      label: '管理后台',
    });
  }
  return items;
};

// 获取页面标题
const getPageTitle = (key) => {
  const titles = {
    'dashboard': '总览',
    'trades': '交易明细',
    'ai-analysis': 'AI 交易教练',
    'risk-control': '风控测试',
    'records': '账本管理',
    'import': '导入数据',
    'strategies': '策略库',
    'calendar': '交易日历',
    'pricing': '订阅升级',
    'settings': '设置',
    'admin': '管理后台',
  };
  return titles[key] || '总览';
};

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [activeRecordId, setActiveRecordId] = useState('all');
  const [records, setRecords] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [resetToken, setResetToken] = useState(null);
  const [pageKey, setPageKey] = useState(0);
  const [showDocs, setShowDocs] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeatureKey, setUpgradeFeatureKey] = useState('smartDiagnosis');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 处理 URL 参数
  useEffect(() => {
    const handleUrlParams = async () => {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname;
      
      if (path === '/verify-email' || params.get('token') && path.includes('verify')) {
        const token = params.get('token');
        if (token) {
          try {
            await verifyEmail(token);
            alert('邮箱验证成功！');
          } catch (e) {
            alert('验证失败：' + (e.message || '链接无效或已过期'));
          }
          window.history.replaceState({}, '', '/');
        }
      }
      
      if (path === '/verify-email-change') {
        const token = params.get('token');
        if (token) {
          try {
            await confirmEmailChange(token);
            alert('邮箱更改成功！');
          } catch (e) {
            alert('更改失败：' + (e.message || '链接无效或已过期'));
          }
          window.history.replaceState({}, '', '/');
        }
      }
      
      if (path === '/reset-password') {
        const token = params.get('token');
        if (token) {
          setResetToken(token);
          setAuthMode('reset');
          setShowAuth(true);
          window.history.replaceState({}, '', '/');
        }
      }
    };
    handleUrlParams();
  }, []);

  useEffect(() => {
    const runMigrations = async () => {
      const migrationKey = 'marketSession_migration_v2';
      if (!localStorage.getItem(migrationKey)) {
        try {
          await StorageService.migrateMarketSessions();
          localStorage.setItem(migrationKey, 'done');
        } catch (error) {
          console.error('Migration failed:', error);
        }
      }
    };
    runMigrations();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);
      const token = getAuthToken();
      if (!token) {
        setAuthUser(null);
        setAuthLoading(false);
        return;
      }
      try {
        const user = await getMe();
        setAuthUser(user);
      } catch (e) {
        setAuthUser(null);
        logout();
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (authUser) {
      loadRecords();
      loadSubscription();
    } else {
      setRecords([]);
      setSubscription(null);
      clearSubscriptionCache();
    }
  }, [refreshKey, authUser]);

  // 加载订阅状态
  const loadSubscription = async () => {
    try {
      const status = await getSubscriptionStatus(true);
      setSubscription(status);
    } catch (e) {
      console.error('加载订阅状态失败:', e);
    }
  };

  // 显示升级弹窗
  const showUpgrade = (featureKey = 'smartDiagnosis') => {
    setUpgradeFeatureKey(featureKey);
    setShowUpgradeModal(true);
  };

  // 跳转到订阅页面
  const goToPricing = () => {
    setShowUpgradeModal(false);
    startTransition(() => {
    setCurrentPage('pricing');
    });
  };

  const loadRecords = async () => {
    try {
      const allRecords = await StorageService.getAllRecords();
      setRecords(allRecords || []);
    } catch (e) { 
      console.error('加载账本失败:', e); 
      setRecords([]);
    }
  };

  const handleMenuClick = ({ key }) => {
    startTransition(() => {
    setCurrentPage(key);
    setPageKey(k => k + 1);
    });
    // 移动端点击菜单后关闭抽屉
    if (isMobile) setMobileMenuOpen(false);
  };

  // 页面加载占位符
  const PageLoading = () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: 'var(--color-brand)' }} spin />} />
    </div>
  );

  const renderContent = () => {
    const pageClass = "page-enter";
    
    const content = (() => {
      switch (currentPage) {
        case 'dashboard': 
          return <div key={pageKey} className={pageClass}><Dashboard key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} onNavigateToImport={() => startTransition(() => setCurrentPage('import'))} subscription={subscription} onUpgrade={goToPricing} onNavigate={(page) => startTransition(() => setCurrentPage(page))} /></div>;
        case 'records': 
          return <div key={pageKey} className={pageClass}><TradingRecords key={refreshKey} onNavigateToImport={(id) => { setSelectedRecordId(id); startTransition(() => setCurrentPage('import')); }} subscription={subscription} onShowUpgrade={showUpgrade} /></div>;
        case 'trades': 
          return <div key={pageKey} className={pageClass}><TradeList key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} /></div>;
        case 'strategies': 
          return <div key={pageKey} className={pageClass}><TradingStrategies key={refreshKey} /></div>;
        case 'ai-analysis': 
          return <div key={pageKey} className={pageClass}><AIAnalysis key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} subscription={subscription} onShowUpgrade={goToPricing} /></div>;
        case 'risk-control':
          return <div key={pageKey} className={pageClass}><RiskControl key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} /></div>;
        case 'calendar': 
          return <div key={pageKey} className={pageClass}><TradeCalendar key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} /></div>;
        case 'import': 
          return <div key={pageKey} className={pageClass}><ImportData onImportSuccess={() => setRefreshKey(k => k + 1)} selectedRecordId={selectedRecordId} onNavigateToRecords={() => startTransition(() => setCurrentPage('records'))} subscription={subscription} onShowUpgrade={showUpgrade} /></div>;
        case 'settings': 
          return <div key={pageKey} className={pageClass}><Settings onLogout={handleLogout} subscription={subscription} onUpgrade={goToPricing} /></div>;
        case 'pricing':
          return <div key={pageKey} className={pageClass}><Pricing onNavigate={(page) => startTransition(() => setCurrentPage(page))} /></div>;
        case 'admin':
          if (authUser?.role === 'admin' || authUser?.role === 'superadmin') {
            return <div key={pageKey} className={pageClass}><Admin /></div>;
          }
          return (
            <div key={pageKey} className={`${pageClass} card p-8`}>
              <div className="text-[var(--text-primary)] font-bold mb-2">无权限访问</div>
              <div className="text-[var(--text-secondary)] text-sm">仅管理员可访问此页面。</div>
            </div>
          );
        default: 
          return <div key={pageKey} className={pageClass}><Dashboard onNavigateToImport={() => startTransition(() => setCurrentPage('import'))} /></div>;
      }
    })();

    return <Suspense fallback={<PageLoading />}>{content}</Suspense>;
  };

  const menuItems = useMemo(() => buildMenuItems(authUser), [authUser]);
  const showRecordSelector = ['dashboard', 'trades', 'ai-analysis', 'calendar', 'risk-control'].includes(currentPage);

  const selectedKeys = useMemo(() => {
    if (['records', 'import', 'strategies', 'calendar'].includes(currentPage)) {
      return [currentPage];
    }
    return [currentPage];
  }, [currentPage]);

  const openKeys = useMemo(() => {
    if (['records', 'import', 'strategies', 'calendar'].includes(currentPage)) {
      return ['data'];
    }
    return [];
  }, [currentPage]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)]">
        <img src="/logo.svg" alt="Logo" className="w-28 h-8 sm:w-32 sm:h-10 md:w-48 md:h-14 object-contain mb-6" />
        <Spin size="large" />
        <div className="mt-4 text-[var(--text-secondary)] text-sm">正在加载...</div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    setAuthUser(null);
    setShowAuth(false);
  };

  if (!authUser) {
    if (showDocs) {
      return (
        <Suspense fallback={<PageLoading />}>
          <Docs 
            onBack={() => startTransition(() => setShowDocs(false))} 
            onStart={() => startTransition(() => { setShowDocs(false); setShowAuth(true); })}
          />
        </Suspense>
      );
    }
    if (showAuth) {
      return (
        <Suspense fallback={<PageLoading />}>
          <Auth 
        onAuth={(user) => { setAuthUser(user); setResetToken(null); }} 
            onBack={() => startTransition(() => { setShowAuth(false); setResetToken(null); })}
        initialMode={authMode}
        resetToken={resetToken}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<PageLoading />}>
        <Home 
          onStart={() => startTransition(() => setShowAuth(true))} 
          onDocs={() => startTransition(() => setShowDocs(true))} 
        />
      </Suspense>
    );
  }

  const totalTrades = records.reduce((sum, r) => sum + (r.tradeCount || 0), 0);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#eab308',
          colorSuccess: '#10b981',
          colorError: '#f43f5e',
          colorWarning: '#eab308',
          colorInfo: '#3b82f6',
          borderRadius: 4,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
          colorBgLayout: '#0a0a0c',
          colorBgContainer: '#0d0d10',
          colorBgElevated: '#0f0f12',
          colorBorder: 'rgba(255, 255, 255, 0.05)',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
          colorText: '#ffffff',
          colorTextSecondary: '#9ca3af',
          colorTextTertiary: '#6b7280',
          colorTextQuaternary: '#4b5563',
        },
        components: {
          Layout: { 
            headerBg: '#0d0d10', 
            siderBg: '#0d0d10',
            bodyBg: '#0a0a0c',
          },
          Menu: { 
            itemSelectedBg: 'rgba(234, 179, 8, 0.1)', 
            itemSelectedColor: '#eab308',
            itemHoverBg: '#141418',
            itemColor: '#9ca3af',
            subMenuItemBg: '#0d0d10',
            darkItemBg: '#0d0d10',
            darkItemSelectedBg: 'rgba(234, 179, 8, 0.1)',
            darkItemSelectedColor: '#eab308',
            darkItemHoverBg: '#141418',
          },
          Card: { 
            colorBgContainer: '#0d0d10',
            borderRadiusLG: 6,
          },
          Button: { 
            borderRadius: 4,
            primaryColor: '#0a0a0c',
          },
          Input: { 
            borderRadius: 4,
            colorBgContainer: '#0f0f12',
          },
          Select: { 
            borderRadius: 4,
            colorBgContainer: '#0f0f12',
          },
          Table: {
            headerBg: '#0f0f12',
            rowHoverBg: '#141418',
            colorBgContainer: '#0d0d10',
          },
        }
      }}
    >
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        {/* 移动端抽屉菜单 */}
        <Drawer
          placement="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          width={280}
          className="mobile-menu-drawer"
          styles={{
            header: { display: 'none' },
            body: { padding: 0, background: '#0d0d10' },
          }}
        >
          {/* Logo */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border-primary)]">
            <img src="/logo.svg" alt="TradeWhy.AI" className="h-7 object-contain" />
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <CloseOutlined />
            </button>
          </div>
          
          {/* 菜单 */}
          <div className="py-2">
            <Menu
              mode="inline"
              selectedKeys={selectedKeys}
              defaultOpenKeys={openKeys}
              items={menuItems}
              onClick={handleMenuClick}
              style={{ 
                background: 'transparent',
                border: 'none',
              }}
            />
          </div>
          
          {/* 底部区域 */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]">
            <SidebarFooter
              subscription={subscription}
              collapsed={false}
              onUpgrade={() => { setMobileMenuOpen(false); goToPricing(); }}
              onToggleCollapse={() => setMobileMenuOpen(false)}
            />
          </div>
        </Drawer>

        {/* PC 端侧边栏 */}
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={240}
          collapsedWidth={64}
          trigger={null}
          className="layout-sider hidden md:block"
          style={{ 
            position: 'fixed', 
            left: 0, 
            top: 0, 
            bottom: 0, 
            zIndex: 100,
            background: '#0d0d10',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            overflow: 'hidden',
          }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center px-3 h-16 border-b border-[var(--border-primary)]">
            {collapsed ? (
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center font-bold text-[var(--color-brand)] text-lg">T</div>
            ) : (
              <img src="/logo.svg" alt="TradeWhy.AI" className="h-7 object-contain" />
            )}
          </div>
          
          {/* 菜单 */}
          <div className="py-2">
            <Menu
              mode="inline"
              selectedKeys={selectedKeys}
              defaultOpenKeys={openKeys}
              items={menuItems}
              onClick={handleMenuClick}
              style={{ 
                background: 'transparent',
                border: 'none',
              }}
            />
          </div>
          
          {/* 底部区域：订阅状态 + 折叠按钮一体化 */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]">
            <SidebarFooter
              subscription={subscription}
              collapsed={collapsed}
              onUpgrade={goToPricing}
              onToggleCollapse={() => setCollapsed(!collapsed)}
            />
          </div>
        </Sider>
        
        {/* 主内容区 */}
        <Layout style={{ 
          marginLeft: isMobile ? 0 : (collapsed ? 64 : 240), 
          transition: 'margin 0.2s',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* 顶部导航 - 固定高度 */}
          <Header 
            className="layout-header flex items-center justify-between px-3 md:px-6"
            style={{
              background: '#0d0d10',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              height: 56,
              lineHeight: '56px',
              flexShrink: 0,
              zIndex: 50,
            }}
          >
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              >
                <MenuOutlined style={{ fontSize: 18 }} />
              </button>
              
              {/* 页面标题 */}
              <h1 className="text-sm md:text-base font-semibold text-[var(--text-primary)] m-0 flex items-center gap-2 truncate">
                {getPageTitle(currentPage)}
                {currentPage === 'ai-analysis' && (
                  <span className="px-1.5 md:px-2 py-0.5 text-[9px] md:text-[10px] font-bold bg-[var(--color-brand-bg)] text-[var(--color-brand)] rounded flex-shrink-0">
                    AI
                  </span>
                )}
              </h1>
              
              {/* 账本选择器 - 移动端简化 */}
              {showRecordSelector && (
                <div className="hidden sm:flex items-center ml-2 md:ml-4">
                  <Select
                    value={activeRecordId}
                    onChange={setActiveRecordId}
                    className="min-w-[120px] md:min-w-[180px]"
                    popupClassName="binance-dropdown"
                    suffixIcon={<FolderOpenOutlined className="text-[var(--text-tertiary)]" />}
                    options={[
                      { 
                        value: 'all', 
                        label: (
                          <div className="flex items-center gap-2">
                            <AppstoreOutlined className="text-[var(--color-brand)]" />
                            <span>全部账本</span>
                            <span className="ml-auto text-[var(--text-tertiary)] text-xs font-mono">{totalTrades}</span>
                          </div>
                        )
                      },
                      ...records.map(r => ({ 
                        value: r.id, 
                        label: (
                          <div className="flex items-center justify-between w-full">
                            <span>{r.name}</span>
                            <span className="text-xs text-[var(--text-tertiary)] font-mono">{r.tradeCount || 0}</span>
                          </div>
                        )
                      }))
                    ]}
                  />
                </div>
              )}
            </div>
            
            {/* 右侧操作区 - 优化布局 */}
            <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
              {/* 日期 - 简洁展示，移动端隐藏 */}
              <div className="hidden md:flex items-center gap-1.5 text-[var(--text-tertiary)] text-xs px-2 py-1">
                <span className="font-mono">{dayjs().format('MM/DD')}</span>
                <span className="text-[var(--text-disabled)]">·</span>
                <span className="font-mono">{dayjs().format('ddd')}</span>
              </div>
              
              {/* 功能按钮组 */}
              <div className="flex items-center">
                {/* 通知 */}
                <Tooltip title="通知" placement="bottom">
                  <Button 
                    type="text" 
                    icon={<BellOutlined style={{ fontSize: 16 }} />} 
                    className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg"
                  />
                </Tooltip>
                
                {/* 设置快捷入口 - 移动端隐藏 */}
                <Tooltip title="设置" placement="bottom">
                  <Button 
                    type="text" 
                    icon={<SettingOutlined style={{ fontSize: 16 }} />} 
                    onClick={() => startTransition(() => setCurrentPage('settings'))}
                    className="hidden md:flex w-9 h-9 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg"
                  />
                </Tooltip>
              </div>
              
              {/* 分隔线 */}
              <div className="h-5 w-px bg-[var(--border-primary)] mx-1 md:mx-2"></div>
              
              {/* 用户头像 - 下拉菜单 */}
              <Dropdown
                menu={{
                  items: [
                    { 
                      key: 'profile', 
                      label: (
                        <div className="py-2 px-1">
                          <div className="font-semibold text-[var(--text-primary)] text-sm">{authUser.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              authUser.role === 'admin' || authUser.role === 'superadmin' 
                                ? 'bg-purple-500/20 text-purple-400' 
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                            }`}>
                              {authUser.role === 'admin' || authUser.role === 'superadmin' ? '管理员' : '用户'}
                            </span>
                            {subscription?.plan?.name === 'pro' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand-bg)] text-[var(--color-brand)]">
                                PRO
                              </span>
                            )}
                            {subscription?.plan?.name === 'elite' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                ELITE
                              </span>
                            )}
                          </div>
                        </div>
                      ), 
                      disabled: true,
                    },
                    { type: 'divider' },
                    { 
                      key: 'settings', 
                      label: '账户设置', 
                      icon: <SettingOutlined />,
                      onClick: () => startTransition(() => setCurrentPage('settings')),
                    },
                    { 
                      key: 'pricing', 
                      label: '订阅管理', 
                      icon: <CrownOutlined />,
                      onClick: goToPricing,
                    },
                    { type: 'divider' },
                    {
                      key: 'logout',
                      label: '退出登录',
                      icon: <LogoutOutlined />,
                      danger: true,
                      onClick: handleLogout,
                    },
                  ],
                }}
                placement="bottomRight"
                trigger={['click']}
              >
                <div className="flex items-center gap-1 md:gap-2 cursor-pointer px-1 md:px-2 py-1 md:py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                  <img 
                    src={getAvatarUrl(authUser.email)} 
                    alt="avatar" 
                    className="w-7 h-7 md:w-8 md:h-8 rounded-full ring-2 ring-[var(--border-primary)]" 
                  />
                  <svg className="w-3 h-3 text-[var(--text-tertiary)] hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </Dropdown>
            </div>
          </Header>
          
          {/* 移动端账本选择器 */}
          {showRecordSelector && isMobile && (
            <div className="sm:hidden px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <Select
                value={activeRecordId}
                onChange={setActiveRecordId}
                className="w-full"
                popupClassName="binance-dropdown"
                suffixIcon={<FolderOpenOutlined className="text-[var(--text-tertiary)]" />}
                options={[
                  { 
                    value: 'all', 
                    label: (
                      <div className="flex items-center gap-2">
                        <AppstoreOutlined className="text-[var(--color-brand)]" />
                        <span>全部账本</span>
                        <span className="ml-auto text-[var(--text-tertiary)] text-xs font-mono">{totalTrades}</span>
                      </div>
                    )
                  },
                  ...records.map(r => ({ 
                    value: r.id, 
                    label: (
                      <div className="flex items-center justify-between w-full">
                        <span>{r.name}</span>
                        <span className="text-xs text-[var(--text-tertiary)] font-mono">{r.tradeCount || 0}</span>
                      </div>
                    )
                  }))
                ]}
              />
            </div>
          )}
          
          {/* 内容区 - 可滚动 */}
          <Content 
            className="layout-content p-3 md:p-6"
            style={{ 
              background: '#0a0a0c', 
              flex: 1,
              overflow: 'auto',
              minHeight: 0,
            }}
          >
            <div className="max-w-[1400px] mx-auto">
              {renderContent()}
            </div>
          </Content>
        </Layout>
      </Layout>
      
      {/* 升级提示弹窗 */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureKey={upgradeFeatureKey}
        usage={subscription?.usage ? {
          used: upgradeFeatureKey === 'aiAnalysis' 
            ? subscription.usage.aiAnalysisUsedThisMonth 
            : subscription.usage.tradesUsedThisMonth,
          limit: upgradeFeatureKey === 'aiAnalysis'
            ? subscription.plan?.maxAiAnalysisPerMonth
            : subscription.plan?.maxTradesPerMonth,
        } : null}
        onUpgrade={goToPricing}
      />
    </ConfigProvider>
  );
}

export default App;
