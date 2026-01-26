/**
 * 交易日历模块 - 专业版 v2.1
 * 
 * 遵循网站设计规范：
 * - 使用全局 CSS 变量（--bg-primary, --color-brand 等）
 * - 统一的圆角、间距、字体
 * - 一致的交互反馈
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Modal, Table, Tag, Row, Col,
  Button, Spin, Input, Tooltip, Popover
} from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  SendOutlined,
  EditOutlined,
  TrophyOutlined,
  WarningOutlined,
  FireOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import ReactECharts from 'echarts-for-react';
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

// 分析连胜/连败
const analyzeStreaks = (tradesByDate, currentMonth) => {
  const monthKey = currentMonth.format('YYYY-MM');
  const dates = Object.keys(tradesByDate)
    .filter(d => d.startsWith(monthKey))
    .sort();
  
  const streaks = {};
  let currentStreak = 0;
  let streakType = null;
  
  dates.forEach((date, index) => {
    const data = tradesByDate[date];
    const isProfit = data.totalPnL > 0;
    
    if (index === 0) {
      streakType = isProfit ? 'win' : 'loss';
      currentStreak = 1;
    } else {
      if ((isProfit && streakType === 'win') || (!isProfit && streakType === 'loss')) {
        currentStreak++;
      } else {
        streakType = isProfit ? 'win' : 'loss';
        currentStreak = 1;
      }
    }
    
    streaks[date] = { type: streakType, count: currentStreak };
  });
  
  for (let i = dates.length - 1; i >= 0; i--) {
    const date = dates[i];
    const streak = streaks[date];
    let count = 1;
    for (let j = i + 1; j < dates.length; j++) {
      if (streaks[dates[j]].type === streak.type) count++;
      else break;
    }
    for (let j = i - 1; j >= 0; j--) {
      if (streaks[dates[j]].type === streak.type) count++;
      else break;
    }
    streaks[date].totalCount = count;
  }
  
  return streaks;
};

const analyzeTradeData = (dayTrades) => {
  if (!dayTrades || dayTrades.length === 0) return null;
  const sortedTrades = [...dayTrades].sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
  const totalPnL = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winTrades = dayTrades.filter(t => t.pnl > 0);
  const lossTrades = dayTrades.filter(t => t.pnl < 0);
  const winRate = dayTrades.length > 0 ? (winTrades.length / dayTrades.length * 100) : 0;
  
  const avgHoldingTime = dayTrades.reduce((sum, t) => {
    if (t.openTime && t.closeTime) {
      return sum + dayjs(t.closeTime).diff(dayjs(t.openTime), 'minute');
    }
    return sum;
  }, 0) / dayTrades.length || 0;
  
  const sessionStats = {};
  dayTrades.forEach(t => {
    const session = t.marketSession || '未知';
    if (!sessionStats[session]) sessionStats[session] = { count: 0, pnl: 0, wins: 0 };
    sessionStats[session].count++;
    sessionStats[session].pnl += t.pnl || 0;
    if (t.pnl > 0) sessionStats[session].wins++;
  });

  const bestSession = Object.entries(sessionStats).sort((a, b) => b[1].pnl - a[1].pnl)[0];
  const worstSession = Object.entries(sessionStats).sort((a, b) => a[1].pnl - b[1].pnl)[0];
  const maxWinTrade = winTrades.length > 0 ? winTrades.reduce((max, t) => t.pnl > max.pnl ? t : max) : null;
  const maxLossTrade = lossTrades.length > 0 ? lossTrades.reduce((min, t) => t.pnl < min.pnl ? t : min) : null;

  return {
    totalTrades: dayTrades.length,
    totalPnL,
    winRate,
    winCount: winTrades.length,
    lossCount: lossTrades.length,
    avgHoldingTime,
    sessionStats,
    bestSession,
    worstSession,
    maxWinTrade,
    maxLossTrade,
    sortedTrades,
  };
};

const generateReviewQuestions = (stats) => {
  const questions = [];
  questions.push({
    id: 'market_overview',
    stage: 1,
    title: '市场概览',
    question: `今日共复盘 ${stats.totalTrades} 笔交易，净盈亏 ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}。\n\n请描述今日市场：\n• 趋势还是震荡？\n• 波动水平？\n• 关键技术位置？`,
    placeholder: '例如：早盘快速反转后窄幅整理...',
  });

  if (stats.maxWinTrade) {
    questions.push({
      id: 'best_trade',
      stage: 2,
      title: '成功复盘',
      question: `最佳交易为${stats.maxWinTrade.direction === 'LONG' ? '多' : '空'} ${stats.maxWinTrade.instrumentCode}，盈利 +$${stats.maxWinTrade.pnl.toFixed(2)}。\n\n请拆解：\n• 入场信号是什么？\n• 入场时的信心如何？\n• 是否有偏离计划？`,
      placeholder: '例如：15分钟突破入场，手动上移止损...',
    });
  }

  questions.push({
    id: 'tomorrow',
    stage: 3,
    title: '明日计划',
    question: `明天最需要改进的一点是什么？\n\n• 心理目标？\n• 重点关注的形态？\n• 风控调整？`,
    placeholder: '例如：重质不重量，等待充分确认...',
  });

  return questions;
};

// 悬停预览卡片组件
const HoverPreviewCard = ({ data, date, savedReview, onViewDetail, onQuickReview }) => {
  const stats = analyzeTradeData(data.trades);
  if (!stats) return null;
  
  return (
    <div style={{ width: 280, padding: 4 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-primary)'
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {dayjs(date).format('M月D日 dddd')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {savedReview ? (
              <span style={{ color: 'var(--color-profit)' }}><CheckCircleOutlined /> 已复盘</span>
            ) : (
              <span style={{ color: 'var(--color-brand)' }}>待复盘</span>
            )}
          </div>
        </div>
        <div style={{ 
          fontSize: 20, 
          fontWeight: 700, 
          fontFamily: 'var(--font-mono)',
          color: stats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
        }}>
          {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(0)}
        </div>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 12,
        marginBottom: 12
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>交易数</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {stats.totalTrades}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>胜率</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {stats.winRate.toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>胜/负</div>
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--color-profit)' }}>{stats.winCount}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span style={{ color: 'var(--color-loss)' }}>{stats.lossCount}</span>
          </div>
        </div>
      </div>
      
      {(stats.maxWinTrade || stats.maxLossTrade) && (
        <div style={{ 
          background: 'var(--bg-tertiary)', 
          borderRadius: 6, 
          padding: 10, 
          marginBottom: 12,
          border: '1px solid var(--border-primary)'
        }}>
          {stats.maxWinTrade && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: stats.maxLossTrade ? 6 : 0 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                最佳: {stats.maxWinTrade.instrumentCode} ({stats.maxWinTrade.direction === 'LONG' ? '多' : '空'})
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-profit)', fontFamily: 'var(--font-mono)' }}>
                +{stats.maxWinTrade.pnl.toFixed(0)}
              </span>
            </div>
          )}
          {stats.maxLossTrade && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                最差: {stats.maxLossTrade.instrumentCode} ({stats.maxLossTrade.direction === 'LONG' ? '多' : '空'})
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-loss)', fontFamily: 'var(--font-mono)' }}>
                {stats.maxLossTrade.pnl.toFixed(0)}
              </span>
            </div>
          )}
        </div>
      )}
      
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
          查看详情
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
          快速复盘
        </Button>
      </div>
    </div>
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [savedReviews, setSavedReviews] = useState({});
  const [manualReviewVisible, setManualReviewVisible] = useState(false);

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
      if (!grouped[date]) grouped[date] = { trades: [], totalPnL: 0, winCount: 0, lossCount: 0, totalTicks: 0 };
      grouped[date].trades.push(t);
      grouped[date].totalPnL += t.pnl || 0;
      grouped[date].totalTicks += t.ticks || 0;
      if (t.pnl > 0) grouped[date].winCount++;
      else if (t.pnl < 0) grouped[date].lossCount++;
    });
    return grouped;
  }, [trades]);

  const streaks = useMemo(() => {
    return analyzeStreaks(tradesByDate, currentMonth);
  }, [tradesByDate, currentMonth]);

  const monthStats = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    const totalPnL = monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winCount = monthTrades.filter(t => t.pnl > 0).length;
    const lossCount = monthTrades.filter(t => t.pnl < 0).length;
    const tradingDays = new Set(monthTrades.map(t => getTradingDate(t.openTime))).size;
    const profitDays = Object.entries(tradesByDate).filter(([d, data]) => d.startsWith(monthKey) && data.totalPnL > 0).length;
    const daysData = Object.entries(tradesByDate).filter(([d]) => d.startsWith(monthKey)).map(([d, data]) => ({ date: d, ...data }));
    const bestDay = daysData.reduce((b, d) => d.totalPnL > (b?.totalPnL || -Infinity) ? d : b, null);
    const worstDay = daysData.reduce((w, d) => d.totalPnL < (w?.totalPnL || Infinity) ? d : w, null);
    
    let maxWinStreak = 0, maxLossStreak = 0;
    Object.values(streaks).forEach(s => {
      if (s.type === 'win' && s.totalCount > maxWinStreak) maxWinStreak = s.totalCount;
      if (s.type === 'loss' && s.totalCount > maxLossStreak) maxLossStreak = s.totalCount;
    });
    
    return {
      totalTrades: monthTrades.length,
      totalPnL,
      winRate: monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(1) : 0,
      tradingDays,
      profitDays,
      lossDays: tradingDays - profitDays,
      winCount,
      lossCount,
      bestDay,
      worstDay,
      maxWinStreak,
      maxLossStreak,
    };
  }, [trades, currentMonth, tradesByDate, streaks]);

  const weekStats = useMemo(() => {
    const weekStart = dayjs().startOf('isoWeek');
    const weekEnd = dayjs().endOf('isoWeek');
    
    const weekTrades = trades.filter(t => {
      const tradeDate = dayjs(getTradingDate(t.openTime));
      return tradeDate.isAfter(weekStart.subtract(1, 'day')) && tradeDate.isBefore(weekEnd.add(1, 'day'));
    });
    
    const totalPnL = weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winCount = weekTrades.filter(t => t.pnl > 0).length;
    const tradingDays = new Set(weekTrades.map(t => getTradingDate(t.openTime))).size;
    const maxDrawdown = weekTrades.reduce((max, t) => Math.min(max, t.pnl || 0), 0);
    
    return {
      weekStart: weekStart.format('M/D'),
      weekEnd: weekEnd.format('M/D'),
      totalTrades: weekTrades.length,
      totalPnL,
      winRate: weekTrades.length > 0 ? (winCount / weekTrades.length * 100).toFixed(1) : 0,
      tradingDays,
      maxDrawdown,
    };
  }, [trades]);

  const hourlyStats = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    
    const hourly = {};
    for (let h = 0; h < 24; h++) {
      hourly[h] = { count: 0, pnl: 0 };
    }
    
    monthTrades.forEach(t => {
      const hour = dayjs(t.openTime).hour();
      hourly[hour].count++;
      hourly[hour].pnl += t.pnl || 0;
    });
    
    return hourly;
  }, [trades, currentMonth]);

  const getMonthlyChartOption = () => {
    const daysInMonth = currentMonth.daysInMonth();
    const data = [];
    let cum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = currentMonth.date(d).format('YYYY-MM-DD');
      if (tradesByDate[date]) cum += tradesByDate[date].totalPnL;
      data.push(Number(cum.toFixed(2)));
    }
    const finalValue = data[data.length - 1] || 0;
    const lineColor = finalValue >= 0 ? '#10b981' : '#f43f5e';
    
    return {
      grid: { left: 0, right: 0, bottom: 0, top: 10 },
      xAxis: { type: 'category', show: false },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'line', data, smooth: true, symbol: 'none',
        lineStyle: { color: lineColor, width: 2 },
        areaStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: finalValue >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)' },
              { offset: 1, color: 'rgba(0, 0, 0, 0)' }
            ]
          }
        }
      }]
    };
  };

  const getHourlyChartOption = () => {
    const hours = [];
    const data = [];
    
    for (let h = 6; h < 24; h++) {
      hours.push(`${h}:00`);
      data.push(hourlyStats[h].pnl);
    }
    for (let h = 0; h < 6; h++) {
      hours.push(`${h}:00`);
      data.push(hourlyStats[h].pnl);
    }
    
    return {
      grid: { left: 40, right: 10, bottom: 30, top: 10 },
      xAxis: { 
        type: 'category', 
        data: hours,
        axisLine: { lineStyle: { color: '#1e1e24' } },
        axisLabel: { color: '#52525b', fontSize: 9, interval: 2 }
      },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'bar',
        data: data.map(v => ({
          value: v,
          itemStyle: { color: v >= 0 ? '#10b981' : '#f43f5e' }
        })),
        barWidth: '60%',
      }]
    };
  };

  const startAiReview = (date) => {
    const dayTrades = tradesByDate[date].trades;
    const stats = analyzeTradeData(dayTrades);
    setReviewStats(stats);
    const qs = generateReviewQuestions(stats);
    setReviewQuestions(qs);
    setCurrentQuestionIndex(0);
    setChatHistory([{
      role: 'ai', type: 'welcome',
      content: `👋 准备开始复盘了吗？今天共有 ${stats.totalTrades} 笔交易需要拆解。`
    }, {
      role: 'ai', type: 'question', stage: qs[0].stage, title: qs[0].title, content: qs[0].question, placeholder: qs[0].placeholder
    }]);
    setSelectedDate(date);
    setAiReviewVisible(true);
  };

  const dateCellRender = (date) => {
    const key = date.format('YYYY-MM-DD');
    const data = tradesByDate[key];
    if (!data) return null;
    
    const isProfit = data.totalPnL > 0;
    const winRate = (data.winCount / data.trades.length * 100).toFixed(0);
    const streak = streaks[key];
    const showStreak = streak && streak.totalCount >= 3;

    return (
      <Popover
        content={
          <HoverPreviewCard 
            data={data}
            date={key}
            savedReview={savedReviews[key]}
            onViewDetail={() => { setSelectedDate(key); setModalVisible(true); }}
            onQuickReview={() => startAiReview(key)}
          />
        }
        trigger="hover"
        placement="right"
        overlayStyle={{ padding: 0 }}
        overlayInnerStyle={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          padding: 12
        }}
      >
        <div 
          style={{
            height: '100%',
            width: '100%',
            padding: 4,
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
          }}
          onClick={() => { setSelectedDate(key); setModalVisible(true); }}
        >
          {showStreak && (
            <div style={{
              position: 'absolute',
              top: 2,
              right: 2,
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '1px 4px',
              borderRadius: 4,
              background: streak.type === 'win' ? 'var(--color-profit-bg)' : 'var(--color-loss-bg)',
            }}>
              {streak.type === 'win' ? (
                <FireOutlined style={{ color: 'var(--color-brand)', fontSize: 10 }} />
              ) : (
                <WarningOutlined style={{ color: 'var(--color-loss)', fontSize: 10 }} />
              )}
              <span style={{ 
                fontSize: 9, 
                fontWeight: 700,
                color: streak.type === 'win' ? 'var(--color-profit)' : 'var(--color-loss)'
              }}>
                {streak.totalCount}
              </span>
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ 
                fontSize: 9, 
                fontWeight: 600, 
                padding: '1px 5px', 
                borderRadius: 3, 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)'
              }}>
                {data.trades.length}笔
              </span>
              {savedReviews[key] && (
                <span style={{ 
                  fontSize: 9, 
                  color: savedReviews[key].type === 'ai' ? 'var(--color-brand)' : 'var(--text-tertiary)'
                }}>
                  {savedReviews[key].type === 'ai' ? <RobotOutlined /> : <CheckCircleOutlined />}
                </span>
              )}
            </div>
            
            <div style={{ 
              fontSize: 13, 
              fontWeight: 700, 
              fontFamily: 'var(--font-mono)',
              textAlign: 'center', 
              color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)',
              margin: '4px 0'
            }}>
              {isProfit ? '+' : ''}{Math.abs(data.totalPnL) >= 1000 ? `${(data.totalPnL / 1000).toFixed(1)}k` : data.totalPnL.toFixed(0)}
            </div>
            
            <div>
              <div style={{ 
                width: '100%', 
                height: 3, 
                background: 'var(--bg-primary)', 
                borderRadius: 2, 
                overflow: 'hidden',
                border: '1px solid var(--border-primary)'
              }}>
                <div style={{ 
                  height: '100%', 
                  background: 'var(--color-profit)', 
                  width: `${winRate}%`, 
                  transition: 'width 0.3s' 
                }} />
              </div>
              <div style={{ 
                fontSize: 9, 
                color: 'var(--text-tertiary)', 
                textAlign: 'center',
                marginTop: 2,
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ color: 'var(--color-profit)' }}>{data.winCount}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>:</span>
                <span style={{ color: 'var(--color-loss)' }}>{data.lossCount}</span>
              </div>
            </div>
          </div>
        </div>
      </Popover>
    );
  };

  const StatCard = ({ label, value, unit, color, icon, subValue }) => (
    <div style={{ 
      background: 'var(--bg-tertiary)', 
      border: '1px solid var(--border-primary)', 
      borderRadius: 6, 
      padding: 16,
      flex: 1,
      minWidth: 120
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{icon}</span>}
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <div style={{ 
        fontSize: 22, 
        fontWeight: 700, 
        fontFamily: 'var(--font-mono)', 
        color: color || 'var(--text-primary)',
        letterSpacing: '-0.5px'
      }}>
        {value}
        {unit && <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 4 }}>{unit}</span>}
      </div>
      {subValue && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{subValue}</div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 月份导航 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6, 
        padding: '12px 20px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button 
            icon={<LeftOutlined />} 
            onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} 
            style={{ border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: 4, width: 32, height: 32 }} 
          />
          <div style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{currentMonth.format('YYYY年M月')}</div>
          </div>
          <Button 
            icon={<RightOutlined />} 
            onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))} 
            style={{ border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: 4, width: 32, height: 32 }} 
          />
        </div>
        <Button 
          onClick={() => setCurrentMonth(dayjs())} 
          size="small" 
          style={{ fontSize: 11, fontWeight: 600, background: 'var(--color-brand)', border: 'none', color: 'var(--bg-primary)', borderRadius: 4, padding: '0 12px' }}
        >
          本月
        </Button>
      </div>

      {/* 周度统计 */}
      {weekStats.totalTrades > 0 && (
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)', 
          borderRadius: 6, 
          padding: 20 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ThunderboltOutlined style={{ color: 'var(--color-brand)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>本周绩效</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({weekStats.weekStart} - {weekStats.weekEnd})</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <StatCard 
              label="周盈亏" 
              value={`${weekStats.totalPnL >= 0 ? '+' : ''}${weekStats.totalPnL.toFixed(0)}`}
              color={weekStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
            />
            <StatCard label="交易数" value={weekStats.totalTrades} unit="笔" />
            <StatCard label="胜率" value={`${weekStats.winRate}%`} />
            <StatCard label="交易天数" value={weekStats.tradingDays} unit="天" />
            <StatCard 
              label="最大单笔亏损" 
              value={weekStats.maxDrawdown.toFixed(0)}
              color="var(--color-loss)"
            />
          </div>
        </div>
      )}

      {/* 月度统计 */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6, 
        padding: 20 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <CalendarOutlined style={{ color: 'var(--color-brand)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>月度统计</span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <StatCard 
            label="月度盈亏" 
            value={`${monthStats.totalPnL >= 0 ? '+' : ''}${monthStats.totalPnL.toLocaleString()}`}
            color={monthStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
          />
          <StatCard label="交易笔数" value={monthStats.totalTrades} unit="笔" />
          <StatCard label="胜率" value={`${monthStats.winRate}%`} />
          <StatCard 
            label="盈/亏日" 
            value={`${monthStats.profitDays}/${monthStats.lossDays}`}
            subValue={`共 ${monthStats.tradingDays} 个交易日`}
          />
          <StatCard 
            label="最大连胜" 
            value={monthStats.maxWinStreak}
            unit="天"
            color="var(--color-profit)"
            icon={<FireOutlined />}
          />
          <StatCard 
            label="最大连败" 
            value={monthStats.maxLossStreak}
            unit="天"
            color="var(--color-loss)"
            icon={<WarningOutlined />}
          />
        </div>

        {monthStats.totalTrades > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>累计收益曲线</div>
            <ReactECharts option={getMonthlyChartOption()} style={{ height: 80 }} notMerge={true} />
          </div>
        )}
        
        {monthStats.totalTrades > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>时段盈亏分布</div>
            <ReactECharts option={getHourlyChartOption()} style={{ height: 100 }} notMerge={true} />
          </div>
        )}
      </div>

      {/* 最佳/最差日高亮 */}
      {monthStats.bestDay && (
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <div 
              style={{ 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderLeft: '3px solid var(--color-profit)',
                borderRadius: 6, 
                padding: 16, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => { setSelectedDate(monthStats.bestDay.date); setModalVisible(true); }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrophyOutlined style={{ color: 'var(--color-profit)', fontSize: 12 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-profit)', textTransform: 'uppercase' }}>最佳盈利日</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{dayjs(monthStats.bestDay.date).format('M月D日')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-profit)' }}>+{monthStats.bestDay.totalPnL.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{monthStats.bestDay.trades.length}笔</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div 
              style={{ 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderLeft: '3px solid var(--color-loss)',
                borderRadius: 6, 
                padding: 16, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => { setSelectedDate(monthStats.worstDay.date); setModalVisible(true); }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <WarningOutlined style={{ color: 'var(--color-loss)', fontSize: 12 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-loss)', textTransform: 'uppercase' }}>最大回撤日</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{dayjs(monthStats.worstDay.date).format('M月D日')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-loss)' }}>{monthStats.worstDay.totalPnL.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{monthStats.worstDay.trades.length}笔</div>
              </div>
            </div>
          </Col>
        </Row>
      )}

      {/* 主日历卡片 */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6, 
        padding: 8,
        overflow: 'hidden'
      }}>
        <Calendar
          value={currentMonth}
          onPanelChange={setCurrentMonth}
          headerRender={() => null}
          fullScreen={true}
          cellRender={(date, info) => info.type === 'date' ? dateCellRender(date) : null}
          className="trading-calendar binance-calendar"
        />
      </div>

      {/* 图例 */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
        gap: 24, 
        padding: '12px 20px', 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-profit)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>盈利日</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-loss)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>亏损日</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FireOutlined style={{ color: 'var(--color-brand)', fontSize: 12 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>连胜 ≥3天</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <WarningOutlined style={{ color: 'var(--color-loss)', fontSize: 12 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>连败 ≥3天</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClockCircleOutlined style={{ color: 'var(--text-tertiary)', fontSize: 12 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>交易日：06:00 - 05:59</span>
        </div>
      </div>

      {/* 交易详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 6, 
              background: 'var(--color-brand)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <CalendarOutlined style={{ color: 'var(--bg-primary)', fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedDate && dayjs(selectedDate).format('M月D日')} 交易报告</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{selectedDate && dayjs(selectedDate).format('dddd')}</div>
            </div>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={900}
        footer={[
          <Button 
            key="close" 
            onClick={() => setModalVisible(false)} 
            style={{ fontWeight: 600, fontSize: 11, borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 4 }}
          >
            关闭
          </Button>,
          <Button 
            key="manual" 
            icon={<EditOutlined />} 
            onClick={() => { setModalVisible(false); setManualReviewVisible(true); }} 
            style={{ fontWeight: 600, fontSize: 11, borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 4 }}
          >
            手动复盘
          </Button>,
          <Button 
            key="ai" 
            type="primary" 
            icon={<RobotOutlined />} 
            onClick={() => { 
              setModalVisible(false);
              startAiReview(selectedDate);
            }} 
            style={{ fontWeight: 600, fontSize: 11, background: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: 'var(--bg-primary)', borderRadius: 4 }}
          >
            AI 复盘
          </Button>
        ]}
      >
        {selectedDate && tradesByDate[selectedDate] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Row gutter={12}>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 14, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>当日盈亏</div>
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 700, 
                    fontFamily: 'var(--font-mono)',
                    color: tradesByDate[selectedDate].totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                  }}>
                    {tradesByDate[selectedDate].totalPnL >= 0 ? '+' : ''}{tradesByDate[selectedDate].totalPnL.toFixed(2)}
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 14, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>交易数量</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {tradesByDate[selectedDate].trades.length}
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 14, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>胜率</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {(tradesByDate[selectedDate].winCount / tradesByDate[selectedDate].trades.length * 100).toFixed(1)}%
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 14, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>复盘状态</div>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: savedReviews[selectedDate] ? 'var(--color-profit)' : 'var(--color-brand)' 
                  }}>
                    {savedReviews[selectedDate] ? '✓ 已完成' : '○ 待完成'}
                  </div>
                </div>
              </Col>
            </Row>
            
            <Table
              dataSource={tradesByDate[selectedDate].trades}
              pagination={false}
              size="small"
              className="binance-table"
              rowKey={(record, index) => index}
              columns={[
                { 
                  title: <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>时间</span>, 
                  dataIndex: 'openTime', 
                  render: t => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 12 }}>{dayjs(t).format('HH:mm')}</span>
                },
                { 
                  title: <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>品种</span>, 
                  dataIndex: 'instrumentCode', 
                  render: c => <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{c}</span>
                },
                { 
                  title: <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>方向</span>, 
                  dataIndex: 'direction', 
                  render: d => (
                    <Tag style={{ 
                      background: d === 'LONG' ? 'var(--color-profit-bg)' : 'var(--color-loss-bg)', 
                      color: d === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)', 
                      border: 'none', 
                      fontWeight: 600, 
                      fontSize: 10 
                    }}>
                      {d === 'LONG' ? '多' : '空'}
                    </Tag>
                  )
                },
                { 
                  title: <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>点数</span>, 
                  dataIndex: 'ticks', 
                  align: 'right', 
                  render: t => (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: t >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {t >= 0 ? '+' : ''}{t}
                    </span>
                  )
                },
                { 
                  title: <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>盈亏</span>, 
                  dataIndex: 'pnl', 
                  align: 'right', 
                  render: p => (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: p >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {p >= 0 ? '+' : ''}{p.toFixed(2)}
                    </span>
                  )
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* AI 复盘对话弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RobotOutlined style={{ color: 'var(--bg-primary)', fontSize: 14 }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>AI 复盘对话</span>
          </div>
        }
        open={aiReviewVisible}
        onCancel={() => setAiReviewVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: 500 }}>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12, 
            padding: 16, 
            background: 'var(--bg-tertiary)', 
            borderRadius: 8,
            border: '1px solid var(--border-primary)'
          }}>
            {chatHistory.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                <div style={{ 
                  padding: 12, 
                  borderRadius: 12, 
                  maxWidth: '85%', 
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'ai' ? 'var(--bg-secondary)' : 'var(--color-brand)', 
                  color: m.role === 'ai' ? 'var(--text-primary)' : 'var(--bg-primary)',
                  border: m.role === 'ai' ? '1px solid var(--border-primary)' : 'none'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 12, display: 'flex', gap: 8 }}>
            <TextArea 
              placeholder="输入你的回答..." 
              autoSize={{ minRows: 1, maxRows: 3 }} 
              value={userInput} 
              onChange={e => setUserInput(e.target.value)} 
              style={{ borderRadius: 8, background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }} 
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
                  setChatHistory([...newHistory, { role: 'ai', content: '已记录，请继续保持规范复盘。' }]);
                }, 500);
              }} 
              style={{ borderRadius: 8, height: 'auto', background: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: 'var(--bg-primary)' }} 
            />
          </div>
        </div>
      </Modal>

      <style>{`
        .binance-calendar .ant-picker-calendar-date-content {
          height: 70px !important;
          margin: 0 !important;
        }
        .binance-calendar .ant-picker-cell-inner {
          border: 1px solid var(--border-primary) !important;
          border-radius: 6px !important;
          margin: 2px !important;
          padding: 0 !important;
          min-height: 90px !important;
          background: var(--bg-tertiary) !important;
          transition: all 0.2s !important;
        }
        .binance-calendar .ant-picker-cell-inner:hover {
          background: var(--bg-secondary) !important;
          border-color: var(--border-secondary) !important;
        }
        .binance-calendar .ant-picker-cell-selected .ant-picker-cell-inner {
          background: var(--color-brand-bg) !important;
          border-color: var(--color-brand) !important;
        }
        .binance-calendar .ant-picker-calendar-date-value {
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .binance-calendar .ant-picker-cell-today .ant-picker-calendar-date-value {
          color: var(--color-brand) !important;
        }
        .binance-calendar .ant-picker-content th {
          color: var(--text-tertiary) !important;
          font-weight: 600 !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        .binance-calendar .ant-picker-cell-disabled .ant-picker-cell-inner {
          background: var(--bg-primary) !important;
          border-color: var(--border-primary) !important;
        }
      `}</style>
    </div>
  );
};

export default TradeCalendar;
