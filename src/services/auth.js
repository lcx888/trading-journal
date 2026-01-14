import { apiRequest, setAuthToken } from './api';

export const login = async (email, password) => {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setAuthToken(result.token);
  return result.user;
};

export const register = async (email, password) => {
  const result = await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password },
  });
  setAuthToken(result.token);
  return result.user;
};

export const getMe = async () => apiRequest('/auth/me');

export const logout = async () => {
  setAuthToken(null);
};
