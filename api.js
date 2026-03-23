// TORCH ATL Operations Suite - API Simulation Layer

const TorchAPI = {
    // Webhook configuration
    webhooks: {
        memberCreated: true,
        memberUpdated: true,
        bookingCreated: true,
        bookingCancelled: true,
        smsSent: true,
        emailSent: true,
        paymentReceived: true,
        hourWarning: true
    },

    // Validation rules
    validators: {
        email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        phone: (phone) => /^\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(phone.replace(/\s/g, '')),
        required: (value) => value !== null && value !== undefined && value !== '',
        positiveNumber: (num) => typeof num === 'number' && num >= 0,
        tier: (tier) => ['Residency', 'Member', 'Session'].includes(tier),
        status: (status) => ['Active', 'Pending', 'Inactive', 'Suspended'].includes(status),
        dateFormat: (date) => /^\d{4}-\d{2}-\d{2}$/.test(date),
        timeFormat: (time) => /^\d{2}:\d{2}$/.test(time)
    },

    // Backend connectivity flag
    backendAvailable: false,

    // Initialize API layer
    init() {
        console.log('[TorchAPI] Initializing API layer...');
        this.initializeIdCounters();
        this.checkBackend();
        console.log('[TorchAPI] API layer initialized');
        return this;
    },

    // Check if backend is reachable
    async checkBackend() {
        if (typeof TorchBackend === 'undefined') {
            this.backendAvailable = false;
            return;
        }
        try {
            await TorchBackend.health();
            this.backendAvailable = true;
            console.log('[TorchAPI] Backend connected');
        } catch (e) {
            this.backendAvailable = false;
            console.warn('[TorchAPI] Backend unavailable, using local data');
        }
    },

    // Refresh ALL data from backend into local arrays
    async refreshFromBackend() {
        if (!this.backendAvailable || typeof TorchBackend === 'undefined') return false;
        try {
            await Promise.all([
                this.refreshMembers(),
                this.refreshBookings(),
                this.refreshEngineers(),
                this.refreshActivityFeed(),
                this.refreshSessionReports()
            ]);
            console.log('[TorchAPI] All data refreshed from backend');
            if (typeof TorchStorage !== 'undefined') TorchStorage.saveAll();
            return true;
        } catch (e) {
            console.warn('[TorchAPI] Backend refresh failed:', e.message);
            return false;
        }
    },

    // Refresh members from backend
    async refreshMembers() {
        if (typeof TorchBackend === 'undefined') return;
        try {
            const data = await TorchBackend.admin.listMembers();
            if (Array.isArray(data) && data.length > 0) {
                members.length = 0;
                data.forEach(m => {
                    members.push({
                        id: m.id,
                        name: m.name,
                        email: m.email,
                        phone: m.phone || '',
                        tier: m.tier,
                        status: m.status === 'active' ? 'Active' : m.status === 'pending' ? 'Pending' : m.status === 'suspended' ? 'Suspended' : 'Inactive',
                        hoursUsed: parseFloat(m.hours_used) || 0,
                        hoursTotal: parseFloat(m.hours_allocated) || TIERS[m.tier]?.hours || 0,
                        monthlyRate: parseFloat(m.monthly_rate) || (m.founding ? TIERS[m.tier]?.foundingPrice : TIERS[m.tier]?.price) || 0,
                        startDate: m.join_date?.split('T')[0] || m.created_at?.split('T')[0] || '',
                        company: m.company || '',
                        founding: !!m.founding,
                        accessCode: '',
                        notes: m.notes || '',
                        _backendId: m.id
                    });
                });
                this.initializeIdCounters();
                console.log(`[TorchAPI] Loaded ${members.length} members from backend`);
            }
        } catch (e) {
            console.warn('[TorchAPI] Member refresh failed:', e.message);
        }
    },

    // Refresh bookings from backend
    async refreshBookings() {
        if (typeof TorchBackend === 'undefined') return;
        try {
            const data = await TorchBackend.bookings.list();
            if (Array.isArray(data)) {
                bookings.length = 0;
                data.forEach(b => {
                    bookings.push({
                        id: b.id,
                        memberId: b.member_id,
                        memberName: b.member_name || '',
                        date: (b.date || '').split('T')[0],
                        startTime: (b.start_time || '').slice(0, 5),
                        endTime: (b.end_time || '').slice(0, 5),
                        hours: parseFloat(b.hours) || 0,
                        guests: b.guest_count || 0,
                        guestNames: [],
                        type: (b.type || 'Recording').charAt(0).toUpperCase() + (b.type || 'recording').slice(1),
                        status: b.status === 'confirmed' ? 'Confirmed' : b.status === 'completed' ? 'Completed' : b.status === 'cancelled' ? 'Cancelled' : b.status === 'pending' ? 'Pending' : b.status === 'declined' ? 'Declined' : b.status,
                        engineerId: b.engineer_id || null,
                        engineerName: b.engineer_name || '',
                        engineerStatus: b.engineer_id ? 'assigned' : 'none',
                        _backendId: b.id
                    });
                });
                this.initializeIdCounters();
                console.log(`[TorchAPI] Loaded ${bookings.length} bookings from backend`);
            }
        } catch (e) {
            console.warn('[TorchAPI] Booking refresh failed:', e.message);
        }
    },

    // Refresh engineers from backend (full CRM data)
    async refreshEngineers() {
        if (typeof TorchBackend === 'undefined') return;
        try {
            const data = await TorchBackend.admin.listEngineers();
            if (Array.isArray(data) && data.length > 0) {
                engineers.length = 0;
                data.forEach(e => {
                    engineers.push({
                        id: e.id,
                        name: e.name,
                        email: e.email,
                        phone: e.phone || '',
                        accessCode: '',
                        status: e.status || 'Active',
                        role: e.role || 'Recording Engineer',
                        specialties: e.specialties || ['Recording'],
                        bio: e.bio || '',
                        photoUrl: '',
                        rate: e.rate || 60,
                        availability: e.availability || {},
                        stats: e.stats || { totalSessions: 0, totalHours: 0, totalEarnings: 0, averageRating: 0, acceptanceRate: 100, declinedSessions: 0 },
                        monthlyStats: e.monthlyStats || {},
                        notes: e.notes || [],
                        createdAt: e.createdAt,
                        updatedAt: e.updatedAt,
                        _backendId: e.id
                    });
                });
                this.initializeIdCounters();
                console.log(`[TorchAPI] Loaded ${engineers.length} engineers from backend`);
            }
        } catch (e) {
            console.warn('[TorchAPI] Engineer refresh failed:', e.message);
        }
    },

    // Refresh activity feed from backend
    async refreshActivityFeed() {
        if (typeof TorchBackend === 'undefined') return;
        try {
            const data = await TorchBackend.admin.getActivity(50);
            if (Array.isArray(data) && data.length > 0) {
                activityFeed.length = 0;
                data.forEach(a => {
                    const age = Date.now() - new Date(a.created_at).getTime();
                    const mins = Math.floor(age / 60000);
                    let timeStr;
                    if (mins < 1) timeStr = 'Just now';
                    else if (mins < 60) timeStr = `${mins} min ago`;
                    else if (mins < 1440) timeStr = `${Math.floor(mins / 60)} hours ago`;
                    else timeStr = `${Math.floor(mins / 1440)} days ago`;

                    activityFeed.push({
                        text: `${a.action.replace(/_/g, ' ')}: ${a.entity_type} ${a.entity_id ? a.entity_id.slice(0, 8) : ''}`,
                        time: timeStr,
                        type: a.entity_type || 'general',
                        timestamp: a.created_at
                    });
                });
                console.log(`[TorchAPI] Loaded ${activityFeed.length} activity items from backend`);
            }
        } catch (e) {
            console.warn('[TorchAPI] Activity refresh failed:', e.message);
        }
    },

    // Refresh session reports from backend
    async refreshSessionReports() {
        if (typeof TorchBackend === 'undefined') return;
        try {
            const data = await TorchBackend.sessionReports.list();
            if (Array.isArray(data)) {
                sessionReports.length = 0;
                data.forEach(r => sessionReports.push(r));
                this.initializeIdCounters();
                console.log(`[TorchAPI] Loaded ${sessionReports.length} session reports from backend`);
            }
        } catch (e) {
            console.warn('[TorchAPI] Session reports refresh failed:', e.message);
        }
    },

    // Initialize ID counters based on existing data
    initializeIdCounters() {
        this.nextMemberId = Math.max(...members.map(m => typeof m.id === 'number' ? m.id : 0), 0) + 1;
        this.nextBookingId = Math.max(...bookings.map(b => typeof b.id === 'number' ? b.id : 0), 0) + 1;
        this.nextSmsId = Math.max(...smsHistory.map(s => s.id), 0) + 1;
        this.nextEmailId = Math.max(
            ...emailHistory.sent.map(e => e.id),
            ...emailHistory.scheduled.map(e => e.id),
            ...emailHistory.drafts.map(e => e.id),
            0
        ) + 1;
        this.nextEngineerId = Math.max(...engineers.map(e => typeof e.id === 'number' ? e.id : 0), 0) + 1;
        this.nextAdminUserId = Math.max(...adminUsers.map(a => a.id), 0) + 1;
        this.nextSessionReportId = Math.max(...sessionReports.map(r => typeof r.id === 'number' ? r.id : 0), 0) + 1;
    },

    // ==================== MEMBER OPERATIONS ====================

    // Create a new member — tries backend first
    async createMember(memberData) {
        // Validate required fields
        const validation = this.validateMember(memberData);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            try {
                const result = await TorchBackend.admin.createMember({
                    name: memberData.name.trim(),
                    email: memberData.email.toLowerCase().trim(),
                    phone: memberData.phone || '',
                    tier: memberData.tier,
                    founding: memberData.founding === true,
                    company: memberData.company || '',
                    accessCode: memberData.accessCode || `TMP${Date.now().toString(36).toUpperCase()}`
                });
                // Refresh local data from backend
                await this.refreshMembers();
                this.logActivity(`New member added: ${memberData.name}`, 'member');
                this.triggerWebhook('memberCreated', result);
                return { success: true, member: result };
            } catch (err) {
                console.warn('[TorchAPI] Backend createMember failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const tierCount = members.filter(m => m.tier === memberData.tier && m.status === 'Active').length;
        if (tierCount >= TIERS[memberData.tier].cap) {
            return { success: false, errors: ['Tier capacity reached'] };
        }
        if (members.some(m => m.email.toLowerCase() === memberData.email.toLowerCase())) {
            return { success: false, errors: ['Email already exists'] };
        }

        const tierConfig = TIERS[memberData.tier];
        const isFoundng = memberData.founding === true;
        const newMember = {
            id: this.nextMemberId++,
            name: memberData.name.trim(),
            email: memberData.email.toLowerCase().trim(),
            phone: memberData.phone || '',
            tier: memberData.tier,
            status: memberData.status || 'Pending',
            hoursUsed: 0,
            hoursTotal: tierConfig.hours,
            monthlyRate: isFoundng ? tierConfig.foundingPrice : tierConfig.price,
            startDate: memberData.startDate || new Date().toISOString().split('T')[0],
            company: memberData.company || '',
            founding: isFoundng,
            accessCode: memberData.accessCode || '',
            notes: memberData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        members.push(newMember);
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveMembers();
        this.logActivity(`New member added: ${newMember.name}`, 'member');
        this.triggerWebhook('memberCreated', newMember);
        return { success: true, member: newMember };
    },

    // Update an existing member — tries backend first
    async updateMember(memberId, updates) {
        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const backendId = members.find(m => m.id === memberId)?._backendId || memberId;
            try {
                const result = await TorchBackend.admin.updateMember(backendId, updates);
                await this.refreshMembers();
                this.logActivity(`Member updated: ${result.name || ''}`, 'member');
                this.triggerWebhook('memberUpdated', result);
                return { success: true, member: result };
            } catch (err) {
                console.warn('[TorchAPI] Backend updateMember failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const memberIndex = members.findIndex(m => m.id === memberId);
        if (memberIndex === -1) return { success: false, errors: ['Member not found'] };
        const member = members[memberIndex];
        if (updates.email && updates.email !== member.email) {
            if (!this.validators.email(updates.email)) return { success: false, errors: ['Invalid email format'] };
            if (members.some(m => m.id !== memberId && m.email.toLowerCase() === updates.email.toLowerCase())) return { success: false, errors: ['Email already exists'] };
        }
        if (updates.tier && updates.tier !== member.tier) {
            if (!this.validators.tier(updates.tier)) return { success: false, errors: ['Invalid tier'] };
            const newTierConfig = TIERS[updates.tier];
            updates.hoursTotal = newTierConfig.hours;
            updates.monthlyRate = member.founding ? newTierConfig.foundingPrice : newTierConfig.price;
        }
        const updatedMember = { ...member, ...updates, updatedAt: new Date().toISOString() };
        members[memberIndex] = updatedMember;
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveMembers();
        this.logActivity(`Member updated: ${updatedMember.name}`, 'member');
        this.triggerWebhook('memberUpdated', updatedMember);
        return { success: true, member: updatedMember };
    },

    // Get member by ID — backend-first
    async getMember(memberId) {
        // Try to find from refreshed local cache first (already synced from backend)
        const member = members.find(m => m.id === memberId || m._backendId === memberId);
        if (!member) {
            return { success: false, errors: ['Member not found'] };
        }
        return { success: true, member: member };
    },

    // Get all members with optional filters — backend-first
    async getMembers(filters = {}) {
        // If backend is available and we have filters, refresh from backend with filters
        if (this.backendAvailable && typeof TorchBackend !== 'undefined' && Object.keys(filters).length > 0) {
            try {
                const params = {};
                if (filters.tier) params.tier = filters.tier;
                if (filters.status) params.status = filters.status === 'Active' ? 'active' : filters.status.toLowerCase();
                if (filters.search) params.search = filters.search;
                const data = await TorchBackend.admin.listMembers(params);
                if (Array.isArray(data)) {
                    return { success: true, members: data, count: data.length };
                }
            } catch (e) {
                console.warn('[TorchAPI] Backend getMembers failed, using local:', e.message);
            }
        }

        // Fallback: local filter
        let result = [...members];

        if (filters.tier) {
            result = result.filter(m => m.tier === filters.tier);
        }
        if (filters.status) {
            result = result.filter(m => m.status === filters.status);
        }
        if (filters.founding !== undefined) {
            result = result.filter(m => m.founding === filters.founding);
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(m =>
                m.name.toLowerCase().includes(searchLower) ||
                m.email.toLowerCase().includes(searchLower) ||
                m.company.toLowerCase().includes(searchLower)
            );
        }

        return { success: true, members: result, count: result.length };
    },

    // Delete (deactivate) member — tries backend first
    async deleteMember(memberId) {
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const backendId = members.find(m => m.id === memberId)?._backendId || memberId;
            try {
                await TorchBackend.admin.suspendMember(backendId);
                await this.refreshMembers();
                return { success: true };
            } catch (err) {
                console.warn('[TorchAPI] Backend deleteMember failed:', err.message);
            }
        }
        const memberIndex = members.findIndex(m => m.id === memberId);
        if (memberIndex === -1) return { success: false, errors: ['Member not found'] };
        members[memberIndex].status = 'Inactive';
        members[memberIndex].updatedAt = new Date().toISOString();
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveMembers();
        this.logActivity(`Member deactivated: ${members[memberIndex].name}`, 'member');
        return { success: true };
    },

    // Validate member data
    validateMember(data) {
        const errors = [];

        if (!this.validators.required(data.name)) {
            errors.push('Name is required');
        }
        if (!this.validators.required(data.email)) {
            errors.push('Email is required');
        } else if (!this.validators.email(data.email)) {
            errors.push('Invalid email format');
        }
        if (data.phone && !this.validators.phone(data.phone)) {
            errors.push('Invalid phone format');
        }
        if (!this.validators.tier(data.tier)) {
            errors.push('Invalid tier');
        }

        return { valid: errors.length === 0, errors: errors };
    },

    // ==================== BOOKING OPERATIONS ====================

    // Create a new booking — tries backend first
    async createBooking(bookingData) {
        const validation = this.validateBooking(bookingData);
        if (!validation.valid) return { success: false, errors: validation.errors };

        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const member = members.find(m => m.id === bookingData.memberId);
            const memberId = member?._backendId || bookingData.memberId;
            try {
                const result = await TorchBackend.bookings.create({
                    memberId: memberId,
                    date: bookingData.date,
                    startTime: bookingData.startTime,
                    endTime: bookingData.endTime,
                    type: (bookingData.type || 'Recording').toLowerCase(),
                    room: bookingData.room || undefined,
                    guestCount: bookingData.guests || 0,
                    engineerId: bookingData.engineerId || undefined,
                    notes: bookingData.notes || ''
                });
                await this.refreshBookings();
                await this.refreshMembers();
                this.logActivity(`New booking: ${member?.name || ''} (${bookingData.date})`, 'booking');
                this.triggerWebhook('bookingCreated', result);
                return { success: true, booking: result };
            } catch (err) {
                console.warn('[TorchAPI] Backend createBooking failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const member = members.find(m => m.id === bookingData.memberId);
        if (!member) return { success: false, errors: ['Member not found'] };
        if (member.status !== 'Active') return { success: false, errors: ['Member is not active'] };
        const hours = this.calculateBookingHours(bookingData.startTime, bookingData.endTime);
        if (member.hoursUsed + hours > member.hoursTotal) return { success: false, errors: [`Insufficient hours. Available: ${member.hoursTotal - member.hoursUsed}, Requested: ${hours}`] };
        const conflictingBooking = bookings.find(b => b.date === bookingData.date && b.status === 'Confirmed' && this.timeOverlap(b.startTime, b.endTime, bookingData.startTime, bookingData.endTime));
        if (conflictingBooking) return { success: false, errors: ['Time slot is already booked'] };
        const newBooking = { id: this.nextBookingId++, memberId: member.id, memberName: member.name, date: bookingData.date, startTime: bookingData.startTime, endTime: bookingData.endTime, hours, guests: bookingData.guests || 0, guestNames: bookingData.guestNames || [], type: bookingData.type || 'Recording', status: 'Confirmed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        bookings.push(newBooking);
        member.hoursUsed += hours;
        if (typeof TorchStorage !== 'undefined') { TorchStorage.saveBookings(); TorchStorage.saveMembers(); }
        this.logActivity(`New booking: ${member.name} (${bookingData.date})`, 'booking');
        this.triggerWebhook('bookingCreated', newBooking);
        this.checkHourWarning(member);
        return { success: true, booking: newBooking };
    },

    // Update a booking — tries backend first
    async updateBooking(bookingId, updates) {
        // Try backend first for status changes
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const backendId = bookings.find(b => b.id === bookingId)?._backendId || bookingId;
            try {
                if (updates.status) {
                    await TorchBackend.bookings.updateStatus(backendId, updates.status.toLowerCase(), updates.reason);
                } else {
                    // General update — use PATCH if available, otherwise status endpoint
                    await TorchBackend.bookings.updateStatus(backendId, updates.status || 'confirmed', updates.reason);
                }
                await this.refreshBookings();
                await this.refreshMembers();
                this.logActivity(`Booking updated: ${bookingId}`, 'booking');
                return { success: true, booking: bookings.find(b => b.id === bookingId || b._backendId === backendId) };
            } catch (err) {
                console.warn('[TorchAPI] Backend updateBooking failed:', err.message);
                // Fall through to local
            }
        }

        // Fallback: local
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return { success: false, errors: ['Booking not found'] };
        }

        const booking = bookings[bookingIndex];
        const member = members.find(m => m.id === booking.memberId);

        // If time is changing, recalculate hours
        if (updates.startTime || updates.endTime) {
            const newStartTime = updates.startTime || booking.startTime;
            const newEndTime = updates.endTime || booking.endTime;
            const newHours = this.calculateBookingHours(newStartTime, newEndTime);
            const hoursDiff = newHours - booking.hours;

            if (member && member.hoursUsed + hoursDiff > member.hoursTotal) {
                return { success: false, errors: ['Insufficient hours for time change'] };
            }

            updates.hours = newHours;

            if (member) {
                member.hoursUsed += hoursDiff;
            }
        }

        const updatedBooking = {
            ...booking,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        bookings[bookingIndex] = updatedBooking;

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveBookings();
            TorchStorage.saveMembers();
        }

        this.logActivity(`Booking updated: ${updatedBooking.memberName} (${updatedBooking.date})`, 'booking');

        return { success: true, booking: updatedBooking };
    },

    // Cancel a booking — tries backend first
    async cancelBooking(bookingId) {
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const backendId = bookings.find(b => b.id === bookingId)?._backendId || bookingId;
            try {
                await TorchBackend.bookings.cancel(backendId);
                const booking = bookings.find(b => b.id === bookingId);
                await this.refreshBookings();
                await this.refreshMembers();
                this.logActivity(`Booking cancelled: ${booking?.memberName || ''} (${booking?.date || ''})`, 'booking');
                this.triggerWebhook('bookingCancelled', booking);
                return { success: true };
            } catch (err) {
                console.warn('[TorchAPI] Backend cancelBooking failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) return { success: false, errors: ['Booking not found'] };
        const booking = bookings[bookingIndex];
        const member = members.find(m => m.id === booking.memberId);
        if (member) member.hoursUsed = Math.max(0, member.hoursUsed - booking.hours);
        bookings.splice(bookingIndex, 1);
        if (typeof TorchStorage !== 'undefined') { TorchStorage.saveBookings(); TorchStorage.saveMembers(); }
        this.logActivity(`Booking cancelled: ${booking.memberName} (${booking.date})`, 'booking');
        this.triggerWebhook('bookingCancelled', booking);
        return { success: true };
    },

    // Get bookings with filters
    getBookings(filters = {}) {
        let result = [...bookings];

        if (filters.memberId) {
            result = result.filter(b => b.memberId === filters.memberId);
        }
        if (filters.date) {
            result = result.filter(b => b.date === filters.date);
        }
        if (filters.dateFrom) {
            result = result.filter(b => b.date >= filters.dateFrom);
        }
        if (filters.dateTo) {
            result = result.filter(b => b.date <= filters.dateTo);
        }
        if (filters.status) {
            result = result.filter(b => b.status === filters.status);
        }
        if (filters.type) {
            result = result.filter(b => b.type === filters.type);
        }

        // Sort by date and time
        result.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.startTime.localeCompare(b.startTime);
        });

        return { success: true, bookings: result, count: result.length };
    },

    // Validate booking data
    validateBooking(data) {
        const errors = [];

        if (!this.validators.required(data.memberId)) {
            errors.push('Member is required');
        }
        if (!this.validators.required(data.date)) {
            errors.push('Date is required');
        } else if (!this.validators.dateFormat(data.date)) {
            errors.push('Invalid date format (use YYYY-MM-DD)');
        }
        if (!this.validators.required(data.startTime)) {
            errors.push('Start time is required');
        } else if (!this.validators.timeFormat(data.startTime)) {
            errors.push('Invalid start time format (use HH:MM)');
        }
        if (!this.validators.required(data.endTime)) {
            errors.push('End time is required');
        } else if (!this.validators.timeFormat(data.endTime)) {
            errors.push('Invalid end time format (use HH:MM)');
        }

        return { valid: errors.length === 0, errors: errors };
    },

    // ==================== SMS OPERATIONS ====================

    // Send SMS
    sendSMS(smsData) {
        if (!this.validators.required(smsData.message)) {
            return { success: false, errors: ['Message is required'] };
        }
        if (!smsData.recipients || smsData.recipients.length === 0) {
            return { success: false, errors: ['At least one recipient is required'] };
        }

        // Character limit check
        if (smsData.message.length > 160) {
            console.warn('[TorchAPI] SMS message exceeds 160 characters, may be split');
        }

        const recipientText = Array.isArray(smsData.recipients)
            ? smsData.recipients.join(', ')
            : smsData.recipients;

        const newSMS = {
            id: this.nextSmsId++,
            message: smsData.message,
            recipients: recipientText,
            sentAt: new Date().toLocaleString(),
            status: 'Delivered',
            createdAt: new Date().toISOString()
        };

        smsHistory.unshift(newSMS);

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveSmsHistory();
        }

        this.logActivity(`SMS sent to ${recipientText}`, 'sms');
        this.triggerWebhook('smsSent', newSMS);

        return { success: true, sms: newSMS };
    },

    // Get SMS history
    getSMSHistory(filters = {}) {
        let result = [...smsHistory];

        if (filters.recipients) {
            result = result.filter(s => s.recipients.includes(filters.recipients));
        }
        if (filters.dateFrom) {
            result = result.filter(s => new Date(s.sentAt) >= new Date(filters.dateFrom));
        }
        if (filters.dateTo) {
            result = result.filter(s => new Date(s.sentAt) <= new Date(filters.dateTo));
        }

        return { success: true, history: result, count: result.length };
    },

    // ==================== EMAIL OPERATIONS ====================

    // Send email
    sendEmail(emailData) {
        if (!this.validators.required(emailData.subject)) {
            return { success: false, errors: ['Subject is required'] };
        }
        if (!this.validators.required(emailData.body)) {
            return { success: false, errors: ['Body is required'] };
        }
        if (!emailData.recipients) {
            return { success: false, errors: ['Recipients required'] };
        }

        const newEmail = {
            id: this.nextEmailId++,
            subject: emailData.subject,
            body: emailData.body,
            recipients: emailData.recipients,
            sentAt: new Date().toLocaleDateString(),
            opens: 0,
            clicks: 0,
            createdAt: new Date().toISOString()
        };

        emailHistory.sent.unshift(newEmail);

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveEmailHistory();
        }

        this.logActivity(`Email sent: "${emailData.subject}"`, 'email');
        this.triggerWebhook('emailSent', newEmail);

        return { success: true, email: newEmail };
    },

    // Schedule email
    scheduleEmail(emailData) {
        if (!this.validators.required(emailData.scheduledFor)) {
            return { success: false, errors: ['Scheduled time is required'] };
        }

        const scheduledEmail = {
            id: this.nextEmailId++,
            subject: emailData.subject,
            body: emailData.body,
            recipients: emailData.recipients,
            scheduledFor: emailData.scheduledFor,
            createdAt: new Date().toISOString()
        };

        emailHistory.scheduled.push(scheduledEmail);

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveEmailHistory();
        }

        return { success: true, email: scheduledEmail };
    },

    // Save email draft
    saveDraft(emailData) {
        const draft = {
            id: this.nextEmailId++,
            subject: emailData.subject || 'Untitled Draft',
            body: emailData.body || '',
            recipients: emailData.recipients || '',
            lastEdited: new Date().toLocaleDateString(),
            createdAt: new Date().toISOString()
        };

        emailHistory.drafts.push(draft);

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveEmailHistory();
        }

        return { success: true, draft: draft };
    },

    // Get email history
    getEmailHistory(type = 'all') {
        if (type === 'sent') {
            return { success: true, emails: emailHistory.sent };
        }
        if (type === 'scheduled') {
            return { success: true, emails: emailHistory.scheduled };
        }
        if (type === 'drafts') {
            return { success: true, emails: emailHistory.drafts };
        }
        return { success: true, emails: emailHistory };
    },

    // ==================== HOUR TRACKING ====================

    // Get member hour status
    getMemberHourStatus(memberId) {
        const member = members.find(m => m.id === memberId);
        if (!member) {
            return { success: false, errors: ['Member not found'] };
        }

        const hoursRemaining = member.hoursTotal - member.hoursUsed;
        const percentUsed = (member.hoursUsed / member.hoursTotal) * 100;

        return {
            success: true,
            status: {
                memberId: member.id,
                memberName: member.name,
                tier: member.tier,
                hoursUsed: member.hoursUsed,
                hoursTotal: member.hoursTotal,
                hoursRemaining: hoursRemaining,
                percentUsed: Math.round(percentUsed),
                warningLevel: percentUsed >= 80 ? 'warning' : (percentUsed >= 100 ? 'exceeded' : 'normal')
            }
        };
    },

    // Log hours for a member (manual adjustment)
    logHours(memberId, hours, reason = '') {
        const member = members.find(m => m.id === memberId);
        if (!member) {
            return { success: false, errors: ['Member not found'] };
        }

        member.hoursUsed = Math.max(0, member.hoursUsed + hours);

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveMembers();
        }

        this.logActivity(`Hours adjusted for ${member.name}: ${hours > 0 ? '+' : ''}${hours} (${reason || 'Manual adjustment'})`, 'hours');

        this.checkHourWarning(member);

        return { success: true, newHoursUsed: member.hoursUsed };
    },

    // Reset monthly hours — backend-first (triggers autonomous billing cycle)
    async resetMonthlyHours() {
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            try {
                const result = await TorchBackend.admin.runMonthlyCycle();
                await this.refreshMembers();
                this.logActivity('Monthly billing cycle triggered via backend', 'system');
                return { success: true, result };
            } catch (err) {
                console.warn('[TorchAPI] Backend resetMonthlyHours failed:', err.message);
            }
        }

        // Fallback: local
        const resetMembers = [];

        members.forEach(member => {
            if (member.status === 'Active') {
                member.hoursUsed = 0;
                resetMembers.push(member.name);
            }
        });

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveMembers();
        }

        this.logActivity(`Monthly hours reset for ${resetMembers.length} members`, 'system');

        return { success: true, membersReset: resetMembers };
    },

    // Check and trigger hour warning
    checkHourWarning(member) {
        const percentUsed = (member.hoursUsed / member.hoursTotal) * 100;

        if (percentUsed >= 80 && percentUsed < 100) {
            this.triggerWebhook('hourWarning', {
                member: member,
                level: 'warning',
                percentUsed: Math.round(percentUsed),
                hoursRemaining: member.hoursTotal - member.hoursUsed
            });
        } else if (percentUsed >= 100) {
            this.triggerWebhook('hourWarning', {
                member: member,
                level: 'exceeded',
                percentUsed: Math.round(percentUsed),
                hoursRemaining: 0
            });
        }
    },

    // ==================== BILLING CALCULATIONS ====================

    // Calculate monthly recurring revenue
    calculateMRR() {
        const activeMembers = members.filter(m => m.status === 'Active');
        const mrr = activeMembers.reduce((sum, m) => sum + m.monthlyRate, 0);

        return {
            success: true,
            mrr: mrr,
            breakdown: {
                Residency: activeMembers.filter(m => m.tier === 'Residency').reduce((sum, m) => sum + m.monthlyRate, 0),
                Member: activeMembers.filter(m => m.tier === 'Member').reduce((sum, m) => sum + m.monthlyRate, 0),
                Session: activeMembers.filter(m => m.tier === 'Session').reduce((sum, m) => sum + m.monthlyRate, 0)
            },
            memberCount: activeMembers.length
        };
    },

    // Calculate projected annual revenue
    calculateARR() {
        const mrrResult = this.calculateMRR();
        return {
            success: true,
            arr: mrrResult.mrr * 12,
            mrr: mrrResult.mrr
        };
    },

    // Generate invoice data for a member
    generateInvoice(memberId, month, year) {
        const member = members.find(m => m.id === memberId);
        if (!member) {
            return { success: false, errors: ['Member not found'] };
        }

        const memberBookings = bookings.filter(b => {
            const bookingDate = new Date(b.date);
            return b.memberId === memberId &&
                bookingDate.getMonth() === month &&
                bookingDate.getFullYear() === year;
        });

        const invoice = {
            invoiceNumber: `INV-${year}${String(month + 1).padStart(2, '0')}-${member.id}`,
            member: {
                id: member.id,
                name: member.name,
                email: member.email,
                company: member.company
            },
            period: `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`,
            tier: member.tier,
            monthlyRate: member.monthlyRate,
            hoursIncluded: member.hoursTotal,
            hoursUsed: memberBookings.reduce((sum, b) => sum + b.hours, 0),
            sessions: memberBookings.map(b => ({
                date: b.date,
                hours: b.hours,
                type: b.type
            })),
            total: member.monthlyRate,
            dueDate: new Date(year, month + 1, 1).toISOString().split('T')[0],
            generatedAt: new Date().toISOString()
        };

        return { success: true, invoice: invoice };
    },

    // ==================== UTILITY METHODS ====================

    // Calculate hours between two times
    calculateBookingHours(startTime, endTime) {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        let hours = endH - startH + (endM - startM) / 60;
        if (hours < 0) hours += 24; // Handle overnight
        return Math.round(hours);
    },

    // Check if two time ranges overlap
    timeOverlap(start1, end1, start2, end2) {
        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };

        const s1 = toMinutes(start1);
        const e1 = toMinutes(end1);
        const s2 = toMinutes(start2);
        const e2 = toMinutes(end2);

        return s1 < e2 && s2 < e1;
    },

    // Log activity
    logActivity(text, type = 'general') {
        const activity = {
            text: text,
            time: 'Just now',
            type: type,
            timestamp: new Date().toISOString()
        };

        activityFeed.unshift(activity);

        // Keep only last 50 activities
        if (activityFeed.length > 50) {
            activityFeed.pop();
        }

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveActivityFeed();
        }
    },

    // Trigger webhook (console log for now)
    triggerWebhook(event, data) {
        if (!this.webhooks[event]) {
            return;
        }

        console.log(`[TorchAPI Webhook] ${event}:`, data);

        // In production, this would make HTTP requests to configured endpoints
        // For now, we dispatch a custom event that can be listened to
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('torch-webhook', {
                detail: { event: event, data: data, timestamp: new Date().toISOString() }
            }));
        }
    },

    // ==================== AUTHENTICATION ====================

    // Login to Operations Suite — tries backend API first, falls back to local
    async login(email, accessCode) {
        // Try backend authentication first
        if (typeof TorchBackend !== 'undefined') {
            try {
                // Try admin portal first (matches admin_users table)
                let data;
                try {
                    data = await TorchBackend.auth.login(email, accessCode, 'admin');
                } catch {
                    // Not an admin — try regular login (matches engineers, then members)
                    data = await TorchBackend.auth.login(email, accessCode);
                }
                // Backend login succeeded — map to local admin user shape
                const backendUser = data.user;
                currentAdminUser = {
                    id: backendUser.id,
                    name: backendUser.name,
                    email: backendUser.email,
                    role: backendUser.role,
                    permissions: (backendUser.role === 'admin' || backendUser.role === 'manager') ? ['all'] : ['view_own_bookings', 'create_reports'],
                    backendAuth: true
                };
                if (typeof TorchStorage !== 'undefined') {
                    TorchStorage.saveCurrentAdmin();
                }
                this.logActivity(`${backendUser.name} logged in via backend (${backendUser.role})`, 'auth');
                return { success: true, user: currentAdminUser };
            } catch (backendErr) {
                console.warn('[TorchAPI] Backend login failed, trying local:', backendErr.message);
            }
        }

        // Fallback: local adminUsers check
        const user = adminUsers.find(u =>
            u.email.toLowerCase() === email.toLowerCase() &&
            u.accessCode === accessCode
        );

        if (!user) {
            return { success: false, errors: ['Invalid email or access code'] };
        }

        currentAdminUser = user;

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveCurrentAdmin();
        }

        this.logActivity(`${user.name} logged in (${user.role})`, 'auth');

        return { success: true, user: user };
    },

    // Logout from Operations Suite
    logout() {
        const userName = currentAdminUser?.name || 'Unknown';

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.clearCurrentAdmin();
        }

        // Also clear backend token
        if (typeof TorchBackend !== 'undefined') {
            TorchBackend.auth.logout();
        }

        currentAdminUser = null;
        this.logActivity(`${userName} logged out`, 'auth');

        return { success: true };
    },

    // Get current logged-in user
    getCurrentUser() {
        return currentAdminUser;
    },

    // Check if user has permission
    hasPermission(permission) {
        if (!currentAdminUser) return false;
        if (currentAdminUser.permissions.includes('all')) return true;
        return currentAdminUser.permissions.includes(permission);
    },

    // ==================== ENGINEER OPERATIONS ====================

    // Create a new engineer — tries backend first
    async createEngineer(engineerData) {
        const errors = [];
        if (!this.validators.required(engineerData.name)) errors.push('Name is required');
        if (!this.validators.required(engineerData.email)) errors.push('Email is required');
        else if (!this.validators.email(engineerData.email)) errors.push('Invalid email format');
        if (errors.length > 0) return { success: false, errors };

        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            try {
                const result = await TorchBackend.admin.createEngineer({
                    name: engineerData.name.trim(),
                    email: engineerData.email.toLowerCase().trim(),
                    phone: engineerData.phone || '',
                    role: engineerData.role || 'Recording Engineer',
                    specialties: engineerData.specialties || ['Recording'],
                    bio: engineerData.bio || '',
                    rate: engineerData.rate || 60,
                    accessCode: engineerData.accessCode || null
                });
                await this.refreshEngineers();
                this.logActivity(`New engineer added: ${result.name}`, 'engineer');
                return { success: true, engineer: result };
            } catch (err) {
                console.warn('[TorchAPI] Backend createEngineer failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        if (engineers.some(e => e.email.toLowerCase() === engineerData.email.toLowerCase())) return { success: false, errors: ['Email already exists'] };
        const newEngineer = { id: this.nextEngineerId++, name: engineerData.name.trim(), email: engineerData.email.toLowerCase().trim(), phone: engineerData.phone || '', accessCode: engineerData.accessCode || this.generateAccessCode('ENG'), status: engineerData.status || 'Active', role: engineerData.role || 'Recording Engineer', specialties: engineerData.specialties || ['Recording'], bio: engineerData.bio || '', photoUrl: '', rate: engineerData.rate || 60, availability: engineerData.availability || {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        engineers.push(newEngineer);
        const adminUser = { id: this.nextAdminUserId++, name: newEngineer.name, email: newEngineer.email, accessCode: newEngineer.accessCode, role: 'engineer', engineerId: newEngineer.id, permissions: ['view_assigned_bookings', 'accept_bookings', 'submit_reports'], createdAt: new Date().toISOString() };
        adminUsers.push(adminUser);
        if (typeof TorchStorage !== 'undefined') { TorchStorage.saveEngineers(); TorchStorage.saveAdminUsers(); }
        this.logActivity(`New engineer added: ${newEngineer.name}`, 'engineer');
        return { success: true, engineer: newEngineer };
    },

    // Update an engineer — tries backend first
    async updateEngineer(engineerId, updates) {
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const backendId = engineers.find(e => e.id === engineerId)?._backendId || engineerId;
            try {
                await TorchBackend.admin.updateEngineer(backendId, updates);
                await this.refreshEngineers();
                this.logActivity(`Engineer updated: ${updates.name || ''}`, 'engineer');
                return { success: true, engineer: engineers.find(e => e.id === engineerId || e._backendId === backendId) };
            } catch (err) {
                console.warn('[TorchAPI] Backend updateEngineer failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const engineerIndex = engineers.findIndex(e => e.id === engineerId);
        if (engineerIndex === -1) return { success: false, errors: ['Engineer not found'] };
        const engineer = engineers[engineerIndex];
        if (updates.email && updates.email !== engineer.email) {
            if (!this.validators.email(updates.email)) return { success: false, errors: ['Invalid email format'] };
            if (engineers.some(e => e.id !== engineerId && e.email.toLowerCase() === updates.email.toLowerCase())) return { success: false, errors: ['Email already exists'] };
        }
        const updatedEngineer = { ...engineer, ...updates, updatedAt: new Date().toISOString() };
        engineers[engineerIndex] = updatedEngineer;
        const adminUserIndex = adminUsers.findIndex(a => a.engineerId === engineerId);
        if (adminUserIndex !== -1) { if (updates.name) adminUsers[adminUserIndex].name = updates.name; if (updates.email) adminUsers[adminUserIndex].email = updates.email; }
        if (typeof TorchStorage !== 'undefined') { TorchStorage.saveEngineers(); TorchStorage.saveAdminUsers(); }
        this.logActivity(`Engineer updated: ${updatedEngineer.name}`, 'engineer');
        return { success: true, engineer: updatedEngineer };
    },

    // Get engineer by ID
    getEngineer(engineerId) {
        const engineer = engineers.find(e => e.id === engineerId);
        if (!engineer) {
            return { success: false, errors: ['Engineer not found'] };
        }
        return { success: true, engineer: engineer };
    },

    // Get all engineers with optional filters
    getEngineers(filters = {}) {
        let result = [...engineers];

        if (filters.status) {
            result = result.filter(e => e.status === filters.status);
        }
        if (filters.role) {
            result = result.filter(e => e.role === filters.role);
        }
        if (filters.specialty) {
            result = result.filter(e => e.specialties.includes(filters.specialty));
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(e =>
                e.name.toLowerCase().includes(searchLower) ||
                e.email.toLowerCase().includes(searchLower)
            );
        }

        return { success: true, engineers: result, count: result.length };
    },

    // Delete (deactivate) engineer — tries backend first
    async deleteEngineer(engineerId) {
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const backendId = engineers.find(e => e.id === engineerId)?._backendId || engineerId;
            try {
                await TorchBackend.admin.deleteEngineer(backendId);
                await this.refreshEngineers();
                return { success: true };
            } catch (err) {
                console.warn('[TorchAPI] Backend deleteEngineer failed:', err.message);
            }
        }
        const engineerIndex = engineers.findIndex(e => e.id === engineerId);
        if (engineerIndex === -1) return { success: false, errors: ['Engineer not found'] };
        engineers[engineerIndex].status = 'Inactive';
        engineers[engineerIndex].updatedAt = new Date().toISOString();
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveEngineers();
        this.logActivity(`Engineer deactivated: ${engineers[engineerIndex].name}`, 'engineer');
        return { success: true };
    },

    // Add engineer note — tries backend first
    async addEngineerNote(engineerId, text) {
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const backendId = engineers.find(e => e.id === engineerId)?._backendId || engineerId;
            try {
                const result = await TorchBackend.admin.addEngineerNote(backendId, text);
                await this.refreshEngineers();
                return { success: true, note: result };
            } catch (err) {
                console.warn('[TorchAPI] Backend addEngineerNote failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const engineer = engineers.find(e => e.id === engineerId);
        if (!engineer) return { success: false, errors: ['Engineer not found'] };
        if (!engineer.notes) engineer.notes = [];
        const newNote = { id: Date.now(), text: text.trim(), author: currentAdminUser?.name || 'Admin', createdAt: new Date().toISOString() };
        engineer.notes.push(newNote);
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveEngineers();
        return { success: true, note: newNote };
    },

    // Generate access code
    generateAccessCode(prefix) {
        const num = String(this.nextEngineerId).padStart(3, '0');
        return `${prefix}${num}`;
    },

    // ==================== ENGINEER BOOKING OPERATIONS ====================

    // Assign engineer to booking
    assignEngineerToBooking(bookingId, engineerId) {
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return { success: false, errors: ['Booking not found'] };
        }

        const engineer = engineers.find(e => e.id === engineerId);
        if (!engineer) {
            return { success: false, errors: ['Engineer not found'] };
        }

        bookings[bookingIndex].engineerId = engineerId;
        bookings[bookingIndex].engineerName = engineer.name;
        bookings[bookingIndex].engineerStatus = 'assigned';
        bookings[bookingIndex].updatedAt = new Date().toISOString();

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveBookings();
        }

        this.logActivity(`${engineer.name} assigned to booking ${bookingId}`, 'booking');

        return { success: true, booking: bookings[bookingIndex] };
    },

    // Engineer accepts booking
    acceptBooking(bookingId, engineerId) {
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return { success: false, errors: ['Booking not found'] };
        }

        const booking = bookings[bookingIndex];
        if (booking.engineerId !== engineerId) {
            return { success: false, errors: ['Not assigned to this booking'] };
        }

        booking.engineerStatus = 'accepted';
        booking.engineerAcceptedAt = new Date().toISOString();
        booking.updatedAt = new Date().toISOString();

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveBookings();
        }

        const engineer = engineers.find(e => e.id === engineerId);
        this.logActivity(`${engineer?.name || 'Engineer'} accepted booking for ${booking.memberName}`, 'booking');

        return { success: true, booking: booking };
    },

    // Engineer declines booking
    declineBooking(bookingId, engineerId, reason = '') {
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return { success: false, errors: ['Booking not found'] };
        }

        const booking = bookings[bookingIndex];
        if (booking.engineerId !== engineerId) {
            return { success: false, errors: ['Not assigned to this booking'] };
        }

        booking.engineerStatus = 'declined';
        booking.engineerId = null;
        booking.engineerName = '';
        booking.updatedAt = new Date().toISOString();

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveBookings();
        }

        const engineer = engineers.find(e => e.id === engineerId);
        this.logActivity(`${engineer?.name || 'Engineer'} declined booking for ${booking.memberName}`, 'booking');

        return { success: true, booking: booking };
    },

    // Get bookings for engineer
    getEngineerBookings(engineerId, filters = {}) {
        let result = bookings.filter(b => b.engineerId === engineerId);

        if (filters.status) {
            result = result.filter(b => b.engineerStatus === filters.status);
        }
        if (filters.dateFrom) {
            result = result.filter(b => b.date >= filters.dateFrom);
        }
        if (filters.dateTo) {
            result = result.filter(b => b.date <= filters.dateTo);
        }

        result.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.startTime.localeCompare(b.startTime);
        });

        return { success: true, bookings: result, count: result.length };
    },

    // Get pending requests for engineer
    getPendingRequests(engineerId) {
        const pending = bookings.filter(b =>
            b.engineerId === engineerId &&
            (b.engineerStatus === 'assigned' || b.engineerStatus === 'requested')
        );

        pending.sort((a, b) => a.date.localeCompare(b.date));

        return { success: true, bookings: pending, count: pending.length };
    },

    // ==================== SESSION REPORT OPERATIONS ====================

    // Create a session report — tries backend first
    async createSessionReport(reportData) {
        const errors = [];
        if (!this.validators.required(reportData.bookingId)) errors.push('Booking ID is required');
        if (!this.validators.required(reportData.engineerId)) errors.push('Engineer ID is required');
        if (errors.length > 0) return { success: false, errors };

        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            const booking = bookings.find(b => b.id === reportData.bookingId);
            const backendBookingId = booking?._backendId || reportData.bookingId;
            const engineer = engineers.find(e => e.id === reportData.engineerId);
            const backendEngineerId = engineer?._backendId || reportData.engineerId;
            try {
                const result = await TorchBackend.sessionReports.create({
                    bookingId: backendBookingId,
                    engineerId: backendEngineerId,
                    actualStartTime: reportData.actualStartTime,
                    actualEndTime: reportData.actualEndTime,
                    actualHours: reportData.actualHours,
                    workType: reportData.workType,
                    projectName: reportData.projectName,
                    tracksWorked: reportData.tracksWorked,
                    equipmentUsed: reportData.equipmentUsed,
                    sessionQuality: reportData.sessionQuality,
                    notes: reportData.notes,
                    issuesReported: reportData.issuesReported,
                    followUpNeeded: reportData.followUpNeeded
                });
                await this.refreshSessionReports();
                this.logActivity(`Session report created for ${booking?.memberName || ''}`, 'report');
                return { success: true, report: result };
            } catch (err) {
                console.warn('[TorchAPI] Backend createSessionReport failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const booking = bookings.find(b => b.id === reportData.bookingId);
        if (!booking) return { success: false, errors: ['Booking not found'] };
        const engineer = engineers.find(e => e.id === reportData.engineerId);
        if (!engineer) return { success: false, errors: ['Engineer not found'] };
        const member = members.find(m => m.id === booking.memberId);
        const newReport = { id: this.nextSessionReportId++, bookingId: reportData.bookingId, engineerId: reportData.engineerId, engineerName: engineer.name, memberId: booking.memberId, memberName: member?.name || booking.memberName, sessionDate: booking.date, actualStartTime: reportData.actualStartTime || booking.startTime, actualEndTime: reportData.actualEndTime || booking.endTime, actualHours: reportData.actualHours || booking.hours, workType: reportData.workType || booking.type, projectName: reportData.projectName || '', tracksWorked: reportData.tracksWorked || [], equipmentUsed: reportData.equipmentUsed || [], sessionQuality: reportData.sessionQuality || 3, notes: reportData.notes || '', issuesReported: reportData.issuesReported || '', followUpNeeded: reportData.followUpNeeded || false, status: 'draft', submittedAt: null, reviewedBy: null, reviewedAt: null, createdAt: new Date().toISOString() };
        sessionReports.push(newReport);
        const bookingIndex = bookings.findIndex(b => b.id === reportData.bookingId);
        if (bookingIndex !== -1) bookings[bookingIndex].sessionReportId = newReport.id;
        if (typeof TorchStorage !== 'undefined') { TorchStorage.saveSessionReports(); TorchStorage.saveBookings(); }
        this.logActivity(`Session report created for ${booking.memberName}`, 'report');
        return { success: true, report: newReport };
    },

    // Update session report — tries backend first
    async updateSessionReport(reportId, updates) {
        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            try {
                await TorchBackend.sessionReports.update(reportId, updates);
                await this.refreshSessionReports();
                return { success: true };
            } catch (err) {
                console.warn('[TorchAPI] Backend updateSessionReport failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const reportIndex = sessionReports.findIndex(r => r.id === reportId);
        if (reportIndex === -1) {
            return { success: false, errors: ['Report not found'] };
        }
        const updatedReport = { ...sessionReports[reportIndex], ...updates, updatedAt: new Date().toISOString() };
        sessionReports[reportIndex] = updatedReport;
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveSessionReports();
        return { success: true, report: updatedReport };
    },

    // Submit session report — tries backend first
    async submitSessionReport(reportId) {
        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            try {
                await TorchBackend.sessionReports.submit(reportId);
                await this.refreshSessionReports();
                this.logActivity('Session report submitted', 'report');
                return { success: true };
            } catch (err) {
                console.warn('[TorchAPI] Backend submitSessionReport failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const reportIndex = sessionReports.findIndex(r => r.id === reportId);
        if (reportIndex === -1) {
            return { success: false, errors: ['Report not found'] };
        }
        sessionReports[reportIndex].status = 'submitted';
        sessionReports[reportIndex].submittedAt = new Date().toISOString();
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveSessionReports();
        this.logActivity(`Session report submitted by ${sessionReports[reportIndex].engineerName}`, 'report');
        return { success: true, report: sessionReports[reportIndex] };
    },

    // Review session report (admin) — tries backend first
    async reviewSessionReport(reportId, reviewedBy) {
        // Try backend first
        if (this.backendAvailable && typeof TorchBackend !== 'undefined') {
            try {
                await TorchBackend.sessionReports.review(reportId);
                await this.refreshSessionReports();
                this.logActivity('Session report reviewed', 'report');
                return { success: true };
            } catch (err) {
                console.warn('[TorchAPI] Backend reviewSessionReport failed:', err.message);
                return { success: false, errors: [err.message] };
            }
        }

        // Fallback: local
        const reportIndex = sessionReports.findIndex(r => r.id === reportId);
        if (reportIndex === -1) {
            return { success: false, errors: ['Report not found'] };
        }
        sessionReports[reportIndex].status = 'reviewed';
        sessionReports[reportIndex].reviewedBy = reviewedBy;
        sessionReports[reportIndex].reviewedAt = new Date().toISOString();
        if (typeof TorchStorage !== 'undefined') TorchStorage.saveSessionReports();
        this.logActivity(`Session report reviewed for ${sessionReports[reportIndex].memberName}`, 'report');
        return { success: true, report: sessionReports[reportIndex] };
    },

    // Get session report by ID
    getSessionReport(reportId) {
        const report = sessionReports.find(r => r.id === reportId);
        if (!report) {
            return { success: false, errors: ['Report not found'] };
        }
        return { success: true, report: report };
    },

    // Get session reports with filters
    getSessionReports(filters = {}) {
        let result = [...sessionReports];

        if (filters.engineerId) {
            result = result.filter(r => r.engineerId === filters.engineerId);
        }
        if (filters.memberId) {
            result = result.filter(r => r.memberId === filters.memberId);
        }
        if (filters.status) {
            result = result.filter(r => r.status === filters.status);
        }
        if (filters.dateFrom) {
            result = result.filter(r => r.sessionDate >= filters.dateFrom);
        }
        if (filters.dateTo) {
            result = result.filter(r => r.sessionDate <= filters.dateTo);
        }

        result.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

        return { success: true, reports: result, count: result.length };
    },

    // Get report for a specific booking
    getReportForBooking(bookingId) {
        const report = sessionReports.find(r => r.bookingId === bookingId);
        return { success: true, report: report || null };
    }
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.TorchAPI = TorchAPI;
}

console.log('[TorchAPI] API module loaded');
