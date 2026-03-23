/**
 * LeadFlow AI API Client
 * Replaces Base44 SDK with direct FastAPI backend calls
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

class APIClient {
  constructor() {
    this.token = localStorage.getItem('leadflow_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('leadflow_token', token);
    } else {
      localStorage.removeItem('leadflow_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for session auth
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  auth = {
    register: async (data) => {
      const result = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (result.token) {
        this.setToken(result.token);
      }
      return result;
    },
    
    login: async (data) => {
      const result = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (result.token) {
        this.setToken(result.token);
      }
      return result;
    },
    
    googleCallback: async (sessionId) => {
      const result = await this.request('/auth/google/callback', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (result.token) {
        this.setToken(result.token);
      }
      return result;
    },
    
    me: () => this.request('/auth/me'),
    
    logout: async () => {
      await this.request('/auth/logout', { method: 'POST' }).catch(() => {});
      this.setToken(null);
    },
    
    redirectToLogin: (returnUrl) => {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = window.location.origin + '/Dashboard';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    },
  };

  // Signal agents endpoints
  signals = {
    list: () => this.request('/signals'),
    
    create: (data) => this.request('/signals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
    update: (id, data) => this.request(`/signals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    
    delete: (id) => this.request(`/signals/${id}`, {
      method: 'DELETE',
    }),
    
    updateStatus: (id, status) => this.request(`/signals/${id}/status?status=${status}`, {
      method: 'PATCH',
    }),
  };

  // Leads endpoints
  leads = {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/leads${query ? `?${query}` : ''}`);
    },
    
    stats: () => this.request('/leads/stats'),

    create: (data) => this.request('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    update: (id, data) => this.request(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  };

  // Drafts endpoints
  drafts = {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/drafts${query ? `?${query}` : ''}`);
    },
    
    get: (id) => this.request(`/drafts/${id}`),
    
    update: (id, data) => this.request(`/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    
    delete: (id) => this.request(`/drafts/${id}`, {
      method: 'DELETE',
    }),
  };

  // User settings
  user = {
    updateApiKeys: (data) => this.request('/user/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
    getApiKeysStatus: () => this.request('/user/api-keys/status'),

    getSettings: () => this.request('/user/settings'),

    updateSettings: (data) => this.request('/user/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  };

  // AI Chat / Insights
  ai = {
    chat: (message, history = []) => this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),

    getInsights: () => this.request('/ai/insights'),

    generateInsights: () => this.request('/ai/insights/generate', { method: 'POST' }),
  };

  // Health check
  health = () => this.request('/health');
}

export const api = new APIClient();
export default api;
