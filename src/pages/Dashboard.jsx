import { useState, useEffect, useMemo } from 'react';
import { Spin, Select, DatePicker, Tag, Button, Skeleton, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  FireOutlined,
  ClockCircleOutlined,
  AimOutlined,
  RightOutlined,
  CalendarOutlined,
  LineChartOutlined,
  BarChartOutlined,
  DownOutlined,
  UpOutlined,
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import AnimatedNumber from '../components/AnimatedNumber';
import EmptyState from '../components/EmptyState';
import RiskStatusBar from '../components/RiskStatusBar';

const { RangePicker } = DatePicker;

// 交易日分界时间（凌晨6点前的交易算作前一天）
const TRADING_DAY_CUTOFF_HOUR = 6;

// 获取交易日日期（与日历保持一致）
const getTradingDate = (openTime) => {
  const tradeTime = dayjs(openTime);
  const hour = tradeTime.hour();
  if (hour < TRADING_DAY_CUTOFF_HOUR) {
    return tradeTime.subtract(1, 'day').format('YYYY-MM-DD');
  }
  return tradeTime.format('YYYY-MM-DD');
};

// 配色系统（使用 CSS 变量对应值）
const COLORS = {
  profit: '#10b981',
  profitBg: 'rgba(16, 185, 129, 0.1)',
  loss: '#f43f5e',
  lossBg: 'rgba(244, 63, 94, 0.1)',
  brand: '#eab308',
  brandBg: 'rgba(234, 179, 8, 0.1)',
  bgPrimary: '#0a0a0c',
  bgSecondary: '#0d0d10',
  bgTertiary: '#0f0f12',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  border: 'rgba(255, 255, 255, 0.05)',
};

// 品种 tick 价值映射（美元/tick）
const TICK_VALUES = {
  'GC': 10, 'ES': 12.5, 'NQ': 5, 'RTY': 5, 'CL': 10, 'SI': 25, 'YM': 5,
  'ZB': 31.25, 'ZN': 15.625, '6E': 12.5, 'M2K': 0.5, 'MES': 1.25, 'MNQ': 0.5, 'MGC': 1,
};

// 交易员等级定义（基于复盘笔数）
const TRADER_LEVELS = [
  { level: 1, name: '新手交易员', icon: 'L1', minTrades: 0 },
  { level: 2, name: '初级交易员', icon: 'L2', minTrades: 100 },
  { level: 3, name: '进阶交易员', icon: 'L3', minTrades: 500 },
  { level: 4, name: '专业交易员', icon: 'L4', minTrades: 1000 },
  { level: 5, name: '资深交易员', icon: 'L5', minTrades: 2500 },
  { level: 6, name: '精英交易员', icon: 'L6', minTrades: 5000 },
  { level: 7, name: '传奇交易员', icon: 'L7', minTrades: 10000 },
];

const getTickValue = (instrumentCode, instruments) => {
  const instrument = instruments.find(i => i.code === instrumentCode);
  if (instrument?.tickValue) return instrument.tickValue;
  return TICK_VALUES[instrumentCode] || 5;
};

const ticksToUSD = (ticks, instrumentCode, quantity, instruments) => {
  if (ticks === undefined || ticks === null) return 0;
  const tickValue = getTickValue(instrumentCode, instruments);
  return ticks * tickValue * Math.abs(quantity || 1);
};

// 计算单笔交易手续费（双边：开仓+平仓）
const calculateTradeFee = (trade, instruments) => {
  const tradeCode = trade.instrumentCode || trade.instrument || trade.symbol;
  const instrument = instruments?.find(i => 
    i.code === tradeCode || 
    i.code?.toUpperCase() === tradeCode?.toUpperCase()
  );
  const feeRate = instrument?.feeRate || 0;
  const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
  return feeRate * quantity * 2;
};

// 计算单笔交易净盈亏（扣除手续费）
const getNetPnL = (trade, instruments) => {
  return (trade.pnl || 0) - calculateTradeFee(trade, instruments);
};

const QuickFilterTags = ({ quickFilter, setQuickFilter }) => {
  const filters = [
    { key: 'today', label: '今日' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
  ];

  return (
    <div className="flex gap-1 bg-[var(--bg-tertiary)] p-0.5 rounded">
      {filters.map(f => (
        <button
          key={f.key}
          onClick={() => setQuickFilter(quickFilter === f.key ? null : f.key)}
          className={`px-3 py-1 text-[10px] rounded transition-all ${
            quickFilter === f.key 
              ? 'bg-[var(--color-brand)] text-black font-bold' 
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};

const Dashboard = ({ activeRecordId = 'all', onNavigateToImport, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]); // 全部交易数据（用于今日表现）
  const [stats, setStats] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState('ALL');
  const [dateRange, setDateRange] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('all');
  const [quickFilter, setQuickFilter] = useState(null);
  const [traderName, setTraderName] = useState('');
  const [quote, setQuote] = useState('');

  // 交易金句库
  const quotes = useMemo(() => [
    "保持纪律，市场永远在那。",
    "盈利是认知的变现，亏损是认知的学费。",
    "不要为了交易而交易，耐心是交易员最伟大的品质。",
    "计划你的交易，交易你的计划。",
    "风险控制永远排在盈利之前。",
    "市场不产生财富，它只负责财富的重新分配。",
    "截断亏损，让利润奔跑。",
    "你无法预测市场，但你可以控制自己的反应。",
    "成功的交易者是风险管理者，而不是预言家。",
    "每一次下单前，先想好在哪里认输。",
    "不要在亏损的头寸上加仓。",
    "交易是孤独者的游戏，学会与自己独处。",
    "情绪是交易的天敌，冷静是最好的武器。",
    "复盘是进步的阶梯，每一笔亏损都是宝贵的教材。"
  ], []);

  useEffect(() => {
    loadData();
  }, [selectedInstrument, dateRange, activeRecordId, quickFilter]);
  
  // 加载交易员名称和随机金句
  useEffect(() => {
    const name = StorageService.getTraderName();
    setTraderName(name);
    
    // 随机选择一条金句
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setQuote(randomQuote);
  }, [quotes]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedTrades, instrumentList] = await Promise.all([
        StorageService.getAllTrades(),
        StorageService.getInstruments(),
      ]);

      setInstruments(instrumentList);
      setAllTrades(fetchedTrades); // 保存全部交易数据
      let filteredTrades = fetchedTrades;
      
      if (activeRecordId !== 'all') {
        filteredTrades = filteredTrades.filter(t => t.recordId === activeRecordId);
      }
      
      if (selectedInstrument !== 'ALL') {
        filteredTrades = filteredTrades.filter(t => t.instrumentCode === selectedInstrument);
      }
      
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startDate = dateRange[0].format('YYYY-MM-DD');
        const endDate = dateRange[1].format('YYYY-MM-DD');
        filteredTrades = filteredTrades.filter(t => {
          const tradingDate = getTradingDate(t.openTime);
          return tradingDate >= startDate && tradingDate <= endDate;
        });
      }
      
      if (quickFilter) {
        const todayDate = dayjs().format('YYYY-MM-DD');
        const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
        const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
        switch (quickFilter) {
          case 'today':
            // 使用交易日逻辑：今日的交易
            filteredTrades = filteredTrades.filter(t => getTradingDate(t.openTime) === todayDate);
            break;
          case 'week':
            // 使用交易日逻辑：本周的交易
            filteredTrades = filteredTrades.filter(t => getTradingDate(t.openTime) >= weekStart);
            break;
          case 'month':
            // 使用交易日逻辑：本月的交易
            filteredTrades = filteredTrades.filter(t => getTradingDate(t.openTime) >= monthStart);
            break;
        }
      }

      setTrades(filteredTrades);
      
      // 使用净盈亏（扣除手续费）计算统计
      const s = {
        totalTrades: filteredTrades.length,
        totalPnL: filteredTrades.reduce((sum, t) => sum + getNetPnL(t, instrumentList), 0),
        winRate: filteredTrades.length > 0 ? (filteredTrades.filter(t => getNetPnL(t, instrumentList) > 0).length / filteredTrades.length) * 100 : 0,
        avgTrade: filteredTrades.length > 0 ? filteredTrades.reduce((sum, t) => sum + getNetPnL(t, instrumentList), 0) / filteredTrades.length : 0,
        profitFactor: filteredTrades.filter(t => getNetPnL(t, instrumentList) < 0).length > 0 ? 
          Math.abs(filteredTrades.filter(t => getNetPnL(t, instrumentList) > 0).reduce((sum, t) => sum + getNetPnL(t, instrumentList), 0) / filteredTrades.filter(t => getNetPnL(t, instrumentList) < 0).reduce((sum, t) => sum + getNetPnL(t, instrumentList), 0)) : 
          filteredTrades.filter(t => getNetPnL(t, instrumentList) > 0).length > 0 ? Infinity : 0,
        maxMAE: filteredTrades.length > 0 ? Math.max(...filteredTrades.map(t => {
          const mae = t.mae ?? t.jigsawData?.mae;
          if (mae === undefined || mae === null) return 0;
          return Math.abs(ticksToUSD(mae, t.instrumentCode, t.openQuantity, instrumentList));
        })) : 0,
        totalProfit: filteredTrades.filter(t => getNetPnL(t, instrumentList) > 0).reduce((sum, t) => sum + getNetPnL(t, instrumentList), 0),
        totalLoss: filteredTrades.filter(t => getNetPnL(t, instrumentList) < 0).reduce((sum, t) => sum + getNetPnL(t, instrumentList), 0),
      };
      setStats(s);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentLevel = useMemo(() => {
    if (!stats) return TRADER_LEVELS[0];
    const totalTrades = stats.totalTrades || 0;
    for (let i = TRADER_LEVELS.length - 1; i >= 0; i--) {
      if (totalTrades >= TRADER_LEVELS[i].minTrades) return TRADER_LEVELS[i];
    }
    return TRADER_LEVELS[0];
  }, [stats]);

  const nextLevel = TRADER_LEVELS[currentLevel.level] || null;
  const progress = useMemo(() => {
    if (!nextLevel || !stats) return 100;
    const currentTrades = stats.totalTrades || 0;
    const startTrades = currentLevel.minTrades;
    const targetTrades = nextLevel.minTrades;
    return Math.min(Math.max(((currentTrades - startTrades) / (targetTrades - startTrades)) * 100, 2), 98);
  }, [currentLevel, nextLevel, stats]);

  const clearFilters = () => {
    setSelectedInstrument('ALL');
    setDateRange(null);
    setQuickFilter(null);
  };

  const getFilterDescription = () => {
    const parts = [];
    if (selectedInstrument !== 'ALL') parts.push(selectedInstrument);
    if (dateRange) parts.push('特定日期');
    if (quickFilter) parts.push(quickFilter === 'today' ? '今日' : quickFilter === 'week' ? '本周' : '本月');
    return parts.join(' + ');
  };

  // 权益曲线图表（使用净盈亏）
  const getPnLChartOption = () => {
    if (!trades || trades.length === 0) return {};
    const sortedTrades = [...trades].sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
    let cumPnL = 0;
    const data = sortedTrades.map((t) => {
      const netPnL = getNetPnL(t, instruments);
      cumPnL += netPnL;
      return { value: Number(cumPnL.toFixed(2)), date: dayjs(t.openTime).format('MM-DD HH:mm'), pnl: netPnL };
    });

    const lineColor = cumPnL >= 0 ? COLORS.profit : COLORS.loss;
    const markPoints = [];
    if (data.length > 0) {
      const values = data.map(d => d.value);
      const maxIndex = values.indexOf(Math.max(...values));
      const minIndex = values.indexOf(Math.min(...values));
      markPoints.push({
        coord: [maxIndex, data[maxIndex].value], symbol: 'circle', symbolSize: 10,
        itemStyle: { color: COLORS.profit, borderColor: COLORS.bgSecondary, borderWidth: 2 },
        label: { show: true, position: 'top', formatter: `$${data[maxIndex].value.toLocaleString()}`, fontSize: 10, fontWeight: 'bold', color: COLORS.profit, backgroundColor: COLORS.bgTertiary, padding: [2, 6], borderRadius: 2 }
      });
      if (minIndex !== maxIndex) {
        markPoints.push({
          coord: [minIndex, data[minIndex].value], symbol: 'circle', symbolSize: 10,
          itemStyle: { color: COLORS.loss, borderColor: COLORS.bgSecondary, borderWidth: 2 },
          label: { show: true, position: 'bottom', formatter: `$${data[minIndex].value.toLocaleString()}`, fontSize: 10, fontWeight: 'bold', color: COLORS.loss, backgroundColor: COLORS.bgTertiary, padding: [2, 6], borderRadius: 2 }
        });
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border, borderWidth: 1,
        textStyle: { color: COLORS.textPrimary, fontFamily: 'JetBrains Mono, monospace' },
        formatter: (params) => {
          const p = params[0];
          const trade = data[p.dataIndex];
          return `<div style="font-size:11px;color:${COLORS.textSecondary};margin-bottom:4px">${p.name}</div>
            <div style="font-size:18px;font-weight:700;color:${p.value >= 0 ? COLORS.profit : COLORS.loss}">
              ${p.value >= 0 ? '+' : ''}$${Math.abs(p.value).toLocaleString()}
            </div>
            <div style="font-size:11px;color:${trade.pnl >= 0 ? COLORS.profit : COLORS.loss};margin-top:4px">
              本笔: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toLocaleString()}
            </div>`;
        },
      },
      grid: { left: '0', right: '60', bottom: '30', top: '20', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.date), axisLine: { lineStyle: { color: COLORS.border } }, axisLabel: { color: COLORS.textTertiary, fontSize: 10, fontFamily: 'JetBrains Mono' }, axisTick: { show: false } },
      yAxis: { type: 'value', position: 'right', axisLine: { show: false }, axisLabel: { color: COLORS.textTertiary, fontSize: 10, fontFamily: 'JetBrains Mono', formatter: v => `$${v}` }, splitLine: { lineStyle: { color: COLORS.border, type: 'dashed' } } },
      series: [{ name: '权益曲线', type: 'line', data: data.map(d => d.value), smooth: 0.3, symbol: 'none', lineStyle: { width: 2, color: lineColor }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: lineColor + '30' }, { offset: 1, color: lineColor + '00' }] } }, markPoint: { data: markPoints } }]
    };
  };

  const getSessionChartOption = () => {
    if (!trades || trades.length === 0) return {};
    const bySession = {};
    trades.forEach(t => { bySession[t.marketSession || '其他'] = (bySession[t.marketSession || '其他'] || 0) + 1; });
    const colors = [COLORS.brand, COLORS.profit, '#8B5CF6', '#EC4899', '#06B6D4'];
    return {
      tooltip: { trigger: 'item', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border },
      series: [{ type: 'pie', radius: ['55%', '80%'], avoidLabelOverlap: false, itemStyle: { borderRadius: 4, borderColor: COLORS.bgSecondary, borderWidth: 2 }, label: { show: false }, data: Object.entries(bySession).map(([name, val], i) => ({ name, value: val, itemStyle: { color: colors[i % colors.length] } })) }]
    };
  };

  const getInstrumentChartOption = () => {
    if (!trades || trades.length === 0) return {};
    const byInstrument = {};
    // 使用净盈亏（扣除手续费）
    trades.forEach(t => { byInstrument[t.instrumentCode] = (byInstrument[t.instrumentCode] || 0) + getNetPnL(t, instruments); });
    const codes = Object.keys(byInstrument).slice(0, 5);
    return {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border },
      grid: { left: '0', right: '60', bottom: '0', top: '10', containLabel: true },
      xAxis: { type: 'value', axisLine: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: codes, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 500 } },
      series: [{ type: 'bar', data: codes.map(c => ({ value: Number(byInstrument[c].toFixed(2)), itemStyle: { color: byInstrument[c] >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [0, 2, 2, 0] } })), barWidth: '50%', label: { show: true, position: 'right', color: COLORS.textSecondary, fontSize: 10, fontFamily: 'JetBrains Mono', formatter: p => `${p.value >= 0 ? '+' : ''}$${p.value.toLocaleString()}` } }]
    };
  };

  // 计算最近7日趋势数据（使用净盈亏）
  const _trendData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const day = dayjs().subtract(i, 'day');
      const dayTrades = trades.filter(t => dayjs(t.openTime).isSame(day, 'day'));
      last7Days.push(dayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0));
    }
    return last7Days;
  }, [trades, instruments]);

  const StatItem = ({ label, value, subValue, trend, prefix = '$' }) => (
    <div className="flex-1 border-l border-[var(--border-primary)] pl-3 md:pl-6 py-1 md:py-2 first:border-l-0 first:pl-0 md:first:border-l md:first:pl-6">
      <div className="text-[10px] md:text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1 md:mb-2 truncate">{label}</div>
      <div className="flex items-baseline gap-1 md:gap-2 flex-wrap">
        <span className="text-lg md:text-2xl font-light tracking-tight text-[var(--text-primary)] font-mono">
          {prefix}{typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
        </span>
        {trend !== undefined && (
          <span className={`text-[9px] md:text-[10px] ${trend >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {subValue && <div className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] mt-1 truncate">{subValue}</div>}
    </div>
  );

  const todayStats = useMemo(() => {
    const todayDate = dayjs().format('YYYY-MM-DD');
    // 使用全部交易数据计算今日表现（不受筛选条件影响）
    // 使用交易日逻辑：今日交易日的交易
    const todayTrades = allTrades.filter(t => getTradingDate(t.openTime) === todayDate);
    // 使用净盈亏（扣除手续费）
    const pnl = todayTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
    const wins = todayTrades.filter(t => getNetPnL(t, instruments) > 0).length;
    return { pnl, wins, losses: todayTrades.length - wins, winRate: todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0 };
  }, [allTrades, instruments]);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-8">
        <div className="h-6 md:h-8 w-32 md:w-48 bg-[var(--bg-tertiary)] animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 md:h-24 bg-[var(--bg-tertiary)] animate-pulse rounded" />)}
        </div>
        <div className="h-[300px] md:h-[400px] bg-[var(--bg-tertiary)] animate-pulse rounded" />
      </div>
    );
  }

  if (trades.length === 0 && !quickFilter && selectedInstrument === 'ALL' && !dateRange) {
    return <EmptyState type="new-user" onAction={onNavigateToImport} />;
  }

  if (trades.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <QuickFilterTags quickFilter={quickFilter} setQuickFilter={setQuickFilter} />
        </div>
        <EmptyState type="no-filter-result" filterText={getFilterDescription()} onAction={clearFilters} />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-6">
      
      {/* 🚀 交易指挥中心 (Command Center) */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg md:rounded-xl p-4 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--color-brand)] opacity-[0.03] blur-[120px] -mr-48 -mt-48 pointer-events-none hidden md:block" />
        
        <div className="relative z-10 flex flex-col gap-6 md:gap-12 lg:flex-row lg:items-center justify-between">
          
          {/* 左侧：身份与金句 */}
          <div className="flex-shrink-0">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2 md:mb-3">
              {traderName ? (
                <h1 className="text-xl md:text-3xl font-light tracking-tight text-[var(--text-primary)]">
                  {traderName}
                </h1>
              ) : (
                <div 
                  className="group flex items-center gap-2 cursor-pointer"
                  onClick={() => onNavigate && onNavigate('settings')}
                >
                  <h1 className="text-xl md:text-3xl font-light tracking-tight text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors">
                    设置您的名称
                  </h1>
                  <span className="text-xs text-[var(--color-brand)] opacity-0 group-hover:opacity-100 transition-opacity">
                    点击设置 →
                  </span>
                </div>
              )}
              <div className="px-2 py-0.5 bg-[var(--color-brand-bg)] border border-[var(--color-brand)] rounded text-[8px] md:text-[9px] font-bold text-[var(--color-brand)]">
                {currentLevel.name}
              </div>
            </div>
            <div className="text-[10px] md:text-[11px] text-[var(--text-tertiary)] font-light flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[var(--color-brand)] animate-pulse flex-shrink-0" />
              <span className="italic line-clamp-1">"{quote}"</span>
            </div>
          </div>

          {/* 中间：职业生涯进度 - 移动端隐藏 */}
          <div className="hidden md:block flex-grow max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.2em] font-medium">Career Roadmap</span>
              <span className="text-[10px] text-[var(--color-brand)] font-mono">
                {nextLevel ? `NEXT: ${nextLevel.name} / 还需 ${(nextLevel.minTrades - (stats?.totalTrades || 0)).toLocaleString()} 笔` : 'MAX LEVEL ACHIEVED'}
              </span>
            </div>
            
            <div className="relative px-2">
              <div className="h-[1px] w-full bg-[var(--border-primary)] absolute top-1/2 -translate-y-1/2" />
              <div className="h-[1px] bg-[var(--color-brand)] absolute top-1/2 -translate-y-1/2 transition-all duration-1000 shadow-[0_0_8px_var(--color-brand)]" style={{ width: `${progress}%` }} />
              <div className="relative flex justify-between">
                {TRADER_LEVELS.map((lv) => {
                  const isReached = currentLevel.level >= lv.level;
                  return (
                    <div key={lv.level} className="relative flex flex-col items-center">
                      <div className={`w-1.5 h-1.5 rounded-full border transition-all duration-500 z-10 ${isReached ? 'bg-[var(--color-brand)] border-[var(--color-brand)] scale-125 shadow-[0_0_8px_var(--color-brand)]' : 'bg-[var(--bg-primary)] border-[var(--border-primary)]'}`} />
                      <span className={`absolute -top-5 text-[9px] font-mono transition-colors ${isReached ? 'text-[var(--color-brand)] font-bold' : 'text-[var(--text-tertiary)]'}`}>{lv.icon}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：风险状态条 */}
          <div className="flex-shrink-0 w-full md:w-72 lg:border-l lg:border-[var(--border-primary)] lg:pl-12">
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-3 md:mb-4 font-medium">Risk Management</div>
            <RiskStatusBar trades={trades} instruments={instruments} onNavigate={onNavigate} />
          </div>
        </div>
      </div>

      {/* 1. 顶部控制中枢 */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 md:gap-6 bg-[var(--bg-secondary)]/50 px-3 md:px-6 py-3 rounded-lg border border-[var(--border-primary)]">
        <div className="flex flex-wrap items-center gap-3 md:gap-6 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <FilterOutlined className="text-[var(--text-tertiary)] text-xs" />
            <QuickFilterTags quickFilter={quickFilter} setQuickFilter={setQuickFilter} />
          </div>
          <div className="hidden sm:block h-3 w-px bg-[var(--border-primary)]" />
          <div className="flex items-center gap-2 md:gap-4 flex-wrap">
            <RangePicker size="small" bordered={false} className="text-xs w-full sm:w-44" onChange={setDateRange} />
            <Select size="small" bordered={false} value={selectedInstrument} className="min-w-[100px] text-xs" onChange={setSelectedInstrument} options={[{ value: 'ALL', label: '所有品种' }, ...instruments.map(i => ({ value: i.code, label: i.name }))]} />
          </div>
        </div>
        <button onClick={loadData} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors absolute right-3 top-3 sm:relative sm:right-auto sm:top-auto"><ReloadOutlined style={{ fontSize: 14 }} /></button>
      </div>

      {/* 2. 核心指标矩阵 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 bg-[var(--bg-secondary)] p-4 md:p-6 rounded-lg border border-[var(--border-primary)]">
          <StatItem label="总盈亏" value={stats?.totalPnL || 0} trend={stats?.profitFactor} subValue={`胜率 ${(stats?.winRate || 0).toFixed(1)}%`} />
          <StatItem label="平均盈亏" value={stats?.avgTrade || 0} subValue={`交易 ${stats?.totalTrades || 0} 笔`} />
          <StatItem label="最大浮亏" value={stats?.maxMAE || 0} subValue="单笔风险峰值" />
          <StatItem label="利润因子" prefix="" value={stats?.profitFactor || 0} subValue={`总盈利 $${(stats?.totalProfit || 0).toLocaleString()}`} />
        </div>
        <div className="bg-[var(--bg-secondary)] p-4 md:p-6 rounded-lg border border-[var(--border-primary)] flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-3 md:mb-4">今日表现</div>
            <div className={`text-xl md:text-2xl font-mono font-medium ${todayStats.pnl >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>{todayStats.pnl >= 0 ? '+' : '-'}${Math.abs(todayStats.pnl).toLocaleString()}</div>
          </div>
          <div className="flex justify-between items-end mt-3 md:mt-4">
            <div className="text-[10px] text-[var(--text-tertiary)]">{todayStats.wins}胜 {todayStats.losses}负</div>
            <div className={`text-[10px] px-2 py-0.5 rounded ${todayStats.pnl >= 0 ? 'bg-[var(--color-profit-bg)] text-[var(--color-profit)]' : 'bg-[var(--color-loss-bg)] text-[var(--color-loss)]'}`}>胜率 {todayStats.winRate.toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* 3. 图表与分析区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-[var(--bg-secondary)] p-4 md:p-6 rounded-lg border border-[var(--border-primary)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
            <div className="text-[10px] md:text-[11px] text-[var(--text-tertiary)] uppercase tracking-widest">权益曲线分析</div>
            <div className="flex gap-1 bg-[var(--bg-tertiary)] p-0.5 rounded">
              {['week', 'month', 'all'].map(p => (
                <button key={p} onClick={() => setChartPeriod(p)} className={`px-2 md:px-3 py-1 text-[9px] md:text-[10px] rounded transition-all ${chartPeriod === p ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>{p === 'week' ? '周' : p === 'month' ? '月' : '全部'}</button>
              ))}
            </div>
          </div>
          <ReactECharts option={getPnLChartOption()} style={{ height: '240px' }} className="md:!h-[320px]" notMerge={true} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
          <div className="bg-[var(--bg-secondary)] p-4 md:p-6 rounded-lg border border-[var(--border-primary)]">
            <div className="text-[10px] md:text-[11px] text-[var(--text-tertiary)] uppercase tracking-widest mb-4 md:mb-6">时段分布</div>
            <div className="h-[140px] md:h-[180px]"><ReactECharts option={getSessionChartOption()} style={{ height: '100%' }} /></div>
          </div>
          <div className="bg-[var(--bg-secondary)] p-4 md:p-6 rounded-lg border border-[var(--border-primary)]">
            <div className="text-[10px] md:text-[11px] text-[var(--text-tertiary)] uppercase tracking-widest mb-4 md:mb-6">品种表现</div>
            <div className="h-[140px] md:h-[180px]"><ReactECharts option={getInstrumentChartOption()} style={{ height: '100%' }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
