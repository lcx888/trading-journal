import { useState, useEffect } from 'react';
import { 
  ArrowRightOutlined,
  BarChartOutlined,
  RiseOutlined,
  MenuOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  AimOutlined,
  BulbOutlined,
  StarOutlined,
  RobotOutlined,
  ExperimentOutlined,
  AlertOutlined,
  DashboardOutlined,
  LineChartOutlined,
  HeartOutlined,
  FireOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

// 币安风格导航栏
const Navbar = ({ onStart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0d0d10]/95 backdrop-blur-xl border-b border-[rgba(255,255,255,0.05)]' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 rounded-lg object-cover" />
          <div>
            <span className="text-lg font-bold text-[#ffffff]">Metworth</span>
            <span className="text-lg font-bold text-[#eab308]">AI</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-[#9ca3af] hover:text-[#eab308] transition-colors">功能</a>
          <a href="#ai-coach" className="text-sm font-medium text-[#9ca3af] hover:text-[#eab308] transition-colors">AI教练</a>
          <a href="#workflow" className="text-sm font-medium text-[#9ca3af] hover:text-[#eab308] transition-colors">流程</a>
          <button onClick={onStart} className="text-sm font-medium text-[#9ca3af] hover:text-[#ffffff] transition-colors">
            登录
          </button>
          <button onClick={onStart} className="text-sm font-semibold bg-[#eab308] text-[#0a0a0c] px-5 py-2 rounded hover:opacity-90 transition-all">
            免费开始
          </button>
        </div>

        <button className="md:hidden text-xl text-[#6b7280]" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden bg-[#0d0d10] border-t border-[rgba(255,255,255,0.05)] p-6 flex flex-col gap-4">
          <a href="#features" className="text-base font-medium text-[#9ca3af] hover:text-[#eab308]">功能</a>
          <a href="#ai-coach" className="text-base font-medium text-[#9ca3af] hover:text-[#eab308]">AI教练</a>
          <a href="#workflow" className="text-base font-medium text-[#9ca3af] hover:text-[#eab308]">流程</a>
          <button onClick={onStart} className="w-full py-3 border border-[rgba(255,255,255,0.05)] text-[#ffffff] rounded font-medium hover:border-[#eab308]">登录</button>
          <button onClick={onStart} className="w-full py-3 bg-[#eab308] text-[#0a0a0c] rounded font-semibold">免费开始</button>
        </div>
      )}
    </nav>
  );
};

// 模拟交易界面 - 增强版
const MockInterface = () => {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-12">
      <div className="bg-[#0d0d10] rounded-lg border border-[rgba(255,255,255,0.05)] overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f43f5e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
            <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
          </div>
          <div className="text-xs text-[#6b7280] font-mono">AI Trading Coach Dashboard</div>
          <div className="w-16"></div>
        </div>
        
        {/* 内容 */}
        <div className="p-4 grid grid-cols-4 gap-4">
          {/* 左侧主图表 */}
          <div className="col-span-3 bg-[rgba(255,255,255,0.05)] rounded p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#ffffff] font-semibold">权益曲线 & 蒙特卡洛预测</div>
              <div className="text-2xl font-bold text-[#10b981] font-mono">+$24,580</div>
            </div>
            {/* 模拟曲线 */}
            <div className="h-40 flex items-end justify-between gap-1 relative">
              {[40, 50, 35, 60, 45, 70, 55, 80, 65, 90, 75, 85, 70, 95, 80, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-[#10b981] rounded-t" style={{ height: `${h}%` }}></div>
              ))}
              {/* 预测区域 */}
              <div className="absolute right-0 top-0 w-1/4 h-full bg-gradient-to-r from-transparent to-[#eab308]/20 rounded flex items-center justify-center">
                <span className="text-xs text-[#eab308] font-medium">预测区</span>
              </div>
            </div>
          </div>
          
          {/* 右侧统计 */}
          <div className="space-y-3">
            <div className="bg-[rgba(255,255,255,0.05)] rounded p-3">
              <div className="text-xs text-[#9ca3af] mb-1">胜率</div>
              <div className="text-xl font-bold text-[#ffffff] font-mono">68.5%</div>
            </div>
            <div className="bg-[rgba(255,255,255,0.05)] rounded p-3">
              <div className="text-xs text-[#9ca3af] mb-1">R倍数</div>
              <div className="text-xl font-bold text-[#eab308] font-mono">2.35R</div>
            </div>
            <div className="bg-[rgba(255,255,255,0.05)] rounded p-3">
              <div className="text-xs text-[#9ca3af] mb-1">压力系数</div>
              <div className="flex gap-0.5">
                {[1,2,3].map(i => <div key={i} className="w-3 h-3 bg-[#10b981] rounded-sm"></div>)}
                {[4,5].map(i => <div key={i} className="w-3 h-3 bg-[#374151] rounded-sm"></div>)}
              </div>
            </div>
          </div>
        </div>
        
        {/* AI 诊断条 */}
        <div className="px-4 py-3 bg-[#eab308]/10 border-t border-[#eab308]/20">
          <div className="flex items-center gap-3 mb-2">
            <RobotOutlined className="text-[#eab308]" />
            <span className="text-sm font-semibold text-[#ffffff]">AI 智能诊断</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 bg-[#10b981]/20 text-[#10b981] rounded">✓ 执行果断</span>
            <span className="text-xs px-2 py-1 bg-[#eab308]/20 text-[#eab308] rounded">⚡ 提款机时段: 09:30-10:30</span>
            <span className="text-xs px-2 py-1 bg-[#f43f5e]/20 text-[#f43f5e] rounded">⚠ 利润回吐 23%</span>
            <span className="text-xs px-2 py-1 bg-[#8b5cf6]/20 text-[#8b5cf6] rounded">📊 建议: 早出策略</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 功能卡片
const FeatureCard = ({ icon, title, description, isNew }) => (
  <div className="bg-[#0d0d10] border border-[rgba(255,255,255,0.05)] rounded-lg p-6 hover:border-[#eab308]/30 transition-all group relative">
    {isNew && (
      <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-[#f43f5e] text-white text-xs font-bold rounded">NEW</div>
    )}
    <div className="w-12 h-12 rounded bg-[#eab308]/10 flex items-center justify-center mb-4 group-hover:bg-[#eab308]/20 transition-colors">
      <span className="text-2xl text-[#eab308]">{icon}</span>
    </div>
    <h3 className="text-base font-semibold text-[#ffffff] mb-2">{title}</h3>
    <p className="text-sm text-[#9ca3af] leading-relaxed">{description}</p>
  </div>
);

// AI 教练功能卡片
const AICoachCard = ({ icon, title, description, color = '#eab308' }) => (
  <div className="flex gap-4 p-4 bg-[rgba(255,255,255,0.03)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-all">
    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
      <span className="text-xl" style={{ color }}>{icon}</span>
    </div>
    <div>
      <h4 className="text-sm font-semibold text-[#ffffff] mb-1">{title}</h4>
      <p className="text-xs text-[#9ca3af] leading-relaxed">{description}</p>
    </div>
  </div>
);

// 主页组件
const Home = ({ onStart }) => {
  const features = [
    { icon: <RobotOutlined />, title: 'AI 智能诊断', description: '自动识别交易行为模式，诊断报复性交易、处置效应、执行焦虑等问题', isNew: true },
    { icon: <ExperimentOutlined />, title: '蒙特卡洛模拟', description: '基于历史数据进行 1000 次模拟，预测未来交易盈亏概率分布', isNew: true },
    { icon: <AimOutlined />, title: '最优止损预测', description: '回测不同止损位对总盈亏的影响，智能推荐最佳止损策略', isNew: true },
    { icon: <BarChartOutlined />, title: '期望值分布', description: '按时段、方向、品种分析期望值，找出提款机时段和碎钞机时段', isNew: true },
    { icon: <HeartOutlined />, title: '心理压力评分', description: '基于 MAE 深度和持仓时长，为每笔交易打出 1-5 级压力分', isNew: true },
    { icon: <DashboardOutlined />, title: 'R倍数追踪', description: '计算每笔交易的风险回报倍数，评估盈亏质量', isNew: true },
    { icon: <ThunderboltOutlined />, title: 'MAE/MFE 可视化', description: '直观展示每笔交易的波动区间，标注利润回吐区域' },
    { icon: <RiseOutlined />, title: '权益曲线分析', description: '可视化权益变化，自动标注关键节点和最大回撤' },
    { icon: <SafetyCertificateOutlined />, title: '风险管理', description: '全面的风险指标监控，帮助建立稳健的交易系统' },
  ];

  const aiCoachFeatures = [
    { icon: <AlertOutlined />, title: '报复性交易检测', description: '自动识别亏损后 5 分钟内的冲动交易', color: '#f43f5e' },
    { icon: <FireOutlined />, title: '利润留存率分析', description: '计算 (MFE - PnL) / MFE，识别严重的获利回吐', color: '#eab308' },
    { icon: <LineChartOutlined />, title: '处置效应诊断', description: '对比盈亏单持仓时长，检测过早止盈过晚止损', color: '#8b5cf6' },
    { icon: <TrophyOutlined />, title: '行动建议生成', description: '基于诊断结果生成下周操作建议：减仓/早出/多看少动', color: '#10b981' },
  ];

  const steps = [
    { num: '01', title: '导入数据', desc: '支持 ATAS、Jigsaw 等' },
    { num: '02', title: 'AI 诊断', desc: '智能分析交易行为' },
    { num: '03', title: '获取洞察', desc: '生成优化建议' },
    { num: '04', title: '持续改进', desc: '追踪进步轨迹' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onStart={onStart} />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#eab308]/10 border border-[#eab308]/20 rounded-full mb-8">
            <StarOutlined className="text-[#eab308]" />
            <span className="text-sm text-[#eab308] font-medium">全新升级 · AI 智能诊断系统</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-[#ffffff] mb-6 leading-tight">
            您的专属<span className="text-[#eab308]">AI 交易教练</span><br />
            精准诊断 · 科学优化
          </h1>
          
          <p className="text-lg text-[#9ca3af] mb-10 max-w-2xl mx-auto leading-relaxed">
            蒙特卡洛模拟预测未来风险，行为归因识别交易陋习，最优止损回测提升盈利能力。
            让 AI 帮您成为更自律、更稳定的交易者。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2 bg-[#eab308] text-[#0a0a0c] px-8 py-3 rounded font-semibold hover:opacity-90 transition-all"
            >
              免费开始使用
              <ArrowRightOutlined />
            </button>
            <button 
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2 border border-[rgba(255,255,255,0.05)] text-[#ffffff] px-8 py-3 rounded font-medium hover:border-[#eab308] hover:text-[#eab308] transition-all"
            >
              查看演示
            </button>
          </div>
        </div>
        
        <MockInterface />
      </section>
      
      {/* 新功能亮点横幅 */}
      <section className="py-8 bg-gradient-to-r from-[#eab308]/10 via-[#f43f5e]/10 to-[#8b5cf6]/10 border-y border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12">
            <div className="flex items-center gap-2">
              <RobotOutlined className="text-[#eab308]" />
              <span className="text-sm font-medium text-[#ffffff]">智能诊断</span>
            </div>
            <div className="flex items-center gap-2">
              <ExperimentOutlined className="text-[#8b5cf6]" />
              <span className="text-sm font-medium text-[#ffffff]">蒙特卡洛模拟</span>
            </div>
            <div className="flex items-center gap-2">
              <AimOutlined className="text-[#10b981]" />
              <span className="text-sm font-medium text-[#ffffff]">最优止损</span>
            </div>
            <div className="flex items-center gap-2">
              <HeartOutlined className="text-[#f43f5e]" />
              <span className="text-sm font-medium text-[#ffffff]">压力评分</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChartOutlined className="text-[#06b6d4]" />
              <span className="text-sm font-medium text-[#ffffff]">期望值分析</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#ffffff] mb-4">强大的分析能力</h2>
            <p className="text-[#9ca3af] max-w-xl mx-auto">全面的交易数据分析工具，帮助您成为更优秀的交易者</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* AI 教练专属区块 */}
      <section id="ai-coach" className="py-20 px-6 bg-[#0d0d10]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-full mb-6">
                <RobotOutlined className="text-[#8b5cf6]" />
                <span className="text-xs text-[#8b5cf6] font-medium">AI 交易教练</span>
              </div>
              <h2 className="text-3xl font-bold text-[#ffffff] mb-4">智能诊断与决策支持系统</h2>
              <p className="text-[#9ca3af] mb-8 leading-relaxed">
                基于量化交易软件架构设计，专注于交易者行为分析与策略优化。
                通过回溯历史订单的 MAE/MFE 表现，自动识别交易模式并提供科学建议。
              </p>
              
              <div className="space-y-3">
                {aiCoachFeatures.map((f, i) => (
                  <AICoachCard key={i} {...f} />
                ))}
              </div>
              
              <button 
                onClick={onStart}
                className="mt-8 inline-flex items-center gap-2 bg-[#8b5cf6] text-white px-6 py-3 rounded font-semibold hover:opacity-90 transition-all"
              >
                体验 AI 教练
                <ArrowRightOutlined />
              </button>
            </div>
            
            {/* 诊断结果示例 */}
            <div className="bg-[#0a0a0c] rounded-lg border border-[rgba(255,255,255,0.05)] p-6">
              <div className="flex items-center gap-2 mb-6">
                <BulbOutlined className="text-[#eab308]" />
                <span className="text-sm font-semibold text-[#ffffff]">诊断报告示例</span>
              </div>
              
              {/* 综合建议 */}
              <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg p-4 mb-4">
                <div className="text-xs text-[#10b981] mb-1">下周操作建议</div>
                <div className="text-lg font-bold text-[#ffffff]">早出策略 · 减少持仓时间</div>
                <div className="text-xs text-[#9ca3af] mt-1">基于利润留存率分析，您的交易存在 23% 利润回吐</div>
              </div>
              
              {/* 指标列表 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.03)] rounded">
                  <span className="text-sm text-[#9ca3af]">蒙特卡洛盈利概率</span>
                  <span className="text-sm font-bold text-[#10b981]">72.3%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.03)] rounded">
                  <span className="text-sm text-[#9ca3af]">最优止损建议</span>
                  <span className="text-sm font-bold text-[#eab308]">-$180</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.03)] rounded">
                  <span className="text-sm text-[#9ca3af]">平均压力系数</span>
                  <div className="flex gap-0.5">
                    {[1,2,3].map(i => <div key={i} className="w-2.5 h-2.5 bg-[#eab308] rounded-sm"></div>)}
                    {[4,5].map(i => <div key={i} className="w-2.5 h-2.5 bg-[#374151] rounded-sm"></div>)}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-[rgba(255,255,255,0.03)] rounded">
                  <span className="text-sm text-[#9ca3af]">提款机时段</span>
                  <span className="text-sm font-bold text-[#8b5cf6]">09:30 - 10:30</span>
                </div>
              </div>
              
              {/* 行为标签 */}
              <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                <div className="text-xs text-[#9ca3af] mb-2">检测到的行为模式</div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-[#f43f5e]/20 text-[#f43f5e] rounded">🔥 报复性交易 2次</span>
                  <span className="text-xs px-2 py-1 bg-[#eab308]/20 text-[#eab308] rounded">⏳ 处置效应</span>
                  <span className="text-xs px-2 py-1 bg-[#10b981]/20 text-[#10b981] rounded">✓ 执行果断</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Workflow Section */}
      <section id="workflow" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#ffffff] mb-4">简单四步，开始优化</h2>
            <p className="text-[#9ca3af]">从导入数据到获得洞察，一切如此简单</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-lg bg-[#eab308]/10 border border-[#eab308]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-[#eab308]">{step.num}</span>
                </div>
                <h3 className="text-base font-semibold text-[#ffffff] mb-1">{step.title}</h3>
                <p className="text-sm text-[#9ca3af]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 数据支持标识 */}
      <section className="py-12 border-y border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <span className="text-xs text-[#6b7280]">支持主流交易软件数据导入</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {['ATAS', 'Jigsaw', 'NinjaTrader', 'CME', 'NQ • ES • GC • CL'].map((name, i) => (
              <div key={i} className="text-lg font-bold text-[#6b7280] tracking-wider">{name}</div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-6 bg-[#0d0d10]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#ffffff] mb-6">准备好让 AI 教练帮您进步了吗？</h2>
          <p className="text-[#9ca3af] mb-10 text-lg">智能诊断 · 蒙特卡洛预测 · 最优止损 · 行为归因</p>
          <button 
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-[#eab308] text-[#0a0a0c] px-10 py-4 rounded font-semibold text-lg hover:opacity-90 transition-all"
          >
            立即免费开始
            <ArrowRightOutlined />
          </button>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[#9ca3af]">
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#10b981]" /> 免费使用</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#10b981]" /> 无需信用卡</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#10b981]" /> 数据安全</span>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-md object-cover" />
            <span className="font-semibold text-[#ffffff]">MetworthAI</span>
          </div>
          <div className="text-sm text-[#6b7280]">© 2026 MetworthAI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
