import { apiRequest, setAuthToken } from './api';

export const login = async (email, password, rememberMe = false) => {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password, rememberMe },
  });
  setAuthToken(result.token);
  return result.user;
};

// 发送注册验证码
export const sendVerificationCode = async (email) => {
  return await apiRequest('/auth/send-code', {
    method: 'POST',
    body: { email },
  });
};

// 验证验证码
export const verifyCode = async (email, code) => {
  return await apiRequest('/auth/verify-code', {
    method: 'POST',
    body: { email, code },
  });
};

export const register = async (email, password, code) => {
  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password, code },
  });
  setAuthToken(result.token);
  return { ...result.user, message: result.message };
};

export const getMe = async () => apiRequest('/auth/me');

export const logout = async () => {
  setAuthToken(null);
};

// 忘记密码
export const forgotPassword = async (email) => {
  return await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
};

// 重置密码
export const resetPassword = async (token, password) => {
  return await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
};

// 验证邮箱
export const verifyEmail = async (token) => {
  return await apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { token },
  });
};

// 重新发送验证邮件
export const resendVerification = async () => {
  return await apiRequest('/auth/resend-verification', {
    method: 'POST',
  });
};

// 修改密码
export const changePassword = async (currentPassword, newPassword) => {
  return await apiRequest('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
};

// 修改邮箱
export const changeEmail = async (newEmail, password) => {
  return await apiRequest('/auth/change-email', {
    method: 'POST',
    body: { newEmail, password },
  });
};

// 确认更改邮箱
export const confirmEmailChange = async (token) => {
  return await apiRequest('/auth/confirm-email-change', {
    method: 'POST',
    body: { token },
  });
};

// 注销账户
export const deleteAccount = async (password, confirmText) => {
  return await apiRequest('/auth/delete-account', {
    method: 'POST',
    body: { password, confirmText },
  });
};
