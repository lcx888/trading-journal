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
  Calendar, Modal, Table, Tag, Row, Col,
  Button, Spin, Input, Popover, Empty
} from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  RobotOutlined,
  SendOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined,
  EditOutlined,
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
  if (!dayTrades || dayTrades.length === 0) return null;
  const totalPnL = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winTrades = dayTrades.filter(t => t.pnl > 0);
  const lossTrades = dayTrades.filter(t => t.pnl < 0);
  const winRate = dayTrades.length > 0 ? (winTrades.length / dayTrades.length * 100) : 0;
  const maxWinTrade = winTrades.length > 0 ? winTrades.reduce((max, t) => t.pnl > max.pnl ? t : max) : null;
  const maxLossTrade = lossTrades.length > 0 ? lossTrades.reduce((min, t) => t.pnl < min.pnl ? t : min) : null;

  return {
    totalTrades: dayTrades.length,
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
          icon={<RobotOutlined />}
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
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [aiReviewVisible, setAiReviewVisible] = useState(false);
  const [reviewStats, setReviewStats] = useState(null);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [savedReviews, setSavedReviews] = useState({});

  useEffect(() => {
    loadTrades();
    loadSavedReviews();
  }, [activeRecordId]);

  const loadSavedReviews = async () => {
    const reviews = await StorageService.getAllReviews();
    const map = {};
    reviews.forEach(r => map[r.date] = r);
    setSavedReviews(map);
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

  const startAiReview = (date) => {
    const dayTrades = tradesByDate[date].trades;
    const stats = analyzeTradeData(dayTrades);
    setReviewStats(stats);
    const qs = generateReviewQuestions(stats);
    setReviewQuestions(qs);
    setChatHistory([{
      role: 'ai', type: 'welcome',
      content: `👋 开始复盘 ${dayjs(date).format('M月D日')} 的交易记录。`
    }, {
      role: 'ai', type: 'question', content: qs[0].question, placeholder: qs[0].placeholder
    }]);
    setSelectedDate(date);
    setAiReviewVisible(true);
  };

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
              onViewDetail={() => { setSelectedDate(key); setModalVisible(true); }}
              onQuickReview={() => startAiReview(key)}
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
          onClick={() => { setSelectedDate(key); setModalVisible(true); }}
          className="calendar-cell-inner"
        >
          {/* 复盘状态 - 呼吸灯效果 */}
          {data && !isReviewed && (
            <div style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--color-brand)',
              boxShadow: '0 0 8px var(--color-brand)',
              animation: 'pulse 2s infinite'
            }} />
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部：月份导航 + 核心数据 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
        background: 'rgba(20, 20, 25, 0.6)', 
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)', 
        borderRadius: 12, 
        padding: '16px 24px' 
      }}>
        {/* 左侧：月份导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 2 }}>
            <Button 
              icon={<LeftOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} 
              size="small"
              style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)' }} 
            />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', minWidth: 90, textAlign: 'center', lineHeight: '24px' }}>
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
              background: 'var(--color-brand)', 
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

      {/* 交易详情弹窗 - 专业版 */}
      <Modal
        title={null}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={900}
        footer={null}
        styles={{ 
          body: { padding: 0 },
          content: { 
            background: 'rgba(15, 15, 20, 0.95)', 
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            overflow: 'hidden'
          }
        }}
      >
        {selectedDate && tradesByDate[selectedDate] && (() => {
          const dayData = tradesByDate[selectedDate];
          const stats = analyzeTradeData(dayData.trades);
          const isProfit = stats.totalPnL >= 0;
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* 头部 - 大盈亏展示 */}
              <div style={{ 
                background: isProfit 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(244, 63, 94, 0.05) 100%)',
                borderBottom: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
                padding: '28px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12,
                    marginBottom: 8
                  }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 10, 
                      background: isProfit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CalendarOutlined style={{ color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)', fontSize: 18 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {dayjs(selectedDate).format('M月D日')} 交易报告
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {dayjs(selectedDate).format('dddd')} · {stats.totalTrades} 笔交易
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>当日盈亏</div>
                  <div style={{ 
                    fontSize: 36, 
                    fontWeight: 800, 
                    fontFamily: 'var(--font-mono)',
                    color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)',
                    letterSpacing: '-2px',
                    lineHeight: 1
                  }}>
                    {isProfit ? '+' : '-'}${Math.abs(stats.totalPnL).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 核心指标 */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: 1,
                background: 'rgba(255, 255, 255, 0.03)'
              }}>
                {[
                  { label: '交易笔数', value: stats.totalTrades, unit: '笔' },
                  { label: '胜率', value: `${stats.winRate.toFixed(0)}%`, color: stats.winRate >= 50 ? 'var(--color-profit)' : 'var(--color-loss)' },
                  { label: '盈利交易', value: stats.winCount, unit: '笔', color: 'var(--color-profit)' },
                  { label: '亏损交易', value: stats.lossCount, unit: '笔', color: 'var(--color-loss)' },
                  { label: '盈亏比', value: stats.lossCount > 0 ? (Math.abs(stats.maxWinTrade?.pnl || 0) / Math.abs(stats.maxLossTrade?.pnl || 1)).toFixed(2) : '∞', unit: ':1' }
                ].map((item, i) => (
                  <div key={i} style={{ 
                    padding: '16px 20px', 
                    background: 'rgba(20, 20, 25, 0.8)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                    <div style={{ 
                      fontSize: 18, 
                      fontWeight: 700, 
                      fontFamily: 'var(--font-mono)', 
                      color: item.color || 'var(--text-primary)'
                    }}>
                      {item.value}
                      {item.unit && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>{item.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* 最佳/最差交易 */}
              {(stats.maxWinTrade || stats.maxLossTrade) && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: 16, 
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {stats.maxWinTrade && (
                    <div style={{ 
                      padding: 16, 
                      background: 'rgba(16, 185, 129, 0.06)', 
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      borderRadius: 10 
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--color-profit)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏆 最佳交易</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.maxWinTrade.instrumentCode}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {stats.maxWinTrade.direction === 'LONG' ? '做多' : '做空'} · {dayjs(stats.maxWinTrade.openTime).format('HH:mm')}
                          </div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-profit)' }}>
                          +${stats.maxWinTrade.pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                  {stats.maxLossTrade && (
                    <div style={{ 
                      padding: 16, 
                      background: 'rgba(244, 63, 94, 0.06)', 
                      border: '1px solid rgba(244, 63, 94, 0.15)',
                      borderRadius: 10 
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--color-loss)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠️ 最差交易</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.maxLossTrade.instrumentCode}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {stats.maxLossTrade.direction === 'LONG' ? '做多' : '做空'} · {dayjs(stats.maxLossTrade.openTime).format('HH:mm')}
                          </div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-loss)' }}>
                          -${Math.abs(stats.maxLossTrade.pnl).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 交易列表 */}
              <div style={{ padding: '16px 24px 24px' }}>
                <div style={{ 
                  fontSize: 12, 
                  fontWeight: 700, 
                  color: 'var(--text-tertiary)', 
                  marginBottom: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  交易明细
                </div>
                <Table
                  dataSource={dayData.trades.sort((a, b) => new Date(a.openTime) - new Date(b.openTime))}
                  pagination={false}
                  size="small"
                  rowKey={(record, index) => index}
                  rowClassName={(record) => record.pnl >= 0 ? 'trade-row-profit' : 'trade-row-loss'}
                  columns={[
                    { 
                      title: <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>时间</span>, 
                      dataIndex: 'openTime', 
                      width: 70,
                      render: t => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{dayjs(t).format('HH:mm')}</span>
                    },
                    { 
                      title: <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>品种</span>, 
                      dataIndex: 'instrumentCode', 
                      render: c => <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{c}</span>
                    },
                    { 
                      title: <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>方向</span>, 
                      dataIndex: 'direction', 
                      width: 60,
                      render: d => (
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 8px',
                          background: d === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', 
                          color: d === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)', 
                          fontWeight: 700, 
                          fontSize: 10,
                          borderRadius: 4
                        }}>
                          {d === 'LONG' ? '多' : '空'}
                        </span>
                      )
                    },
                    { 
                      title: <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>数量</span>, 
                      dataIndex: 'quantity',
                      width: 60,
                      align: 'center',
                      render: q => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{q || 1}</span>
                    },
                    { 
                      title: <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>点数</span>, 
                      dataIndex: 'ticks', 
                      align: 'right',
                      width: 70,
                      render: t => (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: t >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                          {t >= 0 ? '+' : ''}{t}
                        </span>
                      )
                    },
                    { 
                      title: <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>盈亏</span>, 
                      dataIndex: 'pnl', 
                      align: 'right',
                      width: 100,
                      render: p => (
                        <span style={{ 
                          fontFamily: 'var(--font-mono)', 
                          fontWeight: 700, 
                          fontSize: 13,
                          color: p >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
                        }}>
                          {p >= 0 ? '+' : '-'}${Math.abs(p).toFixed(2)}
                        </span>
                      )
                    }
                  ]}
                />
              </div>

              {/* 底部操作栏 */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '16px 24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(20, 20, 25, 0.5)'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {savedReviews[selectedDate] ? (
                    <span style={{ color: 'var(--color-profit)' }}><CheckCircleOutlined /> 已完成复盘</span>
                  ) : (
                    <span style={{ color: 'var(--color-brand)' }}>📝 尚未复盘此交易日</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button 
                    onClick={() => setModalVisible(false)}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)', 
                      color: 'var(--text-secondary)',
                      borderRadius: 8,
                      fontWeight: 600
                    }}
                  >
                    关闭
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<EditOutlined />} 
                    onClick={() => { setModalVisible(false); startAiReview(selectedDate); }}
                    style={{ 
                      background: 'var(--color-brand)', 
                      border: 'none', 
                      color: 'var(--bg-primary)',
                      borderRadius: 8,
                      fontWeight: 700
                    }}
                  >
                    手动复盘
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 手动复盘对话弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EditOutlined style={{ color: 'var(--color-brand)' }} />
            <span>手动复盘</span>
          </div>
        }
        open={aiReviewVisible}
        onCancel={() => setAiReviewVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12, 
            padding: 12, 
            background: 'var(--bg-tertiary)', 
            borderRadius: 6,
            border: '1px solid var(--border-primary)'
          }}>
            {chatHistory.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                <div style={{ 
                  padding: 10, 
                  borderRadius: 8, 
                  maxWidth: '85%', 
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'ai' ? 'var(--bg-secondary)' : 'var(--color-brand)', 
                  color: m.role === 'ai' ? 'var(--text-primary)' : '#fff',
                  border: m.role === 'ai' ? '1px solid var(--border-primary)' : 'none'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 12, display: 'flex', gap: 8 }}>
            <TextArea 
              placeholder="输入回答..." 
              autoSize={{ minRows: 1, maxRows: 3 }} 
              value={userInput} 
              onChange={e => setUserInput(e.target.value)} 
              style={{ borderRadius: 6, background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }} 
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />} 
              onClick={() => {
                if (!userInput.trim()) return;
                const newHistory = [...chatHistory, { role: 'user', content: userInput }];
                setChatHistory(newHistory);
                setUserInput('');
                setTimeout(() => {
                  setChatHistory([...newHistory, { role: 'ai', content: '已记录，请继续。' }]);
                }, 500);
              }} 
              style={{ borderRadius: 6, height: 'auto', background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }} 
            />
          </div>
        </div>
      </Modal>

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
