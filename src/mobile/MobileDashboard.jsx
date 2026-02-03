/**
 * MobileDashboard.jsx - 轻量级移动端数据面板
 * 纯 CSS 实现，无任何重型依赖
 */
import { useState, useMemo } from 'react';
import dayjs from 'dayjs';

// 品种 tick 价值映射
const TICK_VALUES = {
  'GC': 10, 'ES': 12.5, 'NQ': 5, 'RTY': 5, 'CL': 10, 'SI': 25, 'YM': 5,
  'ZB': 31.25, 'ZN': 15.625, '6E': 12.5, 'M2K': 0.5, 'MES': 1.25, 'MNQ': 0.5, 'MGC': 1,
};

// 计算手续费
const calculateTradeFee = (trade, instruments) => {
  const tradeCode = trade.instrumentCode || trade.instrument || trade.symbol;
  const instrument = instruments?.find(i => 
    i.code === tradeCode || i.code?.toUpperCase() === tradeCode?.toUpperCase()
  );
  const feeRate = instrument?.feeRate || 0;
  const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
  return feeRate * quantity * 2;
};

// 净盈亏
const getNetPnL = (trade, instruments) => {
  return (trade.pnl || 0) - calculateTradeFee(trade, instruments);
};

// 统计卡片
const StatCard = ({ label, value, subLabel, type = 'neutral', icon }) => (
  <div className={`m-stat-card ${type}`}>
    <div className="m-stat-header">
      <span className="m-stat-icon">{icon}</span>
      <span className="m-stat-label">{label}</span>
    </div>
    <div className="m-stat-value">{value}</div>
    {subLabel && <div className="m-stat-sub">{subLabel}</div>}
  </div>
);

// 迷你趋势条
const MiniTrend = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(Math.abs), 1);
  
  return (
    <div className="m-mini-trend">
      {data.map((val, i) => (
        <div 
          key={i} 
          className={`m-trend-bar ${val >= 0 ? 'profit' : 'loss'}`}
          style={{ height: `${Math.abs(val) / max * 100}%` }}
        />
      ))}
    </div>
  );
};

// 快捷筛选
const QuickFilter = ({ active, onChange }) => {
  const filters = [
    { key: 'today', label: '今日' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'all', label: '全部' },
  ];

  return (
    <div className="m-quick-filter">
      {filters.map(f => (
        <button
          key={f.key}
          className={`m-filter-btn ${active === f.key ? 'active' : ''}`}
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};

export default function MobileDashboard({ trades, instruments, currentRecord, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // 过滤交易
  const filteredTrades = useMemo(() => {
    if (!trades) return [];
    
    const now = dayjs();
    switch (filter) {
      case 'today':
        return trades.filter(t => dayjs(t.openTime).isSame(now, 'day'));
      case 'week':
        return trades.filter(t => dayjs(t.openTime).isAfter(now.startOf('week')));
      case 'month':
        return trades.filter(t => dayjs(t.openTime).isAfter(now.startOf('month')));
      default:
        return trades;
    }
  }, [trades, filter]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) {
      return {
        totalPnL: 0,
        winRate: 0,
        totalTrades: 0,
        avgTrade: 0,
        profitFactor: 0,
        wins: 0,
        losses: 0,
        totalProfit: 0,
        totalLoss: 0,
      };
    }

    const withPnL = filteredTrades.map(t => ({
      ...t,
      netPnL: getNetPnL(t, instruments)
    }));

    const totalPnL = withPnL.reduce((sum, t) => sum + t.netPnL, 0);
    const wins = withPnL.filter(t => t.netPnL > 0);
    const losses = withPnL.filter(t => t.netPnL < 0);
    const totalProfit = wins.reduce((sum, t) => sum + t.netPnL, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnL, 0));

    return {
      totalPnL,
      winRate: (wins.length / withPnL.length) * 100,
      totalTrades: withPnL.length,
      avgTrade: totalPnL / withPnL.length,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
      wins: wins.length,
      losses: losses.length,
      totalProfit,
      totalLoss,
    };
  }, [filteredTrades, instruments]);

  // 最近7天趋势
  const trendData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const day = dayjs().subtract(i, 'day');
      const dayTrades = trades?.filter(t => dayjs(t.openTime).isSame(day, 'day')) || [];
      last7Days.push(dayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0));
    }
    return last7Days;
  }, [trades, instruments]);

  // 今日数据
  const todayStats = useMemo(() => {
    const today = dayjs().startOf('day');
    const todayTrades = trades?.filter(t => dayjs(t.openTime).isAfter(today)) || [];
    const pnl = todayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
    const wins = todayTrades.filter(t => getNetPnL(t, instruments) > 0).length;
    return {
      pnl,
      trades: todayTrades.length,
      wins,
      losses: todayTrades.length - wins,
    };
  }, [trades, instruments]);

  // 下拉刷新
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const formatMoney = (val) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000) {
      return `${val >= 0 ? '+' : '-'}$${(absVal / 1000).toFixed(1)}k`;
    }
    return `${val >= 0 ? '+' : '-'}$${absVal.toFixed(0)}`;
  };

  return (
    <div className="m-page m-dashboard">
      {/* 头部 */}
      <header className="m-header">
        <div className="m-header-left">
          <img src="/logo.svg" alt="Logo" className="m-logo" />
        </div>
        <button 
          className={`m-refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
        >
          🔄
        </button>
      </header>

      {/* 当前账本 */}
      {currentRecord && (
        <div className="m-current-record">
          📁 {currentRecord.name}
        </div>
      )}

      {/* 今日概览卡片 */}
      <div className="m-today-card">
        <div className="m-today-header">
          <span className="m-today-label">今日盈亏</span>
          <span className="m-today-count">{todayStats.trades} 笔交易</span>
        </div>
        <div className={`m-today-value ${todayStats.pnl >= 0 ? 'profit' : 'loss'}`}>
          {todayStats.pnl >= 0 ? '+' : '-'}${Math.abs(todayStats.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="m-today-stats">
          <span className="m-win">{todayStats.wins} 胜</span>
          <span className="m-divider">/</span>
          <span className="m-loss">{todayStats.losses} 负</span>
        </div>
        <MiniTrend data={trendData} />
        <div className="m-trend-label">最近 7 天趋势</div>
      </div>

      {/* 快捷筛选 */}
      <QuickFilter active={filter} onChange={setFilter} />

      {/* 统计数据网格 */}
      <div className="m-stats-grid">
        <StatCard 
          icon="💰"
          label="总盈亏" 
          value={`${stats.totalPnL >= 0 ? '+' : '-'}$${Math.abs(stats.totalPnL).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subLabel={`${stats.totalTrades} 笔交易`}
          type={stats.totalPnL >= 0 ? 'profit' : 'loss'}
        />
        <StatCard 
          icon="🎯"
          label="胜率" 
          value={`${stats.winRate.toFixed(1)}%`}
          subLabel={`${stats.wins}胜 / ${stats.losses}负`}
          type={stats.winRate >= 50 ? 'profit' : 'loss'}
        />
        <StatCard 
          icon="📈"
          label="平均盈亏" 
          value={`${stats.avgTrade >= 0 ? '+' : '-'}$${Math.abs(stats.avgTrade).toFixed(0)}`}
          type={stats.avgTrade >= 0 ? 'profit' : 'loss'}
        />
        <StatCard 
          icon="⚖️"
          label="利润因子" 
          value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          type={stats.profitFactor >= 1.5 ? 'profit' : stats.profitFactor >= 1 ? 'neutral' : 'loss'}
        />
      </div>

      {/* 盈亏分布 */}
      <div className="m-pnl-bar">
        <div className="m-pnl-bar-header">
          <span>盈亏分布</span>
        </div>
        <div className="m-pnl-bar-track">
          <div 
            className="m-pnl-bar-profit"
            style={{ width: `${stats.totalProfit / (stats.totalProfit + stats.totalLoss) * 100 || 50}%` }}
          />
        </div>
        <div className="m-pnl-bar-labels">
          <span className="profit">盈 ${stats.totalProfit.toFixed(0)}</span>
          <span className="loss">亏 ${stats.totalLoss.toFixed(0)}</span>
        </div>
      </div>

      {/* 无数据提示 */}
      {filteredTrades.length === 0 && (
        <div className="m-empty">
          <div className="m-empty-icon">📭</div>
          <div className="m-empty-text">暂无交易数据</div>
          <div className="m-empty-sub">请在电脑端导入交易记录</div>
        </div>
      )}
    </div>
  );
}
