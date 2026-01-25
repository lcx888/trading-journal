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
          <a href="#workflow" className="text-base font-medium text-[#9ca3af] hover:text-[#eab308]">流程</a>
          <button onClick={onStart} className="w-full py-3 border border-[rgba(255,255,255,0.05)] text-[#ffffff] rounded font-medium hover:border-[#eab308]">登录</button>
          <button onClick={onStart} className="w-full py-3 bg-[#eab308] text-[#0a0a0c] rounded font-semibold">免费开始</button>
        </div>
      )}
    </nav>
  );
};

// 模拟交易界面
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
          <div className="text-xs text-[#6b7280] font-mono">Trading Dashboard</div>
          <div className="w-16"></div>
        </div>
        
        {/* 内容 */}
        <div className="p-4 grid grid-cols-4 gap-4">
          {/* 左侧主图表 */}
          <div className="col-span-3 bg-[rgba(255,255,255,0.05)] rounded p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#ffffff] font-semibold">权益曲线</div>
              <div className="text-2xl font-bold text-[#10b981] font-mono">+$24,580</div>
            </div>
            {/* 模拟曲线 */}
            <div className="h-40 flex items-end justify-between gap-1">
              {[40, 50, 35, 60, 45, 70, 55, 80, 65, 90, 75, 85, 70, 95, 80, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-[#10b981] rounded-t" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>
          
          {/* 右侧统计 */}
          <div className="space-y-4">
            <div className="bg-[rgba(255,255,255,0.05)] rounded p-3">
              <div className="text-xs text-[#9ca3af] mb-1">胜率</div>
              <div className="text-xl font-bold text-[#ffffff] font-mono">68.5%</div>
            </div>
            <div className="bg-[rgba(255,255,255,0.05)] rounded p-3">
              <div className="text-xs text-[#9ca3af] mb-1">利润因子</div>
              <div className="text-xl font-bold text-[#eab308] font-mono">2.35</div>
            </div>
            <div className="bg-[rgba(255,255,255,0.05)] rounded p-3">
              <div className="text-xs text-[#9ca3af] mb-1">今日盈亏</div>
              <div className="text-xl font-bold text-[#10b981] font-mono">+$1,250</div>
            </div>
          </div>
        </div>
        
        {/* AI 洞察条 */}
        <div className="px-4 py-3 bg-[#eab308]/10 border-t border-[#eab308]/20 flex items-center gap-3">
          <BulbOutlined className="text-[#eab308]" />
          <span className="text-sm text-[#ffffff]">AI 洞察: 今日交易胜率高于平均水平，建议继续执行当前策略</span>
        </div>
      </div>
    </div>
  );
};

// 功能卡片
const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-[#0d0d10] border border-[rgba(255,255,255,0.05)] rounded-lg p-6 hover:border-[#eab308]/30 transition-all group">
    <div className="w-12 h-12 rounded bg-[#eab308]/10 flex items-center justify-center mb-4 group-hover:bg-[#eab308]/20 transition-colors">
      <span className="text-2xl text-[#eab308]">{icon}</span>
    </div>
    <h3 className="text-base font-semibold text-[#ffffff] mb-2">{title}</h3>
    <p className="text-sm text-[#9ca3af] leading-relaxed">{description}</p>
  </div>
);

// 主页组件
const Home = ({ onStart }) => {
  const features = [
    { icon: <BulbOutlined />, title: 'AI 智能分析', description: '深度学习算法自动识别交易模式，提供个性化改进建议' },
    { icon: <BarChartOutlined />, title: '多维度统计', description: '品种、时段、策略全方位数据分析，精确定位盈亏来源' },
    { icon: <AimOutlined />, title: 'MAE/MFE 追踪', description: '精准追踪每笔交易的最大逆向和最大顺向波动' },
    { icon: <ThunderboltOutlined />, title: '实时同步', description: '支持 ATAS、Jigsaw 等主流交易软件数据自动导入' },
    { icon: <RiseOutlined />, title: '权益曲线', description: '可视化权益变化，自动标注关键节点和最大回撤' },
    { icon: <SafetyCertificateOutlined />, title: '风险管理', description: '全面的风险指标监控，帮助建立稳健的交易系统' },
  ];

  const steps = [
    { num: '01', title: '导入数据', desc: '一键导入交易记录' },
    { num: '02', title: 'AI 分析', desc: '智能解析交易行为' },
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
            <span className="text-sm text-[#eab308] font-medium">AI 驱动的交易复盘</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-[#ffffff] mb-6 leading-tight">
            让每一笔交易<br />都成为进步的<span className="text-[#eab308]">阶梯</span>
          </h1>
          
          <p className="text-lg text-[#9ca3af] mb-10 max-w-2xl mx-auto leading-relaxed">
            专业的期货交易复盘平台。AI 深度分析您的交易数据，识别盈利模式，优化交易策略。
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
              了解更多
            </button>
          </div>
        </div>
        
        <MockInterface />
      </section>
      
      {/* 信任标识 */}
      <section className="py-12 border-y border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {['ATAS', 'Jigsaw', 'Futures', 'CME', 'NQ • ES • GC'].map((name, i) => (
              <div key={i} className="text-lg font-bold text-[#6b7280] tracking-wider">{name}</div>
            ))}
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
      
      {/* Workflow Section */}
      <section id="workflow" className="py-20 px-6 bg-[#0d0d10]">
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
      
      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#ffffff] mb-6">准备好提升交易水平了吗？</h2>
          <p className="text-[#9ca3af] mb-10 text-lg">加入专业交易者的行列，让 AI 成为您的交易教练</p>
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
