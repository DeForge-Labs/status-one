const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function apiRequest(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('status_one_token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('status_one_token');
      localStorage.removeItem('status_one_user');
      window.location.href = '/login';
    }
    throw new ApiError('Authentication required', 401);
  }

  if (response.status === 503) {
    const data = await response.json().catch(() => ({}));
    if (data.needsSetup) {
      throw new ApiError('Setup required', 503, data);
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.error || data.errors?.join(', ') || `Request failed (${response.status})`,
      response.status,
      data
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

// Setup — use raw fetch so it never triggers the auth interceptors
export const checkSetupStatus = async () => {
  try {
    const res = await fetch(`${API_BASE}/setup/status`);
    const data = await res.json();
    // Backend may return 503 or 200 with needsSetup flag
    return data;
  } catch {
    // Backend unreachable — default to no-setup-needed to avoid false redirect
    return { needsSetup: false };
  }
};
export const performSetup = (data) => apiRequest('/setup', { method: 'POST', body: JSON.stringify(data) });

// Auth
export const login = (data) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const logout = () => apiRequest('/auth/logout', { method: 'POST' });
export const getMe = () => apiRequest('/auth/me');
export const updateMe = (data) => apiRequest('/auth/me', { method: 'PUT', body: JSON.stringify(data) });
export const forgotPassword = (data) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) });
export const resetPassword = (data) => apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) });

// Users
export const getUsers = () => apiRequest('/users');
export const getUser = (id) => apiRequest(`/users/${id}`);
export const createUser = (data) => apiRequest('/users', { method: 'POST', body: JSON.stringify(data) });
export const updateUser = (id, data) => apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteUser = (id) => apiRequest(`/users/${id}`, { method: 'DELETE' });

// Monitors
export const getMonitors = () => apiRequest('/monitors');
export const getMonitor = (id) => apiRequest(`/monitors/${id}`);
export const createMonitor = (data) => apiRequest('/monitors', { method: 'POST', body: JSON.stringify(data) });
export const updateMonitor = (id, data) => apiRequest(`/monitors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteMonitor = (id) => apiRequest(`/monitors/${id}`, { method: 'DELETE' });
export const pauseMonitor = (id) => apiRequest(`/monitors/${id}/pause`, { method: 'POST' });
export const resumeMonitor = (id) => apiRequest(`/monitors/${id}/resume`, { method: 'POST' });
export const testMonitor = (id) => apiRequest(`/monitors/${id}/test`, { method: 'POST' });
export const getMonitorChecks = (id, page = 1, limit = 20) => apiRequest(`/monitors/${id}/checks?page=${page}&limit=${limit}`);
export const getMonitorUptime = (id) => apiRequest(`/monitors/${id}/uptime`);
export const getMonitorResponseTimes = (id, period = '24h') => apiRequest(`/monitors/${id}/response-times?period=${period}`);
export const addMonitorTag = (id, tagId) => apiRequest(`/monitors/${id}/tags`, { method: 'POST', body: JSON.stringify({ tag_id: tagId }) });
export const removeMonitorTag = (id, tagId) => apiRequest(`/monitors/${id}/tags/${tagId}`, { method: 'DELETE' });

// Tags
export const getTags = () => apiRequest('/tags');
export const createTag = (data) => apiRequest('/tags', { method: 'POST', body: JSON.stringify(data) });
export const updateTag = (id, data) => apiRequest(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTag = (id) => apiRequest(`/tags/${id}`, { method: 'DELETE' });

// Incidents
export const getIncidents = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiRequest(`/incidents${q ? '?' + q : ''}`);
};
export const getIncident = (id) => apiRequest(`/incidents/${id}`);
export const createIncident = (data) => apiRequest('/incidents', { method: 'POST', body: JSON.stringify(data) });
export const updateIncident = (id, data) => apiRequest(`/incidents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteIncident = (id) => apiRequest(`/incidents/${id}`, { method: 'DELETE' });
export const addIncidentUpdate = (id, data) => apiRequest(`/incidents/${id}/updates`, { method: 'POST', body: JSON.stringify(data) });
export const resolveIncident = (id, message) => apiRequest(`/incidents/${id}/resolve`, { method: 'POST', body: JSON.stringify({ message }) });

// Status Pages
export const getStatusPages = () => apiRequest('/status-pages');
export const getStatusPage = (id) => apiRequest(`/status-pages/${id}`);
export const createStatusPage = (data) => apiRequest('/status-pages', { method: 'POST', body: JSON.stringify(data) });
export const updateStatusPage = (id, data) => apiRequest(`/status-pages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteStatusPage = (id) => apiRequest(`/status-pages/${id}`, { method: 'DELETE' });
export const addStatusPageMonitor = (id, data) => apiRequest(`/status-pages/${id}/monitors`, { method: 'POST', body: JSON.stringify(data) });
export const removeStatusPageMonitor = (id, monitorId) => apiRequest(`/status-pages/${id}/monitors/${monitorId}`, { method: 'DELETE' });
export const updateStatusPageMonitorOrder = (id, monitorId, sortOrder) => apiRequest(`/status-pages/${id}/monitors/${monitorId}/order`, { method: 'PUT', body: JSON.stringify({ sort_order: sortOrder }) });
export const getStatusPageMessages = (id) => apiRequest(`/status-pages/${id}/messages`);
export const createStatusPageMessage = (id, data) => apiRequest(`/status-pages/${id}/messages`, { method: 'POST', body: JSON.stringify(data) });
export const updateStatusPageMessage = (id, messageId, data) => apiRequest(`/status-pages/${id}/messages/${messageId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteStatusPageMessage = (id, messageId) => apiRequest(`/status-pages/${id}/messages/${messageId}`, { method: 'DELETE' });

// Notifications
export const getNotificationChannels = () => apiRequest('/notifications');
export const getNotificationChannel = (id) => apiRequest(`/notifications/${id}`);
export const createNotificationChannel = (data) => apiRequest('/notifications', { method: 'POST', body: JSON.stringify(data) });
export const updateNotificationChannel = (id, data) => apiRequest(`/notifications/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteNotificationChannel = (id) => apiRequest(`/notifications/${id}`, { method: 'DELETE' });
export const testNotificationChannel = (id) => apiRequest(`/notifications/${id}/test`, { method: 'POST' });

// Maintenance
export const getMaintenanceWindows = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiRequest(`/maintenance${q ? '?' + q : ''}`);
};
export const getMaintenanceWindow = (id) => apiRequest(`/maintenance/${id}`);
export const createMaintenanceWindow = (data) => apiRequest('/maintenance', { method: 'POST', body: JSON.stringify(data) });
export const updateMaintenanceWindow = (id, data) => apiRequest(`/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteMaintenanceWindow = (id) => apiRequest(`/maintenance/${id}`, { method: 'DELETE' });

// Analytics
export const getAnalyticsOverview = () => apiRequest('/analytics/overview');
export const getAnalyticsSummary = () => apiRequest('/analytics/summary');
export const getAnalyticsResponseTimes = (id, hours = 24) => apiRequest(`/analytics/monitors/${id}/response-times?hours=${hours}`);
export const getAnalyticsAvailability = (id, days = 30) => apiRequest(`/analytics/monitors/${id}/availability?days=${days}`);
export const getAnalyticsDailyStats = (id, days = 30) => apiRequest(`/analytics/monitors/${id}/daily-stats?days=${days}`);

// Settings
export const getSettings = () => apiRequest('/settings');
export const updateSettings = (settings) => apiRequest('/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
export const getSetting = (key) => apiRequest(`/settings/${key}`);

// API Keys
export const getApiKeys = () => apiRequest('/api-keys');
export const createApiKey = (data) => apiRequest('/api-keys', { method: 'POST', body: JSON.stringify(data) });
export const deleteApiKey = (id) => apiRequest(`/api-keys/${id}`, { method: 'DELETE' });

// System
export const getSystemHealth = () => apiRequest('/system/health');
export const getSystemInfo = () => apiRequest('/system/info');
export const factoryReset = (confirm) => apiRequest('/system/factory-reset', { method: 'POST', body: JSON.stringify({ confirm }) });
export const createBackup = () => apiRequest('/system/backup', { method: 'POST' });
export const purgeChecks = (days) => apiRequest('/system/purge-checks', { method: 'POST', body: JSON.stringify({ days }) });

// Profile
export const updateProfile = (data) => apiRequest('/auth/me', { method: 'PUT', body: JSON.stringify(data) });
export const changePassword = (data) => apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify(data) });

// Status Page helpers (aliases)
export const getStatusPageMonitors = (id) => apiRequest(`/status-pages/${id}/monitors`);
export const addMonitorToStatusPage = (id, monitorId, sortOrder) => apiRequest(`/status-pages/${id}/monitors`, { method: 'POST', body: JSON.stringify({ monitor_id: monitorId, sort_order: sortOrder }) });
export const removeMonitorFromStatusPage = (id, monitorId) => apiRequest(`/status-pages/${id}/monitors/${monitorId}`, { method: 'DELETE' });
export const addStatusPageMessage = (id, data) => apiRequest(`/status-pages/${id}/messages`, { method: 'POST', body: JSON.stringify(data) });

// Database
export const getDatabaseBackup = async () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('status_one_token') : null;
  const res = await fetch(`${API_BASE}/system/backup`, {
    method: 'POST',
    headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new ApiError('Backup failed', res.status);
  return res.blob();
};
export const purgeOldData = (days) => apiRequest('/system/purge-checks', { method: 'POST', body: JSON.stringify({ days }) });

// Public
const publicFetch = (path) => fetch(`${API_BASE}${path}`).then(r => r.ok ? r.json() : Promise.reject(new Error('Not found')));
export const getPublicStatus = (slug) => publicFetch(`/public/status/${slug}`);
export const getPublicStatusPage = (slug) => publicFetch(`/public/status/${slug}`);
export const getPublicStatusPageMonitors = (slug) => publicFetch(`/public/status/${slug}/monitors`);
export const getPublicStatusPageIncidents = (slug) => publicFetch(`/public/status/${slug}/incidents`);
export const getPublicStatusPageMessages = (slug) => publicFetch(`/public/status/${slug}/messages`);
export const getPublicStatusHistory = (slug, days = 90) => publicFetch(`/public/status/${slug}/history?days=${days}`);
export const getPublicStatusIncidents = (slug, page = 1, limit = 20) => publicFetch(`/public/status/${slug}/incidents?page=${page}&limit=${limit}`);

export { ApiError };
export default apiRequest;
