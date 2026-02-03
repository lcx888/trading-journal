/**
 * MobileTradeList.jsx - 极简交易列表
 * 清晰的列表视图，强调关键信息
 */
import { useState, useMemo } from 'react';
import dayjs from 'dayjs';

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

const TradeRow = ({ trade, instruments }) => {
  const netPnL = getNetPnL(trade, instruments);
  const isProfit = netPnL >= 0;
  const direction = trade.direction || (trade.openQuantity > 0 ? 'LONG' : 'SHORT');
  
  return (
    <div className="m-trade-row">
      <div className="m-trade-info">
        <div className="m-trade-symbol">
          <span className={`m-trade-tag ${direction === 'LONG' ? 'long' : 'short'}`}>
            {direction === 'LONG' ? 'L' : 'S'}
          </span>
          <span>{trade.instrumentCode || trade.instrument}</span>
          <span className="text-ter" style={{fontSize: 12, fontWeight: 400}}>
            x{Math.abs(trade.openQuantity || trade.quantity || 1)}
          </span>
        </div>
        <div className="m-trade-time">
          {dayjs(trade.openTime).format('HH:mm')}
          {trade.marketSession && ` · ${trade.marketSession}`}
        </div>
      </div>
      <div className={`m-trade-pnl ${isProfit ? 'text-profit' : 'text-loss'}`}>
        {isProfit ? '+' : '-'}${Math.abs(netPnL).toFixed(2)}
      </div>
    </div>
  );
};

export default function MobileTradeList({ trades, instruments }) {
  const [filter, setFilter] = useState('all');

  const filteredTrades = useMemo(() => {
    if (!trades) return [];
    
    let result = [...trades];
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
    
    return result.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
  }, [trades, filter]);

  // 按日期分组
  const groupedTrades = useMemo(() => {
    const groups = {};
    filteredTrades.forEach(trade => {
      const date = dayjs(trade.openTime).format('MM月DD日 ddd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(trade);
    });
    return groups;
  }, [filteredTrades]);

  return (
    <div className="m-page">
      <header className="m-header">
        <div className="m-hero-label" style={{fontSize: 16, fontWeight: 600, color: 'var(--m-text)'}}>交易记录</div>
        <div className="text-ter" style={{fontSize: 12}}>{filteredTrades.length} 笔</div>
      </header>

      {/* 过滤器 */}
      <div className="m-filter-scroll">
        {['all', 'today', 'week', 'month'].map(f => (
          <button
            key={f}
            className={`m-pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '全部' : f === 'today' ? '今日' : f === 'week' ? '本周' : '本月'}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {Object.entries(groupedTrades).map(([date, dayTrades]) => (
        <div key={date}>
          <div className="m-date-header">
            <span>{date}</span>
            <span>
              {dayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0) >= 0 ? '+' : '-'}
              ${Math.abs(dayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0)).toFixed(0)}
            </span>
          </div>
          <div>
            {dayTrades.map((trade, i) => (
              <TradeRow key={trade.id || i} trade={trade} instruments={instruments} />
            ))}
          </div>
        </div>
      ))}

      {filteredTrades.length === 0 && (
        <div className="m-empty-state">
          <div>📭</div>
          <div style={{marginTop: 8, fontSize: 13}}>暂无数据</div>
        </div>
      )}
    </div>
  );
}
