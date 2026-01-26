import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Modal, Table, Tag, Row, Col,
  Button, Spin, Input, Tooltip, Progress
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
  LineChartOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
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
        areaStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: finalValue >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)' },
              { offset: 1, color: 'rgba(0, 0, 0, 0)' }
            ]
          }
        }
      }]
    };
  };

  const dateCellRender = (date) => {
    const key = date.format('YYYY-MM-DD');
    const data = tradesByDate[key];
    const isToday = date.isSame(dayjs(), 'day');
    
    if (!data) {
      return (
        <div className={`calendar-cell-empty ${isToday ? 'is-today' : ''}`}>
          <span className="cell-date">{date.date()}</span>
        </div>
      );
    }

    const isProfit = data.totalPnL > 0;
    const winRate = (data.winCount / data.trades.length * 100).toFixed(0);

    return (
      <div 
        className={`calendar-cell-content ${isProfit ? 'is-profit' : 'is-loss'} ${isToday ? 'is-today' : ''}`}
        onClick={() => { setSelectedDate(key); setModalVisible(true); }}
      >
        <div className="cell-header">
          <span className="cell-date">{date.date()}</span>
          {savedReviews[key] && (
            <Tooltip title={savedReviews[key].type === 'ai' ? 'AI 已复盘' : '手动已复盘'}>
              <span className={`cell-review-icon ${savedReviews[key].type}`}>
                {savedReviews[key].type === 'ai' ? <RobotOutlined /> : <EditOutlined />}
              </span>
            </Tooltip>
          )}
        </div>
        
        <div className="cell-body">
          <div className="cell-pnl">
            {isProfit ? '+' : ''}{Math.abs(data.totalPnL) >= 1000 ? `${(data.totalPnL / 1000).toFixed(1)}k` : data.totalPnL.toFixed(0)}
          </div>
          <div className="cell-count">{data.trades.length} 笔</div>
        </div>

        <div className="cell-footer">
          <div className="win-rate-bar">
            <div className="win-rate-fill" style={{ width: `${winRate}%` }} />
          </div>
        </div>
      </div>
    );
  };

  const StatItem = ({ label, value, unit, color, icon }) => (
    <div className="stat-card">
      <div className="stat-icon" style={{ color: color || 'var(--text-tertiary)' }}>{icon}</div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>
          {value}
          {unit && <span className="stat-unit">{unit}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="trade-calendar-page">
      {/* 顶部统计面板 */}
      <div className="dashboard-header">
        <div className="month-navigator">
          <div className="nav-controls">
            <Button 
              icon={<LeftOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} 
              className="nav-btn"
            />
            <div className="current-month">
              <span className="month-text">{currentMonth.format('YYYY年MM月')}</span>
              <span className="sub-text">TRADING PERFORMANCE</span>
            </div>
            <Button 
              icon={<RightOutlined />} 
              onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))} 
              className="nav-btn"
            />
          </div>
          <Button 
            onClick={() => setCurrentMonth(dayjs())} 
            className="today-btn"
          >
            回到今天
          </Button>
        </div>

        <div className="stats-grid">
          <StatItem 
            label="月度总盈亏" 
            value={`${monthStats.totalPnL >= 0 ? '+' : ''}${monthStats.totalPnL.toLocaleString()}`}
            unit="USD"
            color={monthStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
            icon={<LineChartOutlined />}
          />
          <StatItem label="交易总笔数" value={monthStats.totalTrades} unit="TRADES" icon={<CalendarOutlined />} />
          <StatItem label="综合胜率" value={`${monthStats.winRate}%`} icon={<TrophyOutlined />} />
          <StatItem label="活跃交易日" value={monthStats.tradingDays} unit="DAYS" icon={<ClockCircleOutlined />} />
        </div>

        {monthStats.totalTrades > 0 && (
          <div className="equity-curve-mini">
            <div className="curve-label">
              <InfoCircleOutlined /> 月度权益曲线
            </div>
            <ReactECharts option={getMonthlyChartOption()} style={{ height: 80 }} notMerge={true} />
          </div>
        )}
      </div>

      {/* 核心日历区域 */}
      <div className="calendar-container">
        <div className="calendar-sidebar">
          <div className="sidebar-section">
            <h3 className="section-title">月度高光</h3>
            {monthStats.bestDay ? (
              <div className="highlight-card best" onClick={() => { setSelectedDate(monthStats.bestDay.date); setModalVisible(true); }}>
                <div className="highlight-icon"><TrophyOutlined /></div>
                <div className="highlight-info">
                  <div className="label">最佳盈利日</div>
                  <div className="date">{dayjs(monthStats.bestDay.date).format('MM月DD日')}</div>
                  <div className="value">+{monthStats.bestDay.totalPnL.toFixed(0)}</div>
                </div>
              </div>
            ) : (
              <div className="empty-highlight">暂无数据</div>
            )}
            
            {monthStats.worstDay ? (
              <div className="highlight-card worst" onClick={() => { setSelectedDate(monthStats.worstDay.date); setModalVisible(true); }}>
                <div className="highlight-icon"><WarningOutlined /></div>
                <div className="highlight-info">
                  <div className="label">最大回撤日</div>
                  <div className="date">{dayjs(monthStats.worstDay.date).format('MM月DD日')}</div>
                  <div className="value">{monthStats.worstDay.totalPnL.toFixed(0)}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="sidebar-section">
            <h3 className="section-title">图例说明</h3>
            <div className="legend-list">
              <div className="legend-item">
                <div className="dot profit"></div>
                <span>盈利交易日</span>
              </div>
              <div className="legend-item">
                <div className="dot loss"></div>
                <span>亏损交易日</span>
              </div>
              <div className="legend-item">
                <div className="dot ai"></div>
                <span>AI 复盘已完成</span>
              </div>
            </div>
          </div>
        </div>

        <div className="calendar-main">
          <Calendar
            value={currentMonth}
            onPanelChange={setCurrentMonth}
            headerRender={() => null}
            fullScreen={true}
            cellRender={(date, info) => info.type === 'date' ? dateCellRender(date) : null}
            className="professional-calendar"
          />
        </div>
      </div>

      {/* 交易详情弹窗 */}
      <Modal
        title={
          <div className="modal-custom-header">
            <div className="header-icon"><CalendarOutlined /></div>
            <div className="header-text">
              <span className="main-title">{selectedDate} 交易报告</span>
              <span className="sub-title">DAILY PERFORMANCE REPORT</span>
            </div>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        centered
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)} className="modal-btn">关闭</Button>,
          <Button key="manual" icon={<EditOutlined />} onClick={() => { setModalVisible(false); setManualReviewVisible(true); }} className="modal-btn secondary">手动复盘</Button>,
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
          }} className="modal-btn primary">AI 复盘</Button>
        ]}
      >
        {selectedDate && tradesByDate[selectedDate] && (
          <div className="modal-report-content">
            <div className="report-stats-row">
              <div className="report-stat-box">
                <span className="label">当日净盈亏</span>
                <span className={`value ${tradesByDate[selectedDate].totalPnL >= 0 ? 'profit' : 'loss'}`}>
                  {tradesByDate[selectedDate].totalPnL >= 0 ? '+' : ''}{tradesByDate[selectedDate].totalPnL.toFixed(2)}
                </span>
              </div>
              <div className="report-stat-box">
                <span className="label">交易笔数</span>
                <span className="value">{tradesByDate[selectedDate].trades.length}</span>
              </div>
              <div className="report-stat-box">
                <span className="label">胜率</span>
                <span className="value">{(tradesByDate[selectedDate].winCount / tradesByDate[selectedDate].trades.length * 100).toFixed(0)}%</span>
              </div>
              <div className="report-stat-box">
                <span className="label">复盘状态</span>
                <span className={`value status ${savedReviews[selectedDate] ? 'done' : 'pending'}`}>
                  {savedReviews[selectedDate] ? '已完成' : '待复盘'}
                </span>
              </div>
            </div>
            
            <Table
              dataSource={tradesByDate[selectedDate].trades}
              pagination={false}
              size="small"
              className="report-table"
              columns={[
                { title: '时间', dataIndex: 'openTime', render: t => dayjs(t).format('HH:mm') },
                { title: '品种', dataIndex: 'instrumentCode', className: 'font-bold' },
                { title: '方向', dataIndex: 'direction', render: d => <Tag color={d === 'LONG' ? 'green' : 'red'}>{d === 'LONG' ? '多' : '空'}</Tag> },
                { title: '点数', dataIndex: 'ticks', align: 'right', render: t => <span className={t >= 0 ? 'text-profit' : 'text-loss'}>{t >= 0 ? '+' : ''}{t}</span> },
                { title: '盈亏', dataIndex: 'pnl', align: 'right', render: p => <span className={`font-mono font-bold ${p >= 0 ? 'text-profit' : 'text-loss'}`}>{p >= 0 ? '+' : ''}{p.toFixed(2)}</span> }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* AI 复盘对话弹窗 */}
      <Modal
        title={
          <div className="modal-custom-header">
            <div className="header-icon ai"><RobotOutlined /></div>
            <div className="header-text">
              <span className="main-title">AI 复盘对话</span>
              <span className="sub-title">AI-POWERED TRADING REVIEW</span>
            </div>
          </div>
        }
        open={aiReviewVisible}
        onCancel={() => setAiReviewVisible(false)}
        footer={null}
        width={550}
        centered
      >
        <div className="ai-chat-container">
          <div className="chat-messages">
            {chatHistory.map((m, i) => (
              <div key={i} className={`message-wrapper ${m.role}`}>
                <div className="message-bubble">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="chat-input-area">
            <TextArea 
              placeholder="输入你的回答..." 
              autoSize={{ minRows: 1, maxRows: 3 }} 
              value={userInput} 
              onChange={e => setUserInput(e.target.value)} 
              onPressEnter={e => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  // 发送逻辑
                }
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
            />
          </div>
        </div>
      </Modal>

      <style>{`
        .trade-calendar-page {
          padding: 24px;
          background: #0a0a0a;
          min-height: 100vh;
          color: #fff;
        }

        /* 顶部面板 */
        .dashboard-header {
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .month-navigator {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .nav-controls {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .nav-btn {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #888;
          width: 40px;
          height: 40px;
          border-radius: 8px;
        }

        .current-month {
          text-align: center;
        }

        .month-text {
          display: block;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .sub-text {
          font-size: 10px;
          color: #555;
          font-weight: 600;
          letter-spacing: 2px;
        }

        .today-btn {
          background: transparent;
          border: 1px solid #333;
          color: #888;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #161616;
          border-radius: 10px;
          border: 1px solid #222;
        }

        .stat-icon {
          font-size: 20px;
          opacity: 0.5;
        }

        .stat-label {
          font-size: 11px;
          color: #666;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .stat-unit {
          font-size: 10px;
          margin-left: 4px;
          opacity: 0.4;
        }

        .equity-curve-mini {
          border-top: 1px solid #222;
          padding-top: 16px;
        }

        .curve-label {
          font-size: 11px;
          color: #444;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* 日历布局 */
        .calendar-container {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
        }

        .calendar-sidebar {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section-title {
          font-size: 12px;
          font-weight: 700;
          color: #444;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 16px;
        }

        .highlight-card {
          background: #111;
          border: 1px solid #222;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          gap: 16px;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 12px;
        }

        .highlight-card:hover {
          border-color: #444;
          transform: translateY(-2px);
        }

        .highlight-card.best { border-left: 4px solid #10b981; }
        .highlight-card.worst { border-left: 4px solid #f43f5e; }

        .highlight-icon { font-size: 20px; }
        .highlight-card.best .highlight-icon { color: #10b981; }
        .highlight-card.worst .highlight-icon { color: #f43f5e; }

        .highlight-info .label { font-size: 10px; color: #555; font-weight: 600; }
        .highlight-info .date { font-size: 14px; font-weight: 600; margin: 2px 0; }
        .highlight-info .value { font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono'; }
        .highlight-card.best .value { color: #10b981; }
        .highlight-card.worst .value { color: #f43f5e; }

        .legend-list {
          background: #111;
          border: 1px solid #222;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #888;
        }

        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot.profit { background: #10b981; }
        .dot.loss { background: #f43f5e; }
        .dot.ai { background: #f0b90b; }

        /* 日历核心样式 */
        .calendar-main {
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 12px;
        }

        .professional-calendar .ant-picker-calendar-date {
          border: 1px solid #222 !important;
          border-radius: 6px !important;
          margin: 4px !important;
          background: #0d0d0d !important;
          height: 100px !important;
          transition: all 0.2s;
        }

        .professional-calendar .ant-picker-calendar-date:hover {
          background: #161616 !important;
          border-color: #444 !important;
        }

        .calendar-cell-empty {
          height: 100%;
          padding: 8px;
          opacity: 0.2;
        }

        .calendar-cell-content {
          height: 100%;
          padding: 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .cell-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .cell-date {
          font-size: 12px;
          font-weight: 600;
          color: #555;
        }

        .is-today .cell-date {
          color: #f0b90b;
        }

        .cell-review-icon { font-size: 10px; }
        .cell-review-icon.ai { color: #f0b90b; }

        .cell-pnl {
          font-size: 16px;
          font-weight: 700;
          font-family: 'JetBrains Mono';
          text-align: right;
        }

        .is-profit .cell-pnl { color: #10b981; }
        .is-loss .cell-pnl { color: #f43f5e; }

        .cell-count {
          font-size: 9px;
          color: #444;
          text-align: right;
          font-weight: 600;
        }

        .win-rate-bar {
          height: 2px;
          background: #222;
          border-radius: 1px;
          overflow: hidden;
        }

        .win-rate-fill {
          height: 100%;
          background: #10b981;
        }

        /* 弹窗样式 */
        .modal-custom-header {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-icon {
          width: 40px;
          height: 40px;
          background: #1a1a1a;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f0b90b;
          font-size: 20px;
        }

        .header-icon.ai { color: #f0b90b; background: rgba(240, 185, 11, 0.1); }

        .header-text { display: flex; flex-direction: column; }
        .main-title { font-size: 18px; font-weight: 700; color: #fff; }
        .sub-title { font-size: 10px; color: #555; font-weight: 700; letter-spacing: 1px; }

        .report-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .report-stat-box {
          background: #161616;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #222;
        }

        .report-stat-box .label { font-size: 10px; color: #555; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .report-stat-box .value { font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono'; color: #fff; }
        .report-stat-box .value.profit { color: #10b981; }
        .report-stat-box .value.loss { color: #f43f5e; }
        .report-stat-box .value.status.done { color: #10b981; font-size: 14px; }
        .report-stat-box .value.status.pending { color: #555; font-size: 14px; }

        .modal-btn { border-radius: 6px; font-weight: 600; font-size: 12px; }
        .modal-btn.primary { background: #f0b90b; border-color: #f0b90b; color: #000; }
        .modal-btn.secondary { background: #1a1a1a; border-color: #333; color: #888; }

        /* AI 对话 */
        .ai-chat-container {
          background: #0d0d0d;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          height: 450px;
        }

        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message-wrapper { display: flex; }
        .message-wrapper.ai { justify-content: flex-start; }
        .message-wrapper.user { justify-content: flex-end; }

        .message-bubble {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
        }

        .ai .message-bubble { background: #1a1a1a; color: #ccc; border: 1px solid #222; }
        .user .message-bubble { background: #f0b90b; color: #000; font-weight: 500; }

        .chat-input-area {
          padding: 16px;
          border-top: 1px solid #222;
          display: flex;
          gap: 12px;
        }
      `}</style>
    </div>
  );
};

export default TradeCalendar;
