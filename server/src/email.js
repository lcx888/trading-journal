// 邮件发送服务
import { Resend } from 'resend';

// 初始化 Resend 客户端
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 发送邮件
export async function sendEmail({ to, subject, html }) {
  const from = process.env.EMAIL_FROM || 'MetworthAI <onboarding@resend.dev>';
  
  // 如果没有配置 Resend，使用测试模式
  if (!resend) {
    console.log('========== 邮件（测试模式）==========');
    console.log('收件人:', to);
    console.log('主题:', subject);
    console.log('内容:', html.replace(/<[^>]*>/g, '').substring(0, 200) + '...');
    console.log('=====================================');
    console.log('💡 提示: 设置 RESEND_API_KEY 环境变量以启用真实邮件发送');
    return { success: true, testMode: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('发送邮件失败:', error);
      return { success: false, error: error.message };
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
          © 2026 Metworth Inc. All rights reserved.
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
          © 2026 Metworth Inc. All rights reserved.
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
          © 2026 Metworth Inc. All rights reserved.
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
    subject: '【MetworthAI】注册验证码',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #0a0a0c 0%, #1a1a1f 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #eab308; margin: 0; font-size: 28px;">MetworthAI</h1>
          <p style="color: #9ca3af; margin-top: 8px;">AI 驱动的交易复盘平台</p>
        </div>
        <div style="padding: 40px 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">验证您的邮箱</h2>
          <p style="color: #666; line-height: 1.6;">
            您正在注册 MetworthAI 账号，请使用以下验证码完成注册：
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
          © 2026 Metworth Inc. All rights reserved.
        </div>
      </div>
    `,
  });
}