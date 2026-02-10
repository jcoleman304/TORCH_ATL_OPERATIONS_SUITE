// TORCH ATL Operations Suite - Local Storage Persistence Layer

const TorchStorage = {
    // Storage keys
    KEYS: {
        MEMBERS: 'torch_members',
        BOOKINGS: 'torch_bookings',
        SMS_HISTORY: 'torch_sms_history',
        EMAIL_HISTORY: 'torch_email_history',
        ACTIVITY_FEED: 'torch_activity_feed',
        ENGINEERS: 'torch_engineers',
        ADMIN_USERS: 'torch_admin_users',
        SESSION_REPORTS: 'torch_session_reports',
        CURRENT_ADMIN: 'torch_current_admin',
        SETTINGS: 'torch_settings',
        SYNC_MANIFEST: 'torch_sync_manifest',
        LAST_SYNC: 'torch_last_sync'
    },

    // Initialize storage - load all data on app start
    init() {
        console.log('[TorchStorage] Initializing storage layer...');

        // Load existing data or use defaults from data.js
        this.loadAll();

        // Set up auto-save watchers
        this.setupAutoSave();

        console.log('[TorchStorage] Storage layer initialized');
        return this;
    },

    // Load all data from localStorage
    loadAll() {
        const loadedMembers = this.load(this.KEYS.MEMBERS);
        const loadedBookings = this.load(this.KEYS.BOOKINGS);
        const loadedSmsHistory = this.load(this.KEYS.SMS_HISTORY);
        const loadedEmailHistory = this.load(this.KEYS.EMAIL_HISTORY);
        const loadedActivityFeed = this.load(this.KEYS.ACTIVITY_FEED);
        const loadedEngineers = this.load(this.KEYS.ENGINEERS);
        const loadedAdminUsers = this.load(this.KEYS.ADMIN_USERS);
        const loadedSessionReports = this.load(this.KEYS.SESSION_REPORTS);
        const loadedCurrentAdmin = this.load(this.KEYS.CURRENT_ADMIN);

        // Only override global variables if we have saved data
        if (loadedMembers && loadedMembers.length > 0) {
            members = loadedMembers;
            console.log(`[TorchStorage] Loaded ${members.length} members from storage`);
        }

        if (loadedBookings && loadedBookings.length > 0) {
            bookings = loadedBookings;
            console.log(`[TorchStorage] Loaded ${bookings.length} bookings from storage`);
        }

        if (loadedSmsHistory && loadedSmsHistory.length > 0) {
            smsHistory = loadedSmsHistory;
            console.log(`[TorchStorage] Loaded ${smsHistory.length} SMS records from storage`);
        }

        if (loadedEmailHistory) {
            emailHistory = loadedEmailHistory;
            console.log(`[TorchStorage] Loaded email history from storage`);
        }

        if (loadedActivityFeed && loadedActivityFeed.length > 0) {
            activityFeed = loadedActivityFeed;
            console.log(`[TorchStorage] Loaded ${activityFeed.length} activity items from storage`);
        }

        if (loadedEngineers && loadedEngineers.length > 0) {
            engineers = loadedEngineers;
            console.log(`[TorchStorage] Loaded ${engineers.length} engineers from storage`);
        }

        if (loadedAdminUsers && loadedAdminUsers.length > 0) {
            adminUsers = loadedAdminUsers;
            console.log(`[TorchStorage] Loaded ${adminUsers.length} admin users from storage`);
        }

        if (loadedSessionReports && loadedSessionReports.length > 0) {
            sessionReports = loadedSessionReports;
            console.log(`[TorchStorage] Loaded ${sessionReports.length} session reports from storage`);
        }

        if (loadedCurrentAdmin) {
            currentAdminUser = loadedCurrentAdmin;
            console.log(`[TorchStorage] Loaded current admin session: ${currentAdminUser.name}`);
        }
    },

    // Load a single key from localStorage
    load(key) {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error(`[TorchStorage] Error loading ${key}:`, error);
            return null;
        }
    },

    // Save a single key to localStorage
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            this.updateSyncManifest(key);
            return true;
        } catch (error) {
            console.error(`[TorchStorage] Error saving ${key}:`, error);
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('[TorchStorage] Storage quota exceeded. Consider exporting data.');
            }
            return false;
        }
    },

    // Save all current data to localStorage
    saveAll() {
        console.log('[TorchStorage] Saving all data...');

        this.save(this.KEYS.MEMBERS, members);
        this.save(this.KEYS.BOOKINGS, bookings);
        this.save(this.KEYS.SMS_HISTORY, smsHistory);
        this.save(this.KEYS.EMAIL_HISTORY, emailHistory);
        this.save(this.KEYS.ACTIVITY_FEED, activityFeed);
        this.save(this.KEYS.ENGINEERS, engineers);
        this.save(this.KEYS.ADMIN_USERS, adminUsers);
        this.save(this.KEYS.SESSION_REPORTS, sessionReports);

        console.log('[TorchStorage] All data saved');
    },

    // Save specific data type
    saveMembers() {
        return this.save(this.KEYS.MEMBERS, members);
    },

    saveBookings() {
        return this.save(this.KEYS.BOOKINGS, bookings);
    },

    saveSmsHistory() {
        return this.save(this.KEYS.SMS_HISTORY, smsHistory);
    },

    saveEmailHistory() {
        return this.save(this.KEYS.EMAIL_HISTORY, emailHistory);
    },

    saveActivityFeed() {
        return this.save(this.KEYS.ACTIVITY_FEED, activityFeed);
    },

    saveEngineers() {
        return this.save(this.KEYS.ENGINEERS, engineers);
    },

    saveAdminUsers() {
        return this.save(this.KEYS.ADMIN_USERS, adminUsers);
    },

    saveSessionReports() {
        return this.save(this.KEYS.SESSION_REPORTS, sessionReports);
    },

    saveCurrentAdmin() {
        return this.save(this.KEYS.CURRENT_ADMIN, currentAdminUser);
    },

    clearCurrentAdmin() {
        currentAdminUser = null;
        localStorage.removeItem(this.KEYS.CURRENT_ADMIN);
    },

    // Set up auto-save using Proxy observers
    setupAutoSave() {
        // We'll use a debounced save approach
        let saveTimeout = null;

        const debouncedSave = () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            saveTimeout = setTimeout(() => {
                this.saveAll();
            }, 1000); // Save 1 second after last change
        };

        // Store reference for manual triggering
        this.triggerAutoSave = debouncedSave;

        console.log('[TorchStorage] Auto-save configured');
    },

    // Update sync manifest for iCloud tracking
    updateSyncManifest(key) {
        const manifest = this.load(this.KEYS.SYNC_MANIFEST) || {};
        manifest[key] = {
            lastModified: new Date().toISOString(),
            version: (manifest[key]?.version || 0) + 1
        };
        localStorage.setItem(this.KEYS.SYNC_MANIFEST, JSON.stringify(manifest));
    },

    // Export all data to JSON for backup/sync
    exportToJSON() {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: {
                members: members,
                bookings: bookings,
                smsHistory: smsHistory,
                emailHistory: emailHistory,
                activityFeed: activityFeed,
                engineers: engineers,
                adminUsers: adminUsers,
                sessionReports: sessionReports,
                settings: this.load(this.KEYS.SETTINGS) || {}
            },
            manifest: this.load(this.KEYS.SYNC_MANIFEST) || {}
        };

        return JSON.stringify(exportData, null, 2);
    },

    // Import data from JSON
    importFromJSON(jsonString) {
        try {
            const importData = JSON.parse(jsonString);

            // Validate structure
            if (!importData.version || !importData.data) {
                throw new Error('Invalid export file format');
            }

            // Version compatibility check
            const [major] = importData.version.split('.');
            if (parseInt(major) !== 1) {
                throw new Error(`Incompatible version: ${importData.version}`);
            }

            // Import data with conflict resolution
            const conflicts = this.resolveImportConflicts(importData);

            if (conflicts.length > 0) {
                console.log('[TorchStorage] Import conflicts detected:', conflicts);
                return { success: false, conflicts: conflicts };
            }

            // Apply imported data
            if (importData.data.members) {
                members = importData.data.members;
                this.saveMembers();
            }
            if (importData.data.bookings) {
                bookings = importData.data.bookings;
                this.saveBookings();
            }
            if (importData.data.smsHistory) {
                smsHistory = importData.data.smsHistory;
                this.saveSmsHistory();
            }
            if (importData.data.emailHistory) {
                emailHistory = importData.data.emailHistory;
                this.saveEmailHistory();
            }
            if (importData.data.activityFeed) {
                activityFeed = importData.data.activityFeed;
                this.saveActivityFeed();
            }
            if (importData.data.settings) {
                this.save(this.KEYS.SETTINGS, importData.data.settings);
            }

            console.log('[TorchStorage] Import completed successfully');
            return { success: true, importedAt: new Date().toISOString() };

        } catch (error) {
            console.error('[TorchStorage] Import error:', error);
            return { success: false, error: error.message };
        }
    },

    // Resolve conflicts between local and imported data
    resolveImportConflicts(importData) {
        const conflicts = [];
        const localManifest = this.load(this.KEYS.SYNC_MANIFEST) || {};
        const importManifest = importData.manifest || {};

        // Check each data type for conflicts
        Object.keys(this.KEYS).forEach(keyName => {
            const key = this.KEYS[keyName];
            const localVersion = localManifest[key]?.version || 0;
            const importVersion = importManifest[key]?.version || 0;
            const localTime = new Date(localManifest[key]?.lastModified || 0);
            const importTime = new Date(importManifest[key]?.lastModified || 0);

            // Conflict if both have changes and versions differ
            if (localVersion > 0 && importVersion > 0 &&
                localVersion !== importVersion &&
                Math.abs(localTime - importTime) > 60000) { // More than 1 minute difference
                conflicts.push({
                    key: key,
                    localVersion: localVersion,
                    importVersion: importVersion,
                    localTime: localTime.toISOString(),
                    importTime: importTime.toISOString()
                });
            }
        });

        return conflicts;
    },

    // Force import (override local with imported data)
    forceImport(jsonString) {
        try {
            const importData = JSON.parse(jsonString);

            if (importData.data.members) {
                members = importData.data.members;
            }
            if (importData.data.bookings) {
                bookings = importData.data.bookings;
            }
            if (importData.data.smsHistory) {
                smsHistory = importData.data.smsHistory;
            }
            if (importData.data.emailHistory) {
                emailHistory = importData.data.emailHistory;
            }
            if (importData.data.activityFeed) {
                activityFeed = importData.data.activityFeed;
            }

            this.saveAll();
            console.log('[TorchStorage] Force import completed');
            return { success: true };

        } catch (error) {
            console.error('[TorchStorage] Force import error:', error);
            return { success: false, error: error.message };
        }
    },

    // Download export file
    downloadExport() {
        const jsonData = this.exportToJSON();
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `torch-atl-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[TorchStorage] Export downloaded');
    },

    // Clear all stored data
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('[TorchStorage] All storage cleared');
    },

    // Get storage statistics
    getStats() {
        let totalSize = 0;
        const stats = {};

        Object.entries(this.KEYS).forEach(([name, key]) => {
            const data = localStorage.getItem(key);
            const size = data ? new Blob([data]).size : 0;
            stats[name] = {
                size: size,
                sizeFormatted: this.formatBytes(size)
            };
            totalSize += size;
        });

        stats.total = {
            size: totalSize,
            sizeFormatted: this.formatBytes(totalSize),
            percentUsed: (totalSize / (5 * 1024 * 1024) * 100).toFixed(2) + '%' // Assuming 5MB limit
        };

        return stats;
    },

    // Format bytes for display
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.TorchStorage = TorchStorage;
}

console.log('[TorchStorage] Storage module loaded');
