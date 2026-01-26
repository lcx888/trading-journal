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
          {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(0)}
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
    
    // 无交易日显示空状态
    if (!data) {
      return null;
    }
    
    const isProfit = data.totalPnL > 0;
    const isReviewed = !!savedReviews[key];

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
        overlayInnerStyle={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          padding: 12
        }}
      >
        <div 
          style={{
            position: 'absolute',
            top: '22px',
            bottom: '4px',
            left: '4px',
            right: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: isProfit 
              ? 'rgba(16, 185, 129, 0.12)' 
              : 'rgba(244, 63, 94, 0.12)',
            borderLeft: `3px solid ${isProfit ? 'var(--color-profit)' : 'var(--color-loss)'}`,
            borderRadius: '0 4px 4px 0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => { setSelectedDate(key); setModalVisible(true); }}
        >
          {/* 复盘状态指示器 */}
          {!isReviewed && (
            <div style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-brand)',
              boxShadow: '0 0 4px var(--color-brand)'
            }} />
          )}
          
          {/* 盈亏金额 */}
          <div style={{ 
            fontSize: 14, 
            fontWeight: 700, 
            fontFamily: 'var(--font-mono)',
            color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)',
          }}>
            {isProfit ? '+' : ''}{data.totalPnL.toFixed(0)}
          </div>
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
        gap: 16,
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6, 
        padding: '14px 20px' 
      }}>
        {/* 左侧：月份导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button 
            icon={<LeftOutlined />} 
            onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))} 
            size="small"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)' }} 
          />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', minWidth: 100, textAlign: 'center' }}>
            {currentMonth.format('YYYY年M月')}
          </div>
          <Button 
            icon={<RightOutlined />} 
            onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))} 
            size="small"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)' }} 
          />
          <Button 
            onClick={() => setCurrentMonth(dayjs())} 
            size="small" 
            style={{ 
              fontSize: 11, 
              marginLeft: 4,
              background: 'var(--bg-tertiary)', 
              border: '1px solid var(--border-primary)', 
              color: 'var(--text-secondary)', 
              borderRadius: 4 
            }}
          >
            今天
          </Button>
        </div>

        {/* 右侧：核心数据 + 趋势 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* 月度盈亏 + 趋势 */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>月度盈亏</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end' }}>
              <span style={{ 
                fontSize: 20, 
                fontWeight: 700, 
                fontFamily: 'var(--font-mono)',
                color: monthStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
              }}>
                {monthStats.totalPnL >= 0 ? '+' : ''}{monthStats.totalPnL.toLocaleString()}
              </span>
              <TrendIndicator current={monthStats.totalPnL} previous={prevMonthStats.totalPnL} />
            </div>
          </div>
          
          <div style={{ width: 1, height: 32, background: 'var(--border-primary)' }} />
          
          {/* 交易数 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>交易</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {monthStats.totalTrades}
            </div>
          </div>
          
          {/* 胜率 + 趋势 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>胜率</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {monthStats.winRate}%
              </span>
              <TrendIndicator current={Number(monthStats.winRate)} previous={Number(prevMonthStats.winRate)} />
            </div>
          </div>
          
          {/* 交易日 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>交易日</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {monthStats.tradingDays}
            </div>
          </div>

          {/* 待复盘提醒 */}
          {pendingReviewDays > 0 && (
            <>
              <div style={{ width: 1, height: 32, background: 'var(--border-primary)' }} />
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                padding: '6px 12px',
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: 4
              }}>
                <div style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  background: 'var(--color-brand)',
                  animation: 'pulse 2s infinite'
                }} />
                <span style={{ fontSize: 11, color: 'var(--color-brand)', fontWeight: 600 }}>
                  {pendingReviewDays} 天待复盘
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 主日历 */}
      {monthStats.totalTrades === 0 ? (
        /* 空状态 */
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)', 
          borderRadius: 6,
          padding: '60px 20px',
          textAlign: 'center'
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
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)', 
          borderRadius: 6, 
          overflow: 'hidden'
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

      {/* 交易详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarOutlined style={{ color: 'var(--color-brand)' }} />
            <span>{selectedDate && dayjs(selectedDate).format('M月D日')} 交易明细</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>关闭</Button>,
          <Button key="ai" type="primary" icon={<RobotOutlined />} onClick={() => { setModalVisible(false); startAiReview(selectedDate); }}>
            AI 复盘
          </Button>
        ]}
      >
        {selectedDate && tradesByDate[selectedDate] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 日统计 */}
            <Row gutter={12}>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 12, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>当日盈亏</div>
                  <div style={{ 
                    fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: tradesByDate[selectedDate].totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                  }}>
                    {tradesByDate[selectedDate].totalPnL >= 0 ? '+' : ''}{tradesByDate[selectedDate].totalPnL.toFixed(2)}
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 12, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>交易数</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {tradesByDate[selectedDate].trades.length}
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 12, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>胜率</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {(tradesByDate[selectedDate].winCount / tradesByDate[selectedDate].trades.length * 100).toFixed(0)}%
                  </div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 12, border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>胜/负</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--color-profit)' }}>{tradesByDate[selectedDate].winCount}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                    <span style={{ color: 'var(--color-loss)' }}>{tradesByDate[selectedDate].lossCount}</span>
                  </div>
                </div>
              </Col>
            </Row>
            
            {/* 交易列表 */}
            <Table
              dataSource={tradesByDate[selectedDate].trades}
              pagination={false}
              size="small"
              rowKey={(record, index) => index}
              columns={[
                { 
                  title: '时间', 
                  dataIndex: 'openTime', 
                  width: 80,
                  render: t => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{dayjs(t).format('HH:mm')}</span>
                },
                { 
                  title: '品种', 
                  dataIndex: 'instrumentCode', 
                  render: c => <span style={{ fontWeight: 600 }}>{c}</span>
                },
                { 
                  title: '方向', 
                  dataIndex: 'direction', 
                  width: 60,
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
                  title: '点数', 
                  dataIndex: 'ticks', 
                  align: 'right',
                  width: 80,
                  render: t => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: t >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {t >= 0 ? '+' : ''}{t}
                    </span>
                  )
                },
                { 
                  title: '盈亏', 
                  dataIndex: 'pnl', 
                  align: 'right',
                  width: 100,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RobotOutlined style={{ color: 'var(--color-brand)' }} />
            <span>AI 复盘</span>
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
          border: 1px solid var(--border-primary) !important;
          border-radius: 4px !important;
          margin: 2px !important;
          padding: 0 !important;
          min-height: 70px !important;
          background: var(--bg-tertiary) !important;
          transition: all 0.15s !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .minimal-calendar .ant-picker-cell-inner:hover {
          border-color: var(--text-tertiary) !important;
        }
        .minimal-calendar .ant-picker-cell-selected .ant-picker-cell-inner {
          border-color: var(--color-brand) !important;
        }
        .minimal-calendar .ant-picker-calendar-date-value {
          position: absolute !important;
          top: 4px !important;
          left: 6px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: var(--text-tertiary) !important;
          z-index: 2 !important;
          pointer-events: none !important;
        }
        .minimal-calendar .ant-picker-cell-today .ant-picker-calendar-date-value {
          color: var(--color-brand) !important;
          font-weight: 700 !important;
        }
        .minimal-calendar .ant-picker-content th {
          color: var(--text-tertiary) !important;
          font-weight: 600 !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 8px 0 !important;
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
