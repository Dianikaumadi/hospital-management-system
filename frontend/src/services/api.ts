import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  // An invalid/expired token ends the session. A failed login attempt is also a 401 but must not redirect.
  const isLoginAttempt = error.config?.url?.includes('/auth/login');
  if (error.response?.status === 401 && !isLoginAttempt) {
    localStorage.removeItem('hms_token');
    localStorage.removeItem('hms_user');
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }
  return Promise.reject(error);
});
