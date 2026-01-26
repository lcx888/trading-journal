import { useState, useEffect, useMemo } from 'react';
import { Spin, Select, DatePicker, Tag, Button, Skeleton } from 'antd';
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
import { SubscriptionCard } from '../components/UpgradePrompt';

const { RangePicker } = DatePicker;

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

const Dashboard = ({ activeRecordId = 'all', onNavigateToImport, subscription, onUpgrade }) => {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState('ALL');
  const [dateRange, setDateRange] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('all');
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [quickFilter, setQuickFilter] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedInstrument, dateRange, activeRecordId, quickFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allTrades, instrumentList] = await Promise.all([
        StorageService.getAllTrades(),
        StorageService.getInstruments(),
      ]);

      setInstruments(instrumentList);
      let filteredTrades = allTrades;
      
      if (activeRecordId !== 'all') {
        filteredTrades = filteredTrades.filter(t => t.recordId === activeRecordId);
      }
      
      if (selectedInstrument !== 'ALL') {
        filteredTrades = filteredTrades.filter(t => t.instrumentCode === selectedInstrument);
      }
      
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day').toDate();
        const end = dateRange[1].endOf('day').toDate();
        filteredTrades = filteredTrades.filter(t => {
          const tradeDate = new Date(t.openTime);
          return tradeDate >= start && tradeDate <= end;
        });
      }
      
      if (quickFilter) {
        const today = dayjs().startOf('day');
        switch (quickFilter) {
          case 'today':
            filteredTrades = filteredTrades.filter(t => dayjs(t.openTime).isAfter(today));
            break;
          case 'week':
            filteredTrades = filteredTrades.filter(t => dayjs(t.openTime).isAfter(dayjs().startOf('week')));
            break;
          case 'month':
            filteredTrades = filteredTrades.filter(t => dayjs(t.openTime).isAfter(dayjs().startOf('month')));
            break;
          case 'profit':
            filteredTrades = filteredTrades.filter(t => (t.pnl || 0) > 0);
            break;
          case 'loss':
            filteredTrades = filteredTrades.filter(t => (t.pnl || 0) < 0);
            break;
        }
      }

      filteredTrades.sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
      setTrades(filteredTrades);
      const calculatedStats = await StorageService.calculateStats(filteredTrades);
      setStats(calculatedStats);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算今日统计
  const todayStats = useMemo(() => {
    const today = dayjs().startOf('day');
    const todayTrades = trades.filter(t => dayjs(t.openTime).isAfter(today));
    const pnl = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = todayTrades.filter(t => t.pnl > 0).length;
    const losses = todayTrades.filter(t => t.pnl < 0).length;
    const winRate = todayTrades.length > 0 ? (wins / todayTrades.length * 100) : 0;
    
    const yesterday = dayjs().subtract(1, 'day').startOf('day');
    const yesterdayEnd = dayjs().subtract(1, 'day').endOf('day');
    const yesterdayTrades = trades.filter(t => {
      const d = dayjs(t.openTime);
      return d.isAfter(yesterday) && d.isBefore(yesterdayEnd);
    });
    const yesterdayPnl = yesterdayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const pnlChange = yesterdayPnl !== 0 ? ((pnl - yesterdayPnl) / Math.abs(yesterdayPnl) * 100) : 0;
    
    return { count: todayTrades.length, pnl, wins, losses, winRate, yesterdayPnl, pnlChange };
  }, [trades]);

  // AI 洞察生成
  const aiInsight = useMemo(() => {
    if (todayStats.count === 0) {
      return { text: "今日暂无交易记录。保持良好的交易纪律。", type: 'neutral' };
    }
    
    if (todayStats.winRate >= 70) {
      return { text: `今日胜率 ${todayStats.winRate.toFixed(0)}%，表现优秀！建议保持策略。`, type: 'positive' };
    } else if (todayStats.winRate >= 50) {
      return { text: `今日胜率 ${todayStats.winRate.toFixed(0)}%，表现稳定。可复盘亏损单寻找优化空间。`, type: 'positive' };
    } else {
      return { text: `今日胜率 ${todayStats.winRate.toFixed(0)}%，建议暂停交易并分析问题。`, type: 'negative' };
    }
  }, [todayStats]);

  const getFilterDescription = () => {
    const parts = [];
    if (selectedInstrument !== 'ALL') parts.push(selectedInstrument);
    if (dateRange && dateRange[0]) parts.push(`${dateRange[0].format('MM/DD')}-${dateRange[1].format('MM/DD')}`);
    if (quickFilter) {
      const labels = { today: '今日', week: '本周', month: '本月', profit: '盈利', loss: '亏损' };
      parts.push(labels[quickFilter]);
    }
    return parts.join(' · ');
  };

  const clearFilters = () => {
    setSelectedInstrument('ALL');
    setDateRange(null);
    setQuickFilter(null);
  };

  // 权益曲线图表 - 币安风格
  const getPnLChartOption = () => {
    if (!trades || trades.length === 0) return {};

    let cumulative = 0;
    let maxValue = -Infinity;
    let minValue = Infinity;
    let maxIndex = 0;
    let minIndex = 0;
    
    const data = trades.map((trade, index) => {
      cumulative += trade.pnl || 0;
      if (cumulative > maxValue) { maxValue = cumulative; maxIndex = index; }
      if (cumulative < minValue) { minValue = cumulative; minIndex = index; }
      return {
        date: dayjs(trade.openTime).format('MM/DD HH:mm'),
        value: Number(cumulative.toFixed(2)),
        pnl: trade.pnl || 0,
      };
    });

    const isProfit = cumulative >= 0;
    const lineColor = isProfit ? COLORS.profit : COLORS.loss;

    const markPoints = [];
    if (data.length > 3) {
      markPoints.push({
        coord: [maxIndex, data[maxIndex].value],
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: { color: COLORS.profit, borderColor: COLORS.bgSecondary, borderWidth: 2 },
        label: {
          show: true, position: 'top',
          formatter: `$${data[maxIndex].value.toLocaleString()}`,
          fontSize: 10, fontWeight: 'bold', color: COLORS.profit,
          backgroundColor: COLORS.bgTertiary, padding: [2, 6], borderRadius: 2,
        }
      });
      if (minIndex !== maxIndex) {
        markPoints.push({
          coord: [minIndex, data[minIndex].value],
          symbol: 'circle',
          symbolSize: 10,
          itemStyle: { color: COLORS.loss, borderColor: COLORS.bgSecondary, borderWidth: 2 },
          label: {
            show: true, position: 'bottom',
            formatter: `$${data[minIndex].value.toLocaleString()}`,
            fontSize: 10, fontWeight: 'bold', color: COLORS.loss,
            backgroundColor: COLORS.bgTertiary, padding: [2, 6], borderRadius: 2,
          }
        });
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: COLORS.bgSecondary,
        borderColor: COLORS.border,
        borderWidth: 1,
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
      xAxis: {
        type: 'category',
        data: data.map(d => d.date),
        axisLine: { lineStyle: { color: COLORS.border } },
        axisLabel: { color: COLORS.textTertiary, fontSize: 10, fontFamily: 'JetBrains Mono' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        position: 'right',
        axisLine: { show: false },
        axisLabel: { color: COLORS.textTertiary, fontSize: 10, fontFamily: 'JetBrains Mono', formatter: v => `$${v}` },
        splitLine: { lineStyle: { color: COLORS.border, type: 'dashed' } },
      },
      series: [{
        name: '权益曲线',
        type: 'line',
        data: data.map(d => d.value),
        smooth: 0.3,
        symbol: 'none',
        lineStyle: { width: 2, color: lineColor },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: lineColor + '30' },
              { offset: 1, color: lineColor + '00' }
            ]
          }
        },
        markPoint: { data: markPoints }
      }]
    };
  };

  // 时段分布图表
  const getSessionChartOption = () => {
    if (!trades || trades.length === 0) return {};
    const bySession = {};
    trades.forEach(t => { bySession[t.marketSession || '其他'] = (bySession[t.marketSession || '其他'] || 0) + 1; });
    const colors = [COLORS.brand, COLORS.profit, '#8B5CF6', '#EC4899', '#06B6D4'];
    
    return {
      tooltip: { trigger: 'item', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border },
      series: [{
        type: 'pie',
        radius: ['55%', '80%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: COLORS.bgSecondary, borderWidth: 2 },
        label: { show: false },
        data: Object.entries(bySession).map(([name, val], i) => ({ 
          name, value: val, itemStyle: { color: colors[i % colors.length] }
        }))
      }]
    };
  };

  // 品种表现图表
  const getInstrumentChartOption = () => {
    if (!trades || trades.length === 0) return {};
    const byInstrument = {};
    trades.forEach(t => { byInstrument[t.instrumentCode] = (byInstrument[t.instrumentCode] || 0) + (t.pnl || 0); });
    const codes = Object.keys(byInstrument).slice(0, 5);
    
    return {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.bgSecondary, borderColor: COLORS.border },
      grid: { left: '0', right: '60', bottom: '0', top: '10', containLabel: true },
      xAxis: { type: 'value', axisLine: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { 
        type: 'category', data: codes, 
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 500 },
      },
      series: [{
        type: 'bar',
        data: codes.map(c => ({
          value: Number(byInstrument[c].toFixed(2)),
          itemStyle: { color: byInstrument[c] >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [0, 2, 2, 0] }
        })),
        barWidth: '50%',
        label: {
          show: true, position: 'right', color: COLORS.textSecondary,
          fontSize: 10, fontFamily: 'JetBrains Mono',
          formatter: p => `${p.value >= 0 ? '+' : ''}$${p.value.toLocaleString()}`
        }
      }]
    };
  };

  // Mini Sparkline
  const getSparklineOption = (data, color) => ({
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line', data, smooth: true, symbol: 'none',
      lineStyle: { width: 2, color },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '40' }, { offset: 1, color: color + '00' }] } }
    }]
  });

  const trendData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const day = dayjs().subtract(i, 'day');
      const dayTrades = trades.filter(t => dayjs(t.openTime).isSame(day, 'day'));
      last7Days.push(dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    }
    return last7Days;
  }, [trades]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-6"><Skeleton active paragraph={{ rows: 3 }} /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="card p-4"><Skeleton active paragraph={{ rows: 1 }} /></div>)}
        </div>
        <div className="card p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>
      </div>
    );
  }

  if (trades.length === 0 && !quickFilter && selectedInstrument === 'ALL' && !dateRange) {
    return <EmptyState type="new-user" onAction={onNavigateToImport} />;
  }

  if (trades.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card p-4"><QuickFilterTags quickFilter={quickFilter} setQuickFilter={setQuickFilter} /></div>
        <EmptyState type="no-filter-result" filterText={getFilterDescription()} onAction={clearFilters} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 今日成绩单 */}
      <div className="card p-0 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-[var(--color-brand)] flex items-center justify-center">
                <CalendarOutlined className="text-[#0a0a0c] text-lg" />
              </div>
              <div>
                <div className="text-base font-semibold text-[var(--text-primary)]">今日成绩单</div>
                <div className="text-xs text-[var(--text-tertiary)]">{dayjs().format('YYYY-MM-DD dddd')}</div>
              </div>
            </div>
            {todayStats.count > 0 && (
              <div className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                todayStats.pnl >= 0 ? 'bg-[var(--color-profit-bg)] text-[var(--color-profit)]' : 'bg-[var(--color-loss-bg)] text-[var(--color-loss)]'
              }`}>
                {todayStats.pnl >= 0 ? <TrophyOutlined /> : <FireOutlined />}
                {todayStats.pnl >= 0 ? '盈利日' : '亏损日'}
              </div>
            )}
          </div>
          
          {todayStats.count > 0 ? (
            <>
              <div className="text-center mb-6">
                <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">今日盈亏</div>
                <div className={`text-4xl font-bold font-mono ${todayStats.pnl >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                  <AnimatedNumber value={Math.abs(todayStats.pnl)} prefix={todayStats.pnl >= 0 ? '+$' : '-$'} duration={800} />
                </div>
                {todayStats.yesterdayPnl !== 0 && (
                  <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                    todayStats.pnlChange >= 0 ? 'bg-[var(--color-profit-bg)] text-[var(--color-profit)]' : 'bg-[var(--color-loss-bg)] text-[var(--color-loss)]'
                  }`}>
                    {todayStats.pnlChange >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    较昨日 {todayStats.pnlChange >= 0 ? '+' : ''}{todayStats.pnlChange.toFixed(0)}%
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">胜</div>
                  <div className="text-xl font-bold font-mono text-[var(--color-profit)]">{todayStats.wins}</div>
                </div>
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">负</div>
                  <div className="text-xl font-bold font-mono text-[var(--color-loss)]">{todayStats.losses}</div>
                </div>
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">胜率</div>
                  <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                    <AnimatedNumber value={todayStats.winRate} suffix="%" decimals={0} duration={600} />
                  </div>
                </div>
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">交易</div>
                  <div className="text-xl font-bold font-mono text-[var(--color-brand)]">{todayStats.count}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <CalendarOutlined className="text-4xl text-[var(--text-tertiary)] mb-3" />
              <div className="text-sm text-[var(--text-secondary)]">今日暂无交易</div>
            </div>
          )}
        </div>
        
        {/* AI 洞察 */}
        <div className={`px-5 py-3 border-t border-[var(--border-primary)] flex items-center gap-3 ${
          aiInsight.type === 'positive' ? 'bg-[var(--color-profit-bg)]' : aiInsight.type === 'negative' ? 'bg-[var(--color-loss-bg)]' : 'bg-[var(--color-brand-bg)]'
        }`}>
          <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
            aiInsight.type === 'positive' ? 'bg-[var(--color-profit)]' : aiInsight.type === 'negative' ? 'bg-[var(--color-loss)]' : 'bg-[var(--color-brand)]'
          }`}>
            <RobotOutlined className="text-[#0a0a0c] text-sm" />
          </div>
          <div className="flex-1 text-sm text-[var(--text-primary)]">{aiInsight.text}</div>
          <Button type="text" size="small" icon={<RightOutlined />} className="text-[var(--text-secondary)]">详情</Button>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mr-2">
              <FilterOutlined className="mr-1" />筛选
            </span>
            <QuickFilterTags quickFilter={quickFilter} setQuickFilter={setQuickFilter} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={selectedInstrument}
              onChange={setSelectedInstrument}
              style={{ width: 120 }}
              size="small"
              options={[{ value: 'ALL', label: '全部品种' }, ...instruments.map(i => ({ value: i.code, label: i.code }))]}
            />
            <RangePicker value={dateRange} onChange={setDateRange} size="small" placeholder={['开始', '结束']} />
            {(selectedInstrument !== 'ALL' || dateRange || quickFilter) && (
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={clearFilters} className="text-[var(--text-tertiary)]">重置</Button>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--border-primary)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[var(--color-brand-bg)] text-[var(--color-brand)] font-semibold">{trades.length} 笔</span>
            {getFilterDescription() && <span className="text-[var(--text-tertiary)]">{getFilterDescription()}</span>}
          </div>
          <div className="text-[var(--text-tertiary)]">
            总盈亏: <span className={`font-bold font-mono ${stats?.totalPnL >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
              {stats?.totalPnL >= 0 ? '+' : ''}${stats?.totalPnL?.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChartOutlined className="text-[var(--color-brand)]" />
            <span className="font-semibold text-[var(--text-primary)]">核心指标</span>
          </div>
          <Button type="text" size="small" onClick={() => setShowDetailedStats(!showDetailedStats)} icon={showDetailedStats ? <UpOutlined /> : <DownOutlined />} className="text-[var(--text-tertiary)]">
            {showDetailedStats ? '收起' : '展开'}
          </Button>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 净利润 */}
          <div className="p-4 rounded bg-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-tertiary)] uppercase">净利润</span>
              <div className={`w-5 h-5 rounded flex items-center justify-center ${stats?.totalPnL >= 0 ? 'bg-[var(--color-profit-bg)]' : 'bg-[var(--color-loss-bg)]'}`}>
                {stats?.totalPnL >= 0 ? <ArrowUpOutlined className="text-[var(--color-profit)] text-xs" /> : <ArrowDownOutlined className="text-[var(--color-loss)] text-xs" />}
              </div>
            </div>
            <div className={`text-xl font-bold font-mono mb-2 ${stats?.totalPnL >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
              <AnimatedNumber value={stats?.totalPnL || 0} prefix="$" colorByValue duration={800} />
            </div>
            <div className="h-6">
              <ReactECharts option={getSparklineOption(trendData, stats?.totalPnL >= 0 ? COLORS.profit : COLORS.loss)} style={{ height: '100%' }} opts={{ renderer: 'svg' }} />
            </div>
          </div>
          
          {/* 胜率 */}
          <div className="p-4 rounded bg-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-tertiary)] uppercase">胜率</span>
              <div className="w-5 h-5 rounded bg-[var(--color-brand-bg)] flex items-center justify-center">
                <AimOutlined className="text-[var(--color-brand)] text-xs" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-[var(--text-primary)] mb-2">
              <AnimatedNumber value={stats?.winRate || 0} suffix="%" decimals={1} duration={600} />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-profit)]">{stats?.winCount}胜</span>
              <span className="text-[var(--text-tertiary)]">/</span>
              <span className="text-[var(--color-loss)]">{stats?.lossCount}负</span>
            </div>
          </div>
          
          {/* 利润因子 */}
          <div className="p-4 rounded bg-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-tertiary)] uppercase">利润因子</span>
              <div className="w-5 h-5 rounded bg-[var(--color-brand-bg)] flex items-center justify-center">
                <ThunderboltOutlined className="text-[var(--color-brand)] text-xs" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-[var(--color-brand)] mb-2">
              {stats?.profitFactor === Infinity ? '∞' : <AnimatedNumber value={stats?.profitFactor || 0} decimals={2} duration={600} />}
            </div>
            <Tag className={`text-xs ${stats?.profitFactor >= 1.5 ? 'bg-[var(--color-profit-bg)] text-[var(--color-profit)]' : stats?.profitFactor >= 1 ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand)]' : 'bg-[var(--color-loss-bg)] text-[var(--color-loss)]'}`}>
              {stats?.profitFactor >= 2 ? '优秀' : stats?.profitFactor >= 1.5 ? '良好' : stats?.profitFactor >= 1 ? '一般' : '需改进'}
            </Tag>
          </div>
          
          {/* 最大回撤 */}
          <div className="p-4 rounded bg-[var(--bg-tertiary)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-tertiary)] uppercase">最大回撤</span>
              <div className="w-5 h-5 rounded bg-[var(--color-loss-bg)] flex items-center justify-center">
                <FireOutlined className="text-[var(--color-loss)] text-xs" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-[var(--color-loss)] mb-2">
              -<AnimatedNumber value={Math.abs(stats?.maxDrawdown || 0)} prefix="$" duration={600} />
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">风险指标</div>
          </div>
        </div>
        
        {showDetailedStats && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)] grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fadeIn">
            {[
              { label: '总盈利', value: `+$${stats?.totalProfit?.toLocaleString() || 0}`, color: 'text-[var(--color-profit)]' },
              { label: '总亏损', value: `-$${Math.abs(stats?.totalLoss || 0).toLocaleString()}`, color: 'text-[var(--color-loss)]' },
              { label: '平均盈利', value: `+$${stats?.avgProfitPerWinningTrade?.toLocaleString() || 0}`, color: 'text-[var(--color-profit)]' },
              { label: '平均亏损', value: `-$${Math.abs(stats?.avgLossPerLosingTrade || 0).toLocaleString()}`, color: 'text-[var(--color-loss)]' },
              { label: '盈亏比', value: stats?.riskRewardRatio?.toFixed(2) || 0, color: 'text-[var(--text-primary)]' },
              { label: '最大单笔盈', value: `+$${stats?.maxWin?.toLocaleString() || 0}`, color: 'text-[var(--color-profit)]' },
              { label: '最大单笔亏', value: `-$${Math.abs(stats?.maxLoss || 0).toLocaleString()}`, color: 'text-[var(--color-loss)]' },
              { label: '平均持仓', value: stats?.avgHoldingTime || '-', color: 'text-[var(--text-primary)]' },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded bg-[var(--bg-primary)]">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">{item.label}</div>
                <div className={`font-bold font-mono ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LineChartOutlined className="text-[var(--color-brand)]" />
              <span className="font-semibold text-[var(--text-primary)]">权益曲线</span>
            </div>
            <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded p-0.5">
              {[{ key: 'week', label: '周' }, { key: 'month', label: '月' }, { key: 'all', label: '全部' }].map(p => (
                <Button key={p.key} type={chartPeriod === p.key ? 'primary' : 'text'} size="small" onClick={() => setChartPeriod(p.key)} className="text-xs">
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <ReactECharts option={getPnLChartOption()} style={{ height: '320px' }} notMerge={true} />
        </div>
        
        <div className="flex flex-col gap-4">
          {/* 订阅状态卡片 */}
          {subscription && (
            <SubscriptionCard 
              subscription={subscription} 
              onUpgrade={onUpgrade}
              onManage={onUpgrade}
            />
          )}
          
          <div className="card p-4 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <ClockCircleOutlined className="text-[var(--color-brand)] text-sm" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">时段分布</span>
            </div>
            <ReactECharts option={getSessionChartOption()} style={{ height: '140px' }} />
          </div>
          <div className="card p-4 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <BarChartOutlined className="text-[var(--color-brand)] text-sm" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">品种表现</span>
            </div>
            <ReactECharts option={getInstrumentChartOption()} style={{ height: '140px' }} />
          </div>
        </div>
      </div>

      {/* 多空概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded bg-[var(--color-profit)] flex items-center justify-center text-[#0a0a0c] font-bold">多</div>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">多头持仓</div>
              <div className="text-xs text-[var(--text-tertiary)]">Long Positions</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[var(--text-tertiary)] mb-1">交易笔数</div>
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                <AnimatedNumber value={stats?.longStats?.count || 0} duration={500} />
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-tertiary)] mb-1">净结果</div>
              <div className={`text-2xl font-bold font-mono ${stats?.longStats?.pnl >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                <AnimatedNumber value={stats?.longStats?.pnl || 0} prefix="$" colorByValue duration={600} />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded bg-[var(--color-loss)] flex items-center justify-center text-white font-bold">空</div>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">空头持仓</div>
              <div className="text-xs text-[var(--text-tertiary)]">Short Positions</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[var(--text-tertiary)] mb-1">交易笔数</div>
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                <AnimatedNumber value={stats?.shortStats?.count || 0} duration={500} />
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-tertiary)] mb-1">净结果</div>
              <div className={`text-2xl font-bold font-mono ${stats?.shortStats?.pnl >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                <AnimatedNumber value={stats?.shortStats?.pnl || 0} prefix="$" colorByValue duration={600} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 快捷筛选标签组件
const QuickFilterTags = ({ quickFilter, setQuickFilter }) => {
  const filters = [
    { key: 'today', label: '今日' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'profit', label: '盈利' },
    { key: 'loss', label: '亏损' },
  ];

  return (
    <div className="flex gap-1 flex-wrap">
      {filters.map(f => (
        <Tag
          key={f.key}
          className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium transition-all border-0 ${
            quickFilter === f.key 
              ? 'bg-[var(--color-brand)] text-[#0a0a0c]' 
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--color-brand)]'
          }`}
          onClick={() => setQuickFilter(quickFilter === f.key ? null : f.key)}
        >
          {f.label}
        </Tag>
      ))}
    </div>
  );
};

export default Dashboard;
