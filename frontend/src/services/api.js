// ============================================================================
// API Service — Axios client for DPI Backend
// ============================================================================

import axios from 'axios'

const api = axios.create({
  baseURL: 'https://dpi-tqlz.onrender.com',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// ---- Stats & summaries ----
export const getStats = () => api.get('/stats').then((r) => r.data)

// ---- Traffic logs ----
export const getTraffic = (params = {}) =>
  api.get('/traffic', { params }).then((r) => r.data)

// ---- Blocked events ----
export const getBlockedEvents = (params = {}) =>
  api.get('/blocked', { params }).then((r) => r.data)

// ---- Security alerts ----
export const getAlerts = (params = {}) =>
  api.get('/alerts', { params }).then((r) => r.data)

// ---- Analytics ----
export const getTopDomains = (params = {}) =>
  api.get('/analytics/top-domains', { params }).then((r) => r.data)

export const getTopApplications = (params = {}) =>
  api.get('/analytics/top-applications', { params }).then((r) => r.data)

export const getTrafficVolume = (params = {}) =>
  api.get('/analytics/traffic-volume', { params }).then((r) => r.data)

export const getBlockedAnalytics = (params = {}) =>
  api.get('/analytics/blocked-events', { params }).then((r) => r.data)

export default api
