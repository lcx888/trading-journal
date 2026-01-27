import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Checkbox } from 'antd';
import { MailOutlined, LockOutlined, ArrowRightOutlined, ArrowLeftOutlined, CheckCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { login, register, forgotPassword, resetPassword, sendVerificationCode, verifyCode } from '../services/auth';

const Auth = ({ onAuth, onBack, initialMode, resetToken }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(initialMode || 'login');
  const [rememberMe, setRememberMe] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [form] = Form.useForm();
  
  // 注册分步状态
  const [registerStep, setRegisterStep] = useState(1); // 1: 邮箱, 2: 验证码, 3: 密码
  const [registerEmail, setRegisterEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    try {
      const values = await form.validateFields(['email']);
      setLoading(true);
      await sendVerificationCode(values.email);
      setRegisterEmail(values.email);
      setRegisterStep(2);
      setCountdown(60);
      message.success('验证码已发送到您的邮箱');
    } catch (e) {
      message.error(e.message || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      message.error('请输入6位验证码');
      return;
    }
    try {
      setLoading(true);
      await verifyCode(registerEmail, verificationCode);
      setRegisterStep(3);
      message.success('验证成功，请设置密码');
    } catch (e) {
      message.error(e.message || '验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 完成注册
  const handleCompleteRegister = async () => {
    try {
      const values = await form.validateFields(['password', 'confirmPassword']);
      setLoading(true);
      const result = await register(registerEmail, values.password, verificationCode);
      message.success(result.message || '注册成功');
      onAuth?.(result);
    } catch (e) {
      message.error(e.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  // 重新发送验证码
  const handleResendCode = async () => {
    if (countdown > 0) return;
    try {
      setLoading(true);
      await sendVerificationCode(registerEmail);
      setCountdown(60);
      message.success('验证码已重新发送');
    } catch (e) {
      message.error(e.message || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      if (mode === 'register') {
        // 注册流程根据步骤处理
        if (registerStep === 1) {
          await handleSendCode();
          return;
        } else if (registerStep === 2) {
          await handleVerifyCode();
          return;
        } else if (registerStep === 3) {
          await handleCompleteRegister();
          return;
        }
      } else if (mode === 'login') {
        const user = await login(values.email, values.password, rememberMe);
        message.success('登录成功');
        onAuth?.(user);
      } else if (mode === 'forgot') {
        await forgotPassword(values.email);
        message.success('如果该邮箱已注册，重置链接已发送');
        setResetSuccess(true);
      } else if (mode === 'reset') {
        await resetPassword(resetToken, values.password);
        message.success('密码重置成功！');
        setMode('login');
        form.resetFields();
      }
    } catch (e) {
      message.error(e.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    if (mode === 'forgot' || mode === 'reset') {
      setMode('login');
    } else {
      setMode(mode === 'login' ? 'register' : 'login');
    }
    setResetSuccess(false);
    setRegisterStep(1);
    setRegisterEmail('');
    setVerificationCode('');
    setCountdown(0);
    form.resetFields();
  };

  const goToForgot = () => {
    setMode('forgot');
    setResetSuccess(false);
    form.resetFields();
  };

  const getTitle = () => {
    if (mode === 'register') {
      switch (registerStep) {
        case 1: return '创建账号';
        case 2: return '验证邮箱';
        case 3: return '设置密码';
        default: return '创建账号';
      }
    }
    switch (mode) {
      case 'forgot': return '忘记密码';
      case 'reset': return '重置密码';
      default: return '欢迎回来';
    }
  };

  const getSubtitle = () => {
    if (mode === 'register') {
      switch (registerStep) {
        case 1: return '输入邮箱获取验证码';
        case 2: return `验证码已发送至 ${registerEmail}`;
        case 3: return '设置你的登录密码';
        default: return '开始你的专业交易复盘之旅';
      }
    }
    switch (mode) {
      case 'forgot': return '输入你的邮箱，我们将发送重置链接';
      case 'reset': return '设置你的新密码';
      default: return '输入你的凭据以访问账户';
    }
  };

  const getButtonText = () => {
    if (mode === 'register') {
      switch (registerStep) {
        case 1: return '发送验证码';
        case 2: return '验证';
        case 3: return '完成注册';
        default: return '下一步';
      }
    }
    switch (mode) {
      case 'forgot': return '发送重置链接';
      case 'reset': return '重置密码';
      default: return '登录';
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0c' }}>
      {/* Left Panel - Branding */}
      <div 
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#0d0d10', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full" style={{ border: '1px solid rgba(234,179,8,0.1)' }}></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full" style={{ border: '1px solid rgba(234,179,8,0.05)' }}></div>
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.03)' }}></div>
          {/* 金色光晕 */}
          <div 
            className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl"
            style={{ background: 'rgba(234,179,8,0.08)' }}
          ></div>
        </div>
        
        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
            <img src="/logo.svg" alt="TradeWhy.AI" className="h-10 object-contain" />
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-8">
          <h1 className="text-5xl font-bold leading-tight text-white">
            用 <span style={{ color: '#eab308' }}>AI</span> 驱动<br />
            你的交易复盘
          </h1>
          <p className="text-lg max-w-md leading-relaxed" style={{ color: '#9ca3af' }}>
            自动识别情绪化操作，分析策略漏洞，助你构建稳定盈利的交易系统。
          </p>
          
          {/* Stats */}
          <div className="flex gap-12 pt-8">
            <div>
              <div className="text-3xl font-bold font-mono" style={{ color: '#eab308' }}>10K+</div>
              <div className="text-sm mt-1" style={{ color: '#6b7280' }}>活跃交易员</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono" style={{ color: '#10b981' }}>98%</div>
              <div className="text-sm mt-1" style={{ color: '#6b7280' }}>用户满意度</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-white">24/7</div>
              <div className="text-sm mt-1" style={{ color: '#6b7280' }}>技术支持</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-sm" style={{ color: '#6b7280' }}>
          © 2026 TradeWhy.AI Inc. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-24">
        {/* Mobile back button */}
        <div className="lg:hidden mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 transition-colors"
            style={{ color: '#9ca3af' }}
          >
            <ArrowLeftOutlined />
            <span>返回首页</span>
          </button>
        </div>

        {/* Mobile Logo */}
        <div className="lg:hidden flex items-center gap-2 mb-12">
          <img src="/logo.svg" alt="TradeWhy.AI" className="h-8 object-contain" />
        </div>

        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-3xl font-bold mb-3 text-white">
              {getTitle()}
            </h2>
            <p style={{ color: '#9ca3af' }}>
              {getSubtitle()}
            </p>
          </div>

          {/* Success message for forgot password */}
          {mode === 'forgot' && resetSuccess ? (
            <div className="text-center py-8">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(16,185,129,0.1)' }}
              >
                <CheckCircleOutlined className="text-3xl" style={{ color: '#10b981' }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">邮件已发送</h3>
              <p className="mb-6" style={{ color: '#9ca3af' }}>
                如果该邮箱已注册，你将收到密码重置链接。<br />
                请检查你的收件箱和垃圾邮件文件夹。
              </p>
              <Button 
                type="link" 
                onClick={() => setMode('login')}
                style={{ color: '#eab308', fontWeight: 500 }}
              >
                返回登录
              </Button>
            </div>
          ) : (
            <>
              {/* Form */}
              <Form form={form} layout="vertical" className="auth-form">
                {/* 登录模式：邮箱输入 */}
                {(mode === 'login' || mode === 'forgot') && (
                  <Form.Item 
                    name="email" 
                    label={<span className="auth-label">邮箱地址</span>}
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' }
                    ]}
                  >
                    <Input 
                      prefix={
                        <div className="auth-input-icon">
                          <MailOutlined />
                        </div>
                      } 
                      placeholder="name@example.com" 
                      size="large"
                      className="auth-input"
                    />
                  </Form.Item>
                )}

                {/* 注册步骤1：邮箱输入 */}
                {mode === 'register' && registerStep === 1 && (
                  <Form.Item 
                    name="email" 
                    label={<span className="auth-label">邮箱地址</span>}
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' }
                    ]}
                  >
                    <Input 
                      prefix={
                        <div className="auth-input-icon">
                          <MailOutlined />
                        </div>
                      } 
                      placeholder="name@example.com" 
                      size="large"
                      className="auth-input"
                    />
                  </Form.Item>
                )}

                {/* 注册步骤2：验证码输入 */}
                {mode === 'register' && registerStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <div 
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(234,179,8,0.1)' }}
                      >
                        <SafetyOutlined className="text-3xl" style={{ color: '#eab308' }} />
                      </div>
                    </div>
                    <div>
                      <label className="auth-label block mb-2">验证码</label>
                      <Input 
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="输入6位验证码"
                        size="large"
                        maxLength={6}
                        className="auth-input"
                        style={{ 
                          textAlign: 'center', 
                          letterSpacing: '8px', 
                          fontSize: '24px',
                          fontFamily: 'monospace',
                        }}
                      />
                    </div>
                    <div className="text-center mt-4">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={countdown > 0}
                        className="text-sm transition-colors"
                        style={{ color: countdown > 0 ? '#6b7280' : '#eab308' }}
                      >
                        {countdown > 0 ? `${countdown}秒后可重新发送` : '重新发送验证码'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 注册步骤3：设置密码 */}
                {mode === 'register' && registerStep === 3 && (
                  <>
                    <Form.Item 
                      name="password" 
                      label={<span className="auth-label">设置密码</span>}
                      rules={[
                        { required: true, message: '请输入密码' }, 
                        { min: 6, message: '密码至少 6 位' }
                      ]}
                    >
                      <Input.Password 
                        prefix={
                          <div className="auth-input-icon">
                            <LockOutlined />
                          </div>
                        } 
                        placeholder="至少 6 位字符"
                        size="large"
                        className="auth-input"
                      />
                    </Form.Item>
                    <Form.Item 
                      name="confirmPassword" 
                      label={<span className="auth-label">确认密码</span>}
                      dependencies={['password']}
                      rules={[
                        { required: true, message: '请确认密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('password') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('两次密码不一致'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password 
                        prefix={
                          <div className="auth-input-icon">
                            <LockOutlined />
                          </div>
                        } 
                        placeholder="再次输入密码"
                        size="large"
                        className="auth-input"
                      />
                    </Form.Item>
                  </>
                )}
                
                {/* 登录模式：密码输入 */}
                {mode === 'login' && (
                  <Form.Item 
                    name="password" 
                    label={<span className="auth-label">密码</span>}
                    rules={[
                      { required: true, message: '请输入密码' }, 
                      { min: 6, message: '密码至少 6 位' }
                    ]}
                  >
                    <Input.Password 
                      prefix={
                        <div className="auth-input-icon">
                          <LockOutlined />
                        </div>
                      } 
                      placeholder="输入你的密码"
                      size="large"
                      className="auth-input"
                    />
                  </Form.Item>
                )}

                {mode === 'reset' && (
                  <>
                    <Form.Item 
                      name="password" 
                      label={<span className="auth-label">新密码</span>}
                      rules={[
                        { required: true, message: '请输入新密码' }, 
                        { min: 6, message: '密码至少 6 位' }
                      ]}
                    >
                      <Input.Password 
                        prefix={
                          <div className="auth-input-icon">
                            <LockOutlined />
                          </div>
                        } 
                        placeholder="至少 6 位字符"
                        size="large"
                        className="auth-input"
                      />
                    </Form.Item>
                    <Form.Item 
                      name="confirmPassword" 
                      label={<span className="auth-label">确认密码</span>}
                      dependencies={['password']}
                      rules={[
                        { required: true, message: '请确认密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('password') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('两次密码不一致'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password 
                        prefix={
                          <div className="auth-input-icon">
                            <LockOutlined />
                          </div>
                        } 
                        placeholder="再次输入密码"
                        size="large"
                        className="auth-input"
                      />
                    </Form.Item>
                  </>
                )}

                {mode === 'login' && (
                  <div className="flex justify-between items-center mb-4">
                    <Checkbox 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ color: '#9ca3af' }}
                    >
                      <span style={{ color: '#9ca3af' }}>记住登录 30 天</span>
                    </Checkbox>
                    <button 
                      type="button" 
                      onClick={goToForgot}
                      className="text-sm transition-colors hover:underline"
                      style={{ color: '#eab308' }}
                    >
                      忘记密码？
                    </button>
                  </div>
                )}

                {/* 注册模式返回按钮 */}
                {mode === 'register' && registerStep > 1 && (
                  <Button 
                    block 
                    size="large"
                    onClick={() => {
                      if (registerStep === 2) {
                        setRegisterStep(1);
                        setVerificationCode('');
                      } else if (registerStep === 3) {
                        setRegisterStep(2);
                      }
                    }}
                    style={{
                      height: 48,
                      background: 'transparent',
                      border: '2px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 15,
                      color: '#9ca3af',
                      marginTop: 16,
                    }}
                  >
                    <ArrowLeftOutlined className="mr-2" />
                    返回上一步
                  </Button>
                )}

                <Button 
                  type="primary" 
                  block 
                  size="large"
                  loading={loading} 
                  onClick={mode === 'register' && registerStep === 2 ? handleVerifyCode : handleSubmit}
                  style={{
                    height: 48,
                    background: '#eab308',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 15,
                    color: '#0a0a0c',
                    marginTop: 16,
                    boxShadow: '0 4px 20px rgba(234,179,8,0.3)',
                  }}
                >
                  {getButtonText()}
                  <ArrowRightOutlined className="ml-2" />
                </Button>
              </Form>

              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }}></div>
                <span className="text-sm" style={{ color: '#6b7280' }}>或</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }}></div>
              </div>

              {/* Toggle mode */}
              <div className="text-center">
                {mode === 'forgot' || mode === 'reset' ? (
                  <button 
                    onClick={() => setMode('login')}
                    className="font-medium hover:underline"
                    style={{ color: '#eab308' }}
                  >
                    返回登录
                  </button>
                ) : mode === 'register' && registerStep > 1 ? (
                  <span style={{ color: '#6b7280', fontSize: 14 }}>
                    步骤 {registerStep}/3
                  </span>
                ) : (
                  <>
                    <span style={{ color: '#9ca3af' }}>
                      {mode === 'login' ? '还没有账号？' : '已有账号？'}
                    </span>
                    <button 
                      onClick={toggleMode}
                      className="ml-2 font-medium hover:underline"
                      style={{ color: '#eab308' }}
                    >
                      {mode === 'login' ? '免费注册' : '立即登录'}
                    </button>
                  </>
                )}
              </div>

              {/* Terms */}
              {mode === 'register' && registerStep === 3 && (
                <p className="text-center text-xs mt-8 leading-relaxed" style={{ color: '#6b7280' }}>
                  点击"完成注册"即表示你同意我们的<br />
                  <a href="#" style={{ color: '#9ca3af' }} className="hover:underline">服务条款</a> 和 <a href="#" style={{ color: '#9ca3af' }} className="hover:underline">隐私政策</a>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Custom styles for dark theme inputs */}
      <style>{`
        /* 标签样式 */
        .auth-label {
          color: #ffffff;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* 图标容器 */
        .auth-input-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 8px;
          color: #6b7280;
          font-size: 16px;
          transition: all 0.2s ease;
        }
        
        /* 输入框容器 */
        .auth-input.ant-input-affix-wrapper,
        .auth-input.ant-input {
          background: #0d0d10 !important;
          border: 2px solid rgba(255,255,255,0.06) !important;
          border-radius: 12px !important;
          padding: 8px 12px !important;
          height: 56px !important;
          transition: all 0.2s ease !important;
        }
        
        .auth-input.ant-input-affix-wrapper:hover,
        .auth-input.ant-input:hover {
          border-color: rgba(234,179,8,0.3) !important;
          background: #0f0f12 !important;
        }
        
        .auth-input.ant-input-affix-wrapper:hover .auth-input-icon,
        .auth-input.ant-input:hover .auth-input-icon {
          color: #9ca3af;
        }
        
        .auth-input.ant-input-affix-wrapper-focused,
        .auth-input.ant-input:focus {
          border-color: #eab308 !important;
          box-shadow: none !important;
          background: #0f0f12 !important;
        }
        
        .auth-input.ant-input-affix-wrapper-focused .auth-input-icon {
          color: #eab308;
        }
        
        .auth-input.ant-input-affix-wrapper input,
        .auth-input.ant-input {
          background: transparent !important;
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 500 !important;
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        
        .auth-input.ant-input-affix-wrapper input::placeholder,
        .auth-input.ant-input::placeholder {
          color: #4b5563 !important;
          font-weight: 400 !important;
        }
        
        /* 密码显示/隐藏图标 */
        .auth-input .ant-input-password-icon {
          color: #6b7280 !important;
          font-size: 16px !important;
          padding: 8px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        
        .auth-input .ant-input-password-icon:hover {
          color: #eab308 !important;
          background: rgba(234,179,8,0.1);
        }
        
        /* 复选框 */
        .ant-checkbox-inner {
          background: #0d0d10 !important;
          border: 2px solid rgba(255,255,255,0.1) !important;
          border-radius: 4px !important;
          width: 18px !important;
          height: 18px !important;
        }
        
        .ant-checkbox:hover .ant-checkbox-inner {
          border-color: rgba(234,179,8,0.5) !important;
        }
        
        .ant-checkbox-checked .ant-checkbox-inner {
          background: #eab308 !important;
          border-color: #eab308 !important;
        }
        
        .ant-checkbox-checked .ant-checkbox-inner::after {
          border-color: #0a0a0c !important;
          border-width: 2px !important;
        }
        
        /* 表单项间距 */
        .auth-form .ant-form-item {
          margin-bottom: 20px !important;
        }
        
        .auth-form .ant-form-item-label {
          padding-bottom: 8px !important;
        }
        
        /* 错误提示 */
        .ant-form-item-explain-error {
          color: #f43f5e !important;
          font-size: 12px !important;
          margin-top: 6px !important;
        }
        
        /* 主按钮 */
        .ant-btn-primary:hover {
          background: #facc15 !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(234,179,8,0.4) !important;
        }
        
        .ant-btn-primary:active {
          transform: translateY(0);
        }
        
        /* 错误状态输入框 */
        .ant-form-item-has-error .auth-input.ant-input-affix-wrapper,
        .ant-form-item-has-error .auth-input.ant-input {
          border-color: #f43f5e !important;
        }
        
        .ant-form-item-has-error .auth-input-icon {
          color: #f43f5e !important;
        }
      `}</style>
    </div>
  );
};

export default Auth;
