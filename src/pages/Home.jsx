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

// 导航栏
const Navbar = ({ onStart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0d0d10]/95 backdrop-blur-xl border-b border-[#1a1a1f]' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 rounded-lg object-cover" />
          <div>
            <span className="text-lg font-bold text-[#ffffff]">Metworth</span>
            <span className="text-lg font-bold text-[#c9a227]">AI</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-[#888] hover:text-[#c9a227] transition-colors">功能</a>
          <a href="#ai-coach" className="text-sm font-medium text-[#888] hover:text-[#c9a227] transition-colors">AI教练</a>
          <a href="#workflow" className="text-sm font-medium text-[#888] hover:text-[#c9a227] transition-colors">流程</a>
          <button onClick={onStart} className="text-sm font-medium text-[#888] hover:text-[#fff] transition-colors">
            登录
          </button>
          <button onClick={onStart} className="text-sm font-semibold bg-[#c9a227] text-[#0a0a0c] px-5 py-2 rounded hover:bg-[#d4af37] transition-all">
            免费开始
          </button>
        </div>

        <button className="md:hidden text-xl text-[#666]" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden bg-[#0d0d10] border-t border-[#1a1a1f] p-6 flex flex-col gap-4">
          <a href="#features" className="text-base font-medium text-[#888] hover:text-[#c9a227]">功能</a>
          <a href="#ai-coach" className="text-base font-medium text-[#888] hover:text-[#c9a227]">AI教练</a>
          <a href="#workflow" className="text-base font-medium text-[#888] hover:text-[#c9a227]">流程</a>
          <button onClick={onStart} className="w-full py-3 border border-[#1a1a1f] text-[#fff] rounded font-medium hover:border-[#c9a227]">登录</button>
          <button onClick={onStart} className="w-full py-3 bg-[#c9a227] text-[#0a0a0c] rounded font-semibold">免费开始</button>
        </div>
      )}
    </nav>
  );
};

// 模拟交易界面
const MockInterface = () => {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-12">
      <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1f]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#333]"></div>
            <div className="w-3 h-3 rounded-full bg-[#333]"></div>
            <div className="w-3 h-3 rounded-full bg-[#333]"></div>
          </div>
          <div className="text-xs text-[#555] font-mono">AI Trading Coach</div>
          <div className="w-16"></div>
        </div>
        
        {/* 内容 */}
        <div className="p-5 grid grid-cols-4 gap-4">
          {/* 左侧主图表 */}
          <div className="col-span-3 bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#888] font-medium">权益曲线</div>
              <div className="text-2xl font-bold text-[#c9a227] font-mono">+$24,580</div>
            </div>
            {/* 模拟曲线 */}
            <div className="h-36 flex items-end justify-between gap-1">
              {[40, 50, 35, 60, 45, 70, 55, 80, 65, 90, 75, 85, 70, 95, 80, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-[#c9a227]/60 to-[#c9a227] rounded-t opacity-80" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>
          
          {/* 右侧统计 */}
          <div className="space-y-3">
            <div className="bg-[#0a0a0c] rounded-lg p-3 border border-[#1a1a1f]">
              <div className="text-xs text-[#555] mb-1">胜率</div>
              <div className="text-xl font-bold text-[#fff] font-mono">68.5%</div>
            </div>
            <div className="bg-[#0a0a0c] rounded-lg p-3 border border-[#1a1a1f]">
              <div className="text-xs text-[#555] mb-1">R倍数</div>
              <div className="text-xl font-bold text-[#c9a227] font-mono">2.35R</div>
            </div>
            <div className="bg-[#0a0a0c] rounded-lg p-3 border border-[#1a1a1f]">
              <div className="text-xs text-[#555] mb-1">压力系数</div>
              <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-3 h-3 bg-[#c9a227] rounded-sm"></div>)}
                {[4,5].map(i => <div key={i} className="w-3 h-3 bg-[#222] rounded-sm"></div>)}
              </div>
            </div>
          </div>
        </div>
        
        {/* AI 诊断条 */}
        <div className="px-5 py-4 bg-[#0a0a0c] border-t border-[#1a1a1f]">
          <div className="flex items-center gap-2 mb-3">
            <RobotOutlined className="text-[#c9a227]" />
            <span className="text-sm font-medium text-[#888]">AI 智能诊断</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">✓ 执行果断</span>
            <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#c9a227] rounded border border-[#252528]">⚡ 提款机: 09:30-10:30</span>
            <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">📊 建议: 早出策略</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 功能卡片
const FeatureCard = ({ icon, title, description, isNew }) => (
  <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-6 hover:border-[#c9a227]/40 transition-all group relative">
    {isNew && (
      <div className="absolute top-4 right-4 text-[10px] px-1.5 py-0.5 bg-[#c9a227]/20 text-[#c9a227] rounded font-medium">NEW</div>
    )}
    <div className="w-11 h-11 rounded-lg bg-[#1a1a1f] flex items-center justify-center mb-4 group-hover:bg-[#c9a227]/10 transition-colors">
      <span className="text-xl text-[#c9a227]">{icon}</span>
    </div>
    <h3 className="text-base font-semibold text-[#fff] mb-2">{title}</h3>
    <p className="text-sm text-[#666] leading-relaxed">{description}</p>
  </div>
);

// AI 教练功能项
const AICoachItem = ({ icon, title, description }) => (
  <div className="flex gap-4 p-4 rounded-lg hover:bg-[#1a1a1f]/50 transition-all">
    <div className="w-9 h-9 rounded-lg bg-[#1a1a1f] flex items-center justify-center flex-shrink-0">
      <span className="text-lg text-[#c9a227]">{icon}</span>
    </div>
    <div>
      <h4 className="text-sm font-semibold text-[#fff] mb-1">{title}</h4>
      <p className="text-xs text-[#666] leading-relaxed">{description}</p>
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
    { icon: <AlertOutlined />, title: '报复性交易检测', description: '自动识别亏损后 5 分钟内的冲动交易' },
    { icon: <FireOutlined />, title: '利润留存率分析', description: '计算 (MFE - PnL) / MFE，识别严重的获利回吐' },
    { icon: <LineChartOutlined />, title: '处置效应诊断', description: '对比盈亏单持仓时长，检测过早止盈过晚止损' },
    { icon: <TrophyOutlined />, title: '行动建议生成', description: '基于诊断结果生成下周操作建议' },
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1f] border border-[#252528] rounded-full mb-8">
            <StarOutlined className="text-[#c9a227]" />
            <span className="text-sm text-[#888] font-medium">全新升级 · AI 智能诊断系统</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-[#fff] mb-6 leading-tight">
            您的专属<span className="text-[#c9a227]"> AI 交易教练</span><br />
            <span className="text-[#888]">精准诊断 · 科学优化</span>
          </h1>
          
          <p className="text-lg text-[#666] mb-10 max-w-2xl mx-auto leading-relaxed">
            蒙特卡洛模拟预测未来风险，行为归因识别交易陋习，最优止损回测提升盈利能力。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-8 py-3 rounded-lg font-semibold hover:bg-[#d4af37] transition-all"
            >
              免费开始使用
              <ArrowRightOutlined />
            </button>
            <button 
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2 border border-[#1a1a1f] text-[#888] px-8 py-3 rounded-lg font-medium hover:border-[#c9a227] hover:text-[#c9a227] transition-all"
            >
              查看演示
            </button>
          </div>
        </div>
        
        <MockInterface />
      </section>
      
      {/* 新功能亮点横幅 */}
      <section className="py-6 border-y border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {['智能诊断', '蒙特卡洛模拟', '最优止损', '压力评分', '期望值分析'].map((name, i) => (
              <div key={i} className="text-sm font-medium text-[#555]">{name}</div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#fff] mb-4">强大的分析能力</h2>
            <p className="text-[#666] max-w-xl mx-auto">全面的交易数据分析工具，帮助您成为更优秀的交易者</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
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
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] border border-[#252528] rounded-full mb-6">
                <RobotOutlined className="text-[#c9a227]" />
                <span className="text-xs text-[#888] font-medium">AI 交易教练</span>
              </div>
              <h2 className="text-3xl font-bold text-[#fff] mb-4">智能诊断与决策支持</h2>
              <p className="text-[#666] mb-8 leading-relaxed">
                基于量化交易架构设计，专注于交易者行为分析与策略优化。
                通过回溯历史订单表现，自动识别交易模式并提供科学建议。
              </p>
              
              <div className="space-y-1">
                {aiCoachFeatures.map((f, i) => (
                  <AICoachItem key={i} {...f} />
                ))}
              </div>
              
              <button 
                onClick={onStart}
                className="mt-8 inline-flex items-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-6 py-3 rounded-lg font-semibold hover:bg-[#d4af37] transition-all"
              >
                体验 AI 教练
                <ArrowRightOutlined />
              </button>
            </div>
            
            {/* 诊断结果示例 */}
            <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-6">
              <div className="flex items-center gap-2 mb-6">
                <BulbOutlined className="text-[#c9a227]" />
                <span className="text-sm font-medium text-[#888]">诊断报告示例</span>
              </div>
              
              {/* 综合建议 */}
              <div className="bg-[#0a0a0c] border border-[#1a1a1f] rounded-lg p-4 mb-4">
                <div className="text-xs text-[#c9a227] mb-1">下周操作建议</div>
                <div className="text-lg font-bold text-[#fff]">早出策略 · 减少持仓时间</div>
                <div className="text-xs text-[#555] mt-1">基于利润留存率分析，您的交易存在 23% 利润回吐</div>
              </div>
              
              {/* 指标列表 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">蒙特卡洛盈利概率</span>
                  <span className="text-sm font-bold text-[#c9a227]">72.3%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">最优止损建议</span>
                  <span className="text-sm font-bold text-[#fff]">-$180</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">平均压力系数</span>
                  <div className="flex gap-1">
                    {[1,2,3].map(i => <div key={i} className="w-2.5 h-2.5 bg-[#c9a227] rounded-sm"></div>)}
                    {[4,5].map(i => <div key={i} className="w-2.5 h-2.5 bg-[#222] rounded-sm"></div>)}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">提款机时段</span>
                  <span className="text-sm font-bold text-[#c9a227]">09:30 - 10:30</span>
                </div>
              </div>
              
              {/* 行为标签 */}
              <div className="mt-4 pt-4 border-t border-[#1a1a1f]">
                <div className="text-xs text-[#555] mb-2">检测到的行为模式</div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">报复性交易 2次</span>
                  <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">处置效应</span>
                  <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#c9a227] rounded border border-[#252528]">执行果断</span>
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
            <h2 className="text-3xl font-bold text-[#fff] mb-4">简单四步，开始优化</h2>
            <p className="text-[#666]">从导入数据到获得洞察，一切如此简单</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-[#1a1a1f] border border-[#252528] flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-[#c9a227]">{step.num}</span>
                </div>
                <h3 className="text-base font-semibold text-[#fff] mb-1">{step.title}</h3>
                <p className="text-sm text-[#666]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 数据支持标识 */}
      <section className="py-10 border-y border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-4">
            <span className="text-xs text-[#444]">支持主流交易软件数据导入</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {['ATAS', 'Jigsaw', 'NinjaTrader', 'CME', 'NQ · ES · GC'].map((name, i) => (
              <div key={i} className="text-base font-bold text-[#333] tracking-wider">{name}</div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-6 bg-[#0d0d10]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#fff] mb-6">准备好让 AI 教练帮您进步了吗？</h2>
          <p className="text-[#666] mb-10 text-lg">智能诊断 · 蒙特卡洛预测 · 最优止损 · 行为归因</p>
          <button 
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-10 py-4 rounded-lg font-semibold text-lg hover:bg-[#d4af37] transition-all"
          >
            立即免费开始
            <ArrowRightOutlined />
          </button>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[#555]">
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 免费使用</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 无需信用卡</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 数据安全</span>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-md object-cover" />
            <span className="font-semibold text-[#fff]">MetworthAI</span>
          </div>
          <div className="text-sm text-[#444]">© 2026 MetworthAI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
