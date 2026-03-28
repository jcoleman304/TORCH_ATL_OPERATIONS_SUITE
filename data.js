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

// All data loaded from backend — no local seed data
let members = [];
let bookings = [];
let smsHistory = [];
let emailHistory = { sent: [], scheduled: [], drafts: [] };
let activityFeed = [];
let engineers = [];
let adminUsers = [
    {
        id: 'admin-001',
        name: 'Joi Coleman',
        email: 'joi.coleman@torchatl.com',
        role: 'admin',
        accessCode: 'Torch3814!',
        permissions: ['all']
    },
    {
        id: 'admin-002',
        name: 'Nate Certain',
        email: 'nate@torchatl.com',
        role: 'manager',
        accessCode: 'TorchNate2026',
        permissions: ['all']
    }
];
let sessionReports = [];

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

// Current logged-in user (for Operations Suite)
let currentAdminUser = null;

// Launch date
const LAUNCH_DATE = new Date('2026-03-15');

// ============================================
// OPERATIONS HUB DATA
// ============================================

let nateTasks = [];
let vendors = [];
let maintenanceLog = [];
let linenStandards = [];

let clients = [];
let inquiries = [];
let tdpMembers = [];
let invoicesData = [];
let expenses = [];
let barterItems = [];
let campOutreach = [];
let tdpProspects = [];
let marketingCal = [];
let buildMilestones = [];
let equipmentInv = [];
let priorityFlag = '';

// Seed milestones
const SEED_MILESTONES = [
    { id: 'ms-001', title: 'Studios B & C — bookable now', owner: 'Joi', targetDate: '2026-03-15', status: 'completed', notes: 'Both rooms operational', createdAt: '2026-03-15T00:00:00.000Z' },
    { id: 'ms-002', title: 'Booking portal live', owner: 'Joi', targetDate: '2026-04-15', status: 'in_progress', notes: 'Building on existing backend', createdAt: '2026-03-23T00:00:00.000Z' },
    { id: 'ms-003', title: 'First camp booking confirmed', owner: 'Joi', targetDate: '2026-05-01', status: 'not_started', notes: '', createdAt: '2026-03-23T00:00:00.000Z' },
    { id: 'ms-004', title: 'First TDP partnership activated', owner: 'Joi', targetDate: '2026-05-15', status: 'not_started', notes: '', createdAt: '2026-03-23T00:00:00.000Z' },
    { id: 'ms-005', title: 'Studio A acoustic finishing complete', owner: 'Chuck', targetDate: '2026-09-01', status: 'in_progress', notes: 'Booth door (full glass-frame), additional panels', createdAt: '2026-03-23T00:00:00.000Z' },
    { id: 'ms-006', title: 'Garage room build begins', owner: 'Chuck', targetDate: '2026-10-01', status: 'not_started', notes: '', createdAt: '2026-03-23T00:00:00.000Z' }
];

// Seed data — only used if localStorage is empty (loaded in app.js init)
const SEED_VENDORS = [
    {
        id: 'vendor-hvac-001',
        name: 'HVAC Service Visit',
        category: 'hvac',
        contactName: '',
        phone: '',
        email: '',
        rate: '',
        rating: 3,
        notes: 'Visited March 23, 2026. Found upstairs unit is undersized for the space. Both upstairs and downstairs filters changed.',
        createdAt: '2026-03-23T12:00:00.000Z',
        updatedAt: '2026-03-23T12:00:00.000Z'
    }
];

const SEED_MAINTENANCE = [
    {
        id: 'maint-001',
        title: 'Upstairs HVAC unit undersized',
        priority: 'high',
        status: 'open',
        area: 'hvac',
        assignedTo: 'HVAC Vendor',
        reportedDate: '2026-03-23',
        nextServiceDate: '',
        estimatedCost: '',
        description: 'HVAC company visited and determined the upstairs unit is undersized for the space. Needs evaluation for replacement or supplemental unit.',
        createdAt: '2026-03-23T12:00:00.000Z',
        updatedAt: '2026-03-23T12:00:00.000Z'
    },
    {
        id: 'maint-002',
        title: 'HVAC filter replacement — upstairs',
        priority: 'low',
        status: 'resolved',
        area: 'hvac',
        assignedTo: 'HVAC Vendor',
        reportedDate: '2026-03-23',
        resolvedDate: '2026-03-23',
        nextServiceDate: '2026-06-23',
        estimatedCost: '',
        description: 'Upstairs unit filter changed on March 23, 2026. Next filter change due June 23, 2026.',
        createdAt: '2026-03-23T12:00:00.000Z',
        updatedAt: '2026-03-23T12:00:00.000Z'
    },
    {
        id: 'maint-003',
        title: 'HVAC filter replacement — downstairs',
        priority: 'low',
        status: 'resolved',
        area: 'hvac',
        assignedTo: 'HVAC Vendor',
        reportedDate: '2026-03-23',
        resolvedDate: '2026-03-23',
        nextServiceDate: '2026-06-23',
        estimatedCost: '',
        description: 'Downstairs unit filter changed on March 23, 2026. Next filter change due June 23, 2026.',
        createdAt: '2026-03-23T12:00:00.000Z',
        updatedAt: '2026-03-23T12:00:00.000Z'
    }
];
