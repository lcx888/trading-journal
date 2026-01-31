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
  Calendar, Table, Tag, Button, Spin, Input, Popover, Empty
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import StorageService from '../services/storage';

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

const analyzeTradeData = (dayTrades) => {
  const trades = dayTrades || [];
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winTrades = trades.filter(t => t.pnl > 0);
  const lossTrades = trades.filter(t => t.pnl < 0);
  const winRate = trades.length > 0 ? (winTrades.length / trades.length * 100) : 0;
  const maxWinTrade = winTrades.length > 0 ? winTrades.reduce((max, t) => t.pnl > max.pnl ? t : max) : null;
  const maxLossTrade = lossTrades.length > 0 ? lossTrades.reduce((min, t) => t.pnl < min.pnl ? t : min) : null;

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

const generateReviewQuestions = (stats) => {
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
const HoverPreviewCard = ({ data, date, savedReview, onViewDetail, onQuickReview }) => {
  const stats = analyzeTradeData(data.trades);
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
  
  // 根据品种配置计算单笔交易手续费
  const calculateTradeFee = (trade) => {
    const instrument = instruments.find(i => i.code === trade.instrumentCode);
    const feeRate = instrument?.feeRate || 0; // 每手手续费
    const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
    return feeRate * quantity;
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
      grouped[date].totalPnL += t.pnl || 0;
      if (t.pnl > 0) grouped[date].winCount++;
      else if (t.pnl < 0) grouped[date].lossCount++;
    });
    return grouped;
  }, [trades]);

  // 当月统计
  const monthStats = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    const totalPnL = monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winCount = monthTrades.filter(t => t.pnl > 0).length;
    const tradingDays = new Set(monthTrades.map(t => getTradingDate(t.openTime))).size;
    
    return {
      totalTrades: monthTrades.length,
      totalPnL,
      winRate: monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(0) : 0,
      tradingDays,
    };
  }, [trades, currentMonth]);

  // 上月统计（用于趋势对比）
  const prevMonthStats = useMemo(() => {
    const prevMonth = currentMonth.subtract(1, 'month');
    const monthKey = prevMonth.format('YYYY-MM');
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    const totalPnL = monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winCount = monthTrades.filter(t => t.pnl > 0).length;
    
    return {
      totalTrades: monthTrades.length,
      totalPnL,
      winRate: monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(0) : 0,
    };
  }, [trades, currentMonth]);

  // 待复盘天数
  const pendingReviewDays = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    return Object.keys(tradesByDate)
      .filter(d => d.startsWith(monthKey) && !savedReviews[d])
      .length;
  }, [tradesByDate, savedReviews, currentMonth]);

  // 周度统计（当前月的每一周）
  const weeklyStats = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    const monthStart = currentMonth.startOf('month');
    const monthEnd = currentMonth.endOf('month');
    
    const weeks = [];
    let weekStart = monthStart.startOf('isoWeek');
    
    while (weekStart.isBefore(monthEnd) || weekStart.isSame(monthEnd, 'day')) {
      const weekEnd = weekStart.endOf('isoWeek');
      
      // 筛选这一周的交易
      const weekTrades = trades.filter(t => {
        const tradeDate = dayjs(getTradingDate(t.openTime));
        return tradeDate.isAfter(weekStart.subtract(1, 'day')) && 
               tradeDate.isBefore(weekEnd.add(1, 'day')) &&
               getTradingMonth(t.openTime) === monthKey;
      });
      
      const totalPnL = weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winCount = weekTrades.filter(t => t.pnl > 0).length;
      const tradingDays = new Set(weekTrades.map(t => getTradingDate(t.openTime))).size;
      
      // 只添加有交易或属于当月的周
      const weekStartInMonth = weekStart.month() === currentMonth.month();
      const weekEndInMonth = weekEnd.month() === currentMonth.month();
      
      if (weekStartInMonth || weekEndInMonth) {
        weeks.push({
          weekNumber: weekStart.isoWeek(),
          start: weekStart.format('M/D'),
          end: weekEnd.format('M/D'),
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
  }, [trades, currentMonth]);

  // 进入复盘页面
  const enterReview = (date) => {
    const dayTrades = tradesByDate[date]?.trades || [];
    const stats = analyzeTradeData(dayTrades);
    setReviewStats(stats);
    setSelectedDate(date);
    
    // 加载已保存的复盘数据（如果有）
    const existingReview = savedReviews[date];
    if (existingReview) {
      setReviewForm(existingReview);
    } else {
      setReviewForm({
        marketCondition: '',
        followedPlan: null,
        bestDecision: '',
        worstDecision: '',
        lessonsLearned: '',
        improvementPlan: '',
      });
    }
    
    setViewMode('review');
  };
  
  // 返回日历
  const backToCalendar = () => {
    setViewMode('calendar');
    setSelectedDate(null);
  };
  
  // 保存复盘
  const saveReview = async () => {
    setIsSaving(true);
    try {
      // 保存到本地状态
      const newSavedReviews = {
        ...savedReviews,
        [selectedDate]: { ...reviewForm, savedAt: new Date().toISOString() }
      };
      setSavedReviews(newSavedReviews);
      
      // 保存到本地存储
      StorageService.saveReviews(newSavedReviews);
      
      // 显示成功提示
      setTimeout(() => {
        setIsSaving(false);
        setReviewDrawerVisible(false);
      }, 500);
    } catch (error) {
      console.error('保存复盘失败:', error);
      setIsSaving(false);
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
    const isToday = date.isSame(dayjs(), 'day');
    
    // 非当前月份的日期 - 极简淡化
    if (!isCurrentMonth) {
      return <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.02)' }} />;
    }
    
    const isReviewed = !!savedReviews[key];
    const stats = data ? analyzeTradeData(data.trades) : null;
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
    
    return (
      <div className="max-w-[1600px] mx-auto p-6" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 24,
        animation: 'fadeIn 0.4s ease-out',
        width: '100%'
      }}>
        {/* 顶部导航 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid var(--border-primary)'
        }}>
          <Button 
            icon={<LeftOutlined />} 
            onClick={backToCalendar}
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid var(--border-primary)', 
              color: 'var(--text-secondary)',
              borderRadius: 8,
              fontSize: 12
            }}
          >
            返回日历
          </Button>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 2
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
              {dayjs(selectedDate).format('YYYY年M月D日')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Daily Trade Performance Review
            </div>
          </div>
          <div style={{ width: 88 }} />
        </div>

        {/* 三栏布局：统计摘要 + 交易列表 + 复盘表单 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '280px 380px 1fr', 
          gap: 24, 
          alignItems: 'stretch', // 确保三栏高度一致
          minHeight: 'calc(100vh - 220px)' 
        }}>
          
          {/* 第一栏：核心指标卡片 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 盈亏大卡片 */}
            <div style={{ 
              background: isProfit 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)' 
                : 'linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(244, 63, 94, 0.02) 100%)',
              border: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
              borderRadius: 16,
              padding: 24,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>当日净盈亏</div>
              <div style={{ 
                fontSize: 32, 
                fontWeight: 800, 
                fontFamily: 'var(--font-mono)',
                color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)',
                letterSpacing: '-1px'
              }}>
                {isProfit ? '+' : '-'}${Math.abs(reviewStats.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              
              <div style={{ 
                marginTop: 24, 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: 16,
                borderTop: '1px solid rgba(255,255,255,0.05)',
                paddingTop: 16
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>交易总数</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{reviewStats.totalTrades}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>当日胜率</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-brand)' }}>
                    {reviewStats.winRate.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>

            {/* 交易分布卡片 */}
            <div style={{ 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-primary)', 
              borderRadius: 16, 
              padding: 20,
              flex: 1 // 撑满剩余空间
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>交易结果分布</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>盈利交易</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-profit)' }}>{reviewStats.winCount}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(reviewStats.winCount / reviewStats.totalTrades) * 100}%`, 
                    height: '100%', 
                    background: 'var(--color-profit)' 
                  }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>亏损交易</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-loss)' }}>{reviewStats.lossCount}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(reviewStats.lossCount / reviewStats.totalTrades) * 100}%`, 
                    height: '100%', 
                    background: 'var(--color-loss)' 
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* 第二栏：交易明细列表 */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            height: '100%', // 撑满容器高度
            overflow: 'hidden'
          }}>
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>交易明细</div>
              <Tag style={{ margin: 0, borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-tertiary)' }}>
                {dayData?.trades.length} 笔记录
              </Tag>
            </div>
            
            {/* 手续费汇总 - 根据品种配置自动计算 */}
            {(() => {
              const totalFee = dayData?.trades.reduce((sum, t) => sum + calculateTradeFee(t), 0) || 0;
              const grossPnL = reviewStats.totalPnL + totalFee; // 毛盈亏 = 净盈亏 + 手续费
              const feeRatio = grossPnL !== 0 ? Math.abs(totalFee / grossPnL * 100) : 0;
              
              return (
                <div style={{ 
                  padding: '12px 20px', 
                  borderBottom: '1px solid var(--border-primary)',
                  background: 'rgba(255,255,255,0.01)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>总手续费 (自动)</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-loss)' }}>
                      {totalFee > 0 ? `-$${totalFee.toFixed(2)}` : '$0.00'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>手续费占比</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: feeRatio > 30 ? 'var(--color-loss)' : 'var(--text-secondary)' }}>
                      {totalFee > 0 ? `${feeRatio.toFixed(1)}%` : '-'}
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {dayData?.trades.sort((a, b) => new Date(a.openTime) - new Date(b.openTime)).map((trade, i) => {
                const fee = calculateTradeFee(trade);
                const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
                
                return (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '12px 20px',
                      transition: 'all 0.2s',
                      cursor: 'default',
                      borderBottom: i === dayData.trades.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.02)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 8, 
                        background: trade.pnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 800,
                        color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                      }}>
                        {trade.direction === 'LONG' ? 'BUY' : 'SEL'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {trade.instrumentCode}
                          {quantity > 1 && (
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                              ×{quantity}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          {dayjs(trade.openTime).format('HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 700, 
                        fontFamily: 'var(--font-mono)',
                        color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                      }}>
                        {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl).toFixed(2)}
                      </div>
                      {fee > 0 && (
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          费 ${fee.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 第三栏：复盘表单 */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            height: '100%' // 撑满容器高度
          }}>
            <div style={{ 
              padding: '16px 24px', 
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <EditOutlined style={{ color: 'var(--color-brand)' }} />
                <div style={{ fontSize: 14, fontWeight: 700 }}>手动复盘</div>
              </div>
              {savedReviews[selectedDate] && (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 4, fontSize: 10, margin: 0 }}>
                  已保存
                </Tag>
              )}
            </div>
            
            <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
              {/* 计划执行状态 - 视觉优化 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>执行纪律</div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: 12,
                  background: 'rgba(255,255,255,0.02)',
                  padding: 4,
                  borderRadius: 10
                }}>
                  {[
                    { value: 'yes', label: '完全执行', color: 'var(--color-profit)' },
                    { value: 'partial', label: '部分执行', color: 'var(--color-brand)' },
                    { value: 'no', label: '偏离计划', color: 'var(--color-loss)' }
                  ].map(opt => (
                    <div
                      key={opt.value}
                      onClick={() => setReviewForm({...reviewForm, followedPlan: opt.value})}
                      style={{
                        padding: '10px 0',
                        textAlign: 'center',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: reviewForm.followedPlan === opt.value ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: reviewForm.followedPlan === opt.value ? opt.color : 'var(--text-tertiary)',
                        border: reviewForm.followedPlan === opt.value ? `1px solid ${opt.color}44` : '1px solid transparent'
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* 市场与决策 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>市场环境</div>
                  <Input.TextArea
                    placeholder="今日行情特征、波动率、关键位置..."
                    value={reviewForm.marketCondition}
                    onChange={e => setReviewForm({...reviewForm, marketCondition: e.target.value})}
                    autoSize={{ minRows: 4, maxRows: 8 }} // 增加最小行数
                    style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      borderColor: 'var(--border-primary)', 
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 13
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>经验教训</div>
                  <Input.TextArea
                    placeholder="今日核心感悟、需要警惕的信号..."
                    value={reviewForm.lessonsLearned}
                    onChange={e => setReviewForm({...reviewForm, lessonsLearned: e.target.value})}
                    autoSize={{ minRows: 4, maxRows: 8 }} // 增加最小行数
                    style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      borderColor: 'var(--border-primary)', 
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              {/* 决策分析 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-profit)', opacity: 0.8 }}>最佳决策 (Keep)</div>
                  <Input.TextArea
                    placeholder="哪些操作符合预期且值得坚持..."
                    value={reviewForm.bestDecision}
                    onChange={e => setReviewForm({...reviewForm, bestDecision: e.target.value})}
                    autoSize={{ minRows: 4, maxRows: 6 }} // 增加最小行数
                    style={{ 
                      background: 'rgba(16, 185, 129, 0.02)', 
                      borderColor: 'rgba(16, 185, 129, 0.1)', 
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 13
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-loss)', opacity: 0.8 }}>最差决策 (Change)</div>
                  <Input.TextArea
                    placeholder="哪些操作属于失误或情绪化交易..."
                    value={reviewForm.worstDecision}
                    onChange={e => setReviewForm({...reviewForm, worstDecision: e.target.value})}
                    autoSize={{ minRows: 4, maxRows: 6 }} // 增加最小行数
                    style={{ 
                      background: 'rgba(244, 63, 94, 0.02)', 
                      borderColor: 'rgba(244, 63, 94, 0.1)', 
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              {/* 改进计划 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-brand)' }}>明日行动指南</div>
                <Input.TextArea
                  placeholder="具体、可量化的改进措施..."
                  value={reviewForm.improvementPlan}
                  onChange={e => setReviewForm({...reviewForm, improvementPlan: e.target.value})}
                  autoSize={{ minRows: 3, maxRows: 6 }} // 增加最小行数
                  style={{ 
                    background: 'rgba(212, 175, 55, 0.02)', 
                    borderColor: 'rgba(212, 175, 55, 0.1)', 
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 13,
                    fontWeight: 500
                  }}
                />
              </div>
            </div>

            {/* 底部操作区 */}
            <div style={{ 
              padding: '20px 24px', 
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              background: 'rgba(255,255,255,0.01)',
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16
            }}>
              <Button 
                onClick={backToCalendar}
                style={{ 
                  borderRadius: 8,
                  height: 38,
                  padding: '0 20px',
                  background: 'transparent',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: 13
                }}
              >
                取消
              </Button>
              <Button 
                type="primary"
                icon={<SaveOutlined />}
                loading={isSaving}
                onClick={saveReview}
                style={{ 
                  borderRadius: 8,
                  height: 38,
                  padding: '0 24px',
                  background: 'var(--color-brand)',
                  borderColor: 'var(--color-brand)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)'
                }}
              >
                保存复盘
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 日历视图 ====================
  return (
    <div className="max-w-[1600px] mx-auto p-6" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 顶部：月份导航 + 核心数据 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 8, 
        padding: '12px 20px' 
      }}>
        {/* 左侧：月份导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 6, padding: 2 }}>
            <Button 
              icon={<LeftOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} 
              size="small"
              style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)' }} 
            />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 80, textAlign: 'center', lineHeight: '24px' }}>
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
        </div>

        {/* 右侧：核心数据 + 趋势 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {/* 月度盈亏 */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>月度盈亏</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 }}>
              <span style={{ 
                fontSize: 22, 
                fontWeight: 800, 
                fontFamily: 'var(--font-mono)',
                color: monthStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                letterSpacing: '-1px'
              }}>
                {monthStats.totalPnL >= 0 ? '+' : '-'}${Math.abs(monthStats.totalPnL).toLocaleString()}
              </span>
              <TrendIndicator current={monthStats.totalPnL} previous={prevMonthStats.totalPnL} />
            </div>
          </div>
          
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)' }} />
          
          {/* 胜率 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>胜率</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {monthStats.winRate}%
              </span>
              <TrendIndicator current={Number(monthStats.winRate)} previous={Number(prevMonthStats.winRate)} />
            </div>
          </div>
          
          {/* 交易日 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>活跃天数</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {monthStats.tradingDays}<span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>天</span>
            </div>
          </div>

          {/* 待复盘提醒 */}
          {pendingReviewDays > 0 && (
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
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
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
