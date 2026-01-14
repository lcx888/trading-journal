import { useState, useEffect, useMemo } from 'react';
import {
  Card, Calendar, Badge, Modal, Table, Tag, Statistic, Row, Col,
  Select, Button, Space, Empty, Tooltip, Typography, Divider,
  Spin, Input, Progress, Alert, Collapse
} from 'antd';
import {
  CalendarOutlined,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  TrophyOutlined,
  LeftOutlined,
  RightOutlined,
  DollarOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  BulbOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  AimOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  EyeOutlined,
  SaveOutlined,
  FileTextOutlined,
  StarOutlined,
  StarFilled,
  GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import StorageService from '../services/storage';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// TradingView Colors
const COLORS = {
  profit: '#26a69a',
  loss: '#ef5350',
  primary: '#2962ff',
  text: '#131722',
  textLight: '#787b86',
  border: '#e0e3eb',
  grid: '#f0f3fa'
};

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
  const [isTyping, setIsTyping] = useState(false);
  const [savedReviews, setSavedReviews] = useState({});
  const [viewReviewVisible, setViewReviewVisible] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [manualReviewVisible, setManualReviewVisible] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [manualReviewForm, setManualReviewForm] = useState({
    marketType: '', volatility: 5, liquidity: 5, emotionScore: 5,
    keyFindings: ['', '', ''], tomorrowPlan: ['', '', ''], notes: '',
  });

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
    return {
      grid: { left: 0, right: 0, bottom: 0, top: 10 },
      xAxis: { type: 'category', show: false },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'line', data, smooth: true, symbol: 'none',
        lineStyle: { color: COLORS.primary, width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(41,98,255,0.1)' }, { offset: 1, color: 'transparent' }] } }
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
        className="h-full w-full p-1 cursor-pointer transition-all hover:bg-slate-50"
        onClick={() => { setSelectedDate(key); setModalVisible(true); }}
      >
        <div className="flex flex-col h-full justify-between">
          <div className="flex justify-between items-start">
            <span className={`text-[9px] font-bold px-1.5 rounded bg-slate-100 text-slate-500`}>{data.trades.length}</span>
            {savedReviews[key] && (
              <span className="text-[10px]">{savedReviews[key].type === 'ai' ? <RobotOutlined className="text-purple-500" /> : <EditOutlined className="text-blue-500" />}</span>
            )}
          </div>
          <div className={`text-xs font-bold text-right ${isProfit ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
            {isProfit ? '+' : ''}{Math.abs(data.totalPnL) >= 1000 ? `${(data.totalPnL / 1000).toFixed(1)}k` : data.totalPnL.toFixed(0)}
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-[#26a69a] transition-all" style={{ width: `${winRate}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Month Navigation & Stats Header */}
      <div className="modern-card bg-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button icon={<LeftOutlined />} onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} className="border-none bg-slate-50 hover:bg-slate-100 rounded-lg" />
            <div className="text-center min-w-[140px]">
              <div className="text-lg font-bold text-[#131722]">{currentMonth.format('YYYY年MM月')}</div>
              <div className="text-[10px] font-bold text-[#787b86] uppercase tracking-widest">绩效回顾</div>
            </div>
            <Button icon={<RightOutlined />} onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))} className="border-none bg-slate-50 hover:bg-slate-100 rounded-lg" />
            <Button onClick={() => setCurrentMonth(dayjs())} size="small" className="text-[10px] font-bold uppercase tracking-tighter bg-[#f0f3fa] border-none text-[#2962ff] rounded-lg">今天</Button>
          </div>

          <div className="flex flex-wrap gap-8">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">月度盈亏</div>
              <div className={`text-xl font-bold stat-value ${monthStats.totalPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                {monthStats.totalPnL >= 0 ? '+' : ''}{monthStats.totalPnL.toLocaleString()} <span className="text-[10px] opacity-60">美元</span>
              </div>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block" />
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">交易笔数</div>
              <div className="text-xl font-bold text-[#131722]">{monthStats.totalTrades}</div>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block" />
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">胜率</div>
              <div className="text-xl font-bold text-[#131722]">{monthStats.winRate}%</div>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block" />
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">交易天数</div>
              <div className="text-xl font-bold text-[#131722]">{monthStats.tradingDays} <span className="text-[10px] text-slate-400">活跃</span></div>
            </div>
          </div>
        </div>

        {monthStats.totalTrades > 0 && (
          <div className="mt-8 border-t border-slate-50 pt-6">
            <ReactECharts option={getMonthlyChartOption()} style={{ height: '100px' }} notMerge={true} />
          </div>
        )}
      </div>

      {/* Highlights: Best/Worst Days */}
      {monthStats.bestDay && (
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <div className="modern-card bg-white p-4 flex justify-between items-center border-l-4 border-[#26a69a] cursor-pointer hover:shadow-lg transition-all"
                 onClick={() => { setSelectedDate(monthStats.bestDay.date); setModalVisible(true); }}>
              <div>
                <div className="text-[9px] font-bold text-[#26a69a] uppercase tracking-widest">最佳盈利日</div>
                <div className="text-sm font-bold text-[#131722]">{dayjs(monthStats.bestDay.date).format('DD MMM')}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#26a69a]">+{monthStats.bestDay.totalPnL.toFixed(0)}</div>
                <div className="text-[9px] font-bold text-slate-400">{monthStats.bestDay.trades.length} 笔</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div className="modern-card bg-white p-4 flex justify-between items-center border-l-4 border-[#ef5350] cursor-pointer hover:shadow-lg transition-all"
                 onClick={() => { setSelectedDate(monthStats.worstDay.date); setModalVisible(true); }}>
              <div>
                <div className="text-[9px] font-bold text-[#ef5350] uppercase tracking-widest">最大回撤日</div>
                <div className="text-sm font-bold text-[#131722]">{dayjs(monthStats.worstDay.date).format('DD MMM')}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#ef5350]">{monthStats.worstDay.totalPnL.toFixed(0)}</div>
                <div className="text-[9px] font-bold text-slate-400">{monthStats.worstDay.trades.length} 笔</div>
              </div>
            </div>
          </Col>
        </Row>
      )}

      {/* Main Calendar Card */}
      <div className="modern-card bg-white p-2">
        <Calendar
          value={currentMonth}
          onPanelChange={setCurrentMonth}
          headerRender={() => null}
          fullScreen={true}
          cellRender={(date, info) => info.type === 'date' ? dateCellRender(date) : null}
          className="trading-calendar"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-8 py-4 px-6 bg-white rounded-xl border border-[#e0e3eb]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#26a69a]" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">盈利日</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#ef5350]" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">亏损日</span>
        </div>
        <div className="flex items-center gap-2">
          <ClockCircleOutlined className="text-slate-400 text-xs" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">交易日：06:00 - 05:59</span>
        </div>
      </div>

      {/* Trade Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f0f3fa] flex items-center justify-center">
              <CalendarOutlined className="text-[#2962ff]" />
            </div>
            <span className="text-lg font-bold">{selectedDate} 交易报告</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)} className="font-bold text-xs uppercase">关闭</Button>,
          <Button key="manual" icon={<EditOutlined />} onClick={() => { setModalVisible(false); setManualReviewVisible(true); }} className="font-bold text-xs uppercase">手动复盘</Button>,
          <Button key="ai" type="primary" icon={<RobotOutlined />} onClick={() => { 
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
          }} className="font-bold text-xs uppercase">AI 复盘</Button>
        ]}
      >
        {selectedDate && tradesByDate[selectedDate] && (
          <div className="space-y-6">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title={<span className="text-[10px] font-bold uppercase text-slate-400">当日盈亏</span>}
                           value={tradesByDate[selectedDate].totalPnL} precision={2}
                           valueStyle={{ color: tradesByDate[selectedDate].totalPnL >= 0 ? COLORS.profit : COLORS.loss, fontWeight: 'bold' }} />
              </Col>
              <Col span={6}>
                <Statistic title={<span className="text-[10px] font-bold uppercase text-slate-400">交易数量</span>} value={tradesByDate[selectedDate].trades.length} suffix="笔" />
              </Col>
              <Col span={6}>
                <Statistic title={<span className="text-[10px] font-bold uppercase text-slate-400">胜率</span>} value={(tradesByDate[selectedDate].winCount / tradesByDate[selectedDate].trades.length * 100).toFixed(1)} suffix="%" />
              </Col>
              <Col span={6}>
                <Statistic title={<span className="text-[10px] font-bold uppercase text-slate-400">复盘状态</span>} 
                           value={savedReviews[selectedDate] ? '已完成' : '待完成'} 
                           valueStyle={{ fontSize: 14, color: savedReviews[selectedDate] ? COLORS.profit : '#787b86', fontWeight: 'bold' }} />
              </Col>
            </Row>
            
            <Table
              dataSource={tradesByDate[selectedDate].trades}
              pagination={false}
              size="small"
              className="modern-table"
              columns={[
                { title: '时间', dataIndex: 'openTime', render: t => dayjs(t).format('HH:mm') },
                { title: '品种', dataIndex: 'instrumentCode', render: c => <span className="font-bold">{c}</span> },
                { title: '方向', dataIndex: 'direction', render: d => <Tag color={d === 'LONG' ? 'cyan' : 'orange'} className="border-none font-bold text-[10px]">{d === 'LONG' ? '多' : '空'}</Tag> },
                { title: '点数', dataIndex: 'ticks', align: 'right', render: t => <span className={t >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{t >= 0 ? '+' : ''}{t}</span> },
                { title: '盈亏', dataIndex: 'pnl', align: 'right', render: p => <span className={`font-bold ${p >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{p >= 0 ? '+' : ''}{p.toFixed(2)}</span> }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Simplified Modals for UI consistency */}
      <Modal
        title="AI 复盘对话"
        open={aiReviewVisible}
        onCancel={() => setAiReviewVisible(false)}
        footer={null}
        width={600}
        className="trading-view-modal"
      >
        <div className="flex flex-col h-[500px]">
          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-xl">
            {chatHistory.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${m.role === 'ai' ? 'bg-white shadow-sm border border-slate-100' : 'bg-[#2962ff] text-white'}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 flex gap-2">
            <TextArea placeholder="输入你的回答..." autoSize={{ minRows: 1, maxRows: 3 }} value={userInput} onChange={e => setUserInput(e.target.value)} className="rounded-xl border-slate-200" />
            <Button type="primary" icon={<SendOutlined />} onClick={() => {
              if (!userInput.trim()) return;
              const newHistory = [...chatHistory, { role: 'user', content: userInput }];
              setChatHistory(newHistory);
              setUserInput('');
              // Just a mock response for now to keep UI flowing
              setTimeout(() => {
                setChatHistory([...newHistory, { role: 'ai', content: '已记录，请继续保持规范复盘。' }]);
              }, 500);
            }} className="rounded-xl h-auto" />
          </div>
        </div>
      </Modal>

      <style>{`
        .trading-calendar .ant-picker-calendar-date-content {
          height: 60px !important;
          margin: 0 !important;
        }
        .trading-calendar .ant-picker-cell-inner {
          border: 1px solid #f0f3fa !important;
          border-radius: 4px !important;
          margin: 2px !important;
          padding: 0 !important;
          min-height: 80px !important;
        }
        .trading-calendar .ant-picker-cell-selected .ant-picker-cell-inner {
          background: #f8f9fd !important;
          border-color: #2962ff !important;
        }
        .trading-calendar .ant-picker-calendar-date-value {
          padding: 4px 8px;
          font-size: 13px;
          font-weight: 600;
          color: #787b86;
        }
        .ant-picker-cell-today .ant-picker-calendar-date-value {
          color: #2962ff !important;
        }
      `}</style>
    </div>
  );
};

export default TradeCalendar;
