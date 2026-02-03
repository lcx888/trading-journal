/**
 * MobileDashboard.jsx - 极简主义数据面板
 * 聚焦核心数据，去除多余装饰
 */
import { useState, useMemo } from 'react';
import dayjs from 'dayjs';

// 基础工具函数
const calculateTradeFee = (trade, instruments) => {
  const tradeCode = trade.instrumentCode || trade.instrument || trade.symbol;
  const instrument = instruments?.find(i => 
    i.code === tradeCode || i.code?.toUpperCase() === tradeCode?.toUpperCase()
  );
  const feeRate = instrument?.feeRate || 0;
  const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
  return feeRate * quantity * 2;
};

const getNetPnL = (trade, instruments) => {
  return (trade.pnl || 0) - calculateTradeFee(trade, instruments);
};

// 迷你统计卡片
const MiniStat = ({ label, value, type = 'neutral' }) => (
  <div className="m-mini-stat">
    <div className="m-mini-label">{label}</div>
    <div className={`m-mini-value ${type === 'profit' ? 'text-profit' : type === 'loss' ? 'text-loss' : ''}`}>
      {value}
    </div>
  </div>
);

export default function MobileDashboard({ trades, instruments, currentRecord, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);

  // 计算今日数据
  const todayStats = useMemo(() => {
    const today = dayjs().startOf('day');
    const todayTrades = trades?.filter(t => dayjs(t.openTime).isAfter(today)) || [];
    
    const pnl = todayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
    const wins = todayTrades.filter(t => getNetPnL(t, instruments) > 0).length;
    const losses = todayTrades.filter(t => getNetPnL(t, instruments) < 0).length;
    
    return {
      pnl,
      trades: todayTrades.length,
      wins,
      losses,
      winRate: todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0
    };
  }, [trades, instruments]);

  // 计算总数据
  const totalStats = useMemo(() => {
    if (!trades || trades.length === 0) return { pnl: 0, winRate: 0, profitFactor: 0 };
    
    const withPnL = trades.map(t => ({ ...t, netPnL: getNetPnL(t, instruments) }));
    const pnl = withPnL.reduce((sum, t) => sum + t.netPnL, 0);
    const wins = withPnL.filter(t => t.netPnL > 0);
    const losses = withPnL.filter(t => t.netPnL < 0);
    const totalProfit = wins.reduce((sum, t) => sum + t.netPnL, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnL, 0));
    
    return {
      pnl,
      winRate: (wins.length / withPnL.length) * 100,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99.9 : 0
    };
  }, [trades, instruments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="m-page">
      {/* 头部 */}
      <header className="m-header">
        <img src="/logo.svg" alt="Logo" className="m-logo" />
        <div className="m-header-actions">
          <button className="m-icon-btn" onClick={handleRefresh}>
            <span className={refreshing ? 'm-loading-spinner' : ''} style={{width:16, height:16, border: refreshing ? undefined : 'none'}}>
              {!refreshing && '🔄'}
            </span>
          </button>
        </div>
      </header>

      {/* Hero Section: 今日盈亏 */}
      <section className="m-hero-section">
        <div className="m-hero-label">今日盈亏</div>
        <div className={`m-hero-value ${todayStats.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
          {todayStats.pnl >= 0 ? '+' : '-'}${Math.abs(todayStats.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="m-hero-stats">
          <span className="text-profit">{todayStats.wins}W</span>
          <span className="text-ter">/</span>
          <span className="text-loss">{todayStats.losses}L</span>
          <span className="text-ter">•</span>
          <span>{todayStats.trades} Trades</span>
        </div>
      </section>

      {/* 核心指标网格 */}
      <section className="m-stat-grid">
        <MiniStat 
          label="总盈亏" 
          value={`${totalStats.pnl >= 0 ? '+' : '-'}$${Math.abs(totalStats.pnl).toFixed(0)}`}
          type={totalStats.pnl >= 0 ? 'profit' : 'loss'}
        />
        <MiniStat 
          label="总胜率" 
          value={`${totalStats.winRate.toFixed(1)}%`}
          type={totalStats.winRate >= 50 ? 'profit' : 'loss'}
        />
        <MiniStat 
          label="利润因子" 
          value={totalStats.profitFactor.toFixed(2)}
          type={totalStats.profitFactor >= 1.5 ? 'profit' : 'neutral'}
        />
        <MiniStat 
          label="当前账本" 
          value={currentRecord?.name || '默认'}
        />
      </section>

      {/* 简单的趋势图 (CSS Bar) */}
      <div className="m-card">
        <div className="m-hero-label" style={{marginBottom: 12}}>最近7天趋势</div>
        <div style={{display: 'flex', alignItems: 'flex-end', height: 60, gap: 4}}>
          {Array.from({length: 7}).map((_, i) => {
            const day = dayjs().subtract(6 - i, 'day');
            const dayTrades = trades?.filter(t => dayjs(t.openTime).isSame(day, 'day')) || [];
            const pnl = dayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
            const height = Math.min(Math.abs(pnl) / 500 * 40 + 4, 60); // 简单缩放
            
            return (
              <div key={i} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
                <div style={{
                  width: '100%', 
                  height: `${height}px`, 
                  background: pnl >= 0 ? 'var(--m-profit)' : 'var(--m-loss)',
                  opacity: pnl === 0 ? 0.1 : 0.8,
                  borderRadius: 2
                }} />
                <div style={{fontSize: 9, color: 'var(--m-text-tertiary)'}}>{day.format('DD')}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
