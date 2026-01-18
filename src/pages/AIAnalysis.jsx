import { useState, useEffect } from 'react';
import {
  Card, Button, Spin, Alert, Row, Col, Statistic, Tag, Table, 
  Select, DatePicker, Space, Progress, Collapse, Empty, Divider,
  Modal, Form, Input, message, Tooltip, Typography, Badge, Popconfirm
} from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  TrophyOutlined,
  BulbOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  BarChartOutlined,
  RiseOutlined,
  FallOutlined,
  FieldTimeOutlined,
  EditOutlined,
  FileTextOutlined,
  GlobalOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CalendarOutlined,
  FireOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  ScanOutlined,
  HistoryOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import ReactMarkdown from 'react-markdown';
import StorageService from '../services/storage';
import { generateAIAnalysis } from '../services/aiAnalysis';
import { aiApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Panel } = Collapse;
const { TextArea } = Input;
const { Text } = Typography;

// 分析任务节点配置
const ANALYSIS_STEPS = [
  { key: 'fetch', label: '获取交易数据', duration: 3 },
  { key: 'stats', label: '计算基础统计', duration: 5 },
  { key: 'pattern', label: '识别交易模式', duration: 15 },
  { key: 'instrument', label: '分析品种表现', duration: 20 },
  { key: 'session', label: '评估时段效率', duration: 25 },
  { key: 'risk', label: '风险指标诊断', duration: 35 },
  { key: 'strategy', label: '生成策略建议', duration: 55 },
  { key: 'report', label: '输出诊断报告', duration: 75 },
];

const AIAnalysis = ({ activeRecordId = 'all' }) => {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [filters, setFilters] = useState({
    instrument: 'ALL',
    dateRange: null,
  });
  
  // AI 分析进度状态
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // AI 对话状态
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // 历史记录状态
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(null);
  
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [reviewForm] = Form.useForm();

  const COLORS = {
    profit: '#26a69a',
    loss: '#ef5350',
    primary: '#2962ff',
    text: '#131722',
    textLight: '#787b86',
    border: '#e0e3eb',
    grid: '#f0f3fa',
    gold: '#c29b40',
    purple: '#7c3aed',
    cyan: '#06b6d4',
  };

  useEffect(() => {
    loadInstruments();
    loadHistory(); // 页面加载时获取历史记录
    setAnalysis(null);
  }, [activeRecordId]);

  // AI 分析进度模拟
  useEffect(() => {
    let interval;
    if (loading) {
      setAnalysisProgress(0);
      setCurrentStep(0);
      setElapsedTime(0);
      
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          
          // 根据时间更新当前步骤
          let step = 0;
          for (let i = ANALYSIS_STEPS.length - 1; i >= 0; i--) {
            if (newTime >= ANALYSIS_STEPS[i].duration) {
              step = i + 1;
              break;
            }
          }
          setCurrentStep(Math.min(step, ANALYSIS_STEPS.length - 1));
          
          // 计算进度百分比（最高95%，完成后才100%）
          const maxProgress = 95;
          const progress = Math.min(Math.floor((newTime / 80) * maxProgress), maxProgress);
          setAnalysisProgress(progress);
          
          return newTime;
        });
      }, 1000);
    } else {
      // 分析完成，设置100%
      if (analysis?.success) {
        setAnalysisProgress(100);
        setCurrentStep(ANALYSIS_STEPS.length);
      }
    }
    
    return () => clearInterval(interval);
  }, [loading, analysis]);

  const loadInstruments = async () => {
    const instList = await StorageService.getInstruments();
    setInstruments(instList);
  };

  // 加载历史记录
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const list = await aiApi.getHistory();
      setHistoryList(list);
    } catch (e) {
      console.error('加载历史记录失败:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 查看历史记录详情
  const viewHistoryDetail = async (id) => {
    try {
      const detail = await aiApi.getAnalysis(id);
      setViewingHistory(detail);
      setAnalysis(null); // 清除当前分析，显示历史记录
    } catch (e) {
      message.error('加载详情失败');
    }
  };

  // 删除历史记录
  const deleteHistory = async (id) => {
    try {
      await aiApi.deleteAnalysis(id);
      message.success('删除成功');
      loadHistory();
    } catch (e) {
      message.error('删除失败');
    }
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
    // 检查是否选择了日期范围
    if (!filters.dateRange || !filters.dateRange[0] || !filters.dateRange[1]) {
      message.warning('请先选择交易日期范围');
      return;
    }
    
    setLoading(true);
    setAiResult(null);
    setViewingHistory(null); // 清除正在查看的历史
    try {
      // 本地统计分析
      const result = await generateAIAnalysis({ ...filters, activeRecordId });
      setAnalysis(result);
      
      // DeepSeek AI 分析（异步执行，不阻塞本地分析结果显示）
      if (result.success) {
        setAiLoading(true);
        try {
          const dateRange = filters.dateRange ? [
            filters.dateRange[0]?.toISOString(),
            filters.dateRange[1]?.toISOString()
          ] : null;
          const aiResponse = await aiApi.analyze(activeRecordId, dateRange);
          setAiResult(aiResponse);
          // 分析完成后刷新历史列表
          loadHistory();
        } catch (aiError) {
          console.error('DeepSeek AI 分析失败:', aiError);
          // AI 分析失败不影响本地分析结果
        } finally {
          setAiLoading(false);
        }
      }
    } catch (e) { 
      message.error('分析失败'); 
    } finally { 
      setLoading(false); 
    }
  };

  // AI 问答
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    
    try {
      const response = await aiApi.chat(userMessage, chatMessages);
      if (response.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
      } else {
        message.error(response.message || 'AI 回复失败');
      }
    } catch (error) {
      message.error('AI 问答失败: ' + error.message);
    } finally {
      setChatLoading(false);
    }
  };

  // ========== 图表配置 ==========
  const getSessionChartOption = () => {
    if (!analysis?.patterns?.sessionPerformance) return {};
    const data = analysis.patterns.sessionPerformance;
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: COLORS.textLight, fontSize: 10 } },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.session), axisLine: { lineStyle: { color: COLORS.border } }, axisLabel: { fontSize: 9, rotate: 20 } },
      yAxis: [
        { type: 'value', name: '盈亏', position: 'right', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid } } },
        { type: 'value', name: '胜率', position: 'left', axisLine: { show: false }, axisLabel: { formatter: '{value}%' }, splitLine: { show: false } }
      ],
      series: [
        { name: '盈亏', type: 'bar', data: data.map(d => ({ value: d.totalPnL, itemStyle: { color: d.totalPnL >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [4, 4, 0, 0] } })), barWidth: '40%' },
        { name: '胜率', type: 'line', yAxisIndex: 1, data: data.map(d => d.winRate), lineStyle: { color: COLORS.gold, width: 2 }, itemStyle: { color: COLORS.gold } }
      ]
    };
  };

  const getInstrumentChartOption = () => {
    if (!analysis?.patterns?.instrumentPerformance) return {};
    const data = analysis.patterns.instrumentPerformance;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.instrument), axisLine: { lineStyle: { color: COLORS.border } } },
      yAxis: { type: 'value', position: 'right', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid } } },
      series: [{ type: 'bar', data: data.map(d => ({ value: d.totalPnL, itemStyle: { color: d.totalPnL >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [4, 4, 0, 0] } })), barWidth: '40%' }]
    };
  };

  const getHoldingTimeChartOption = () => {
    if (!analysis?.holdingAnalysis?.distribution) return {};
    const data = analysis.holdingAnalysis.distribution;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '20%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.label), axisLine: { lineStyle: { color: COLORS.border } }, axisLabel: { rotate: 30, fontSize: 9 } },
      yAxis: [
        { type: 'value', name: '笔数', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid } } },
        { type: 'value', name: '平均盈亏', position: 'right', axisLine: { show: false }, splitLine: { show: false } }
      ],
      series: [
        { name: '笔数', type: 'bar', data: data.map(d => d.count), itemStyle: { color: COLORS.primary, borderRadius: [4, 4, 0, 0] } },
        { name: '平均盈亏', type: 'line', yAxisIndex: 1, data: data.map(d => d.avgPnL), lineStyle: { color: COLORS.profit, width: 2 }, itemStyle: { color: COLORS.profit } }
      ]
    };
  };

  const getHourlyChartOption = () => {
    if (!analysis?.hourlyAnalysis?.hourlyData) return {};
    const data = analysis.hourlyAnalysis.hourlyData;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.hourLabel), axisLine: { lineStyle: { color: COLORS.border } }, axisLabel: { fontSize: 9 } },
      yAxis: { type: 'value', position: 'right', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid } } },
      series: [{ type: 'bar', data: data.map(d => ({ value: d.totalPnL, itemStyle: { color: d.totalPnL >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [4, 4, 0, 0] } })) }]
    };
  };

  const getWeekdayChartOption = () => {
    if (!analysis?.frequencyAnalysis?.weekdayData) return {};
    const data = analysis.frequencyAnalysis.weekdayData;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.dayName), axisLine: { lineStyle: { color: COLORS.border } } },
      yAxis: { type: 'value', position: 'right', axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.grid } } },
      series: [{ type: 'bar', data: data.map(d => ({ value: d.totalPnL, itemStyle: { color: d.totalPnL >= 0 ? COLORS.profit : COLORS.loss, borderRadius: [4, 4, 0, 0] } })), barWidth: '50%' }]
    };
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* 顶部进度信息 */}
      <div className="modern-card bg-white p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                <circle 
                  cx="28" cy="28" r="24" 
                  stroke="url(#progress-gradient)" 
                  strokeWidth="4" 
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${analysisProgress * 1.5} 150`}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2962ff" />
                    <stop offset="100%" stopColor="#26a69a" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-[#2962ff]">{analysisProgress}%</span>
              </div>
            </div>
            <div>
              <div className="text-base font-semibold text-[#131722]">AI 深度分析中</div>
              <div className="text-sm text-slate-400">已用时 {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">预计剩余</div>
            <div className="text-lg font-semibold text-slate-600">{Math.max(0, 80 - elapsedTime)}s</div>
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div 
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ 
              width: `${analysisProgress}%`,
              background: 'linear-gradient(90deg, #2962ff, #26a69a)'
            }}
          />
        </div>
      </div>
      
      {/* 任务节点列表 */}
      <div className="modern-card bg-white p-6">
        <div className="text-sm font-semibold text-slate-700 mb-4">分析任务</div>
        <div className="space-y-3">
          {ANALYSIS_STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isPending = index > currentStep;
            
            return (
              <div 
                key={step.key}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isCurrent ? 'bg-blue-50 border border-blue-100' : 
                  isCompleted ? 'bg-slate-50' : ''
                }`}
              >
                {/* 状态图标 */}
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${
                  isCompleted ? 'bg-[#26a69a] text-white' :
                  isCurrent ? 'bg-[#2962ff] text-white' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {isCompleted ? (
                    <CheckCircleOutlined className="text-xs" />
                  ) : isCurrent ? (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                
                {/* 任务名称 */}
                <div className="flex-1">
                  <span className={`text-sm ${
                    isCompleted ? 'text-slate-500' :
                    isCurrent ? 'text-[#2962ff] font-medium' :
                    'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                
                {/* 状态标签 */}
                <div className="flex-shrink-0 text-xs">
                  {isCompleted && (
                    <span className="text-[#26a69a]">✓ 完成</span>
                  )}
                  {isCurrent && (
                    <span className="text-[#2962ff] flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-[#2962ff] rounded-full animate-ping" />
                      进行中
                    </span>
                  )}
                  {isPending && (
                    <span className="text-slate-300">等待</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 底部提示 */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-lg">
        <div className="flex items-start gap-3">
          <BulbOutlined className="text-amber-500 text-lg mt-0.5" />
          <div className="text-sm text-amber-700 leading-relaxed">
            AI 正在对您的交易数据进行多维度深度分析，包括品种表现、时段效率、风险指标、交易心理等，并生成个性化策略建议。请耐心等待...
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* ========== 左侧历史记录面板 ========== */}
      <div className="w-80 flex-shrink-0">
        <div className="modern-card bg-white sticky top-4" style={{ maxHeight: 'calc(100vh - 120px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HistoryOutlined className="text-blue-500" />
              <span className="font-bold text-[#131722]">分析历史</span>
              <Tag color="blue" className="ml-1">{historyList.length}</Tag>
            </div>
            <Button type="primary" size="small" icon={<ThunderboltOutlined />} onClick={() => { setViewingHistory(null); setAnalysis(null); }} loading={loading}>
              新建分析
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {historyLoading ? (
              <div className="flex justify-center py-8"><Spin /></div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-12">
                <RobotOutlined className="text-4xl text-slate-200 mb-3" />
                <p className="text-slate-400 text-sm">暂无分析记录</p>
                <p className="text-slate-300 text-xs mt-1">点击上方按钮开始分析</p>
              </div>
            ) : (
              historyList.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    viewingHistory?.id === item.id 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                  }`}
                  onClick={() => viewHistoryDetail(item.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-sm text-[#131722] truncate flex-1">{item.title}</div>
                    <Popconfirm
                      title="确定删除？"
                      onConfirm={(e) => { e?.stopPropagation(); deleteHistory(item.id); }}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-50 hover:opacity-100"
                      />
                    </Popconfirm>
                  </div>
                  {/* 交易日 */}
                  {item.tradingDays ? (
                    <div className="text-xs text-slate-400 mb-1">
                      {item.tradingDays} 个交易日
                    </div>
                  ) : item.dataStartTime && item.dataEndTime ? (
                    <div className="text-xs text-slate-400 mb-1">
                      {dayjs(item.dataStartTime).format('MM/DD')} - {dayjs(item.dataEndTime).format('MM/DD')}
                    </div>
                  ) : null}
                  {/* 核心指标 */}
                  <div className="flex flex-wrap gap-1 mb-1">
                    <Tag color={item.totalPnL >= 0 ? 'green' : 'red'} className="text-xs">
                      {item.totalPnL >= 0 ? '+' : ''}${item.totalPnL?.toFixed(0)}
                    </Tag>
                    <Tag className="text-xs">{item.totalTrades}笔</Tag>
                    {item.overallScore && (
                      <Tag color={item.overallScore >= 80 ? 'green' : item.overallScore >= 60 ? 'blue' : item.overallScore >= 40 ? 'orange' : 'red'} className="text-xs">
                        {item.overallScore}分
                      </Tag>
                    )}
                  </div>
                  {/* 胜率和盈亏比 */}
                  <div className="flex gap-2 text-xs text-slate-500 mb-1">
                    <span>胜率 {item.winRate?.toFixed(1)}%</span>
                    <span>|</span>
                    <span>盈亏比 {item.profitLossRatio?.toFixed(2)}</span>
                  </div>
                  {/* 品种 */}
                  {item.instruments && (
                    <div className="text-xs text-blue-500 truncate">{item.instruments}</div>
                  )}
                  <div className="text-xs text-slate-400 mt-1">
                    分析于 {dayjs(item.createdAt).format('MM-DD HH:mm')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ========== 右侧主内容区 ========== */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* 控制栏 */}
        <div className="modern-card bg-white p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-[#f0f3fa] px-3 py-1.5 rounded-lg">
              <GlobalOutlined className="text-blue-500 text-xs" />
              <Select value={filters.instrument} onChange={(v) => setFilters({ ...filters, instrument: v })} style={{ width: 120 }} variant="borderless" className="font-bold text-xs" options={[{ value: 'ALL', label: '全部品种' }, ...instruments.map(i => ({ value: i.code, label: i.code }))]} />
            </div>
            <div className="bg-[#f0f3fa] px-2 py-0.5 rounded-lg">
              <RangePicker value={filters.dateRange} onChange={(v) => setFilters({ ...filters, dateRange: v })} variant="borderless" className="font-medium text-xs" allowClear placeholder={['开始日期', '结束日期']} />
            </div>
          </div>
          {viewingHistory && (
            <Button onClick={() => { setViewingHistory(null); setAnalysis(null); }}>
              返回新建
            </Button>
          )}
        </div>

        {/* 查看历史分析 */}
        {viewingHistory && (
          <div className="space-y-6">
            {/* 概览卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* 综合评分 */}
              <div className="modern-card bg-[#131722] p-4 text-white">
                <div className="text-blue-400 text-[10px] font-bold uppercase mb-2">综合评分</div>
                <div className="text-4xl font-black" style={{ color: viewingHistory.overallScore >= 60 ? '#26a69a' : '#ef5350' }}>
                  {viewingHistory.overallScore || '--'}
                </div>
                <div className="text-xs text-blue-300 mt-1">{viewingHistory.overallLevel || '待评估'}</div>
              </div>
              {/* 总盈亏 */}
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">总盈亏</div>
                <div className={`text-2xl font-bold ${viewingHistory.totalPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                  {viewingHistory.totalPnL >= 0 ? '+' : ''}${viewingHistory.totalPnL?.toLocaleString()}
                </div>
              </div>
              {/* 交易笔数 */}
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">交易笔数</div>
                <div className="text-2xl font-bold text-[#131722]">{viewingHistory.totalTrades}</div>
              </div>
              {/* 胜率 */}
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">胜率</div>
                <div className="text-2xl font-bold text-[#131722]">{viewingHistory.winRate?.toFixed(1)}%</div>
              </div>
              {/* 盈亏比 */}
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">盈亏比</div>
                <div className="text-2xl font-bold text-[#2962ff]">{viewingHistory.profitLossRatio?.toFixed(2)}</div>
              </div>
            </div>

            {/* 详细信息 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 交易日 */}
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-2">交易日</div>
                <div className="text-sm font-medium text-[#131722]">
                  {viewingHistory.tradingDays ? (
                    <span className="text-2xl font-bold text-[#2962ff]">{viewingHistory.tradingDays}</span>
                  ) : viewingHistory.dataStartTime && viewingHistory.dataEndTime ? (
                    <>
                      {dayjs(viewingHistory.dataStartTime).format('MM/DD')} - {dayjs(viewingHistory.dataEndTime).format('MM/DD')}
                    </>
                  ) : '--'}
                  {viewingHistory.dataStartTime && viewingHistory.dataEndTime && (
                    <span className="text-xs text-slate-400 ml-2">
                      ({dayjs(viewingHistory.dataStartTime).format('MM/DD')} - {dayjs(viewingHistory.dataEndTime).format('MM/DD')})
                    </span>
                  )}
                </div>
              </div>
              {/* 品种 */}
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-2">交易品种</div>
                <div className="flex flex-wrap gap-1">
                  {viewingHistory.instruments ? viewingHistory.instruments.split(',').map(code => (
                    <Tag key={code} color="blue" className="text-xs">{code}</Tag>
                  )) : <span className="text-slate-400 text-sm">全部</span>}
                </div>
              </div>
              {/* 分析时间 */}
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-2">分析时间</div>
                <div className="text-sm font-medium text-[#131722]">
                  {dayjs(viewingHistory.createdAt).format('YYYY/MM/DD HH:mm:ss')}
                </div>
              </div>
            </div>

            {/* 时段表现 */}
            {viewingHistory.sessionStats && (
              <div className="modern-card bg-white p-4">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-3">时段表现</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(JSON.parse(viewingHistory.sessionStats)).map(([session, stats]) => (
                    <div key={session} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-[#131722] mb-1">{session}</div>
                      <div className={`text-lg font-bold ${stats.pnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                        {stats.pnl >= 0 ? '+' : ''}${stats.pnl?.toFixed(0)}
                      </div>
                      <div className="text-xs text-slate-400">{stats.count}笔 | 胜率{stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(0) : 0}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 报告 */}
            <div className="modern-card bg-white p-6">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 bg-[#131722] rounded-lg flex items-center justify-center">
                  <RobotOutlined className="text-white text-sm" />
                </div>
                <div>
                  <div className="font-semibold text-[#131722]">AI 智能诊断报告</div>
                  <div className="text-[10px] text-slate-400">Powered by DeepSeek</div>
                </div>
              </div>
              <div className="prose max-w-none ai-report-content">
                <ReactMarkdown
                  components={{
                    h2: ({children}) => <h2 className="text-base font-semibold text-[#131722] mt-6 mb-3 pb-2 border-b border-slate-100">{children}</h2>,
                    h3: ({children}) => <h3 className="text-sm font-semibold text-[#131722] mt-4 mb-2">{children}</h3>,
                    p: ({children}) => <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>,
                    li: ({children}) => <li className="text-sm text-slate-600 mb-1">{children}</li>,
                    strong: ({children}) => <strong className="font-semibold text-[#131722]">{children}</strong>,
                  }}
                >
                  {viewingHistory.report}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* 无分析时的欢迎页 - 需要先选择交易日 */}
        {!analysis && !viewingHistory && !loading && (
          <div className="modern-card bg-white p-10">
            <div className="max-w-lg mx-auto">
              {/* 步骤指示 */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${filters.dateRange ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  <span className="w-6 h-6 rounded-full bg-current text-white flex items-center justify-center text-xs font-bold" style={{ backgroundColor: filters.dateRange ? '#22c55e' : '#2962ff' }}>1</span>
                  <span className="font-medium text-sm">选择交易日</span>
                  {filters.dateRange && <span className="text-green-500">✓</span>}
                </div>
                <div className="w-8 h-px bg-slate-200"></div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${filters.dateRange ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: filters.dateRange ? '#2962ff' : '#cbd5e1', color: 'white' }}>2</span>
                  <span className="font-medium text-sm">开始分析</span>
                </div>
              </div>

              {/* 日期选择区域 */}
              <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <div className="text-center mb-4">
                  <div className="text-slate-400 text-xs font-bold uppercase mb-2">选择分析的交易日期范围</div>
                  <p className="text-slate-500 text-sm">请先选择您想要分析的交易日期</p>
                </div>
                <div className="flex justify-center">
                  <RangePicker 
                    value={filters.dateRange} 
                    onChange={(v) => setFilters({ ...filters, dateRange: v })} 
                    size="large"
                    className="w-80"
                    placeholder={['开始日期', '结束日期']}
                    format="YYYY-MM-DD"
                  />
                </div>
                {filters.dateRange && (
                  <div className="text-center mt-4 text-sm text-green-600">
                    已选择: {dayjs(filters.dateRange[0]).format('YYYY/MM/DD')} - {dayjs(filters.dateRange[1]).format('YYYY/MM/DD')}
                  </div>
                )}
              </div>

              {/* 品种筛选（可选） */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="text-slate-500 text-sm">筛选品种（可选）</div>
                  <Select 
                    value={filters.instrument} 
                    onChange={(v) => setFilters({ ...filters, instrument: v })} 
                    style={{ width: 150 }} 
                    options={[{ value: 'ALL', label: '全部品种' }, ...instruments.map(i => ({ value: i.code, label: i.code }))]} 
                  />
                </div>
              </div>

              {/* 开始分析按钮 */}
              <div className="text-center">
                <Button 
                  type="primary" 
                  onClick={handleAnalyze} 
                  size="large" 
                  icon={<ThunderboltOutlined />}
                  disabled={!filters.dateRange}
                  className="px-8"
                >
                  {filters.dateRange ? '开始 AI 分析' : '请先选择交易日期'}
                </Button>
                {!filters.dateRange && (
                  <p className="text-slate-400 text-xs mt-3">选择日期范围后，AI 将深度分析您的交易数据</p>
                )}
              </div>

              {/* 历史记录提示 */}
              {historyList.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-slate-400 text-sm">或从左侧选择历史分析记录查看</p>
                </div>
              )}
            </div>
          </div>
        )}

      {analysis && !analysis.success && !viewingHistory && <Alert message="分析失败" description={analysis.message} type="error" showIcon />}

      {analysis && analysis.success && !viewingHistory && (
        <div className="space-y-6">
          {/* ========== 整体评级 ========== */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="modern-card bg-[#131722] p-6 text-white">
              <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><SafetyCertificateOutlined /> 综合评分</div>
              <div className="text-5xl font-black mb-2" style={{ color: analysis.summary.overallRating.color === 'green' ? COLORS.profit : COLORS.loss }}>{analysis.summary.overallRating.score}</div>
              <Tag className="rounded-full border-none px-4 py-1 text-xs font-bold bg-blue-500/20 text-blue-400">{analysis.summary.overallRating.level}</Tag>
            </div>
            <div className="modern-card bg-white p-6">
              <div className="text-slate-400 text-[10px] font-bold uppercase mb-2">总盈亏</div>
              <div className={`text-3xl font-bold ${analysis.summary.totalPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{analysis.summary.totalPnL >= 0 ? '+' : ''}{analysis.summary.totalPnL.toLocaleString()} <span className="text-sm font-normal text-slate-400">美元</span></div>
            </div>
            <div className="modern-card bg-white p-6">
              <div className="text-slate-400 text-[10px] font-bold uppercase mb-2">胜率</div>
              <div className="text-3xl font-bold text-[#131722]">{analysis.summary.winRate}%</div>
            </div>
            <div className="modern-card bg-white p-6">
              <div className="text-slate-400 text-[10px] font-bold uppercase mb-2">利润系数</div>
              <div className="text-3xl font-bold text-[#2962ff]">{analysis.summary.profitFactor === Infinity ? '∞' : analysis.summary.profitFactor.toFixed(2)}</div>
            </div>
          </div>

          {/* ========== DeepSeek AI 智能分析 ========== */}
          <div className="modern-card bg-white overflow-hidden">
            {/* Header - 极简风格 */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#131722] rounded-lg flex items-center justify-center">
                  <RobotOutlined className="text-white text-sm" />
                </div>
                <div>
                  <div className="font-semibold text-[#131722]">AI 智能诊断</div>
                  <div className="text-[10px] text-slate-400">Powered by DeepSeek</div>
                </div>
              </div>
              <Button 
                type="text"
                icon={<ThunderboltOutlined />} 
                onClick={() => setChatVisible(true)}
                className="text-slate-500 hover:text-[#2962ff] hover:bg-blue-50"
              >
                问答
              </Button>
            </div>
            
            {/* Content - 极简风格 */}
            <div className="p-6">
              {aiLoading ? (
                <div className="py-8 px-4">
                  {/* 顶部进度信息 */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10">
                        <div className="absolute inset-0 border-2 border-slate-200 rounded-full"></div>
                        <div className="absolute inset-0 border-t-2 border-[#2962ff] rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-semibold text-[#2962ff]">{analysisProgress}%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#131722]">AI 深度分析中</div>
                        <div className="text-xs text-slate-400">已用时 {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">预计剩余</div>
                      <div className="text-sm font-medium text-slate-600">{Math.max(0, 80 - elapsedTime)} 秒</div>
                    </div>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mb-8">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2962ff] to-[#26a69a] rounded-full transition-all duration-500"
                      style={{ width: `${analysisProgress}%` }}
                    />
                    <div 
                      className="absolute inset-y-0 bg-white/50 rounded-full animate-pulse"
                      style={{ left: `${Math.max(0, analysisProgress - 5)}%`, width: '5%' }}
                    />
                  </div>
                  
                  {/* 任务节点列表 */}
                  <div className="space-y-3">
                    {ANALYSIS_STEPS.map((step, index) => {
                      const isCompleted = index < currentStep;
                      const isCurrent = index === currentStep;
                      const isPending = index > currentStep;
                      
                      return (
                        <div 
                          key={step.key}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                            isCurrent ? 'bg-blue-50 border border-blue-100' : 
                            isCompleted ? 'bg-slate-50' : 'opacity-50'
                          }`}
                        >
                          {/* 状态图标 */}
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-[#26a69a] text-white' :
                            isCurrent ? 'bg-[#2962ff] text-white' :
                            'bg-slate-200 text-slate-400'
                          }`}>
                            {isCompleted ? (
                              <CheckCircleOutlined className="text-xs" />
                            ) : isCurrent ? (
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            ) : (
                              <span className="text-xs">{index + 1}</span>
                            )}
                          </div>
                          
                          {/* 任务名称 */}
                          <div className="flex-1">
                            <span className={`text-sm ${
                              isCompleted ? 'text-slate-500' :
                              isCurrent ? 'text-[#2962ff] font-medium' :
                              'text-slate-400'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                          
                          {/* 状态标签 */}
                          <div className="flex-shrink-0">
                            {isCompleted && (
                              <span className="text-xs text-[#26a69a]">已完成</span>
                            )}
                            {isCurrent && (
                              <span className="text-xs text-[#2962ff] flex items-center gap-1">
                                <span className="inline-block w-1 h-1 bg-[#2962ff] rounded-full animate-ping" />
                                进行中
                              </span>
                            )}
                            {isPending && (
                              <span className="text-xs text-slate-300">等待中</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 底部提示 */}
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <BulbOutlined className="text-amber-500 mt-0.5" />
                      <div className="text-xs text-slate-500 leading-relaxed">
                        AI 正在对您的 <span className="font-medium text-slate-700">157 笔交易</span> 进行多维度深度分析，
                        包括品种表现、时段效率、风险指标、交易心理等，并生成个性化策略建议。
                      </div>
                    </div>
                  </div>
                </div>
              ) : aiResult?.success ? (
                <div className="ai-report-minimal">
                  <ReactMarkdown
                    components={{
                      hr: () => <hr className="border-slate-100 my-8" />,
                      h2: ({children}) => (
                        <h2 className="text-base font-semibold text-[#131722] mt-8 mb-4 pb-2 border-b border-slate-100">
                          {children}
                        </h2>
                      ),
                      h3: ({children}) => (
                        <h3 className="text-sm font-semibold text-[#131722] mt-5 mb-2">
                          {children}
                        </h3>
                      ),
                      h4: ({children}) => (
                        <h4 className="text-sm font-medium text-slate-600 mt-4 mb-2">
                          {children}
                        </h4>
                      ),
                      p: ({children}) => <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>,
                      blockquote: ({children}) => (
                        <blockquote className="border-l-2 border-[#2962ff] pl-4 py-1 my-4 text-sm text-slate-600 bg-slate-50 rounded-r">
                          {children}
                        </blockquote>
                      ),
                      ul: ({children}) => <ul className="space-y-1.5 mb-4 text-sm text-slate-600 ml-4">{children}</ul>,
                      ol: ({children}) => <ol className="space-y-1.5 mb-4 text-sm text-slate-600 list-decimal list-inside">{children}</ol>,
                      li: ({children}) => (
                        <li className="text-slate-600 flex items-start gap-2">
                          <span className="text-slate-300 mt-0.5">–</span>
                          <span className="flex-1">{children}</span>
                        </li>
                      ),
                      strong: ({children}) => <strong className="text-[#131722] font-semibold">{children}</strong>,
                      em: ({children}) => <em className="text-[#2962ff] not-italic font-medium">{children}</em>,
                      code: ({children}) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-slate-700 font-mono">{children}</code>,
                      table: ({children}) => (
                        <div className="overflow-x-auto my-4 rounded-lg border border-slate-100">
                          <table className="w-full text-sm">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({children}) => <thead className="bg-slate-50">{children}</thead>,
                      th: ({children}) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{children}</th>,
                      td: ({children}) => <td className="px-4 py-2.5 text-sm text-slate-600 border-t border-slate-50">{children}</td>,
                      a: ({children, href}) => <a href={href} className="text-[#2962ff] hover:underline">{children}</a>,
                      input: ({checked, type}) => {
                        if (type === 'checkbox') {
                          return checked 
                            ? <span className="inline-flex items-center justify-center w-4 h-4 bg-[#26a69a] rounded mr-2 text-white text-[10px]">✓</span>
                            : <span className="inline-flex items-center justify-center w-4 h-4 border border-slate-300 rounded mr-2"></span>;
                        }
                        return null;
                      },
                    }}
                  >
                    {aiResult.analysis}
                  </ReactMarkdown>
                  
                  {/* Footer - 极简 */}
                  <div className="mt-8 pt-4 border-t border-slate-100 text-[10px] text-slate-400 text-right">
                    {dayjs(aiResult.generatedAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              ) : aiResult?.message ? (
                <Alert 
                  message={aiResult.message} 
                  type="warning" 
                  showIcon 
                />
              ) : (
                <div className="text-center py-16">
                  <RobotOutlined className="text-3xl text-slate-200 mb-3" />
                  <div className="text-sm text-slate-400">等待分析</div>
                </div>
              )}
            </div>
          </div>

          {/* ========== 问题识别 ========== */}
          {analysis.problems && analysis.problems.length > 0 && (
            <div className="modern-card bg-white">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2"><WarningOutlined className="text-[#ef5350]" /><span className="font-bold text-[#131722]">问题识别与问题订单</span></div>
                <Tag color="red">{analysis.problems.length} 个问题</Tag>
              </div>
              <div className="p-2">
                <Collapse ghost expandIconPosition="end" defaultActiveKey={analysis.problems.length === 1 ? [0] : []}>
                  {analysis.problems.map((problem, index) => (
                    <Panel key={index} header={
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Tag color={problem.severity === 'high' ? 'red' : problem.severity === 'medium' ? 'orange' : 'blue'}>{problem.severity === 'high' ? '严重' : problem.severity === 'medium' ? '中等' : '轻微'}</Tag>
                          <span className="font-bold text-sm">{problem.type}</span>
                          {problem.trades && <Tag color="orange">{problem.trades.length} 笔问题订单</Tag>}
                        </div>
                        {problem.totalLoss !== undefined && <span className="text-[#ef5350] font-bold">累计亏损: ${Math.abs(problem.totalLoss).toLocaleString()}</span>}
                      </div>
                    }>
                      <div className="px-4 pb-4 space-y-4">
                        <Alert message={problem.description} description={<p className="text-blue-600 mt-2"><BulbOutlined className="mr-1" /><strong>优化建议：</strong>{problem.recommendation}</p>} type={problem.severity === 'high' ? 'error' : 'warning'} showIcon />
                        {problem.trades && problem.trades.length > 0 && (
                          <Table dataSource={problem.trades.map((t, i) => ({ ...t, key: t.id || i }))} size="small" pagination={false} rowClassName={(r) => r.pnl < 0 ? 'bg-red-50/50' : 'bg-green-50/50'} columns={[
                            { title: '开仓时间', dataIndex: 'openTime', width: 140, render: t => dayjs(t).format('MM-DD HH:mm:ss') },
                            { title: '品种', dataIndex: 'instrumentCode', width: 70, render: c => <Tag color="blue">{c}</Tag> },
                            { title: '方向', dataIndex: 'direction', width: 60, render: d => <Tag color={d === 'LONG' ? 'green' : 'red'}>{d === 'LONG' ? '多' : '空'}</Tag> },
                            { title: '盈亏', dataIndex: 'pnl', width: 100, align: 'right', render: p => <span className={`font-bold ${p >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{p >= 0 ? '+' : ''}{p?.toFixed(2)}</span> },
                            { title: '时段', dataIndex: 'marketSession', width: 90, render: s => <Tag>{s}</Tag> },
                            { title: '持仓时间', dataIndex: 'holdingSeconds', width: 90, align: 'right', render: s => { if (!s) return '-'; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; if (h > 0) return `${h}时${m}分`; if (m > 0) return `${m}分${sec}秒`; return `${sec}秒`; } },
                            { title: '操作', key: 'action', width: 60, render: (_, r) => <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openReviewModal(r)} className="text-blue-500" /> }
                          ]} />
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
            <div className="modern-card bg-white p-6">
              <div className="flex items-center gap-2 mb-6"><BulbOutlined className="text-[#2962ff]" /><span className="font-bold text-[#131722]">优化策略建议</span><Tag color="blue">{analysis.strategies.length} 条建议</Tag></div>
              <Collapse defaultActiveKey={[0]} ghost>
                {analysis.strategies.map((s, idx) => (
                  <Panel key={idx} header={<div className="flex items-center gap-3"><Tag color={s.priority === 'high' ? 'red' : s.priority === 'medium' ? 'orange' : 'blue'}>{s.priority === 'high' ? '高优先级' : s.priority === 'medium' ? '中优先级' : '低优先级'}</Tag><span className="font-bold">{s.title}</span><Tag>{s.category}</Tag></div>}>
                    <div className="space-y-3 pl-6">
                      <p className="text-slate-600">{s.description}</p>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100"><p className="text-blue-700"><strong>行动建议：</strong>{s.action}</p></div>
                      {s.expectedImprovement && <div className="bg-green-50 p-3 rounded-lg border border-green-100"><p className="text-green-700"><strong>预期效果：</strong>{s.expectedImprovement}</p></div>}
                    </div>
                  </Panel>
                ))}
              </Collapse>
            </div>
          )}

          {/* ========== 时段与品种图表 ========== */}
          {analysis.patterns && (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}><div className="modern-card bg-white p-6"><div className="text-sm font-bold text-slate-600 mb-4">时段表现分析</div><ReactECharts option={getSessionChartOption()} style={{ height: '320px' }} /></div></Col>
              <Col xs={24} lg={12}><div className="modern-card bg-white p-6"><div className="text-sm font-bold text-slate-600 mb-4">品种表现分析</div><ReactECharts option={getInstrumentChartOption()} style={{ height: '320px' }} /></div></Col>
            </Row>
          )}

          {/* ========== 时段与品种表格 ========== */}
          {analysis.patterns && (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <div className="modern-card bg-white p-6"><div className="text-sm font-bold text-slate-600 mb-4">时段表现详情</div>
                  <Table dataSource={analysis.patterns.sessionPerformance} rowKey="session" pagination={false} size="small" columns={[
                    { title: '时段', dataIndex: 'session' }, { title: '交易笔数', dataIndex: 'totalTrades', align: 'right' },
                    { title: '总盈亏', dataIndex: 'totalPnL', align: 'right', render: v => <span className={v >= 0 ? 'text-[#26a69a] font-bold' : 'text-[#ef5350] font-bold'}>{v >= 0 ? '+' : ''}{v}</span> },
                    { title: '胜率', dataIndex: 'winRate', align: 'right', render: v => `${v}%` }, { title: '平均盈亏', dataIndex: 'avgPnL', align: 'right', render: v => <span className={v >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{v >= 0 ? '+' : ''}{v}</span> }
                  ]} />
                </div>
              </Col>
              <Col xs={24} lg={12}>
                <div className="modern-card bg-white p-6"><div className="text-sm font-bold text-slate-600 mb-4">品种表现详情</div>
                  <Table dataSource={analysis.patterns.instrumentPerformance} rowKey="instrument" pagination={false} size="small" columns={[
                    { title: '品种', dataIndex: 'instrument' }, { title: '交易笔数', dataIndex: 'totalTrades', align: 'right' },
                    { title: '总盈亏', dataIndex: 'totalPnL', align: 'right', render: v => <span className={v >= 0 ? 'text-[#26a69a] font-bold' : 'text-[#ef5350] font-bold'}>{v >= 0 ? '+' : ''}{v}</span> },
                    { title: '胜率', dataIndex: 'winRate', align: 'right', render: v => `${v}%` }, { title: '平均盈亏', dataIndex: 'avgPnL', align: 'right', render: v => <span className={v >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{v >= 0 ? '+' : ''}{v}</span> }
                  ]} />
                </div>
              </Col>
            </Row>
          )}

          {/* ========== 多空对比 ========== */}
          {analysis.patterns?.directionPerformance && (
            <div className="modern-card bg-white p-6">
              <div className="text-sm font-bold text-slate-600 mb-6">多空交易对比</div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div className="bg-[#f0fdf4] p-5 rounded-xl border border-[#26a69a]/20">
                    <div className="flex items-center gap-2 mb-4"><ArrowUpOutlined className="text-[#26a69a]" /><span className="font-bold text-[#26a69a]">多头交易</span></div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div><div className="text-2xl font-bold">{analysis.patterns.directionPerformance.LONG.totalTrades}</div><div className="text-xs text-slate-400">笔数</div></div>
                      <div><div className={`text-2xl font-bold ${analysis.patterns.directionPerformance.LONG.totalPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{analysis.patterns.directionPerformance.LONG.totalPnL >= 0 ? '+' : ''}{analysis.patterns.directionPerformance.LONG.totalPnL}</div><div className="text-xs text-slate-400">总盈亏</div></div>
                      <div><div className="text-2xl font-bold">{analysis.patterns.directionPerformance.LONG.winRate}%</div><div className="text-xs text-slate-400">胜率</div></div>
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div className="bg-[#fef2f2] p-5 rounded-xl border border-[#ef5350]/20">
                    <div className="flex items-center gap-2 mb-4"><ArrowDownOutlined className="text-[#ef5350]" /><span className="font-bold text-[#ef5350]">空头交易</span></div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div><div className="text-2xl font-bold">{analysis.patterns.directionPerformance.SHORT.totalTrades}</div><div className="text-xs text-slate-400">笔数</div></div>
                      <div><div className={`text-2xl font-bold ${analysis.patterns.directionPerformance.SHORT.totalPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{analysis.patterns.directionPerformance.SHORT.totalPnL >= 0 ? '+' : ''}{analysis.patterns.directionPerformance.SHORT.totalPnL}</div><div className="text-xs text-slate-400">总盈亏</div></div>
                      <div><div className="text-2xl font-bold">{analysis.patterns.directionPerformance.SHORT.winRate}%</div><div className="text-xs text-slate-400">胜率</div></div>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {/* ========== 持仓分析报告 ========== */}
          {analysis.holdingReport && (
            <div className="modern-card bg-white p-6">
              <div className="flex items-center gap-2 mb-6"><ClockCircleOutlined className="text-purple-500" /><span className="font-bold text-[#131722]">持仓分析报告</span></div>
              {analysis.holdingReport.sections.map((section, idx) => (
                <div key={idx} className="mb-6">
                  <h4 className="text-sm font-bold mb-3 text-slate-700 border-b border-slate-100 pb-2">{section.title}</h4>
                  {section.type === 'summary' && (<Row gutter={[12, 12]}>{Object.entries(section.data).map(([key, value]) => (<Col xs={12} sm={6} key={key}><div className="bg-slate-50 p-3 rounded-lg text-center"><div className="text-slate-500 text-xs">{key}</div><div className="text-lg font-bold text-[#2962ff]">{value}</div></div></Col>))}</Row>)}
                  {section.type === 'comparison' && (<div className="space-y-3"><Row gutter={[12, 12]}>{Object.entries(section.data).map(([key, value]) => (<Col xs={24} sm={8} key={key}><div className="bg-blue-50 p-3 rounded-lg"><div className="text-slate-600 text-xs">{key}</div><div className="text-sm font-bold text-[#2962ff]">{value}</div></div></Col>))}</Row>{section.insight && <Alert message={section.insight} type="info" showIcon icon={<BulbOutlined />} />}</div>)}
                  {section.type === 'highlight' && (<div className="space-y-3"><Row gutter={[12, 12]}>{Object.entries(section.data).map(([key, value]) => (<Col xs={12} sm={6} key={key}><div className="bg-green-50 p-3 rounded-lg text-center border border-green-100"><div className="text-slate-600 text-xs">{key}</div><div className="text-lg font-bold text-[#26a69a]">{value}</div></div></Col>))}</Row>{section.recommendation && <Alert message={<><strong>建议：</strong>{section.recommendation}</>} type="success" showIcon />}</div>)}
                  {section.type === 'distribution' && (<Table dataSource={section.data} rowKey="label" pagination={false} size="small" columns={[{ title: '持仓时间', dataIndex: 'label' }, { title: '笔数', dataIndex: 'count', align: 'right' }, { title: '占比', dataIndex: 'percentage', align: 'right', render: v => `${v}%` }, { title: '总盈亏', dataIndex: 'totalPnL', align: 'right', render: v => <span className={v >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>${v}</span> }, { title: '平均盈亏', dataIndex: 'avgPnL', align: 'right', render: v => <span className={v >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>${v}</span> }, { title: '胜率', dataIndex: 'winRate', align: 'right', render: v => `${v}%` }]} />)}
                </div>
              ))}
            </div>
          )}

          {/* ========== 风险收益指标 ========== */}
          {analysis.riskAnalysis && (
            <div className="modern-card bg-white p-6">
              <div className="flex items-center gap-2 mb-6"><BarChartOutlined className="text-orange-500" /><span className="font-bold text-[#131722]">风险收益指标</span></div>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={4}><Statistic title="期望值" value={analysis.riskAnalysis.expectancy} prefix="$" valueStyle={{ color: analysis.riskAnalysis.expectancy >= 0 ? COLORS.profit : COLORS.loss }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="盈亏比" value={analysis.riskAnalysis.profitLossRatio} precision={2} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="利润系数" value={analysis.riskAnalysis.profitFactor} precision={2} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="夏普比率" value={analysis.riskAnalysis.sharpeRatio} precision={2} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="波动率" value={analysis.riskAnalysis.standardDeviation} prefix="$" /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="最大单笔盈利" value={analysis.riskAnalysis.maxProfit} prefix="$" valueStyle={{ color: COLORS.profit }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="最大单笔亏损" value={analysis.riskAnalysis.maxLoss} prefix="$" valueStyle={{ color: COLORS.loss }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="平均盈利" value={analysis.riskAnalysis.avgProfit} prefix="$" valueStyle={{ color: COLORS.profit }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="平均亏损" value={analysis.riskAnalysis.avgLoss} prefix="$" valueStyle={{ color: COLORS.loss }} /></Col>
              </Row>
              <Divider />
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}><div className="bg-[#f0fdf4] p-4 rounded-xl border border-[#26a69a]/20"><div className="text-[#26a69a] font-bold mb-2">盈利统计</div><div className="flex justify-between text-sm"><span>盈利笔数:</span><span className="font-bold">{analysis.riskAnalysis.winningTrades} 笔</span></div><div className="flex justify-between text-sm"><span>总盈利:</span><span className="font-bold text-[#26a69a]">${analysis.riskAnalysis.grossProfit}</span></div></div></Col>
                <Col xs={24} sm={12}><div className="bg-[#fef2f2] p-4 rounded-xl border border-[#ef5350]/20"><div className="text-[#ef5350] font-bold mb-2">亏损统计</div><div className="flex justify-between text-sm"><span>亏损笔数:</span><span className="font-bold">{analysis.riskAnalysis.losingTrades} 笔</span></div><div className="flex justify-between text-sm"><span>总亏损:</span><span className="font-bold text-[#ef5350]">${analysis.riskAnalysis.grossLoss}</span></div></div></Col>
              </Row>
            </div>
          )}

          {/* ========== 连续交易分析 ========== */}
          {analysis.streaksAnalysis && (
            <div className="modern-card bg-white p-6">
              <div className="flex items-center gap-2 mb-6"><FireOutlined className="text-cyan-500" /><span className="font-bold text-[#131722]">连续交易分析</span></div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}><div className="bg-[#f0fdf4] p-4 rounded-xl text-center border border-[#26a69a]/20"><RiseOutlined className="text-3xl text-[#26a69a] mb-2" /><div className="text-slate-600 text-xs">最长连续盈利</div><div className="text-2xl font-bold text-[#26a69a]">{analysis.streaksAnalysis.maxWinStreak} 笔</div><div className="text-xs text-[#26a69a]">+${analysis.streaksAnalysis.maxWinStreakPnL}</div></div></Col>
                <Col xs={24} sm={12} md={6}><div className="bg-[#fef2f2] p-4 rounded-xl text-center border border-[#ef5350]/20"><FallOutlined className="text-3xl text-[#ef5350] mb-2" /><div className="text-slate-600 text-xs">最长连续亏损</div><div className="text-2xl font-bold text-[#ef5350]">{analysis.streaksAnalysis.maxLossStreak} 笔</div><div className="text-xs text-[#ef5350]">${analysis.streaksAnalysis.maxLossStreakPnL}</div></div></Col>
                <Col xs={24} sm={12} md={6}><div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100"><div className="text-slate-600 text-xs mb-1">亏损后交易表现</div><div className="text-xl font-bold text-[#2962ff]">{analysis.streaksAnalysis.afterLoss.winRate}%</div><div className="text-xs text-slate-400">{analysis.streaksAnalysis.afterLoss.count} 笔交易</div><div className="text-xs">平均: <span className={analysis.streaksAnalysis.afterLoss.avgPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>${analysis.streaksAnalysis.afterLoss.avgPnL}</span></div></div></Col>
                <Col xs={24} sm={12} md={6}><div className="bg-purple-50 p-4 rounded-xl text-center border border-purple-100"><div className="text-slate-600 text-xs mb-1">盈利后交易表现</div><div className="text-xl font-bold text-purple-600">{analysis.streaksAnalysis.afterWin.winRate}%</div><div className="text-xs text-slate-400">{analysis.streaksAnalysis.afterWin.count} 笔交易</div><div className="text-xs">平均: <span className={analysis.streaksAnalysis.afterWin.avgPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>${analysis.streaksAnalysis.afterWin.avgPnL}</span></div></div></Col>
              </Row>
              {analysis.streaksAnalysis.afterLoss.winRate < analysis.streaksAnalysis.afterWin.winRate - 10 && <Alert className="mt-4" message="心理提示" description="您在亏损后的交易胜率明显低于盈利后，建议在连续亏损后暂停交易，调整心态后再继续。" type="warning" showIcon />}
            </div>
          )}

          {/* ========== 持仓时间分布 & 小时表现 ========== */}
          {analysis.holdingAnalysis?.hasData && (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}><div className="modern-card bg-white p-6"><div className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2"><FieldTimeOutlined /> 持仓时间分布</div><ReactECharts option={getHoldingTimeChartOption()} style={{ height: '320px' }} /></div></Col>
              <Col xs={24} lg={12}><div className="modern-card bg-white p-6"><div className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2"><ClockCircleOutlined /> 小时表现分析</div><ReactECharts option={getHourlyChartOption()} style={{ height: '320px' }} /></div></Col>
            </Row>
          )}

          {/* ========== 交易频率分析 ========== */}
          {analysis.frequencyAnalysis && (
            <div className="modern-card bg-white p-6">
              <div className="flex items-center gap-2 mb-6"><CalendarOutlined className="text-indigo-500" /><span className="font-bold text-[#131722]">交易频率分析</span></div>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}><Statistic title="交易天数" value={analysis.frequencyAnalysis.totalDays} suffix="天" /></Col>
                <Col xs={12} sm={6}><Statistic title="日均交易" value={analysis.frequencyAnalysis.avgDailyTrades} precision={1} suffix="笔" /></Col>
                <Col xs={12} sm={6}><Statistic title="单日最多" value={analysis.frequencyAnalysis.maxDailyTrades} suffix="笔" /></Col>
                <Col xs={12} sm={6}><Statistic title="单日最少" value={analysis.frequencyAnalysis.minDailyTrades} suffix="笔" /></Col>
              </Row>
              <Divider />
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}><h4 className="font-bold mb-3 text-sm text-slate-500">星期表现</h4><ReactECharts option={getWeekdayChartOption()} style={{ height: '240px' }} /></Col>
                <Col xs={24} lg={12}>
                  <h4 className="font-bold mb-3 text-sm text-slate-500">关键日期</h4>
                  <div className="space-y-3">
                    {analysis.frequencyAnalysis.bestDay && <div className="bg-[#f0fdf4] p-3 rounded-lg flex justify-between items-center border border-[#26a69a]/20"><div><div className="text-slate-600 text-xs">最佳交易日</div><div className="font-bold">{analysis.frequencyAnalysis.bestDay.date}</div></div><div className="text-right"><div className="text-[#26a69a] font-bold">+${analysis.frequencyAnalysis.bestDay.pnl}</div><div className="text-xs text-slate-400">{analysis.frequencyAnalysis.bestDay.count} 笔交易</div></div></div>}
                    {analysis.frequencyAnalysis.worstDay && <div className="bg-[#fef2f2] p-3 rounded-lg flex justify-between items-center border border-[#ef5350]/20"><div><div className="text-slate-600 text-xs">最差交易日</div><div className="font-bold">{analysis.frequencyAnalysis.worstDay.date}</div></div><div className="text-right"><div className="text-[#ef5350] font-bold">${analysis.frequencyAnalysis.worstDay.pnl}</div><div className="text-xs text-slate-400">{analysis.frequencyAnalysis.worstDay.count} 笔交易</div></div></div>}
                    {analysis.frequencyAnalysis.bestWeekday && <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-100"><div><div className="text-slate-600 text-xs">最佳星期</div><div className="font-bold">{analysis.frequencyAnalysis.bestWeekday.dayName}</div></div><div className="text-right"><div className="text-[#2962ff] font-bold">平均 ${analysis.frequencyAnalysis.bestWeekday.avgPnL}</div><div className="text-xs text-slate-400">胜率 {analysis.frequencyAnalysis.bestWeekday.winRate}%</div></div></div>}
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {/* ========== 资金曲线分析 ========== */}
          {analysis.equityAnalysis && (
            <div className="modern-card bg-white p-6">
              <div className="flex items-center gap-2 mb-6"><LineChartOutlined className="text-teal-500" /><span className="font-bold text-[#131722]">资金曲线分析</span></div>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={4}><Statistic title="最终盈亏" value={analysis.equityAnalysis.finalPnL} prefix="$" valueStyle={{ color: analysis.equityAnalysis.finalPnL >= 0 ? COLORS.profit : COLORS.loss }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="历史最高" value={analysis.equityAnalysis.peak} prefix="$" valueStyle={{ color: COLORS.profit }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="最大回撤" value={analysis.equityAnalysis.maxDrawdown} prefix="$" valueStyle={{ color: COLORS.loss }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="回撤比例" value={analysis.equityAnalysis.maxDrawdownPercent} suffix="%" valueStyle={{ color: COLORS.loss }} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="恢复因子" value={analysis.equityAnalysis.recoveryFactor} precision={2} /></Col>
                <Col xs={12} sm={8} md={4}><Statistic title="回撤持续" value={analysis.equityAnalysis.maxDrawdownDuration} suffix="笔" /></Col>
              </Row>
              <Divider />
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}><div className="bg-slate-50 p-4 rounded-xl text-center"><div className="text-slate-600 text-xs">交易天数</div><div className="text-2xl font-bold">{analysis.equityAnalysis.tradingDays.total}</div></div></Col>
                <Col xs={24} sm={8}><div className="bg-[#f0fdf4] p-4 rounded-xl text-center border border-[#26a69a]/20"><div className="text-slate-600 text-xs">盈利天数</div><div className="text-2xl font-bold text-[#26a69a]">{analysis.equityAnalysis.tradingDays.profitable}</div><div className="text-xs text-slate-400">{analysis.equityAnalysis.tradingDays.profitRatio}%</div></div></Col>
                <Col xs={24} sm={8}><div className="bg-[#fef2f2] p-4 rounded-xl text-center border border-[#ef5350]/20"><div className="text-slate-600 text-xs">亏损天数</div><div className="text-2xl font-bold text-[#ef5350]">{analysis.equityAnalysis.tradingDays.losing}</div></div></Col>
              </Row>
            </div>
          )}

          {/* ========== 分析时间 ========== */}
          <div className="text-center text-slate-400 text-xs py-4">分析时间: {dayjs(analysis.generatedAt).format('YYYY-MM-DD HH:mm:ss')}</div>
        </div>
      )}
      </div>

      {/* ========== 复盘说明编辑弹窗 ========== */}
      <Modal title={<div className="flex items-center gap-2"><EditOutlined className="text-blue-500" /><span className="font-bold">编辑复盘说明</span></div>} open={reviewModalVisible} onCancel={() => setReviewModalVisible(false)} onOk={handleSaveReview} okText="保存" cancelText="取消" width={600} destroyOnClose>
        {editingTrade && (
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-slate-400">品种:</span><span className="ml-2 font-bold">{editingTrade.instrumentCode}</span></div>
                <div><span className="text-slate-400">方向:</span><Tag color={editingTrade.direction === 'LONG' ? 'green' : 'red'} className="ml-2">{editingTrade.direction === 'LONG' ? '多' : '空'}</Tag></div>
                <div><span className="text-slate-400">盈亏:</span><span className={`ml-2 font-bold ${editingTrade.pnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{editingTrade.pnl >= 0 ? '+' : ''}{editingTrade.pnl?.toFixed(2)}</span></div>
                <div><span className="text-slate-400">时段:</span><span className="ml-2">{editingTrade.marketSession}</span></div>
              </div>
              <div className="mt-2 text-sm text-slate-400">开仓时间: {dayjs(editingTrade.openTime).format('YYYY-MM-DD HH:mm:ss')}</div>
            </div>
            <Form form={reviewForm} layout="vertical">
              <Form.Item name="expectedTrend" label="期望行情"><Select placeholder="选择开仓时的期望行情" allowClear options={[{ value: '看涨', label: '看涨' }, { value: '看跌', label: '看跌' }, { value: '震荡', label: '震荡' }, { value: '突破', label: '突破' }, { value: '回调', label: '回调' }]} /></Form.Item>
              <Form.Item name="logicAnalysis" label="逻辑分析"><TextArea rows={3} placeholder="分析这笔交易的逻辑依据，如：入场信号、技术形态、基本面因素等" maxLength={500} showCount /></Form.Item>
              <Form.Item name="reviewNotes" label="复盘说明"><TextArea rows={4} placeholder="记录复盘心得：为什么亏损/盈利？有哪些可以改进的地方？下次遇到类似情况如何处理？" maxLength={1000} showCount /></Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* ========== AI 问答对话框 ========== */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <RobotOutlined className="text-white" />
            </div>
            <span className="font-bold">MetWorth AI 交易助手</span>
          </div>
        }
        open={chatVisible}
        onCancel={() => setChatVisible(false)}
        footer={null}
        width={700}
        styles={{ body: { padding: 0 } }}
      >
        <div className="flex flex-col h-[500px]">
          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12">
                <RobotOutlined className="text-5xl text-slate-300 mb-4" />
                <div className="text-slate-500 font-medium">你好！我是 MetWorth AI 交易助手</div>
                <div className="text-slate-400 text-sm mt-2">我可以帮您分析交易策略、解答交易问题</div>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {['如何提高胜率？', '怎么控制回撤？', '我的交易有什么问题？', '给我一些交易建议'].map(q => (
                    <Button 
                      key={q} 
                      size="small" 
                      className="text-xs"
                      onClick={() => { setChatInput(q); }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 text-white rounded-br-md' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({children}) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                          strong: ({children}) => <strong className="font-bold">{children}</strong>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* 输入区域 */}
          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex gap-3">
              <Input
                placeholder="输入您的问题..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={handleChatSubmit}
                disabled={chatLoading}
                className="flex-1"
                size="large"
              />
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleChatSubmit}
                loading={chatLoading}
                size="large"
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AIAnalysis;
