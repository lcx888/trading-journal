import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, Select, DatePicker, Tag } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  FallOutlined,
  RiseOutlined,
  BarChartOutlined,
  FieldTimeOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import StorageService from '../services/storage';

const { RangePicker } = DatePicker;

const Dashboard = ({ activeRecordId = 'all' }) => {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState('ALL');
  const [dateRange, setDateRange] = useState(null);
  const [instruments, setInstruments] = useState([]);

  // TradingView Colors
  const COLORS = {
    profit: '#26a69a',
    loss: '#ef5350',
    primary: '#2962ff',
    bg: '#ffffff',
    text: '#131722',
    textLight: '#787b86',
    border: '#e0e3eb',
    grid: '#f0f3fa'
  };

  useEffect(() => {
    loadData();
  }, [selectedInstrument, dateRange, activeRecordId]);

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

  // TradingView Style Area Chart
  const getPnLChartOption = () => {
    if (!trades || trades.length === 0) return {};

    let cumulative = 0;
    const data = trades.map((trade) => {
      cumulative += trade.pnl || 0;
      return {
        date: dayjs(trade.openTime).format('MM/DD HH:mm'),
        value: Number(cumulative.toFixed(2)),
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: COLORS.border,
        borderWidth: 1,
        textStyle: { color: COLORS.text },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 4px;',
        formatter: (params) => {
          const p = params[0];
          return `<div style="padding:4px">
            <div style="font-size:12px;color:${COLORS.textLight};margin-bottom:4px">${p.name}</div>
            <div style="font-size:14px;font-weight:bold;color:${p.value >= 0 ? COLORS.profit : COLORS.loss}">
              ${p.value >= 0 ? '+' : ''}${p.value.toLocaleString()} 美元
            </div>
          </div>`;
        }
      },
      grid: { left: '20', right: '20', bottom: '10', top: '40', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(d => d.date),
        axisLine: { lineStyle: { color: COLORS.border } },
        axisLabel: { color: COLORS.textLight, fontSize: 10 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        position: 'right', // TradingView style
        axisLine: { show: false },
        axisLabel: { color: COLORS.textLight, fontSize: 10 },
        splitLine: { lineStyle: { color: COLORS.grid } },
      },
      series: [{
        name: '权益曲线',
        type: 'line',
        data: data.map(d => d.value),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: COLORS.primary },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(41, 98, 255, 0.2)' },
              { offset: 1, color: 'rgba(41, 98, 255, 0)' }
            ]
          }
        }
      }]
    };
  };

  const getInstrumentChartOption = () => {
    if (!trades || trades.length === 0) return {};
    const byInstrument = {};
    trades.forEach(t => {
      byInstrument[t.instrumentCode] = (byInstrument[t.instrumentCode] || 0) + (t.pnl || 0);
    });
    const codes = Object.keys(byInstrument);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '10', right: '10', bottom: '10', top: '30', containLabel: true },
      xAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid } } },
      yAxis: { type: 'category', data: codes, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar',
        data: codes.map(c => ({
          value: Number(byInstrument[c].toFixed(2)),
          itemStyle: { color: byInstrument[c] >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [0, 4, 4, 0] }
        })),
        barWidth: '60%'
      }]
    };
  };

  const getSessionChartOption = () => {
    if (!trades || trades.length === 0) return {};
    const bySession = {};
    trades.forEach(t => {
      const s = t.marketSession || '未知';
      bySession[s] = (bySession[s] || 0) + 1;
    });
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['60%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: Object.entries(bySession).map(([name, val]) => ({ name, value: val }))
      }]
    };
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Spin size="large" /></div>;

  return (
    <div className="space-y-6 animate-in">
      {/* TradingView Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GlobalOutlined className="text-blue-500" />
            <Select
              value={selectedInstrument}
              onChange={setSelectedInstrument}
              style={{ width: 140 }}
              variant="borderless"
              className="font-bold"
              options={[{ value: 'ALL', label: '全部品种' }, ...instruments.map(i => ({ value: i.code, label: i.code }))]}
            />
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <RangePicker value={dateRange} onChange={setDateRange} variant="borderless" className="font-medium" />
        </div>
        <div className="flex items-center gap-3">
          <Tag className="rounded-full px-3 py-1 bg-slate-100 border-none text-slate-600 font-bold text-[10px] tracking-wider">
            {trades.length} 笔交易
          </Tag>
        </div>
      </div>

      {/* Stats Widgets */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="modern-card p-5 bg-white">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">净利润</div>
            <div className={`text-2xl font-bold stat-value ${stats?.totalPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
              {stats?.totalPnL >= 0 ? '+' : ''}{stats?.totalPnL?.toLocaleString()}
              <span className="text-xs font-normal opacity-60 ml-1">美元</span>
            </div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-slate-400">
              <ArrowUpOutlined className="mr-1" /> 账户表现
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="modern-card p-5 bg-white">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">胜率</div>
            <div className="text-2xl font-bold stat-value text-[#131722]">
              {stats?.winRate || 0}%
            </div>
            <div className="mt-2 flex items-center text-[10px] font-bold">
              <span className="text-green-500 mr-2">{stats?.winCount} 胜</span>
              <span className="text-red-400">{stats?.lossCount} 负</span>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="modern-card p-5 bg-white">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">利润因子</div>
            <div className="text-2xl font-bold stat-value text-[#2962ff]">
              {stats?.profitFactor?.toFixed(2) || 0}
            </div>
            <div className="mt-2 text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
              效率评分
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="modern-card p-5 bg-white border-l-4 border-red-500">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">最大回撤</div>
            <div className="text-2xl font-bold stat-value text-red-400">
              -{stats?.maxDrawdown?.toLocaleString()}
            </div>
            <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase">风险暴露</div>
          </div>
        </Col>
      </Row>

      {/* Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card 
            title={<span className="text-xs font-bold uppercase tracking-widest text-slate-500">权益曲线</span>}
            className="modern-card h-full"
            variant="borderless"
            extra={<Tag color="blue" className="rounded-full border-none">主图</Tag>}
          >
            <ReactECharts option={getPnLChartOption()} style={{ height: '400px' }} notMerge={true} />
          </Card>
        </div>
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card 
            title={<span className="text-xs font-bold uppercase tracking-widest text-slate-500">时段分布</span>}
            className="modern-card flex-1"
            variant="borderless"
          >
            <ReactECharts option={getSessionChartOption()} style={{ height: '180px' }} />
          </Card>
          <Card 
            title={<span className="text-xs font-bold uppercase tracking-widest text-slate-500">品种表现</span>}
            className="modern-card flex-1"
            variant="borderless"
          >
            <ReactECharts option={getInstrumentChartOption()} style={{ height: '180px' }} />
          </Card>
        </div>
      </div>

      {/* Trading Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="modern-card p-6 bg-[#f0f9f8] border-none">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#26a69a] text-white flex items-center justify-center font-bold">多</div>
            <span className="font-bold text-[#26a69a] text-lg">多头持仓概览</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">交易笔数</div>
              <div className="text-xl font-bold text-slate-700">{stats?.longStats.count}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">净结果</div>
              <div className="text-xl font-bold text-[#26a69a]">{stats?.longStats.pnl >= 0 ? '+' : ''}{stats?.longStats.pnl}</div>
            </div>
          </div>
        </div>

        <div className="modern-card p-6 bg-[#fff5f5] border-none">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#ef5350] text-white flex items-center justify-center font-bold">空</div>
            <span className="font-bold text-[#ef5350] text-lg">空头持仓概览</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">交易笔数</div>
              <div className="text-xl font-bold text-slate-700">{stats?.shortStats.count}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">净结果</div>
              <div className="text-xl font-bold text-[#ef5350]">{stats?.shortStats.pnl >= 0 ? '+' : ''}{stats?.shortStats.pnl}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
