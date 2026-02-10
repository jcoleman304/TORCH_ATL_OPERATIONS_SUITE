// TORCH ATL Operations Suite - Application Logic

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

function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-container').style.display = 'flex';

    // Update UI based on role
    applyRoleBasedUI();

    // Initialize app
    initNavigation();
    initCountdown();

    if (currentAdminUser.role === 'admin') {
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
    } else {
        // Engineer view
        renderEngineerCalendar();
        renderEngineerUpcomingSessions();
        renderPendingRequests();
        renderMyReports();
    }

    // Update user info in sidebar
    document.getElementById('current-user-name').textContent = currentAdminUser.name;
    document.getElementById('current-user-role').textContent = currentAdminUser.role === 'admin' ? 'Administrator' : 'Engineer';
}

function handleAdminLogin(event) {
    event.preventDefault();

    const email = document.getElementById('admin-email').value;
    const code = document.getElementById('admin-code').value;

    const result = TorchAPI.login(email, code);

    if (result.success) {
        showToast(`Welcome, ${result.user.name}!`, 'success');
        showApp();
    } else {
        showToast(result.errors[0], 'error');
    }
}

function handleLogout() {
    TorchAPI.logout();
    showLogin();
    showToast('Logged out successfully', 'info');
}

function applyRoleBasedUI() {
    const isAdmin = currentAdminUser.role === 'admin';

    // Show/hide elements based on role
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });

    document.querySelectorAll('.engineer-only').forEach(el => {
        el.style.display = isAdmin ? 'none' : '';
    });

    // Set default active tab based on role
    if (isAdmin) {
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
function updateDashboard() {
    const activeMembers = members.filter(m => m.status === 'Active');
    const totalMRR = activeMembers.reduce((sum, m) => sum + m.monthlyRate, 0);
    const weeklyBookings = bookings.filter(b => {
        const bookingDate = new Date(b.date);
        const today = new Date();
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return bookingDate >= today && bookingDate <= weekFromNow;
    });

    document.getElementById('total-members').textContent = activeMembers.length;
    document.getElementById('total-mrr').textContent = '$' + totalMRR.toLocaleString();
    document.getElementById('weekly-sessions').textContent = weeklyBookings.length;

    // Calculate utilization
    const totalHoursBooked = bookings.reduce((sum, b) => sum + b.hours, 0);
    const maxMonthlyHours = 30 * 16; // 30 days * 16 hours
    const utilization = Math.round((totalHoursBooked / maxMonthlyHours) * 100);
    document.getElementById('utilization').textContent = utilization + '%';

    // Update tier bars
    const tierCounts = { Residency: 0, Member: 0, Session: 0 };
    activeMembers.forEach(m => tierCounts[m.tier]++);

    document.getElementById('bar-residency').style.width = (tierCounts.Residency / TIERS.Residency.cap * 100) + '%';
    document.getElementById('bar-member').style.width = (tierCounts.Member / TIERS.Member.cap * 100) + '%';
    document.getElementById('bar-session').style.width = (tierCounts.Session / TIERS.Session.cap * 100) + '%';

    document.getElementById('count-residency').textContent = `${tierCounts.Residency}/${TIERS.Residency.cap}`;
    document.getElementById('count-member').textContent = `${tierCounts.Member}/${TIERS.Member.cap}`;
    document.getElementById('count-session').textContent = `${tierCounts.Session}/${TIERS.Session.cap}`;

    // Render upcoming sessions
    const upcomingSessions = bookings
        .filter(b => new Date(b.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    const sessionsHtml = upcomingSessions.map(b => `
        <div class="session-item">
            <div>
                <div class="member-name">${b.memberName}</div>
                <div class="session-time">${formatDate(b.date)} • ${formatTime(b.startTime)} - ${formatTime(b.endTime)}</div>
            </div>
            <span class="tier-badge ${members.find(m => m.id === b.memberId)?.tier.toLowerCase()}">${b.type}</span>
        </div>
    `).join('');
    document.getElementById('upcoming-sessions').innerHTML = sessionsHtml || '<p class="text-muted">No upcoming sessions</p>';

    // Render activity feed
    const activityHtml = activityFeed.map(a => `
        <div class="activity-item">
            <span>${a.text}</span>
            <span class="time">${a.time}</span>
        </div>
    `).join('');
    document.getElementById('activity-feed').innerHTML = activityHtml;
}

// Members Table
function renderMembersTable() {
    const tbody = document.getElementById('members-tbody');
    tbody.innerHTML = members.map(m => `
        <tr data-tier="${m.tier}" data-status="${m.status}" data-name="${m.name.toLowerCase()}">
            <td>
                <div style="display: flex; flex-direction: column;">
                    <strong>${m.name}</strong>
                    <small style="color: var(--text-secondary)">${m.email}</small>
                </div>
            </td>
            <td><span class="tier-badge ${m.tier.toLowerCase()}">${m.tier}</span></td>
            <td><span class="status-badge ${m.status.toLowerCase()}">${m.status}</span></td>
            <td>${m.hoursUsed}/${m.hoursTotal} hrs</td>
            <td>$${m.monthlyRate.toLocaleString()}${m.founding ? ' <small>(founding)</small>' : ''}</td>
            <td>${formatDate(m.startDate)}</td>
            <td>
                <button class="action-btn" onclick="viewMember(${m.id})">View</button>
                <button class="action-btn" onclick="editMember(${m.id})">Edit</button>
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
function addMember(event) {
    event.preventDefault();

    const tier = document.getElementById('new-member-tier').value;
    const isFoundng = document.getElementById('new-member-founding').value === 'yes';
    const tierConfig = TIERS[tier];

    const newMember = {
        id: members.length + 1,
        name: document.getElementById('new-member-name').value,
        email: document.getElementById('new-member-email').value,
        phone: document.getElementById('new-member-phone').value,
        tier: tier,
        status: 'Pending',
        hoursUsed: 0,
        hoursTotal: tierConfig.hours,
        monthlyRate: isFoundng ? tierConfig.foundingPrice : tierConfig.price,
        startDate: new Date().toISOString().split('T')[0],
        company: document.getElementById('new-member-company').value,
        founding: isFoundng,
        accessCode: '',
        notes: document.getElementById('new-member-notes').value
    };

    members.push(newMember);
    renderMembersTable();
    updateDashboard();
    populateMemberDropdowns();
    closeModal('add-member-modal');
    showToast('Member added successfully', 'success');
}

function viewMember(id) {
    const member = members.find(m => m.id === id);
    showToast(`Viewing ${member.name}`, 'info');
}

function editMember(id) {
    const member = members.find(m => m.id === id);
    showToast(`Editing ${member.name}`, 'info');
}

// Bookings
function renderBookingsTable() {
    const tbody = document.getElementById('bookings-tbody');
    tbody.innerHTML = bookings.map(b => `
        <tr>
            <td>${formatDate(b.date)}</td>
            <td>${formatTime(b.startTime)} - ${formatTime(b.endTime)}</td>
            <td>${b.memberName}</td>
            <td>${b.hours} hrs</td>
            <td>${b.guests}</td>
            <td><span class="status-badge active">${b.status}</span></td>
            <td>
                <button class="action-btn" onclick="viewBooking(${b.id})">View</button>
                <button class="action-btn" onclick="cancelBooking(${b.id})">Cancel</button>
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
    document.getElementById('booking-date').value = dateStr;
    openModal('add-booking-modal');
}

function addBooking(event) {
    event.preventDefault();

    const memberId = parseInt(document.getElementById('booking-member').value);
    const member = members.find(m => m.id === memberId);

    const startTime = document.getElementById('booking-start').value;
    const endTime = document.getElementById('booking-end').value;
    const hours = calculateHours(startTime, endTime);

    const newBooking = {
        id: bookings.length + 1,
        memberId: memberId,
        memberName: member.name,
        date: document.getElementById('booking-date').value,
        startTime: startTime,
        endTime: endTime,
        hours: hours,
        guests: parseInt(document.getElementById('booking-guests').value),
        guestNames: document.getElementById('booking-guest-names').value.split('\n').filter(n => n.trim()),
        type: document.getElementById('booking-type').value,
        status: 'Confirmed'
    };

    bookings.push(newBooking);
    renderBookingsTable();
    renderCalendar();
    updateDashboard();
    closeModal('add-booking-modal');
    showToast('Booking created successfully', 'success');
}

function calculateHours(start, end) {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let hours = endH - startH + (endM - startM) / 60;
    if (hours < 0) hours += 24; // Handle overnight
    return Math.round(hours);
}

function viewBooking(id) {
    const booking = bookings.find(b => b.id === id);
    showToast(`Viewing booking for ${booking.memberName}`, 'info');
}

function cancelBooking(id) {
    const index = bookings.findIndex(b => b.id === id);
    if (index > -1) {
        bookings.splice(index, 1);
        renderBookingsTable();
        renderCalendar();
        updateDashboard();
        showToast('Booking cancelled', 'success');
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
            <div class="message">${sms.message.substring(0, 60)}${sms.message.length > 60 ? '...' : ''}</div>
            <div class="meta">${sms.recipients} • ${sms.sentAt}</div>
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
                <span class="subject">${e.subject}</span>
                <span class="recipients">${e.recipients}</span>
                <span class="date">${e.sentAt}</span>
            </div>
        `).join('');
    } else if (tab === 'scheduled') {
        html = emailHistory.scheduled.map(e => `
            <div class="email-item">
                <span class="subject">${e.subject}</span>
                <span class="recipients">${e.recipients}</span>
                <span class="date">Scheduled: ${e.scheduledFor}</span>
            </div>
        `).join('');
    } else if (tab === 'drafts') {
        html = emailHistory.drafts.map(e => `
            <div class="email-item">
                <span class="subject">${e.subject}</span>
                <span class="date">Last edited: ${e.lastEdited}</span>
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
        <span>${message}</span>
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
        <option value="${m.id}">${m.name} (${m.tier})</option>
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
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
// ENGINEER MANAGEMENT (Admin)
// ============================================

function renderEngineersTable() {
    const tbody = document.getElementById('engineers-tbody');
    if (!tbody) return;

    // Update stats
    const activeEngineers = engineers.filter(e => e.status === 'Active').length;
    document.getElementById('active-engineers-count').textContent = activeEngineers;

    const today = new Date().toISOString().split('T')[0];
    const sessionsToday = bookings.filter(b => b.date === today && b.engineerId).length;
    document.getElementById('engineer-sessions-today').textContent = sessionsToday;

    const pendingRequests = bookings.filter(b =>
        b.engineerStatus === 'assigned' || b.engineerStatus === 'requested'
    ).length;
    document.getElementById('pending-engineer-requests').textContent = pendingRequests;

    tbody.innerHTML = engineers.map(e => `
        <tr>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <strong>${e.name}</strong>
                    <small style="color: var(--text-secondary)">${e.email}</small>
                </div>
            </td>
            <td><span class="role-badge ${e.role === 'Lead Engineer' ? 'lead' : 'standard'}">${e.role}</span></td>
            <td>${e.specialties.join(', ')}</td>
            <td><span class="status-badge ${e.status.toLowerCase()}">${e.status}</span></td>
            <td>$${e.rate}/hr</td>
            <td>
                <button class="action-btn" onclick="viewEngineer(${e.id})">View</button>
                <button class="action-btn" onclick="editEngineer(${e.id})">Edit</button>
            </td>
        </tr>
    `).join('');
}

function addEngineer(event) {
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

    const result = TorchAPI.createEngineer(engineerData);

    if (result.success) {
        closeModal('add-engineer-modal');
        renderEngineersTable();
        showToast(`Engineer ${result.engineer.name} added successfully`, 'success');

        // Reset form
        document.getElementById('add-engineer-modal').querySelector('form').reset();
    } else {
        showToast(result.errors[0], 'error');
    }
}

function viewEngineer(id) {
    const engineer = engineers.find(e => e.id === id);
    if (engineer) {
        showToast(`Viewing ${engineer.name}`, 'info');
    }
}

function editEngineer(id) {
    const engineer = engineers.find(e => e.id === id);
    if (engineer) {
        showToast(`Editing ${engineer.name}`, 'info');
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
                    <h4>${r.memberName}</h4>
                    <span class="report-date">${formatDate(r.sessionDate)}</span>
                </div>
                <span class="status-badge ${r.status}">${r.status}</span>
            </div>
            <div class="report-meta">
                <span>Engineer: ${r.engineerName}</span>
                <span>Hours: ${r.actualHours}</span>
                <span>Quality: ${'★'.repeat(r.sessionQuality)}${'☆'.repeat(5 - r.sessionQuality)}</span>
            </div>
            <p class="report-notes">${r.notes ? r.notes.substring(0, 100) + (r.notes.length > 100 ? '...' : '') : 'No notes'}</p>
            <button class="btn secondary small" onclick="viewReport(${r.id})">View Details</button>
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
    const report = sessionReports.find(r => r.id === reportId);
    if (!report) return;

    currentViewingReportId = reportId;

    const content = document.getElementById('view-report-content');
    content.innerHTML = `
        <div class="report-detail-grid">
            <div class="detail-section">
                <h4>Session Information</h4>
                <div class="detail-row"><span>Member:</span><span>${report.memberName}</span></div>
                <div class="detail-row"><span>Date:</span><span>${formatDate(report.sessionDate)}</span></div>
                <div class="detail-row"><span>Time:</span><span>${formatTime(report.actualStartTime)} - ${formatTime(report.actualEndTime)}</span></div>
                <div class="detail-row"><span>Hours:</span><span>${report.actualHours}</span></div>
                <div class="detail-row"><span>Work Type:</span><span>${report.workType}</span></div>
                <div class="detail-row"><span>Project:</span><span>${report.projectName || 'N/A'}</span></div>
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

function markReportReviewed() {
    if (!currentViewingReportId) return;

    const result = TorchAPI.reviewSessionReport(currentViewingReportId, currentAdminUser.name);

    if (result.success) {
        closeModal('view-report-modal');
        renderSessionReportsReview();
        showToast('Report marked as reviewed', 'success');
    } else {
        showToast(result.errors[0], 'error');
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
                <div class="member-name">${b.memberName}</div>
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
                <h4>${b.memberName}</h4>
                <span class="request-type">${b.type}</span>
            </div>
            <div class="request-details">
                <div class="detail"><span>📅</span> ${formatDate(b.date)}</div>
                <div class="detail"><span>⏰</span> ${formatTime(b.startTime)} - ${formatTime(b.endTime)}</div>
                <div class="detail"><span>⏱️</span> ${b.hours} hours</div>
                <div class="detail"><span>👥</span> ${b.guests} guests</div>
            </div>
            <div class="request-actions">
                <button class="btn primary" onclick="acceptRequest(${b.id})">Accept</button>
                <button class="btn secondary" onclick="declineRequest(${b.id})">Decline</button>
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
                        <h4>${b.memberName}</h4>
                        <span class="report-date">${formatDate(b.date)}</span>
                    </div>
                    <span class="status-badge pending">Needs Report</span>
                </div>
                <div class="report-meta">
                    <span>${formatTime(b.startTime)} - ${formatTime(b.endTime)}</span>
                    <span>${b.hours} hours</span>
                    <span>${b.type}</span>
                </div>
                <button class="btn primary" onclick="openReportForm(${b.id})">Submit Report</button>
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
            <div class="report-card ${r.status}">
                <div class="report-header">
                    <div>
                        <h4>${r.memberName}</h4>
                        <span class="report-date">${formatDate(r.sessionDate)}</span>
                    </div>
                    <span class="status-badge ${r.status}">${r.status}</span>
                </div>
                <div class="report-meta">
                    <span>Hours: ${r.actualHours}</span>
                    <span>Quality: ${'★'.repeat(r.sessionQuality)}</span>
                </div>
                <button class="btn secondary small" onclick="viewReport(${r.id})">View</button>
            </div>
        `).join('');
    }
}

function openReportForm(bookingId) {
    const booking = bookings.find(b => b.id === bookingId);
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

function submitSessionReport(event) {
    event.preventDefault();

    const bookingId = parseInt(document.getElementById('report-booking-id').value);
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

    const createResult = TorchAPI.createSessionReport(reportData);

    if (!createResult.success) {
        showToast(createResult.errors[0], 'error');
        return;
    }

    const submitResult = TorchAPI.submitSessionReport(createResult.report.id);

    if (submitResult.success) {
        closeModal('session-report-modal');
        renderMyReports();
        showToast('Report submitted successfully!', 'success');
    } else {
        showToast(submitResult.errors[0], 'error');
    }
}

function saveReportDraft() {
    showToast('Draft saved', 'info');
}
