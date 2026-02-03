/**
 * MobileTradeList.jsx - 轻量级移动端交易列表
 * 简洁的列表展示，支持按日期分组
 */
import { useState, useMemo } from 'react';
import dayjs from 'dayjs';

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

// 单条交易项
const TradeItem = ({ trade, instruments }) => {
  const netPnL = getNetPnL(trade, instruments);
  const isProfit = netPnL >= 0;
  const direction = trade.direction || (trade.openQuantity > 0 ? 'LONG' : 'SHORT');
  
  return (
    <div className="m-trade-item">
      <div className="m-trade-left">
        <div className="m-trade-symbol">
          <span className={`m-direction ${direction === 'LONG' ? 'long' : 'short'}`}>
            {direction === 'LONG' ? '▲' : '▼'}
          </span>
          <span className="m-instrument">{trade.instrumentCode || trade.instrument}</span>
        </div>
        <div className="m-trade-meta">
          <span>{dayjs(trade.openTime).format('HH:mm')}</span>
          <span className="m-dot">·</span>
          <span>{Math.abs(trade.openQuantity || trade.quantity || 1)} 手</span>
          {trade.marketSession && (
            <>
              <span className="m-dot">·</span>
              <span>{trade.marketSession}</span>
            </>
          )}
        </div>
      </div>
      <div className={`m-trade-pnl ${isProfit ? 'profit' : 'loss'}`}>
        {isProfit ? '+' : '-'}${Math.abs(netPnL).toFixed(2)}
      </div>
    </div>
  );
};

// 日期分组头
const DateHeader = ({ date, trades, instruments }) => {
  const dayPnL = trades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
  const isProfit = dayPnL >= 0;
  
  return (
    <div className="m-date-header">
      <div className="m-date-left">
        <span className="m-date-text">{date}</span>
        <span className="m-trade-count">{trades.length} 笔</span>
      </div>
      <div className={`m-date-pnl ${isProfit ? 'profit' : 'loss'}`}>
        {isProfit ? '+' : '-'}${Math.abs(dayPnL).toFixed(2)}
      </div>
    </div>
  );
};

export default function MobileTradeList({ trades, instruments }) {
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  // 筛选和搜索
  const filteredTrades = useMemo(() => {
    if (!trades) return [];
    
    let result = [...trades];
    
    // 时间筛选
    const now = dayjs();
    switch (filter) {
      case 'today':
        result = result.filter(t => dayjs(t.openTime).isSame(now, 'day'));
        break;
      case 'week':
        result = result.filter(t => dayjs(t.openTime).isAfter(now.startOf('week')));
        break;
      case 'month':
        result = result.filter(t => dayjs(t.openTime).isAfter(now.startOf('month')));
        break;
    }
    
    // 搜索
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(t => 
        (t.instrumentCode || '').toLowerCase().includes(search) ||
        (t.instrument || '').toLowerCase().includes(search)
      );
    }
    
    // 按时间倒序
    return result.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
  }, [trades, filter, searchText]);

  // 按日期分组
  const groupedTrades = useMemo(() => {
    const groups = {};
    filteredTrades.forEach(trade => {
      const date = dayjs(trade.openTime).format('MM月DD日 ddd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(trade);
    });
    return groups;
  }, [filteredTrades]);

  // 汇总统计
  const summary = useMemo(() => {
    const total = filteredTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
    const wins = filteredTrades.filter(t => getNetPnL(t, instruments) > 0).length;
    return {
      total,
      count: filteredTrades.length,
      wins,
      losses: filteredTrades.length - wins,
    };
  }, [filteredTrades, instruments]);

  return (
    <div className="m-page m-trade-list">
      {/* 头部 */}
      <header className="m-header">
        <h1 className="m-title">交易记录</h1>
      </header>

      {/* 搜索框 */}
      <div className="m-search-box">
        <span className="m-search-icon">🔍</span>
        <input
          type="text"
          className="m-search-input"
          placeholder="搜索品种..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {searchText && (
          <button className="m-search-clear" onClick={() => setSearchText('')}>✕</button>
        )}
      </div>

      {/* 筛选标签 */}
      <div className="m-filter-tabs">
        {[
          { key: 'all', label: '全部' },
          { key: 'today', label: '今日' },
          { key: 'week', label: '本周' },
          { key: 'month', label: '本月' },
        ].map(f => (
          <button
            key={f.key}
            className={`m-filter-tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 汇总统计 */}
      <div className="m-summary-bar">
        <div className="m-summary-item">
          <span className="m-summary-label">共</span>
          <span className="m-summary-value">{summary.count}</span>
          <span className="m-summary-label">笔</span>
        </div>
        <div className="m-summary-divider" />
        <div className="m-summary-item">
          <span className={`m-summary-value ${summary.total >= 0 ? 'profit' : 'loss'}`}>
            {summary.total >= 0 ? '+' : '-'}${Math.abs(summary.total).toFixed(0)}
          </span>
        </div>
        <div className="m-summary-divider" />
        <div className="m-summary-item">
          <span className="m-summary-win">{summary.wins}胜</span>
          <span className="m-summary-loss">{summary.losses}负</span>
        </div>
      </div>

      {/* 交易列表 */}
      <div className="m-trades-container">
        {Object.entries(groupedTrades).map(([date, dayTrades]) => (
          <div key={date} className="m-date-group">
            <DateHeader date={date} trades={dayTrades} instruments={instruments} />
            <div className="m-trades-list">
              {dayTrades.map((trade, idx) => (
                <TradeItem key={trade.id || idx} trade={trade} instruments={instruments} />
              ))}
            </div>
          </div>
        ))}

        {/* 无数据 */}
        {filteredTrades.length === 0 && (
          <div className="m-empty">
            <div className="m-empty-icon">📭</div>
            <div className="m-empty-text">暂无交易记录</div>
            <div className="m-empty-sub">
              {searchText ? '换个关键词试试' : '请在电脑端导入交易数据'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
