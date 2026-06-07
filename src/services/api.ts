import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 12000,
});

api.interceptors.request.use((config) => {
  config.headers['X-Tenant-ID'] = 'alcatele-cloud';
  return config;
});

export default api;
