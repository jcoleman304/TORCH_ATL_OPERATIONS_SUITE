// TORCH ATL Operations Suite - Application Logic

// XSS Prevention — escape user data before rendering in innerHTML
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// AUTO-REFRESH POLLING MANAGER
// ============================================

const TorchPolling = {
    intervals: {},
    running: false,

    config: {
        dashboard: 30000,   // 30s
        activity: 15000,    // 15s
        bookings: 60000,    // 60s
        health: 30000       // 30s
    },

    start() {
        if (this.running) return;
        this.running = true;
        console.log('[Polling] Starting auto-refresh...');

        // Health check
        this.intervals.health = setInterval(() => this.checkHealth(), this.config.health);
        this.checkHealth(); // Run immediately

        // Dashboard refresh
        this.intervals.dashboard = setInterval(async () => {
            if (currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'manager') {
                try {
                    await TorchAPI.refreshFromBackend();
                    updateDashboard();
                    this.updateTimestamp();
                } catch (e) {
                    console.warn('[Polling] Dashboard refresh failed:', e.message);
                }
            }
        }, this.config.dashboard);

        // Activity feed refresh
        this.intervals.activity = setInterval(async () => {
            if (currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'manager') {
                try {
                    await TorchAPI.refreshActivityFeed();
                    renderActivityFeed();
                    this.updateTimestamp();
                } catch (e) {
                    console.warn('[Polling] Activity refresh failed:', e.message);
                }
            }
        }, this.config.activity);

        // Bookings refresh
        this.intervals.bookings = setInterval(async () => {
            try {
                await TorchAPI.refreshBookings();
                if (currentAdminUser?.role === 'admin' || currentAdminUser?.role === 'manager') {
                    renderBookingsTable();
                    renderUpcomingSessions();
                }
                this.updateTimestamp();
            } catch (e) {
                console.warn('[Polling] Bookings refresh failed:', e.message);
            }
        }, this.config.bookings);
    },

    stop() {
        if (!this.running) return;
        this.running = false;
        Object.keys(this.intervals).forEach(key => {
            clearInterval(this.intervals[key]);
            delete this.intervals[key];
        });
        console.log('[Polling] Stopped auto-refresh');
    },

    async checkHealth() {
        const statusEl = document.getElementById('connection-status');
        const dotEl = document.getElementById('connection-dot');
        const textEl = document.getElementById('connection-text');
        if (!statusEl) return;

        try {
            if (typeof TorchBackend !== 'undefined') {
                await TorchBackend.health();
                statusEl.className = 'connection-status connected';
                textEl.textContent = 'Connected';
                TorchAPI.backendAvailable = true;
            }
        } catch (e) {
            statusEl.className = 'connection-status disconnected';
            textEl.textContent = 'Disconnected';
            TorchAPI.backendAvailable = false;
        }
        this.updateTimestamp();
    },

    updateTimestamp() {
        const el = document.getElementById('last-refreshed');
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    if (currentAdminUser) {
        showApp();
    } else {
        showLogin();
    }
});

// ============================================
// AUTHENTICATION
// ============================================

function showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-container').style.display = 'none';
}

async function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-container').style.display = 'flex';

    // Update UI based on role
    applyRoleBasedUI();

    // Initialize app
    initNavigation();
    initCountdown();

    // Refresh data from backend before rendering
    await TorchAPI.refreshFromBackend();

    const role = currentAdminUser.role;
    if (role === 'admin' || role === 'manager') {
        updateDashboard();
        renderMembersTable();
        renderBookingsTable();
        renderCalendar();
        renderSMSHistory();
        renderEmailHistory();
        populateMemberDropdowns();
        initSMSCharCount();
        renderEngineersTable();
        renderSessionReportsReview();
        // Initialize operations tab
        initOperationsCalendar();
    } else {
        // Engineer view
        renderEngineerCalendar();
        renderEngineerUpcomingSessions();
        renderPendingRequests();
        renderMyReports();
    }

    // Update user info in sidebar
    document.getElementById('current-user-name').textContent = currentAdminUser.name;
    const roleLabels = { admin: 'Administrator', manager: 'Manager', engineer: 'Engineer' };
    document.getElementById('current-user-role').textContent = roleLabels[role] || role;

    // Start auto-refresh polling
    TorchPolling.start();
}

async function handleAdminLogin(event) {
    event.preventDefault();

    const email = document.getElementById('admin-email').value;
    const code = document.getElementById('admin-code').value;

    try {
        const result = await TorchAPI.login(email, code);

        if (result.success) {
            showToast(`Welcome, ${result.user.name}!`, 'success');
            showApp();
        } else {
            showToast(result.errors[0], 'error');
        }
    } catch (err) {
        showToast(err.message || 'Login failed', 'error');
    }
}

function handleLogout() {
    TorchPolling.stop();
    TorchAPI.logout();
    showLogin();
    showToast('Logged out successfully', 'info');
}

function applyRoleBasedUI() {
    const role = currentAdminUser.role;
    const isAdminOrManager = role === 'admin' || role === 'manager';

    // Show/hide elements based on role — manager sees everything admin sees
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdminOrManager ? '' : 'none';
    });

    document.querySelectorAll('.engineer-only').forEach(el => {
        el.style.display = isAdminOrManager ? 'none' : '';
    });

    // Set default active tab based on role
    if (isAdminOrManager) {
        switchTab('dashboard');
        document.querySelector('.nav-links li[data-tab="dashboard"]').classList.add('active');
    } else {
        switchTab('my-sessions');
        document.querySelector('.nav-links li[data-tab="my-sessions"]').classList.add('active');
    }
}

// Navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.dataset.tab;
            switchTab(tabId);
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    // Load operations data when switching to operations tab
    if (tabId === 'operations') {
        loadOperationsCalendar();
    } else if (tabId === 'clients') {
        renderClientsTable();
    } else if (tabId === 'inquiries') {
        renderInquiryPipeline();
    } else if (tabId === 'member-portal') {
        renderTdpMembers();
    } else if (tabId === 'invoices') {
        loadInvoices();
    } else if (tabId === 'equipment') {
        loadEquipment();
    } else if (tabId === 'pipeline') {
        loadCampOutreach();
    } else if (tabId === 'milestones') {
        loadMilestones();
    } else if (tabId === 'dashboard') {
        updateDashboardV2();
    }
}

// Countdown Timer
function initCountdown() {
    function updateCountdown() {
        const now = new Date();
        const diff = LAUNCH_DATE - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        document.getElementById('countdown').textContent = `${days} days until launch`;
    }
    updateCountdown();
    setInterval(updateCountdown, 60000);
}

// Dashboard
async function updateDashboard() {
    // Try backend-first dashboard
    if (typeof TorchBackend !== 'undefined' && TorchBackend.auth.isAuthenticated()) {
        try {
            const dashboard = await TorchBackend.admin.getDashboard();
            renderDashboardFromBackend(dashboard);
            return;
        } catch (e) {
            console.warn('[Dashboard] Backend fetch failed, using local data:', e.message);
        }
    }
    // Fallback to local data
    renderDashboardFromLocal();
}

function renderDashboardFromBackend(dashboard) {
    const m = dashboard.metrics;
    const el = (id) => document.getElementById(id);
    if (el('total-members')) el('total-members').textContent = m.activeMembers;
    if (el('total-mrr')) el('total-mrr').textContent = '$' + m.mrr.toLocaleString();
    if (el('weekly-sessions')) el('weekly-sessions').textContent = m.monthlyBookings;

    const maxMonthlyHours = 30 * 16;
    const utilization = maxMonthlyHours > 0 ? Math.round((m.monthlyHours / maxMonthlyHours) * 100) : 0;
    if (el('utilization')) el('utilization').textContent = utilization + '%';

    // Tier bars from backend breakdown
    const tierCounts = { Residency: 0, Member: 0, Session: 0 };
    (dashboard.tierBreakdown || []).forEach(t => { tierCounts[t.tier] = parseInt(t.count); });

    if (el('bar-residency')) el('bar-residency').style.width = (tierCounts.Residency / TIERS.Residency.cap * 100) + '%';
    if (el('bar-member')) el('bar-member').style.width = (tierCounts.Member / TIERS.Member.cap * 100) + '%';
    if (el('bar-session')) el('bar-session').style.width = (tierCounts.Session / TIERS.Session.cap * 100) + '%';

    if (el('count-residency')) el('count-residency').textContent = `${tierCounts.Residency}/${TIERS.Residency.cap}`;
    if (el('count-member')) el('count-member').textContent = `${tierCounts.Member}/${TIERS.Member.cap}`;
    if (el('count-session')) el('count-session').textContent = `${tierCounts.Session}/${TIERS.Session.cap}`;

    // Upcoming sessions from local cache (already refreshed)
    renderUpcomingSessions();

    // Activity feed from backend
    renderActivityFeedFromBackend(dashboard.recentActivity || []);

    // Also update new dashboard
    updateDashboardV2();
}

function renderDashboardFromLocal() {
    const el = (id) => document.getElementById(id);
    const activeMembers = members.filter(m => m.status === 'Active');
    const totalMRR = activeMembers.reduce((sum, m) => sum + m.monthlyRate, 0);
    const weeklyBookings = bookings.filter(b => {
        const bookingDate = new Date(b.date);
        const today = new Date();
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return bookingDate >= today && bookingDate <= weekFromNow;
    });

    if (el('total-members')) el('total-members').textContent = activeMembers.length;
    if (el('total-mrr')) el('total-mrr').textContent = '$' + totalMRR.toLocaleString();
    if (el('weekly-sessions')) el('weekly-sessions').textContent = weeklyBookings.length;

    const totalHoursBooked = bookings.reduce((sum, b) => sum + b.hours, 0);
    const maxMonthlyHours = 30 * 16;
    const utilization = Math.round((totalHoursBooked / maxMonthlyHours) * 100);
    if (el('utilization')) el('utilization').textContent = utilization + '%';

    const tierCounts = { Residency: 0, Member: 0, Session: 0 };
    activeMembers.forEach(m => tierCounts[m.tier]++);

    if (el('bar-residency')) el('bar-residency').style.width = (tierCounts.Residency / TIERS.Residency.cap * 100) + '%';
    if (el('bar-member')) el('bar-member').style.width = (tierCounts.Member / TIERS.Member.cap * 100) + '%';
    if (el('bar-session')) el('bar-session').style.width = (tierCounts.Session / TIERS.Session.cap * 100) + '%';

    if (el('count-residency')) el('count-residency').textContent = `${tierCounts.Residency}/${TIERS.Residency.cap}`;
    if (el('count-member')) el('count-member').textContent = `${tierCounts.Member}/${TIERS.Member.cap}`;
    if (el('count-session')) el('count-session').textContent = `${tierCounts.Session}/${TIERS.Session.cap}`;

    renderUpcomingSessions();
    renderActivityFeed();

    // Also update new dashboard
    updateDashboardV2();
}

function renderUpcomingSessions() {
    const upcomingSessions = bookings
        .filter(b => new Date(b.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    const sessionsHtml = upcomingSessions.map(b => `
        <div class="session-item">
            <div>
                <div class="member-name">${escapeHTML(b.memberName)}</div>
                <div class="session-time">${formatDate(b.date)} • ${formatTime(b.startTime)} - ${formatTime(b.endTime)}</div>
            </div>
            <span class="tier-badge ${members.find(m => m.id == b.memberId)?.tier?.toLowerCase() || ''}">${escapeHTML(b.type)}</span>
        </div>
    `).join('');
    document.getElementById('upcoming-sessions').innerHTML = sessionsHtml || '<p class="text-muted">No upcoming sessions</p>';
}

function renderActivityFeedFromBackend(activities) {
    const activityHtml = activities.map(a => {
        const age = Date.now() - new Date(a.created_at).getTime();
        const mins = Math.floor(age / 60000);
        let timeStr;
        if (mins < 1) timeStr = 'Just now';
        else if (mins < 60) timeStr = `${mins} min ago`;
        else if (mins < 1440) timeStr = `${Math.floor(mins / 60)} hours ago`;
        else timeStr = `${Math.floor(mins / 1440)} days ago`;

        const text = `${(a.action || '').replace(/_/g, ' ')}: ${a.entity_type || ''} ${a.entity_id ? a.entity_id.slice(0, 8) : ''}`;
        return `
            <div class="activity-item">
                <span>${escapeHTML(text)}</span>
                <span class="time">${escapeHTML(timeStr)}</span>
            </div>
        `;
    }).join('');
    document.getElementById('activity-feed').innerHTML = activityHtml || '<p class="text-muted">No recent activity</p>';
}

function renderActivityFeed() {
    const activityHtml = activityFeed.map(a => `
        <div class="activity-item">
            <span>${escapeHTML(a.text)}</span>
            <span class="time">${escapeHTML(a.time)}</span>
        </div>
    `).join('');
    document.getElementById('activity-feed').innerHTML = activityHtml || '<p class="text-muted">No recent activity</p>';
}

// Members Table
function renderMembersTable() {
    const tbody = document.getElementById('members-tbody');
    tbody.innerHTML = members.map(m => `
        <tr data-tier="${escapeHTML(m.tier)}" data-status="${escapeHTML(m.status)}" data-name="${escapeHTML(m.name?.toLowerCase())}">
            <td>
                <div style="display: flex; flex-direction: column;">
                    <strong>${escapeHTML(m.name)}</strong>
                    <small style="color: var(--text-secondary)">${escapeHTML(m.email)}</small>
                </div>
            </td>
            <td><span class="tier-badge ${m.tier.toLowerCase()}">${m.tier}</span></td>
            <td><span class="status-badge ${m.status.toLowerCase()}">${m.status}</span></td>
            <td>${m.hoursUsed}/${m.hoursTotal} hrs</td>
            <td>$${m.monthlyRate.toLocaleString()}${m.founding ? ' <small>(founding)</small>' : ''}</td>
            <td>${formatDate(m.startDate)}</td>
            <td>
                <button class="action-btn" onclick="viewMember('${m.id}')">View</button>
                <button class="action-btn" onclick="editMember('${m.id}')">Edit</button>
            </td>
        </tr>
    `).join('');
}

function filterMembers() {
    const search = document.getElementById('member-search').value.toLowerCase();
    const tierFilter = document.getElementById('tier-filter').value;
    const statusFilter = document.getElementById('status-filter').value;

    const rows = document.querySelectorAll('#members-tbody tr');
    rows.forEach(row => {
        const name = row.dataset.name;
        const tier = row.dataset.tier;
        const status = row.dataset.status;

        const matchesSearch = name.includes(search);
        const matchesTier = tierFilter === 'all' || tier === tierFilter;
        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        row.style.display = matchesSearch && matchesTier && matchesStatus ? '' : 'none';
    });
}

// Add Member
async function addMember(event) {
    event.preventDefault();

    const tier = document.getElementById('new-member-tier').value;
    const isFoundng = document.getElementById('new-member-founding').value === 'yes';

    const memberData = {
        name: document.getElementById('new-member-name').value,
        email: document.getElementById('new-member-email').value,
        phone: document.getElementById('new-member-phone').value,
        tier: tier,
        founding: isFoundng,
        company: document.getElementById('new-member-company').value,
        notes: document.getElementById('new-member-notes').value
    };

    const result = await TorchAPI.createMember(memberData);

    if (result.success) {
        renderMembersTable();
        updateDashboard();
        populateMemberDropdowns();
        closeModal('add-member-modal');
        showToast('Member added successfully', 'success');
    } else {
        showToast(result.errors[0], 'error');
    }
}

function viewMember(id) {
    const member = members.find(m => m.id == id);
    if (member) showToast(`Viewing ${member.name}`, 'info');
}

function editMember(id) {
    const member = members.find(m => m.id == id);
    if (member) showToast(`Editing ${member.name}`, 'info');
}

// Bookings
function renderBookingsTable() {
    const tbody = document.getElementById('bookings-tbody');
    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>${formatDate(b.date)}</td>
            <td>${formatTime(b.startTime)} - ${formatTime(b.endTime)}</td>
            <td>${escapeHTML(b.memberName)}</td>
            <td>${b.hours} hrs</td>
            <td>${b.guests}</td>
            <td><span class="status-badge active">${escapeHTML(b.status)}</span></td>
            <td>
                <button class="action-btn" onclick="viewBooking('${b.id}')">View</button>
                <button class="action-btn" onclick="cancelBooking('${b.id}')">Cancel</button>
            </td>
        </tr>
    `).join('');
}

function switchBookingView(view) {
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (view === 'calendar') {
        document.getElementById('calendar-view').style.display = 'block';
        document.getElementById('list-view').style.display = 'none';
    } else {
        document.getElementById('calendar-view').style.display = 'none';
        document.getElementById('list-view').style.display = 'block';
    }
}

// Calendar
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('calendar-month').textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    let calendarHtml = '';

    // Previous month days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
        calendarHtml += `<div class="calendar-day other-month">${prevMonthLastDay - i}</div>`;
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasBooking = bookings.some(b => b.date === dateStr);
        const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (hasBooking) classes += ' has-booking';

        calendarHtml += `<div class="${classes}" onclick="selectDate('${dateStr}')">${day}</div>`;
    }

    // Next month days
    const remainingDays = 42 - (startingDay + totalDays);
    for (let day = 1; day <= remainingDays; day++) {
        calendarHtml += `<div class="calendar-day other-month">${day}</div>`;
    }

    document.getElementById('calendar-days').innerHTML = calendarHtml;
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

function selectDate(dateStr) {
    // Set the first session date input in the new multi-date form
    const firstDateInput = document.querySelector('#session-dates-container .session-date-input');
    if (firstDateInput) {
        firstDateInput.value = dateStr;
    }
    openModal('add-booking-modal');
}

async function addBooking(event) {
    event.preventDefault();

    const memberId = document.getElementById('booking-member').value;
    const member = members.find(m => m.id == memberId);
    if (!member) { showToast('Please select a member', 'error'); return; }

    const type = document.getElementById('booking-type').value;
    const room = document.getElementById('booking-room').value || undefined;
    const guests = parseInt(document.getElementById('booking-guests').value) || 0;
    const guestNamesRaw = document.getElementById('booking-guest-names').value;
    const guestNames = guestNamesRaw ? guestNamesRaw.split(',').map(n => n.trim()).filter(Boolean) : [];

    // Collect all session date rows
    const dateRows = document.querySelectorAll('#session-dates-container .session-date-row');
    const sessions = [];

    dateRows.forEach(row => {
        const dateInput = row.querySelector('.session-date-input');
        const activeBlock = row.querySelector('.time-block.active');
        if (!dateInput || !dateInput.value) return;

        const block = activeBlock ? activeBlock.dataset.block : 'day';
        let startTime, endTime;
        if (block === 'night') {
            startTime = '20:00';
            endTime = '03:00';
        } else {
            startTime = '12:00';
            endTime = '19:00';
        }

        sessions.push({ date: dateInput.value, startTime, endTime });
    });

    if (sessions.length === 0) {
        showToast('Please select at least one date', 'error');
        return;
    }

    // Create a booking for each date
    let successCount = 0;
    let lastError = '';

    for (const session of sessions) {
        const bookingData = {
            memberId: member._backendId || member.id,
            memberName: member.name,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            guests: guests,
            guestNames: guestNames,
            type: type,
            room: room
        };

        const result = await TorchAPI.createBooking(bookingData);
        if (result.success) {
            successCount++;
        } else {
            lastError = result.errors ? result.errors[0] : 'Booking failed';
        }
    }

    if (successCount > 0) {
        renderBookingsTable();
        renderCalendar();
        updateDashboard();
        closeModal('add-booking-modal');
        resetBookingForm();
        const msg = successCount === 1 ? 'Session booked' : `${successCount} sessions booked`;
        showToast(msg, 'success');
    }

    if (lastError) {
        showToast(lastError, 'error');
    }
}

// ============================================
// ROOM / DATE / TIME BLOCK HELPERS
// ============================================

function selectRoom(roomValue, btnEl) {
    // Toggle selection - clicking the same room deselects it
    const input = document.getElementById('booking-room');
    const allBtns = document.querySelectorAll('.room-option');

    if (input.value === roomValue) {
        input.value = '';
        allBtns.forEach(b => b.classList.remove('selected'));
    } else {
        input.value = roomValue;
        allBtns.forEach(b => b.classList.remove('selected'));
        btnEl.classList.add('selected');
    }
}

function selectTimeBlock(btnEl) {
    const toggle = btnEl.closest('.time-block-toggle');
    toggle.querySelectorAll('.time-block').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
}

let sessionDateCounter = 1; // row 0 already exists

function addSessionDate() {
    const container = document.getElementById('session-dates-container');
    const existingRows = container.querySelectorAll('.session-date-row');
    if (existingRows.length >= 3) {
        showToast('Maximum 3 session dates', 'info');
        return;
    }

    const idx = sessionDateCounter++;
    const row = document.createElement('div');
    row.className = 'session-date-row';
    row.dataset.row = idx;
    row.innerHTML = `
        <input type="date" class="session-date-input" required>
        <div class="time-block-toggle">
            <button type="button" class="time-block active" data-block="day" onclick="selectTimeBlock(this)">
                Day <small>12p&ndash;7p</small>
            </button>
            <button type="button" class="time-block" data-block="night" onclick="selectTimeBlock(this)">
                Night <small>8p&ndash;3a</small>
            </button>
        </div>
        <button type="button" class="btn-remove-date" onclick="removeSessionDate(this)">&times;</button>
    `;
    container.appendChild(row);
}

function removeSessionDate(btnEl) {
    const row = btnEl.closest('.session-date-row');
    row.style.animation = 'fadeSlideIn 0.2s ease reverse';
    setTimeout(() => row.remove(), 200);
}

function resetBookingForm() {
    // Reset room
    document.getElementById('booking-room').value = '';
    document.querySelectorAll('.room-option').forEach(b => b.classList.remove('selected'));

    // Reset date rows back to 1
    const container = document.getElementById('session-dates-container');
    const rows = container.querySelectorAll('.session-date-row');
    rows.forEach((row, i) => {
        if (i === 0) {
            row.querySelector('.session-date-input').value = '';
            const dayBlock = row.querySelector('.time-block[data-block="day"]');
            const nightBlock = row.querySelector('.time-block[data-block="night"]');
            if (dayBlock) dayBlock.classList.add('active');
            if (nightBlock) nightBlock.classList.remove('active');
        } else {
            row.remove();
        }
    });
    sessionDateCounter = 1;

    // Reset other fields
    document.getElementById('booking-guests').value = '0';
    document.getElementById('booking-guest-names').value = '';
}

async function submitEstateRequest(event) {
    event.preventDefault();

    const data = {
        name: document.getElementById('estate-name').value.trim(),
        email: document.getElementById('estate-email').value.trim(),
        phone: document.getElementById('estate-phone').value.trim() || undefined,
        preferredDates: [document.getElementById('estate-dates').value.trim()],
        eventDetails: document.getElementById('estate-details').value.trim()
    };

    if (!data.name || !data.email) {
        showToast('Name and email are required', 'error');
        return;
    }

    // Try backend
    if (typeof TorchBackend !== 'undefined') {
        try {
            await TorchBackend.estateRequests.submit(data);
            closeModal('estate-request-modal');
            showToast('Estate access request submitted!', 'success');
            // Reset form
            document.getElementById('estate-name').value = '';
            document.getElementById('estate-email').value = '';
            document.getElementById('estate-phone').value = '';
            document.getElementById('estate-dates').value = '';
            document.getElementById('estate-details').value = '';
            return;
        } catch (err) {
            showToast(err.message || 'Request failed', 'error');
            return;
        }
    }

    // Fallback if no backend
    closeModal('estate-request-modal');
    showToast('Estate access request submitted!', 'success');
}

function calculateHours(start, end) {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let hours = endH - startH + (endM - startM) / 60;
    if (hours < 0) hours += 24; // Handle overnight
    return Math.round(hours);
}

function viewBooking(id) {
    const booking = bookings.find(b => b.id == id);
    if (booking) showToast(`Viewing booking for ${booking.memberName}`, 'info');
}

async function cancelBooking(id) {
    const result = await TorchAPI.cancelBooking(id);

    if (result.success) {
        renderBookingsTable();
        renderCalendar();
        updateDashboard();
        showToast('Booking cancelled', 'success');
    } else {
        showToast(result.errors ? result.errors[0] : 'Cancel failed', 'error');
    }
}

// SMS
function initSMSCharCount() {
    const smsMessage = document.getElementById('sms-message');
    smsMessage.addEventListener('input', () => {
        document.getElementById('sms-char-count').textContent = smsMessage.value.length;
    });
}

function sendSMS(event) {
    event.preventDefault();

    const message = document.getElementById('sms-message').value;
    const recipients = document.getElementById('sms-recipients').selectedOptions;
    const recipientText = Array.from(recipients).map(o => o.text).join(', ');

    const newSMS = {
        id: smsHistory.length + 1,
        message: message,
        recipients: recipientText,
        sentAt: new Date().toLocaleString(),
        status: 'Delivered'
    };

    smsHistory.unshift(newSMS);
    renderSMSHistory();
    document.getElementById('sms-form').reset();
    document.getElementById('sms-char-count').textContent = '0';
    showToast(`SMS sent to ${recipientText}`, 'success');
}

function renderSMSHistory() {
    const historyHtml = smsHistory.map(sms => `
        <div class="history-item">
            <div class="message">${escapeHTML(sms.message?.substring(0, 60))}${sms.message?.length > 60 ? '...' : ''}</div>
            <div class="meta">${escapeHTML(sms.recipients)} • ${escapeHTML(sms.sentAt)}</div>
        </div>
    `).join('');
    document.getElementById('sms-history').innerHTML = historyHtml || '<p>No SMS history</p>';
}

function loadTemplate(type) {
    const template = smsTemplates[type];
    document.getElementById('sms-message').value = template;
    document.getElementById('sms-char-count').textContent = template.length;
}

// Email
function sendEmail(event) {
    event.preventDefault();

    const subject = document.getElementById('email-subject').value;
    const recipients = document.getElementById('email-recipients').selectedOptions[0].text;
    const body = document.getElementById('email-body').innerHTML;

    const newEmail = {
        id: emailHistory.sent.length + emailHistory.scheduled.length + emailHistory.drafts.length + 1,
        subject: subject,
        recipients: recipients,
        sentAt: new Date().toLocaleDateString(),
        opens: 0,
        clicks: 0
    };

    emailHistory.sent.unshift(newEmail);
    renderEmailHistory();
    document.getElementById('email-form').reset();
    document.getElementById('email-body').innerHTML = '';
    showToast(`Email sent to ${recipients}`, 'success');
}

function renderEmailHistory() {
    const sentHtml = emailHistory.sent.map(e => `
        <div class="email-item">
            <span class="subject">${e.subject}</span>
            <span class="recipients">${e.recipients}</span>
            <span class="date">${e.sentAt}</span>
        </div>
    `).join('');
    document.getElementById('email-history').innerHTML = sentHtml || '<p>No emails sent</p>';
}

function switchEmailTab(tab) {
    document.querySelectorAll('.email-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    let html = '';
    if (tab === 'sent') {
        html = emailHistory.sent.map(e => `
            <div class="email-item">
                <span class="subject">${escapeHTML(e.subject)}</span>
                <span class="recipients">${escapeHTML(e.recipients)}</span>
                <span class="date">${escapeHTML(e.sentAt)}</span>
            </div>
        `).join('');
    } else if (tab === 'scheduled') {
        html = emailHistory.scheduled.map(e => `
            <div class="email-item">
                <span class="subject">${escapeHTML(e.subject)}</span>
                <span class="recipients">${escapeHTML(e.recipients)}</span>
                <span class="date">Scheduled: ${escapeHTML(e.scheduledFor)}</span>
            </div>
        `).join('');
    } else if (tab === 'drafts') {
        html = emailHistory.drafts.map(e => `
            <div class="email-item">
                <span class="subject">${escapeHTML(e.subject)}</span>
                <span class="date">Last edited: ${escapeHTML(e.lastEdited)}</span>
            </div>
        `).join('');
    }
    document.getElementById('email-history').innerHTML = html || `<p>No ${tab}</p>`;
}

function loadEmailTemplate(type) {
    const template = emailTemplates[type];
    document.getElementById('email-subject').value = template.subject;
    document.getElementById('email-body').innerHTML = template.body;
}

function formatText(command) {
    document.execCommand(command, false, null);
}

function insertVariable(variable) {
    const editor = document.getElementById('email-body');
    editor.focus();
    document.execCommand('insertText', false, variable);
}

function previewEmail() {
    const subject = document.getElementById('email-subject').value;
    const body = document.getElementById('email-body').innerHTML;
    const recipients = document.getElementById('email-recipients').selectedOptions[0].text;

    const previewHtml = `
        <div class="preview-header">
            <p><strong>To:</strong> ${recipients}</p>
            <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div class="preview-body">
            ${body}
        </div>
    `;

    document.getElementById('email-preview-content').innerHTML = previewHtml;
    openModal('email-preview-modal');
}

function saveDraft() {
    const subject = document.getElementById('email-subject').value || 'Untitled Draft';

    emailHistory.drafts.push({
        id: Date.now(),
        subject: subject,
        lastEdited: new Date().toLocaleDateString()
    });

    showToast('Draft saved', 'success');
}

// Modals
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span>${escapeHTML(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Populate Member Dropdowns
function populateMemberDropdowns() {
    const select = document.getElementById('booking-member');
    select.innerHTML = members.map(m => `
        <option value="${m.id}">${escapeHTML(m.name)} (${escapeHTML(m.tier)})</option>
    `).join('');
}

// Utility Functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Keyboard shortcuts — close only the topmost modal (highest z-index)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModals = Array.from(document.querySelectorAll('.modal.active'));
        if (activeModals.length === 0) return;

        // Find the modal with the highest z-index
        let topModal = activeModals[0];
        let topZ = parseInt(getComputedStyle(topModal).zIndex) || 0;

        activeModals.forEach(modal => {
            const z = parseInt(getComputedStyle(modal).zIndex) || 0;
            if (z > topZ) {
                topZ = z;
                topModal = modal;
            }
        });

        topModal.classList.remove('active');
    }
});

console.log('TORCH ATL Operations Suite loaded successfully');
console.log('Launch Date:', LAUNCH_DATE.toLocaleDateString());
console.log('Members:', members.length);
console.log('Bookings:', bookings.length);

// ============================================
// SQUARE PAYMENT INTEGRATION
// ============================================

// Load saved Square config on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSquareConfig();
});

// Load Square configuration from localStorage
function loadSquareConfig() {
    const savedConfig = localStorage.getItem('torch_square_config');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        document.getElementById('square-app-id').value = config.applicationId || '';
        document.getElementById('square-access-token').value = config.accessToken || '';
        document.getElementById('square-location-id').value = config.locationId || '';
        document.getElementById('square-environment').value = config.environment || 'sandbox';

        // Apply to TorchSquare
        if (window.TorchSquare) {
            TorchSquare.config.applicationId = config.applicationId;
            TorchSquare.config.accessToken = config.accessToken;
            TorchSquare.config.locationId = config.locationId;
            TorchSquare.config.environment = config.environment;
        }

        updateSquareStatus(config.accessToken ? 'configured' : 'not-configured');
    }
}

// Save Square configuration
function saveSquareConfig(event) {
    event.preventDefault();

    const config = {
        applicationId: document.getElementById('square-app-id').value.trim(),
        accessToken: document.getElementById('square-access-token').value.trim(),
        locationId: document.getElementById('square-location-id').value.trim(),
        environment: document.getElementById('square-environment').value
    };

    // Validate required fields
    if (!config.applicationId || !config.accessToken || !config.locationId) {
        showStatusMessage('Please fill in all required fields', 'error');
        return;
    }

    // Save to localStorage
    localStorage.setItem('torch_square_config', JSON.stringify(config));

    // Apply to TorchSquare
    if (window.TorchSquare) {
        TorchSquare.config.applicationId = config.applicationId;
        TorchSquare.config.accessToken = config.accessToken;
        TorchSquare.config.locationId = config.locationId;
        TorchSquare.config.environment = config.environment;
        TorchSquare.init();
    }

    updateSquareStatus('configured');
    showStatusMessage('Square configuration saved successfully!', 'success');
    showToast('Square configuration saved', 'success');
}

// Test Square connection
async function testSquareConnection() {
    const accessToken = document.getElementById('square-access-token').value.trim();
    const environment = document.getElementById('square-environment').value;

    if (!accessToken) {
        showStatusMessage('Please enter an access token first', 'error');
        return;
    }

    showStatusMessage('Testing connection...', 'info');

    const baseUrl = environment === 'production'
        ? 'https://connect.squareup.com/v2'
        : 'https://connect.squareupsandbox.com/v2';

    try {
        const response = await fetch(`${baseUrl}/locations`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Square-Version': '2024-01-18'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const locations = data.locations || [];
            showStatusMessage(`Connection successful! Found ${locations.length} location(s).`, 'success');

            // Auto-populate location ID if only one location
            if (locations.length === 1 && !document.getElementById('square-location-id').value) {
                document.getElementById('square-location-id').value = locations[0].id;
            }
        } else {
            const error = await response.json();
            showStatusMessage(`Connection failed: ${error.errors?.[0]?.detail || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showStatusMessage(`Connection failed: ${error.message}`, 'error');
    }
}

// Show status message
function showStatusMessage(message, type) {
    const statusEl = document.getElementById('square-status');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
}

// Update Square integration status
function updateSquareStatus(status) {
    const statusEl = document.getElementById('square-integration-status');
    if (status === 'configured') {
        statusEl.textContent = 'Connected';
        statusEl.className = 'integration-status connected';
    } else {
        statusEl.textContent = 'Not Configured';
        statusEl.className = 'integration-status pending';
    }
}

// Sync single product to Square
async function syncProductToSquare(productKey) {
    if (!window.TorchSquare || !TorchSquare.config.accessToken) {
        showToast('Please configure Square first', 'error');
        return;
    }

    try {
        const result = await TorchSquare.createSubscriptionPlan(productKey);
        showToast(`${productKey} synced to Square`, 'success');
        console.log('[Square] Product synced:', result);
    } catch (error) {
        showToast(`Failed to sync ${productKey}: ${error.message}`, 'error');
        console.error('[Square] Sync error:', error);
    }
}

// Sync all products to Square
async function syncAllProductsToSquare() {
    if (!window.TorchSquare || !TorchSquare.config.accessToken) {
        showToast('Please configure Square first', 'error');
        return;
    }

    const products = Object.keys(TorchSquare.products);
    let synced = 0;
    let failed = 0;

    showToast('Syncing products to Square...', 'info');

    for (const productKey of products) {
        try {
            await TorchSquare.createSubscriptionPlan(productKey);
            synced++;
        } catch (error) {
            failed++;
            console.error(`[Square] Failed to sync ${productKey}:`, error);
        }
    }

    if (failed === 0) {
        showToast(`All ${synced} products synced successfully!`, 'success');
    } else {
        showToast(`Synced ${synced} products, ${failed} failed`, 'error');
    }
}

// Listen for Square events
window.addEventListener('torch-square', (event) => {
    const { type, data } = event.detail;
    console.log('[Square Event]', type, data);

    switch (type) {
        case 'paymentCompleted':
            showToast(`Payment received: $${(data.amount_money.amount / 100).toFixed(2)}`, 'success');
            break;
        case 'paymentFailed':
            showToast('Payment failed - please check details', 'error');
            break;
        case 'subscriptionCreated':
            showToast('New subscription created', 'success');
            updateDashboard();
            break;
    }
});

// ============================================
// ENGINEER CRM (Admin)
// ============================================

let currentEngineerView = 'cards';
let currentViewingEngineerId = null;

function renderEngineersTable() {
    // Render both views
    renderEngineersCRM();
}

function renderEngineersCRM() {
    // Update CRM stats
    updateEngineerCRMStats();

    // Render cards view
    renderEngineerCardsView();

    // Render table view
    renderEngineerTableView();
}

function updateEngineerCRMStats() {
    const activeEngineers = engineers.filter(e => e.status === 'Active').length;
    document.getElementById('active-engineers-count').textContent = activeEngineers;

    // Calculate this month's stats
    const currentMonth = new Date().toISOString().slice(0, 7); // e.g., "2026-02"

    let totalMonthSessions = 0;
    let totalMonthHours = 0;
    let totalMonthPayroll = 0;

    engineers.forEach(e => {
        if (e.monthlyStats && e.monthlyStats[currentMonth]) {
            totalMonthSessions += e.monthlyStats[currentMonth].sessions || 0;
            totalMonthHours += e.monthlyStats[currentMonth].hours || 0;
            totalMonthPayroll += e.monthlyStats[currentMonth].earnings || 0;
        }
    });

    document.getElementById('engineer-sessions-month').textContent = totalMonthSessions;
    document.getElementById('engineer-hours-month').textContent = totalMonthHours;
    document.getElementById('engineer-payroll-month').textContent = '$' + totalMonthPayroll.toLocaleString();
}

function renderEngineerCardsView() {
    const container = document.getElementById('engineers-cards-view');
    if (!container) return;

    container.innerHTML = engineers.map(e => {
        const initials = e.name.split(' ').map(n => n[0]).join('');
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthStats = e.monthlyStats && e.monthlyStats[currentMonth] ? e.monthlyStats[currentMonth] : { sessions: 0, hours: 0, earnings: 0 };
        const stats = e.stats || { totalSessions: 0, totalHours: 0, totalEarnings: 0, averageRating: 0 };

        return `
            <div class="engineer-card" data-id="${e.id}" data-name="${escapeHTML(e.name?.toLowerCase())}" data-role="${escapeHTML(e.role)}" data-status="${escapeHTML(e.status)}">
                <div class="engineer-card-header">
                    <div class="engineer-avatar">${escapeHTML(initials)}</div>
                    <div class="engineer-card-info">
                        <h4>${escapeHTML(e.name)}</h4>
                        <p class="engineer-email">${escapeHTML(e.email)}</p>
                        <span class="role-badge ${e.role === 'Lead Engineer' ? 'lead' : 'standard'}">${escapeHTML(e.role)}</span>
                        <span class="status-badge ${e.status.toLowerCase()}" style="margin-left: 8px;">${e.status}</span>
                    </div>
                </div>
                <div class="engineer-card-stats">
                    <div class="engineer-stat">
                        <span class="stat-value">${stats.totalSessions}</span>
                        <span class="stat-label">Sessions</span>
                    </div>
                    <div class="engineer-stat">
                        <span class="stat-value">${stats.totalHours}</span>
                        <span class="stat-label">Hours</span>
                    </div>
                    <div class="engineer-stat">
                        <span class="stat-value">${stats.averageRating.toFixed(1)}</span>
                        <span class="stat-label">Rating</span>
                    </div>
                    <div class="engineer-stat">
                        <span class="stat-value">$${e.rate}</span>
                        <span class="stat-label">Per Hour</span>
                    </div>
                </div>
                <div class="engineer-card-specialties">
                    ${e.specialties.map(s => `<span class="specialty-tag">${s}</span>`).join('')}
                </div>
                <div class="engineer-card-actions">
                    <button class="btn secondary" onclick="openEngineerProfile('${e.id}')">View Profile</button>
                    <button class="btn primary" onclick="editEngineer('${e.id}')">Edit</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderEngineerTableView() {
    const tbody = document.getElementById('engineers-tbody');
    if (!tbody) return;

    const currentMonth = new Date().toISOString().slice(0, 7);

    tbody.innerHTML = engineers.map(e => {
        const stats = e.stats || { totalSessions: 0, averageRating: 0 };
        const monthStats = e.monthlyStats && e.monthlyStats[currentMonth] ? e.monthlyStats[currentMonth] : { earnings: 0 };

        return `
            <tr data-id="${e.id}" data-name="${escapeHTML(e.name?.toLowerCase())}" data-role="${escapeHTML(e.role)}" data-status="${escapeHTML(e.status)}">
                <td>
                    <div style="display: flex; flex-direction: column;">
                        <strong>${escapeHTML(e.name)}</strong>
                        <small style="color: var(--text-secondary)">${escapeHTML(e.email)}</small>
                    </div>
                </td>
                <td><span class="role-badge ${e.role === 'Lead Engineer' ? 'lead' : 'standard'}">${escapeHTML(e.role)}</span></td>
                <td>${e.specialties.join(', ')}</td>
                <td>${stats.totalSessions}</td>
                <td>
                    <span class="star-rating">${'★'.repeat(Math.round(stats.averageRating))}<span class="empty">${'★'.repeat(5 - Math.round(stats.averageRating))}</span></span>
                    <small>(${stats.averageRating.toFixed(1)})</small>
                </td>
                <td>$${monthStats.earnings.toLocaleString()}</td>
                <td><span class="status-badge ${e.status.toLowerCase()}">${e.status}</span></td>
                <td>
                    <button class="action-btn" onclick="openEngineerProfile('${e.id}')">View</button>
                    <button class="action-btn" onclick="editEngineer('${e.id}')">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

function switchEngineerView(view) {
    currentEngineerView = view;
    document.querySelectorAll('.engineer-crm-toolbar .view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (view === 'cards') {
        document.getElementById('engineers-cards-view').style.display = 'grid';
        document.getElementById('engineers-table-view').style.display = 'none';
    } else {
        document.getElementById('engineers-cards-view').style.display = 'none';
        document.getElementById('engineers-table-view').style.display = 'block';
    }
}

function filterEngineersCRM() {
    const search = document.getElementById('engineer-search').value.toLowerCase();
    const roleFilter = document.getElementById('engineer-role-filter').value;
    const statusFilter = document.getElementById('engineer-status-filter').value;

    // Filter cards
    document.querySelectorAll('.engineer-card').forEach(card => {
        const name = card.dataset.name;
        const role = card.dataset.role;
        const status = card.dataset.status;

        const matchesSearch = name.includes(search);
        const matchesRole = roleFilter === 'all' || role === roleFilter;
        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        card.style.display = matchesSearch && matchesRole && matchesStatus ? '' : 'none';
    });

    // Filter table rows
    document.querySelectorAll('#engineers-tbody tr').forEach(row => {
        const name = row.dataset.name;
        const role = row.dataset.role;
        const status = row.dataset.status;

        const matchesSearch = name.includes(search);
        const matchesRole = roleFilter === 'all' || role === roleFilter;
        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        row.style.display = matchesSearch && matchesRole && matchesStatus ? '' : 'none';
    });
}

// Engineer Profile Modal
function openEngineerProfile(engineerId) {
    const engineer = engineers.find(e => e.id == engineerId);
    if (!engineer) return;

    currentViewingEngineerId = engineerId;
    const stats = engineer.stats || { totalSessions: 0, totalHours: 0, totalEarnings: 0, averageRating: 0 };
    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const monthStats = engineer.monthlyStats && engineer.monthlyStats[currentMonth] ? engineer.monthlyStats[currentMonth] : { sessions: 0, hours: 0, earnings: 0 };
    const lastMonthStats = engineer.monthlyStats && engineer.monthlyStats[lastMonth] ? engineer.monthlyStats[lastMonth] : { sessions: 0, hours: 0, earnings: 0 };

    // Header
    const initials = engineer.name.split(' ').map(n => n[0]).join('');
    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = engineer.name;
    document.getElementById('profile-role').textContent = engineer.role;
    document.getElementById('profile-role').className = `role-badge ${engineer.role === 'Lead Engineer' ? 'lead' : 'standard'}`;
    document.getElementById('profile-email').textContent = engineer.email;
    document.getElementById('profile-phone').textContent = engineer.phone;

    // Stats
    document.getElementById('profile-total-sessions').textContent = stats.totalSessions;
    document.getElementById('profile-total-hours').textContent = stats.totalHours;
    document.getElementById('profile-avg-rating').textContent = stats.averageRating.toFixed(1);
    document.getElementById('profile-total-earnings').textContent = '$' + stats.totalEarnings.toLocaleString();

    // Overview tab
    document.getElementById('profile-bio').textContent = engineer.bio || 'No bio available.';
    document.getElementById('profile-specialties').innerHTML = engineer.specialties.map(s =>
        `<span class="specialty-tag">${escapeHTML(s)}</span>`
    ).join('');

    document.getElementById('profile-month-sessions').textContent = monthStats.sessions;
    document.getElementById('profile-month-hours').textContent = monthStats.hours;
    document.getElementById('profile-month-earnings').textContent = '$' + monthStats.earnings.toLocaleString();
    document.getElementById('profile-acceptance-rate').textContent = (stats.acceptanceRate || 100) + '%';

    // Recent sessions
    const engineerBookings = bookings.filter(b => b.engineerId === engineerId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);

    document.getElementById('profile-recent-sessions').innerHTML = engineerBookings.length > 0 ?
        engineerBookings.map(b => `
            <div class="recent-session-item">
                <div class="session-info">
                    <span class="session-member">${escapeHTML(b.memberName)}</span>
                    <span class="session-date">${formatDate(b.date)} • ${b.hours} hrs</span>
                </div>
                <span class="status-badge ${escapeHTML(b.engineerStatus)}">${escapeHTML(b.engineerStatus)}</span>
            </div>
        `).join('') : '<p style="color: var(--text-muted);">No sessions yet</p>';

    // Sessions tab
    renderProfileSessions(engineerId);

    // Earnings tab
    document.getElementById('profile-earnings-total').textContent = '$' + stats.totalEarnings.toLocaleString();
    document.getElementById('profile-earnings-month').textContent = '$' + monthStats.earnings.toLocaleString();
    document.getElementById('profile-earnings-last-month').textContent = '$' + lastMonthStats.earnings.toLocaleString();
    document.getElementById('profile-hourly-rate').textContent = '$' + engineer.rate + '/hr';

    // Earnings breakdown
    const monthlyStats = engineer.monthlyStats || {};
    const months = Object.keys(monthlyStats).sort().reverse().slice(0, 6);
    document.getElementById('profile-earnings-breakdown').innerHTML = months.length > 0 ?
        months.map(month => `
            <div class="earnings-row">
                <span class="month">${formatMonth(month)}</span>
                <span class="details">${monthlyStats[month].sessions} sessions • ${monthlyStats[month].hours} hrs</span>
                <span class="amount">$${monthlyStats[month].earnings.toLocaleString()}</span>
            </div>
        `).join('') : '<p style="color: var(--text-muted);">No earnings history</p>';

    // Availability tab
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        const avail = engineer.availability[day];
        const el = document.getElementById(`avail-${day}`);
        const dayEl = el.parentElement;
        if (avail) {
            el.textContent = `${formatTime(avail.start)} - ${formatTime(avail.end)}`;
            dayEl.classList.add('available');
            dayEl.classList.remove('unavailable');
        } else {
            el.textContent = 'Off';
            dayEl.classList.add('unavailable');
            dayEl.classList.remove('available');
        }
    });

    // Notes tab
    renderEngineerNotes(engineer);

    // Reset to overview tab
    switchProfileTab('overview');

    openModal('engineer-profile-modal');
}

function renderProfileSessions(engineerId) {
    const container = document.getElementById('profile-sessions-list');
    const filterValue = document.getElementById('profile-session-filter')?.value || 'all';
    const today = new Date().toISOString().split('T')[0];

    let filteredBookings = bookings.filter(b => b.engineerId === engineerId);

    if (filterValue === 'upcoming') {
        filteredBookings = filteredBookings.filter(b => b.date >= today);
    } else if (filterValue === 'completed') {
        filteredBookings = filteredBookings.filter(b => b.date < today);
    }

    filteredBookings.sort((a, b) => b.date.localeCompare(a.date));

    container.innerHTML = filteredBookings.length > 0 ?
        filteredBookings.map(b => `
            <div class="profile-session-item">
                <div class="session-main-info">
                    <div class="member-name">${escapeHTML(b.memberName)}</div>
                    <div class="session-meta">${formatDate(b.date)} • ${formatTime(b.startTime)} - ${formatTime(b.endTime)} • ${escapeHTML(b.type)}</div>
                </div>
                <span class="session-hours-badge">${b.hours} hrs</span>
                <span class="status-badge ${escapeHTML(b.engineerStatus)}" style="margin-left: 8px;">${escapeHTML(b.engineerStatus)}</span>
            </div>
        `).join('') : '<p style="color: var(--text-muted); padding: 20px; text-align: center;">No sessions found</p>';
}

function renderEngineerNotes(engineer) {
    const container = document.getElementById('profile-notes-list');
    const notes = engineer.notes || [];

    container.innerHTML = notes.length > 0 ?
        notes.map(note => `
            <div class="note-item">
                <p class="note-text">${escapeHTML(note.text)}</p>
                <div class="note-meta">${escapeHTML(note.author)} • ${new Date(note.createdAt).toLocaleDateString()}</div>
            </div>
        `).join('') : '<p style="color: var(--text-muted); text-align: center;">No notes yet</p>';
}

function switchProfileTab(tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.profile-tab[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`profile-tab-${tab}`).classList.add('active');
}

async function addEngineerNote() {
    if (!currentViewingEngineerId) return;

    const noteText = document.getElementById('new-engineer-note').value.trim();
    if (!noteText) {
        showToast('Please enter a note', 'error');
        return;
    }

    const result = await TorchAPI.addEngineerNote(currentViewingEngineerId, noteText);

    if (result.success) {
        const engineer = engineers.find(e => e.id === currentViewingEngineerId);
        if (engineer) renderEngineerNotes(engineer);
        document.getElementById('new-engineer-note').value = '';
        showToast('Note added successfully', 'success');
    } else {
        showToast(result.errors ? result.errors[0] : 'Failed to add note', 'error');
    }
}

function editEngineerAvailability() {
    showToast('Availability editing coming soon', 'info');
}

function editEngineerFromProfile() {
    closeModal('engineer-profile-modal');
    editEngineer(currentViewingEngineerId);
}

function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

// Listen for session filter changes
document.addEventListener('DOMContentLoaded', () => {
    const sessionFilter = document.getElementById('profile-session-filter');
    if (sessionFilter) {
        sessionFilter.addEventListener('change', () => {
            if (currentViewingEngineerId) {
                renderProfileSessions(currentViewingEngineerId);
            }
        });
    }
});

async function addEngineer(event) {
    event.preventDefault();

    const specialties = [];
    document.querySelectorAll('#add-engineer-modal .checkbox-group input:checked').forEach(cb => {
        specialties.push(cb.value);
    });

    const engineerData = {
        name: document.getElementById('new-engineer-name').value,
        email: document.getElementById('new-engineer-email').value,
        phone: document.getElementById('new-engineer-phone').value,
        role: document.getElementById('new-engineer-role').value,
        rate: parseInt(document.getElementById('new-engineer-rate').value) || 60,
        accessCode: document.getElementById('new-engineer-code').value || null,
        specialties: specialties,
        bio: document.getElementById('new-engineer-bio').value
    };

    const result = await TorchAPI.createEngineer(engineerData);

    if (result.success) {
        closeModal('add-engineer-modal');
        renderEngineersTable();
        showToast(`Engineer ${engineerData.name} added successfully`, 'success');
        document.getElementById('add-engineer-modal').querySelector('form').reset();
    } else {
        showToast(result.errors[0], 'error');
    }
}

function viewEngineer(id) {
    openEngineerProfile(id);
}

function editEngineer(id) {
    const engineer = engineers.find(e => e.id == id);
    if (!engineer) return;

    // Populate edit form
    document.getElementById('edit-engineer-id').value = engineer.id;
    document.getElementById('edit-engineer-name').value = engineer.name;
    document.getElementById('edit-engineer-email').value = engineer.email;
    document.getElementById('edit-engineer-phone').value = engineer.phone || '';
    document.getElementById('edit-engineer-role').value = engineer.role;
    document.getElementById('edit-engineer-rate').value = engineer.rate;
    document.getElementById('edit-engineer-status').value = engineer.status;
    document.getElementById('edit-engineer-bio').value = engineer.bio || '';

    // Set specialties checkboxes
    document.querySelectorAll('#edit-engineer-specialties input').forEach(cb => {
        cb.checked = engineer.specialties.includes(cb.value);
    });

    openModal('edit-engineer-modal');
}

async function saveEngineerEdit(event) {
    event.preventDefault();

    const engineerId = document.getElementById('edit-engineer-id').value;
    const engineer = engineers.find(e => e.id == engineerId);
    if (!engineer) return;

    const specialties = [];
    document.querySelectorAll('#edit-engineer-specialties input:checked').forEach(cb => {
        specialties.push(cb.value);
    });

    const fields = {
        name: document.getElementById('edit-engineer-name').value,
        email: document.getElementById('edit-engineer-email').value,
        phone: document.getElementById('edit-engineer-phone').value,
        role: document.getElementById('edit-engineer-role').value,
        rate: parseInt(document.getElementById('edit-engineer-rate').value) || 60,
        status: document.getElementById('edit-engineer-status').value,
        bio: document.getElementById('edit-engineer-bio').value,
        specialties: specialties
    };

    const result = await TorchAPI.updateEngineer(engineer.id, fields);

    if (result.success) {
        closeModal('edit-engineer-modal');
        if (typeof renderEngineersCRM === 'function') renderEngineersCRM();
        else renderEngineersTable();
        showToast(`${fields.name} updated successfully`, 'success');
    } else {
        showToast(result.errors ? result.errors[0] : 'Update failed', 'error');
    }
}

// Populate engineer dropdown in booking forms
function populateEngineerDropdowns() {
    const selects = document.querySelectorAll('.engineer-select');
    const activeEngineers = engineers.filter(e => e.status === 'Active');

    selects.forEach(select => {
        select.innerHTML = '<option value="">No engineer assigned</option>' +
            activeEngineers.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
    });
}

// ============================================
// SESSION REPORTS REVIEW (Admin)
// ============================================

function renderSessionReportsReview() {
    const container = document.getElementById('reports-list');
    if (!container) return;

    // Populate engineer filter
    const engineerFilter = document.getElementById('report-engineer-filter');
    if (engineerFilter && engineerFilter.options.length <= 1) {
        engineers.forEach(e => {
            const option = document.createElement('option');
            option.value = e.id;
            option.textContent = e.name;
            engineerFilter.appendChild(option);
        });
    }

    const reports = sessionReports.sort((a, b) => {
        // Submitted first, then by date
        if (a.status === 'submitted' && b.status !== 'submitted') return -1;
        if (b.status === 'submitted' && a.status !== 'submitted') return 1;
        return b.sessionDate.localeCompare(a.sessionDate);
    });

    if (reports.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No session reports yet</p>';
        return;
    }

    container.innerHTML = reports.map(r => `
        <div class="report-card ${r.status}">
            <div class="report-header">
                <div>
                    <h4>${escapeHTML(r.memberName)}</h4>
                    <span class="report-date">${formatDate(r.sessionDate)}</span>
                </div>
                <span class="status-badge ${r.status}">${r.status}</span>
            </div>
            <div class="report-meta">
                <span>Engineer: ${escapeHTML(r.engineerName)}</span>
                <span>Hours: ${r.actualHours}</span>
                <span>Quality: ${'★'.repeat(r.sessionQuality || 0)}${'☆'.repeat(5 - (r.sessionQuality || 0))}</span>
            </div>
            <p class="report-notes">${r.notes ? escapeHTML(r.notes.substring(0, 100)) + (r.notes.length > 100 ? '...' : '') : 'No notes'}</p>
            <button class="btn secondary small" onclick="viewReport('${r.id}')">View Details</button>
        </div>
    `).join('');
}

function filterReports() {
    const statusFilter = document.getElementById('report-status-filter').value;
    const engineerFilter = document.getElementById('report-engineer-filter').value;

    const cards = document.querySelectorAll('#reports-list .report-card');
    cards.forEach(card => {
        const status = card.classList.contains('submitted') ? 'submitted' :
                      card.classList.contains('reviewed') ? 'reviewed' : 'draft';
        const matchesStatus = statusFilter === 'all' || status === statusFilter;
        // Engineer filter would need data attributes - simplified for now
        card.style.display = matchesStatus ? '' : 'none';
    });
}

let currentViewingReportId = null;

function viewReport(reportId) {
    const report = sessionReports.find(r => r.id == reportId);
    if (!report) return;

    currentViewingReportId = reportId;

    const content = document.getElementById('view-report-content');
    content.innerHTML = `
        <div class="report-detail-grid">
            <div class="detail-section">
                <h4>Session Information</h4>
                <div class="detail-row"><span>Member:</span><span>${escapeHTML(report.memberName)}</span></div>
                <div class="detail-row"><span>Date:</span><span>${formatDate(report.sessionDate)}</span></div>
                <div class="detail-row"><span>Time:</span><span>${formatTime(report.actualStartTime)} - ${formatTime(report.actualEndTime)}</span></div>
                <div class="detail-row"><span>Hours:</span><span>${report.actualHours}</span></div>
                <div class="detail-row"><span>Work Type:</span><span>${escapeHTML(report.workType)}</span></div>
                <div class="detail-row"><span>Project:</span><span>${escapeHTML(report.projectName) || 'N/A'}</span></div>
            </div>
            <div class="detail-section">
                <h4>Engineer</h4>
                <div class="detail-row"><span>Name:</span><span>${report.engineerName}</span></div>
                <div class="detail-row"><span>Quality Rating:</span><span>${'★'.repeat(report.sessionQuality)}${'☆'.repeat(5 - report.sessionQuality)}</span></div>
                <div class="detail-row"><span>Follow-up:</span><span>${report.followUpNeeded ? 'Yes' : 'No'}</span></div>
            </div>
            <div class="detail-section full-width">
                <h4>Tracks Worked</h4>
                <p>${report.tracksWorked.length > 0 ? report.tracksWorked.join('<br>') : 'No tracks specified'}</p>
            </div>
            <div class="detail-section full-width">
                <h4>Equipment Used</h4>
                <p>${report.equipmentUsed.length > 0 ? report.equipmentUsed.join(', ') : 'No equipment specified'}</p>
            </div>
            <div class="detail-section full-width">
                <h4>Session Notes</h4>
                <p>${report.notes || 'No notes'}</p>
            </div>
            ${report.issuesReported ? `
            <div class="detail-section full-width issues">
                <h4>Issues Reported</h4>
                <p>${report.issuesReported}</p>
            </div>` : ''}
            <div class="detail-section full-width">
                <h4>Status</h4>
                <div class="detail-row"><span>Status:</span><span class="status-badge ${report.status}">${report.status}</span></div>
                ${report.submittedAt ? `<div class="detail-row"><span>Submitted:</span><span>${new Date(report.submittedAt).toLocaleString()}</span></div>` : ''}
                ${report.reviewedAt ? `<div class="detail-row"><span>Reviewed:</span><span>${new Date(report.reviewedAt).toLocaleString()} by ${report.reviewedBy}</span></div>` : ''}
            </div>
        </div>
    `;

    // Show/hide review button
    const reviewBtn = document.getElementById('mark-reviewed-btn');
    if (reviewBtn) {
        reviewBtn.style.display = report.status === 'submitted' ? '' : 'none';
    }

    openModal('view-report-modal');
}

async function markReportReviewed() {
    if (!currentViewingReportId) return;

    const result = await TorchAPI.reviewSessionReport(currentViewingReportId, currentAdminUser.name);

    if (result.success) {
        closeModal('view-report-modal');
        renderSessionReportsReview();
        showToast('Report marked as reviewed', 'success');
    } else {
        showToast(result.errors ? result.errors[0] : 'Review failed', 'error');
    }
}

// ============================================
// ENGINEER VIEWS
// ============================================

let engineerCalendarMonth = new Date().getMonth();
let engineerCalendarYear = new Date().getFullYear();

function renderEngineerCalendar() {
    if (!currentAdminUser || currentAdminUser.role !== 'engineer') return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('engineer-calendar-month').textContent =
        `${monthNames[engineerCalendarMonth]} ${engineerCalendarYear}`;

    const firstDay = new Date(engineerCalendarYear, engineerCalendarMonth, 1);
    const lastDay = new Date(engineerCalendarYear, engineerCalendarMonth + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const engineerId = currentAdminUser.engineerId;
    const myBookings = bookings.filter(b => b.engineerId === engineerId);

    let calendarHtml = '';

    // Previous month days
    const prevMonthLastDay = new Date(engineerCalendarYear, engineerCalendarMonth, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
        calendarHtml += `<div class="calendar-day other-month">${prevMonthLastDay - i}</div>`;
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${engineerCalendarYear}-${String(engineerCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasBooking = myBookings.some(b => b.date === dateStr);
        const isToday = day === today.getDate() && engineerCalendarMonth === today.getMonth() && engineerCalendarYear === today.getFullYear();

        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (hasBooking) classes += ' has-booking';

        calendarHtml += `<div class="${classes}">${day}</div>`;
    }

    // Next month days
    const remainingDays = 42 - (startingDay + totalDays);
    for (let day = 1; day <= remainingDays; day++) {
        calendarHtml += `<div class="calendar-day other-month">${day}</div>`;
    }

    document.getElementById('engineer-calendar-days').innerHTML = calendarHtml;
}

function changeEngineerMonth(delta) {
    engineerCalendarMonth += delta;
    if (engineerCalendarMonth > 11) {
        engineerCalendarMonth = 0;
        engineerCalendarYear++;
    } else if (engineerCalendarMonth < 0) {
        engineerCalendarMonth = 11;
        engineerCalendarYear--;
    }
    renderEngineerCalendar();
}

function renderEngineerUpcomingSessions() {
    if (!currentAdminUser || currentAdminUser.role !== 'engineer') return;

    const container = document.getElementById('engineer-upcoming-sessions');
    if (!container) return;

    const engineerId = currentAdminUser.engineerId;
    const today = new Date().toISOString().split('T')[0];

    const upcomingSessions = bookings
        .filter(b => b.engineerId === engineerId && b.date >= today && b.engineerStatus === 'accepted')
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        .slice(0, 10);

    if (upcomingSessions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No upcoming sessions</p>';
        return;
    }

    container.innerHTML = upcomingSessions.map(b => `
        <div class="session-item">
            <div>
                <div class="member-name">${escapeHTML(b.memberName)}</div>
                <div class="session-time">${formatDate(b.date)} • ${formatTime(b.startTime)} - ${formatTime(b.endTime)}</div>
            </div>
            <span class="session-hours">${b.hours} hrs</span>
        </div>
    `).join('');
}

function renderPendingRequests() {
    if (!currentAdminUser || currentAdminUser.role !== 'engineer') return;

    const container = document.getElementById('pending-requests-list');
    if (!container) return;

    const engineerId = currentAdminUser.engineerId;
    const pendingBookings = bookings.filter(b =>
        b.engineerId === engineerId &&
        (b.engineerStatus === 'assigned' || b.engineerStatus === 'requested')
    ).sort((a, b) => a.date.localeCompare(b.date));

    if (pendingBookings.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No pending requests</p>';
        return;
    }

    container.innerHTML = pendingBookings.map(b => `
        <div class="request-card">
            <div class="request-header">
                <h4>${escapeHTML(b.memberName)}</h4>
                <span class="request-type">${escapeHTML(b.type)}</span>
            </div>
            <div class="request-details">
                <div class="detail"><span>📅</span> ${formatDate(b.date)}</div>
                <div class="detail"><span>⏰</span> ${formatTime(b.startTime)} - ${formatTime(b.endTime)}</div>
                <div class="detail"><span>⏱️</span> ${b.hours} hours</div>
                <div class="detail"><span>👥</span> ${b.guests} guests</div>
            </div>
            <div class="request-actions">
                <button class="btn primary" onclick="acceptRequest('${escapeHTML(b.id)}')">Accept</button>
                <button class="btn secondary" onclick="declineRequest('${escapeHTML(b.id)}')">Decline</button>
            </div>
        </div>
    `).join('');
}

function acceptRequest(bookingId) {
    const engineerId = currentAdminUser.engineerId;
    const result = TorchAPI.acceptBooking(bookingId, engineerId);

    if (result.success) {
        showToast('Session accepted!', 'success');
        renderPendingRequests();
        renderEngineerCalendar();
        renderEngineerUpcomingSessions();
    } else {
        showToast(result.errors[0], 'error');
    }
}

function declineRequest(bookingId) {
    const engineerId = currentAdminUser.engineerId;
    const result = TorchAPI.declineBooking(bookingId, engineerId);

    if (result.success) {
        showToast('Session declined', 'info');
        renderPendingRequests();
    } else {
        showToast(result.errors[0], 'error');
    }
}

// ============================================
// SESSION REPORTS (Engineer)
// ============================================

let currentReportTab = 'pending';

function switchReportTab(tab) {
    currentReportTab = tab;
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.report-tab[onclick*="${tab}"]`).classList.add('active');
    renderMyReports();
}

function renderMyReports() {
    if (!currentAdminUser || currentAdminUser.role !== 'engineer') return;

    const container = document.getElementById('my-reports-list');
    if (!container) return;

    const engineerId = currentAdminUser.engineerId;
    const today = new Date().toISOString().split('T')[0];

    if (currentReportTab === 'pending') {
        // Show completed sessions that need reports
        const completedSessions = bookings.filter(b =>
            b.engineerId === engineerId &&
            b.engineerStatus === 'accepted' &&
            b.date < today &&
            !b.sessionReportId
        ).sort((a, b) => b.date.localeCompare(a.date));

        if (completedSessions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No pending reports</p>';
            return;
        }

        container.innerHTML = completedSessions.map(b => `
            <div class="report-card pending">
                <div class="report-header">
                    <div>
                        <h4>${escapeHTML(b.memberName)}</h4>
                        <span class="report-date">${formatDate(b.date)}</span>
                    </div>
                    <span class="status-badge pending">Needs Report</span>
                </div>
                <div class="report-meta">
                    <span>${formatTime(b.startTime)} - ${formatTime(b.endTime)}</span>
                    <span>${b.hours} hours</span>
                    <span>${escapeHTML(b.type)}</span>
                </div>
                <button class="btn primary" onclick="openReportForm('${escapeHTML(b.id)}')">Submit Report</button>
            </div>
        `).join('');
    } else {
        // Show submitted reports
        const myReports = sessionReports.filter(r => r.engineerId === engineerId)
            .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

        if (myReports.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">No submitted reports</p>';
            return;
        }

        container.innerHTML = myReports.map(r => `
            <div class="report-card ${escapeHTML(r.status)}">
                <div class="report-header">
                    <div>
                        <h4>${escapeHTML(r.memberName)}</h4>
                        <span class="report-date">${formatDate(r.sessionDate)}</span>
                    </div>
                    <span class="status-badge ${escapeHTML(r.status)}">${escapeHTML(r.status)}</span>
                </div>
                <div class="report-meta">
                    <span>Hours: ${r.actualHours}</span>
                    <span>Quality: ${'★'.repeat(r.sessionQuality)}</span>
                </div>
                <button class="btn secondary small" onclick="viewReport('${escapeHTML(r.id)}')">View</button>
            </div>
        `).join('');
    }
}

function openReportForm(bookingId) {
    const booking = bookings.find(b => b.id == bookingId);
    if (!booking) return;

    document.getElementById('report-booking-id').value = bookingId;
    document.getElementById('report-member-name').textContent = booking.memberName;
    document.getElementById('report-session-date').textContent = formatDate(booking.date);
    document.getElementById('report-session-time').textContent = `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`;
    document.getElementById('report-actual-start').value = booking.startTime;
    document.getElementById('report-actual-end').value = booking.endTime;
    document.getElementById('report-work-type').value = booking.type;

    // Reset form
    document.getElementById('report-project-name').value = '';
    document.getElementById('report-tracks').value = '';
    document.getElementById('report-equipment').value = '';
    document.getElementById('report-notes').value = '';
    document.getElementById('report-issues').value = '';
    document.getElementById('report-followup').checked = false;
    document.getElementById('report-quality').value = 3;

    // Reset stars
    updateStars(3);

    openModal('session-report-modal');
}

// Star rating
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.rating-input .star').forEach(star => {
        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            document.getElementById('report-quality').value = value;
            updateStars(value);
        });
    });
});

function updateStars(value) {
    document.querySelectorAll('.rating-input .star').forEach(star => {
        const starValue = parseInt(star.dataset.value);
        star.classList.toggle('active', starValue <= value);
    });
}

async function submitSessionReport(event) {
    event.preventDefault();

    const bookingId = document.getElementById('report-booking-id').value;
    const engineerId = currentAdminUser.engineerId;

    const reportData = {
        bookingId: bookingId,
        engineerId: engineerId,
        actualStartTime: document.getElementById('report-actual-start').value,
        actualEndTime: document.getElementById('report-actual-end').value,
        workType: document.getElementById('report-work-type').value,
        projectName: document.getElementById('report-project-name').value,
        tracksWorked: document.getElementById('report-tracks').value.split('\n').filter(t => t.trim()),
        equipmentUsed: document.getElementById('report-equipment').value.split(',').map(e => e.trim()).filter(e => e),
        sessionQuality: parseInt(document.getElementById('report-quality').value),
        notes: document.getElementById('report-notes').value,
        issuesReported: document.getElementById('report-issues').value,
        followUpNeeded: document.getElementById('report-followup').checked
    };

    // Calculate actual hours
    const start = reportData.actualStartTime.split(':').map(Number);
    const end = reportData.actualEndTime.split(':').map(Number);
    let hours = end[0] - start[0] + (end[1] - start[1]) / 60;
    if (hours < 0) hours += 24;
    reportData.actualHours = Math.round(hours);

    const createResult = await TorchAPI.createSessionReport(reportData);

    if (!createResult.success) {
        showToast(createResult.errors[0], 'error');
        return;
    }

    const submitResult = await TorchAPI.submitSessionReport(createResult.report.id);

    if (submitResult.success) {
        closeModal('session-report-modal');
        renderMyReports();
        showToast('Report submitted successfully!', 'success');
    } else {
        showToast(submitResult.errors ? submitResult.errors[0] : 'Submit failed', 'error');
    }
}

function saveReportDraft() {
    showToast('Draft saved', 'info');
}

// ============================================
// OPERATIONS TAB
// ============================================

// State
let opsCalendarMonth = new Date().getMonth();
let opsCalendarYear = new Date().getFullYear();
let opsCalendarData = { bookings: [], tasks: [], estateRequests: [] };
let opsSelectedDate = null;

function initOperationsCalendar() {
    opsCalendarMonth = new Date().getMonth();
    opsCalendarYear = new Date().getFullYear();
}

// Sub-tab switching
function switchOpsTab(tab) {
    document.querySelectorAll('.ops-sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.ops-sub-tab[data-ops-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.ops-view').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
    });

    const view = document.getElementById(`ops-${tab}-view`);
    view.style.display = 'block';
    view.classList.add('active');

    // Load data for the selected sub-tab
    if (tab === 'calendar') loadOperationsCalendar();
    else if (tab === 'pending') loadPendingBookings();
    else if (tab === 'tasks') loadStudioTasks();
    else if (tab === 'estate') loadEstateRequests();
    else if (tab === 'nate') loadNateTasks();
    else if (tab === 'vendors') loadVendors();
    else if (tab === 'maintenance') loadMaintenanceLog();
    else if (tab === 'linen') loadLinenStandards();
}

// ---- Operations Calendar ----

function changeOpsMonth(delta) {
    opsCalendarMonth += delta;
    if (opsCalendarMonth > 11) { opsCalendarMonth = 0; opsCalendarYear++; }
    if (opsCalendarMonth < 0) { opsCalendarMonth = 11; opsCalendarYear--; }
    loadOperationsCalendar();
}

async function loadOperationsCalendar() {
    const monthStr = `${opsCalendarYear}-${String(opsCalendarMonth + 1).padStart(2, '0')}`;
    const monthLabel = new Date(opsCalendarYear, opsCalendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('ops-calendar-month').textContent = monthLabel;

    // Try backend
    if (typeof TorchBackend !== 'undefined' && TorchBackend.auth.isAuthenticated()) {
        try {
            opsCalendarData = await TorchBackend.admin.operationsCalendar(monthStr);
        } catch (e) {
            console.warn('[Ops] Calendar fetch failed:', e.message);
            opsCalendarData = { bookings: [], tasks: [], estateRequests: [] };
        }
    } else {
        opsCalendarData = { bookings: [], tasks: [], estateRequests: [] };
    }

    renderOpsCalendar();
}

function renderOpsCalendar() {
    const container = document.getElementById('ops-calendar-days');
    const firstDay = new Date(opsCalendarYear, opsCalendarMonth, 1).getDay();
    const daysInMonth = new Date(opsCalendarYear, opsCalendarMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Build event map: date -> { bookings:[], tasks:[], estate:[] }
    const eventMap = {};
    (opsCalendarData.bookings || []).forEach(b => {
        if (!eventMap[b.date]) eventMap[b.date] = { bookings: [], tasks: [], estate: [] };
        eventMap[b.date].bookings.push(b);
    });
    (opsCalendarData.tasks || []).forEach(t => {
        if (!eventMap[t.scheduled_date]) eventMap[t.scheduled_date] = { bookings: [], tasks: [], estate: [] };
        eventMap[t.scheduled_date].tasks.push(t);
    });
    (opsCalendarData.estateRequests || []).forEach(er => {
        try {
            const dates = JSON.parse(er.preferred_dates || '[]');
            dates.forEach(d => {
                if (!eventMap[d]) eventMap[d] = { bookings: [], tasks: [], estate: [] };
                eventMap[d].estate.push(er);
            });
        } catch {}
    });

    let html = '';

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="ops-calendar-day other-month"></div>';
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${opsCalendarYear}-${String(opsCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === opsSelectedDate;
        const events = eventMap[dateStr];

        let classes = 'ops-calendar-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';

        let dots = '';
        if (events) {
            if (events.bookings.length) dots += '<span class="event-dot booking"></span>';
            events.tasks.forEach(t => {
                dots += `<span class="event-dot ${t.type}"></span>`;
            });
            if (events.estate.length) dots += '<span class="event-dot estate"></span>';
        }

        html += `<div class="${classes}" onclick="selectOpsDay('${dateStr}')">
            <div class="day-number">${day}</div>
            <div class="day-dots">${dots}</div>
        </div>`;
    }

    container.innerHTML = html;
}

function selectOpsDay(dateStr) {
    opsSelectedDate = dateStr;
    renderOpsCalendar();

    const panel = document.getElementById('ops-day-detail');
    const title = document.getElementById('ops-day-detail-title');
    const content = document.getElementById('ops-day-detail-content');

    const dayEvents = [];

    (opsCalendarData.bookings || []).filter(b => b.date === dateStr).forEach(b => {
        dayEvents.push({
            type: 'booking',
            time: b.start_time,
            label: `${b.member_name || 'Booking'} — ${b.type} (${b.status})`,
            room: b.room || ''
        });
    });

    (opsCalendarData.tasks || []).filter(t => t.scheduled_date === dateStr).forEach(t => {
        dayEvents.push({
            type: t.type,
            time: t.scheduled_time,
            label: `${t.title} (${t.status})`,
            room: t.room
        });
    });

    (opsCalendarData.estateRequests || []).forEach(er => {
        try {
            const dates = JSON.parse(er.preferred_dates || '[]');
            if (dates.includes(dateStr)) {
                dayEvents.push({
                    type: 'estate',
                    time: '',
                    label: `Estate: ${er.name} — ${er.event_details || ''}`.slice(0, 80),
                    room: 'estate'
                });
            }
        } catch {}
    });

    dayEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const formatted = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    title.textContent = formatted;

    if (dayEvents.length === 0) {
        content.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No events scheduled</p>';
    } else {
        content.innerHTML = dayEvents.map(e => `
            <div class="day-detail-item">
                <span class="event-dot ${escapeHTML(e.type)}"></span>
                <span class="detail-time">${e.time ? formatTime(e.time) : ''}</span>
                <span class="detail-info">${escapeHTML(e.label)}</span>
                ${e.room ? `<span class="room-badge">${escapeHTML(e.room)}</span>` : ''}
            </div>
        `).join('');
    }

    panel.style.display = 'block';
}

// ---- Pending Bookings ----

async function loadPendingBookings() {
    const filter = document.getElementById('ops-booking-status-filter').value;
    const container = document.getElementById('ops-pending-list');

    let bookingsList = [];
    if (typeof TorchBackend !== 'undefined' && TorchBackend.auth.isAuthenticated()) {
        try {
            const params = {};
            if (filter !== 'all') params.status = filter;
            bookingsList = await TorchBackend.bookings.list(params);
        } catch (e) {
            console.warn('[Ops] Bookings fetch failed:', e.message);
        }
    }

    if (bookingsList.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No bookings found</h4><p>Bookings will appear here when members submit them.</p></div>';
        return;
    }

    container.innerHTML = bookingsList.map(b => `
        <div class="booking-card">
            <div class="card-header">
                <h4>${escapeHTML(b.member_name) || 'Unknown Member'}</h4>
                <span class="status-badge ${b.status}">${b.status}</span>
            </div>
            <div class="card-meta">
                <span>${formatDate(b.date)}</span>
                <span>${formatTime(b.start_time)} - ${formatTime(b.end_time)}</span>
                <span>${b.hours}h</span>
            </div>
            <div class="card-meta">
                <span>${escapeHTML((b.type || '').charAt(0).toUpperCase() + (b.type || '').slice(1))}</span>
                ${b.room ? `<span class="room-badge">${escapeHTML(b.room)}</span>` : ''}
            </div>
            ${b.status === 'pending' ? `
                <div class="card-actions">
                    <button class="btn primary" onclick="approveBooking('${escapeHTML(b.id)}')">Approve</button>
                    <button class="btn secondary" onclick="openDeclineBooking('${escapeHTML(b.id)}')">Decline</button>
                </div>
            ` : ''}
            ${b.decline_reason ? `<p style="font-size: 12px; color: var(--danger); margin-top: 8px;">Reason: ${escapeHTML(b.decline_reason)}</p>` : ''}
        </div>
    `).join('');
}

async function approveBooking(bookingId) {
    try {
        await TorchBackend.bookings.updateStatus(bookingId, 'confirmed');
        showToast('Booking approved', 'success');
        loadPendingBookings();
        loadOperationsCalendar();
    } catch (e) {
        showToast(e.message || 'Failed to approve booking', 'error');
    }
}

function openDeclineBooking(bookingId) {
    document.getElementById('decline-booking-id').value = bookingId;
    document.getElementById('decline-reason').value = '';
    openModal('decline-booking-modal');
}

async function confirmDeclineBooking(event) {
    event.preventDefault();
    const bookingId = document.getElementById('decline-booking-id').value;
    const reason = document.getElementById('decline-reason').value;

    try {
        await TorchBackend.bookings.updateStatus(bookingId, 'declined', reason);
        closeModal('decline-booking-modal');
        showToast('Booking declined', 'info');
        loadPendingBookings();
        loadOperationsCalendar();
    } catch (e) {
        showToast(e.message || 'Failed to decline booking', 'error');
    }
}

// ---- Studio Tasks ----

async function loadStudioTasks() {
    const container = document.getElementById('ops-tasks-list');
    const roomFilter = document.getElementById('ops-task-room-filter').value;
    const typeFilter = document.getElementById('ops-task-type-filter').value;
    const statusFilter = document.getElementById('ops-task-status-filter').value;

    let tasksList = [];
    if (typeof TorchBackend !== 'undefined' && TorchBackend.auth.isAuthenticated()) {
        try {
            const params = {};
            if (roomFilter !== 'all') params.room = roomFilter;
            if (typeFilter !== 'all') params.type = typeFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            tasksList = await TorchBackend.studioTasks.list(params);
        } catch (e) {
            console.warn('[Ops] Tasks fetch failed:', e.message);
        }
    }

    if (tasksList.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No tasks found</h4><p>Add studio tasks to track cleaning, maintenance, and repairs.</p></div>';
        return;
    }

    container.innerHTML = tasksList.map(t => `
        <div class="task-card">
            <div class="card-header">
                <h4>${escapeHTML(t.title)}</h4>
                <span class="status-badge ${t.status}">${t.status.replace('_', ' ')}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge ${t.type}">${t.type}</span>
                <span class="room-badge">${t.room}</span>
                <span>${formatDate(t.scheduled_date)}</span>
                <span>${formatTime(t.scheduled_time)}</span>
            </div>
            ${t.assigned_to ? `<div class="card-meta"><span>Assigned: ${escapeHTML(t.assigned_to)}</span></div>` : ''}
            ${t.description ? `<p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">${escapeHTML(t.description)}</p>` : ''}
            <div class="card-actions">
                ${t.status === 'pending' ? `<button class="btn primary" onclick="updateTaskStatus('${t.id}', 'in_progress')">Start</button>` : ''}
                ${t.status === 'in_progress' ? `<button class="btn primary" onclick="updateTaskStatus('${t.id}', 'completed')">Complete</button>` : ''}
                ${t.status !== 'cancelled' && t.status !== 'completed' ? `<button class="btn secondary" onclick="updateTaskStatus('${t.id}', 'cancelled')">Cancel</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function addStudioTask(event) {
    event.preventDefault();

    const data = {
        title: document.getElementById('task-title').value,
        type: document.getElementById('task-type').value,
        room: document.getElementById('task-room').value,
        scheduledDate: document.getElementById('task-date').value,
        scheduledTime: document.getElementById('task-time').value || '09:00',
        assignedTo: document.getElementById('task-assigned').value || null,
        description: document.getElementById('task-description').value || null
    };

    try {
        await TorchBackend.studioTasks.create(data);
        closeModal('add-task-modal');
        showToast('Task created', 'success');
        loadStudioTasks();
        loadOperationsCalendar();
        // Reset form
        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        document.getElementById('task-assigned').value = '';
    } catch (e) {
        showToast(e.message || 'Failed to create task', 'error');
    }
}

async function updateTaskStatus(taskId, status) {
    try {
        await TorchBackend.studioTasks.update(taskId, { status });
        showToast(`Task ${status.replace('_', ' ')}`, 'success');
        loadStudioTasks();
        loadOperationsCalendar();
    } catch (e) {
        showToast(e.message || 'Failed to update task', 'error');
    }
}

// ---- Estate Requests ----

async function loadEstateRequests() {
    const container = document.getElementById('ops-estate-list');
    const statusFilter = document.getElementById('ops-estate-status-filter').value;

    let requestsList = [];
    if (typeof TorchBackend !== 'undefined' && TorchBackend.auth.isAuthenticated()) {
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            requestsList = await TorchBackend.estateRequests.list(params);
        } catch (e) {
            console.warn('[Ops] Estate requests fetch failed:', e.message);
        }
    }

    if (requestsList.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No estate requests</h4><p>Estate access requests will appear here.</p></div>';
        return;
    }

    container.innerHTML = requestsList.map(er => {
        let dates = '';
        try { dates = JSON.parse(er.preferred_dates || '[]').join(', '); } catch { dates = er.preferred_dates || ''; }

        return `
            <div class="estate-card">
                <div class="card-header">
                    <h4>${escapeHTML(er.name)}</h4>
                    <span class="status-badge ${escapeHTML(er.status)}">${escapeHTML(er.status)}</span>
                </div>
                <div class="card-meta">
                    <span>${escapeHTML(er.email)}</span>
                    ${er.phone ? `<span>${escapeHTML(er.phone)}</span>` : ''}
                </div>
                ${dates ? `<div class="card-meta"><span>Dates: ${escapeHTML(dates)}</span></div>` : ''}
                ${er.event_details ? `<p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">${escapeHTML(er.event_details.slice(0, 100))}${er.event_details.length > 100 ? '...' : ''}</p>` : ''}
                <div class="card-actions">
                    <button class="btn primary" onclick="openEstateDetail('${escapeHTML(er.id)}')">View Details</button>
                </div>
            </div>
        `;
    }).join('');
}

function openEstateDetail(requestId) {
    const requests = opsCalendarData.estateRequests || [];
    // Fetch from list if not in calendar data
    let er = requests.find(r => r.id === requestId);

    // If not found in calendar data, find from DOM or refetch
    if (!er) {
        // We'll need to fetch it - for now use what we have from the list render
        // The list was loaded from the API, so we re-fetch
        (async () => {
            try {
                const all = await TorchBackend.estateRequests.list();
                er = all.find(r => r.id === requestId);
                if (er) populateEstateDetail(er);
            } catch (e) {
                showToast('Could not load request details', 'error');
            }
        })();
        return;
    }

    populateEstateDetail(er);
}

function populateEstateDetail(er) {
    document.getElementById('estate-detail-id').value = er.id;
    document.getElementById('estate-detail-name').textContent = er.name;
    document.getElementById('estate-detail-email').textContent = er.email;
    document.getElementById('estate-detail-phone').textContent = er.phone || 'N/A';

    let dates = '';
    try { dates = JSON.parse(er.preferred_dates || '[]').join(', '); } catch { dates = er.preferred_dates || ''; }
    document.getElementById('estate-detail-dates').textContent = dates || 'N/A';
    document.getElementById('estate-detail-event').textContent = er.event_details || 'N/A';
    document.getElementById('estate-detail-submitted').textContent = er.created_at ? new Date(er.created_at).toLocaleDateString() : 'N/A';
    document.getElementById('estate-detail-status').value = er.status;
    document.getElementById('estate-detail-notes').value = er.admin_notes || '';

    openModal('estate-detail-modal');
}

async function saveEstateUpdate() {
    const id = document.getElementById('estate-detail-id').value;
    const status = document.getElementById('estate-detail-status').value;
    const adminNotes = document.getElementById('estate-detail-notes').value;

    try {
        await TorchBackend.estateRequests.update(id, { status, adminNotes });
        closeModal('estate-detail-modal');
        showToast('Estate request updated', 'success');
        loadEstateRequests();
        loadOperationsCalendar();
    } catch (e) {
        showToast(e.message || 'Failed to update request', 'error');
    }
}

// ============================================
// OPERATIONS HUB — SEED DATA INIT
// ============================================

function initOpsHubData() {
    if (vendors.length === 0 && typeof SEED_VENDORS !== 'undefined') {
        vendors = JSON.parse(JSON.stringify(SEED_VENDORS));
        TorchStorage.saveVendors();
        console.log('[OpsHub] Seeded vendor directory');
    }
    if (maintenanceLog.length === 0 && typeof SEED_MAINTENANCE !== 'undefined') {
        maintenanceLog = JSON.parse(JSON.stringify(SEED_MAINTENANCE));
        TorchStorage.saveMaintenanceLog();
        console.log('[OpsHub] Seeded maintenance log');
    }
}

// Run seed on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initOpsHubData, 500);
});

// ============================================
// NATE TASK BOARD
// ============================================

function loadNateTasks() {
    const container = document.getElementById('nate-tasks-list');
    const categoryFilter = document.getElementById('nate-task-category-filter').value;
    const priorityFilter = document.getElementById('nate-task-priority-filter').value;
    const statusFilter = document.getElementById('nate-task-status-filter').value;

    let filtered = [...nateTasks];

    if (categoryFilter !== 'all') filtered = filtered.filter(t => t.category === categoryFilter);
    if (priorityFilter !== 'all') filtered = filtered.filter(t => t.priority === priorityFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);

    // Sort: pending first, then by due date
    filtered.sort((a, b) => {
        const statusOrder = { pending: 0, in_progress: 1, completed: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No tasks found</h4><p>Add tasks for Nate to track pre-arrival, day-of, and post-session work.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(t => `
        <div class="task-card nate-card">
            <div class="card-header">
                <h4>${escapeHTML(t.title)}</h4>
                <span class="status-badge ${t.status}">${t.status.replace('_', ' ')}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge ${t.category}">${t.category.replace('-', ' ')}</span>
                <span class="priority-badge priority-${t.priority}">${t.priority}</span>
                <span>Due: ${formatDate(t.dueDate)}</span>
            </div>
            ${t.linkedBooking ? `<div class="card-meta"><span>Booking: ${escapeHTML(t.linkedBooking)}</span></div>` : ''}
            ${t.notes ? `<p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">${escapeHTML(t.notes)}</p>` : ''}
            <div class="card-actions">
                ${t.status === 'pending' ? `<button class="btn primary" onclick="updateNateTaskStatus('${t.id}', 'in_progress')">Start</button>` : ''}
                ${t.status === 'in_progress' ? `<button class="btn primary" onclick="updateNateTaskStatus('${t.id}', 'completed')">Complete</button>` : ''}
                ${t.status !== 'completed' ? `<button class="btn secondary" onclick="deleteNateTask('${t.id}')">Delete</button>` : ''}
            </div>
        </div>
    `).join('');
}

function addNateTask(event) {
    event.preventDefault();

    const task = {
        id: 'nate-' + Date.now(),
        title: document.getElementById('nate-task-title').value,
        category: document.getElementById('nate-task-category').value,
        priority: document.getElementById('nate-task-priority').value,
        dueDate: document.getElementById('nate-task-due').value,
        linkedBooking: document.getElementById('nate-task-booking').value || null,
        notes: document.getElementById('nate-task-notes').value || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    nateTasks.push(task);
    TorchStorage.saveNateTasks();
    closeModal('add-nate-task-modal');
    showToast('Nate task created', 'success');
    loadNateTasks();

    // Reset form
    document.getElementById('nate-task-title').value = '';
    document.getElementById('nate-task-booking').value = '';
    document.getElementById('nate-task-notes').value = '';
}

function updateNateTaskStatus(taskId, status) {
    const task = nateTasks.find(t => t.id === taskId);
    if (task) {
        task.status = status;
        task.updatedAt = new Date().toISOString();
        if (status === 'completed') task.completedAt = new Date().toISOString();
        TorchStorage.saveNateTasks();
        showToast(`Task ${status.replace('_', ' ')}`, 'success');
        loadNateTasks();
    }
}

function deleteNateTask(taskId) {
    nateTasks = nateTasks.filter(t => t.id !== taskId);
    TorchStorage.saveNateTasks();
    showToast('Task deleted', 'success');
    loadNateTasks();
}

// ============================================
// VENDOR DIRECTORY
// ============================================

function loadVendors() {
    const container = document.getElementById('vendors-list');
    const categoryFilter = document.getElementById('vendor-category-filter').value;
    const ratingFilter = document.getElementById('vendor-rating-filter').value;

    let filtered = [...vendors];

    if (categoryFilter !== 'all') filtered = filtered.filter(v => v.category === categoryFilter);
    if (ratingFilter !== 'all') filtered = filtered.filter(v => v.rating >= parseInt(ratingFilter));

    // Sort by rating desc, then name
    filtered.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No vendors found</h4><p>Add vendors to build your directory of cleaning, catering, maintenance, and equipment contacts.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(v => {
        const stars = '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating);
        return `
        <div class="vendor-card">
            <div class="card-header">
                <h4>${escapeHTML(v.name)}</h4>
                <span class="type-badge ${v.category}">${v.category}</span>
            </div>
            <div class="vendor-rating">${stars}</div>
            <div class="card-meta">
                ${v.contactName ? `<span>${escapeHTML(v.contactName)}</span>` : ''}
                ${v.phone ? `<span>${escapeHTML(v.phone)}</span>` : ''}
                ${v.rate ? `<span>${escapeHTML(v.rate)}</span>` : ''}
            </div>
            ${v.email ? `<div class="card-meta"><span>${escapeHTML(v.email)}</span></div>` : ''}
            ${v.notes ? `<p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">${escapeHTML(v.notes)}</p>` : ''}
            <div class="card-actions">
                <button class="btn secondary" onclick="deleteVendor('${v.id}')">Remove</button>
            </div>
        </div>
    `}).join('');
}

function addVendor(event) {
    event.preventDefault();

    const vendor = {
        id: 'vendor-' + Date.now(),
        name: document.getElementById('vendor-name').value,
        category: document.getElementById('vendor-category').value,
        contactName: document.getElementById('vendor-contact').value || '',
        phone: document.getElementById('vendor-phone').value || '',
        email: document.getElementById('vendor-email').value || '',
        rate: document.getElementById('vendor-rate').value || '',
        rating: parseInt(document.getElementById('vendor-rating').value),
        notes: document.getElementById('vendor-notes').value || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    vendors.push(vendor);
    TorchStorage.saveVendors();
    closeModal('add-vendor-modal');
    showToast('Vendor added', 'success');
    loadVendors();

    // Reset form
    document.getElementById('vendor-name').value = '';
    document.getElementById('vendor-contact').value = '';
    document.getElementById('vendor-phone').value = '';
    document.getElementById('vendor-email').value = '';
    document.getElementById('vendor-rate').value = '';
    document.getElementById('vendor-notes').value = '';
}

function deleteVendor(vendorId) {
    vendors = vendors.filter(v => v.id !== vendorId);
    TorchStorage.saveVendors();
    showToast('Vendor removed', 'success');
    loadVendors();
}

// ============================================
// PROPERTY MAINTENANCE LOG
// ============================================

function loadMaintenanceLog() {
    const container = document.getElementById('maintenance-list');
    const priorityFilter = document.getElementById('maint-priority-filter').value;
    const statusFilter = document.getElementById('maint-status-filter').value;
    const areaFilter = document.getElementById('maint-area-filter').value;

    let filtered = [...maintenanceLog];

    if (priorityFilter !== 'all') filtered = filtered.filter(m => m.priority === priorityFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(m => m.status === statusFilter);
    if (areaFilter !== 'all') filtered = filtered.filter(m => m.area === areaFilter);

    // Sort: open first, then by priority, then by date
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { open: 0, in_progress: 1, scheduled: 2, resolved: 3 };
    filtered.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
        return new Date(b.reportedDate) - new Date(a.reportedDate);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No maintenance items</h4><p>Log maintenance items as they arise to track issues and resolution.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(m => `
        <div class="maint-card">
            <div class="card-header">
                <h4>${escapeHTML(m.title)}</h4>
                <span class="status-badge ${m.status}">${m.status.replace('_', ' ')}</span>
            </div>
            <div class="card-meta">
                <span class="priority-badge priority-${m.priority}">${m.priority}</span>
                <span class="type-badge">${m.area.replace('-', ' ')}</span>
                <span>Reported: ${formatDate(m.reportedDate)}</span>
            </div>
            ${m.assignedTo ? `<div class="card-meta"><span>Assigned: ${escapeHTML(m.assignedTo)}</span></div>` : ''}
            ${m.nextServiceDate ? `<div class="card-meta"><span style="color: var(--primary);">Next service: ${formatDate(m.nextServiceDate)}</span></div>` : ''}
            ${m.estimatedCost ? `<div class="card-meta"><span>Est. cost: ${escapeHTML(m.estimatedCost)}</span></div>` : ''}
            ${m.description ? `<p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">${escapeHTML(m.description)}</p>` : ''}
            <div class="card-actions">
                ${m.status === 'open' ? `<button class="btn primary" onclick="updateMaintenanceStatus('${m.id}', 'in_progress')">Start</button>` : ''}
                ${m.status === 'in_progress' ? `<button class="btn primary" onclick="updateMaintenanceStatus('${m.id}', 'resolved')">Resolve</button>` : ''}
                ${m.status === 'open' ? `<button class="btn secondary" onclick="updateMaintenanceStatus('${m.id}', 'scheduled')">Schedule</button>` : ''}
                ${m.status === 'scheduled' ? `<button class="btn primary" onclick="updateMaintenanceStatus('${m.id}', 'resolved')">Resolve</button>` : ''}
                <button class="btn secondary" onclick="deleteMaintenanceItem('${m.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function addMaintenanceItem(event) {
    event.preventDefault();

    const item = {
        id: 'maint-' + Date.now(),
        title: document.getElementById('maint-title').value,
        priority: document.getElementById('maint-priority').value,
        status: 'open',
        area: document.getElementById('maint-area').value,
        assignedTo: document.getElementById('maint-assigned').value || '',
        reportedDate: document.getElementById('maint-reported').value,
        nextServiceDate: document.getElementById('maint-next-service').value || '',
        estimatedCost: document.getElementById('maint-cost').value || '',
        description: document.getElementById('maint-description').value || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    maintenanceLog.push(item);
    TorchStorage.saveMaintenanceLog();
    closeModal('add-maintenance-modal');
    showToast('Maintenance item logged', 'success');
    loadMaintenanceLog();

    // Reset form
    document.getElementById('maint-title').value = '';
    document.getElementById('maint-assigned').value = '';
    document.getElementById('maint-cost').value = '';
    document.getElementById('maint-description').value = '';
    document.getElementById('maint-next-service').value = '';
}

function updateMaintenanceStatus(itemId, status) {
    const item = maintenanceLog.find(m => m.id === itemId);
    if (item) {
        item.status = status;
        item.updatedAt = new Date().toISOString();
        if (status === 'resolved') item.resolvedDate = new Date().toISOString().split('T')[0];
        TorchStorage.saveMaintenanceLog();
        showToast(`Item ${status.replace('_', ' ')}`, 'success');
        loadMaintenanceLog();
    }
}

function deleteMaintenanceItem(itemId) {
    maintenanceLog = maintenanceLog.filter(m => m.id !== itemId);
    TorchStorage.saveMaintenanceLog();
    showToast('Maintenance item deleted', 'success');
    loadMaintenanceLog();
}

// ============================================
// LINEN & SUPPLY STANDARDS
// ============================================

function loadLinenStandards() {
    const container = document.getElementById('linen-list');
    const summaryBar = document.getElementById('linen-summary');
    const categoryFilter = document.getElementById('linen-category-filter').value;
    const statusFilter = document.getElementById('linen-status-filter').value;

    let filtered = [...linenStandards];

    if (categoryFilter !== 'all') filtered = filtered.filter(l => l.category === categoryFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(l => l.status === statusFilter);

    // Sort: fails first, then reorder, then pass
    const statusOrder = { fail: 0, reorder: 1, pass: 2 };
    filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // Summary counts
    const totalCount = linenStandards.length;
    const passCount = linenStandards.filter(l => l.status === 'pass').length;
    const failCount = linenStandards.filter(l => l.status === 'fail').length;
    const reorderCount = linenStandards.filter(l => l.status === 'reorder').length;

    summaryBar.innerHTML = totalCount > 0 ? `
        <div class="linen-stat">
            <span class="linen-stat-num">${totalCount}</span>
            <span class="linen-stat-label">Total Items</span>
        </div>
        <div class="linen-stat pass">
            <span class="linen-stat-num">${passCount}</span>
            <span class="linen-stat-label">Pass</span>
        </div>
        <div class="linen-stat fail">
            <span class="linen-stat-num">${failCount}</span>
            <span class="linen-stat-label">Fail</span>
        </div>
        <div class="linen-stat reorder">
            <span class="linen-stat-num">${reorderCount}</span>
            <span class="linen-stat-label">Reorder</span>
        </div>
    ` : '';

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No inspection records</h4><p>Nate logs inspection results here. Flagged items surface to Joi\'s priority view.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(l => {
        const stockLevel = l.minimum > 0 ? Math.round((l.quantity / l.minimum) * 100) : 100;
        const stockClass = stockLevel >= 100 ? 'stock-good' : stockLevel >= 50 ? 'stock-warning' : 'stock-critical';

        return `
        <div class="linen-card ${l.status === 'fail' ? 'flagged' : ''}">
            <div class="card-header">
                <h4>${escapeHTML(l.item)}</h4>
                <span class="status-badge ${l.status}">${l.status}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge">${l.category.replace('-', ' ')}</span>
                <span>Inspected: ${formatDate(l.inspectedAt)}</span>
                ${l.inspectedBy ? `<span>By: ${escapeHTML(l.inspectedBy)}</span>` : ''}
            </div>
            ${l.minimum > 0 ? `
            <div class="stock-bar-container">
                <div class="stock-bar">
                    <div class="stock-bar-fill ${stockClass}" style="width: ${Math.min(stockLevel, 100)}%"></div>
                </div>
                <span class="stock-label">${l.quantity} / ${l.minimum} on hand</span>
            </div>
            ` : ''}
            ${l.notes ? `<p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">${escapeHTML(l.notes)}</p>` : ''}
            <div class="card-actions">
                ${l.status === 'fail' ? `<button class="btn primary" onclick="updateLinenStatus('${l.id}', 'pass')">Mark Resolved</button>` : ''}
                ${l.status === 'reorder' ? `<button class="btn primary" onclick="updateLinenStatus('${l.id}', 'pass')">Restocked</button>` : ''}
                <button class="btn secondary" onclick="deleteLinenRecord('${l.id}')">Delete</button>
            </div>
        </div>
    `}).join('');
}

function addLinenInspection(event) {
    event.preventDefault();

    const record = {
        id: 'linen-' + Date.now(),
        item: document.getElementById('linen-item').value,
        category: document.getElementById('linen-category').value,
        status: document.getElementById('linen-status').value,
        quantity: parseInt(document.getElementById('linen-quantity').value) || 0,
        minimum: parseInt(document.getElementById('linen-minimum').value) || 0,
        inspectedBy: document.getElementById('linen-inspector').value || 'Nate',
        notes: document.getElementById('linen-notes').value || '',
        inspectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    linenStandards.push(record);
    TorchStorage.saveLinenStandards();
    closeModal('add-linen-modal');
    showToast(`Inspection logged — ${record.status === 'fail' ? 'FLAGGED for Joi' : record.status}`, record.status === 'fail' ? 'error' : 'success');
    loadLinenStandards();

    // Reset form
    document.getElementById('linen-item').value = '';
    document.getElementById('linen-quantity').value = '';
    document.getElementById('linen-minimum').value = '';
    document.getElementById('linen-notes').value = '';
}

function updateLinenStatus(recordId, status) {
    const record = linenStandards.find(l => l.id === recordId);
    if (record) {
        record.status = status;
        record.updatedAt = new Date().toISOString();
        TorchStorage.saveLinenStandards();
        showToast(`Item marked as ${status}`, 'success');
        loadLinenStandards();
    }
}

function deleteLinenRecord(recordId) {
    linenStandards = linenStandards.filter(l => l.id !== recordId);
    TorchStorage.saveLinenStandards();
    showToast('Record deleted', 'success');
    loadLinenStandards();
}

// ============================================
// DASHBOARD UPGRADES
// ============================================

function updateDashboardV2() {
    // Revenue by lane from invoices
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthInvoices = invoicesData.filter(inv => inv.status === 'paid' && inv.createdAt && inv.createdAt.startsWith(monthStr));
    const laneRevenue = { estate: 0, camp: 0, tdp: 0, flex: 0 };
    monthInvoices.forEach(inv => {
        if (laneRevenue[inv.lane] !== undefined) laneRevenue[inv.lane] += inv.amount;
    });

    const totalRevenue = Object.values(laneRevenue).reduce((a, b) => a + b, 0);
    const target = 60000;

    const totalRevEl = document.getElementById('total-revenue');
    if (totalRevEl) totalRevEl.textContent = '$' + totalRevenue.toLocaleString();
    const revEstateEl = document.getElementById('rev-estate');
    if (revEstateEl) revEstateEl.textContent = '$' + laneRevenue.estate.toLocaleString();
    const revCampEl = document.getElementById('rev-camp');
    if (revCampEl) revCampEl.textContent = '$' + laneRevenue.camp.toLocaleString();
    const revTdpEl = document.getElementById('rev-tdp');
    if (revTdpEl) revTdpEl.textContent = '$' + laneRevenue.tdp.toLocaleString();
    const revFlexEl = document.getElementById('rev-flex');
    if (revFlexEl) revFlexEl.textContent = '$' + laneRevenue.flex.toLocaleString();

    // Lane bars (proportional to target)
    const barEstate = document.getElementById('bar-estate');
    if (barEstate) barEstate.style.width = Math.min((laneRevenue.estate / target) * 100, 100) + '%';
    const barCamp = document.getElementById('bar-camp');
    if (barCamp) barCamp.style.width = Math.min((laneRevenue.camp / target) * 100, 100) + '%';
    const barTdp = document.getElementById('bar-tdp');
    if (barTdp) barTdp.style.width = Math.min((laneRevenue.tdp / target) * 100, 100) + '%';
    const barFlex = document.getElementById('bar-flex');
    if (barFlex) barFlex.style.width = Math.min((laneRevenue.flex / target) * 100, 100) + '%';

    // Open invoices
    const openCount = invoicesData.filter(inv => inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'deposit').length;
    const openInvEl = document.getElementById('open-invoices');
    if (openInvEl) openInvEl.textContent = openCount;

    // Days booked this month
    const monthBookings = bookings.filter(b => b.date && b.date.startsWith(monthStr));
    const uniqueDays = new Set(monthBookings.map(b => b.date));
    const daysBookedEl = document.getElementById('days-booked');
    if (daysBookedEl) daysBookedEl.textContent = uniqueDays.size;

    // Priority flag
    const flagEl = document.getElementById('priority-flag');
    const storedFlag = TorchStorage.load(TorchStorage.KEYS.PRIORITY_FLAG);
    if (flagEl && storedFlag) flagEl.value = storedFlag;

    // Clock
    const clockEl = document.getElementById('dash-clock');
    if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}

function savePriorityFlag() {
    const val = document.getElementById('priority-flag').value;
    TorchStorage.save(TorchStorage.KEYS.PRIORITY_FLAG, val);
}

// Update clock every second
setInterval(() => {
    const clockEl = document.getElementById('dash-clock');
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}, 1000);

// ============================================
// CLIENT DIRECTORY
// ============================================

function filterClients() {
    renderClientsTable();
}

function renderClientsTable() {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;

    const search = (document.getElementById('client-search')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('client-type-filter')?.value || 'all';
    const statusFilter = document.getElementById('client-status-filter')?.value || 'all';

    let filtered = [...clients];
    if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search) || (c.contactName || '').toLowerCase().includes(search));
    if (typeFilter !== 'all') filtered = filtered.filter(c => c.type === typeFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);padding:40px;">No clients found. Add your first client to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(c => `
        <tr>
            <td><strong>${escapeHTML(c.name)}</strong>${c.contactName ? '<br><span style="font-size:11px;color:var(--text-secondary);">' + escapeHTML(c.contactName) + '</span>' : ''}</td>
            <td><span class="type-badge ${c.type}">${c.type}</span></td>
            <td>${escapeHTML(c.email || '')}<br><span style="font-size:11px;">${escapeHTML(c.phone || '')}</span></td>
            <td>${c.ndaSigned ? '<span style="color:var(--success);">Signed</span>' : '<span style="color:var(--text-muted);">—</span>'}</td>
            <td>$${(c.lifetimeSpend || 0).toLocaleString()}</td>
            <td>${c.lastBooking ? formatDate(c.lastBooking) : '—'}</td>
            <td><span class="status-badge ${c.status}">${c.status}</span></td>
            <td><button class="btn secondary small" onclick="deleteClient('${c.id}')">Remove</button></td>
        </tr>
    `).join('');
}

function addClient(event) {
    event.preventDefault();
    const client = {
        id: 'client-' + Date.now(),
        name: document.getElementById('client-name').value,
        type: document.getElementById('client-type').value,
        contactName: document.getElementById('client-contact-name').value || '',
        email: document.getElementById('client-email').value || '',
        phone: document.getElementById('client-phone').value || '',
        referralSource: document.getElementById('client-referral').value || '',
        rider: document.getElementById('client-rider').value || '',
        ndaSigned: false,
        cardOnFile: false,
        lifetimeSpend: 0,
        lastBooking: null,
        status: 'active',
        createdAt: new Date().toISOString()
    };
    clients.push(client);
    TorchStorage.saveClients();
    closeModal('add-client-modal');
    showToast('Client added', 'success');
    renderClientsTable();
    event.target.reset();
}

function deleteClient(id) {
    clients = clients.filter(c => c.id !== id);
    TorchStorage.saveClients();
    showToast('Client removed', 'success');
    renderClientsTable();
}

// ============================================
// INQUIRY PIPELINE
// ============================================

function filterInquiries() { renderInquiryPipeline(); }

function renderInquiryPipeline() {
    const container = document.getElementById('inquiry-pipeline');
    if (!container) return;

    const search = (document.getElementById('inquiry-search')?.value || '').toLowerCase();
    const stageFilter = document.getElementById('inquiry-stage-filter')?.value || 'all';
    const typeFilter = document.getElementById('inquiry-type-filter')?.value || 'all';

    let filtered = [...inquiries];
    if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search));
    if (stageFilter !== 'all') filtered = filtered.filter(i => i.stage === stageFilter);
    if (typeFilter !== 'all') filtered = filtered.filter(i => i.bookingType === typeFilter);

    const stages = ['new', 'nda-sent', 'nda-signed', 'rate-sent', 'negotiating', 'booked', 'lost'];
    const stageLabels = { 'new': 'New Lead', 'nda-sent': 'NDA Sent', 'nda-signed': 'NDA Signed', 'rate-sent': 'Rate Card Sent', 'negotiating': 'Negotiating', 'booked': 'Booked', 'lost': 'Lost' };

    container.innerHTML = stages.filter(s => stageFilter === 'all' || s === stageFilter).map(stage => {
        const stageItems = filtered.filter(i => i.stage === stage);
        return `
        <div class="pipeline-column">
            <div class="pipeline-header">
                <h4>${stageLabels[stage]}</h4>
                <span class="pipeline-count">${stageItems.length}</span>
            </div>
            ${stageItems.length === 0 ? '<div class="ops-empty" style="padding:20px;"><p>No items</p></div>' :
            stageItems.map(i => `
                <div class="pipeline-card">
                    <h5>${escapeHTML(i.name)}</h5>
                    <span class="type-badge">${i.bookingType}</span>
                    <p style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${escapeHTML(i.dates || '')} ${i.headcount ? '| ' + i.headcount + ' people' : ''}</p>
                    ${i.description ? '<p style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + escapeHTML(i.description) + '</p>' : ''}
                    <div class="card-actions" style="margin-top:8px;">
                        ${stage !== 'booked' && stage !== 'lost' ? `<button class="btn primary small" onclick="advanceInquiry('${i.id}')">Advance</button>` : ''}
                        ${stage !== 'lost' ? `<button class="btn secondary small" onclick="updateInquiryStage('${i.id}', 'lost')">Lost</button>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>`;
    }).join('');
}

function addInquiry(event) {
    event.preventDefault();
    const inquiry = {
        id: 'inq-' + Date.now(),
        name: document.getElementById('inquiry-name').value,
        email: document.getElementById('inquiry-email').value || '',
        bookingType: document.getElementById('inquiry-booking-type').value,
        dates: document.getElementById('inquiry-dates').value || '',
        headcount: document.getElementById('inquiry-headcount').value || '',
        source: document.getElementById('inquiry-source').value || '',
        description: document.getElementById('inquiry-description').value || '',
        stage: 'new',
        createdAt: new Date().toISOString()
    };
    inquiries.push(inquiry);
    TorchStorage.saveInquiries();
    closeModal('add-inquiry-modal');
    showToast('Inquiry logged', 'success');
    renderInquiryPipeline();
    event.target.reset();
}

function advanceInquiry(id) {
    const stages = ['new', 'nda-sent', 'nda-signed', 'rate-sent', 'negotiating', 'booked'];
    const inq = inquiries.find(i => i.id === id);
    if (inq) {
        const idx = stages.indexOf(inq.stage);
        if (idx < stages.length - 1) {
            inq.stage = stages[idx + 1];
            TorchStorage.saveInquiries();
            showToast('Inquiry advanced to ' + inq.stage.replace('-', ' '), 'success');
            renderInquiryPipeline();
        }
    }
}

function updateInquiryStage(id, stage) {
    const inq = inquiries.find(i => i.id === id);
    if (inq) {
        inq.stage = stage;
        TorchStorage.saveInquiries();
        showToast('Inquiry updated', 'success');
        renderInquiryPipeline();
    }
}

// ============================================
// TDP MEMBER PORTAL
// ============================================

function filterTdpMembers() { renderTdpMembers(); }

function renderTdpMembers() {
    const tbody = document.getElementById('tdp-members-tbody');
    const statsBar = document.getElementById('tdp-stats');
    if (!tbody) return;

    const search = (document.getElementById('tdp-search')?.value || '').toLowerCase();
    const tierFilter = document.getElementById('tdp-tier-filter')?.value || 'all';

    let filtered = [...tdpMembers];
    if (search) filtered = filtered.filter(m => m.name.toLowerCase().includes(search));
    if (tierFilter !== 'all') filtered = filtered.filter(m => m.tier === tierFilter);

    // Stats
    const totalMRR = tdpMembers.reduce((sum, m) => sum + (m.monthlyRate || 0), 0);
    if (statsBar) {
        statsBar.innerHTML = `
            <div class="linen-stat"><span class="linen-stat-num">${tdpMembers.length}</span><span class="linen-stat-label">Active Members</span></div>
            <div class="linen-stat" style="border-color:var(--primary);"><span class="linen-stat-num" style="color:var(--primary);">$${totalMRR.toLocaleString()}</span><span class="linen-stat-label">Monthly MRR</span></div>
        `;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);padding:40px;">No TDP members yet.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(m => {
        const tier = TIERS[m.tier] || {};
        const hoursTotal = tier.hours || 0;
        return `
        <tr>
            <td><strong>${escapeHTML(m.name)}</strong>${m.contact ? '<br><span style="font-size:11px;color:var(--text-secondary);">' + escapeHTML(m.contact) + '</span>' : ''}</td>
            <td><span class="type-badge">${m.tier}</span></td>
            <td>$${(m.monthlyRate || 0).toLocaleString()}</td>
            <td>${m.daysUsed || 0}</td>
            <td>${m.hoursUsed || 0} / ${hoursTotal}</td>
            <td>${m.renewalDate ? formatDate(m.renewalDate) : '—'}</td>
            <td><span class="status-badge ${m.status}">${m.status}</span></td>
            <td><button class="btn secondary small" onclick="deleteTdpMember('${m.id}')">Remove</button></td>
        </tr>`;
    }).join('');
}

function addTdpMember(event) {
    event.preventDefault();
    const tier = document.getElementById('tdp-tier').value;
    const isFounding = document.getElementById('tdp-founding').value === 'true';
    const tierData = TIERS[tier] || {};
    const rate = isFounding ? (tierData.foundingPrice || tierData.price) : tierData.price;

    const startDate = document.getElementById('tdp-start-date').value;
    const renewalDate = new Date(startDate);
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const member = {
        id: 'tdp-' + Date.now(),
        name: document.getElementById('tdp-name').value,
        contact: document.getElementById('tdp-contact').value || '',
        email: document.getElementById('tdp-email').value || '',
        tier: tier,
        monthlyRate: rate,
        founding: isFounding,
        startDate: startDate,
        renewalDate: renewalDate.toISOString().split('T')[0],
        daysUsed: 0,
        hoursUsed: 0,
        status: 'active',
        createdAt: new Date().toISOString()
    };
    tdpMembers.push(member);
    TorchStorage.saveTdpMembers();
    closeModal('add-tdp-member-modal');
    showToast('TDP member added', 'success');
    renderTdpMembers();
    event.target.reset();
}

function deleteTdpMember(id) {
    tdpMembers = tdpMembers.filter(m => m.id !== id);
    TorchStorage.saveTdpMembers();
    showToast('Member removed', 'success');
    renderTdpMembers();
}

// ============================================
// FINANCIALS — TAB SWITCHING
// ============================================

function switchFinTab(tab) {
    document.querySelectorAll('#invoices .ops-sub-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`#invoices .ops-sub-tab[data-ops-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');
    document.querySelectorAll('#invoices .ops-view').forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
    const view = document.getElementById(`ops-${tab}-view`);
    if (view) { view.style.display = 'block'; view.classList.add('active'); }

    if (tab === 'fin-invoices') loadInvoices();
    else if (tab === 'fin-expenses') loadExpenses();
    else if (tab === 'fin-barter') loadBarterItems();
    else if (tab === 'fin-pnl') loadPnlSummary();
}

// ============================================
// INVOICES
// ============================================

function loadInvoices() {
    const container = document.getElementById('invoices-list');
    const statsBar = document.getElementById('invoice-stats');
    if (!container) return;

    const statusFilter = document.getElementById('invoice-status-filter')?.value || 'all';
    const laneFilter = document.getElementById('invoice-lane-filter')?.value || 'all';

    let filtered = [...invoicesData];
    if (statusFilter !== 'all') filtered = filtered.filter(i => i.status === statusFilter);
    if (laneFilter !== 'all') filtered = filtered.filter(i => i.lane === laneFilter);

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Stats
    const totalPaid = invoicesData.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const totalPending = invoicesData.filter(i => i.status === 'sent' || i.status === 'deposit').reduce((s, i) => s + i.amount, 0);
    const totalOverdue = invoicesData.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);

    if (statsBar) {
        statsBar.innerHTML = `
            <div class="linen-stat pass"><span class="linen-stat-num">$${totalPaid.toLocaleString()}</span><span class="linen-stat-label">Collected</span></div>
            <div class="linen-stat"><span class="linen-stat-num">$${totalPending.toLocaleString()}</span><span class="linen-stat-label">Pending</span></div>
            <div class="linen-stat fail"><span class="linen-stat-num">$${totalOverdue.toLocaleString()}</span><span class="linen-stat-label">Overdue</span></div>
        `;
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No invoices</h4><p>Create your first invoice to start tracking revenue.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(inv => `
        <div class="maint-card">
            <div class="card-header">
                <h4>${escapeHTML(inv.client)}</h4>
                <span class="status-badge ${inv.status}">${inv.status}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge">${inv.lane}</span>
                <span style="font-weight:600;color:var(--primary);">$${inv.amount.toLocaleString()}</span>
                <span>Due: ${formatDate(inv.dueDate)}</span>
            </div>
            ${inv.description ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' + escapeHTML(inv.description) + '</p>' : ''}
            <div class="card-actions">
                ${inv.status === 'draft' ? `<button class="btn primary" onclick="updateInvoiceStatus('${inv.id}', 'sent')">Mark Sent</button>` : ''}
                ${inv.status === 'sent' ? `<button class="btn primary" onclick="updateInvoiceStatus('${inv.id}', 'deposit')">Deposit In</button>` : ''}
                ${inv.status === 'deposit' ? `<button class="btn primary" onclick="updateInvoiceStatus('${inv.id}', 'paid')">Paid in Full</button>` : ''}
                ${inv.status === 'sent' || inv.status === 'deposit' ? `<button class="btn secondary" onclick="updateInvoiceStatus('${inv.id}', 'overdue')">Mark Overdue</button>` : ''}
                <button class="btn secondary" onclick="deleteInvoice('${inv.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function addInvoice(event) {
    event.preventDefault();
    const inv = {
        id: 'inv-' + Date.now(),
        client: document.getElementById('invoice-client').value,
        lane: document.getElementById('invoice-lane').value,
        amount: parseFloat(document.getElementById('invoice-amount').value),
        dueDate: document.getElementById('invoice-due').value,
        description: document.getElementById('invoice-description').value || '',
        status: 'draft',
        createdAt: new Date().toISOString()
    };
    invoicesData.push(inv);
    TorchStorage.saveInvoicesData();
    closeModal('add-invoice-modal');
    showToast('Invoice created', 'success');
    loadInvoices();
    updateDashboardV2();
    event.target.reset();
}

function updateInvoiceStatus(id, status) {
    const inv = invoicesData.find(i => i.id === id);
    if (inv) {
        inv.status = status;
        if (status === 'paid') inv.paidAt = new Date().toISOString();
        TorchStorage.saveInvoicesData();
        showToast('Invoice ' + status, 'success');
        loadInvoices();
        updateDashboardV2();
    }
}

function deleteInvoice(id) {
    invoicesData = invoicesData.filter(i => i.id !== id);
    TorchStorage.saveInvoicesData();
    showToast('Invoice deleted', 'success');
    loadInvoices();
    updateDashboardV2();
}

// ============================================
// EXPENSES
// ============================================

function loadExpenses() {
    const container = document.getElementById('expenses-list');
    if (!container) return;

    const catFilter = document.getElementById('expense-category-filter')?.value || 'all';
    let filtered = [...expenses];
    if (catFilter !== 'all') filtered = filtered.filter(e => e.category === catFilter);
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No expenses logged</h4><p>Log expenses to track costs by category.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(e => `
        <div class="vendor-card">
            <div class="card-header">
                <h4>${escapeHTML(e.description)}</h4>
                <span style="font-weight:600;color:#ef4444;">-$${e.amount.toLocaleString()}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge">${e.category}</span>
                <span>${formatDate(e.date)}</span>
                ${e.vendor ? '<span>' + escapeHTML(e.vendor) + '</span>' : ''}
            </div>
            <div class="card-actions">
                <button class="btn secondary" onclick="deleteExpense('${e.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function addExpense(event) {
    event.preventDefault();
    const exp = {
        id: 'exp-' + Date.now(),
        description: document.getElementById('expense-description').value,
        category: document.getElementById('expense-category').value,
        amount: parseFloat(document.getElementById('expense-amount').value),
        date: document.getElementById('expense-date').value,
        vendor: document.getElementById('expense-vendor').value || '',
        createdAt: new Date().toISOString()
    };
    expenses.push(exp);
    TorchStorage.saveExpenses();
    closeModal('add-expense-modal');
    showToast('Expense logged', 'success');
    loadExpenses();
    event.target.reset();
}

function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    TorchStorage.saveExpenses();
    showToast('Expense deleted', 'success');
    loadExpenses();
}

// ============================================
// BARTER TRACKER
// ============================================

function loadBarterItems() {
    const container = document.getElementById('barter-list');
    if (!container) return;

    const statusFilter = document.getElementById('barter-status-filter')?.value || 'all';
    let filtered = [...barterItems];
    if (statusFilter !== 'all') filtered = filtered.filter(b => b.status === statusFilter);

    const statusOrder = { not_started: 0, in_progress: 1, completed: 2 };
    filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No barter items</h4><p>Track barter deliverables and exchange value here.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(b => `
        <div class="nate-card">
            <div class="card-header">
                <h4>${escapeHTML(b.deliverable)}</h4>
                <span class="status-badge ${b.status}">${b.status.replace('_', ' ')}</span>
            </div>
            <div class="card-meta">
                <span>Target: ${formatDate(b.targetDate)}</span>
                ${b.valueExchanged ? '<span>Value: ' + escapeHTML(b.valueExchanged) + '</span>' : ''}
            </div>
            ${b.notes ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' + escapeHTML(b.notes) + '</p>' : ''}
            <div class="card-actions">
                ${b.status === 'not_started' ? `<button class="btn primary" onclick="updateBarterStatus('${b.id}', 'in_progress')">Start</button>` : ''}
                ${b.status === 'in_progress' ? `<button class="btn primary" onclick="updateBarterStatus('${b.id}', 'completed')">Complete</button>` : ''}
                <button class="btn secondary" onclick="deleteBarterItem('${b.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function addBarterItem(event) {
    event.preventDefault();
    const item = {
        id: 'barter-' + Date.now(),
        deliverable: document.getElementById('barter-deliverable').value,
        targetDate: document.getElementById('barter-target-date').value,
        valueExchanged: document.getElementById('barter-value').value || '',
        notes: document.getElementById('barter-notes').value || '',
        status: 'not_started',
        createdAt: new Date().toISOString()
    };
    barterItems.push(item);
    TorchStorage.saveBarterItems();
    closeModal('add-barter-modal');
    showToast('Barter item added', 'success');
    loadBarterItems();
    event.target.reset();
}

function updateBarterStatus(id, status) {
    const item = barterItems.find(b => b.id === id);
    if (item) {
        item.status = status;
        TorchStorage.saveBarterItems();
        showToast('Barter item ' + status.replace('_', ' '), 'success');
        loadBarterItems();
    }
}

function deleteBarterItem(id) {
    barterItems = barterItems.filter(b => b.id !== id);
    TorchStorage.saveBarterItems();
    showToast('Barter item deleted', 'success');
    loadBarterItems();
}

// ============================================
// P&L SUMMARY
// ============================================

function loadPnlSummary() {
    const container = document.getElementById('pnl-summary');
    if (!container) return;

    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ label: d.toLocaleString('default', { month: 'long', year: 'numeric' }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    }

    container.innerHTML = months.map(m => {
        const monthRevenue = invoicesData.filter(i => i.status === 'paid' && i.paidAt && i.paidAt.startsWith(m.key)).reduce((s, i) => s + i.amount, 0);
        const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(m.key)).reduce((s, e) => s + e.amount, 0);
        const net = monthRevenue - monthExpenses;
        const netColor = net >= 0 ? 'var(--success)' : '#ef4444';

        return `
        <div class="card" style="margin-bottom:12px;">
            <h4>${m.label}</h4>
            <div style="display:flex;gap:24px;margin-top:8px;">
                <div><span style="font-size:11px;color:var(--text-secondary);display:block;">Revenue</span><span style="font-size:18px;font-weight:600;color:var(--success);">$${monthRevenue.toLocaleString()}</span></div>
                <div><span style="font-size:11px;color:var(--text-secondary);display:block;">Expenses</span><span style="font-size:18px;font-weight:600;color:#ef4444;">$${monthExpenses.toLocaleString()}</span></div>
                <div><span style="font-size:11px;color:var(--text-secondary);display:block;">Net</span><span style="font-size:18px;font-weight:600;color:${netColor};">$${net.toLocaleString()}</span></div>
            </div>
        </div>`;
    }).join('');
}

// ============================================
// GROWTH — TAB SWITCHING
// ============================================

function switchGrowthTab(tab) {
    document.querySelectorAll('#pipeline .ops-sub-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`#pipeline .ops-sub-tab[data-ops-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');
    document.querySelectorAll('#pipeline .ops-view').forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
    const view = document.getElementById(`ops-${tab}-view`);
    if (view) { view.style.display = 'block'; view.classList.add('active'); }

    if (tab === 'camp-outreach') loadCampOutreach();
    else if (tab === 'tdp-prospects') loadTdpProspects();
    else if (tab === 'marketing-cal') loadMarketingCalendar();
}

// ============================================
// CAMP OUTREACH
// ============================================

function loadCampOutreach() {
    const container = document.getElementById('outreach-list');
    if (!container) return;

    const stageFilter = document.getElementById('outreach-stage-filter')?.value || 'all';
    let filtered = [...campOutreach];
    if (stageFilter !== 'all') filtered = filtered.filter(c => c.stage === stageFilter);

    const stageOrder = { identified: 0, contacted: 1, in_conversation: 2, booked: 3, not_interested: 4 };
    filtered.sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage]);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No outreach contacts</h4><p>Add A&Rs, publishers, and managers to track camp outreach.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(c => `
        <div class="vendor-card">
            <div class="card-header">
                <h4>${escapeHTML(c.name)}</h4>
                <span class="status-badge ${c.stage}">${c.stage.replace('_', ' ')}</span>
            </div>
            <div class="card-meta">
                ${c.role ? '<span>' + escapeHTML(c.role) + '</span>' : ''}
                ${c.email ? '<span>' + escapeHTML(c.email) + '</span>' : ''}
                ${c.followUpDate ? '<span>Follow-up: ' + formatDate(c.followUpDate) + '</span>' : ''}
            </div>
            ${c.notes ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' + escapeHTML(c.notes) + '</p>' : ''}
            <div class="card-actions">
                ${c.stage === 'identified' ? `<button class="btn primary" onclick="updateOutreachStage('${c.id}', 'contacted')">Mark Contacted</button>` : ''}
                ${c.stage === 'contacted' ? `<button class="btn primary" onclick="updateOutreachStage('${c.id}', 'in_conversation')">In Conversation</button>` : ''}
                ${c.stage === 'in_conversation' ? `<button class="btn primary" onclick="updateOutreachStage('${c.id}', 'booked')">Booked!</button>` : ''}
                <button class="btn secondary" onclick="deleteOutreach('${c.id}')">Remove</button>
            </div>
        </div>
    `).join('');
}

function addOutreachContact(event) {
    event.preventDefault();
    const contact = {
        id: 'outreach-' + Date.now(),
        name: document.getElementById('outreach-name').value,
        role: document.getElementById('outreach-role').value || '',
        email: document.getElementById('outreach-email').value || '',
        followUpDate: document.getElementById('outreach-followup').value || '',
        notes: document.getElementById('outreach-notes').value || '',
        stage: 'identified',
        createdAt: new Date().toISOString()
    };
    campOutreach.push(contact);
    TorchStorage.saveCampOutreach();
    closeModal('add-outreach-modal');
    showToast('Contact added', 'success');
    loadCampOutreach();
    event.target.reset();
}

function updateOutreachStage(id, stage) {
    const c = campOutreach.find(x => x.id === id);
    if (c) { c.stage = stage; TorchStorage.saveCampOutreach(); showToast('Stage updated', 'success'); loadCampOutreach(); }
}

function deleteOutreach(id) {
    campOutreach = campOutreach.filter(c => c.id !== id);
    TorchStorage.saveCampOutreach();
    showToast('Contact removed', 'success');
    loadCampOutreach();
}

// ============================================
// TDP PROSPECTS
// ============================================

function loadTdpProspects() {
    const container = document.getElementById('prospects-list');
    if (!container) return;

    const stageFilter = document.getElementById('prospect-stage-filter')?.value || 'all';
    let filtered = [...tdpProspects];
    if (stageFilter !== 'all') filtered = filtered.filter(p => p.stage === stageFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No prospects</h4><p>Track labels and management companies in conversation for TDP membership.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(p => `
        <div class="nate-card">
            <div class="card-header">
                <h4>${escapeHTML(p.company)}</h4>
                <span class="status-badge ${p.stage}">${p.stage}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge">${p.targetTier}</span>
                ${p.contact ? '<span>' + escapeHTML(p.contact) + '</span>' : ''}
                ${p.email ? '<span>' + escapeHTML(p.email) + '</span>' : ''}
            </div>
            ${p.notes ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' + escapeHTML(p.notes) + '</p>' : ''}
            <div class="card-actions">
                <button class="btn secondary" onclick="deleteTdpProspect('${p.id}')">Remove</button>
            </div>
        </div>
    `).join('');
}

function addTdpProspect(event) {
    event.preventDefault();
    const prospect = {
        id: 'prospect-' + Date.now(),
        company: document.getElementById('prospect-company').value,
        targetTier: document.getElementById('prospect-tier').value,
        contact: document.getElementById('prospect-contact').value || '',
        email: document.getElementById('prospect-email').value || '',
        notes: document.getElementById('prospect-notes').value || '',
        stage: 'lead',
        createdAt: new Date().toISOString()
    };
    tdpProspects.push(prospect);
    TorchStorage.saveTdpProspects();
    closeModal('add-prospect-modal');
    showToast('Prospect added', 'success');
    loadTdpProspects();
    event.target.reset();
}

function deleteTdpProspect(id) {
    tdpProspects = tdpProspects.filter(p => p.id !== id);
    TorchStorage.saveTdpProspects();
    showToast('Prospect removed', 'success');
    loadTdpProspects();
}

// ============================================
// MARKETING CALENDAR
// ============================================

function loadMarketingCalendar() {
    const container = document.getElementById('marketing-list');
    if (!container) return;

    const statusFilter = document.getElementById('content-status-filter')?.value || 'all';
    const platformFilter = document.getElementById('content-platform-filter')?.value || 'all';

    let filtered = [...marketingCal];
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);
    if (platformFilter !== 'all') filtered = filtered.filter(c => c.platform === platformFilter);

    filtered.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No content planned</h4><p>Plan your marketing content across platforms.</p></div>';
        return;
    }

    container.innerHTML = filtered.map(c => `
        <div class="vendor-card">
            <div class="card-header">
                <h4>${escapeHTML(c.title)}</h4>
                <span class="status-badge ${c.status}">${c.status.replace('_', ' ')}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge">${c.platform}</span>
                ${c.format ? '<span>' + escapeHTML(c.format) + '</span>' : ''}
                <span>${formatDate(c.scheduledDate)}</span>
            </div>
            ${c.notes ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' + escapeHTML(c.notes) + '</p>' : ''}
            <div class="card-actions">
                ${c.status === 'planned' ? `<button class="btn primary" onclick="updateContentStatus('${c.id}', 'in_production')">In Production</button>` : ''}
                ${c.status === 'in_production' ? `<button class="btn primary" onclick="updateContentStatus('${c.id}', 'posted')">Posted</button>` : ''}
                <button class="btn secondary" onclick="deleteContent('${c.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function addContentItem(event) {
    event.preventDefault();
    const item = {
        id: 'content-' + Date.now(),
        title: document.getElementById('content-title').value,
        platform: document.getElementById('content-platform').value,
        format: document.getElementById('content-format').value || '',
        scheduledDate: document.getElementById('content-date').value,
        notes: document.getElementById('content-notes').value || '',
        status: 'planned',
        createdAt: new Date().toISOString()
    };
    marketingCal.push(item);
    TorchStorage.saveMarketingCal();
    closeModal('add-content-modal');
    showToast('Content added', 'success');
    loadMarketingCalendar();
    event.target.reset();
}

function updateContentStatus(id, status) {
    const c = marketingCal.find(x => x.id === id);
    if (c) { c.status = status; TorchStorage.saveMarketingCal(); showToast('Status updated', 'success'); loadMarketingCalendar(); }
}

function deleteContent(id) {
    marketingCal = marketingCal.filter(c => c.id !== id);
    TorchStorage.saveMarketingCal();
    showToast('Content deleted', 'success');
    loadMarketingCalendar();
}

// ============================================
// MILESTONES
// ============================================

function loadMilestones() {
    const container = document.getElementById('milestones-list');
    if (!container) return;

    let items = [...buildMilestones];
    const statusOrder = { in_progress: 0, not_started: 1, completed: 2 };
    items.sort((a, b) => (statusOrder[a.status] || 1) - (statusOrder[b.status] || 1));

    if (items.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No milestones</h4><p>Track Studio A, garage room, and other build milestones.</p></div>';
        return;
    }

    container.innerHTML = items.map(m => `
        <div class="nate-card">
            <div class="card-header">
                <h4>${escapeHTML(m.title)}</h4>
                <span class="status-badge ${m.status}">${m.status.replace('_', ' ')}</span>
            </div>
            <div class="card-meta">
                ${m.owner ? '<span>Owner: ' + escapeHTML(m.owner) + '</span>' : ''}
                <span>Target: ${formatDate(m.targetDate)}</span>
            </div>
            ${m.notes ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' + escapeHTML(m.notes) + '</p>' : ''}
            <div class="card-actions">
                ${m.status === 'not_started' ? `<button class="btn primary" onclick="updateMilestoneStatus('${m.id}', 'in_progress')">Start</button>` : ''}
                ${m.status === 'in_progress' ? `<button class="btn primary" onclick="updateMilestoneStatus('${m.id}', 'completed')">Complete</button>` : ''}
                <button class="btn secondary" onclick="deleteMilestone('${m.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function addMilestone(event) {
    event.preventDefault();
    const ms = {
        id: 'ms-' + Date.now(),
        title: document.getElementById('milestone-title').value,
        owner: document.getElementById('milestone-owner').value || '',
        targetDate: document.getElementById('milestone-target').value,
        notes: document.getElementById('milestone-notes').value || '',
        status: 'not_started',
        createdAt: new Date().toISOString()
    };
    buildMilestones.push(ms);
    TorchStorage.saveMilestones();
    closeModal('add-milestone-modal');
    showToast('Milestone added', 'success');
    loadMilestones();
    event.target.reset();
}

function updateMilestoneStatus(id, status) {
    const m = buildMilestones.find(x => x.id === id);
    if (m) { m.status = status; TorchStorage.saveMilestones(); showToast('Milestone updated', 'success'); loadMilestones(); }
}

function deleteMilestone(id) {
    buildMilestones = buildMilestones.filter(m => m.id !== id);
    TorchStorage.saveMilestones();
    showToast('Milestone deleted', 'success');
    loadMilestones();
}

// ============================================
// EQUIPMENT INVENTORY
// ============================================

function loadEquipment() {
    const container = document.getElementById('equipment-list');
    if (!container) return;

    if (equipmentInv.length === 0) {
        container.innerHTML = '<div class="ops-empty"><h4>No equipment logged</h4><p>Track studio equipment, condition, and location.</p></div>';
        return;
    }

    container.innerHTML = equipmentInv.map(e => `
        <div class="vendor-card">
            <div class="card-header">
                <h4>${escapeHTML(e.name)}</h4>
                <span class="status-badge ${e.condition}">${e.condition}</span>
            </div>
            <div class="card-meta">
                <span class="type-badge">${e.category}</span>
                <span>${e.location.replace('-', ' ')}</span>
            </div>
            ${e.notes ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px;">' + escapeHTML(e.notes) + '</p>' : ''}
            <div class="card-actions">
                <button class="btn secondary" onclick="deleteEquipment('${e.id}')">Remove</button>
            </div>
        </div>
    `).join('');
}

function addEquipmentItem(event) {
    event.preventDefault();
    const item = {
        id: 'equip-' + Date.now(),
        name: document.getElementById('equip-name').value,
        location: document.getElementById('equip-location').value,
        category: document.getElementById('equip-category').value,
        condition: document.getElementById('equip-condition').value,
        notes: document.getElementById('equip-notes').value || '',
        createdAt: new Date().toISOString()
    };
    equipmentInv.push(item);
    TorchStorage.saveEquipment();
    closeModal('add-equipment-modal');
    showToast('Equipment added', 'success');
    loadEquipment();
    event.target.reset();
}

function deleteEquipment(id) {
    equipmentInv = equipmentInv.filter(e => e.id !== id);
    TorchStorage.saveEquipment();
    showToast('Equipment removed', 'success');
    loadEquipment();
}

// ============================================
// SEED MILESTONES ON INIT
// ============================================

function initNewModules() {
    if (buildMilestones.length === 0 && typeof SEED_MILESTONES !== 'undefined') {
        buildMilestones = JSON.parse(JSON.stringify(SEED_MILESTONES));
        TorchStorage.saveMilestones();
        console.log('[OpsHub] Seeded milestones');
    }
    // Load priority flag
    const storedFlag = TorchStorage.load(TorchStorage.KEYS.PRIORITY_FLAG);
    if (storedFlag) priorityFlag = storedFlag;

    // Call dashboard update
    setTimeout(updateDashboardV2, 600);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initNewModules, 600);
});
