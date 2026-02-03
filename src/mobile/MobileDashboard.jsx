import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Spin } from 'antd';
import { LogoutOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './mobile.css';

const MobileDashboard = ({ onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPnL: 0,
    winRate: 0,
    tradeCount: 0,
    recentTrades: []
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // 获取所有交易
      const trades = await StorageService.getAllTrades();
      
      // 计算基础统计
      const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winningTrades = trades.filter(t => t.pnl > 0).length;
      const winRate = trades.length > 0 ? Math.round((winningTrades / trades.length) * 100) : 0;
      
      // 获取最近20笔交易，按时间倒序
      const sortedTrades = [...trades].sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
      const recentTrades = sortedTrades.slice(0, 20);

      setStats({
        totalPnL,
        winRate,
        tradeCount: trades.length,
        recentTrades
      });
    } catch (error) {
      console.error('Mobile load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="mobile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>MetWorth AI</h1>
        <div style={{ display: 'flex', gap: 16 }}>
          <ReloadOutlined onClick={loadData} style={{ fontSize: 18 }} />
          <LogoutOutlined onClick={onLogout} style={{ fontSize: 18 }} />
        </div>
      </div>

      {/* 核心卡片 */}
      <div className="mobile-card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
        <div className="mobile-stat-label" style={{ color: '#94a3b8' }}>总盈亏 (Net PnL)</div>
        <div className="mobile-stat-value" style={{ color: stats.totalPnL >= 0 ? '#4ade80' : '#f87171' }}>
          {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toLocaleString()}
        </div>
        <div style={{ display: 'flex', marginTop: 12, gap: 24 }}>
          <div>
            <div className="mobile-stat-label" style={{ color: '#94a3b8' }}>胜率</div>
            <div style={{ fontWeight: 600 }}>{stats.winRate}%</div>
          </div>
          <div>
            <div className="mobile-stat-label" style={{ color: '#94a3b8' }}>总交易数</div>
            <div style={{ fontWeight: 600 }}>{stats.tradeCount}</div>
          </div>
        </div>
      </div>

      {/* 最近交易列表 */}
      <h3 style={{ fontSize: 14, color: '#666', marginBottom: 10, marginTop: 20 }}>最近交易 (Last 20)</h3>
      <div className="mobile-card" style={{ padding: '0 16px' }}>
        {stats.recentTrades.map(trade => (
          <div key={trade.id} className="mobile-trade-item">
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{trade.instrumentCode}</div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {dayjs(trade.openTime).format('MM-DD HH:mm')}
                <span style={{ marginLeft: 8, color: trade.direction === 'LONG' ? '#ef4444' : '#10b981' }}>
                  {trade.direction === 'LONG' ? '多' : '空'}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: trade.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                {trade.pnl >= 0 ? '+' : ''}{trade.pnl}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {trade.openQuantity}手
              </div>
            </div>
          </div>
        ))}
        {stats.recentTrades.length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#999' }}>暂无数据</div>
        )}
      </div>
    </div>
  );
};

export default MobileDashboard;
