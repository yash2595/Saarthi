import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { serviceErrorMessage } from '@/lib/service-results';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Request Interceptor: Attach JWT Token if available & handle Content-Type for FormData
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Normalize Backend Error Messages & Handle Auth Expiry
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ status?: string; detail?: string | Array<{ msg?: string }>; message?: string }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
    }

    let errorMessage = 'An unexpected error occurred. Please try again.';

    if (error.response?.data) {
      const data = error.response.data;
      errorMessage = serviceErrorMessage(data) || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }

    const apiError = new Error(errorMessage);
    (apiError as any).status = error.response?.status;
    (apiError as any).statusCode = error.response?.status;
    (apiError as any).data = error.response?.data;
    (apiError as any).response = error.response;

    return Promise.reject(apiError);
  }
);

export default apiClient;
