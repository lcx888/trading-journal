import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Modal, Table, Tag, Row, Col,
  Button, Spin, Input
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import StorageService from '../services/storage';

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
  const sortedTrades = [...dayTrades].sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
  const totalPnL = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winTrades = dayTrades.filter(t => t.pnl > 0);
  const lossTrades = dayTrades.filter(t => t.pnl < 0);
  const winRate = dayTrades.length > 0 ? (winTrades.length / dayTrades.length * 100) : 0;
  
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

  const monthStats = useMemo(() => {
    const monthKey = currentMonth.format('YYYY-MM');
    const monthTrades = trades.filter(t => getTradingMonth(t.openTime) === monthKey);
    const totalPnL = monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winCount = monthTrades.filter(t => t.pnl > 0).length;
    const tradingDays = new Set(monthTrades.map(t => getTradingDate(t.openTime))).size;
    const daysData = Object.entries(tradesByDate).filter(([d]) => d.startsWith(monthKey)).map(([d, data]) => ({ date: d, ...data }));
    const bestDay = daysData.reduce((b, d) => d.totalPnL > (b?.totalPnL || -Infinity) ? d : b, null);
    const worstDay = daysData.reduce((w, d) => d.totalPnL < (w?.totalPnL || Infinity) ? d : w, null);
    
    return {
      totalTrades: monthTrades.length,
      totalPnL,
      winRate: monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(1) : 0,
      tradingDays,
      bestDay,
      worstDay,
    };
  }, [trades, currentMonth, tradesByDate]);

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
        areaStyle: { color: '#1E3830' }
      }]
    };
  };

  const dateCellRender = (date) => {
    const key = date.format('YYYY-MM-DD');
    const data = tradesByDate[key];
    if (!data) return null;
    const isProfit = data.totalPnL > 0;
    const winRate = (data.winCount / data.trades.length * 100).toFixed(0);

    return (
      <div 
        style={{
          height: '100%',
          width: '100%',
          padding: 4,
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onClick={() => { setSelectedDate(key); setModalVisible(true); }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ 
              fontSize: 9, 
              fontWeight: 600, 
              padding: '1px 6px', 
              borderRadius: 2, 
              background: 'var(--bg-tertiary)', 
              color: 'var(--text-secondary)' 
            }}>
              {data.trades.length}
            </span>
            {savedReviews[key] && (
              <span style={{ fontSize: 10, color: savedReviews[key].type === 'ai' ? 'var(--color-brand)' : 'var(--text-tertiary)' }}>
                {savedReviews[key].type === 'ai' ? <RobotOutlined /> : <EditOutlined />}
              </span>
            )}
          </div>
          <div style={{ 
            fontSize: 12, 
            fontWeight: 700, 
            fontFamily: 'var(--font-mono)',
            textAlign: 'right', 
            color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)' 
          }}>
            {isProfit ? '+' : ''}{Math.abs(data.totalPnL) >= 1000 ? `${(data.totalPnL / 1000).toFixed(1)}k` : data.totalPnL.toFixed(0)}
          </div>
          <div style={{ 
            width: '100%', 
            height: 3, 
            background: 'var(--bg-tertiary)', 
            borderRadius: 2, 
            overflow: 'hidden', 
            marginTop: 4 
          }}>
            <div style={{ 
              height: '100%', 
              background: 'var(--color-profit)', 
              width: `${winRate}%`, 
              transition: 'width 0.3s' 
            }} />
          </div>
        </div>
      </div>
    );
  };

  // 统计卡片组件
  const StatItem = ({ label, value, unit, color }) => (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ 
        fontSize: 20, 
        fontWeight: 700, 
        fontFamily: 'var(--font-mono)', 
        color: color || 'var(--text-primary)',
        letterSpacing: '-0.5px'
      }}>
        {value}
        {unit && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 月份导航和统计头部 */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6, 
        padding: 24 
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button 
              icon={<LeftOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} 
              style={{ 
                border: 'none', 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-secondary)',
                borderRadius: 4
              }} 
            />
            <div style={{ textAlign: 'center', minWidth: 140 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{currentMonth.format('YYYY年MM月')}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>绩效回顾</div>
            </div>
            <Button 
              icon={<RightOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))} 
              style={{ 
                border: 'none', 
                background: 'var(--bg-tertiary)', 
                color: 'var(--text-secondary)',
                borderRadius: 4
              }} 
            />
            <Button 
              onClick={() => setCurrentMonth(dayjs())} 
              size="small" 
              style={{ 
                fontSize: 10, 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                background: 'var(--color-brand-bg)', 
                border: 'none', 
                color: 'var(--color-brand)', 
                borderRadius: 4 
              }}
            >
              今天
            </Button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'center' }}>
            <StatItem 
              label="月度盈亏" 
              value={`${monthStats.totalPnL >= 0 ? '+' : ''}${monthStats.totalPnL.toLocaleString()}`}
              unit="美元"
              color={monthStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
            />
            <div style={{ width: 1, height: 40, background: 'var(--border-primary)' }} />
            <StatItem label="交易笔数" value={monthStats.totalTrades} />
            <div style={{ width: 1, height: 40, background: 'var(--border-primary)' }} />
            <StatItem label="胜率" value={`${monthStats.winRate}%`} />
            <div style={{ width: 1, height: 40, background: 'var(--border-primary)' }} />
            <StatItem label="交易天数" value={monthStats.tradingDays} unit="活跃" />
          </div>
        </div>

        {monthStats.totalTrades > 0 && (
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-primary)' }}>
            <ReactECharts option={getMonthlyChartOption()} style={{ height: 100 }} notMerge={true} />
          </div>
        )}
      </div>

      {/* 最佳/最差日高亮 */}
      {monthStats.bestDay && (
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <div 
              style={{ 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderLeft: '4px solid var(--color-profit)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrophyOutlined style={{ color: 'var(--color-profit)' }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-profit)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>最佳盈利日</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{dayjs(monthStats.bestDay.date).format('MM月DD日')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-profit)' }}>+{monthStats.bestDay.totalPnL.toFixed(0)}</div>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)' }}>{monthStats.bestDay.trades.length} 笔</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div 
              style={{ 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderLeft: '4px solid var(--color-loss)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <WarningOutlined style={{ color: 'var(--color-loss)' }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-loss)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>最大回撤日</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{dayjs(monthStats.worstDay.date).format('MM月DD日')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-loss)' }}>{monthStats.worstDay.totalPnL.toFixed(0)}</div>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)' }}>{monthStats.worstDay.trades.length} 笔</div>
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
        gap: 32, 
        padding: '16px 24px', 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-profit)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>盈利日</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-loss)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>亏损日</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClockCircleOutlined style={{ color: 'var(--text-tertiary)', fontSize: 12 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>交易日：06:00 - 05:59</span>
        </div>
      </div>

      {/* 交易详情弹窗 */}
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
              <CalendarOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedDate} 交易报告</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={900}
        footer={[
          <Button 
            key="close" 
            onClick={() => setModalVisible(false)} 
            style={{ 
              fontWeight: 600, 
              fontSize: 12, 
              textTransform: 'uppercase',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              borderRadius: 4
            }}
          >
            关闭
          </Button>,
          <Button 
            key="manual" 
            icon={<EditOutlined />} 
            onClick={() => { setModalVisible(false); setManualReviewVisible(true); }} 
            style={{ 
              fontWeight: 600, 
              fontSize: 12, 
              textTransform: 'uppercase',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              borderRadius: 4
            }}
          >
            手动复盘
          </Button>,
          <Button 
            key="ai" 
            type="primary" 
            icon={<RobotOutlined />} 
            onClick={() => { 
              const dayTrades = tradesByDate[selectedDate].trades;
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
              setModalVisible(false);
              setAiReviewVisible(true);
            }} 
            style={{ 
              fontWeight: 600, 
              fontSize: 12, 
              textTransform: 'uppercase',
              background: 'var(--color-brand)',
              borderColor: 'var(--color-brand)',
              color: 'var(--bg-primary)',
              borderRadius: 4
            }}
          >
            AI 复盘
          </Button>
        ]}
      >
        {selectedDate && tradesByDate[selectedDate] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>当日盈亏</div>
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
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>交易数量</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {tradesByDate[selectedDate].trades.length} <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>笔</span>
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>胜率</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {(tradesByDate[selectedDate].winCount / tradesByDate[selectedDate].trades.length * 100).toFixed(1)}%
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>复盘状态</div>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: savedReviews[selectedDate] ? 'var(--color-profit)' : 'var(--text-tertiary)' 
                  }}>
                    {savedReviews[selectedDate] ? '已完成' : '待完成'}
                  </div>
                </div>
              </Col>
            </Row>
            
            <Table
              dataSource={tradesByDate[selectedDate].trades}
              pagination={false}
              size="small"
              className="binance-table"
              columns={[
                { 
                  title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>时间</span>, 
                  dataIndex: 'openTime', 
                  render: t => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{dayjs(t).format('HH:mm')}</span>
                },
                { 
                  title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>品种</span>, 
                  dataIndex: 'instrumentCode', 
                  render: c => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c}</span>
                },
                { 
                  title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>方向</span>, 
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
                  title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>点数</span>, 
                  dataIndex: 'ticks', 
                  align: 'right', 
                  render: t => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: t >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {t >= 0 ? '+' : ''}{t}
                    </span>
                  )
                },
                { 
                  title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>盈亏</span>, 
                  dataIndex: 'pnl', 
                  align: 'right', 
                  render: p => (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: p >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
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
              <RobotOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>AI 复盘对话</span>
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
            gap: 16, 
            padding: 16, 
            background: 'var(--bg-tertiary)', 
            borderRadius: 8 
          }}>
            {chatHistory.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                <div style={{ 
                  padding: 12, 
                  borderRadius: 12, 
                  maxWidth: '80%', 
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
          <div style={{ paddingTop: 16, display: 'flex', gap: 8 }}>
            <TextArea 
              placeholder="输入你的回答..." 
              autoSize={{ minRows: 1, maxRows: 3 }} 
              value={userInput} 
              onChange={e => setUserInput(e.target.value)} 
              style={{ 
                borderRadius: 8, 
                background: 'var(--bg-tertiary)', 
                borderColor: 'var(--border-primary)', 
                color: 'var(--text-primary)' 
              }} 
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
              style={{ 
                borderRadius: 8, 
                height: 'auto', 
                background: 'var(--color-brand)', 
                borderColor: 'var(--color-brand)', 
                color: 'var(--bg-primary)' 
              }} 
            />
          </div>
        </div>
      </Modal>

      <style>{`
        .binance-calendar .ant-picker-calendar-date-content {
          height: 60px !important;
          margin: 0 !important;
        }
        .binance-calendar .ant-picker-cell-inner {
          border: 1px solid var(--border-primary) !important;
          border-radius: 4px !important;
          margin: 2px !important;
          padding: 0 !important;
          min-height: 80px !important;
          background: var(--bg-tertiary) !important;
        }
        .binance-calendar .ant-picker-cell-inner:hover {
          background: var(--bg-primary) !important;
        }
        .binance-calendar .ant-picker-cell-selected .ant-picker-cell-inner {
          background: var(--color-brand-bg) !important;
          border-color: var(--color-brand) !important;
        }
        .binance-calendar .ant-picker-calendar-date-value {
          padding: 4px 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .binance-calendar .ant-picker-cell-today .ant-picker-calendar-date-value {
          color: var(--color-brand) !important;
        }
        .binance-calendar .ant-picker-content th {
          color: var(--text-tertiary) !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
        }
      `}</style>
    </div>
  );
};

export default TradeCalendar;
