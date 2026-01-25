import { useState, useEffect } from 'react';
import {
  Button, Spin, Alert, Row, Col, Tag, Table, 
  Select, DatePicker, Collapse, Modal, Form, Input, 
  message, Tooltip, Popconfirm, Tabs
} from 'antd';
import {
  Bot,
  Zap,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Clock,
  LineChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Edit,
  FileText,
  Globe,
  ArrowUp,
  ArrowDown,
  Calendar,
  Flame,
  Shield,
  DollarSign,
  History,
  Trash2,
  Send,
  Plus,
  Info,
  Target,
  Gauge,
  Activity,
  ArrowLeftRight,
  CalendarDays,
  Radar,
  PieChart,
  Download,
  MessageSquare,
  Crosshair,
  AlertOctagon,
  FolderOpen,
  ChevronRight,
  Play,
  Award,
  Layers,
  Scan,
  Sparkles,
  Brain,
  ListChecks,
  User,
  GraduationCap,
} from 'lucide-react';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import ReactMarkdown from 'react-markdown';
import StorageService from '../services/storage';
import { generateAIAnalysis } from '../services/aiAnalysis';
import { aiApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Panel } = Collapse;
const { TextArea } = Input;

// 分析任务节点配置 - 使用 Lucide 图标
const ANALYSIS_STEPS = [
  { key: 'fetch', label: '获取交易数据', Icon: Download, duration: 3 },
  { key: 'stats', label: '计算基础统计', Icon: BarChart3, duration: 5 },
  { key: 'pattern', label: '识别交易模式', Icon: Scan, duration: 15 },
  { key: 'instrument', label: '分析品种表现', Icon: LineChart, duration: 20 },
  { key: 'session', label: '评估时段效率', Icon: Clock, duration: 25 },
  { key: 'risk', label: '风险指标诊断', Icon: Target, duration: 35 },
  { key: 'strategy', label: '生成策略建议', Icon: Lightbulb, duration: 55 },
  { key: 'report', label: '输出诊断报告', Icon: FileText, duration: 75 },
];

// 问题严重程度配置 - 使用 Lucide 图标
const SEVERITY_CONFIG = {
  high: { label: '严重', color: 'var(--color-loss)', bg: 'var(--color-loss-bg)', Icon: AlertOctagon },
  medium: { label: '中等', color: 'var(--color-brand)', bg: 'var(--color-brand-bg)', Icon: AlertTriangle },
  low: { label: '轻微', color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)', Icon: Lightbulb }
};

// AI 报告章节图标配置 - 使用 Lucide 图标组件
const REPORT_SECTION_ICONS = {
  '账户诊断概览': Gauge,
  '诊断概览': Gauge,
  '概览': Gauge,
  '核心指标': Target,
  '核心洞察': Sparkles,
  '问题识别': AlertTriangle,
  '品种表现': LineChart,
  '品种分析': LineChart,
  '时段分析': Clock,
  '执行质量': Crosshair,
  '风险管理': Shield,
  '交易心理': Brain,
  '改进建议': Lightbulb,
  '行动计划': ListChecks,
  '行动清单': ListChecks,
  '策略诊断': Target,
  '策略优化': Sparkles,
  '交易者画像': User,
  '学习建议': GraduationCap,
  '风险警报': AlertOctagon,
  '总结': FileText
};

// 解析 AI 报告内容为结构化数据
const parseAIReport = (markdown) => {
  if (!markdown) return { sections: [], summary: null, insights: [] };
  
  const sections = [];
  const insights = [];
  let summary = null;
  
  // 按二级标题分割
  const parts = markdown.split(/(?=^##\s)/m);
  
  parts.forEach((part, index) => {
    const titleMatch = part.match(/^##\s+(.+)/);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      const content = part.replace(/^##\s+.+\n?/, '').trim();
      
      // 为每个章节分配 Lucide 图标组件
      let Icon = FileText; // 默认图标
      Object.keys(REPORT_SECTION_ICONS).forEach(key => {
        if (title.includes(key)) {
          Icon = REPORT_SECTION_ICONS[key];
        }
      });
      
      sections.push({
        id: `section-${index}`,
        title,
        Icon,
        content,
        isFirst: index === 0 || index === 1
      });
      
      // 提取第一个章节作为摘要
      if (index === 1 && title.includes('概览')) {
        summary = content;
      }
    }
  });
  
  // 提取关键洞察（查找带有强调标记的内容）
  const coreInsightMatch = markdown.match(/核心洞察[：:]\s*(.+?)(?=\n|$)/);
  if (coreInsightMatch) {
    insights.push({
      type: 'core',
      Icon: Target,
      title: '核心问题',
      content: coreInsightMatch[1].trim()
    });
  }
  
  // 提取金额数据
  const lossMatch = markdown.match(/亏损[：:]?\s*\$?(-?[\d,]+)/);
  if (lossMatch) {
    insights.push({
      type: 'loss',
      Icon: TrendingDown,
      title: '主要损失',
      content: `$${lossMatch[1]}`
    });
  }
  
  // 提取首要改进建议
  const improvementMatch = markdown.match(/(?:首要|优先|建议)[：:]\s*(.+?)(?=\n|$)/);
  if (improvementMatch) {
    insights.push({
      type: 'improvement',
      Icon: Lightbulb,
      title: '首要改进',
      content: improvementMatch[1].trim().substring(0, 30)
    });
  }
  
  return { sections, summary, insights };
};

// ========== 报告章节组件（重新设计）==========
const ReportSection = ({ section, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const SectionIcon = section.Icon || FileText;
  
  return (
    <div 
      className="report-section mb-4 transition-all duration-300"
      style={{ 
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        overflow: 'hidden'
      }}
    >
      {/* 章节头部 */}
      <div 
        className="flex items-center justify-between px-5 py-4 cursor-pointer transition-all duration-200"
        onClick={() => setExpanded(!expanded)}
        style={{ 
          background: expanded ? 'var(--bg-secondary)' : 'var(--bg-primary)',
          borderBottom: expanded ? '1px solid var(--border-primary)' : 'none'
        }}
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
            style={{ 
              background: expanded ? 'var(--color-brand)' : 'var(--bg-tertiary)'
            }}
          >
            <SectionIcon size={18} style={{ color: expanded ? 'var(--bg-primary)' : 'var(--text-secondary)' }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{section.title}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {section.content?.substring(0, 40)}...
            </div>
          </div>
        </div>
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300"
          style={{ 
            background: 'var(--bg-tertiary)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}
        >
          <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
        </div>
      </div>
      
      {/* 章节内容 */}
      {expanded && (
        <div className="p-5 report-section-content" style={{ background: 'var(--bg-secondary)' }}>
          <ReactMarkdown
            components={{
              h3: ({children}) => (
                <h3 className="text-sm font-bold mt-5 mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span className="w-1 h-4 rounded-full" style={{ background: 'var(--color-brand)' }}></span>
                  {children}
                </h3>
              ),
              p: ({children}) => (
                <p className="text-sm leading-7 mb-4" style={{ color: 'var(--text-secondary)' }}>{children}</p>
              ),
              ul: ({children}) => (
                <ul className="space-y-3 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</ul>
              ),
              li: ({children}) => (
                <li className="flex items-start gap-3 pl-1" style={{ color: 'var(--text-secondary)' }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0" style={{ background: 'var(--color-brand)' }} />
                  <span className="flex-1 leading-6">{children}</span>
                </li>
              ),
              strong: ({children}) => <strong style={{ color: 'var(--color-brand)' }} className="font-semibold">{children}</strong>,
              em: ({children}) => <em style={{ color: 'var(--color-profit)' }} className="not-italic font-medium">{children}</em>,
              blockquote: ({children}) => (
                <blockquote className="pl-4 py-3 my-4 text-sm rounded-r-lg" style={{ borderLeft: '3px solid var(--color-brand)', background: 'var(--color-brand-bg)' }}>
                  <div style={{ color: 'var(--text-primary)' }}>{children}</div>
                </blockquote>
              ),
            }}
          >
            {section.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// ========== 洞察卡片组件（重新设计）==========
const InsightCard = ({ Icon, title, content, type }) => {
  const getTypeStyle = () => {
    switch (type) {
      case 'core':
        return { bg: 'var(--color-loss-bg)', borderColor: 'var(--color-loss)', color: 'var(--color-loss)', iconBg: 'var(--color-loss)' };
      case 'loss':
        return { bg: 'var(--color-loss-bg)', borderColor: 'var(--border-primary)', color: 'var(--color-loss)', iconBg: 'var(--color-loss)' };
      case 'improvement':
        return { bg: 'var(--color-profit-bg)', borderColor: 'var(--color-profit)', color: 'var(--color-profit)', iconBg: 'var(--color-profit)' };
      default:
        return { bg: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)', iconBg: 'var(--text-secondary)' };
    }
  };
  
  const style = getTypeStyle();
  const InsightIcon = Icon || Info;
  
  return (
    <div 
      className="p-4 rounded-lg transition-all duration-200 hover:translate-y-[-2px]"
      style={{ 
        background: style.bg, 
        borderLeft: `3px solid ${style.borderColor}`
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: style.iconBg }}
        >
          <InsightIcon size={14} style={{ color: '#fff' }} />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      <div className="text-base font-bold font-mono" style={{ color: style.color }}>
        {content}
      </div>
    </div>
  );
};

// ========== 统计卡片组件 ==========
const StatCard = ({ icon: IconComponent, label, value, valueColor, subText, bgColor }) => (
  <div 
    className="p-5 rounded-lg"
    style={{ 
      background: bgColor || 'var(--bg-primary)', 
      border: '1px solid var(--border-primary)'
    }}
  >
    <div className="flex items-center gap-2 mb-3">
      {IconComponent && (
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
          <IconComponent size={14} style={{ color: 'var(--text-secondary)' }} />
        </div>
      )}
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
    <div className="text-2xl font-bold font-mono" style={{ color: valueColor || 'var(--text-primary)' }}>
      {value}
    </div>
    {subText && (
      <div className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{subText}</div>
    )}
  </div>
);

const AIAnalysis = ({ activeRecordId = 'all' }) => {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({
    instrument: 'ALL',
    dateRange: null,
    recordId: activeRecordId || 'all',
    useAllTime: false,
  });
  
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(null);
  
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [reviewForm] = Form.useForm();

  useEffect(() => {
    loadInstruments();
    loadRecords();
    loadHistory();
    setAnalysis(null);
  }, [activeRecordId]);

  useEffect(() => {
    let interval;
    const isAnalyzing = loading || aiLoading;
    
    if (isAnalyzing) {
      setAnalysisProgress(0);
      setCurrentStep(0);
      setElapsedTime(0);
      
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          let step = 0;
          for (let i = ANALYSIS_STEPS.length - 1; i >= 0; i--) {
            if (newTime >= ANALYSIS_STEPS[i].duration) {
              step = i + 1;
              break;
            }
          }
          setCurrentStep(Math.min(step, ANALYSIS_STEPS.length - 1));
          const maxProgress = 95;
          const progress = Math.min(Math.floor((newTime / 80) * maxProgress), maxProgress);
          setAnalysisProgress(progress);
          return newTime;
        });
      }, 1000);
    } else {
      if (analysis?.success || aiResult?.success) {
        setAnalysisProgress(100);
        setCurrentStep(ANALYSIS_STEPS.length);
      }
    }
    
    return () => clearInterval(interval);
  }, [loading, aiLoading, analysis, aiResult]);

  const loadInstruments = async () => {
    const instList = await StorageService.getInstruments();
    setInstruments(instList);
  };

  const loadRecords = async () => {
    try {
      const allRecords = await StorageService.getAllRecords();
      setRecords(allRecords.filter(r => r.status === 'active'));
    } catch (e) {
      console.error('加载账本失败:', e);
    }
  };

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

  const viewHistoryDetail = async (id) => {
    try {
      const detail = await aiApi.getAnalysis(id);
      setViewingHistory(detail);
      setAnalysis(null);
    } catch (e) {
      message.error('加载详情失败');
    }
  };

  const deleteHistory = async (id) => {
    try {
      await aiApi.deleteAnalysis(id);
      message.success('删除成功');
      loadHistory();
      if (viewingHistory?.id === id) {
        setViewingHistory(null);
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setAiLoading(true);
    setAnalysis(null);
    setAiResult(null);
    
    try {
      const result = await generateAIAnalysis({
        recordId: filters.recordId,
        instrumentCode: filters.instrument,
        startDate: filters.useAllTime ? null : (filters.dateRange?.[0]?.format('YYYY-MM-DD') || null),
        endDate: filters.useAllTime ? null : (filters.dateRange?.[1]?.format('YYYY-MM-DD') || null),
      });
      
      if (result.success) {
        setAnalysis(result);
        if (result.aiReport) {
          setAiResult({ success: true, analysis: result.aiReport, generatedAt: new Date() });
        }
        loadHistory();
      } else {
        setAnalysis({ success: false, message: result.message || '分析失败' });
      }
    } catch (e) {
      console.error('分析失败:', e);
      setAnalysis({ success: false, message: e.message || '分析失败，请重试' });
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  };

  const handleDeepAnalyze = async () => {
    if (!analysis?.success) {
      message.warning('请先完成基础分析');
      return;
    }
    
    setAiLoading(true);
    try {
      const result = await aiApi.analyze({
        trades: analysis.trades,
        summary: analysis.summary,
        patterns: analysis.patterns,
        problems: analysis.problems,
        riskAnalysis: analysis.riskAnalysis,
      });
      
      if (result.success) {
        setAiResult(result);
        loadHistory();
      } else {
        setAiResult({ success: false, message: result.message });
      }
    } catch (e) {
      console.error('AI 深度分析失败:', e);
      setAiResult({ success: false, message: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    
    try {
      const context = aiResult?.analysis || viewingHistory?.report || '';
      const result = await aiApi.chat({
        message: userMessage,
        context: context,
        history: chatMessages,
      });
      
      if (result.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
      } else {
        message.error(result.message || '回复失败');
      }
    } catch (e) {
      message.error('请求失败，请重试');
    } finally {
      setChatLoading(false);
    }
  };

  const openReviewModal = (trade) => {
    setEditingTrade(trade);
    reviewForm.setFieldsValue({
      logicAnalysis: trade.logicAnalysis || '',
      reviewNotes: trade.reviewNotes || '',
    });
    setReviewModalVisible(true);
  };

  const handleSaveReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      await StorageService.updateTrade(editingTrade.id, values);
      message.success('复盘保存成功');
      setReviewModalVisible(false);
    } catch (e) {
      console.error('保存失败:', e);
    }
  };

  // 图表配置
  const getSessionChartOption = () => {
    const sessionData = analysis?.patterns?.sessionPerformance || [];
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0d0d10',
        borderColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        textStyle: { color: '#ffffff' }
      },
      grid: { top: 40, right: 20, bottom: 40, left: 60 },
      xAxis: {
        type: 'category',
        data: sessionData.map(s => s.session),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#9ca3af', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }
      },
      series: [{
        name: '盈亏',
        type: 'bar',
        data: sessionData.map(s => ({
          value: s.totalPnL,
          itemStyle: { color: s.totalPnL >= 0 ? '#10b981' : '#f43f5e', borderRadius: [4, 4, 0, 0] }
        })),
        barWidth: 32,
      }]
    };
  };

  const getInstrumentChartOption = () => {
    const instData = analysis?.patterns?.instrumentPerformance || [];
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0d0d10',
        borderColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        textStyle: { color: '#ffffff' }
      },
      grid: { top: 40, right: 20, bottom: 40, left: 60 },
      xAxis: {
        type: 'category',
        data: instData.map(i => i.instrument),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#9ca3af', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } }
      },
      series: [{
        name: '盈亏',
        type: 'bar',
        data: instData.map(i => ({
          value: i.totalPnL,
          itemStyle: { color: i.totalPnL >= 0 ? '#10b981' : '#f43f5e', borderRadius: [4, 4, 0, 0] }
        })),
        barWidth: 32,
      }]
    };
  };

  // 加载动画组件
  const LoadingOverlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(24, 26, 32, 0.9)' }}>
      <div className="max-w-xl w-full mx-6 p-8 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        {/* 进度头部 */}
        <div className="flex items-center gap-5 mb-8">
          <div className="relative">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="35" fill="none" stroke="var(--bg-tertiary)" strokeWidth="5" />
              <circle 
                cx="40" cy="40" r="35" 
                fill="none" 
                stroke="var(--color-brand)" 
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${analysisProgress * 2.2} 220`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-brand)' }}>{analysisProgress}%</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>AI 深度分析中</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              已用时 {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')} · 预计剩余 {Math.max(0, 80 - elapsedTime)}s
            </div>
          </div>
        </div>
        
        {/* 步骤列表 */}
        <div className="space-y-3">
          {ANALYSIS_STEPS.map((step, index) => {
            const StepIcon = step.Icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <div 
                key={step.key}
                className="flex items-center gap-4 px-4 py-3 rounded-lg transition-all"
                style={{ 
                  background: isCurrent ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
                  border: isCurrent ? '1px solid var(--color-brand)' : '1px solid transparent',
                  opacity: index > currentStep ? 0.4 : 1
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ 
                    background: isCompleted ? 'var(--color-profit)' : isCurrent ? 'var(--color-brand)' : 'var(--bg-secondary)'
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle size={14} style={{ color: '#fff' }} />
                  ) : (
                    <StepIcon size={14} style={{ color: isCurrent ? 'var(--bg-primary)' : 'var(--text-secondary)' }} />
                  )}
                </div>
                <span 
                  className="text-sm font-medium flex-1"
                  style={{ color: isCurrent ? 'var(--color-brand)' : isCompleted ? 'var(--color-profit)' : 'var(--text-secondary)' }}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-brand)' }} />
                )}
                {isCompleted && (
                  <span className="text-xs" style={{ color: 'var(--color-profit)' }}>完成</span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 提示信息 */}
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--color-brand-bg)' }}>
          <div className="flex items-center gap-3">
            <Lightbulb size={16} style={{ color: 'var(--color-brand)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              AI 正在多维度分析您的交易数据，请耐心等待...
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 min-h-full">
      {/* 加载遮罩 */}
      {(loading || aiLoading) && <LoadingOverlay />}

      {/* ========== 左侧历史记录面板（重新设计）========== */}
      <div className="w-72 flex-shrink-0">
        <div 
          className="rounded-lg sticky top-4" 
          style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)',
            maxHeight: 'calc(100vh - 120px)', 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column' 
          }}
        >
          {/* 面板头部 */}
          <div 
            className="px-4 py-4 flex items-center justify-between" 
            style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
                <History size={14} style={{ color: 'var(--bg-primary)' }} />
              </div>
              <div>
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>分析历史</span>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{historyList.length} 条记录</div>
              </div>
            </div>
            <Button 
              type="primary" 
              size="small" 
              icon={<Plus size={12} />}
              onClick={() => { setViewingHistory(null); setAnalysis(null); }}
              style={{ 
                background: 'var(--color-brand)', 
                borderColor: 'var(--color-brand)',
                color: 'var(--bg-primary)',
                fontWeight: 600,
                borderRadius: 6,
                height: 28
              }}
            >
              新建
            </Button>
          </div>

          {/* 历史列表 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 history-scroll" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {historyLoading ? (
              <div className="flex justify-center py-12"><Spin /></div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-16">
                <div 
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <Bot size={28} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>暂无分析记录</p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>点击上方按钮开始分析</p>
              </div>
            ) : (
              historyList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg cursor-pointer transition-all duration-200 hover:translate-x-1"
                  style={{ 
                    background: viewingHistory?.id === item.id ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                    border: viewingHistory?.id === item.id ? '1px solid var(--color-brand)' : '1px solid transparent'
                  }}
                  onClick={() => viewHistoryDetail(item.id)}
                >
                  {/* 头部 */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm truncate flex-1 pr-2" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                    <Popconfirm
                      title={<span style={{ color: 'var(--text-primary)' }}>确定删除？</span>}
                      onConfirm={(e) => { e?.stopPropagation(); deleteHistory(item.id); }}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true, size: 'small' }}
                      cancelButtonProps={{ size: 'small' }}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Trash2 size={12} />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ opacity: 0.5, height: 24, width: 24, padding: 0 }}
                      />
                    </Popconfirm>
                  </div>
                  
                  {/* 账本和时间 */}
                  <div className="text-xs mb-2 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--color-brand)' }}>{item.recordName || '全部账本'}</span>
                    <span>·</span>
                    <span>{dayjs(item.createdAt).format('MM-DD HH:mm')}</span>
                  </div>
                  
                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1.5">
                    <Tag style={{ 
                      background: item.totalPnL >= 0 ? 'var(--color-profit-bg)' : 'var(--color-loss-bg)', 
                      color: item.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                      border: 'none',
                      fontSize: 10,
                      lineHeight: '16px',
                      padding: '2px 6px',
                      borderRadius: 4
                    }}>
                      {item.totalPnL >= 0 ? '+' : ''}${item.totalPnL?.toFixed(0)}
                    </Tag>
                    <Tag style={{ 
                      background: 'var(--bg-secondary)', 
                      color: 'var(--text-secondary)', 
                      border: 'none', 
                      fontSize: 10,
                      lineHeight: '16px',
                      padding: '2px 6px',
                      borderRadius: 4
                    }}>
                      {item.totalTrades}笔
                    </Tag>
                    {item.overallScore && (
                      <Tag style={{ 
                        background: item.overallScore >= 60 ? 'var(--color-profit-bg)' : 'var(--color-loss-bg)',
                        color: item.overallScore >= 60 ? 'var(--color-profit)' : 'var(--color-loss)',
                        border: 'none',
                        fontSize: 10,
                        lineHeight: '16px',
                        padding: '2px 6px',
                        borderRadius: 4
                      }}>
                        {item.overallScore}分
                      </Tag>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ========== 右侧主内容区 ========== */}
      <div className="flex-1 space-y-6 min-w-0">

        {/* 查看历史分析 */}
        {viewingHistory && (
          <div className="space-y-5">
            {/* 返回按钮 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
                  <FileText size={18} style={{ color: 'var(--bg-primary)' }} />
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{viewingHistory.title}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    生成于 {dayjs(viewingHistory.createdAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => { setViewingHistory(null); setAnalysis(null); }}
                icon={<Plus size={14} />}
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
              >
                新建分析
              </Button>
            </div>
            
            {/* 概览卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard 
                icon={Award}
                label="综合评分"
                value={viewingHistory.overallScore || '--'}
                valueColor={viewingHistory.overallScore >= 60 ? 'var(--color-profit)' : 'var(--color-loss)'}
                subText={viewingHistory.overallLevel || '待评估'}
                bgColor="var(--bg-tertiary)"
              />
              <StatCard 
                icon={DollarSign}
                label="总盈亏"
                value={`${viewingHistory.totalPnL >= 0 ? '+' : ''}$${viewingHistory.totalPnL?.toLocaleString()}`}
                valueColor={viewingHistory.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
              />
              <StatCard 
                icon={Target}
                label="交易笔数"
                value={viewingHistory.totalTrades}
              />
              <StatCard 
                icon={Gauge}
                label="胜率"
                value={`${viewingHistory.winRate?.toFixed(1)}%`}
              />
              <StatCard 
                icon={Activity}
                label="盈亏比"
                value={viewingHistory.profitLossRatio?.toFixed(2)}
                valueColor="var(--color-brand)"
              />
            </div>

            {/* AI 报告 */}
            <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              {/* 报告头部 */}
              <div 
                className="px-5 py-4 flex justify-between items-center" 
                style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
                    <Bot size={18} style={{ color: 'var(--bg-primary)' }} />
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>AI 智能诊断报告</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Powered by MetWorth AI · DeepSeek</div>
                  </div>
                </div>
                <Button
                  size="small"
                  icon={<MessageSquare size={14} />}
                  onClick={() => setChatVisible(true)}
                  style={{
                    background: 'transparent',
                    borderColor: 'var(--color-brand)',
                    color: 'var(--color-brand)',
                    fontWeight: 600,
                    borderRadius: 6
                  }}
                >
                  向教练提问
                </Button>
              </div>
              
              {/* 报告内容 */}
              <div className="p-5">
                {(() => {
                  const { sections, insights } = parseAIReport(viewingHistory.report);
                  const hasStructuredContent = sections.length > 2;
                  
                  if (hasStructuredContent) {
                    return (
                      <div>
                        {/* 关键洞察 */}
                        {insights.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {insights.map((insight, idx) => (
                              <InsightCard 
                                key={idx}
                                Icon={insight.Icon}
                                title={insight.title}
                                content={insight.content}
                                type={insight.type}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* 报告章节 */}
                        <div className="space-y-0">
                          {sections.map((section, idx) => (
                            <div key={idx} id={`history-${section.id}`}>
                              <ReportSection 
                                section={section} 
                                defaultExpanded={idx < 2}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="prose max-w-none ai-report-content">
                      <ReactMarkdown
                        components={{
                          h2: ({children}) => <h2 className="text-base font-semibold mt-6 mb-3 pb-2" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)' }}>{children}</h2>,
                          h3: ({children}) => <h3 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h3>,
                          p: ({children}) => <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{children}</p>,
                          li: ({children}) => <li className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{children}</li>,
                          strong: ({children}) => <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>,
                        }}
                      >
                        {viewingHistory.report}
                      </ReactMarkdown>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* 无分析时的欢迎页（重新设计）*/}
        {!analysis && !viewingHistory && !loading && (
          <div 
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            {/* 头部横幅 */}
            <div 
              className="p-8 relative overflow-hidden"
              style={{ 
                background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
                borderBottom: '1px solid var(--border-primary)'
              }}
            >
              <div className="relative z-10 text-center max-w-xl mx-auto">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 overflow-hidden"
                  style={{ background: 'var(--color-brand)' }}
                >
                  <img src="/logo.png" alt="AI Coach" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>新建 AI 分析</h2>
                <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  选择分析范围，AI 将为您生成专业的交易诊断报告，<br/>
                  包含品种分析、时段表现、风险评估和策略建议
                </p>
              </div>
              {/* 装饰元素 */}
              <div 
                className="absolute top-4 right-4 w-32 h-32 rounded-full opacity-10"
                style={{ background: 'var(--color-brand)' }}
              />
              <div 
                className="absolute bottom-0 left-8 w-20 h-20 rounded-full opacity-5"
                style={{ background: 'var(--color-brand)' }}
              />
            </div>

            {/* 配置区域 */}
            <div className="p-6">
              <div className="max-w-2xl mx-auto space-y-4">
                {/* 账本选择 */}
                <div 
                  className="p-5 rounded-lg flex items-center justify-between"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-11 h-11 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--color-brand-bg)' }}
                    >
                      <FolderOpen size={18} style={{ color: 'var(--color-brand)' }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>选择账本</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>选择要分析的交易账本</div>
                    </div>
                  </div>
                  <Select 
                    value={filters.recordId} 
                    onChange={(v) => setFilters({ ...filters, recordId: v })} 
                    style={{ width: 180 }}
                    options={[
                      { value: 'all', label: '全部账本' },
                      ...records.map(r => ({ value: r.id, label: r.name }))
                    ]} 
                  />
                </div>

                {/* 时间范围选择 */}
                <div 
                  className="p-5 rounded-lg"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-11 h-11 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--color-profit-bg)' }}
                      >
                        <Calendar size={18} style={{ color: 'var(--color-profit)' }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>交易日期</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>选择要分析的时间范围</div>
                      </div>
                    </div>
                    <Button 
                      type={filters.useAllTime ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setFilters({ ...filters, useAllTime: !filters.useAllTime, dateRange: null })}
                      style={filters.useAllTime ? {
                        background: 'var(--color-profit)',
                        borderColor: 'var(--color-profit)',
                        color: '#fff'
                      } : {}}
                    >
                      {filters.useAllTime ? '已选全部时间' : '全部时间'}
                    </Button>
                  </div>
                  {!filters.useAllTime && (
                    <RangePicker 
                      value={filters.dateRange} 
                      onChange={(v) => setFilters({ ...filters, dateRange: v, useAllTime: false })} 
                      size="middle"
                      className="w-full"
                      placeholder={['开始日期', '结束日期']}
                      format="YYYY-MM-DD"
                    />
                  )}
                  {filters.useAllTime && (
                    <div 
                      className="text-center py-3 text-sm rounded-lg"
                      style={{ background: 'var(--color-profit-bg)', color: 'var(--color-profit)' }}
                    >
                      将分析该账本的全部交易数据
                    </div>
                  )}
                </div>

                {/* 品种筛选 */}
                <div 
                  className="p-5 rounded-lg flex items-center justify-between"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-11 h-11 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--color-brand-bg)' }}
                    >
                      <Globe size={18} style={{ color: 'var(--color-brand)' }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>交易品种</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>可选，筛选特定品种</div>
                    </div>
                  </div>
                  <Select 
                    value={filters.instrument} 
                    onChange={(v) => setFilters({ ...filters, instrument: v })} 
                    style={{ width: 180 }} 
                    options={[{ value: 'ALL', label: '全部品种' }, ...instruments.map(i => ({ value: i.code, label: i.code }))]} 
                  />
                </div>
              </div>

              {/* 开始分析按钮 */}
              <div className="max-w-2xl mx-auto mt-8 text-center">
                <Button 
                  type="primary" 
                  onClick={handleAnalyze} 
                  size="large" 
                  icon={<Play size={16} />}
                  disabled={!filters.useAllTime && !filters.dateRange}
                  className="px-16 h-12 text-base font-semibold"
                  style={{
                    background: (!filters.useAllTime && !filters.dateRange) ? 'var(--bg-tertiary)' : 'var(--color-brand)',
                    borderColor: (!filters.useAllTime && !filters.dateRange) ? 'var(--border-primary)' : 'var(--color-brand)',
                    color: (!filters.useAllTime && !filters.dateRange) ? 'var(--text-secondary)' : 'var(--bg-primary)',
                    borderRadius: 8
                  }}
                >
                  开始分析
                </Button>
                {!filters.useAllTime && !filters.dateRange && (
                  <p className="text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
                    请选择时间范围或点击"全部时间"
                  </p>
                )}
              </div>

              {/* 功能说明 */}
              <div className="max-w-2xl mx-auto mt-8 grid grid-cols-4 gap-4">
                {[
                  { icon: BarChart3, label: '品种分析' },
                  { icon: Clock, label: '时段表现' },
                  { icon: Shield, label: '风险评估' },
                  { icon: Lightbulb, label: '策略建议' }
                ].map((item, idx) => (
                  <div key={idx} className="text-center p-4 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                    <div 
                      className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                      style={{ background: 'var(--bg-tertiary)' }}
                    >
                      <item.icon size={16} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      {analysis && !analysis.success && !viewingHistory && <Alert message="分析失败" description={analysis.message} type="error" showIcon />}

      {analysis && analysis.success && !viewingHistory && (
        <div className="space-y-5">
          {/* ========== 报告头部 - 综合评分仪表盘（重新设计）========== */}
          <div 
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            {/* 评分头部 */}
            <div 
              className="px-6 py-5 flex items-center gap-6"
              style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
            >
              {/* 评分环 */}
              <div className="relative flex-shrink-0">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                  <circle 
                    cx="50" cy="50" r="42" 
                    fill="none" 
                    stroke={analysis.summary.overallRating.score >= 60 ? 'var(--color-profit)' : 'var(--color-loss)'} 
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${analysis.summary.overallRating.score * 2.64} 264`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span 
                    className="text-2xl font-black font-mono"
                    style={{ color: analysis.summary.overallRating.score >= 60 ? 'var(--color-profit)' : 'var(--color-loss)' }}
                  >
                    {analysis.summary.overallRating.score}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>/ 100</span>
                </div>
              </div>

              {/* 评分信息 */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>综合评分</span>
                  <Tag 
                    style={{ 
                      background: analysis.summary.overallRating.score >= 80 ? 'var(--color-profit-bg)' : 
                                  analysis.summary.overallRating.score >= 60 ? 'var(--color-brand-bg)' : 'var(--color-loss-bg)',
                      color: analysis.summary.overallRating.score >= 80 ? 'var(--color-profit)' : 
                             analysis.summary.overallRating.score >= 60 ? 'var(--color-brand)' : 'var(--color-loss)',
                      border: 'none',
                      borderRadius: 4,
                      fontWeight: 600
                    }}
                  >
                    {analysis.summary.overallRating.level}
                  </Tag>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  基于 {analysis.summary.totalTrades || analysis.patterns?.total || 0} 笔交易的综合表现评估
                </p>
              </div>
            </div>

            {/* 核心指标网格 */}
            <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                icon={DollarSign}
                label="总盈亏"
                value={`${analysis.summary.totalPnL >= 0 ? '+' : ''}${analysis.summary.totalPnL.toLocaleString()}`}
                valueColor={analysis.summary.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
                subText="USD"
              />
              <div 
                className="p-5 rounded-lg"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                    <Target size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>胜率</span>
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {analysis.summary.winRate}%
                </div>
                <div className="h-1.5 mt-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${analysis.summary.winRate}%`, 
                      background: analysis.summary.winRate >= 50 ? 'var(--color-profit)' : 'var(--color-loss)'
                    }}
                  />
                </div>
              </div>
              <StatCard 
                icon={Activity}
                label="利润系数"
                value={analysis.summary.profitFactor === Infinity ? '∞' : analysis.summary.profitFactor.toFixed(2)}
                valueColor="var(--color-brand)"
                subText={analysis.summary.profitFactor >= 2 ? '优秀' : analysis.summary.profitFactor >= 1.5 ? '良好' : '待提升'}
              />
              <div 
                className="p-5 rounded-lg"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                    <ArrowLeftRight size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>交易笔数</span>
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {analysis.summary.totalTrades || analysis.patterns?.total || '--'}
                </div>
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-profit)' }}>
                    <TrendingUp size={10} /> {analysis.summary.winTrades || Math.round((analysis.summary.winRate / 100) * (analysis.summary.totalTrades || 0))}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-loss)' }}>
                    <TrendingDown size={10} /> {analysis.summary.lossTrades || Math.round(((100 - analysis.summary.winRate) / 100) * (analysis.summary.totalTrades || 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========== AI 智能诊断报告（重新设计）========== */}
          <div 
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
            <div 
              className="px-5 py-4 flex justify-between items-center" 
              style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
                  <Bot size={18} style={{ color: 'var(--bg-primary)' }} />
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>AI 智能诊断报告</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Powered by MetWorth AI · DeepSeek</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {aiResult?.success && (
                  <>
                    <Tag style={{ background: 'var(--color-profit-bg)', color: 'var(--color-profit)', border: 'none', borderRadius: 4 }}>
                      <CheckCircle size={12} className="mr-1" />已生成
                    </Tag>
                    <Button 
                      size="small"
                      icon={<MessageSquare size={14} />} 
                      onClick={() => setChatVisible(true)}
                      style={{
                        background: 'transparent',
                        borderColor: 'var(--color-brand)',
                        color: 'var(--color-brand)',
                        fontWeight: 600,
                        borderRadius: 6
                      }}
                    >
                      向教练提问
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div className="p-5">
              {aiLoading ? (
                <div className="py-6 text-center">
                  <Spin size="large" />
                  <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>AI 分析中...</p>
                </div>
              ) : aiResult?.success ? (
                (() => {
                  const { sections, insights } = parseAIReport(aiResult.analysis);
                  const hasStructuredContent = sections.length > 2;
                  
                  return (
                    <div className="ai-report-modern">
                      {/* 关键洞察卡片 */}
                      {hasStructuredContent && insights.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          {insights.map((insight, idx) => (
                            <InsightCard 
                              key={idx}
                              Icon={insight.Icon}
                              title={insight.title}
                              content={insight.content}
                              type={insight.type}
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* 报告目录 */}
                      {hasStructuredContent && (
                        <div 
                          className="p-4 rounded-lg mb-6"
                          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Layers size={14} style={{ color: 'var(--color-brand)' }} />
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>报告目录</span>
                            <span 
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                              {sections.length} 个章节
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {sections.map((section, idx) => {
                              const SectionIcon = section.Icon;
                              return (
                                <button
                                  key={idx}
                                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:translate-y-[-1px] flex items-center gap-2"
                                  style={{ 
                                    background: 'var(--bg-tertiary)', 
                                    color: 'var(--text-secondary)', 
                                    border: '1px solid var(--border-primary)' 
                                  }}
                                  onClick={() => {
                                    const el = document.getElementById(section.id);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }}
                                >
                                  <SectionIcon size={12} />
                                  {section.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* 报告章节 */}
                      {hasStructuredContent ? (
                        <div className="space-y-0">
                          {sections.map((section, idx) => (
                            <div key={idx} id={section.id}>
                              <ReportSection 
                                section={section} 
                                defaultExpanded={section.isFirst || idx < 2}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ReactMarkdown
                          components={{
                            hr: () => <hr style={{ borderColor: 'var(--border-primary)' }} className="my-6" />,
                            h2: ({children}) => (
                              <h2 className="flex items-center gap-2 text-base font-bold mt-8 mb-4 pb-3" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)' }}>
                                <span className="w-1 h-5 rounded-full" style={{ background: 'var(--color-brand)' }} />
                                {children}
                              </h2>
                            ),
                            h3: ({children}) => <h3 className="text-sm font-bold mt-5 mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h3>,
                            p: ({children}) => <p className="text-sm leading-7 mb-3" style={{ color: 'var(--text-secondary)' }}>{children}</p>,
                            ul: ({children}) => <ul className="space-y-2 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</ul>,
                            li: ({children}) => (
                              <li className="flex items-start gap-3 pl-2" style={{ color: 'var(--text-secondary)' }}>
                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: 'var(--color-brand)' }} />
                                <span className="flex-1 leading-6">{children}</span>
                              </li>
                            ),
                            strong: ({children}) => <strong style={{ color: 'var(--text-primary)' }} className="font-semibold">{children}</strong>,
                          }}
                        >
                          {aiResult.analysis}
                        </ReactMarkdown>
                      )}
                      
                      {/* 报告底部 */}
                      <div className="mt-8 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        <div className="flex items-center gap-2">
                          <Bot size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>MetWorth AI 智能分析引擎</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {dayjs(aiResult.generatedAt).format('YYYY-MM-DD HH:mm')}
                          </span>
                          <Button 
                            type="text" 
                            size="small"
                            icon={<MessageSquare size={14} />}
                            onClick={() => setChatVisible(true)}
                            style={{ color: 'var(--color-brand)' }}
                          >
                            追问
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : aiResult?.message ? (
                <Alert message={aiResult.message} type="warning" showIcon />
              ) : (
                <div className="text-center py-12">
                  <div 
                    className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center overflow-hidden"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <img src="/logo.png" alt="AI Coach" className="w-full h-full object-cover opacity-60" />
                  </div>
                  <div className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>生成 AI 深度诊断报告</div>
                  <p className="text-sm max-w-md mx-auto mb-6 leading-6" style={{ color: 'var(--text-secondary)' }}>
                    AI 将对您的交易数据进行全方位分析，生成专业诊断报告
                  </p>
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<Zap size={16} />}
                    onClick={handleDeepAnalyze}
                    className="px-10 h-12"
                    style={{ 
                      background: 'var(--color-brand)', 
                      borderColor: 'var(--color-brand)',
                      color: 'var(--bg-primary)',
                      borderRadius: 8
                    }}
                  >
                    开始深度分析
                  </Button>
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1"><Clock size={12} /> 预计 60-90 秒</span>
                    <span className="flex items-center gap-1"><Shield size={12} /> 数据安全加密</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========== 问题诊断中心（重新设计）========== */}
          {analysis.problems && analysis.problems.length > 0 && (
            <div 
              className="rounded-lg overflow-hidden"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
            >
              {/* 头部 */}
              <div className="p-5" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--color-loss-bg)' }}
                    >
                      <AlertTriangle size={18} style={{ color: 'var(--color-loss)' }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>问题诊断中心</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>AI 识别的交易问题与改进建议</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {['high', 'medium', 'low'].map(severity => {
                      const count = analysis.problems.filter(p => p.severity === severity).length;
                      if (count === 0) return null;
                      const config = SEVERITY_CONFIG[severity];
                      return (
                        <div 
                          key={severity} 
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                          style={{ background: config.bg }}
                        >
                          <config.Icon size={12} style={{ color: config.color }} />
                          <span className="text-xs font-medium" style={{ color: config.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 问题统计 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>发现问题</div>
                    <div className="text-xl font-bold font-mono" style={{ color: 'var(--color-loss)' }}>{analysis.problems.length}</div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>关联交易</div>
                    <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                      {analysis.problems.reduce((acc, p) => acc + (p.trades?.length || 0), 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>累计影响</div>
                    <div className="text-xl font-bold font-mono" style={{ color: 'var(--color-loss)' }}>
                      -${Math.abs(analysis.problems.reduce((acc, p) => acc + (p.totalLoss || 0), 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* 问题列表 */}
              <div className="p-4 space-y-3">
                {analysis.problems.map((problem, index) => {
                  const severity = SEVERITY_CONFIG[problem.severity] || SEVERITY_CONFIG.medium;
                  return (
                    <div 
                      key={index} 
                      className="rounded-lg overflow-hidden"
                      style={{ 
                        background: 'var(--bg-primary)', 
                        border: `1px solid ${problem.severity === 'high' ? 'var(--color-loss)' : 'var(--border-primary)'}`
                      }}
                    >
                      <Collapse 
                        ghost 
                        expandIconPosition="end"
                        className="problem-collapse"
                        defaultActiveKey={problem.severity === 'high' ? [0] : []}
                      >
                        <Panel 
                          key={0}
                          header={
                            <div className="flex items-center gap-4 py-3">
                              <div 
                                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ background: severity.bg }}
                              >
                                <severity.Icon size={18} style={{ color: severity.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{problem.type}</span>
                                  <Tag 
                                    style={{ 
                                      background: severity.bg, 
                                      color: severity.color, 
                                      border: 'none',
                                      fontSize: 10,
                                      padding: '2px 6px',
                                      lineHeight: '16px',
                                      borderRadius: 4
                                    }}
                                  >
                                    {severity.label}
                                  </Tag>
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                                  {problem.description?.substring(0, 60)}...
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                {problem.totalLoss !== undefined && (
                                  <div className="font-bold font-mono" style={{ color: 'var(--color-loss)' }}>
                                    -${Math.abs(problem.totalLoss).toLocaleString()}
                                  </div>
                                )}
                                {problem.trades?.length > 0 && (
                                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {problem.trades.length} 笔相关
                                  </div>
                                )}
                              </div>
                            </div>
                          }
                        >
                          <div className="px-4 pb-4 space-y-4">
                            {/* 问题详情 */}
                            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                              <div className="flex items-start gap-3">
                                <Info size={14} style={{ color: severity.color, marginTop: 3 }} />
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>问题描述</div>
                                  <div className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{problem.description}</div>
                                </div>
                              </div>
                            </div>

                            {/* 建议 */}
                            <div 
                              className="p-4 rounded-lg"
                              style={{ background: 'var(--color-brand-bg)', borderLeft: '3px solid var(--color-brand)' }}
                            >
                              <div className="flex items-start gap-3">
                                <Lightbulb size={14} style={{ color: 'var(--color-brand)', marginTop: 3 }} />
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-brand)' }}>优化建议</div>
                                  <div className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{problem.recommendation}</div>
                                </div>
                              </div>
                            </div>

                            {/* 关联交易 */}
                            {problem.trades && problem.trades.length > 0 && (
                              <div>
                                <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                                  关联交易 ({problem.trades.length})
                                </div>
                                <Table 
                                  dataSource={problem.trades.map((t, i) => ({ ...t, key: t.id || i }))} 
                                  size="small" 
                                  pagination={problem.trades.length > 5 ? { pageSize: 5, size: 'small' } : false}
                                  className="binance-table compact-table"
                                  columns={[
                                    { 
                                      title: '时间', 
                                      dataIndex: 'openTime', 
                                      width: 130,
                                      render: t => (
                                        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                                          {dayjs(t).format('MM-DD HH:mm:ss')}
                                        </span>
                                      )
                                    },
                                    { 
                                      title: '品种', 
                                      dataIndex: 'instrumentCode', 
                                      width: 70,
                                      render: c => (
                                        <Tag style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', fontSize: 11 }}>{c}</Tag>
                                      )
                                    },
                                    { 
                                      title: '方向', 
                                      dataIndex: 'direction', 
                                      width: 50,
                                      render: d => (
                                        <span style={{ color: d === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                                          {d === 'LONG' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        </span>
                                      )
                                    },
                                    { 
                                      title: '盈亏', 
                                      dataIndex: 'pnl', 
                                      width: 90, 
                                      align: 'right',
                                      render: p => (
                                        <span className="font-bold font-mono" style={{ color: p >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                                          {p >= 0 ? '+' : ''}{p?.toFixed(2)}
                                        </span>
                                      )
                                    },
                                    { 
                                      title: '', 
                                      key: 'action', 
                                      width: 36,
                                      render: (_, r) => (
                                        <Tooltip title="添加复盘">
                                          <Button 
                                            type="text" 
                                            size="small" 
                                            icon={<Edit size={12} />} 
                                            onClick={() => openReviewModal(r)} 
                                            style={{ color: 'var(--text-secondary)', padding: 4 }}
                                          />
                                        </Tooltip>
                                      )
                                    }
                                  ]} 
                                />
                              </div>
                            )}
                          </div>
                        </Panel>
                      </Collapse>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========== 多维度分析模块（重新设计）========== */}
          {analysis.patterns && (
            <div 
              className="rounded-lg overflow-hidden"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
            >
              <Tabs
                defaultActiveKey="session"
                className="analysis-tabs"
                tabBarStyle={{ 
                  padding: '0 20px',
                  marginBottom: 0,
                  borderBottom: '1px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)'
                }}
                items={[
                  {
                    key: 'session',
                    label: (
                      <span className="flex items-center gap-2">
                        <CalendarDays size={14} />
                        时段分析
                      </span>
                    ),
                    children: (
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>交易时段表现</div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>不同时段的盈亏与胜率对比</div>
                          </div>
                          {analysis.patterns.sessionPerformance && (
                            <div className="flex gap-2">
                              {analysis.patterns.sessionPerformance.slice(0, 3).map((s, i) => (
                                <div key={i} className="text-center px-3 py-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{s.session}</div>
                                  <div className="text-sm font-bold font-mono" style={{ color: s.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                                    {s.totalPnL >= 0 ? '+' : ''}{s.totalPnL}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <ReactECharts option={getSessionChartOption()} style={{ height: '300px' }} />
                      </div>
                    )
                  },
                  {
                    key: 'instrument',
                    label: (
                      <span className="flex items-center gap-2">
                        <PieChart size={14} />
                        品种分析
                      </span>
                    ),
                    children: (
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>品种表现分析</div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>各交易品种的盈亏表现</div>
                          </div>
                          {analysis.patterns.instrumentPerformance && (
                            <div className="flex gap-2">
                              {analysis.patterns.instrumentPerformance.slice(0, 3).map((inst, i) => (
                                <Tag 
                                  key={i}
                                  style={{ 
                                    background: inst.totalPnL >= 0 ? 'var(--color-profit-bg)' : 'var(--color-loss-bg)',
                                    color: inst.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                                    border: 'none'
                                  }}
                                >
                                  {inst.instrument}: {inst.totalPnL >= 0 ? '+' : ''}{inst.totalPnL}
                                </Tag>
                              ))}
                            </div>
                          )}
                        </div>
                        <ReactECharts option={getInstrumentChartOption()} style={{ height: '300px' }} />
                      </div>
                    )
                  },
                  {
                    key: 'direction',
                    label: (
                      <span className="flex items-center gap-2">
                        <ArrowLeftRight size={14} />
                        多空对比
                      </span>
                    ),
                    children: analysis.patterns?.directionPerformance && (
                      <div className="p-5">
                        <div className="mb-4">
                          <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>多空交易对比</div>
                          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>多头与空头交易的表现对比</div>
                        </div>
                        <Row gutter={[16, 16]}>
                          <Col xs={24} md={12}>
                            <div 
                              className="p-5 rounded-lg h-full"
                              style={{ background: 'var(--color-profit-bg)', borderLeft: '3px solid var(--color-profit)' }}
                            >
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-profit)' }}>
                                  <ArrowUp size={20} style={{ color: '#fff' }} />
                                </div>
                                <div>
                                  <div className="font-bold" style={{ color: 'var(--color-profit)' }}>多头交易</div>
                                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>LONG Positions</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.patterns.directionPerformance.LONG.totalTrades}</div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>笔数</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold font-mono" style={{ color: analysis.patterns.directionPerformance.LONG.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                                    {analysis.patterns.directionPerformance.LONG.totalPnL >= 0 ? '+' : ''}{analysis.patterns.directionPerformance.LONG.totalPnL}
                                  </div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>盈亏</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.patterns.directionPerformance.LONG.winRate}%</div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>胜率</div>
                                </div>
                              </div>
                            </div>
                          </Col>
                          <Col xs={24} md={12}>
                            <div 
                              className="p-5 rounded-lg h-full"
                              style={{ background: 'var(--color-loss-bg)', borderLeft: '3px solid var(--color-loss)' }}
                            >
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-loss)' }}>
                                  <ArrowDown size={20} style={{ color: '#fff' }} />
                                </div>
                                <div>
                                  <div className="font-bold" style={{ color: 'var(--color-loss)' }}>空头交易</div>
                                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>SHORT Positions</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.patterns.directionPerformance.SHORT.totalTrades}</div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>笔数</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold font-mono" style={{ color: analysis.patterns.directionPerformance.SHORT.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                                    {analysis.patterns.directionPerformance.SHORT.totalPnL >= 0 ? '+' : ''}{analysis.patterns.directionPerformance.SHORT.totalPnL}
                                  </div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>盈亏</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.patterns.directionPerformance.SHORT.winRate}%</div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>胜率</div>
                                </div>
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </div>
                    )
                  }
                ]}
              />
            </div>
          )}

          {/* ========== 风险与收益指标面板（重新设计）========== */}
          {(analysis.riskAnalysis || analysis.executionQualityAnalysis?.hasData) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 风险收益指标 */}
              {analysis.riskAnalysis && (
                <div 
                  className="rounded-lg overflow-hidden"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                  <div 
                    className="px-5 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand-bg)' }}>
                      <Radar size={16} style={{ color: 'var(--color-brand)' }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>风险收益指标</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk-Return Metrics</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>期望值</div>
                        <div className="text-xl font-bold font-mono" style={{ color: analysis.riskAnalysis.expectancy >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                          ${analysis.riskAnalysis.expectancy}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>盈亏比</div>
                        <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {analysis.riskAnalysis.profitLossRatio.toFixed(2)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>夏普比率</div>
                        <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {analysis.riskAnalysis.sharpeRatio.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div 
                        className="flex-1 p-3 rounded-lg"
                        style={{ background: 'var(--color-profit-bg)', borderLeft: '3px solid var(--color-profit)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>最大盈利</span>
                          <span className="text-lg font-bold font-mono" style={{ color: 'var(--color-profit)' }}>+${analysis.riskAnalysis.maxProfit}</span>
                        </div>
                      </div>
                      <div 
                        className="flex-1 p-3 rounded-lg"
                        style={{ background: 'var(--color-loss-bg)', borderLeft: '3px solid var(--color-loss)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>最大亏损</span>
                          <span className="text-lg font-bold font-mono" style={{ color: 'var(--color-loss)' }}>-${analysis.riskAnalysis.maxLoss}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 执行质量分析 */}
              {analysis.executionQualityAnalysis?.hasData && (
                <div 
                  className="rounded-lg overflow-hidden"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                  <div 
                    className="px-5 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-profit-bg)' }}>
                      <Crosshair size={16} style={{ color: 'var(--color-profit)' }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>执行质量 (MAE/MFE)</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{analysis.executionQualityAnalysis.totalTrades} 笔有效数据</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>平均 MAE</div>
                        <div className="text-lg font-bold font-mono" style={{ color: 'var(--color-loss)' }}>
                          {analysis.executionQualityAnalysis.overall.avgMAETicks}t
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>≈ ${analysis.executionQualityAnalysis.overall.avgMAEUsd}</div>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>平均 MFE</div>
                        <div className="text-lg font-bold font-mono" style={{ color: 'var(--color-profit)' }}>
                          {analysis.executionQualityAnalysis.overall.avgMFETicks}t
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>≈ ${analysis.executionQualityAnalysis.overall.avgMFEUsd}</div>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>MFE/MAE 比</div>
                        <div className="text-lg font-bold font-mono" style={{ color: 'var(--color-brand)' }}>
                          {analysis.executionQualityAnalysis.overall.mfeMaeRatio}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>精准入场率</span>
                          <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                            {analysis.executionQualityAnalysis.entryPrecision.precisionRate}%
                          </span>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>利润捕获率</span>
                          <span 
                            className="text-lg font-bold font-mono"
                            style={{ color: analysis.executionQualityAnalysis.profitCapture.captureRatio >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
                          >
                            {analysis.executionQualityAnalysis.profitCapture.captureRatio}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== 交易心理与连续性分析（重新设计）========== */}
          {(analysis.streaksAnalysis || analysis.equityAnalysis) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 连续交易分析 */}
              {analysis.streaksAnalysis && (
                <div 
                  className="rounded-lg overflow-hidden"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                  <div 
                    className="px-5 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand-bg)' }}>
                      <Flame size={16} style={{ color: 'var(--color-brand)' }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>连续交易分析</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Streak Analysis</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div 
                        className="p-4 rounded-lg text-center"
                        style={{ background: 'var(--color-profit-bg)', borderTop: '3px solid var(--color-profit)' }}
                      >
                        <TrendingUp size={20} className="mx-auto mb-2" style={{ color: 'var(--color-profit)' }} />
                        <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-profit)' }}>{analysis.streaksAnalysis.maxWinStreak}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>最长连胜</div>
                        <div className="text-xs mt-1 font-mono" style={{ color: 'var(--color-profit)' }}>+${analysis.streaksAnalysis.maxWinStreakPnL}</div>
                      </div>
                      <div 
                        className="p-4 rounded-lg text-center"
                        style={{ background: 'var(--color-loss-bg)', borderTop: '3px solid var(--color-loss)' }}
                      >
                        <TrendingDown size={20} className="mx-auto mb-2" style={{ color: 'var(--color-loss)' }} />
                        <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-loss)' }}>{analysis.streaksAnalysis.maxLossStreak}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>最长连亏</div>
                        <div className="text-xs mt-1 font-mono" style={{ color: 'var(--color-loss)' }}>${analysis.streaksAnalysis.maxLossStreakPnL}</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>情绪影响分析</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>亏损后胜率</span>
                          <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.streaksAnalysis.afterLoss.winRate}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>盈利后胜率</span>
                          <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.streaksAnalysis.afterWin.winRate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 资金曲线分析 */}
              {analysis.equityAnalysis && (
                <div 
                  className="rounded-lg overflow-hidden"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                  <div 
                    className="px-5 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-profit-bg)' }}>
                      <LineChart size={16} style={{ color: 'var(--color-profit)' }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>资金曲线分析</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Equity Curve</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xl font-bold font-mono" style={{ color: analysis.equityAnalysis.finalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                          ${analysis.equityAnalysis.finalPnL}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>最终盈亏</div>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xl font-bold font-mono" style={{ color: 'var(--color-profit)' }}>
                          ${analysis.equityAnalysis.peak}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>历史最高</div>
                      </div>
                      <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                        <div className="text-xl font-bold font-mono" style={{ color: 'var(--color-loss)' }}>
                          -{analysis.equityAnalysis.maxDrawdownPercent}%
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>最大回撤</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>恢复因子</span>
                          <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.equityAnalysis.recoveryFactor.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>交易天数</span>
                          <span className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{analysis.equityAnalysis.tradingDays.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 分析时间 */}
          <div className="text-center text-xs py-4" style={{ color: 'var(--text-secondary)' }}>
            分析时间: {dayjs(analysis.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
          </div>
        </div>
      )}
      </div>

      {/* ========== 复盘说明编辑弹窗 ========== */}
      <Modal 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 6, 
              background: 'var(--color-brand-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Edit size={16} style={{ color: 'var(--color-brand)' }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>编辑复盘说明</span>
          </div>
        } 
        open={reviewModalVisible} 
        onCancel={() => setReviewModalVisible(false)} 
        onOk={handleSaveReview} 
        okText="保存" 
        cancelText="取消" 
        width={600}
        okButtonProps={{
          style: {
            background: 'var(--color-brand)',
            borderColor: 'var(--color-brand)',
            color: 'var(--bg-primary)',
            fontWeight: 600,
            borderRadius: 4
          }
        }}
        cancelButtonProps={{
          style: {
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
            borderRadius: 4
          }
        }}
      >
        {editingTrade && (
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>品种:</span>
                  <span className="ml-2 font-bold" style={{ color: 'var(--text-primary)' }}>{editingTrade.instrumentCode}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>方向:</span>
                  <Tag className="ml-2" style={{ 
                    background: editingTrade.direction === 'LONG' ? 'var(--color-profit-bg)' : 'var(--color-loss-bg)',
                    color: editingTrade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)',
                    border: 'none'
                  }}>
                    {editingTrade.direction === 'LONG' ? '多' : '空'}
                  </Tag>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>盈亏:</span>
                  <span className="ml-2 font-bold font-mono" style={{ color: editingTrade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                    {editingTrade.pnl >= 0 ? '+' : ''}{editingTrade.pnl?.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>时段:</span>
                  <span className="ml-2" style={{ color: 'var(--text-primary)' }}>{editingTrade.marketSession}</span>
                </div>
              </div>
            </div>
            <Form form={reviewForm} layout="vertical">
              <Form.Item name="logicAnalysis" label={<span style={{ color: 'var(--text-secondary)' }}>逻辑分析</span>}>
                <TextArea rows={3} placeholder="分析这笔交易的逻辑依据..." />
              </Form.Item>
              <Form.Item name="reviewNotes" label={<span style={{ color: 'var(--text-secondary)' }}>复盘说明</span>}>
                <TextArea rows={4} placeholder="记录复盘心得..." />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* ========== AI 问答对话框 ========== */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 6, 
              background: 'var(--color-brand)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Bot size={16} style={{ color: 'var(--bg-primary)' }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>MetWorth AI 交易助手</span>
          </div>
        }
        open={chatVisible}
        onCancel={() => setChatVisible(false)}
        footer={null}
        width={700}
      >
        <div className="flex flex-col h-[500px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: 'var(--bg-tertiary)' }}>
            {chatMessages.length === 0 ? (
              <div className="text-center py-12">
                <Bot size={48} className="mb-4 mx-auto" style={{ color: 'var(--text-secondary)' }} />
                <div className="font-medium" style={{ color: 'var(--text-secondary)' }}>你好！我是 MetWorth AI 交易助手</div>
                <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>我可以帮您分析交易策略、解答交易问题</div>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {['如何提高胜率？', '怎么控制回撤？', '我的交易有什么问题？'].map(q => (
                    <Button key={q} size="small" onClick={() => setChatInput(q)}>{q}</Button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className="max-w-[80%] rounded-2xl px-4 py-3"
                    style={{ 
                      background: msg.role === 'user' ? 'var(--color-brand)' : 'var(--bg-secondary)',
                      color: msg.role === 'user' ? 'var(--bg-primary)' : 'var(--text-primary)',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
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
                <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4" style={{ borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
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
                icon={<Send size={14} />}
                onClick={handleChatSubmit}
                loading={chatLoading}
                size="large"
                style={{
                  background: 'var(--color-brand)',
                  borderColor: 'var(--color-brand)',
                  color: 'var(--bg-primary)'
                }}
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        /* 表格样式 */
        .binance-table .ant-table {
          background: transparent !important;
        }
        .binance-table .ant-table-thead > tr > th {
          background: var(--bg-tertiary) !important;
          color: var(--text-secondary) !important;
          border-bottom: 1px solid var(--border-primary) !important;
          font-size: 11px;
          padding: 8px 12px !important;
        }
        .binance-table .ant-table-tbody > tr > td {
          background: var(--bg-secondary) !important;
          border-bottom: 1px solid var(--border-primary) !important;
          padding: 8px 12px !important;
        }
        .binance-table .ant-table-tbody > tr:hover > td {
          background: var(--bg-hover) !important;
        }
        .compact-table .ant-table-tbody > tr > td {
          padding: 6px 10px !important;
        }
        
        /* 问题卡片折叠样式 */
        .problem-collapse .ant-collapse-header {
          padding: 0 16px !important;
          background: transparent !important;
        }
        .problem-collapse .ant-collapse-content-box {
          padding: 0 !important;
        }
        .problem-collapse .ant-collapse-expand-icon {
          color: var(--text-secondary) !important;
        }
        
        /* 分析模块 Tabs 样式 */
        .analysis-tabs .ant-tabs-nav {
          margin-bottom: 0 !important;
        }
        .analysis-tabs .ant-tabs-tab {
          padding: 14px 20px !important;
          color: var(--text-secondary) !important;
          font-size: 13px !important;
        }
        .analysis-tabs .ant-tabs-tab-active {
          color: var(--text-primary) !important;
        }
        .analysis-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: var(--text-primary) !important;
        }
        .analysis-tabs .ant-tabs-ink-bar {
          background: var(--color-brand) !important;
          height: 2px !important;
        }
        
        /* 历史列表滚动条 */
        .history-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .history-scroll::-webkit-scrollbar-track {
          background: var(--bg-tertiary);
          border-radius: 2px;
        }
        .history-scroll::-webkit-scrollbar-thumb {
          background: var(--border-primary);
          border-radius: 2px;
        }
        .history-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--text-secondary);
        }
        
        /* 报告章节动画 */
        .report-section {
          transition: all 0.2s ease;
        }
        .report-section:hover {
          border-color: var(--border-secondary) !important;
        }
        
        .report-section-content {
          animation: fadeInUp 0.3s ease-out;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AIAnalysis;
