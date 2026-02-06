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
  BookOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

// 导航栏
const Navbar = ({ onStart, onDocs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#050505]/80 backdrop-blur-2xl border-b border-[#1a1a1f] py-3' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="TradeWhy.AI" className="h-6 md:h-7 object-contain" />
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          <a href="#features" className="text-[11px] font-bold text-[#555] hover:text-[#c9a227] transition-colors uppercase tracking-[0.2em]">功能特点</a>
          <a href="#ai-coach" className="text-[11px] font-bold text-[#555] hover:text-[#c9a227] transition-colors uppercase tracking-[0.2em]">AI 智能</a>
          <button onClick={onDocs} className="text-[11px] font-bold text-[#555] hover:text-[#c9a227] transition-colors uppercase tracking-[0.2em]">
            说明文档
          </button>
          <div className="w-px h-4 bg-[#1a1a1f]"></div>
          <button onClick={onStart} className="text-[11px] font-bold text-[#fff] hover:text-[#c9a227] transition-colors uppercase tracking-[0.2em]">
            登录
          </button>
          <button onClick={onStart} className="text-[11px] font-bold bg-[#c9a227] text-[#0a0a0c] px-6 py-2.5 rounded hover:bg-[#d4af37] transition-all uppercase tracking-[0.1em]">
            立即开始
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
          <button onClick={onDocs} className="text-left text-base font-medium text-[#888] hover:text-[#c9a227]">文档</button>
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
    <div className="relative w-full max-w-5xl mx-auto mt-10 md:mt-16 animate-fadeInUp px-2 sm:px-0">
      {/* 背景装饰光效 */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-[#c9a227]/10 rounded-full blur-[100px] hidden md:block"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#c9a227]/5 rounded-full blur-[100px] hidden md:block"></div>
      
      <div className="bg-[#0a0a0c] rounded-xl border border-[#1a1a1f] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] scanline-effect md:animate-float">
        <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 border-b border-[#1a1a1f] bg-[#0d0d10]">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-[#ff5f56]"></div>
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-[#27c93f]"></div>
          </div>
          <div className="text-[8px] md:text-[10px] text-[#555] font-mono tracking-[0.1em] md:tracking-[0.2em] uppercase">TradeWhy 终端 v2.0 // 机构级</div>
          <div className="flex gap-1">
            <div className="w-3 md:w-4 h-1 bg-[#222]"></div>
            <div className="w-3 md:w-4 h-1 bg-[#222]"></div>
          </div>
        </div>
        
        <div className="p-3 md:p-6 flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-6">
          {/* 左侧主图表 */}
          <div className="md:col-span-8 space-y-4 md:space-y-6">
            <div className="bg-[#0d0d10] rounded-lg p-4 md:p-5 border border-[#1a1a1f]">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div>
                  <div className="text-[9px] md:text-[10px] text-[#555] font-semibold uppercase tracking-wider mb-1">权益曲线 // 净累计</div>
                  <div className="text-xl md:text-3xl font-bold text-[#fff] font-mono tracking-tighter">
                    <span className="text-[#0ecb81]">$</span>24,580.42
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] md:text-[10px] text-[#555] font-semibold uppercase tracking-wider mb-1">最大回撤</div>
                  <div className="text-xs md:text-sm font-bold text-[#f6465d] font-mono">-2.4%</div>
                </div>
              </div>
              <div className="h-28 md:h-48 flex items-end justify-between gap-1 md:gap-1.5 relative">
                {/* 模拟网格线 */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                  {[1,2,3,4].map(i => <div key={i} className="w-full h-px bg-white"></div>)}
                </div>
                {[30, 45, 35, 55, 40, 65, 50, 80, 60, 95, 75, 85, 70, 100, 85, 110, 95, 120].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-[#c9a227]/5 to-[#c9a227]/40 border-t border-[#c9a227]/60 rounded-t-sm transition-all hover:opacity-100 opacity-70" style={{ height: `${h/1.2}%` }}></div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {[
                { label: '获利因子', value: '2.35', color: '#c9a227' },
                { label: '胜率', value: '68.5%', color: '#fff' },
                { label: '平均 R 倍数', value: '1.82R', color: '#c9a227' },
              ].map((stat, i) => (
                <div key={i} className="bg-[#0d0d10] rounded-lg p-2.5 md:p-4 border border-[#1a1a1f]">
                  <div className="text-[8px] md:text-[9px] text-[#555] font-semibold uppercase tracking-wider mb-0.5 md:mb-1">{stat.label}</div>
                  <div className="text-base md:text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* 右侧 AI 洞察 */}
          <div className="md:col-span-4 space-y-4">
            <div className="bg-[#0d0d10] rounded-lg p-4 md:p-5 border border-[#1a1a1f] h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4 md:mb-6">
                <div className="w-2 h-2 rounded-full bg-[#c9a227] animate-pulse"></div>
                <span className="text-[9px] md:text-[10px] font-bold text-[#fff] uppercase tracking-[0.15em] md:tracking-[0.2em]">AI 实时洞察</span>
              </div>
              
              <div className="space-y-3 md:space-y-4 flex-1">
                <div className="p-2.5 md:p-3 bg-[#1a1a1f]/50 border-l-2 border-[#c9a227] rounded-r">
                  <div className="text-[9px] md:text-[10px] text-[#c9a227] font-bold mb-0.5 md:mb-1">行为警报</div>
                  <div className="text-[10px] md:text-xs text-[#eee] leading-relaxed">检测到 NQ 的报复性交易。亏损后 5 分钟内执行了 3 笔交易。</div>
                </div>
                
                <div className="p-2.5 md:p-3 bg-[#1a1a1f]/50 border-l-2 border-[#0ecb81] rounded-r">
                  <div className="text-[9px] md:text-[10px] text-[#0ecb81] font-bold mb-0.5 md:mb-1">优势优化</div>
                  <div className="text-[10px] md:text-xs text-[#eee] leading-relaxed">您的优势在 ES 的 10:00-11:00 EST 期间最强。胜率：74%。</div>
                </div>

                <div className="p-2.5 md:p-3 bg-[#1a1a1f]/50 border-l-2 border-[#888] rounded-r hidden md:block">
                  <div className="text-[10px] text-[#888] font-bold mb-1">风险建议</div>
                  <div className="text-xs text-[#eee] leading-relaxed">当前回撤高于均值 1.2 个标准差。建议减小仓位。</div>
                </div>
              </div>

              <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-[#1a1a1f]">
                <div className="flex justify-between items-center text-[8px] md:text-[9px] text-[#555] font-mono">
                  <span>系统状态：最佳</span>
                  <span>延迟：12MS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 功能卡片
const FeatureCard = ({ icon, title, description, isNew }) => (
  <div className="bg-[#0d0d10] border border-[#1a1a1f] rounded-xl md:rounded-2xl p-5 md:p-8 hover:border-[#c9a227]/40 transition-all group relative overflow-hidden">
    {isNew && (
      <div className="absolute top-0 right-0 px-2 md:px-3 py-0.5 md:py-1 bg-[#c9a227] text-[#0a0a0c] text-[8px] md:text-[9px] font-bold uppercase tracking-widest rounded-bl-lg">NEW</div>
    )}
    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-[#1a1a1f] flex items-center justify-center mb-5 md:mb-8 group-hover:bg-[#c9a227]/10 transition-colors">
      <span className="text-xl md:text-2xl text-[#c9a227]">{icon}</span>
    </div>
    <h3 className="text-base md:text-lg font-bold text-[#fff] mb-2 md:mb-4 tracking-tight">{title}</h3>
    <p className="text-xs md:text-sm text-[#666] leading-relaxed font-light group-hover:text-[#888] transition-colors">{description}</p>
  </div>
);

// AI 教练功能项
const AICoachItem = ({ icon, title, description }) => (
  <div className="flex gap-3 md:gap-5 p-3 md:p-5 rounded-lg md:rounded-xl hover:bg-[#1a1a1f]/50 transition-all border border-transparent hover:border-[#1a1a1f]">
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-[#1a1a1f] flex items-center justify-center flex-shrink-0 border border-[#252528]">
      <span className="text-lg md:text-xl text-[#c9a227]">{icon}</span>
    </div>
    <div>
      <h4 className="text-xs md:text-sm font-bold text-[#fff] mb-1 md:mb-1.5 tracking-tight">{title}</h4>
      <p className="text-[11px] md:text-xs text-[#555] leading-relaxed font-light">{description}</p>
    </div>
  </div>
);

// 移动端专属首页
const MobileHome = ({ onStart, onDocs }) => {
  const features = [
    { icon: <RobotOutlined />, title: 'AI 行为诊断', desc: '识别报复性交易与情绪失控' },
    { icon: <LineChartOutlined />, title: '深度复盘', desc: 'MAE/MFE 效率分析与归因' },
    { icon: <ThunderboltOutlined />, title: '策略进化', desc: '基于数学期望优化交易系统' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-20%] w-[80%] h-[40%] bg-[#c9a227]/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[-10%] left-[-20%] w-[80%] h-[40%] bg-[#c9a227]/5 rounded-full blur-[80px]"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      </div>

      {/* 顶部导航 */}
      <nav className="relative z-20 px-6 py-6 flex justify-between items-center">
        <img src="/logo.svg" alt="TradeWhy.AI" className="h-6 object-contain" />
        <button onClick={onStart} className="text-xs font-bold text-[#c9a227] border border-[#c9a227] px-3 py-1.5 rounded hover:bg-[#c9a227] hover:text-[#0a0a0c] transition-all">
          登录
        </button>
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 relative z-10 px-6 flex flex-col justify-center pb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] border border-[#252528] rounded-full w-fit mb-6 animate-fadeIn">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-pulse"></div>
          <span className="text-[10px] text-[#c9a227] font-bold uppercase tracking-widest">移动端预览模式</span>
        </div>

        <h1 className="text-3xl font-bold text-[#fff] mb-4 leading-tight animate-fadeInUp">
          专业交易复盘<br />
          <span className="text-[#c9a227]">从桌面端开始</span>
        </h1>

        <p className="text-sm text-[#888] mb-8 leading-relaxed font-light animate-fadeInUp [animation-delay:100ms]">
          TradeWhy.AI 提供机构级的数据分析与 AI 诊断。为了呈现复杂的图表与深度数据，请使用 <span className="text-[#fff] font-medium">PC 端浏览器</span> 访问以获得完整体验。
        </p>

        {/* 提示卡片 */}
        <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-5 mb-8 animate-fadeInUp [animation-delay:200ms]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1f] flex items-center justify-center flex-shrink-0">
              <SafetyCertificateOutlined className="text-[#c9a227]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#fff] mb-1">为什么需要桌面端？</h3>
              <p className="text-xs text-[#666] leading-relaxed">
                我们的量化引擎需要宽屏展示复杂的 K 线、资金曲线与多维归因分析图表，手机屏幕无法承载如此高密度的数据可视化。
              </p>
            </div>
          </div>
        </div>

        {/* 核心功能预览 */}
        <div className="space-y-4 animate-fadeInUp [animation-delay:300ms]">
          <div className="text-xs text-[#555] font-bold uppercase tracking-widest mb-2">桌面端核心功能</div>
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#0d0d10] border border-[#1a1a1f]">
              <span className="text-[#c9a227] text-lg">{f.icon}</span>
              <div>
                <div className="text-sm font-medium text-[#fff]">{f.title}</div>
                <div className="text-xs text-[#666]">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 底部操作 */}
      <div className="relative z-10 px-6 py-6 bg-[#0d0d10] border-t border-[#1a1a1f]">
        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('链接已复制，请发送至电脑浏览器打开');
          }}
          className="w-full flex items-center justify-center gap-2 bg-[#fff] text-[#0a0a0c] py-3.5 rounded-lg font-bold text-sm hover:bg-[#eee] transition-all mb-3"
        >
          复制链接
        </button>
        <button 
          onClick={onDocs}
          className="w-full flex items-center justify-center gap-2 text-[#666] py-3 rounded-lg font-medium text-sm hover:text-[#fff] transition-all"
        >
          <BookOutlined /> 查看功能文档
        </button>
      </div>
    </div>
  );
};

// 主页组件
const Home = ({ onStart, onDocs }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return <MobileHome onStart={onStart} onDocs={onDocs} />;
  }

  const features = [
    { icon: <RobotOutlined />, title: 'AI 行为诊断', description: '自动识别情绪交易周期，诊断报复性交易与执行焦虑', isNew: true },
    { icon: <ExperimentOutlined />, title: '浮亏/浮盈效率分析', description: '专业级 MAE/MFE 评估，分析止损是否过宽或止盈是否过于保守', isNew: true },
    { icon: <AimOutlined />, title: '最优止损回测', description: '回测不同止损位对总盈亏的影响，智能推荐符合数学期望的最佳止损', isNew: true },
    { icon: <BarChartOutlined />, title: '期望值分布', description: '按时段、方向、品种分析期望值，找出您的"提款机"与"碎钞机"', isNew: true },
    { icon: <HeartOutlined />, title: '心理压力评分', description: '基于最大浮亏深度和持仓时长，量化您的心理承压能力与执行质量', isNew: true },
    { icon: <DashboardOutlined />, title: 'R倍数质量追踪', description: '计算风险回报倍数，剔除运气成分，评估每一笔交易的真实质量', isNew: true },
  ];

  const aiCoachFeatures = [
    { icon: <AlertOutlined />, title: '报复性交易检测', description: '自动识别亏损后 5 分钟内的冲动交易' },
    { icon: <FireOutlined />, title: '利润留存率分析', description: '计算动态回撤比例，识别严重的获利回吐问题' },
    { icon: <LineChartOutlined />, title: '处置效应诊断', description: '对比盈亏单持仓时长，检测过早止盈过晚止损' },
    { icon: <TrophyOutlined />, title: '行动建议生成', description: '基于诊断结果生成下周操作建议' },
  ];

  const steps = [
    { num: '01', title: '数据同步', desc: '支持 ATAS, Jigsaw, NT 等' },
    { num: '02', title: '行为归因', desc: 'AI 自动解析交易心理' },
    { num: '03', title: '深度洞察', desc: '生成专业级复盘报告' },
    { num: '04', title: '系统进化', desc: '建立确定性交易系统' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onStart={onStart} onDocs={onDocs} />
      
      {/* Hero Section */}
      <section className="pt-24 md:pt-40 pb-16 md:pb-24 px-4 md:px-6 relative overflow-hidden">
        {/* 背景网格 */}
        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-[#1a1a1f] border border-[#252528] rounded-full mb-6 md:mb-10 animate-fadeIn">
            <div className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-pulse"></div>
            <span className="text-[9px] md:text-[10px] text-[#c9a227] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em]">机构级引擎 v2.0</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-7xl font-bold text-[#fff] mb-5 md:mb-8 leading-[1.15] md:leading-[1.1] tracking-tight md:tracking-tighter animate-fadeInUp">
            像顶级对冲基金一样<br />
            <span className="text-[#c9a227]">复盘与进化</span>
          </h1>
          
          <p className="text-base md:text-2xl text-[#888] mb-8 md:mb-14 max-w-3xl mx-auto leading-relaxed font-light animate-fadeInUp [animation-delay:200ms] px-2">
            TradeWhy.AI 深度解析您的每一笔交易，挖掘您潜意识中的交易偏好与致命弱点。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 md:gap-6 justify-center animate-fadeInUp [animation-delay:400ms] px-4 sm:px-0">
            <button 
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2 md:gap-3 bg-[#c9a227] text-[#0a0a0c] px-6 md:px-10 py-3.5 md:py-4 rounded-lg font-bold text-base md:text-lg hover:bg-[#d4af37] shadow-[0_0_40px_rgba(201,162,39,0.2)] transition-all"
            >
              立即开启职业之路
              <ArrowRightOutlined />
            </button>
            <button 
              onClick={onDocs}
              className="inline-flex items-center justify-center gap-2 md:gap-3 border border-[#1a1a1f] text-[#888] px-6 md:px-10 py-3.5 md:py-4 rounded-lg font-semibold text-base md:text-lg hover:border-[#c9a227] hover:text-[#c9a227] transition-all bg-[#0d0d10]/50 backdrop-blur-sm"
            >
              <BookOutlined />
              查看说明文档
            </button>
          </div>
        </div>
        
        <MockInterface />
      </section>
      
      {/* 新功能亮点横幅 */}
      <section className="py-4 md:py-6 border-y border-[#1a1a1f] overflow-x-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-nowrap md:flex-wrap justify-start md:justify-center items-center gap-4 md:gap-12 min-w-max md:min-w-0">
            {['智能诊断', '蒙特卡洛模拟', '最优止损', '压力评分', '期望值分析'].map((name, i) => (
              <div key={i} className="text-xs md:text-sm font-medium text-[#555] whitespace-nowrap">{name}</div>
            ))}
          </div>
        </div>
      </section>
      
      {/* 痛点共鸣 Section */}
      <section className="py-16 md:py-32 px-4 md:px-6 bg-[#050505] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[#1a1a1f] to-transparent"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-10 md:mb-20">
            <h2 className="text-2xl md:text-4xl font-bold text-[#fff] mb-4 md:mb-6 tracking-tight md:tracking-tighter leading-tight px-2">为什么 90% 的交易者最终走向亏损？</h2>
            <p className="text-[#888] max-w-2xl mx-auto text-base md:text-xl font-light px-4">"您不是技术不行，是您不了解自己的交易行为。"</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-10">
            {[
              { title: '报复性交易', desc: '在亏损后疯狂加仓，试图一次性回本？AI 实时监控您的情绪波动，在失控前发出预警。', icon: <AlertOutlined /> },
              { title: '过早止盈', desc: '拿不住盈利单，却死扛亏损单直到爆仓？通过最大浮盈分析，量化您的利润留存率。', icon: <FireOutlined /> },
              { title: '品种黑洞', desc: '在某个特定品种上持续失血而不自知？AI 自动识别您的"碎钞机"品种，优化资产配置。', icon: <ExperimentOutlined /> },
            ].map((item, i) => (
              <div key={i} className="p-6 md:p-10 rounded-xl md:rounded-2xl bg-[#0a0a0c] border border-[#1a1a1f] hover:border-[#c9a227]/30 transition-all group">
                <div className="text-[#c9a227] text-2xl md:text-3xl mb-4 md:mb-6 group-hover:scale-110 transition-transform">{item.icon}</div>
                <h3 className="text-lg md:text-xl font-bold text-[#fff] mb-3 md:mb-4 tracking-tight">{item.title}</h3>
                <p className="text-sm md:text-base text-[#666] leading-relaxed font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 量化架构 Section */}
      <section className="py-16 md:py-32 px-4 md:px-6 bg-[#0a0a0c]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-20 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-10 bg-[#c9a227]/5 blur-[80px] rounded-full hidden md:block"></div>
              <div className="relative bg-[#0d0d10] border border-[#1a1a1f] rounded-xl md:rounded-2xl p-5 md:p-8 shadow-2xl">
                <div className="text-[9px] md:text-[10px] text-[#c9a227] font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] mb-5 md:mb-8">数学优势 // 框架</div>
                <div className="space-y-4 md:space-y-6">
                  {[
                    { label: 'MAE (最大浮亏)', desc: '量化单笔交易的最大不利偏移，评估入场精准度。' },
                    { label: 'MFE (最大浮盈)', desc: '量化单笔交易的最大有利偏移，评估止盈效率。' },
                    { label: 'R-Multiple 分布', desc: '分析风险回报比的数学分布，剔除运气成分。' },
                    { label: '蒙特卡洛模拟', desc: '1000次随机序列模拟，预测账户破产概率。' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3 md:gap-4">
                      <div className="text-[#c9a227] font-mono text-xs md:text-sm">0{i+1}</div>
                      <div>
                        <div className="text-xs md:text-sm font-bold text-[#fff] mb-0.5 md:mb-1">{item.label}</div>
                        <div className="text-[11px] md:text-xs text-[#666] leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <h2 className="text-2xl md:text-4xl font-bold text-[#fff] mb-5 md:mb-8 tracking-tight md:tracking-tighter leading-tight">
                基于数学期望的<br />
                <span className="text-[#c9a227]">确定性交易系统</span>
              </h2>
              <p className="text-[#888] text-sm md:text-lg mb-6 md:mb-10 font-light leading-relaxed">
                职业交易者不赌运气，他们只交易"概率"。TradeWhy.AI 将复杂的量化分析工具简化为直观的洞察，帮助您从直觉交易进化为系统交易。
              </p>
              <div className="grid grid-cols-2 gap-3 md:gap-6">
                <div className="p-4 md:p-6 bg-[#0d0d10] border border-[#1a1a1f] rounded-lg md:rounded-xl">
                  <div className="text-xl md:text-2xl font-bold text-[#fff] mb-0.5 md:mb-1 font-mono">99.9%</div>
                  <div className="text-[9px] md:text-[10px] text-[#555] uppercase tracking-wider">数据准确度</div>
                </div>
                <div className="p-4 md:p-6 bg-[#0d0d10] border border-[#1a1a1f] rounded-lg md:rounded-xl">
                  <div className="text-xl md:text-2xl font-bold text-[#c9a227] mb-0.5 md:mb-1 font-mono">&lt; 1s</div>
                  <div className="text-[9px] md:text-[10px] text-[#555] uppercase tracking-wider">分析速度</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-[#fff] mb-3 md:mb-4 tracking-tight">核心分析维度</h2>
            <p className="text-sm md:text-base text-[#888] max-w-xl mx-auto font-light px-4">基于顶级量化框架，深度剖析您的每一笔订单</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* AI 教练专属区块 */}
      <section id="ai-coach" className="py-12 md:py-20 px-4 md:px-6 bg-[#0d0d10]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 md:px-3 py-1 md:py-1.5 bg-[#1a1a1f] border border-[#252528] rounded-full mb-4 md:mb-6">
                <RobotOutlined className="text-[#c9a227] text-sm md:text-base" />
                <span className="text-[10px] md:text-xs text-[#c9a227] font-medium uppercase tracking-widest">AI 行为教练</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#fff] mb-4 md:mb-6 tracking-tight">智能诊断与决策支持</h2>
              <p className="text-sm md:text-base text-[#888] mb-6 md:mb-8 leading-relaxed font-light">
                基于顶级对冲基金量化架构设计，专注于交易者行为分析与策略进化。
                通过回溯历史订单表现，自动识别您潜意识中的交易模式并提供科学建议。
              </p>
              
              <div className="space-y-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-0">
                {aiCoachFeatures.map((f, i) => (
                  <AICoachItem key={i} {...f} />
                ))}
              </div>
              
              <button 
                onClick={onStart}
                className="mt-6 md:mt-8 inline-flex items-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-5 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-[#d4af37] transition-all"
              >
                体验 AI 教练
                <ArrowRightOutlined />
              </button>
            </div>
            
            {/* 诊断结果示例 */}
            <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4 md:mb-6">
                <BulbOutlined className="text-[#c9a227]" />
                <span className="text-xs md:text-sm font-medium text-[#888]">诊断报告示例</span>
              </div>
              
              <div className="bg-[#0a0a0c] border border-[#1a1a1f] rounded-lg p-3 md:p-4 mb-3 md:mb-4">
                <div className="text-[10px] md:text-xs text-[#c9a227] mb-0.5 md:mb-1">下周操作建议</div>
                <div className="text-base md:text-lg font-bold text-[#fff]">早出策略 · 减少持仓时间</div>
                <div className="text-[10px] md:text-xs text-[#555] mt-1">基于利润留存率分析，您的交易存在 23% 利润回吐</div>
              </div>
              
              <div className="space-y-2 grid grid-cols-2 md:grid-cols-1 gap-2">
                <div className="flex justify-between items-center p-2.5 md:p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-[10px] md:text-sm text-[#666]">蒙特卡洛盈利概率</span>
                  <span className="text-xs md:text-sm font-bold text-[#c9a227]">72.3%</span>
                </div>
                <div className="flex justify-between items-center p-2.5 md:p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-[10px] md:text-sm text-[#666]">最优止损建议</span>
                  <span className="text-xs md:text-sm font-bold text-[#fff]">-$180</span>
                </div>
                <div className="flex justify-between items-center p-2.5 md:p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f] col-span-2 md:col-span-1">
                  <span className="text-[10px] md:text-sm text-[#666]">平均压力系数</span>
                  <div className="flex gap-1">
                    {[1,2,3].map(i => <div key={i} className="w-2 h-2 md:w-2.5 md:h-2.5 bg-[#c9a227] rounded-sm"></div>)}
                    {[4,5].map(i => <div key={i} className="w-2 h-2 md:w-2.5 md:h-2.5 bg-[#222] rounded-sm"></div>)}
                  </div>
                </div>
                <div className="flex justify-between items-center p-2.5 md:p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f] col-span-2 md:col-span-1">
                  <span className="text-[10px] md:text-sm text-[#666]">提款机时段</span>
                  <span className="text-xs md:text-sm font-bold text-[#c9a227]">09:30 - 10:30</span>
                </div>
              </div>
              
              <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-[#1a1a1f]">
                <div className="text-[10px] md:text-xs text-[#555] mb-2">检测到的行为模式</div>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">报复性交易 2次</span>
                  <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">处置效应</span>
                  <span className="text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 bg-[#1a1a1f] text-[#c9a227] rounded border border-[#252528]">执行果断</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Workflow Section */}
      <section id="workflow" className="py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-[#fff] mb-3 md:mb-4 tracking-tight">建立确定性系统</h2>
            <p className="text-sm md:text-base text-[#888] font-light">从混沌到秩序，仅需四个步骤</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg md:rounded-xl bg-[#1a1a1f] border border-[#252528] flex items-center justify-center mx-auto mb-3 md:mb-4">
                  <span className="text-lg md:text-xl font-bold text-[#c9a227]">{step.num}</span>
                </div>
                <h3 className="text-sm md:text-base font-semibold text-[#fff] mb-0.5 md:mb-1">{step.title}</h3>
                <p className="text-xs md:text-sm text-[#666]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 文档和帮助入口 */}
      <section className="py-10 md:py-16 px-4 md:px-6 bg-[#0d0d10]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
            <button
              onClick={onDocs}
              className="text-left p-4 md:p-6 bg-[#111114] rounded-lg md:rounded-xl border border-[#1a1a1f] hover:border-[#c9a227]/40 transition-all group"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-[#1a1a1f] flex items-center justify-center mb-3 md:mb-4 group-hover:bg-[#c9a227]/10 transition-colors">
                <BookOutlined className="text-xl md:text-2xl text-[#c9a227]" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-[#fff] mb-1 md:mb-2">使用文档</h3>
              <p className="text-xs md:text-sm text-[#666]">详细的功能说明和操作指南，帮助您快速上手</p>
            </button>
            
            <button
              onClick={onDocs}
              className="text-left p-4 md:p-6 bg-[#111114] rounded-lg md:rounded-xl border border-[#1a1a1f] hover:border-[#c9a227]/40 transition-all group"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-[#1a1a1f] flex items-center justify-center mb-3 md:mb-4 group-hover:bg-[#c9a227]/10 transition-colors">
                <QuestionCircleOutlined className="text-xl md:text-2xl text-[#c9a227]" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-[#fff] mb-1 md:mb-2">常见问题</h3>
              <p className="text-xs md:text-sm text-[#666]">关于产品功能、数据导入、AI 分析等常见问题解答</p>
            </button>
          </div>
        </div>
      </section>

      {/* 数据支持标识 */}
      <section className="py-6 md:py-10 border-y border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-3 md:mb-4">
            <span className="text-[10px] md:text-xs text-[#444] uppercase tracking-[0.15em] md:tracking-[0.2em]">机构级连接性</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-16 grayscale opacity-30 hover:opacity-60 transition-opacity duration-500">
            {['ATAS', 'Jigsaw', 'NinjaTrader', 'CME', 'NQ · ES · GC'].map((name, i) => (
              <div key={i} className="text-xs md:text-base font-bold text-[#fff] tracking-wider">{name}</div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-[#0d0d10]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-3xl font-bold text-[#fff] mb-4 md:mb-6 leading-tight">在交易场上，唯一的对手是您自己。</h2>
          <p className="text-sm md:text-lg text-[#888] mb-6 md:mb-10 font-light px-4">TradeWhy 是那面让您看清自己的镜子。准备好进化了吗？</p>
          <button 
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-6 md:px-10 py-3 md:py-4 rounded-lg font-semibold text-base md:text-lg hover:bg-[#d4af37] shadow-[0_0_30px_rgba(201,162,39,0.2)] transition-all"
          >
            开启您的职业交易之路
            <ArrowRightOutlined />
          </button>
          <div className="mt-5 md:mt-6 flex flex-wrap items-center justify-center gap-3 md:gap-6 text-xs md:text-sm text-[#555]">
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 免费使用</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 无需信用卡</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 数据安全</span>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-6 md:py-8 px-4 md:px-6 border-t border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="TradeWhy.AI" className="h-5 md:h-6 object-contain" />
          </div>
          <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-[#555]">
            <button onClick={onDocs} className="hover:text-[#c9a227] transition-colors">文档</button>
            <a href="#features" className="hover:text-[#c9a227] transition-colors">功能</a>
            <a href="#ai-coach" className="hover:text-[#c9a227] transition-colors">AI教练</a>
          </div>
          <div className="text-xs md:text-sm text-[#444]">© 2026 TradeWhy.AI. 保留所有权利。</div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
