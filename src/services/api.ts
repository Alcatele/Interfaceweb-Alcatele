import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  timeout: 12000,
});

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação.',
) {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const message = error.response?.data?.message;

  if (Array.isArray(message)) {
    return message.join(' ');
  }

  return typeof message === 'string' ? message : fallback;
}

export default api;
