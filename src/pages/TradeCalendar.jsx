/**
 * 交易日历模块 - 极简专业版 v3.1
 * 
 * 设计原则：
 * - 信息极简：只展示核心数据
 * - 视觉聚焦：日历是唯一主角
 * - 操作高效：悬停即可获取详情
 * - 情感化设计：复盘提醒、趋势感知
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Table, Tag, Button, Spin, Input, Popover, Empty, message
} from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined,
  EditOutlined,
  SaveOutlined,
  CalendarOutlined,
  EyeOutlined,
  RobotOutlined,
  LoadingOutlined,
  BookOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import StorageService from '../services/storage';
import RichEditor from '../components/RichEditor';
import { calculateTradeFee, getNetPnL } from '../utils/tradeCalc';
import { apiRequest } from '../services/api';

dayjs.extend(isoWeek);

const { TextArea } = Input;

const TRADING_DAY_CUTOFF_HOUR = 6;

const getTradingDate = (openTime) => {
  const tradeTime = dayjs(openTime);
  const hour = tradeTime.hour();
  if (hour < TRADING_DAY_CUTOFF_HOUR) {
    return tradeTime.subtract(1, 'day').format('YYYY-MM-DD');
  }
  return tradeTime.format('YYYY-MM-DD');
};

const getTradingMonth = (openTime) => {
  return getTradingDate(openTime).substring(0, 7);
};

const analyzeTradeData = (dayTrades, instruments = []) => {
  const trades = dayTrades || [];
  // 计算净盈亏（扣除手续费）
  const totalPnL = trades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
  // 判断盈亏时使用净盈亏
  const winTrades = trades.filter(t => getNetPnL(t, instruments) > 0);
  const lossTrades = trades.filter(t => getNetPnL(t, instruments) < 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length * 100) : 0;
  const maxWinTrade = winTrades.length > 0 ? winTrades.reduce((max, t) => getNetPnL(t, instruments) > getNetPnL(max, instruments) ? t : max) : null;
  const maxLossTrade = lossTrades.length > 0 ? lossTrades.reduce((min, t) => getNetPnL(t, instruments) < getNetPnL(min, instruments) ? t : min) : null;

  return {
    totalTrades: trades.length,
    totalPnL,
    winRate,
    winCount: winTrades.length,
    lossCount: lossTrades.length,
    maxWinTrade,
    maxLossTrade,
  };
};

// 复盘问题生成器（预留用于未来的引导式复盘功能）
const _generateReviewQuestions = (stats) => {
  const questions = [];
  questions.push({
    id: 'market_overview',
    stage: 1,
    title: '市场概览',
    question: `今日共 ${stats.totalTrades} 笔交易，净盈亏 ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}。\n\n请描述今日市场状况：`,
    placeholder: '例如：早盘震荡后突破...',
  });

  if (stats.maxWinTrade) {
    questions.push({
      id: 'best_trade',
      stage: 2,
      title: '成功复盘',
      question: `最佳交易：${stats.maxWinTrade.direction === 'LONG' ? '多' : '空'} ${stats.maxWinTrade.instrumentCode}，+$${stats.maxWinTrade.pnl.toFixed(2)}。\n\n入场信号是什么？`,
      placeholder: '例如：突破关键位入场...',
    });
  }

  questions.push({
    id: 'tomorrow',
    stage: 3,
    title: '明日计划',
    question: `明天最需要改进的一点是什么？`,
    placeholder: '例如：减少追涨...',
  });

  return questions;
};

// 悬停预览卡片 - 极简版
const HoverPreviewCard = ({ data, date, savedReview, onViewDetail, onQuickReview, instruments }) => {
  const stats = analyzeTradeData(data.trades, instruments);
  if (!stats) return null;
  
  return (
    <div style={{ width: 220 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-primary)'
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {dayjs(date).format('M月D日')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {savedReview ? (
              <span style={{ color: 'var(--color-profit)' }}><CheckCircleOutlined /> 已复盘</span>
            ) : (
              <span style={{ color: 'var(--color-brand)' }}>待复盘</span>
            )}
          </div>
        </div>
        <div style={{ 
          fontSize: 18, 
          fontWeight: 700, 
          fontFamily: 'var(--font-mono)',
          color: stats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
        }}>
          {stats.totalPnL >= 0 ? '+' : ''}${Math.abs(stats.totalPnL).toFixed(0)}
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginBottom: 12,
        fontSize: 12
      }}>
        <span style={{ color: 'var(--text-tertiary)' }}>交易 <strong style={{ color: 'var(--text-primary)' }}>{stats.totalTrades}</strong> 笔</span>
        <span style={{ color: 'var(--text-tertiary)' }}>胜率 <strong style={{ color: 'var(--text-primary)' }}>{stats.winRate.toFixed(0)}%</strong></span>
        <span>
          <span style={{ color: 'var(--color-profit)' }}>{stats.winCount}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--color-loss)' }}>{stats.lossCount}</span>
        </span>
      </div>
      
      <div style={{ display: 'flex', gap: 8 }}>
        <Button 
          size="small" 
          icon={<EyeOutlined />}
          onClick={onViewDetail}
          style={{ 
            flex: 1, 
            fontSize: 11, 
            background: 'var(--bg-tertiary)', 
            borderColor: 'var(--border-primary)', 
            color: 'var(--text-secondary)',
            borderRadius: 4
          }}
        >
          详情
        </Button>
        <Button 
          size="small" 
          type="primary"
          icon={<EditOutlined />}
          onClick={onQuickReview}
          style={{ 
            flex: 1, 
            fontSize: 11, 
            background: 'var(--color-brand)', 
            borderColor: 'var(--color-brand)', 
            color: 'var(--bg-primary)',
            borderRadius: 4
          }}
        >
          复盘
        </Button>
      </div>
    </div>
  );
};

// 趋势指示器组件
const TrendIndicator = ({ current, previous }) => {
  if (previous === 0 || previous === undefined) return null;
  const change = ((current - previous) / Math.abs(previous) * 100).toFixed(0);
  const isUp = current >= previous;
  
  return (
    <span style={{ 
      fontSize: 11, 
      fontWeight: 600,
      color: isUp ? 'var(--color-profit)' : 'var(--color-loss)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      marginLeft: 6
    }}>
      {isUp ? <RiseOutlined /> : <FallOutlined />}
      {Math.abs(change)}%
    </span>
  );
};

const TradeCalendar = ({ activeRecordId = 'all' }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [savedReviews, setSavedReviews] = useState({});
  const [instruments, setInstruments] = useState([]); // 品种配置
  
  // 移动端检测
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // 视图模式: 'calendar' | 'review'
  const [viewMode, setViewMode] = useState('calendar');
  const [reviewStats, setReviewStats] = useState(null);
  
  // 结构化复盘表单状态
  const [reviewForm, setReviewForm] = useState({
    marketCondition: '',
    followedPlan: null,
    bestDecision: '',
    worstDecision: '',
    lessonsLearned: '',
    improvementPlan: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiSummaryTitle, setAiSummaryTitle] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeSaved, setKnowledgeSaved] = useState(false);
  const [deepMode, setDeepMode] = useState(false); // 深度复盘模式
  const [aiPanelOpen, setAiPanelOpen] = useState(false); // AI 面板折叠
  const [mentalScore, setMentalScore] = useState(7); // 状态评分 1-10
  const [confidence, setConfidence] = useState('medium'); // 交易信心
  const [quickNote, setQuickNote] = useState(''); // 快速一句话总结
  
  // 根据品种配置计算单笔交易手续费（双边：开仓+平仓）
  const calculateTradeFee = (trade) => {
    const instrument = instruments.find(i => i.code === trade.instrumentCode);
    const feeRate = instrument?.feeRate || 0; // 单边手续费（每手）
    const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
    // 一笔完整交易包含开仓和平仓，所以手续费 = 单边费率 × 手数 × 2
    return feeRate * quantity * 2;
  };

  useEffect(() => {
    loadTrades();
    loadSavedReviews();
    loadInstruments();
  }, [activeRecordId]);

  const loadSavedReviews = async () => {
    const reviews = await StorageService.getAllReviews();
    const map = {};
    reviews.forEach(r => map[r.date] = r);
    setSavedReviews(map);
  };

  const loadInstruments = async () => {
    const instrumentsData = await StorageService.getInstruments();
    setInstruments(instrumentsData || []);
  };

  const loadTrades = async () => {
    setLoading(true);
    let allTrades = await StorageService.getAllTrades();
    if (activeRecordId !== 'all') allTrades = allTrades.filter(t => t.recordId === activeRecordId);
    setTrades(allTrades);
    setLoading(false);
  };

  const tradesByDate = useMemo(() => {
    const grouped = {};
    trades.forEach(t => {
      if (!t.openTime) return;
      const date = getTradingDate(t.openTime);
      if (!grouped[date]) grouped[date] = { trades: [], totalPnL: 0, winCount: 0, lossCount: 0 };
      grouped[date].trades.push(t);
      // 使用净盈亏（扣除手续费）
      const netPnL = getNetPnL(t, instruments);
      grouped[date].totalPnL += netPnL;
      if (netPnL > 0) grouped[date].winCount++;
      else if (netPnL < 0) grouped[date].lossCount++;
    });
    return grouped;
  }, [trades, instruments]);

  // 当月统计
  const monthStats = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    // 使用净盈亏（扣除手续费）
    const totalPnL = monthTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
    const winCount = monthTrades.filter(t => getNetPnL(t, instruments) > 0).length;
    const tradingDays = new Set(monthTrades.map(t => getTradingDate(t.openTime))).size;
    
    return {
      totalTrades: monthTrades.length,
      totalPnL,
      winRate: monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(0) : 0,
      tradingDays,
    };
  }, [trades, currentMonth, instruments]);

  // 上月统计（用于趋势对比）
  const prevMonthStats = useMemo(() => {
    const prevMonth = currentMonth.subtract(1, 'month');
    const monthKey = prevMonth.format('YYYY-MM');
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    // 使用净盈亏（扣除手续费）
    const totalPnL = monthTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
    const winCount = monthTrades.filter(t => getNetPnL(t, instruments) > 0).length;
    
    return {
      totalTrades: monthTrades.length,
      totalPnL,
      winRate: monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(0) : 0,
    };
  }, [trades, currentMonth, instruments]);

  // 待复盘天数
  const pendingReviewDays = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    return Object.keys(tradesByDate)
      .filter(d => d.startsWith(monthKey) && !savedReviews[d])
      .length;
  }, [tradesByDate, savedReviews, currentMonth]);

  // 周度统计（当前月的每一周）- 使用净盈亏
  const weeklyStats = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    const monthStart = currentMonth.startOf('month');
    const monthEnd = currentMonth.endOf('month');
    
    // 首先筛选出当月的所有交易（与 monthStats 使用相同的逻辑）
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    
    const weeks = [];
    let weekStart = monthStart.startOf('isoWeek');
    
    while (weekStart.isBefore(monthEnd) || weekStart.isSame(monthEnd, 'day')) {
      const weekEnd = weekStart.endOf('isoWeek');
      const weekStartStr = weekStart.format('YYYY-MM-DD');
      const weekEndStr = weekEnd.format('YYYY-MM-DD');
      
      // 计算当月内的显示日期范围
      const displayStart = weekStart.isBefore(monthStart) ? monthStart : weekStart;
      const displayEnd = weekEnd.isAfter(monthEnd) ? monthEnd : weekEnd;
      
      // 从当月交易中筛选属于本周的交易
      const weekTrades = monthTrades.filter(t => {
        const tradingDate = getTradingDate(t.openTime);
        return tradingDate >= weekStartStr && tradingDate <= weekEndStr;
      });
      
      // 使用净盈亏（扣除手续费）
      const totalPnL = weekTrades.reduce((sum, t) => sum + getNetPnL(t, instruments), 0);
      const winCount = weekTrades.filter(t => getNetPnL(t, instruments) > 0).length;
      const tradingDays = new Set(weekTrades.map(t => getTradingDate(t.openTime))).size;
      
      // 只添加属于当月的周
      const weekStartInMonth = weekStart.month() === currentMonth.month();
      const weekEndInMonth = weekEnd.month() === currentMonth.month();
      
      if (weekStartInMonth || weekEndInMonth) {
        weeks.push({
          weekNumber: weekStart.isoWeek(),
          start: displayStart.format('M/D'),
          end: displayEnd.format('M/D'),
          totalTrades: weekTrades.length,
          totalPnL,
          winRate: weekTrades.length > 0 ? (winCount / weekTrades.length * 100).toFixed(0) : 0,
          tradingDays,
          isCurrentWeek: dayjs().isoWeek() === weekStart.isoWeek() && dayjs().year() === weekStart.year(),
        });
      }
      
      weekStart = weekStart.add(1, 'week');
    }
    
    return weeks;
  }, [trades, currentMonth, instruments]);

  // 进入复盘页面
  const enterReview = (date) => {
    const dayTrades = tradesByDate[date]?.trades || [];
    const stats = analyzeTradeData(dayTrades, instruments);
    setReviewStats(stats);
    setSelectedDate(date);
    
    // 加载已保存的复盘数据（如果有）
    const existingReview = savedReviews[date];
    if (existingReview) {
      setReviewForm(existingReview);
      setAiSummary(existingReview.aiSummary || '');
      setAiSummaryTitle(existingReview.aiSummaryTitle || '');
      setKnowledgeSaved(false);
      setMentalScore(existingReview.mentalScore || 7);
      setConfidence(existingReview.confidence || 'medium');
      setQuickNote(existingReview.quickNote || '');
      setDeepMode(!!(existingReview.marketCondition || existingReview.lessonsLearned || existingReview.bestDecision || existingReview.worstDecision));
      setAiPanelOpen(!!existingReview.aiSummary);
    } else {
      setReviewForm({
        marketCondition: '',
        followedPlan: null,
        bestDecision: '',
        worstDecision: '',
        lessonsLearned: '',
        improvementPlan: '',
      });
      setAiSummary('');
      setAiSummaryTitle('');
      setKnowledgeSaved(false);
      setMentalScore(7);
      setConfidence('medium');
      setQuickNote('');
      setDeepMode(false);
      setAiPanelOpen(false);
    }
    
    setViewMode('review');
  };
  
  // 返回日历
  const backToCalendar = () => {
    setViewMode('calendar');
    setSelectedDate(null);
  };
  
  // 保存复盘
  const handleSaveReview = async () => {
    setIsSaving(true);
    try {
      // 构建复盘数据
      const reviewData = {
        date: selectedDate,
        type: 'review',
        ...reviewForm,
        aiSummary,
        aiSummaryTitle,
        mentalScore,
        confidence,
        quickNote,
        savedAt: new Date().toISOString()
      };
      
      // 保存到后端
      await StorageService.saveReview(reviewData);
      
      // 更新本地状态
      setSavedReviews(prev => ({
        ...prev,
        [selectedDate]: reviewData
      }));
      
      // 显示成功提示并返回日历
      message.success('复盘保存成功');
      setTimeout(() => {
        setIsSaving(false);
        backToCalendar();
      }, 300);
    } catch (error) {
      console.error('保存复盘失败:', error);
      message.error('保存失败，请重试');
      setIsSaving(false);
    }
  };
  
  // 前后日导航
  const navigateReviewDay = (direction) => {
    const sortedDates = Object.keys(tradesByDate).sort();
    const currentIdx = sortedDates.indexOf(selectedDate);
    const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx >= 0 && nextIdx < sortedDates.length) {
      enterReview(sortedDates[nextIdx]);
    }
  };

  // 复盘完成度计算
  const reviewCompleteness = useMemo(() => {
    let filled = 0;
    const total = 7;
    if (reviewForm.followedPlan) filled++;
    if (quickNote) filled++;
    if (mentalScore !== 7) filled++; // 非默认值算填了
    if (reviewForm.marketCondition) filled++;
    if (reviewForm.lessonsLearned || reviewForm.bestDecision || reviewForm.worstDecision) filled++;
    if (reviewForm.improvementPlan) filled++;
    if (aiSummary) filled++;
    return Math.round((filled / total) * 100);
  }, [reviewForm, quickNote, mentalScore, aiSummary]);

  // AI 自动整理复盘知识要点
  const handleAiSummarize = async () => {
    // 检查是否有足够的复盘内容
    const hasContent = reviewForm.marketCondition || reviewForm.lessonsLearned || 
                       reviewForm.bestDecision || reviewForm.worstDecision;
    if (!hasContent) {
      message.warning('请先填写复盘内容，AI 才能帮你整理要点');
      return;
    }
    
    setAiLoading(true);
    try {
      const result = await apiRequest('/ai/review-summary', {
        method: 'POST',
        body: {
          reviewData: reviewForm,
          tradeStats: reviewStats,
        }
      });
      
      if (result.success && result.summary) {
        setAiSummary(result.summary);
        setAiSummaryTitle(result.title || `${dayjs(selectedDate).format('YYYY-MM-DD')} 交易知识文档`);
        setKnowledgeSaved(false);
        message.success('AI 知识文档已生成，可编辑标题和内容');
      } else {
        message.error(result.message || 'AI 整理失败');
      }
    } catch (error) {
      console.error('AI 整理失败:', error);
      message.error('AI 服务暂时不可用，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  };

  // 保存知识文档到知识库
  const handleSaveToKnowledge = async () => {
    if (!aiSummary || aiSummary.trim() === '' || aiSummary === '<p></p>') {
      message.warning('请先生成知识文档');
      return;
    }
    setKnowledgeSaving(true);
    try {
      await apiRequest('/knowledge', {
        method: 'POST',
        body: {
          title: aiSummaryTitle || `${dayjs(selectedDate).format('YYYY-MM-DD')} 交易知识文档`,
          content: aiSummary,
          sourceDate: selectedDate,
          sourceType: 'review',
        }
      });
      setKnowledgeSaved(true);
      message.success('已保存到知识库');
    } catch (e) {
      console.error('保存到知识库失败:', e);
      message.error('保存失败，请重试');
    } finally {
      setKnowledgeSaving(false);
    }
  };

  // 复盘标签选项
  const REVIEW_TAGS = [
    { value: 'trend_follow', label: '顺势交易', color: '#10B981' },
    { value: 'counter_trend', label: '逆势交易', color: '#F43F5E' },
    { value: 'breakout', label: '突破交易', color: '#3B82F6' },
    { value: 'scalping', label: '短线剥头皮', color: '#8B5CF6' },
    { value: 'overtrading', label: '过度交易', color: '#EF4444' },
    { value: 'revenge_trade', label: '报复交易', color: '#DC2626' },
    { value: 'fomo', label: 'FOMO追涨', color: '#F97316' },
    { value: 'patient', label: '耐心等待', color: '#22C55E' },
    { value: 'discipline', label: '纪律执行', color: '#14B8A6' },
    { value: 'early_exit', label: '过早离场', color: '#FBBF24' },
    { value: 'late_exit', label: '过晚离场', color: '#F59E0B' },
    { value: 'perfect_entry', label: '完美入场', color: '#10B981' },
  ];

  const dateCellRender = (date) => {
    const key = date.format('YYYY-MM-DD');
    const data = tradesByDate[key];
    const isCurrentMonth = date.month() === currentMonth.month();
    const isWeekend = date.day() === 0 || date.day() === 6;
    
    // 非当前月份的日期 - 极简淡化
    if (!isCurrentMonth) {
      return <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.02)' }} />;
    }
    
    const isReviewed = !!savedReviews[key];
    const stats = data ? analyzeTradeData(data.trades, instruments) : null;
    const isProfit = stats?.totalPnL > 0;

    return (
      <Popover
        content={
          data && (
            <HoverPreviewCard 
              data={data}
              date={key}
              savedReview={savedReviews[key]}
              onViewDetail={() => enterReview(key)}
              onQuickReview={() => enterReview(key)}
              instruments={instruments}
            />
          )
        }
        trigger="hover"
        placement="right"
        overlayInnerStyle={{ 
          background: 'rgba(20, 20, 25, 0.9)', 
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        <div 
          style={{
            position: 'absolute',
            inset: '4px',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: data 
              ? (isProfit 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)' 
                  : 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(244, 63, 94, 0.05) 100%)')
              : (isWeekend ? 'rgba(255,255,255,0.01)' : 'transparent'),
            border: data 
              ? `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`
              : '1px solid transparent',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
            backdropFilter: data ? 'blur(4px)' : 'none',
          }}
          onClick={() => data && enterReview(key)}
          className="calendar-cell-inner"
        >
          {/* 复盘状态 - 呼吸灯效果或已复盘图标 */}
          {data && (
            isReviewed ? (
              <div style={{
                position: 'absolute',
                top: 6,
                right: 6,
                color: 'var(--color-profit)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '50%',
                width: 16,
                height: 16,
                zIndex: 2
              }}>
                <CheckCircleOutlined />
              </div>
            ) : (
              <div style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--color-brand)',
                boxShadow: '0 0 8px var(--color-brand)',
                animation: 'pulse 2s infinite',
                zIndex: 2
              }} />
            )
          )}

          {/* 盈亏金额 */}
          {data && (
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 800, 
              fontFamily: 'var(--font-mono)',
              color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)',
              letterSpacing: '-0.5px'
            }}>
              {isProfit ? '+' : '-'}${Math.abs(stats.totalPnL).toFixed(0)}
            </div>
          )}

          {/* 辅助信息 */}
          {data && (
            <div style={{ 
              fontSize: '9px', 
              color: 'var(--text-tertiary)',
              marginTop: 2,
              fontWeight: 600,
              opacity: 0.8
            }}>
              {stats.totalTrades}笔 · {stats.winRate.toFixed(0)}%
            </div>
          )}

          {/* 周末标识 */}
          {!data && isWeekend && isCurrentMonth && (
            <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', opacity: 0.2, fontWeight: 700 }}>休市</span>
          )}
        </div>
      </Popover>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin />
      </div>
    );
  }

  // ==================== 复盘页面视图 ====================
  if (viewMode === 'review' && selectedDate && reviewStats) {
    const dayData = tradesByDate[selectedDate];
    const isProfit = reviewStats.totalPnL >= 0;
    const sortedDates = Object.keys(tradesByDate).sort();
    const canGoPrev = sortedDates.indexOf(selectedDate) > 0;
    const canGoNext = sortedDates.indexOf(selectedDate) < sortedDates.length - 1;
    const totalFee = dayData?.trades.reduce((sum, t) => sum + calculateTradeFee(t), 0) || 0;
    
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', width: '100%', padding: isMobile ? 0 : '16px 24px' }}>
        {/* ===== 顶部：导航 + 统计横条 ===== */}
        <div style={{ 
          background: 'var(--bg-secondary)', borderRadius: isMobile ? 0 : 12,
          border: isMobile ? 'none' : '1px solid var(--border-primary)',
          marginBottom: isMobile ? 12 : 20, position: 'sticky', top: 0, zIndex: 100,
        }}>
          {/* 导航栏 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '10px 12px' : '10px 20px', borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button icon={<LeftOutlined />} onClick={backToCalendar} type="text" size="small" style={{ color: 'var(--text-secondary)' }}>
                {!isMobile && '日历'}
              </Button>
              <div style={{ width: 1, height: 16, background: 'var(--border-primary)' }} />
              {/* 前后日导航 */}
              <Button icon={<LeftOutlined />} type="text" size="small" disabled={!canGoPrev} onClick={() => navigateReviewDay('prev')} style={{ color: 'var(--text-tertiary)', width: 28, padding: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', minWidth: 100, textAlign: 'center' }}>
                {dayjs(selectedDate).format('M月D日')}
              </span>
              <Button icon={<RightOutlined />} type="text" size="small" disabled={!canGoNext} onClick={() => navigateReviewDay('next')} style={{ color: 'var(--text-tertiary)', width: 28, padding: 0 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 完成度 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${reviewCompleteness}%`, height: '100%', background: reviewCompleteness === 100 ? 'var(--color-profit)' : 'var(--color-brand)', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{reviewCompleteness}%</span>
              </div>
              {savedReviews[selectedDate] && <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 4, fontSize: 10, margin: 0 }}>已保存</Tag>}
              <Button type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={handleSaveReview} size="small"
                style={{ borderRadius: 6, background: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: '#000', fontWeight: 700, fontSize: 12 }}>
                保存
              </Button>
            </div>
          </div>
          {/* 统计横条 */}
          <div style={{ display: 'flex', alignItems: 'center', padding: isMobile ? '8px 12px' : '10px 20px', gap: isMobile ? 12 : 32, overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>盈亏</span>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                {isProfit ? '+' : '-'}${Math.abs(reviewStats.totalPnL).toFixed(0)}
              </span>
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border-primary)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>笔数</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{reviewStats.totalTrades}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>胜率</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{reviewStats.winRate.toFixed(0)}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>胜</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-profit)' }}>{reviewStats.winCount}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>负</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-loss)' }}>{reviewStats.lossCount}</span>
            </div>
            {totalFee > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>手续费</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-loss)' }}>-${totalFee.toFixed(0)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== 主体：左右分栏 ===== */}
        <div style={{ display: isMobile ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: '340px 1fr', gap: isMobile ? 16 : 20, alignItems: 'start', padding: isMobile ? '0 12px' : 0 }}>
          
          {/* ===== 左栏：交易明细 ===== */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, display: 'flex', flexDirection: 'column', maxHeight: isMobile ? '320px' : 'calc(100vh - 200px)', overflow: 'hidden', position: isMobile ? 'static' : 'sticky', top: 120 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>交易明细</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{dayData?.trades.length} 笔</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {dayData?.trades.sort((a, b) => new Date(a.openTime) - new Date(b.openTime)).map((trade, i) => {
                const fee = calculateTradeFee(trade);
                const qty = Math.abs(trade.openQuantity || trade.quantity || 1);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: trade.pnl >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                        {trade.direction === 'LONG' ? 'B' : 'S'}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{trade.instrumentCode}{qty > 1 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 3 }}>×{qty}</span>}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{dayjs(trade.openTime).format('HH:mm')}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== 右栏：复盘表单 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 快速复盘区 */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: isMobile ? 16 : 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>✍️ 复盘</span>
              </div>
              {/* 执行纪律 + 信心 + 状态 - 一行 */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>执行纪律</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ value: 'yes', label: '✅ 执行', color: 'var(--color-profit)' }, { value: 'partial', label: '⚠️ 部分', color: 'var(--color-brand)' }, { value: 'no', label: '❌ 偏离', color: 'var(--color-loss)' }].map(opt => (
                      <div key={opt.value} onClick={() => setReviewForm({...reviewForm, followedPlan: opt.value})}
                        style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          background: reviewForm.followedPlan === opt.value ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                          color: reviewForm.followedPlan === opt.value ? opt.color : 'var(--text-tertiary)',
                          border: reviewForm.followedPlan === opt.value ? `1px solid ${opt.color}44` : '1px solid var(--border-primary)' }}>
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>信心度</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[{ v: 'low', l: '低' }, { v: 'medium', l: '中' }, { v: 'high', l: '高' }].map(opt => (
                      <div key={opt.v} onClick={() => setConfidence(opt.v)}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: confidence === opt.v ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                          color: confidence === opt.v ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          border: confidence === opt.v ? '1px solid var(--border-hover)' : '1px solid var(--border-primary)' }}>
                        {opt.l}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>状态</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: mentalScore >= 7 ? 'var(--color-profit)' : mentalScore >= 4 ? 'var(--color-brand)' : 'var(--color-loss)' }}>{mentalScore}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(s => (
                      <div key={s} onClick={() => setMentalScore(s)} style={{ width: 14, height: 20, borderRadius: 2, cursor: 'pointer',
                        background: s <= mentalScore ? (s >= 7 ? 'rgba(16,185,129,0.6)' : s >= 4 ? 'rgba(234,179,8,0.6)' : 'rgba(244,63,94,0.6)') : 'rgba(255,255,255,0.04)' }} />
                    ))}
                  </div>
                </div>
              </div>
              {/* 一句话总结 */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>一句话总结</div>
                <Input
                  placeholder="用一句话概括今天..."
                  value={quickNote}
                  onChange={e => setQuickNote(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', borderRadius: 8 }}
                />
              </div>
              {/* 明日行动指南 */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-brand)', marginBottom: 6, fontWeight: 600 }}>明日行动指南</div>
                <RichEditor placeholder="明天最重要的1-2件事..." value={reviewForm.improvementPlan}
                  onChange={value => setReviewForm({...reviewForm, improvementPlan: value})} minHeight={80} />
              </div>
            </div>

            {/* 深度复盘（可展开） */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
              <div onClick={() => setDeepMode(!deepMode)} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>📝 深度复盘</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{deepMode ? '收起' : '展开详细分析'}</span>
                  {deepMode ? <UpOutlined style={{ fontSize: 10, color: 'var(--text-tertiary)' }} /> : <DownOutlined style={{ fontSize: 10, color: 'var(--text-tertiary)' }} />}
                </div>
              </div>
              {deepMode && (
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 20, borderTop: '1px solid var(--border-primary)', paddingTop: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>市场环境</div>
                    <RichEditor placeholder="今日行情特征、波动率、关键位置..." value={reviewForm.marketCondition}
                      onChange={value => setReviewForm({...reviewForm, marketCondition: value})} minHeight={100} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>经验教训</div>
                    <RichEditor placeholder="今日核心感悟、需要警惕的信号..." value={reviewForm.lessonsLearned}
                      onChange={value => setReviewForm({...reviewForm, lessonsLearned: value})} minHeight={100} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-profit)', marginBottom: 6 }}>最佳决策 (Keep)</div>
                      <RichEditor placeholder="值得坚持的操作..." value={reviewForm.bestDecision}
                        onChange={value => setReviewForm({...reviewForm, bestDecision: value})} minHeight={100} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-loss)', marginBottom: 6 }}>最差决策 (Change)</div>
                      <RichEditor placeholder="需要改正的操作..." value={reviewForm.worstDecision}
                        onChange={value => setReviewForm({...reviewForm, worstDecision: value})} minHeight={100} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI 知识文档（可展开） */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, overflow: 'hidden' }}>
              <div onClick={() => setAiPanelOpen(!aiPanelOpen)} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'rgba(139,92,246,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RobotOutlined style={{ color: '#8B5CF6' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>AI 交易知识文档</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>AI</span>
                </div>
                {aiPanelOpen ? <UpOutlined style={{ fontSize: 10, color: '#A78BFA' }} /> : <DownOutlined style={{ fontSize: 10, color: '#A78BFA' }} />}
              </div>
              {aiPanelOpen && (
                <div style={{ padding: 20, borderTop: '1px solid rgba(139,92,246,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      AI 基于复盘记录生成知识文档，包含行为诊断和可复用规则。
                    </div>
                    <Button icon={aiLoading ? <LoadingOutlined spin /> : <RobotOutlined />} loading={aiLoading} onClick={handleAiSummarize}
                      style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', borderColor: 'transparent', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                      {aiLoading ? '生成中...' : (aiSummary ? '重新生成' : '生成文档')}
                    </Button>
                  </div>
                  {aiLoading && (
                    <div style={{ padding: 32, textAlign: 'center', border: '1px dashed rgba(139,92,246,0.2)', borderRadius: 8 }}>
                      <LoadingOutlined style={{ fontSize: 20, color: '#8B5CF6' }} spin />
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>正在分析...</div>
                    </div>
                  )}
                  {aiSummary && !aiLoading && (
                    <div style={{ border: '1px solid rgba(139,92,246,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', background: 'rgba(139,92,246,0.05)', borderBottom: '1px solid rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#A78BFA', flexShrink: 0 }}>📄</span>
                        <Input value={aiSummaryTitle} onChange={e => setAiSummaryTitle(e.target.value)} placeholder="文档标题..." variant="borderless"
                          style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', padding: '0 4px' }} />
                        <Button icon={<BookOutlined />} size="small" loading={knowledgeSaving} disabled={knowledgeSaved} onClick={handleSaveToKnowledge}
                          style={{ background: knowledgeSaved ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)', borderColor: knowledgeSaved ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)', color: knowledgeSaved ? '#10B981' : '#A78BFA', borderRadius: 4, fontWeight: 600, fontSize: 10, flexShrink: 0 }}>
                          {knowledgeSaved ? '✓ 已收录' : '收录知识库'}
                        </Button>
                      </div>
                      <RichEditor placeholder="AI 生成的知识文档..." value={aiSummary} onChange={value => setAiSummary(value)} minHeight={250} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 日历视图 ====================
  return (
    <div className="max-w-[1600px] mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 24, padding: isMobile ? 0 : 24 }}>
      {/* 顶部：月份导航 + 核心数据 */}
      <div style={{ 
        display: 'flex', 
        alignItems: isMobile ? 'stretch' : 'center', 
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        flexWrap: 'wrap',
        gap: isMobile ? 12 : 20,
        background: 'var(--bg-secondary)', 
        border: isMobile ? 'none' : '1px solid var(--border-primary)', 
        borderRadius: isMobile ? 0 : 8, 
        padding: isMobile ? '12px' : '12px 20px' 
      }}>
        {/* 左侧：月份导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 6, padding: 2 }}>
            <Button 
              icon={<LeftOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} 
              size="small"
              style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)' }} 
            />
            <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: isMobile ? 70 : 80, textAlign: 'center', lineHeight: '24px' }}>
              {currentMonth.format('YYYY.MM')}
            </div>
            <Button 
              icon={<RightOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))} 
              size="small"
              style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)' }} 
            />
          </div>
          <Button 
            onClick={() => setCurrentMonth(dayjs())} 
            size="small" 
            style={{ 
              fontSize: 11, 
              background: 'var(--bg-tertiary)', 
              border: 'none', 
              color: 'var(--bg-primary)', 
              borderRadius: 6,
              fontWeight: 700,
              padding: '0 12px'
            }}
          >
            TODAY
          </Button>
          
          {/* 移动端：待复盘提醒 */}
          {isMobile && pendingReviewDays > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              padding: '4px 10px',
              background: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: 6
            }}>
              <div style={{ 
                width: 5, 
                height: 5, 
                borderRadius: '50%', 
                background: 'var(--color-brand)',
                animation: 'pulse 2s infinite'
              }} />
              <span style={{ fontSize: 10, color: 'var(--color-brand)', fontWeight: 700 }}>
                {pendingReviewDays} 待复盘
              </span>
            </div>
          )}
        </div>

        {/* 右侧：核心数据 + 趋势 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 32, justifyContent: isMobile ? 'space-between' : 'flex-end', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {/* 月度盈亏 */}
          <div style={{ textAlign: isMobile ? 'left' : 'right', flex: isMobile ? '1 1 auto' : 'none' }}>
            <div style={{ fontSize: isMobile ? 9 : 10, color: 'var(--text-tertiary)', marginBottom: isMobile ? 2 : 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>月度盈亏</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: isMobile ? 'flex-start' : 'flex-end', gap: 4 }}>
              <span style={{ 
                fontSize: isMobile ? 18 : 22, 
                fontWeight: 800, 
                fontFamily: 'var(--font-mono)',
                color: monthStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                letterSpacing: '-1px'
              }}>
                {monthStats.totalPnL >= 0 ? '+' : '-'}${Math.abs(monthStats.totalPnL).toLocaleString()}
              </span>
              {!isMobile && <TrendIndicator current={monthStats.totalPnL} previous={prevMonthStats.totalPnL} />}
            </div>
          </div>
          
          {!isMobile && <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)' }} />}
          
          {/* 胜率 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 9 : 10, color: 'var(--text-tertiary)', marginBottom: isMobile ? 2 : 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>胜率</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {monthStats.winRate}%
              </span>
            </div>
          </div>
          
          {/* 交易日 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 9 : 10, color: 'var(--text-tertiary)', marginBottom: isMobile ? 2 : 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>活跃</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {monthStats.tradingDays}<span style={{ fontSize: isMobile ? 9 : 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>天</span>
            </div>
          </div>

          {/* 待复盘提醒 - 桌面端 */}
          {!isMobile && pendingReviewDays > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              padding: '6px 14px',
              background: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: 8
            }}>
              <div style={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                background: 'var(--color-brand)',
                boxShadow: '0 0 10px var(--color-brand)',
                animation: 'pulse 2s infinite'
              }} />
              <span style={{ fontSize: 11, color: 'var(--color-brand)', fontWeight: 700, letterSpacing: '0.02em' }}>
                {pendingReviewDays} 天待复盘
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 主区域：日历 + 周统计侧边栏 */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 16, alignItems: 'stretch', padding: isMobile ? '0 12px' : 0 }}>
        {/* 日历 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {monthStats.totalTrades === 0 ? (
            /* 空状态 */
            <div style={{ 
              background: 'rgba(20, 20, 25, 0.6)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)', 
              borderRadius: 12,
              padding: '60px 20px',
              textAlign: 'center',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      本月暂无交易记录
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      导入交易数据后，这里将显示您的交易日历
                    </div>
                  </div>
                }
              />
            </div>
          ) : (
            <div style={{ 
              background: 'rgba(20, 20, 25, 0.6)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)', 
              borderRadius: 12, 
              overflow: 'hidden',
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Calendar
                value={currentMonth}
                onPanelChange={setCurrentMonth}
                headerRender={() => null}
                fullScreen={true}
                cellRender={(date, info) => info.type === 'date' ? dateCellRender(date) : null}
                className="trading-calendar minimal-calendar"
              />
            </div>
          )}
        </div>

        {/* 周统计侧边栏 - 移动端隐藏或折叠 */}
        {!isMobile && (
        <div style={{ 
          width: 220, 
          flexShrink: 0,
          background: 'rgba(20, 20, 25, 0.4)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.05)', 
          borderRadius: 12,
          padding: '12px', // 稍微减小内边距，为内部卡片留空间
          display: 'flex',
          flexDirection: 'column',
          gap: 0 // 改为 0，通过子元素的 margin 控制
        }}>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 700, 
            color: 'var(--text-tertiary)',
            paddingBottom: 12,
            marginBottom: 4, // 对应日历格子的 margin
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <CalendarOutlined style={{ fontSize: 13, color: 'var(--color-brand)' }} />
            周度绩效
          </div>

          {weeklyStats.length === 0 ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 12,
              fontStyle: 'italic'
            }}>
              本月暂无数据
            </div>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflowY: 'hidden' // 移除滚动，确保高度对齐
            }}>
              {weeklyStats.map((week, index) => (
                <div 
                  key={index}
                  style={{ 
                    flex: 1, // 关键：让周卡片也平分高度
                    margin: '4px 0', // 对应日历格子的 4px margin
                    padding: '12px 14px',
                    background: week.isCurrentWeek ? 'rgba(212, 175, 55, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${week.isCurrentWeek ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                    borderRadius: 10,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center' // 内容垂直居中
                  }}
                >
                  {week.isCurrentWeek && (
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: 'var(--color-brand)' }} />
                  )}

                  {/* 周标题 */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: 10
                  }}>
                    <span style={{ 
                      fontSize: '10px', 
                      color: week.isCurrentWeek ? 'var(--color-brand)' : 'var(--text-tertiary)',
                      fontWeight: 700,
                      letterSpacing: '0.02em'
                    }}>
                      {week.start} - {week.end}
                    </span>
                    {week.isCurrentWeek && (
                      <span style={{ 
                        padding: '1px 6px', 
                        background: 'var(--color-brand)', 
                        color: 'var(--bg-primary)', 
                        borderRadius: 4,
                        fontSize: '9px',
                        fontWeight: 800
                      }}>
                        本周
                      </span>
                    )}
                  </div>

                  {/* 周盈亏 */}
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 800, 
                    fontFamily: 'var(--font-mono)',
                    color: week.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                    marginBottom: 10,
                    letterSpacing: '-0.5px'
                  }}>
                    {week.totalPnL >= 0 ? '+' : '-'}${Math.abs(week.totalPnL).toFixed(0)}
                  </div>

                  {/* 周数据 */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                    fontWeight: 600
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{week.totalTrades}</span> 笔交易
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{week.winRate}%</span> 胜率
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 月度汇总 */}
          {weeklyStats.length > 0 && (
            <div style={{ 
              marginTop: 4, // 对应日历格子的 margin
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ 
                fontSize: 9, 
                color: 'var(--text-tertiary)', 
                marginBottom: 6,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                本月总计
              </div>
              <div style={{ 
                fontSize: 22, 
                fontWeight: 800, 
                fontFamily: 'var(--font-mono)',
                color: monthStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                letterSpacing: '-1px'
              }}>
                {monthStats.totalPnL >= 0 ? '+' : '-'}${Math.abs(monthStats.totalPnL).toLocaleString()}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .minimal-calendar .ant-picker-calendar-date-content {
          height: 50px !important;
          margin: 0 !important;
        }
        .minimal-calendar .ant-picker-cell-inner {
          border: 1px solid rgba(255, 255, 255, 0.03) !important;
          border-radius: 8px !important;
          margin: 4px !important;
          padding: 0 !important;
          min-height: 80px !important;
          background: rgba(255, 255, 255, 0.01) !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative !important;
          overflow: hidden !important;
          height: 100% !important;
        }
        .minimal-calendar .ant-picker-cell-inner:hover {
          border-color: rgba(255, 255, 255, 0.1) !important;
          background: rgba(255, 255, 255, 0.03) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .minimal-calendar .ant-picker-cell-selected .ant-picker-cell-inner {
          border-color: var(--color-brand) !important;
          background: rgba(212, 175, 55, 0.05) !important;
        }
        
        /* 非当前月份的日期 - 极简处理 */
        .minimal-calendar .ant-picker-cell:not(.ant-picker-cell-in-view) .ant-picker-cell-inner {
          background: transparent !important;
          border: none !important;
          opacity: 0.1 !important;
        }
        
        /* 今天的高亮 */
        .minimal-calendar .ant-picker-cell-today .ant-picker-cell-inner {
          border: 1px solid rgba(212, 175, 55, 0.3) !important;
          background: rgba(212, 175, 55, 0.03) !important;
        }
        
        /* 移动端日历优化 */
        @media (max-width: 768px) {
          .minimal-calendar .ant-picker-cell-inner {
            min-height: 56px !important;
            margin: 2px !important;
            border-radius: 6px !important;
          }
          .minimal-calendar .ant-picker-calendar-date-content {
            height: 36px !important;
          }
          .minimal-calendar .ant-picker-content th {
            font-size: 10px !important;
            padding: 8px 0 !important;
          }
        }
        
        .minimal-calendar .ant-picker-calendar-date-value {
          position: absolute !important;
          top: 8px !important;
          left: 10px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: var(--text-tertiary) !important;
          z-index: 2 !important;
          pointer-events: none !important;
          font-family: var(--font-mono) !important;
          opacity: 0.5;
        }
        .minimal-calendar .ant-picker-cell-today .ant-picker-calendar-date-value {
          color: var(--color-brand) !important;
          opacity: 1;
        }
        .minimal-calendar .ant-picker-content th {
          color: var(--text-tertiary) !important;
          font-weight: 700 !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.1em !important;
          padding: 12px 0 !important;
          opacity: 0.6;
        }
        
        /* 日历高度同步 */
        .minimal-calendar {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .minimal-calendar .ant-picker-panel,
        .minimal-calendar .ant-picker-date-panel,
        .minimal-calendar .ant-picker-body {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .minimal-calendar .ant-picker-content {
          flex: 1 !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .minimal-calendar .ant-picker-content thead {
          display: block !important;
        }
        .minimal-calendar .ant-picker-content tbody {
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
          flex: 1 !important;
        }
        .minimal-calendar .ant-picker-content thead tr {
          display: flex !important;
          width: 100% !important;
        }
        .minimal-calendar .ant-picker-content thead th {
          flex: 1 !important;
          display: block !important;
          text-align: center !important;
        }
        .minimal-calendar .ant-picker-content tbody tr {
          flex: 1 !important;
          display: flex !important;
          width: 100% !important;
        }
        .minimal-calendar .ant-picker-content tbody td {
          flex: 1 !important;
          height: auto !important;
          padding: 0 !important;
          display: block !important;
          position: relative !important;
        }
        .minimal-calendar .ant-picker-cell-inner {
          min-height: 80px !important;
          height: calc(100% - 8px) !important; /* 减去 margin 的空间 */
          margin: 4px !important; /* 统一外边距 */
        }
        .minimal-calendar .ant-picker-cell-disabled .ant-picker-cell-inner {
          background: var(--bg-primary) !important;
          border-color: transparent !important;
        }
      `}</style>
    </div>
  );
};

export default TradeCalendar;
