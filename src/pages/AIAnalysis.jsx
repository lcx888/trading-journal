import { useState, useEffect } from 'react';
import { 
  Select, DatePicker, message, Modal, Form, Input, Table, Tag, Alert, 
  Collapse, Divider, Progress
} from 'antd';
import {
  Brain,
  Zap,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Lightbulb,
  Clock,
  BarChart3,
  Calendar,
  Flame,
  LineChart,
  ChevronRight,
  Play,
  Edit3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Shield,
  DollarSign,
  Timer,
  Award,
  MoreHorizontal
} from 'lucide-react';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import StorageService from '../services/storage';
import { generateAIAnalysis } from '../services/aiAnalysis';

const { RangePicker } = DatePicker;
const { Panel } = Collapse;
const { TextArea } = Input;

// 统计卡片组件
const StatCard = ({ title, value, change, isPositive, suffix = '', prefix = '' }) => (
  <div className="group relative p-6 bg-white rounded-2xl transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 hover:border-gray-200/60">
    <div className="flex justify-between items-start mb-4">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {change !== undefined && (
        <span className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
          isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
        }`}>
          {isPositive ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
          {change}
        </span>
      )}
    </div>
    <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
      {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
    </h3>
    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-gray-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
  </div>
);

// 迷你统计卡片
const MiniStatCard = ({ title, value, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

const AIAnalysis = ({ activeRecordId = 'all' }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [filters, setFilters] = useState({
    instrument: 'ALL',
    dateRange: null,
  });
  
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [reviewForm] = Form.useForm();

  const COLORS = {
    profit: '#10b981',
    loss: '#ef4444',
    primary: '#18181b',
    text: '#18181b',
    textLight: '#6b7280',
    border: '#e5e7eb',
    grid: '#f3f4f6',
  };

  useEffect(() => {
    loadInstruments();
    setAnalysis(null);
  }, [activeRecordId]);

  const loadInstruments = async () => {
    const instList = await StorageService.getInstruments();
    setInstruments(instList);
  };

  const openReviewModal = (trade) => {
    setEditingTrade(trade);
    reviewForm.setFieldsValue({
      reviewNotes: trade.notes || '',
      logicAnalysis: trade.logicAnalysis || '',
      expectedTrend: trade.expectedTrend || '',
    });
    setReviewModalVisible(true);
  };

  const handleSaveReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      const allTrades = await StorageService.getAllTrades();
      const updatedTrades = allTrades.map(t => {
        if (t.id === editingTrade.id) {
          return { ...t, notes: values.reviewNotes || '', logicAnalysis: values.logicAnalysis || '', expectedTrend: values.expectedTrend || '' };
        }
        return t;
      });
      
      await StorageService.saveTrades(updatedTrades);
      message.success('复盘说明已保存');
      setReviewModalVisible(false);
      
      if (analysis && analysis.problems) {
        const updatedProblems = analysis.problems.map(problem => {
          if (problem.trades) {
            const updatedProblemTrades = problem.trades.map(t => {
              if (t.id === editingTrade.id) {
                return { ...t, notes: values.reviewNotes || '', logicAnalysis: values.logicAnalysis || '', expectedTrend: values.expectedTrend || '' };
              }
              return t;
            });
            return { ...problem, trades: updatedProblemTrades };
          }
          return problem;
        });
        setAnalysis({ ...analysis, problems: updatedProblems });
      }
    } catch (e) { message.error('保存失败'); }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await generateAIAnalysis({ ...filters, activeRecordId });
      setAnalysis(result);
    } catch (e) { message.error('分析失败'); }
    finally { setLoading(false); }
  };

  // ========== 图表配置 ==========
  const getChartBaseOption = () => ({
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    tooltip: { 
      trigger: 'axis',
      backgroundColor: '#18181b',
      borderColor: '#18181b',
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: { type: 'shadow' }
    },
  });

  const getSessionChartOption = () => {
    if (!analysis?.patterns?.sessionPerformance) return {};
    const data = analysis.patterns.sessionPerformance;
    return {
      ...getChartBaseOption(),
      legend: { bottom: 0, textStyle: { color: COLORS.textLight, fontSize: 11 } },
      xAxis: { 
        type: 'category', 
        data: data.map(d => d.session), 
        axisLine: { show: false }, 
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: COLORS.textLight }
      },
      yAxis: [
        { type: 'value', position: 'right', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid, type: 'dashed' } }, axisLabel: { fontSize: 11, color: COLORS.textLight } },
        { type: 'value', position: 'left', axisLine: { show: false }, axisLabel: { formatter: '{value}%', fontSize: 11, color: COLORS.textLight }, splitLine: { show: false } }
      ],
      series: [
        { 
          name: '盈亏', 
          type: 'bar', 
          data: data.map(d => ({ 
            value: d.totalPnL, 
            itemStyle: { color: d.totalPnL >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [6, 6, 0, 0] } 
          })), 
          barWidth: '50%' 
        },
        { 
          name: '胜率', 
          type: 'line', 
          yAxisIndex: 1, 
          data: data.map(d => d.winRate), 
          lineStyle: { color: '#f59e0b', width: 2 }, 
          itemStyle: { color: '#f59e0b' },
          symbol: 'circle',
          symbolSize: 6
        }
      ]
    };
  };

  const getHoldingTimeChartOption = () => {
    if (!analysis?.holdingAnalysis?.distribution) return {};
    const data = analysis.holdingAnalysis.distribution;
    return {
      ...getChartBaseOption(),
      grid: { ...getChartBaseOption().grid, bottom: '20%' },
      xAxis: { 
        type: 'category', 
        data: data.map(d => d.label), 
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { rotate: 30, fontSize: 10, color: COLORS.textLight }
      },
      yAxis: [
        { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid, type: 'dashed' } }, axisLabel: { fontSize: 11, color: COLORS.textLight } },
        { type: 'value', position: 'right', axisLine: { show: false }, splitLine: { show: false }, axisLabel: { fontSize: 11, color: COLORS.textLight } }
      ],
      series: [
        { name: '笔数', type: 'bar', data: data.map(d => d.count), itemStyle: { color: COLORS.primary, borderRadius: [6, 6, 0, 0] }, barWidth: '50%' },
        { name: '平均盈亏', type: 'line', yAxisIndex: 1, data: data.map(d => d.avgPnL), lineStyle: { color: COLORS.profit, width: 2 }, itemStyle: { color: COLORS.profit } }
      ]
    };
  };

  const getWeekdayChartOption = () => {
    if (!analysis?.frequencyAnalysis?.weekdayData) return {};
    const data = analysis.frequencyAnalysis.weekdayData;
    return {
      ...getChartBaseOption(),
      xAxis: { 
        type: 'category', 
        data: data.map(d => d.dayName), 
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: COLORS.textLight }
      },
      yAxis: { 
        type: 'value', 
        position: 'right', 
        axisLine: { show: false }, 
        splitLine: { lineStyle: { color: COLORS.grid, type: 'dashed' } },
        axisLabel: { fontSize: 11, color: COLORS.textLight }
      },
      series: [{ 
        type: 'bar', 
        data: data.map(d => ({ 
          value: d.totalPnL, 
          itemStyle: { color: d.totalPnL >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [6, 6, 0, 0] } 
        })), 
        barWidth: '60%' 
      }]
    };
  };

  // ========== 加载状态 ==========
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] bg-[#FAFAFA]">
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-t-4 border-gray-900 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className="text-gray-900" size={28} />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">AI 正在分析交易数据</h2>
      <p className="text-gray-500 text-sm">识别模式、评估风险、生成建议...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ========== 顶部控制栏 ========== */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">AI 智能复盘</h1>
              <p className="text-xs text-gray-500">深度分析交易数据，识别问题模式</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
              <Select 
                value={filters.instrument} 
                onChange={(v) => setFilters({ ...filters, instrument: v })} 
                style={{ width: 120 }} 
                variant="borderless"
                className="font-medium text-sm"
                options={[{ value: 'ALL', label: '全部品种' }, ...instruments.map(i => ({ value: i.code, label: i.code }))]} 
              />
            </div>
            <div className="bg-gray-50 px-2 py-1 rounded-xl border border-gray-100">
              <RangePicker 
                value={filters.dateRange} 
                onChange={(v) => setFilters({ ...filters, dateRange: v })} 
                variant="borderless" 
                className="font-medium text-sm"
                allowClear 
                placeholder={['开始日期', '结束日期']} 
              />
            </div>
            <button 
              onClick={handleAnalyze}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
            >
              <Play size={16} className="fill-white" />
              开始分析
            </button>
          </div>
        </div>

        {/* ========== 空状态 ========== */}
        {!analysis && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Brain size={36} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">开始智能分析</h2>
            <p className="text-gray-500 max-w-md mx-auto mb-8">
              AI 将深度分析您的交易数据，自动识别问题模式、评估风险敞口，并提供个性化优化建议
            </p>
            <button 
              onClick={handleAnalyze}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Zap size={18} className="fill-white" />
              立即分析
            </button>
          </div>
        )}

        {analysis && !analysis.success && (
          <Alert message="分析失败" description={analysis.message} type="error" showIcon className="rounded-xl" />
        )}

        {analysis && analysis.success && (
          <div className="space-y-6">
            
            {/* ========== 核心指标 ========== */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="relative p-6 bg-gray-900 rounded-2xl text-white overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">综合评分</span>
                  </div>
                  <div className="text-5xl font-black mb-2" style={{ color: analysis.summary.overallRating.color === 'green' ? '#10b981' : '#f43f5e' }}>
                    {analysis.summary.overallRating.score}
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-medium backdrop-blur-sm">
                    {analysis.summary.overallRating.level}
                  </span>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-blue-500/10 to-transparent"></div>
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-20"></div>
              </div>
              
              <StatCard 
                title="总盈亏" 
                value={analysis.summary.totalPnL} 
                prefix={analysis.summary.totalPnL >= 0 ? '+$' : '$'}
                isPositive={analysis.summary.totalPnL >= 0}
              />
              <StatCard 
                title="胜率" 
                value={analysis.summary.winRate} 
                suffix="%"
              />
              <StatCard 
                title="利润系数" 
                value={analysis.summary.profitFactor === Infinity ? '∞' : analysis.summary.profitFactor.toFixed(2)}
              />
            </div>

            {/* ========== 问题识别 ========== */}
            {analysis.problems && analysis.problems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">问题识别</h2>
                      <p className="text-xs text-gray-500">发现 {analysis.problems.length} 个需要关注的问题</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-semibold">
                    {analysis.problems.length} 个问题
                  </span>
                </div>
                <div className="p-3">
                  <Collapse ghost expandIconPosition="end" className="[&_.ant-collapse-header]:!px-4 [&_.ant-collapse-header]:!py-3 [&_.ant-collapse-content-box]:!p-4">
                    {analysis.problems.map((problem, index) => (
                      <Panel key={index} header={
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <Tag color={problem.severity === 'high' ? 'red' : problem.severity === 'medium' ? 'orange' : 'blue'} className="rounded-full border-none">
                              {problem.severity === 'high' ? '严重' : problem.severity === 'medium' ? '中等' : '轻微'}
                            </Tag>
                            <span className="font-semibold text-gray-900">{problem.type}</span>
                            {problem.trades && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{problem.trades.length} 笔</span>}
                          </div>
                          {problem.totalLoss !== undefined && (
                            <span className="text-rose-600 font-bold text-sm">
                              -${Math.abs(problem.totalLoss).toLocaleString()}
                            </span>
                          )}
                        </div>
                      }>
                        <div className="space-y-4">
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="text-gray-700 text-sm mb-3">{problem.description}</p>
                            <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                              <Lightbulb size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                              <p className="text-blue-700 text-sm"><strong>优化建议：</strong>{problem.recommendation}</p>
                            </div>
                          </div>
                          {problem.trades && problem.trades.length > 0 && (
                            <Table 
                              dataSource={problem.trades.map((t, i) => ({ ...t, key: t.id || i }))} 
                              size="small" 
                              pagination={false}
                              className="[&_.ant-table]:!rounded-xl [&_.ant-table-thead_.ant-table-cell]:!bg-gray-50"
                              columns={[
                                { title: '时间', dataIndex: 'openTime', width: 130, render: t => <span className="text-gray-600 text-xs">{dayjs(t).format('MM-DD HH:mm:ss')}</span> },
                                { title: '品种', dataIndex: 'instrumentCode', width: 70, render: c => <span className="font-medium">{c}</span> },
                                { title: '方向', dataIndex: 'direction', width: 60, render: d => <Tag color={d === 'LONG' ? 'green' : 'red'} className="rounded-full text-xs">{d === 'LONG' ? '多' : '空'}</Tag> },
                                { title: '盈亏', dataIndex: 'pnl', width: 90, align: 'right', render: p => <span className={`font-bold ${p >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{p >= 0 ? '+' : ''}{p?.toFixed(2)}</span> },
                                { title: '持仓', dataIndex: 'holdingSeconds', width: 80, align: 'right', render: s => { if (!s) return '-'; const m = Math.floor(s / 60); const sec = s % 60; return m > 0 ? `${m}分${sec}秒` : `${sec}秒`; } },
                                { title: '', key: 'action', width: 40, render: (_, r) => <button onClick={() => openReviewModal(r)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors"><Edit3 size={14} className="text-gray-400" /></button> }
                              ]} 
                            />
                          )}
                        </div>
                      </Panel>
                    ))}
                  </Collapse>
                </div>
              </div>
            )}

            {/* ========== 优化策略建议 ========== */}
            {analysis.strategies && analysis.strategies.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Lightbulb size={18} />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">优化策略建议</h2>
                    <p className="text-xs text-gray-500">{analysis.strategies.length} 条个性化建议</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {analysis.strategies.map((s, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <Tag color={s.priority === 'high' ? 'red' : s.priority === 'medium' ? 'orange' : 'blue'} className="rounded-full border-none">
                          {s.priority === 'high' ? '高优先级' : s.priority === 'medium' ? '中优先级' : '低优先级'}
                        </Tag>
                        <span className="font-semibold text-gray-900">{s.title}</span>
                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-100">{s.category}</span>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{s.description}</p>
                      <div className="flex gap-3">
                        <div className="flex-1 bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <p className="text-blue-700 text-sm"><strong>行动：</strong>{s.action}</p>
                        </div>
                        {s.expectedImprovement && (
                          <div className="flex-1 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                            <p className="text-emerald-700 text-sm"><strong>预期：</strong>{s.expectedImprovement}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========== 时段表现分析 ========== */}
            {analysis.patterns && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                        <Clock size={18} />
                      </div>
                      <h2 className="font-bold text-gray-900">时段表现</h2>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                  <ReactECharts option={getSessionChartOption()} style={{ height: '280px' }} />
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                        <Timer size={18} />
                      </div>
                      <h2 className="font-bold text-gray-900">持仓时间分布</h2>
                    </div>
                  </div>
                  <ReactECharts option={getHoldingTimeChartOption()} style={{ height: '280px' }} />
                </div>
              </div>
            )}

            {/* ========== 多空对比 ========== */}
            {analysis.patterns?.directionPerformance && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                      <TrendingUp size={18} />
                    </div>
                    <h3 className="font-bold text-gray-900">多头交易</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-900">{analysis.patterns.directionPerformance.LONG.totalTrades}</div>
                      <div className="text-xs text-gray-500 mt-1">交易笔数</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className={`text-2xl font-bold ${analysis.patterns.directionPerformance.LONG.totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {analysis.patterns.directionPerformance.LONG.totalPnL >= 0 ? '+' : ''}{analysis.patterns.directionPerformance.LONG.totalPnL}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">总盈亏</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-900">{analysis.patterns.directionPerformance.LONG.winRate}%</div>
                      <div className="text-xs text-gray-500 mt-1">胜率</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                      <TrendingDown size={18} />
                    </div>
                    <h3 className="font-bold text-gray-900">空头交易</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-900">{analysis.patterns.directionPerformance.SHORT.totalTrades}</div>
                      <div className="text-xs text-gray-500 mt-1">交易笔数</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className={`text-2xl font-bold ${analysis.patterns.directionPerformance.SHORT.totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {analysis.patterns.directionPerformance.SHORT.totalPnL >= 0 ? '+' : ''}{analysis.patterns.directionPerformance.SHORT.totalPnL}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">总盈亏</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-900">{analysis.patterns.directionPerformance.SHORT.winRate}%</div>
                      <div className="text-xs text-gray-500 mt-1">胜率</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== 风险收益指标 ========== */}
            {analysis.riskAnalysis && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <BarChart3 size={18} />
                  </div>
                  <h2 className="font-bold text-gray-900">风险收益指标</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                  <MiniStatCard title="期望值" value={`$${analysis.riskAnalysis.expectancy}`} icon={Target} color={analysis.riskAnalysis.expectancy >= 0 ? 'green' : 'red'} />
                  <MiniStatCard title="盈亏比" value={analysis.riskAnalysis.profitLossRatio.toFixed(2)} icon={Activity} color="blue" />
                  <MiniStatCard title="利润系数" value={analysis.riskAnalysis.profitFactor.toFixed(2)} icon={Award} color="purple" />
                  <MiniStatCard title="夏普比率" value={analysis.riskAnalysis.sharpeRatio.toFixed(2)} icon={LineChart} color="orange" />
                  <MiniStatCard title="波动率" value={`$${analysis.riskAnalysis.standardDeviation}`} icon={Activity} color="blue" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-3">
                      <TrendingUp size={18} />
                      盈利统计
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xl font-bold text-emerald-700">{analysis.riskAnalysis.winningTrades}</div>
                        <div className="text-xs text-emerald-600">盈利笔数</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-emerald-700">${analysis.riskAnalysis.grossProfit}</div>
                        <div className="text-xs text-emerald-600">总盈利</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-emerald-700">${analysis.riskAnalysis.avgProfit}</div>
                        <div className="text-xs text-emerald-600">平均盈利</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-rose-50 p-5 rounded-xl border border-rose-100">
                    <div className="flex items-center gap-2 text-rose-700 font-semibold mb-3">
                      <TrendingDown size={18} />
                      亏损统计
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-xl font-bold text-rose-700">{analysis.riskAnalysis.losingTrades}</div>
                        <div className="text-xs text-rose-600">亏损笔数</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-rose-700">${analysis.riskAnalysis.grossLoss}</div>
                        <div className="text-xs text-rose-600">总亏损</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-rose-700">${analysis.riskAnalysis.avgLoss}</div>
                        <div className="text-xs text-rose-600">平均亏损</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== 连续交易分析 ========== */}
            {analysis.streaksAnalysis && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
                    <Flame size={18} />
                  </div>
                  <h2 className="font-bold text-gray-900">连续交易分析</h2>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 text-center">
                    <TrendingUp className="mx-auto mb-2 text-emerald-600" size={28} />
                    <div className="text-xs text-gray-600 mb-1">最长连续盈利</div>
                    <div className="text-2xl font-bold text-emerald-600">{analysis.streaksAnalysis.maxWinStreak} 笔</div>
                    <div className="text-xs text-emerald-600">+${analysis.streaksAnalysis.maxWinStreakPnL}</div>
                  </div>
                  
                  <div className="bg-rose-50 p-5 rounded-xl border border-rose-100 text-center">
                    <TrendingDown className="mx-auto mb-2 text-rose-600" size={28} />
                    <div className="text-xs text-gray-600 mb-1">最长连续亏损</div>
                    <div className="text-2xl font-bold text-rose-600">{analysis.streaksAnalysis.maxLossStreak} 笔</div>
                    <div className="text-xs text-rose-600">${analysis.streaksAnalysis.maxLossStreakPnL}</div>
                  </div>
                  
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 text-center">
                    <div className="text-xs text-gray-600 mb-2">亏损后交易表现</div>
                    <div className="text-2xl font-bold text-blue-600">{analysis.streaksAnalysis.afterLoss.winRate}%</div>
                    <div className="text-xs text-gray-500">{analysis.streaksAnalysis.afterLoss.count} 笔 | 平均 ${analysis.streaksAnalysis.afterLoss.avgPnL}</div>
                  </div>
                  
                  <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 text-center">
                    <div className="text-xs text-gray-600 mb-2">盈利后交易表现</div>
                    <div className="text-2xl font-bold text-purple-600">{analysis.streaksAnalysis.afterWin.winRate}%</div>
                    <div className="text-xs text-gray-500">{analysis.streaksAnalysis.afterWin.count} 笔 | 平均 ${analysis.streaksAnalysis.afterWin.avgPnL}</div>
                  </div>
                </div>
                
                {analysis.streaksAnalysis.afterLoss.winRate < analysis.streaksAnalysis.afterWin.winRate - 10 && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800">心理提示</p>
                      <p className="text-sm text-amber-700">您在亏损后的交易胜率明显低于盈利后，建议在连续亏损后暂停交易，调整心态后再继续。</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========== 交易频率分析 ========== */}
            {analysis.frequencyAnalysis && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
                    <Calendar size={18} />
                  </div>
                  <h2 className="font-bold text-gray-900">交易频率分析</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <MiniStatCard title="交易天数" value={`${analysis.frequencyAnalysis.totalDays} 天`} icon={Calendar} color="purple" />
                  <MiniStatCard title="日均交易" value={`${analysis.frequencyAnalysis.avgDailyTrades.toFixed(1)} 笔`} icon={Activity} color="blue" />
                  <MiniStatCard title="单日最多" value={`${analysis.frequencyAnalysis.maxDailyTrades} 笔`} icon={TrendingUp} color="green" />
                  <MiniStatCard title="单日最少" value={`${analysis.frequencyAnalysis.minDailyTrades} 笔`} icon={TrendingDown} color="orange" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">星期表现</h4>
                    <ReactECharts option={getWeekdayChartOption()} style={{ height: '200px' }} />
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">关键日期</h4>
                    {analysis.frequencyAnalysis.bestDay && (
                      <div className="bg-emerald-50 p-4 rounded-xl flex justify-between items-center border border-emerald-100">
                        <div>
                          <div className="text-xs text-gray-500">最佳交易日</div>
                          <div className="font-bold text-gray-900">{analysis.frequencyAnalysis.bestDay.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-600 font-bold">+${analysis.frequencyAnalysis.bestDay.pnl}</div>
                          <div className="text-xs text-gray-500">{analysis.frequencyAnalysis.bestDay.count} 笔交易</div>
                        </div>
                      </div>
                    )}
                    {analysis.frequencyAnalysis.worstDay && (
                      <div className="bg-rose-50 p-4 rounded-xl flex justify-between items-center border border-rose-100">
                        <div>
                          <div className="text-xs text-gray-500">最差交易日</div>
                          <div className="font-bold text-gray-900">{analysis.frequencyAnalysis.worstDay.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-rose-600 font-bold">${analysis.frequencyAnalysis.worstDay.pnl}</div>
                          <div className="text-xs text-gray-500">{analysis.frequencyAnalysis.worstDay.count} 笔交易</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========== 资金曲线分析 ========== */}
            {analysis.equityAnalysis && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
                    <LineChart size={18} />
                  </div>
                  <h2 className="font-bold text-gray-900">资金曲线分析</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  <MiniStatCard title="最终盈亏" value={`$${analysis.equityAnalysis.finalPnL}`} icon={DollarSign} color={analysis.equityAnalysis.finalPnL >= 0 ? 'green' : 'red'} />
                  <MiniStatCard title="历史最高" value={`$${analysis.equityAnalysis.peak}`} icon={TrendingUp} color="green" />
                  <MiniStatCard title="最大回撤" value={`$${analysis.equityAnalysis.maxDrawdown}`} icon={TrendingDown} color="red" />
                  <MiniStatCard title="回撤比例" value={`${analysis.equityAnalysis.maxDrawdownPercent}%`} icon={Activity} color="red" />
                  <MiniStatCard title="恢复因子" value={analysis.equityAnalysis.recoveryFactor.toFixed(2)} icon={Shield} color="blue" />
                  <MiniStatCard title="回撤持续" value={`${analysis.equityAnalysis.maxDrawdownDuration} 笔`} icon={Clock} color="orange" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-5 rounded-xl text-center">
                    <div className="text-xs text-gray-500 mb-1">交易天数</div>
                    <div className="text-2xl font-bold text-gray-900">{analysis.equityAnalysis.tradingDays.total}</div>
                  </div>
                  <div className="bg-emerald-50 p-5 rounded-xl text-center border border-emerald-100">
                    <div className="text-xs text-gray-500 mb-1">盈利天数</div>
                    <div className="text-2xl font-bold text-emerald-600">{analysis.equityAnalysis.tradingDays.profitable}</div>
                    <div className="text-xs text-emerald-600">{analysis.equityAnalysis.tradingDays.profitRatio}%</div>
                  </div>
                  <div className="bg-rose-50 p-5 rounded-xl text-center border border-rose-100">
                    <div className="text-xs text-gray-500 mb-1">亏损天数</div>
                    <div className="text-2xl font-bold text-rose-600">{analysis.equityAnalysis.tradingDays.losing}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== 分析时间 ========== */}
            <div className="text-center text-gray-400 text-xs py-4">
              分析时间: {dayjs(analysis.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        )}
      </div>

      {/* ========== 复盘说明编辑弹窗 ========== */}
      <Modal 
        title={
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-blue-600" />
            <span className="font-bold">编辑复盘说明</span>
          </div>
        } 
        open={reviewModalVisible} 
        onCancel={() => setReviewModalVisible(false)} 
        onOk={handleSaveReview} 
        okText="保存" 
        cancelText="取消" 
        width={600}
        className="[&_.ant-modal-content]:rounded-2xl"
      >
        {editingTrade && (
          <div className="space-y-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-400">品种:</span><span className="ml-2 font-bold">{editingTrade.instrumentCode}</span></div>
                <div><span className="text-gray-400">方向:</span><Tag color={editingTrade.direction === 'LONG' ? 'green' : 'red'} className="ml-2 rounded-full">{editingTrade.direction === 'LONG' ? '多' : '空'}</Tag></div>
                <div><span className="text-gray-400">盈亏:</span><span className={`ml-2 font-bold ${editingTrade.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{editingTrade.pnl >= 0 ? '+' : ''}{editingTrade.pnl?.toFixed(2)}</span></div>
                <div><span className="text-gray-400">时段:</span><span className="ml-2">{editingTrade.marketSession}</span></div>
              </div>
              <div className="mt-2 text-sm text-gray-400">开仓时间: {dayjs(editingTrade.openTime).format('YYYY-MM-DD HH:mm:ss')}</div>
            </div>
            <Form form={reviewForm} layout="vertical">
              <Form.Item name="expectedTrend" label="期望行情">
                <Select 
                  placeholder="选择开仓时的期望行情" 
                  allowClear 
                  className="rounded-xl"
                  options={[
                    { value: '看涨', label: '看涨' }, 
                    { value: '看跌', label: '看跌' }, 
                    { value: '震荡', label: '震荡' }, 
                    { value: '突破', label: '突破' }, 
                    { value: '回调', label: '回调' }
                  ]} 
                />
              </Form.Item>
              <Form.Item name="logicAnalysis" label="逻辑分析">
                <TextArea rows={3} placeholder="分析这笔交易的逻辑依据..." maxLength={500} showCount className="rounded-xl" />
              </Form.Item>
              <Form.Item name="reviewNotes" label="复盘说明">
                <TextArea rows={4} placeholder="记录复盘心得..." maxLength={1000} showCount className="rounded-xl" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AIAnalysis;
