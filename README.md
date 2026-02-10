# TORCH ATL Operations Suite

A complete membership management system for Torch ATL - Atlanta's membership-only recording estate.

---

## Quick Start

**Option 1: Double-click launcher**
```
launch-torch.command
```

**Option 2: Open directly**
```
open index.html
```

---

## Features

### Dashboard
- Real-time member count and MRR
- Weekly session tracker
- Calendar utilization
- Tier breakdown visualization
- Upcoming sessions
- Activity feed

### Member CRM
- Full member database
- Search and filter (tier, status)
- Add/edit/view members
- Hour tracking
- Founding member discount calculation
- Access code management

### Booking Management
- Calendar view (click to book)
- List view with all bookings
- Guest registration
- Hour validation
- Conflict detection

### SMS Automation
- Quick send to groups
- 4 pre-built templates
- Automation toggles
- Message history
- Character counter

### Email Blast
- Rich text editor
- Variable insertion ({name}, {tier}, etc.)
- 4 email templates
- Preview before send
- Sent/Scheduled/Drafts

---

## Backend Systems

### storage.js - Data Persistence
- Auto-saves to localStorage
- Export/import JSON
- iCloud sync support

### api.js - Business Logic
- CRUD for members, bookings, SMS, emails
- Hour tracking and validation
- Billing calculations
- Webhook triggers

### automation.js - Scheduled Tasks
- Session reminders (24hr before)
- Hour usage warnings (80% threshold)
- Payment monitoring
- Daily/weekly reports
- Monthly hour reset

### icloud-sync.js - Cross-Device Sync
- Auto-sync every 5 minutes
- Conflict resolution
- Manual sync option
- Export/import

---

## n8n Workflows

Located in `/n8n-workflows/`:

| Workflow | Purpose |
|----------|---------|
| `torch-member-onboarding.json` | New member welcome flow |
| `torch-booking-flow.json` | Booking lifecycle management |
| `torch-billing-automation.json` | Monthly billing & dunning |
| `torch-daily-ops.json` | Daily briefings & checklists |
| `torch-master-workflow.json` | Master orchestration |

### To Import Workflows:
1. Start n8n: `n8n start`
2. Open http://localhost:5678
3. Go to Workflows > Import from File
4. Select each JSON file
5. Configure credentials

### Required Integrations:
- **SMTP** - Email sending
- **Twilio** - SMS
- **Google Calendar** - Scheduling
- **Square** - Payments
- **Slack** - Notifications (optional)
- **HubSpot** - CRM sync (optional)

---

## iCloud Sync Setup

Run the setup script:
```
./setup-icloud-sync.command
```

This creates:
- `~/Library/Mobile Documents/com~apple~CloudDocs/TORCH_ATL_Sync/`
- Syncs data across all iCloud devices

---

## Pricing Configuration

| Tier | Rate | Hours | Cap |
|------|------|-------|-----|
| Residency | $5,000/mo | 120 hrs | 4 |
| Member | $3,500/mo | 64 hrs | 5 |
| Session | $2,200/mo | 32 hrs | 15 |

| Camps | Rate |
|-------|------|
| 3-Day | $3,000 |
| 5-Day | $5,000 |

Founding members get 15% off (locked forever).

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close modals |

---

## File Structure

```
TORCH_ATL_OPERATIONS_SUITE/
├── index.html              # Main application
├── styles.css              # Styling
├── data.js                 # Data models & sample data
├── app.js                  # UI logic
├── storage.js              # localStorage persistence
├── api.js                  # Business logic API
├── automation.js           # Scheduled tasks
├── icloud-sync.js          # iCloud integration
├── launch-torch.command    # Launcher script
├── setup-icloud-sync.command # iCloud setup
├── README.md               # This file
└── n8n-workflows/
    ├── torch-member-onboarding.json
    ├── torch-booking-flow.json
    ├── torch-billing-automation.json
    ├── torch-daily-ops.json
    └── torch-master-workflow.json
```

---

## Launch Date

**March 15, 2026**

---

## Support

Built for Torch Music Corporation by CARBON[6] AI.

*Torch ATL — Where serious creators build.*
