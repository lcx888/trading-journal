import { useState, useEffect, useMemo } from 'react';
import { ConfigProvider, Layout, Menu, Select, Spin, Button, Dropdown, Tooltip } from 'antd';
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
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

import Dashboard from './pages/Dashboard';
import TradeList from './pages/TradeList';
import ImportData from './pages/ImportData';
import Settings from './pages/Settings';
import AIAnalysis from './pages/AIAnalysis';
import TradeCalendar from './pages/TradeCalendar';
import TradingRecords from './pages/TradingRecords';
import TradingStrategies from './pages/TradingStrategies';
import Auth from './pages/Auth';
import Admin from './pages/Admin';
import Home from './pages/Home';
import Docs from './pages/Docs';
import Pricing from './pages/Pricing';
import StorageService from './services/storage';
import { getMe, logout, verifyEmail, confirmEmailChange } from './services/auth';
import { getAuthToken } from './services/api';
import { getSubscriptionStatus, getPlanDisplayInfo, clearSubscriptionCache } from './services/subscription';
import { UpgradeModal, SidebarSubscriptionCard } from './components/UpgradePrompt';

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
  const [loadingRecords, setLoadingRecords] = useState(true);
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
      setLoadingRecords(false);
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
    setCurrentPage('pricing');
  };

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const allRecords = await StorageService.getAllRecords();
      setRecords(allRecords || []);
    } catch (e) { 
      console.error('加载账本失败:', e); 
      setRecords([]);
    }
    finally { setLoadingRecords(false); }
  };

  const handleMenuClick = ({ key }) => {
    setCurrentPage(key);
    setPageKey(k => k + 1);
  };

  const renderContent = () => {
    const pageClass = "page-enter";
    
    switch (currentPage) {
      case 'dashboard': 
        return <div key={pageKey} className={pageClass}><Dashboard key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} onNavigateToImport={() => setCurrentPage('import')} subscription={subscription} onUpgrade={goToPricing} /></div>;
      case 'records': 
        return <div key={pageKey} className={pageClass}><TradingRecords key={refreshKey} onNavigateToImport={(id) => { setSelectedRecordId(id); setCurrentPage('import'); }} /></div>;
      case 'trades': 
        return <div key={pageKey} className={pageClass}><TradeList key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} /></div>;
      case 'strategies': 
        return <div key={pageKey} className={pageClass}><TradingStrategies key={refreshKey} /></div>;
      case 'ai-analysis': 
        return <div key={pageKey} className={pageClass}><AIAnalysis key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} subscription={subscription} onShowUpgrade={goToPricing} /></div>;
      case 'calendar': 
        return <div key={pageKey} className={pageClass}><TradeCalendar key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} /></div>;
      case 'import': 
        return <div key={pageKey} className={pageClass}><ImportData onImportSuccess={() => setRefreshKey(k => k + 1)} selectedRecordId={selectedRecordId} onNavigateToRecords={() => setCurrentPage('records')} /></div>;
      case 'settings': 
        return <div key={pageKey} className={pageClass}><Settings onLogout={handleLogout} subscription={subscription} onUpgrade={goToPricing} /></div>;
      case 'pricing':
        return <div key={pageKey} className={pageClass}><Pricing onNavigate={(page) => setCurrentPage(page)} /></div>;
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
        return <div key={pageKey} className={pageClass}><Dashboard onNavigateToImport={() => setCurrentPage('import')} /></div>;
    }
  };

  const menuItems = useMemo(() => buildMenuItems(authUser), [authUser]);
  const showRecordSelector = ['dashboard', 'trades', 'ai-analysis', 'calendar'].includes(currentPage);

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
        <img src="/logo.png" alt="Logo" className="w-14 h-14 rounded-xl object-cover mb-6" />
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
      return <Docs 
        onBack={() => setShowDocs(false)} 
        onStart={() => { setShowDocs(false); setShowAuth(true); }}
      />;
    }
    if (showAuth) {
      return <Auth 
        onAuth={(user) => { setAuthUser(user); setResetToken(null); }} 
        onBack={() => { setShowAuth(false); setResetToken(null); }}
        initialMode={authMode}
        resetToken={resetToken}
      />;
    }
    return <Home onStart={() => setShowAuth(true)} onDocs={() => setShowDocs(true)} />;
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
        {/* 侧边栏 */}
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={240}
          collapsedWidth={64}
          trigger={null}
          className="layout-sider"
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
          <div className="flex items-center px-4 h-16 border-b border-[var(--border-primary)]">
            <img src="/logo.png" alt="Logo" className="w-9 h-9 rounded-lg object-cover" />
            {!collapsed && (
              <div className="ml-3 overflow-hidden">
                <div className="text-[var(--text-primary)] font-semibold text-sm">Metworth</div>
                <div className="text-[var(--text-tertiary)] text-[10px] font-medium uppercase tracking-wider">Trading Coach</div>
              </div>
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
          
          {/* 底部区域：订阅卡片 + 折叠按钮 */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--border-primary)]">
            {/* 订阅卡片 */}
            {subscription && (
              <div className="pt-3">
                <SidebarSubscriptionCard
                  subscription={subscription}
                  collapsed={collapsed}
                  onUpgrade={goToPricing}
                />
              </div>
            )}
            
            {/* 无订阅时显示简单升级入口 */}
            {!subscription && (
              <div 
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#141418] ${currentPage === 'pricing' ? 'bg-[rgba(234,179,8,0.1)]' : ''}`}
                onClick={() => { setCurrentPage('pricing'); setPageKey(k => k + 1); }}
              >
                <CrownOutlined className={`text-base ${currentPage === 'pricing' ? 'text-[#eab308]' : 'text-[#9ca3af]'}`} />
                {!collapsed && (
                  <span className={`text-sm ${currentPage === 'pricing' ? 'text-[#eab308]' : 'text-[#9ca3af]'}`}>
                    订阅升级
                  </span>
                )}
              </div>
            )}
            
            {/* 折叠按钮 */}
            <div className="p-3 border-t border-[var(--border-primary)]">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                className="w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              />
            </div>
          </div>
        </Sider>
        
        {/* 主内容区 */}
        <Layout style={{ 
          marginLeft: collapsed ? 64 : 240, 
          transition: 'margin 0.2s',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* 顶部导航 - 固定高度 */}
          <Header 
            className="layout-header flex items-center justify-between px-6"
            style={{
              background: '#0d0d10',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              height: 64,
              lineHeight: '64px',
              flexShrink: 0,
              zIndex: 50,
            }}
          >
            <div className="flex items-center gap-4">
              {/* 页面标题 */}
              <h1 className="text-base font-semibold text-[var(--text-primary)] m-0 flex items-center gap-2">
                {getPageTitle(currentPage)}
                {currentPage === 'ai-analysis' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--color-brand-bg)] text-[var(--color-brand)] rounded">
                    AI
                  </span>
                )}
              </h1>
              
              {/* 账本选择器 */}
              {showRecordSelector && (
                <div className="flex items-center ml-4">
                  <Select
                    value={activeRecordId}
                    onChange={setActiveRecordId}
                    className="min-w-[180px]"
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
            <div className="flex items-center gap-1">
              {/* 日期 - 简洁展示 */}
              <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] text-xs px-2 py-1">
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
                    className="w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg"
                  />
                </Tooltip>
                
                {/* 设置快捷入口 */}
                <Tooltip title="设置" placement="bottom">
                  <Button 
                    type="text" 
                    icon={<SettingOutlined style={{ fontSize: 16 }} />} 
                    onClick={() => setCurrentPage('settings')}
                    className="w-9 h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg"
                  />
                </Tooltip>
              </div>
              
              {/* 分隔线 */}
              <div className="h-5 w-px bg-[var(--border-primary)] mx-2"></div>
              
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
                      onClick: () => setCurrentPage('settings'),
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
                <div className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                  <img 
                    src={getAvatarUrl(authUser.email)} 
                    alt="avatar" 
                    className="w-8 h-8 rounded-full ring-2 ring-[var(--border-primary)]" 
                  />
                  <svg className="w-3 h-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </Dropdown>
            </div>
          </Header>
          
          {/* 内容区 - 可滚动 */}
          <Content 
            className="layout-content p-6"
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
