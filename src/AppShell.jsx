/**
 * AppShell - 登录后的主应用外壳
 * 包含 Ant Design 依赖，懒加载以优化首屏性能
 */
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

import StorageService from './services/storage';
import { logout } from './services/auth';
import { getSubscriptionStatus, clearSubscriptionCache } from './services/subscription';
import { UpgradeModal, SidebarFooter } from './components/UpgradePrompt';

// 懒加载页面组件
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TradeList = lazy(() => import('./pages/TradeList'));
const ImportData = lazy(() => import('./pages/ImportData'));
const Settings = lazy(() => import('./pages/Settings'));
const AIAnalysis = lazy(() => import('./pages/AIAnalysis'));
const TradeCalendar = lazy(() => import('./pages/TradeCalendar'));
const TradingRecords = lazy(() => import('./pages/TradingRecords'));
const TradingStrategies = lazy(() => import('./pages/TradingStrategies'));
const RiskControl = lazy(() => import('./pages/RiskControl'));
const Admin = lazy(() => import('./pages/Admin'));

const { Header, Sider, Content } = Layout;

// Ant Design 深色主题配置
const darkTheme = {
  token: {
    colorPrimary: '#F0B90B',
    colorBgContainer: '#0a0a0c',
    colorBgElevated: '#0d0d10',
    colorBgLayout: '#050505',
    colorBgSpotlight: '#16161a',
    colorBorder: 'rgba(255, 255, 255, 0.05)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
    colorText: '#ffffff',
    colorTextSecondary: '#9ca3af',
    colorTextTertiary: '#6b7280',
    colorTextQuaternary: '#4b5563',
    borderRadius: 8,
    colorSuccess: '#0ECB81',
    colorError: '#F6465D',
    colorWarning: '#eab308',
    colorInfo: '#1E9EF5',
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: { bodyBg: '#050505', headerBg: '#0a0a0c', siderBg: '#0a0a0c' },
    Menu: { darkItemBg: '#0a0a0c', darkSubMenuItemBg: '#050505', darkItemSelectedBg: 'rgba(240, 185, 11, 0.1)', darkItemHoverBg: 'rgba(255, 255, 255, 0.04)' },
    Table: { headerBg: '#0d0d10', rowHoverBg: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(255, 255, 255, 0.05)' },
    Card: { colorBgContainer: '#0a0a0c', colorBorderSecondary: 'rgba(255, 255, 255, 0.05)' },
    Input: { colorBgContainer: '#0d0d10', colorBorder: 'rgba(255, 255, 255, 0.08)', activeBorderColor: '#F0B90B', hoverBorderColor: 'rgba(240, 185, 11, 0.5)' },
    Select: { colorBgContainer: '#0d0d10', colorBgElevated: '#16161a', colorBorder: 'rgba(255, 255, 255, 0.08)', optionSelectedBg: 'rgba(240, 185, 11, 0.1)' },
    Modal: { contentBg: '#0a0a0c', headerBg: '#0a0a0c', titleColor: '#ffffff' },
    Button: { defaultBg: '#0d0d10', defaultBorderColor: 'rgba(255, 255, 255, 0.08)', defaultColor: '#ffffff' },
    DatePicker: { colorBgContainer: '#0d0d10', colorBgElevated: '#16161a' },
    Tooltip: { colorBgSpotlight: '#16161a', colorTextLightSolid: '#ffffff' },
    Dropdown: { colorBgElevated: '#16161a', controlItemBgHover: 'rgba(255, 255, 255, 0.04)' },
    Spin: { colorPrimary: '#F0B90B' },
  },
};

// 页面加载组件
const PageLoading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
    <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#F0B90B' }} spin />} />
  </div>
);

export default function AppShell({ user, onLogout, initialPage = 'dashboard' }) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [records, setRecords] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 检测屏幕尺寸
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 加载账本列表
  useEffect(() => {
    const loadRecords = async () => {
      try {
        const data = await StorageService.getTradingRecords();
        setRecords(data || []);
        const savedRecordId = localStorage.getItem('currentRecordId');
        if (savedRecordId && data) {
          const savedRecord = data.find(r => r.id === savedRecordId);
          if (savedRecord) {
            setCurrentRecord(savedRecord);
          } else if (data.length > 0) {
            setCurrentRecord(data[0]);
          }
        } else if (data && data.length > 0) {
          setCurrentRecord(data[0]);
        }
      } catch (error) {
        console.error('Failed to load records:', error);
      }
    };
    loadRecords();
  }, []);

  // 加载订阅状态
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const status = await getSubscriptionStatus();
        setSubscription(status);
      } catch (error) {
        console.error('Failed to load subscription:', error);
      }
    };
    loadSubscription();
  }, []);

  // 处理登出
  const handleLogout = async () => {
    try {
      await logout();
      clearSubscriptionCache();
      localStorage.removeItem('currentRecordId');
      onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 切换账本
  const handleRecordChange = (recordId) => {
    const record = records.find(r => r.id === recordId);
    if (record) {
      setCurrentRecord(record);
      localStorage.setItem('currentRecordId', recordId);
    }
  };

  // 菜单项配置
  const menuItems = useMemo(() => {
    const items = [
      { key: 'dashboard', icon: <DashboardOutlined />, label: '数据面板' },
      { key: 'trades', icon: <UnorderedListOutlined />, label: '交易列表' },
      { key: 'calendar', icon: <ClockCircleOutlined />, label: '交易日历' },
      { key: 'ai', icon: <RobotOutlined />, label: 'AI 教练' },
      { key: 'import', icon: <FileAddOutlined />, label: '导入数据' },
      { key: 'risk', icon: <AlertOutlined />, label: '风控监控' },
      {
        key: 'data',
        icon: <DatabaseOutlined />,
        label: '数据管理',
        children: [
          { key: 'records', icon: <FolderOutlined />, label: '账本管理' },
          { key: 'strategies', icon: <AppstoreOutlined />, label: '策略管理' },
        ],
      },
      { key: 'settings', icon: <SettingOutlined />, label: '设置' },
    ];
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      items.push({ key: 'admin', icon: <SafetyCertificateOutlined />, label: '管理后台' });
    }
    return items;
  }, [user]);

  // 渲染页面内容
  const renderContent = () => {
    const pageProps = { currentRecord, records, setRecords, setCurrentRecord, user, subscription };
    
    switch (currentPage) {
      case 'dashboard': return <Suspense fallback={<PageLoading />}><Dashboard {...pageProps} /></Suspense>;
      case 'trades': return <Suspense fallback={<PageLoading />}><TradeList {...pageProps} /></Suspense>;
      case 'calendar': return <Suspense fallback={<PageLoading />}><TradeCalendar {...pageProps} /></Suspense>;
      case 'ai': return <Suspense fallback={<PageLoading />}><AIAnalysis {...pageProps} onUpgrade={() => setShowUpgradeModal(true)} /></Suspense>;
      case 'import': return <Suspense fallback={<PageLoading />}><ImportData {...pageProps} onUpgrade={() => setShowUpgradeModal(true)} /></Suspense>;
      case 'risk': return <Suspense fallback={<PageLoading />}><RiskControl {...pageProps} /></Suspense>;
      case 'records': return <Suspense fallback={<PageLoading />}><TradingRecords {...pageProps} /></Suspense>;
      case 'strategies': return <Suspense fallback={<PageLoading />}><TradingStrategies {...pageProps} /></Suspense>;
      case 'settings': return <Suspense fallback={<PageLoading />}><Settings {...pageProps} /></Suspense>;
      case 'admin': return <Suspense fallback={<PageLoading />}><Admin {...pageProps} /></Suspense>;
      default: return <Suspense fallback={<PageLoading />}><Dashboard {...pageProps} /></Suspense>;
    }
  };

  return (
    <ConfigProvider locale={zhCN} theme={darkTheme}>
      <Layout style={{ height: 'calc(var(--vh, 1vh) * 100)', minHeight: '100vh', overflow: 'hidden' }}>
        {/* 移动端抽屉菜单 */}
        <Drawer
          placement="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          width={260}
          styles={{ body: { padding: 0, background: '#0a0a0c' }, header: { display: 'none' } }}
        >
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <img src="/logo.svg" alt="Logo" style={{ height: 28 }} />
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => { setCurrentPage(key); setMobileMenuOpen(false); }}
            style={{ background: '#0a0a0c', borderRight: 'none' }}
          />
        </Drawer>

        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            width={240}
            collapsedWidth={64}
            style={{ background: '#0a0a0c', borderRight: '1px solid rgba(255,255,255,0.05)', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100 }}
          >
            <div style={{ padding: collapsed ? '16px 8px' : '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo.svg" alt="Logo" style={{ height: collapsed ? 24 : 28, transition: 'height 0.2s' }} />
            </div>
            <Menu
              mode="inline"
              selectedKeys={[currentPage]}
              items={menuItems}
              onClick={({ key }) => setCurrentPage(key)}
              style={{ background: '#0a0a0c', borderRight: 'none' }}
            />
            <SidebarFooter collapsed={collapsed} subscription={subscription} onUpgrade={() => setShowUpgradeModal(true)} />
          </Sider>
        )}

        {/* 主内容区 */}
        <Layout style={{ marginLeft: isMobile ? 0 : (collapsed ? 64 : 240), transition: 'margin 0.2s', height: 'calc(var(--vh, 1vh) * 100)', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 顶部导航 */}
          <Header style={{ background: '#0a0a0c', padding: isMobile ? '0 12px' : '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', height: isMobile ? 56 : 64, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isMobile && (
                <Button type="text" icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />} onClick={() => setMobileMenuOpen(true)} />
              )}
              {records.length > 0 && (
                <Select
                  value={currentRecord?.id}
                  onChange={handleRecordChange}
                  style={{ width: isMobile ? 140 : 200 }}
                  options={records.map(r => ({ value: r.id, label: r.name }))}
                  suffixIcon={<FolderOpenOutlined style={{ color: '#F0B90B' }} />}
                />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
              {subscription?.plan?.name && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: 'rgba(240, 185, 11, 0.1)', borderRadius: 16, fontSize: 12, color: '#F0B90B' }}>
                  <CrownOutlined />
                  {subscription.plan.name.toUpperCase()}
                </span>
              )}
              <Dropdown
                menu={{
                  items: [
                    { key: 'email', label: user?.email, disabled: true },
                    { type: 'divider' },
                    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
                  ],
                  onClick: ({ key }) => key === 'logout' && handleLogout(),
                }}
              >
                <Button type="text" style={{ color: '#9ca3af' }}>{user?.email?.split('@')[0]}</Button>
              </Dropdown>
            </div>
          </Header>

          {/* 页面内容 */}
          <Content style={{ flex: 1, overflow: 'auto', background: '#050505', padding: isMobile ? 12 : 24 }}>
            {renderContent()}
          </Content>
        </Layout>

        {/* 升级弹窗 */}
        <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} currentPlan={subscription?.plan?.name} />
      </Layout>
    </ConfigProvider>
  );
}
