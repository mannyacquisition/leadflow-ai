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
    const isFormData = options.isFormData === true;
    const headers = isFormData ? {} : {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const { isFormData: _drop, ...fetchOptions } = options;
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
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

  // AI Hub
  hub = {
    // Offers
    listOffers: () => this.request('/hub/offers'),
    createOffer: (data) => this.request('/hub/offers', { method: 'POST', body: JSON.stringify(data) }),
    updateOffer: (id, data) => this.request(`/hub/offers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteOffer: (id) => this.request(`/hub/offers/${id}`, { method: 'DELETE' }),
    scrapeOffer: (url) => this.request('/hub/offers/scrape', { method: 'POST', body: JSON.stringify({ url }) }),

    // Playbooks
    listPlaybooks: () => this.request('/hub/playbooks'),
    createPlaybook: (data) => this.request('/hub/playbooks', { method: 'POST', body: JSON.stringify(data) }),
    updatePlaybook: (id, data) => this.request(`/hub/playbooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePlaybook: (id) => this.request(`/hub/playbooks/${id}`, { method: 'DELETE' }),

    // Battlecards
    listBattlecards: () => this.request('/hub/battlecards'),
    createBattlecard: (data) => this.request('/hub/battlecards', { method: 'POST', body: JSON.stringify(data) }),
    updateBattlecard: (id, data) => this.request(`/hub/battlecards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteBattlecard: (id) => this.request(`/hub/battlecards/${id}`, { method: 'DELETE' }),

    // Guardrails
    getGuardrails: () => this.request('/hub/guardrails'),
    saveGuardrails: (data) => this.request('/hub/guardrails', { method: 'POST', body: JSON.stringify(data) }),

    // Tone
    getTone: () => this.request('/hub/tone'),
    setTone: (tone_id) => this.request('/hub/tone', { method: 'POST', body: JSON.stringify({ tone_id }) }),

    // User-scoped Knowledge Base
    listKbFiles: () => this.request('/hub/knowledge/files'),
    uploadKbFile: (formData) => this.request('/hub/knowledge/upload', { method: 'POST', body: formData, isFormData: true }),
    deleteKbFile: (id) => this.request(`/hub/knowledge/files/${id}`, { method: 'DELETE' }),
  };
}

export const api = new APIClient();
export default api;
