// 安装向导模块
import { prisma } from './db.js';
import bcrypt from 'bcryptjs';
import { DEFAULT_INSTRUMENTS } from './defaults.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查是否已安装
export async function isInstalled() {
  try {
    const lockFile = path.join(__dirname, '../.installed');
    if (fs.existsSync(lockFile)) {
      return true;
    }
    // 也检查数据库是否有用户
    const userCount = await prisma.user.count();
    return userCount > 0;
  } catch (error) {
    return false;
  }
}

// 检测环境
export async function checkEnvironment() {
  const checks = {
    nodeVersion: process.version,
    nodeOk: parseInt(process.version.slice(1)) >= 18,
    envFile: fs.existsSync(path.join(__dirname, '../.env')),
    prismaClient: false,
    databaseConnection: false,
  };

  // 检查 Prisma Client
  try {
    await prisma.$connect();
    checks.prismaClient = true;
    checks.databaseConnection = true;
  } catch (error) {
    checks.databaseError = error.message;
  }

  return checks;
}

// 初始化数据库
export async function initDatabase() {
  try {
    // 运行 prisma db push
    const prismaPath = path.join(__dirname, '../');
    await execAsync('npx prisma generate', { cwd: prismaPath });
    await execAsync('npx prisma db push --accept-data-loss', { cwd: prismaPath });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 创建管理员账号
export async function createAdmin(email, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建超级管理员
    const admin = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'superadmin',
        status: 'active',
        instruments: {
          create: DEFAULT_INSTRUMENTS.map(inst => ({
            code: inst.code,
            name: inst.name,
            exchange: inst.exchange,
            tickSize: inst.tickSize,
            tickValue: inst.tickValue,
            currency: inst.currency,
            timezone: inst.timezone,
            tradingHours: inst.tradingHours,
          }))
        }
      }
    });

    // 创建安装锁定文件
    const lockFile = path.join(__dirname, '../.installed');
    fs.writeFileSync(lockFile, JSON.stringify({
      installedAt: new Date().toISOString(),
      adminEmail: email
    }));

    return { success: true, admin: { id: admin.id, email: admin.email } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 安装路由
export function setupInstallRoutes(app) {
  
  // 安装页面 HTML
  const installHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>交易日志系统 - 安装向导</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 40px;
      width: 100%;
      max-width: 500px;
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      font-size: 28px;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .logo p {
      color: #666;
      font-size: 14px;
    }
    .step {
      display: none;
    }
    .step.active {
      display: block;
    }
    .step-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
    }
    .check-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f5f5f5;
    }
    .check-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      font-size: 14px;
    }
    .check-icon.success { background: #10b981; color: white; }
    .check-icon.error { background: #ef4444; color: white; }
    .check-icon.loading { background: #f59e0b; color: white; }
    .check-label { flex: 1; color: #333; }
    .check-value { color: #666; font-size: 14px; }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
    }
    .form-group input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e5e5;
      border-radius: 10px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
    }
    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .message {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .message.error {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }
    .message.success {
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
    }
    .success-box {
      text-align: center;
      padding: 30px 0;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 40px;
      color: white;
    }
    .success-box h2 {
      color: #1a1a2e;
      margin-bottom: 10px;
    }
    .success-box p {
      color: #666;
      margin-bottom: 20px;
    }
    .steps-indicator {
      display: flex;
      justify-content: center;
      margin-bottom: 30px;
    }
    .step-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #e5e5e5;
      margin: 0 6px;
      transition: all 0.3s;
    }
    .step-dot.active {
      background: #667eea;
      transform: scale(1.2);
    }
    .step-dot.completed {
      background: #10b981;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>📊 交易日志系统</h1>
      <p>一键安装向导</p>
    </div>
    
    <div class="steps-indicator">
      <div class="step-dot active" id="dot1"></div>
      <div class="step-dot" id="dot2"></div>
      <div class="step-dot" id="dot3"></div>
    </div>

    <!-- 步骤1: 环境检测 -->
    <div class="step active" id="step1">
      <div class="step-title">第一步：环境检测</div>
      <div id="checks">
        <div class="check-item">
          <div class="check-icon loading">⏳</div>
          <span class="check-label">正在检测环境...</span>
        </div>
      </div>
      <div style="margin-top: 20px;">
        <button class="btn btn-primary" id="nextStep1" disabled>下一步</button>
      </div>
    </div>

    <!-- 步骤2: 管理员设置 -->
    <div class="step" id="step2">
      <div class="step-title">第二步：创建管理员账号</div>
      <div id="step2Message"></div>
      <div class="form-group">
        <label>管理员邮箱</label>
        <input type="email" id="adminEmail" placeholder="admin@example.com">
      </div>
      <div class="form-group">
        <label>登录密码</label>
        <input type="password" id="adminPassword" placeholder="至少6位密码">
      </div>
      <div class="form-group">
        <label>确认密码</label>
        <input type="password" id="adminPassword2" placeholder="再次输入密码">
      </div>
      <button class="btn btn-primary" id="installBtn">开始安装</button>
    </div>

    <!-- 步骤3: 完成 -->
    <div class="step" id="step3">
      <div class="success-box">
        <div class="success-icon">✓</div>
        <h2>安装成功！</h2>
        <p>系统已成功安装，现在可以开始使用了</p>
        <button class="btn btn-primary" onclick="window.location.href='/'">进入系统</button>
      </div>
    </div>
  </div>

  <script>
    let envChecks = {};

    // 检测环境
    async function checkEnv() {
      try {
        const res = await fetch('/install/check');
        envChecks = await res.json();
        
        const checksDiv = document.getElementById('checks');
        checksDiv.innerHTML = '';
        
        const items = [
          { key: 'nodeOk', label: 'Node.js 版本', value: envChecks.nodeVersion },
          { key: 'envFile', label: '环境配置文件', value: envChecks.envFile ? '已配置' : '未配置' },
          { key: 'databaseConnection', label: '数据库连接', value: envChecks.databaseConnection ? '正常' : '失败' },
        ];
        
        let allOk = true;
        items.forEach(item => {
          const ok = envChecks[item.key];
          if (!ok) allOk = false;
          checksDiv.innerHTML += \`
            <div class="check-item">
              <div class="check-icon \${ok ? 'success' : 'error'}">\${ok ? '✓' : '✗'}</div>
              <span class="check-label">\${item.label}</span>
              <span class="check-value">\${item.value}</span>
            </div>
          \`;
        });
        
        document.getElementById('nextStep1').disabled = !allOk;
        
        if (!allOk && envChecks.databaseError) {
          checksDiv.innerHTML += \`
            <div class="message error" style="margin-top: 15px;">
              数据库错误: \${envChecks.databaseError}
            </div>
          \`;
        }
      } catch (error) {
        document.getElementById('checks').innerHTML = \`
          <div class="message error">检测失败: \${error.message}</div>
        \`;
      }
    }

    // 下一步
    document.getElementById('nextStep1').onclick = () => {
      document.getElementById('step1').classList.remove('active');
      document.getElementById('step2').classList.add('active');
      document.getElementById('dot1').classList.remove('active');
      document.getElementById('dot1').classList.add('completed');
      document.getElementById('dot2').classList.add('active');
    };

    // 安装
    document.getElementById('installBtn').onclick = async () => {
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;
      const password2 = document.getElementById('adminPassword2').value;
      const msgDiv = document.getElementById('step2Message');

      if (!email || !password) {
        msgDiv.innerHTML = '<div class="message error">请填写邮箱和密码</div>';
        return;
      }
      if (password.length < 6) {
        msgDiv.innerHTML = '<div class="message error">密码至少6位</div>';
        return;
      }
      if (password !== password2) {
        msgDiv.innerHTML = '<div class="message error">两次密码不一致</div>';
        return;
      }

      const btn = document.getElementById('installBtn');
      btn.disabled = true;
      btn.textContent = '安装中...';

      try {
        const res = await fetch('/install/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
          document.getElementById('step2').classList.remove('active');
          document.getElementById('step3').classList.add('active');
          document.getElementById('dot2').classList.remove('active');
          document.getElementById('dot2').classList.add('completed');
          document.getElementById('dot3').classList.add('active');
          document.getElementById('dot3').classList.add('completed');
        } else {
          msgDiv.innerHTML = \`<div class="message error">\${data.error || '安装失败'}</div>\`;
          btn.disabled = false;
          btn.textContent = '重试安装';
        }
      } catch (error) {
        msgDiv.innerHTML = \`<div class="message error">安装失败: \${error.message}</div>\`;
        btn.disabled = false;
        btn.textContent = '重试安装';
      }
    };

    // 页面加载时检测环境
    checkEnv();
  </script>
</body>
</html>
  `;

  // 安装页面路由
  app.get('/install', async (req, res) => {
    const installed = await isInstalled();
    if (installed) {
      return res.redirect('/');
    }
    res.send(installHTML);
  });

  // 环境检测 API
  app.get('/install/check', async (req, res) => {
    const checks = await checkEnvironment();
    res.json(checks);
  });

  // 执行安装 API
  app.post('/install/run', async (req, res) => {
    try {
      const installed = await isInstalled();
      if (installed) {
        return res.status(400).json({ success: false, error: '系统已安装' });
      }

      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, error: '请填写邮箱和密码' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: '密码至少6位' });
      }

      // 初始化数据库
      const dbResult = await initDatabase();
      if (!dbResult.success) {
        return res.status(500).json({ success: false, error: '数据库初始化失败: ' + dbResult.error });
      }

      // 创建管理员
      const adminResult = await createAdmin(email, password);
      if (!adminResult.success) {
        return res.status(500).json({ success: false, error: '创建管理员失败: ' + adminResult.error });
      }

      res.json({ success: true, message: '安装成功' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
