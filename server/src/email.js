// 邮件发送服务
// 直接用 node-fetch 调用 Resend REST API，兼容 Node 16+
import fetch from 'node-fetch';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// 发送邮件
export async function sendEmail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || 'TradeWhy.AI <onboarding@resend.dev>';
  
  if (!RESEND_API_KEY) {
    console.log('========== 邮件（测试模式）==========');
    console.log('收件人:', to);
    console.log('主题:', subject);
    console.log('内容:', html.replace(/<[^>]*>/g, '').substring(0, 200) + '...');
    console.log('=====================================');
    console.log('💡 提示: 设置 RESEND_API_KEY 环境变量以启用真实邮件发送');
    return { success: true, testMode: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('发送邮件失败:', data);
      return { success: false, error: data.message || '邮件发送失败' };
    }

    console.log('✅ 邮件发送成功:', data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('发送邮件失败:', error);
    return { success: false, error: error.message };
  }
}

// 发送验证邮件
export async function sendVerificationEmail(email, token, baseUrl) {
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: '【交易日志】请验证您的邮箱',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📊 交易日志系统</h1>
        </div>
        <div style="padding: 40px 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">验证您的邮箱</h2>
          <p style="color: #666; line-height: 1.6;">
            感谢您注册交易日志系统！请点击下方按钮验证您的邮箱地址：
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              验证邮箱
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            如果按钮无法点击，请复制以下链接到浏览器：<br>
            <a href="${verifyUrl}" style="color: #667eea;">${verifyUrl}</a>
          </p>
          <p style="color: #999; font-size: 14px;">
            此链接 24 小时内有效。如果您没有注册账号，请忽略此邮件。
          </p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          © 2026 TradeWhy.AI Inc. All rights reserved.
        </div>
      </div>
    `,
  });
}

// 发送密码重置邮件
export async function sendPasswordResetEmail(email, token, baseUrl) {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: '【交易日志】重置您的密码',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📊 交易日志系统</h1>
        </div>
        <div style="padding: 40px 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">重置您的密码</h2>
          <p style="color: #666; line-height: 1.6;">
            我们收到了您的密码重置请求。请点击下方按钮设置新密码：
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              重置密码
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            如果按钮无法点击，请复制以下链接到浏览器：<br>
            <a href="${resetUrl}" style="color: #667eea;">${resetUrl}</a>
          </p>
          <p style="color: #999; font-size: 14px;">
            此链接 1 小时内有效。如果您没有请求重置密码，请忽略此邮件。
          </p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          © 2026 TradeWhy.AI Inc. All rights reserved.
        </div>
      </div>
    `,
  });
}

// 发送邮箱变更验证邮件
export async function sendEmailChangeEmail(email, token, baseUrl) {
  const verifyUrl = `${baseUrl}/verify-email-change?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: '【交易日志】确认更改邮箱',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📊 交易日志系统</h1>
        </div>
        <div style="padding: 40px 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">确认更改邮箱</h2>
          <p style="color: #666; line-height: 1.6;">
            您正在将账号邮箱更改为此地址。请点击下方按钮确认：
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              确认更改
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            此链接 1 小时内有效。如果您没有请求更改邮箱，请立即登录账号检查安全设置。
          </p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          © 2026 TradeWhy.AI Inc. All rights reserved.
        </div>
      </div>
    `,
  });
}

// 生成随机令牌
export function generateToken() {
  return Array.from({ length: 32 }, () => 
    Math.random().toString(36).charAt(2)
  ).join('');
}

// 生成6位数字验证码
export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送注册验证码邮件
export async function sendRegistrationCodeEmail(email, code) {
  return sendEmail({
    to: email,
    subject: '【TradeWhy.AI】注册验证码',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #0a0a0c 0%, #1a1a1f 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #eab308; margin: 0; font-size: 28px;">TradeWhy.AI</h1>
          <p style="color: #9ca3af; margin-top: 8px;">AI 驱动的交易复盘平台</p>
        </div>
        <div style="padding: 40px 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">验证您的邮箱</h2>
          <p style="color: #666; line-height: 1.6;">
            您正在注册 TradeWhy.AI 账号，请使用以下验证码完成注册：
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background: #0a0a0c; color: #eab308; padding: 20px 40px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 12px; font-family: 'Courier New', monospace;">
              ${code}
            </div>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            验证码 <strong>10 分钟</strong>内有效，请尽快完成注册。
          </p>
          <p style="color: #999; font-size: 14px; text-align: center; margin-top: 20px;">
            如果您没有注册账号，请忽略此邮件。
          </p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px; background: #f0f0f0;">
          © 2026 TradeWhy.AI Inc. All rights reserved.
        </div>
      </div>
    `,
  });
}

// 发送错误报告邮件
export async function sendErrorReportEmail({ to, subject, errorData }) {
  const typeLabels = {
    js_error: '🔴 JavaScript 运行时错误',
    promise_error: '🟠 Promise 未处理异常',
    resource_error: '🟡 资源加载失败',
  };
  
  const typeLabel = typeLabels[errorData.type] || '⚪ 未知错误';
  
  return sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #dc3545, #c82333); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚨 前端错误报告</h1>
        </div>
        <div style="padding: 30px; background: white;">
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <strong style="color: #856404;">${typeLabel}</strong>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666; width: 100px;">错误类型</td>
              <td style="padding: 12px 0; font-weight: bold;">${errorData.type}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;">错误信息</td>
              <td style="padding: 12px 0; color: #dc3545; word-break: break-all;">${errorData.message || '-'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;">发生时间</td>
              <td style="padding: 12px 0;">${errorData.timestamp || '-'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;">页面 URL</td>
              <td style="padding: 12px 0; word-break: break-all;">${errorData.url || '-'}</td>
            </tr>
            ${errorData.source ? `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;">错误来源</td>
              <td style="padding: 12px 0; word-break: break-all;">${errorData.source}</td>
            </tr>
            ` : ''}
            ${errorData.line ? `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;">行号/列号</td>
              <td style="padding: 12px 0;">${errorData.line}:${errorData.column || 0}</td>
            </tr>
            ` : ''}
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;">浏览器</td>
              <td style="padding: 12px 0; font-size: 12px; color: #666;">${errorData.userAgent || '-'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;">屏幕尺寸</td>
              <td style="padding: 12px 0;">${errorData.screenSize || '-'} / 视口 ${errorData.viewportSize || '-'}</td>
            </tr>
          </table>
          
          ${errorData.stack ? `
          <div style="margin-top: 20px;">
            <strong style="color: #666;">堆栈信息:</strong>
            <pre style="background: #1a1a2e; color: #00ff88; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 12px; line-height: 1.5; margin-top: 10px;">${errorData.stack}</pre>
          </div>
          ` : ''}
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px; background: #f0f0f0;">
          此邮件由 TradeWhy.AI 错误监控系统自动发送
        </div>
      </div>
    `,
  });
}