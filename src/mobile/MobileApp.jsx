/**
 * MobileApp.jsx - 移动端入口
 */
import { useState, useEffect } from 'react';
import { getMe, logout } from '../services/auth';
import { getAuthToken } from '../services/api';
import StorageService from '../services/storage';
import MobileDashboard from './MobileDashboard';
import MobileTradeList from './MobileTradeList';
import MobileLogin from './MobileLogin';
import './mobile.css';

// 底部导航
const BottomNav = ({ active, onChange }) => {
  const tabs = [
    { key: 'dashboard', icon: '⚡', label: '概览' },
    { key: 'trades', icon: '📝', label: '记录' },
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
    <div className="m-page" style={{paddingTop: 32}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32}}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', 
          background: 'var(--m-brand-dim)', color: 'var(--m-brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 600
        }}>
          {user?.email?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{fontSize: 16, fontWeight: 500}}>{user?.email}</div>
          <div className="text-ter" style={{fontSize: 12}}>Free Plan</div>
        </div>
      </div>

      <div className="m-hero-label" style={{marginBottom: 12}}>当前账本</div>
      <div className="m-card" style={{padding: 0, overflow: 'hidden'}}>
        {records.map(r => (
          <button
            key={r.id}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: 'none', border: 'none',
              borderBottom: '1px solid var(--m-border)',
              color: 'var(--m-text)', fontSize: 14, textAlign: 'left'
            }}
            onClick={() => onRecordChange(r)}
          >
            <span style={{fontSize: 16}}>📁</span>
            <span style={{flex: 1}}>{r.name}</span>
            {currentRecord?.id === r.id && <span className="text-brand">✓</span>}
          </button>
        ))}
      </div>

      <div className="m-hero-label" style={{margin: '24px 0 12px'}}>更多</div>
      <div className="m-card" style={{padding: 0, overflow: 'hidden'}}>
        <button 
          style={{
            width: '100%', padding: '14px 16px', background: 'none', border: 'none',
            borderBottom: '1px solid var(--m-border)', color: 'var(--m-text)',
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 14
          }}
          onClick={onGoToWeb}
        >
          <span>🖥️</span>
          <span style={{flex: 1, textAlign: 'left'}}>切换至完整版 Web</span>
          <span className="text-ter">→</span>
        </button>
        <button 
          style={{
            width: '100%', padding: '14px 16px', background: 'none', border: 'none',
            color: 'var(--m-loss)', display: 'flex', alignItems: 'center', gap: 12, fontSize: 14
          }}
          onClick={onLogout}
        >
          <span>🚪</span>
          <span style={{flex: 1, textAlign: 'left'}}>退出登录</span>
        </button>
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
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const loadData = async () => {
    try {
      const [recordList, instrumentList] = await Promise.all([
        StorageService.getTradingRecords(),
        StorageService.getInstruments(),
      ]);
      setRecords(recordList || []);
      setInstruments(instrumentList || []);
      
      const savedRecordId = localStorage.getItem('currentRecordId');
      const selectedRecord = (recordList && recordList.find(r => r.id === savedRecordId)) || recordList?.[0];
      
      if (selectedRecord) {
        setCurrentRecord(selectedRecord);
        await loadTrades(selectedRecord.id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadTrades = async (recordId) => {
    try {
      const allTrades = await StorageService.getAllTrades();
      const filteredTrades = recordId ? allTrades.filter(t => t.recordId === recordId) : allTrades;
      setTrades(filteredTrades);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRecordChange = async (record) => {
    setCurrentRecord(record);
    localStorage.setItem('currentRecordId', record.id);
    await loadTrades(record.id);
  };

  const handleLogout = async () => {
    await logout();
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  if (loading) return <div className="m-loading-spinner" style={{margin: 'auto', marginTop: '40vh'}} />;
  if (!user) return <MobileLogin onSuccess={(u) => { setUser(u); loadData(); }} />;

  return (
    <div className="m-app">
      <div className="m-content">
        {currentTab === 'dashboard' && (
          <MobileDashboard 
            trades={trades} 
            instruments={instruments}
            currentRecord={currentRecord}
            onRefresh={() => loadTrades(currentRecord?.id)}
          />
        )}
        {currentTab === 'trades' && (
          <MobileTradeList trades={trades} instruments={instruments} />
        )}
        {currentTab === 'profile' && (
          <ProfilePage 
            user={user}
            records={records}
            currentRecord={currentRecord}
            onRecordChange={handleRecordChange}
            onLogout={handleLogout}
            onGoToWeb={() => {
              localStorage.setItem('force_full_version', 'true');
              window.location.reload();
            }}
          />
        )}
      </div>
      <BottomNav active={currentTab} onChange={setCurrentTab} />
    </div>
  );
}
