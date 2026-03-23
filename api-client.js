// ================================================================
// Torch ATL — Frontend API Client
// Drop into Operations Suite or Member Portal to replace localStorage
// ================================================================

const TorchBackend = (() => {
  const BASE_URL = window.TORCH_API_URL || 'http://localhost:3001/api';
  const TOKEN_KEY = 'torch_api_token';
  const USER_KEY = 'torch_api_user';

  // --- Token Management ---
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function isAuthenticated() {
    return !!getToken();
  }

  // --- HTTP Helpers ---
  async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('torch:auth:expired'));
      throw new Error('Session expired — please log in again');
    }

    const data = await response.json();

    if (!response.ok) {
      const err = new Error(data.error || `Request failed (${response.status})`);
      err.status = response.status;
      err.details = data.details;
      throw err;
    }

    return data;
  }

  function get(path) {
    return request(path);
  }

  function post(path, body) {
    return request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  function put(path, body) {
    return request(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  function patch(path, body) {
    return request(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  function del(path) {
    return request(path, { method: 'DELETE' });
  }

  // ================================================================
  // AUTH
  // ================================================================
  const auth = {
    async login(email, accessCode, portal) {
      const data = await post('/auth/login', { email, accessCode, portal });
      setToken(data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new CustomEvent('torch:auth:login', { detail: data.user }));
      return data;
    },

    async me() {
      const data = await get('/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      return data;
    },

    async refresh() {
      const data = await post('/auth/refresh');
      setToken(data.token);
      return data;
    },

    logout() {
      clearToken();
      window.dispatchEvent(new CustomEvent('torch:auth:logout'));
    },

    isAuthenticated,
    getStoredUser,
    getToken
  };

  // ================================================================
  // MEMBERS
  // ================================================================
  const members = {
    async getProfile() {
      return get('/members/profile');
    },

    async updateProfile(fields) {
      return put('/members/profile', fields);
    },

    async getHours() {
      return get('/members/hours');
    },

    async getHoursHistory() {
      return get('/members/hours/history');
    }
  };

  // ================================================================
  // BOOKINGS
  // ================================================================
  const bookings = {
    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return get(`/bookings${query ? '?' + query : ''}`);
    },

    async getAvailability(date) {
      return get(`/bookings/availability?date=${date}`);
    },

    async create(booking) {
      return post('/bookings', booking);
    },

    async cancel(bookingId) {
      return put(`/bookings/${bookingId}/cancel`);
    },

    async complete(bookingId, actualHours) {
      return put(`/bookings/${bookingId}/complete`, { actualHours });
    },

    async updateStatus(bookingId, status, reason) {
      return patch(`/bookings/${bookingId}/status`, { status, reason });
    }
  };

  // ================================================================
  // GUESTS
  // ================================================================
  const guests = {
    async list(bookingId) {
      const query = bookingId ? `?bookingId=${bookingId}` : '';
      return get(`/guests${query}`);
    },

    async register(bookingId, guest) {
      return post('/guests', { bookingId, ...guest });
    },

    async checkin(guestId) {
      return put(`/guests/${guestId}/checkin`);
    },

    async remove(guestId) {
      return del(`/guests/${guestId}`);
    }
  };

  // ================================================================
  // ENGINEERS
  // ================================================================
  const engineers = {
    async list() {
      return get('/engineers');
    },

    async getProfile(engineerId) {
      return get(`/engineers/${engineerId}`);
    },

    async getSchedule(engineerId, params = {}) {
      const query = new URLSearchParams(params).toString();
      return get(`/engineers/${engineerId}/schedule${query ? '?' + query : ''}`);
    },

    async getStats(engineerId) {
      return get(`/engineers/${engineerId}/stats`);
    }
  };

  // ================================================================
  // BILLING
  // ================================================================
  const billing = {
    async getSubscription() {
      return get('/billing/subscription');
    },

    async getPayments(limit = 20) {
      return get(`/billing/payments?limit=${limit}`);
    },

    async updatePaymentMethod(sourceId, last4, brand) {
      return post('/billing/payment-method', { sourceId, last4, brand });
    },

    async getInvoices() {
      return get('/billing/invoices');
    }
  };

  // ================================================================
  // ADMIN
  // ================================================================
  const admin = {
    async getDashboard() {
      return get('/admin/dashboard');
    },

    async listMembers(params = {}) {
      const query = new URLSearchParams(params).toString();
      return get(`/admin/members${query ? '?' + query : ''}`);
    },

    async createMember(member) {
      return post('/admin/members', member);
    },

    async updateMember(memberId, fields) {
      return put(`/admin/members/${memberId}`, fields);
    },

    async suspendMember(memberId) {
      return put(`/admin/members/${memberId}/suspend`);
    },

    async resetAccessCode(memberId, accessCode) {
      return put(`/admin/members/${memberId}/reset-code`, { accessCode });
    },

    async getAnnouncements() {
      return get('/admin/announcements');
    },

    async createAnnouncement(announcement) {
      return post('/admin/announcements', announcement);
    },

    async deleteAnnouncement(id) {
      return del(`/admin/announcements/${id}`);
    },

    async getRevenueReport() {
      return get('/admin/reports/revenue');
    },

    async getUtilizationReport() {
      return get('/admin/reports/utilization');
    },

    async getActivity(limit = 50) {
      return get(`/admin/activity?limit=${limit}`);
    },

    async runMonthlyCycle() {
      return post('/billing/monthly-cycle');
    },

    // --- Admin Engineer CRM ---
    async listEngineers(params = {}) {
      const query = new URLSearchParams(params).toString();
      return get(`/admin/engineers${query ? '?' + query : ''}`);
    },

    async getEngineer(engineerId) {
      return get(`/admin/engineers/${engineerId}`);
    },

    async createEngineer(data) {
      return post('/admin/engineers', data);
    },

    async updateEngineer(engineerId, fields) {
      return put(`/admin/engineers/${engineerId}`, fields);
    },

    async deleteEngineer(engineerId) {
      return del(`/admin/engineers/${engineerId}`);
    },

    async addEngineerNote(engineerId, text) {
      return post(`/admin/engineers/${engineerId}/notes`, { text });
    },

    async operationsCalendar(month) {
      return get(`/admin/operations-calendar?month=${month}`);
    }
  };

  // ================================================================
  // SESSION REPORTS
  // ================================================================
  const sessionReports = {
    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return get(`/session-reports${query ? '?' + query : ''}`);
    },

    async getReport(reportId) {
      return get(`/session-reports/${reportId}`);
    },

    async create(data) {
      return post('/session-reports', data);
    },

    async update(reportId, fields) {
      return put(`/session-reports/${reportId}`, fields);
    },

    async submit(reportId) {
      return put(`/session-reports/${reportId}/submit`);
    },

    async review(reportId) {
      return put(`/session-reports/${reportId}/review`);
    }
  };

  // ================================================================
  // ESTATE REQUESTS
  // ================================================================
  const estateRequests = {
    async submit(data) {
      return request('/estate-requests', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },

    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return get(`/estate-requests${query ? '?' + query : ''}`);
    },

    async update(id, data) {
      return patch(`/estate-requests/${id}`, data);
    }
  };

  // ================================================================
  // STUDIO TASKS
  // ================================================================
  const studioTasks = {
    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return get(`/studio-tasks${query ? '?' + query : ''}`);
    },

    async create(data) {
      return post('/studio-tasks', data);
    },

    async update(id, data) {
      return patch(`/studio-tasks/${id}`, data);
    },

    async remove(id) {
      return del(`/studio-tasks/${id}`);
    }
  };

  // ================================================================
  // HEALTH
  // ================================================================
  async function health() {
    return get('/health');
  }

  // --- Expose Public API ---
  return {
    auth,
    members,
    bookings,
    guests,
    engineers,
    billing,
    admin,
    sessionReports,
    estateRequests,
    studioTasks,
    health,
    // Expose base URL for debugging
    get BASE_URL() { return BASE_URL; }
  };
})();

// Make available globally (named TorchBackend to avoid collision with existing TorchAPI in api.js)
if (typeof window !== 'undefined') {
  window.TorchBackend = TorchBackend;
}
