import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined, LockOutlined, ArrowRightOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { login, register } from '../services/auth';

const Auth = ({ onAuth, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const user = mode === 'register'
        ? await register(values.email, values.password)
        : await login(values.email, values.password);
      message.success(mode === 'register' ? '注册成功' : '登录成功');
      onAuth?.(user);
    } catch (e) {
      message.error(e.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    form.resetFields();
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-black text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 border border-white/20 rounded-full"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 border border-white/20 rounded-full"></div>
          <div className="absolute top-1/2 left-1/3 w-48 h-48 border border-white/10 rounded-full"></div>
        </div>
        
        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-bold text-xl">M</div>
            <span className="text-2xl font-bold tracking-tight">MetworthAI</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-8">
          <h1 className="text-5xl font-bold leading-tight">
            用 AI 驱动<br />
            你的交易复盘
          </h1>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            自动识别情绪化操作，分析策略漏洞，助你构建稳定盈利的交易系统。
          </p>
          
          {/* Stats */}
          <div className="flex gap-12 pt-8">
            <div>
              <div className="text-3xl font-bold">10K+</div>
              <div className="text-gray-500 text-sm mt-1">活跃交易员</div>
            </div>
            <div>
              <div className="text-3xl font-bold">98%</div>
              <div className="text-gray-500 text-sm mt-1">用户满意度</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-gray-500 text-sm mt-1">技术支持</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-gray-500 text-sm">
          © 2026 Metworth Inc. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-24">
        {/* Mobile back button */}
        <div className="lg:hidden mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeftOutlined />
            <span>返回首页</span>
          </button>
        </div>

        {/* Mobile Logo */}
        <div className="lg:hidden flex items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">M</div>
          <span className="text-xl font-bold tracking-tight text-gray-900">MetworthAI</span>
        </div>

        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              {mode === 'login' ? '欢迎回来' : '创建账号'}
            </h2>
            <p className="text-gray-500">
              {mode === 'login' 
                ? '输入你的凭据以访问你的账户' 
                : '开始你的专业交易复盘之旅'}
            </p>
          </div>

          {/* Form */}
          <Form form={form} layout="vertical" className="space-y-1">
            <Form.Item 
              name="email" 
              label={<span className="text-gray-700 font-medium">邮箱地址</span>}
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input 
                prefix={<MailOutlined className="text-gray-400" />} 
                placeholder="name@example.com" 
                size="large"
                className="rounded-lg border-gray-200 hover:border-gray-400 focus:border-black"
              />
            </Form.Item>
            
            <Form.Item 
              name="password" 
              label={<span className="text-gray-700 font-medium">密码</span>}
              rules={[
                { required: true, message: '请输入密码' }, 
                { min: 6, message: '密码至少 6 位' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined className="text-gray-400" />} 
                placeholder={mode === 'register' ? '至少 6 位字符' : '输入你的密码'}
                size="large"
                className="rounded-lg border-gray-200 hover:border-gray-400 focus:border-black"
              />
            </Form.Item>

            {mode === 'login' && (
              <div className="flex justify-end mb-4">
                <button type="button" className="text-sm text-gray-500 hover:text-black transition-colors">
                  忘记密码？
                </button>
              </div>
            )}

            <Button 
              type="primary" 
              block 
              size="large"
              loading={loading} 
              onClick={handleSubmit}
              className="h-12 bg-black hover:!bg-gray-800 border-none rounded-lg font-medium text-base shadow-lg shadow-gray-200 mt-4"
            >
              {mode === 'login' ? '登录' : '创建账号'}
              <ArrowRightOutlined className="ml-2" />
            </Button>
          </Form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-gray-400 text-sm">或</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Toggle mode */}
          <div className="text-center">
            <span className="text-gray-500">
              {mode === 'login' ? '还没有账号？' : '已有账号？'}
            </span>
            <button 
              onClick={toggleMode}
              className="ml-2 text-black font-medium hover:underline"
            >
              {mode === 'login' ? '免费注册' : '立即登录'}
            </button>
          </div>

          {/* Terms */}
          {mode === 'register' && (
            <p className="text-center text-gray-400 text-xs mt-8 leading-relaxed">
              点击"创建账号"即表示你同意我们的<br />
              <a href="#" className="text-gray-600 hover:text-black">服务条款</a> 和 <a href="#" className="text-gray-600 hover:text-black">隐私政策</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
