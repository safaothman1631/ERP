import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const vendorApi = axios.create({
  baseURL: BASE_URL,
});

// Add authorization header if vendor JWT exists
vendorApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('vendor_jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default vendorApi;
