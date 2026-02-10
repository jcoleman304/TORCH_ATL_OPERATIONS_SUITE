// TORCH ATL Operations Suite - Automation Engine

const TorchAutomation = {
    // Automation state
    isRunning: false,
    intervals: {},
    scheduledTasks: [],

    // Configuration
    config: {
        reminderHoursBefore: 24,        // Send reminder 24 hours before session
        hourWarningThreshold: 80,        // Warn at 80% hours used
        dailyReportTime: '08:00',        // Daily report time
        weeklyReportDay: 1,              // Monday (0 = Sunday)
        weeklyReportTime: '09:00',       // Weekly report time
        checkIntervalMinutes: 15         // How often to check for automation tasks
    },

    // Initialize automation engine
    init() {
        console.log('[TorchAutomation] Initializing automation engine...');

        // Load scheduled tasks from storage
        this.loadScheduledTasks();

        // Start automation loops
        this.start();

        console.log('[TorchAutomation] Automation engine initialized');
        return this;
    },

    // Start all automation processes
    start() {
        if (this.isRunning) {
            console.log('[TorchAutomation] Already running');
            return;
        }

        this.isRunning = true;

        // Check for reminders every 15 minutes
        this.intervals.reminders = setInterval(() => {
            this.checkSessionReminders();
        }, this.config.checkIntervalMinutes * 60 * 1000);

        // Check for hour warnings every hour
        this.intervals.hourWarnings = setInterval(() => {
            this.checkHourWarnings();
        }, 60 * 60 * 1000);

        // Check for scheduled emails every minute
        this.intervals.scheduledEmails = setInterval(() => {
            this.processScheduledEmails();
        }, 60 * 1000);

        // Check for daily/weekly reports every minute
        this.intervals.reports = setInterval(() => {
            this.checkReportSchedule();
        }, 60 * 1000);

        // Check payment status daily
        this.intervals.payments = setInterval(() => {
            this.checkPaymentStatus();
        }, 24 * 60 * 60 * 1000);

        // Run initial checks
        this.runInitialChecks();

        console.log('[TorchAutomation] Automation started');
    },

    // Stop all automation processes
    stop() {
        Object.values(this.intervals).forEach(interval => {
            clearInterval(interval);
        });
        this.intervals = {};
        this.isRunning = false;
        console.log('[TorchAutomation] Automation stopped');
    },

    // Run initial checks on startup
    runInitialChecks() {
        console.log('[TorchAutomation] Running initial checks...');
        this.checkSessionReminders();
        this.checkHourWarnings();
        this.checkMonthlyReset();
    },

    // ==================== SESSION REMINDERS ====================

    // Check for upcoming sessions and send reminders
    checkSessionReminders() {
        const now = new Date();
        const reminderWindow = new Date(now.getTime() + this.config.reminderHoursBefore * 60 * 60 * 1000);

        const upcomingSessions = bookings.filter(b => {
            const bookingDateTime = new Date(`${b.date}T${b.startTime}`);
            return bookingDateTime > now &&
                bookingDateTime <= reminderWindow &&
                b.status === 'Confirmed' &&
                !this.hasReminderBeenSent(b.id);
        });

        upcomingSessions.forEach(booking => {
            this.sendSessionReminder(booking);
        });

        if (upcomingSessions.length > 0) {
            console.log(`[TorchAutomation] Sent ${upcomingSessions.length} session reminders`);
        }
    },

    // Send reminder for a session
    sendSessionReminder(booking) {
        const member = members.find(m => m.id === booking.memberId);
        if (!member) return;

        // Format time for display
        const timeStr = this.formatTime(booking.startTime);
        const dateStr = this.formatDate(booking.date);

        // Log the reminder (in production, this would actually send SMS/email)
        console.log(`[TorchAutomation] Session Reminder:
            To: ${member.name} (${member.phone})
            Session: ${dateStr} at ${timeStr}
            Duration: ${booking.hours} hours
            Type: ${booking.type}`);

        // Create SMS record
        if (typeof TorchAPI !== 'undefined') {
            TorchAPI.sendSMS({
                message: `Hey ${member.name.split(' ')[0]}, reminder: you're booked at Torch tomorrow at ${timeStr}. See you then.`,
                recipients: member.name
            });
        }

        // Mark reminder as sent
        this.markReminderSent(booking.id);

        // Trigger webhook
        this.triggerAutomationEvent('reminderSent', {
            bookingId: booking.id,
            memberId: member.id,
            memberName: member.name,
            date: booking.date,
            time: booking.startTime
        });
    },

    // Check if reminder has been sent for a booking
    hasReminderBeenSent(bookingId) {
        const sentReminders = this.loadFromStorage('sentReminders') || {};
        return !!sentReminders[bookingId];
    },

    // Mark reminder as sent
    markReminderSent(bookingId) {
        const sentReminders = this.loadFromStorage('sentReminders') || {};
        sentReminders[bookingId] = new Date().toISOString();
        this.saveToStorage('sentReminders', sentReminders);
    },

    // ==================== HOUR WARNINGS ====================

    // Check all members for hour usage warnings
    checkHourWarnings() {
        const activeMembers = members.filter(m => m.status === 'Active');
        const warnings = [];

        activeMembers.forEach(member => {
            const percentUsed = (member.hoursUsed / member.hoursTotal) * 100;

            if (percentUsed >= this.config.hourWarningThreshold && percentUsed < 100) {
                // Check if warning already sent this month
                if (!this.hasHourWarningSentThisMonth(member.id)) {
                    this.sendHourWarning(member, percentUsed);
                    warnings.push(member.name);
                }
            }
        });

        if (warnings.length > 0) {
            console.log(`[TorchAutomation] Sent hour warnings to: ${warnings.join(', ')}`);
        }
    },

    // Send hour warning to member
    sendHourWarning(member, percentUsed) {
        const hoursRemaining = member.hoursTotal - member.hoursUsed;

        console.log(`[TorchAutomation] Hour Warning:
            To: ${member.name}
            Hours Used: ${member.hoursUsed}/${member.hoursTotal}
            Percent Used: ${Math.round(percentUsed)}%
            Remaining: ${hoursRemaining} hours`);

        // Send SMS notification
        if (typeof TorchAPI !== 'undefined') {
            TorchAPI.sendSMS({
                message: `Hi ${member.name.split(' ')[0]}, you've used ${Math.round(percentUsed)}% of your monthly Torch hours. ${hoursRemaining} hours remaining.`,
                recipients: member.name
            });
        }

        // Mark warning as sent
        this.markHourWarningSent(member.id);

        this.triggerAutomationEvent('hourWarningSent', {
            memberId: member.id,
            memberName: member.name,
            percentUsed: Math.round(percentUsed),
            hoursRemaining: hoursRemaining
        });
    },

    // Check if hour warning was sent this month
    hasHourWarningSentThisMonth(memberId) {
        const sentWarnings = this.loadFromStorage('sentHourWarnings') || {};
        const lastWarning = sentWarnings[memberId];

        if (!lastWarning) return false;

        const lastWarningDate = new Date(lastWarning);
        const now = new Date();

        return lastWarningDate.getMonth() === now.getMonth() &&
            lastWarningDate.getFullYear() === now.getFullYear();
    },

    // Mark hour warning as sent
    markHourWarningSent(memberId) {
        const sentWarnings = this.loadFromStorage('sentHourWarnings') || {};
        sentWarnings[memberId] = new Date().toISOString();
        this.saveToStorage('sentHourWarnings', sentWarnings);
    },

    // ==================== PAYMENT MONITORING ====================

    // Check payment status for all members
    checkPaymentStatus() {
        console.log('[TorchAutomation] Checking payment status...');

        // In a real implementation, this would check with payment processor
        // For now, we'll simulate by checking member status

        const membersNeedingAttention = members.filter(m =>
            m.status === 'Pending' ||
            m.status === 'Suspended'
        );

        membersNeedingAttention.forEach(member => {
            this.triggerAutomationEvent('paymentAttentionNeeded', {
                memberId: member.id,
                memberName: member.name,
                status: member.status
            });
        });

        if (membersNeedingAttention.length > 0) {
            console.log(`[TorchAutomation] ${membersNeedingAttention.length} members need payment attention`);
        }
    },

    // ==================== REPORT GENERATION ====================

    // Check if it's time to generate reports
    checkReportSchedule() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = now.getDay();

        // Daily report
        if (currentTime === this.config.dailyReportTime && !this.hasReportRanToday('daily')) {
            this.generateDailyReport();
            this.markReportRan('daily');
        }

        // Weekly report (on configured day)
        if (currentDay === this.config.weeklyReportDay &&
            currentTime === this.config.weeklyReportTime &&
            !this.hasReportRanThisWeek('weekly')) {
            this.generateWeeklyReport();
            this.markReportRan('weekly');
        }
    },

    // Generate daily report
    generateDailyReport() {
        const today = new Date().toISOString().split('T')[0];
        const todaysBookings = bookings.filter(b => b.date === today);
        const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const tomorrowsBookings = bookings.filter(b => b.date === tomorrowDate);

        const activeMembers = members.filter(m => m.status === 'Active');
        const totalMRR = activeMembers.reduce((sum, m) => sum + m.monthlyRate, 0);

        const report = {
            type: 'daily',
            date: today,
            generatedAt: new Date().toISOString(),
            summary: {
                todaysBookings: todaysBookings.length,
                tomorrowsBookings: tomorrowsBookings.length,
                activeMembers: activeMembers.length,
                mrr: totalMRR
            },
            todaysSessions: todaysBookings.map(b => ({
                member: b.memberName,
                time: `${b.startTime} - ${b.endTime}`,
                type: b.type
            })),
            tomorrowsSessions: tomorrowsBookings.map(b => ({
                member: b.memberName,
                time: `${b.startTime} - ${b.endTime}`,
                type: b.type
            }))
        };

        console.log('[TorchAutomation] Daily Report:', report);

        this.triggerAutomationEvent('dailyReportGenerated', report);

        return report;
    },

    // Generate weekly report
    generateWeeklyReport() {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];

        const weekBookings = bookings.filter(b =>
            b.date >= weekAgoStr && b.date <= todayStr
        );

        const totalHours = weekBookings.reduce((sum, b) => sum + b.hours, 0);

        // Count by tier
        const tierUsage = {};
        weekBookings.forEach(b => {
            const member = members.find(m => m.id === b.memberId);
            if (member) {
                tierUsage[member.tier] = (tierUsage[member.tier] || 0) + b.hours;
            }
        });

        // Count by type
        const typeUsage = {};
        weekBookings.forEach(b => {
            typeUsage[b.type] = (typeUsage[b.type] || 0) + b.hours;
        });

        const activeMembers = members.filter(m => m.status === 'Active');
        const newMembers = members.filter(m => {
            const startDate = new Date(m.startDate);
            return startDate >= weekAgo && startDate <= now;
        });

        const report = {
            type: 'weekly',
            weekStart: weekAgoStr,
            weekEnd: todayStr,
            generatedAt: new Date().toISOString(),
            summary: {
                totalSessions: weekBookings.length,
                totalHours: totalHours,
                activeMembers: activeMembers.length,
                newMembers: newMembers.length,
                mrr: activeMembers.reduce((sum, m) => sum + m.monthlyRate, 0)
            },
            hoursByTier: tierUsage,
            hoursByType: typeUsage,
            topMembers: this.getTopMembersByUsage(weekBookings),
            utilization: this.calculateWeeklyUtilization(totalHours)
        };

        console.log('[TorchAutomation] Weekly Report:', report);

        this.triggerAutomationEvent('weeklyReportGenerated', report);

        return report;
    },

    // Get top members by usage
    getTopMembersByUsage(bookingsList) {
        const memberHours = {};

        bookingsList.forEach(b => {
            memberHours[b.memberName] = (memberHours[b.memberName] || 0) + b.hours;
        });

        return Object.entries(memberHours)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, hours]) => ({ name, hours }));
    },

    // Calculate weekly utilization
    calculateWeeklyUtilization(totalHours) {
        // Assuming studio is available 16 hours/day, 7 days/week
        const maxHours = 16 * 7;
        return Math.round((totalHours / maxHours) * 100);
    },

    // Check if report has already run today
    hasReportRanToday(reportType) {
        const reportLog = this.loadFromStorage('reportLog') || {};
        const lastRun = reportLog[reportType];

        if (!lastRun) return false;

        const lastRunDate = new Date(lastRun);
        const now = new Date();

        return lastRunDate.toDateString() === now.toDateString();
    },

    // Check if report has run this week
    hasReportRanThisWeek(reportType) {
        const reportLog = this.loadFromStorage('reportLog') || {};
        const lastRun = reportLog[reportType];

        if (!lastRun) return false;

        const lastRunDate = new Date(lastRun);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return lastRunDate > weekAgo;
    },

    // Mark report as ran
    markReportRan(reportType) {
        const reportLog = this.loadFromStorage('reportLog') || {};
        reportLog[reportType] = new Date().toISOString();
        this.saveToStorage('reportLog', reportLog);
    },

    // ==================== SCHEDULED EMAILS ====================

    // Process scheduled emails
    processScheduledEmails() {
        const now = new Date();
        const currentDateTime = now.toISOString().slice(0, 16).replace('T', ' ');

        const emailsToSend = emailHistory.scheduled.filter(e => {
            const scheduledTime = e.scheduledFor.replace('T', ' ').slice(0, 16);
            return scheduledTime <= currentDateTime;
        });

        emailsToSend.forEach(email => {
            this.sendScheduledEmail(email);
        });
    },

    // Send a scheduled email
    sendScheduledEmail(scheduledEmail) {
        console.log(`[TorchAutomation] Sending scheduled email: ${scheduledEmail.subject}`);

        // Move from scheduled to sent
        const index = emailHistory.scheduled.findIndex(e => e.id === scheduledEmail.id);
        if (index > -1) {
            emailHistory.scheduled.splice(index, 1);

            const sentEmail = {
                ...scheduledEmail,
                sentAt: new Date().toLocaleDateString(),
                opens: 0,
                clicks: 0
            };
            delete sentEmail.scheduledFor;

            emailHistory.sent.unshift(sentEmail);

            if (typeof TorchStorage !== 'undefined') {
                TorchStorage.saveEmailHistory();
            }

            this.triggerAutomationEvent('scheduledEmailSent', sentEmail);
        }
    },

    // Schedule a new email
    scheduleEmail(emailData) {
        this.scheduledTasks.push({
            type: 'email',
            data: emailData,
            scheduledFor: emailData.scheduledFor,
            createdAt: new Date().toISOString()
        });

        this.saveScheduledTasks();

        console.log(`[TorchAutomation] Email scheduled for ${emailData.scheduledFor}`);
    },

    // ==================== MONTHLY RESET ====================

    // Check if monthly reset is needed
    checkMonthlyReset() {
        const now = new Date();
        const lastReset = this.loadFromStorage('lastMonthlyReset');

        if (!lastReset) {
            this.saveToStorage('lastMonthlyReset', now.toISOString());
            return;
        }

        const lastResetDate = new Date(lastReset);

        // Check if we're in a new month
        if (now.getMonth() !== lastResetDate.getMonth() ||
            now.getFullYear() !== lastResetDate.getFullYear()) {

            // It's a new month - reset hours
            if (now.getDate() === 1) {
                this.performMonthlyReset();
            }
        }
    },

    // Perform monthly reset
    performMonthlyReset() {
        console.log('[TorchAutomation] Performing monthly reset...');

        if (typeof TorchAPI !== 'undefined') {
            const result = TorchAPI.resetMonthlyHours();
            console.log(`[TorchAutomation] Reset hours for ${result.membersReset.length} members`);
        }

        // Clear sent warnings
        this.saveToStorage('sentHourWarnings', {});
        this.saveToStorage('sentReminders', {});

        // Save reset timestamp
        this.saveToStorage('lastMonthlyReset', new Date().toISOString());

        this.triggerAutomationEvent('monthlyResetCompleted', {
            date: new Date().toISOString()
        });
    },

    // ==================== UTILITY METHODS ====================

    // Load scheduled tasks
    loadScheduledTasks() {
        const tasks = this.loadFromStorage('scheduledTasks');
        if (tasks) {
            this.scheduledTasks = tasks;
        }
    },

    // Save scheduled tasks
    saveScheduledTasks() {
        this.saveToStorage('scheduledTasks', this.scheduledTasks);
    },

    // Load from storage
    loadFromStorage(key) {
        try {
            const data = localStorage.getItem(`torch_automation_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`[TorchAutomation] Error loading ${key}:`, e);
            return null;
        }
    },

    // Save to storage
    saveToStorage(key, data) {
        try {
            localStorage.setItem(`torch_automation_${key}`, JSON.stringify(data));
        } catch (e) {
            console.error(`[TorchAutomation] Error saving ${key}:`, e);
        }
    },

    // Format time for display
    formatTime(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    },

    // Format date for display
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    // Trigger automation event
    triggerAutomationEvent(event, data) {
        console.log(`[TorchAutomation Event] ${event}:`, data);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('torch-automation', {
                detail: { event: event, data: data, timestamp: new Date().toISOString() }
            }));
        }
    },

    // Get automation status
    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            scheduledTaskCount: this.scheduledTasks.length,
            lastDailyReport: this.loadFromStorage('reportLog')?.daily,
            lastWeeklyReport: this.loadFromStorage('reportLog')?.weekly,
            lastMonthlyReset: this.loadFromStorage('lastMonthlyReset')
        };
    },

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[TorchAutomation] Configuration updated:', this.config);
    },

    // Manual trigger for testing
    manualTrigger(action) {
        switch (action) {
            case 'reminders':
                this.checkSessionReminders();
                break;
            case 'hourWarnings':
                this.checkHourWarnings();
                break;
            case 'dailyReport':
                return this.generateDailyReport();
            case 'weeklyReport':
                return this.generateWeeklyReport();
            case 'monthlyReset':
                this.performMonthlyReset();
                break;
            case 'payments':
                this.checkPaymentStatus();
                break;
            default:
                console.log('[TorchAutomation] Unknown action:', action);
        }
    }
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.TorchAutomation = TorchAutomation;
}

console.log('[TorchAutomation] Automation module loaded');
