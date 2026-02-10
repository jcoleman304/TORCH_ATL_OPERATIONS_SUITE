// TORCH ATL Operations Suite - Data Layer

// Tier Configuration
const TIERS = {
    Residency: {
        name: 'Residency',
        price: 5000,
        foundingPrice: 4250,
        hours: 120,
        cap: 4,
        color: '#D4AF37'
    },
    Member: {
        name: 'Member',
        price: 3500,
        foundingPrice: 2975,
        hours: 64,
        cap: 5,
        color: '#60a5fa'
    },
    Session: {
        name: 'Session',
        price: 2200,
        foundingPrice: 1870,
        hours: 32,
        cap: 15,
        color: '#a78bfa'
    }
};

// Sample Members Data
let members = [
    {
        id: 1,
        name: 'Derrick Milano',
        email: 'derrick@example.com',
        phone: '(404) 555-0101',
        tier: 'Residency',
        status: 'Active',
        hoursUsed: 45,
        hoursTotal: 120,
        monthlyRate: 5000,
        startDate: '2026-03-15',
        company: 'Milano Music',
        founding: true,
        accessCode: 'DM001',
        notes: 'Founding Ambassador. Priority booking.'
    },
    {
        id: 2,
        name: 'Sarah Chen',
        email: 'sarah@atlanticrecords.com',
        phone: '(404) 555-0102',
        tier: 'Member',
        status: 'Active',
        hoursUsed: 24,
        hoursTotal: 64,
        monthlyRate: 2975,
        startDate: '2026-03-20',
        company: 'Atlantic Records',
        founding: true,
        accessCode: 'SC002',
        notes: 'A&R bringing artists monthly.'
    },
    {
        id: 3,
        name: 'Marcus Thompson',
        email: 'marcus@beatmakers.co',
        phone: '(404) 555-0103',
        tier: 'Session',
        status: 'Active',
        hoursUsed: 16,
        hoursTotal: 32,
        monthlyRate: 1870,
        startDate: '2026-03-22',
        company: 'Beatmakers Co',
        founding: true,
        accessCode: 'MT003',
        notes: 'Producer, works late sessions.'
    },
    {
        id: 4,
        name: 'Keisha Williams',
        email: 'keisha@qualitycontrol.com',
        phone: '(404) 555-0104',
        tier: 'Member',
        status: 'Pending',
        hoursUsed: 0,
        hoursTotal: 64,
        monthlyRate: 3500,
        startDate: '2026-04-01',
        company: 'Quality Control',
        founding: false,
        accessCode: '',
        notes: 'Referred by Derrick Milano.'
    },
    {
        id: 5,
        name: 'Jordan Blake',
        email: 'jblake@gmail.com',
        phone: '(404) 555-0105',
        tier: 'Session',
        status: 'Active',
        hoursUsed: 8,
        hoursTotal: 32,
        monthlyRate: 1870,
        startDate: '2026-03-25',
        company: 'Independent',
        founding: true,
        accessCode: 'JB005',
        notes: 'Singer-songwriter.'
    }
];

// Sample Bookings Data
let bookings = [
    {
        id: 1,
        memberId: 1,
        memberName: 'Derrick Milano',
        date: '2026-02-10',
        startTime: '14:00',
        endTime: '22:00',
        hours: 8,
        guests: 3,
        guestNames: ['Mike Producer', 'Lisa Writer', 'James Engineer'],
        type: 'Recording',
        status: 'Confirmed',
        engineerId: 1,
        engineerName: 'James Rodriguez',
        engineerRequested: true,
        preferredEngineerId: 1,
        engineerStatus: 'accepted',
        engineerAcceptedAt: '2026-02-08T10:00:00.000Z',
        sessionReportId: 1
    },
    {
        id: 2,
        memberId: 2,
        memberName: 'Sarah Chen',
        date: '2026-02-11',
        startTime: '10:00',
        endTime: '18:00',
        hours: 8,
        guests: 2,
        guestNames: ['New Artist', 'Manager'],
        type: 'Meeting',
        status: 'Confirmed',
        engineerId: null,
        engineerName: '',
        engineerRequested: false,
        preferredEngineerId: null,
        engineerStatus: 'none',
        engineerAcceptedAt: null,
        sessionReportId: null
    },
    {
        id: 3,
        memberId: 3,
        memberName: 'Marcus Thompson',
        date: '2026-02-12',
        startTime: '18:00',
        endTime: '02:00',
        hours: 8,
        guests: 0,
        guestNames: [],
        type: 'Recording',
        status: 'Confirmed',
        engineerId: 2,
        engineerName: 'Maya Chen',
        engineerRequested: true,
        preferredEngineerId: 2,
        engineerStatus: 'assigned',
        engineerAcceptedAt: null,
        sessionReportId: null
    },
    {
        id: 4,
        memberId: 1,
        memberName: 'Derrick Milano',
        date: '2026-02-14',
        startTime: '12:00',
        endTime: '20:00',
        hours: 8,
        guests: 5,
        guestNames: ['Camp Participant 1', 'Camp Participant 2', 'Camp Participant 3', 'Camp Participant 4', 'Camp Participant 5'],
        type: 'Camp',
        status: 'Confirmed',
        engineerId: 1,
        engineerName: 'James Rodriguez',
        engineerRequested: true,
        preferredEngineerId: null,
        engineerStatus: 'requested',
        engineerAcceptedAt: null,
        sessionReportId: null
    },
    {
        id: 5,
        memberId: 5,
        memberName: 'Jordan Blake',
        date: '2026-02-15',
        startTime: '10:00',
        endTime: '14:00',
        hours: 4,
        guests: 1,
        guestNames: ['Guitar Player'],
        type: 'Recording',
        status: 'Confirmed',
        engineerId: 3,
        engineerName: 'Devon Williams',
        engineerRequested: true,
        preferredEngineerId: 3,
        engineerStatus: 'accepted',
        engineerAcceptedAt: '2026-02-13T15:00:00.000Z',
        sessionReportId: null
    }
];

// SMS History
let smsHistory = [
    {
        id: 1,
        message: 'Hey Derrick, reminder: you\'re booked at Torch tomorrow at 2pm. See you then.',
        recipients: 'Derrick Milano',
        sentAt: '2026-02-09 10:00',
        status: 'Delivered'
    },
    {
        id: 2,
        message: 'Welcome to Torch ATL, Sarah! Your access code is SC002. Book your first session at torchatl.com/book',
        recipients: 'Sarah Chen',
        sentAt: '2026-02-08 14:30',
        status: 'Delivered'
    },
    {
        id: 3,
        message: 'Hi Marcus, please submit your guest list for your 2/12 session. Reply with names or text "none".',
        recipients: 'Marcus Thompson',
        sentAt: '2026-02-10 09:00',
        status: 'Delivered'
    }
];

// Email History
let emailHistory = {
    sent: [
        {
            id: 1,
            subject: 'Welcome to Torch ATL — You\'re In',
            recipients: 'All New Members',
            sentAt: '2026-02-08',
            opens: 5,
            clicks: 3
        },
        {
            id: 2,
            subject: 'Your Torch Credentials Are Ready',
            recipients: 'Sarah Chen',
            sentAt: '2026-02-08',
            opens: 1,
            clicks: 1
        },
        {
            id: 3,
            subject: 'Founding Member Update — March 2026',
            recipients: 'All Founding Members',
            sentAt: '2026-02-05',
            opens: 4,
            clicks: 2
        }
    ],
    scheduled: [
        {
            id: 4,
            subject: 'Your Monthly Hours Reset',
            recipients: 'All Members',
            scheduledFor: '2026-03-01 08:00'
        }
    ],
    drafts: [
        {
            id: 5,
            subject: 'Writing Camp Announcement',
            lastEdited: '2026-02-08'
        }
    ]
};

// Activity Feed
let activityFeed = [
    {
        text: 'Derrick Milano checked in',
        time: '2 hours ago',
        type: 'checkin'
    },
    {
        text: 'New booking: Sarah Chen (Feb 11)',
        time: '4 hours ago',
        type: 'booking'
    },
    {
        text: 'Payment received: Marcus Thompson',
        time: '1 day ago',
        type: 'payment'
    },
    {
        text: 'New member application: Keisha Williams',
        time: '2 days ago',
        type: 'application'
    },
    {
        text: 'Session completed: Jordan Blake',
        time: '3 days ago',
        type: 'session'
    }
];

// Email Templates
const emailTemplates = {
    welcome: {
        subject: 'Welcome to Torch ATL — You\'re In',
        body: `<p>Hi {name},</p>

<p>Welcome to Torch ATL.</p>

<p>You're now part of a small group of creators with access to Atlanta's only membership-only recording estate. This isn't a studio rental. This is your creative home.</p>

<p><strong>Here's what happens next:</strong></p>

<ol>
<li><strong>ORIENTATION:</strong> We'll schedule a quick call or in-person tour to walk you through the space, systems, and house rules.</li>
<li><strong>CREDENTIALS:</strong> After orientation, you'll receive your access code and Torch credential card.</li>
<li><strong>FIRST BOOKING:</strong> Once you have credentials, you can book your first session through the member calendar.</li>
</ol>

<p>If you have questions before orientation, reply to this email or text our concierge.</p>

<p>We built Torch for people like you. Welcome home.</p>

<p>— Joi Coleman<br>Founder, Torch ATL</p>`
    },
    credentials: {
        subject: 'Your Torch Credentials Are Ready',
        body: `<p>Hi {name},</p>

<p>You're all set.</p>

<p><strong>ACCESS CODE:</strong> {code}<br>
(Use this at the front entrance keypad)</p>

<p><strong>BOOKING SYSTEM:</strong> <a href="#">Member Calendar</a><br>
Your tier: {tier}<br>
Your hours: {hours_remaining} hours/month<br>
Your booking window: Based on your tier</p>

<p><strong>CONCIERGE:</strong> (404) 555-TORCH — Text or call for day-of support</p>

<p>House Rules reminder attached. Review before your first visit.</p>

<p>Welcome to Torch.</p>

<p>— Torch ATL Team</p>`
    },
    monthly: {
        subject: 'Your Monthly Torch Update — {month}',
        body: `<p>Hi {name},</p>

<p>Here's your Torch ATL summary for this month:</p>

<p><strong>Hours Used:</strong> {hours_used} of {hours_total}<br>
<strong>Hours Remaining:</strong> {hours_remaining}<br>
<strong>Sessions Completed:</strong> {sessions_count}</p>

<p>Remember: Hours reset on the 1st of each month and don't roll over.</p>

<p>Book your remaining hours: <a href="#">Member Calendar</a></p>

<p>See you at Torch.</p>

<p>— Torch ATL Team</p>`
    },
    camp: {
        subject: 'Writing Camp Announcement — {dates}',
        body: `<p>Hi {name},</p>

<p>We're hosting a writing camp at Torch ATL.</p>

<p><strong>Dates:</strong> {dates}<br>
<strong>Host:</strong> {host}<br>
<strong>Focus:</strong> {focus}</p>

<p>During camp dates, regular member bookings will be limited. If you have a booking during this period, our concierge will reach out to reschedule.</p>

<p>Questions? Reply to this email.</p>

<p>— Torch ATL Team</p>`
    }
};

// SMS Templates
const smsTemplates = {
    reminder: 'Hey {name}, reminder: you\'re booked at Torch tomorrow at {time}. See you then.',
    guest: 'Hi {name}, please submit your guest list for your {date} session. Reply with names or text "none".',
    welcome: 'Welcome to Torch ATL, {name}. Your access code is {code}. Book your first session at torchatl.com/book',
    payment: 'Hi {name}, we couldn\'t process your membership payment. Please update your card to keep your access active.'
};

// Engineers Data with CRM tracking
let engineers = [
    {
        id: 1,
        name: 'James Rodriguez',
        email: 'jrodriguez.audio@gmail.com',
        phone: '(404) 555-0201',
        accessCode: 'ENG001',
        status: 'Active',
        role: 'Lead Engineer',
        specialties: ['Recording', 'Mixing', 'Mastering'],
        bio: 'Grammy-nominated engineer with 15 years of experience in hip-hop and R&B production. Specializes in vocal chains and analog warmth.',
        photoUrl: '',
        rate: 75,
        availability: {
            monday: { start: '10:00', end: '22:00' },
            tuesday: { start: '10:00', end: '22:00' },
            wednesday: { start: '10:00', end: '22:00' },
            thursday: { start: '10:00', end: '22:00' },
            friday: { start: '10:00', end: '22:00' },
            saturday: { start: '12:00', end: '20:00' },
            sunday: null
        },
        // CRM Performance Tracking
        stats: {
            totalSessions: 45,
            totalHours: 312,
            totalEarnings: 23400,
            averageRating: 4.8,
            acceptanceRate: 95,
            declinedSessions: 3
        },
        // Monthly tracking
        monthlyStats: {
            '2026-02': { sessions: 8, hours: 56, earnings: 4200 },
            '2026-01': { sessions: 12, hours: 84, earnings: 6300 }
        },
        notes: [
            { id: 1, text: 'Excellent with hip-hop artists. Very professional.', author: 'Joi Coleman', createdAt: '2026-02-01T10:00:00.000Z' },
            { id: 2, text: 'Prefers late-night sessions with R&B artists.', author: 'Joi Coleman', createdAt: '2026-02-05T14:00:00.000Z' }
        ],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
    },
    {
        id: 2,
        name: 'Maya Chen',
        email: 'mayachen.engineer@gmail.com',
        phone: '(404) 555-0202',
        accessCode: 'ENG002',
        status: 'Active',
        role: 'Recording Engineer',
        specialties: ['Recording', 'Mixing'],
        bio: 'Classically trained audio engineer specializing in live recording and acoustic treatments. Known for capturing pristine vocal performances.',
        photoUrl: '',
        rate: 65,
        availability: {
            monday: { start: '14:00', end: '02:00' },
            tuesday: { start: '14:00', end: '02:00' },
            wednesday: { start: '14:00', end: '02:00' },
            thursday: { start: '14:00', end: '02:00' },
            friday: { start: '14:00', end: '02:00' },
            saturday: { start: '14:00', end: '02:00' },
            sunday: null
        },
        stats: {
            totalSessions: 28,
            totalHours: 196,
            totalEarnings: 12740,
            averageRating: 4.9,
            acceptanceRate: 98,
            declinedSessions: 1
        },
        monthlyStats: {
            '2026-02': { sessions: 5, hours: 35, earnings: 2275 },
            '2026-01': { sessions: 8, hours: 56, earnings: 3640 }
        },
        notes: [
            { id: 1, text: 'Great with acoustic and live recording sessions.', author: 'Joi Coleman', createdAt: '2026-02-02T11:00:00.000Z' }
        ],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
    },
    {
        id: 3,
        name: 'Devon Williams',
        email: 'devwilliams.beats@gmail.com',
        phone: '(404) 555-0203',
        accessCode: 'ENG003',
        status: 'Active',
        role: 'Recording Engineer',
        specialties: ['Recording', 'Mastering'],
        bio: 'Beat-making producer turned engineer. Expert in trap and modern hip-hop production techniques.',
        photoUrl: '',
        rate: 60,
        availability: {
            monday: { start: '10:00', end: '18:00' },
            tuesday: { start: '10:00', end: '18:00' },
            wednesday: null,
            thursday: { start: '10:00', end: '18:00' },
            friday: { start: '10:00', end: '18:00' },
            saturday: { start: '10:00', end: '18:00' },
            sunday: { start: '12:00', end: '20:00' }
        },
        stats: {
            totalSessions: 18,
            totalHours: 108,
            totalEarnings: 6480,
            averageRating: 4.6,
            acceptanceRate: 90,
            declinedSessions: 2
        },
        monthlyStats: {
            '2026-02': { sessions: 4, hours: 24, earnings: 1440 },
            '2026-01': { sessions: 6, hours: 36, earnings: 2160 }
        },
        notes: [
            { id: 1, text: 'Producer background - great for beat-focused sessions.', author: 'Joi Coleman', createdAt: '2026-02-03T09:00:00.000Z' }
        ],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
    }
];

// Admin Users (for Operations Suite login)
let adminUsers = [
    {
        id: 1,
        name: 'Joi Coleman',
        email: 'joi@torchatl.com',
        accessCode: 'ADMIN2026',
        role: 'admin',
        engineerId: null,
        permissions: ['all'],
        createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 2,
        name: 'James Rodriguez',
        email: 'jrodriguez.audio@gmail.com',
        accessCode: 'ENG001',
        role: 'engineer',
        engineerId: 1,
        permissions: ['view_assigned_bookings', 'accept_bookings', 'submit_reports'],
        createdAt: '2026-02-01T00:00:00.000Z'
    },
    {
        id: 3,
        name: 'Maya Chen',
        email: 'mayachen.engineer@gmail.com',
        accessCode: 'ENG002',
        role: 'engineer',
        engineerId: 2,
        permissions: ['view_assigned_bookings', 'accept_bookings', 'submit_reports'],
        createdAt: '2026-02-01T00:00:00.000Z'
    },
    {
        id: 4,
        name: 'Devon Williams',
        email: 'devwilliams.beats@gmail.com',
        accessCode: 'ENG003',
        role: 'engineer',
        engineerId: 3,
        permissions: ['view_assigned_bookings', 'accept_bookings', 'submit_reports'],
        createdAt: '2026-02-01T00:00:00.000Z'
    }
];

// Session Reports
let sessionReports = [
    {
        id: 1,
        bookingId: 1,
        engineerId: 1,
        engineerName: 'James Rodriguez',
        memberId: 1,
        memberName: 'Derrick Milano',
        sessionDate: '2026-02-10',
        actualStartTime: '14:00',
        actualEndTime: '22:00',
        actualHours: 8,
        workType: 'Recording',
        projectName: 'Milano EP',
        tracksWorked: ['Track 1 - Intro', 'Track 2 - Main Single'],
        equipmentUsed: ['Neumann U87', 'SSL Console', 'Pro Tools'],
        sessionQuality: 5,
        notes: 'Great session. Derrick was in top form. Captured 6 vocal takes for the single.',
        issuesReported: '',
        followUpNeeded: false,
        status: 'submitted',
        submittedAt: '2026-02-10T23:00:00.000Z',
        reviewedBy: null,
        reviewedAt: null
    }
];

// Current logged-in user (for Operations Suite)
let currentAdminUser = null;

// Launch date
const LAUNCH_DATE = new Date('2026-03-15');
