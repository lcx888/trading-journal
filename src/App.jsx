import { useState, useEffect, useMemo } from 'react';
import { ConfigProvider, Layout, Menu, Select, Tag, Spin, Button, Dropdown, Card } from 'antd';
import {
  DashboardOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  LineChartOutlined,
  RobotOutlined,
  CalendarOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  AppstoreOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
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
import StorageService from './services/storage';
import { getMe, logout, verifyEmail, confirmEmailChange } from './services/auth';
import { getAuthToken } from './services/api';

dayjs.locale('zh-cn');

const { Header, Sider, Content } = Layout;

const buildMenuItems = (user) => {
  const items = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: 'records', icon: <FolderOutlined />, label: '交易记录' },
    { key: 'trades', icon: <UnorderedListOutlined />, label: '交易明细' },
    { key: 'strategies', icon: <BulbOutlined />, label: '交易策略' },
    { key: 'ai-analysis', icon: <RobotOutlined />, label: 'AI 复盘' },
    { key: 'calendar', icon: <CalendarOutlined />, label: '交易日历' },
    { key: 'import', icon: <FileAddOutlined />, label: '导入数据' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置' },
  ];
  if (user?.role === 'admin' || user?.role === 'superadmin') {
    items.push({ key: 'admin', icon: <SafetyCertificateOutlined />, label: '管理员后台' });
  }
  return items;
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

  // 处理 URL 参数（邮箱验证、密码重置等）
  useEffect(() => {
    const handleUrlParams = async () => {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname;
      
      // 验证邮箱
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
      
      // 确认更改邮箱
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
      
      // 重置密码
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
    loadRecords();
  }, [refreshKey]);

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const allRecords = await StorageService.getAllRecords();
      setRecords(allRecords);
    } catch (e) { console.error(e); }
    finally { setLoadingRecords(false); }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} />;
      case 'records': return <TradingRecords key={refreshKey} onNavigateToImport={(id) => { setSelectedRecordId(id); setCurrentPage('import'); }} />;
      case 'trades': return <TradeList key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} />;
      case 'strategies': return <TradingStrategies key={refreshKey} />;
      case 'ai-analysis': return <AIAnalysis key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} />;
      case 'calendar': return <TradeCalendar key={`${refreshKey}-${activeRecordId}`} activeRecordId={activeRecordId} />;
      case 'import': return <ImportData onImportSuccess={() => setRefreshKey(k => k + 1)} selectedRecordId={selectedRecordId} onNavigateToRecords={() => setCurrentPage('records')} />;
      case 'settings': return <Settings onLogout={handleLogout} />;
      case 'admin':
        if (authUser?.role === 'admin' || authUser?.role === 'superadmin') {
          return <Admin />;
        }
        return (
          <Card className="modern-card" bordered={false}>
            <div className="text-[#131722] font-bold mb-2">无权限访问</div>
            <div className="text-slate-500 text-sm">仅管理员可访问此页面。</div>
          </Card>
        );
      default: return <Dashboard />;
    }
  };

  const menuItems = useMemo(() => buildMenuItems(authUser), [authUser]);
  const showRecordSelector = ['dashboard', 'trades', 'ai-analysis', 'calendar'].includes(currentPage);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f3fa]">
        <Spin size="large" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    setAuthUser(null);
    setShowAuth(false);
  };

  if (!authUser) {
    if (showAuth) {
      return <Auth 
        onAuth={(user) => { setAuthUser(user); setResetToken(null); }} 
        onBack={() => { setShowAuth(false); setResetToken(null); }}
        initialMode={authMode}
        resetToken={resetToken}
      />;
    }
    return <Home onStart={() => setShowAuth(true)} />;
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2962ff',
          colorSuccess: '#26a69a',
          colorError: '#ef5350',
          borderRadius: 8,
          fontFamily: "'Inter', sans-serif",
          colorBgLayout: '#f0f3fa',
        },
        components: {
          Layout: { headerBg: '#ffffff', siderBg: '#ffffff' },
          Menu: { itemSelectedBg: '#f0f3fa', itemSelectedColor: '#2962ff' },
          Card: { borderRadiusLG: 12 },
        }
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={240}
          theme="light"
          className="border-r border-[#e0e3eb]"
          style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100 }}
        >
          <div className="flex items-center px-6 h-16 border-b border-[#f0f3fa]">
            <div className="w-8 h-8 bg-[#2962ff] rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
              <LineChartOutlined className="text-white text-lg" />
            </div>
            {!collapsed && (
              <div className="ml-3 overflow-hidden">
                <div className="text-[#131722] font-bold text-sm truncate">Metworth AI</div>
                <div className="text-[#787b86] text-[10px] font-medium tracking-tighter">TRADING JOURNAL</div>
              </div>
            )}
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key)}
            className="border-none px-2 mt-4"
          />
        </Sider>
        
        <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
          <Header className="flex items-center justify-between sticky top-0 z-50 px-8 h-16 bg-white border-b border-[#e0e3eb]">
            <div className="flex items-center gap-6">
              <h1 className="text-lg font-bold text-[#131722] m-0">
                {menuItems.find(item => item.key === currentPage)?.label}
              </h1>
              
              {showRecordSelector && (
                <div className="flex items-center ml-6 h-9 bg-[#f0f3fa] rounded-lg border border-[#e0e3eb] hover:border-blue-300 transition-all group overflow-hidden">
                  <div className="px-3 h-full flex items-center bg-[#e0e3eb] border-r border-[#d1d4dc] group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                    <FolderOutlined className="text-[#787b86] group-hover:text-blue-500 text-xs" />
                    <span className="ml-2 text-[#787b86] text-[10px] font-bold uppercase tracking-tighter group-hover:text-blue-600">账本</span>
                  </div>
                  <Select
                    value={activeRecordId}
                    onChange={setActiveRecordId}
                    variant="borderless"
                    className="min-w-[180px] font-bold text-xs"
                    dropdownStyle={{ borderRadius: '8px', padding: '4px' }}
                    suffixIcon={<FolderOpenOutlined className="text-blue-500 opacity-50 group-hover:opacity-100" />}
                    options={[
                      { 
                        value: 'all', 
                        label: (
                          <div className="flex items-center gap-2">
                            <AppstoreOutlined className="text-[10px]" />
                            <span>全部账本</span>
                          </div>
                        )
                      },
                      ...records.map(r => ({ 
                        value: r.id, 
                        label: (
                          <div className="flex items-center justify-between w-full">
                            <span>{r.name}</span>
                            <span className="text-[9px] px-1.5 rounded-full bg-slate-100 text-slate-400 font-mono italic">#{r.tradeCount || 0}</span>
                          </div>
                        )
                      }))
                    ]}
                  />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#787b86] text-xs font-bold bg-[#f0f3fa] px-4 py-2 rounded-lg">
                <ClockCircleOutlined />
                {dayjs().format('YYYY/MM/DD')}
              </div>
              <Dropdown
                menu={{
                  items: [
                    { key: 'email', label: authUser.email, icon: <UserOutlined /> },
                    { type: 'divider' },
                    {
                      key: 'logout',
                      label: '退出登录',
                      icon: <LogoutOutlined />,
                      onClick: () => {
                        logout();
                        setAuthUser(null);
                      },
                    },
                  ],
                }}
              >
                <Button className="text-xs font-bold" icon={<UserOutlined />}>
                  {authUser.role === 'admin' || authUser.role === 'superadmin' ? '管理员' : '用户'}
                </Button>
              </Dropdown>
            </div>
          </Header>
          
          <Content className="p-8">
            <div className="max-w-[1440px] mx-auto animate-in">
              {renderContent()}
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
