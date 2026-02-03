/**
 * MobileApp.jsx - 轻量级移动端入口
 * 完全不依赖 Ant Design / ECharts，体积极小
 */
import { useState, useEffect } from 'react';
import { getMe, logout } from '../services/auth';
import { getAuthToken } from '../services/api';
import StorageService from '../services/storage';
import MobileDashboard from './MobileDashboard';
import MobileTradeList from './MobileTradeList';
import MobileLogin from './MobileLogin';
import './mobile.css';

// 简单的加载指示器
const MobileLoading = () => (
  <div className="m-loading">
    <img src="/logo.svg" alt="Logo" className="m-loading-logo" />
    <div className="m-spinner" />
  </div>
);

// 底部导航
const BottomNav = ({ active, onChange }) => {
  const tabs = [
    { key: 'dashboard', icon: '📊', label: '面板' },
    { key: 'trades', icon: '📋', label: '交易' },
    { key: 'profile', icon: '👤', label: '我的' },
  ];

  return (
    <nav className="m-bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`m-nav-item ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="m-nav-icon">{tab.icon}</span>
          <span className="m-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

// 个人中心页面
const ProfilePage = ({ user, records, currentRecord, onRecordChange, onLogout, onGoToWeb }) => {
  return (
    <div className="m-page m-profile">
      <div className="m-profile-header">
        <div className="m-avatar">{user?.email?.[0]?.toUpperCase() || '?'}</div>
        <div className="m-user-info">
          <div className="m-user-email">{user?.email}</div>
          <div className="m-user-plan">Free Plan</div>
        </div>
      </div>

      <div className="m-section">
        <div className="m-section-title">当前账本</div>
        <div className="m-record-list">
          {records.map(r => (
            <button
              key={r.id}
              className={`m-record-item ${currentRecord?.id === r.id ? 'active' : ''}`}
              onClick={() => onRecordChange(r)}
            >
              <span className="m-record-icon">📁</span>
              <span className="m-record-name">{r.name}</span>
              {currentRecord?.id === r.id && <span className="m-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="m-section">
        <div className="m-section-title">更多功能</div>
        <button className="m-menu-item" onClick={onGoToWeb}>
          <span>🖥️</span>
          <span>访问完整版 Web</span>
          <span className="m-arrow">→</span>
        </button>
        <button className="m-menu-item" onClick={onLogout}>
          <span>🚪</span>
          <span>退出登录</span>
          <span className="m-arrow">→</span>
        </button>
      </div>

      <div className="m-footer-tip">
        💡 完整功能请使用电脑访问 Web 版
      </div>
    </div>
  );
};

export default function MobileApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [records, setRecords] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [trades, setTrades] = useState([]);
  const [instruments, setInstruments] = useState([]);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getMe();
        setUser(userData);
        await loadData();
      } catch (e) {
        console.error('Auth check failed:', e);
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 加载数据
  const loadData = async () => {
    try {
      const [recordList, instrumentList] = await Promise.all([
        StorageService.getTradingRecords(),
        StorageService.getInstruments(),
      ]);

      setRecords(recordList || []);
      setInstruments(instrumentList || []);

      // 恢复上次选择的账本
      const savedRecordId = localStorage.getItem('currentRecordId');
      let selectedRecord = null;
      
      if (savedRecordId && recordList) {
        selectedRecord = recordList.find(r => r.id === savedRecordId);
      }
      if (!selectedRecord && recordList?.length > 0) {
        selectedRecord = recordList[0];
      }
      
      if (selectedRecord) {
        setCurrentRecord(selectedRecord);
        await loadTrades(selectedRecord.id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  // 加载交易数据
  const loadTrades = async (recordId) => {
    try {
      const allTrades = await StorageService.getAllTrades();
      const filteredTrades = recordId 
        ? allTrades.filter(t => t.recordId === recordId)
        : allTrades;
      setTrades(filteredTrades);
    } catch (error) {
      console.error('Failed to load trades:', error);
    }
  };

  // 切换账本
  const handleRecordChange = async (record) => {
    setCurrentRecord(record);
    localStorage.setItem('currentRecordId', record.id);
    await loadTrades(record.id);
  };

  // 登录成功
  const handleLoginSuccess = async (userData) => {
    setUser(userData);
    setLoading(true);
    await loadData();
    setLoading(false);
  };

  // 登出
  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentRecordId');
    setUser(null);
    setTrades([]);
    setRecords([]);
    setCurrentRecord(null);
  };

  // 跳转完整版
  const goToFullWeb = () => {
    // 添加标记，强制使用完整版
    localStorage.setItem('force_full_version', 'true');
    window.location.reload();
  };

  // 刷新数据
  const refreshData = async () => {
    if (currentRecord) {
      await loadTrades(currentRecord.id);
    }
  };

  if (loading) {
    return <MobileLoading />;
  }

  if (!user) {
    return <MobileLogin onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="m-app">
      <div className="m-content">
        {currentTab === 'dashboard' && (
          <MobileDashboard 
            trades={trades} 
            instruments={instruments}
            currentRecord={currentRecord}
            onRefresh={refreshData}
          />
        )}
        {currentTab === 'trades' && (
          <MobileTradeList 
            trades={trades} 
            instruments={instruments}
          />
        )}
        {currentTab === 'profile' && (
          <ProfilePage 
            user={user}
            records={records}
            currentRecord={currentRecord}
            onRecordChange={handleRecordChange}
            onLogout={handleLogout}
            onGoToWeb={goToFullWeb}
          />
        )}
      </div>
      <BottomNav active={currentTab} onChange={setCurrentTab} />
    </div>
  );
}
