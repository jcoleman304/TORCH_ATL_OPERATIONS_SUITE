// TORCH ATL Operations Suite - iCloud Sync Integration

const TorchiCloudSync = {
    // Sync configuration
    config: {
        syncIntervalMinutes: 5,
        maxConflictAge: 60000,           // 1 minute - conflicts older than this auto-resolve
        syncEnabled: true,
        debugMode: false
    },

    // Sync state
    state: {
        isRunning: false,
        lastSync: null,
        syncInProgress: false,
        pendingChanges: [],
        conflicts: []
    },

    // Sync manifest structure
    manifest: {
        version: '1.0',
        deviceId: null,
        lastModified: null,
        dataVersions: {}
    },

    // Initialize iCloud sync
    init() {
        console.log('[TorchiCloudSync] Initializing iCloud sync...');

        // Generate unique device ID
        this.manifest.deviceId = this.getOrCreateDeviceId();

        // Load existing manifest
        this.loadManifest();

        // Start auto-sync if enabled
        if (this.config.syncEnabled) {
            this.startAutoSync();
        }

        console.log('[TorchiCloudSync] iCloud sync initialized');
        return this;
    },

    // Start auto-sync interval
    startAutoSync() {
        if (this.state.isRunning) {
            console.log('[TorchiCloudSync] Auto-sync already running');
            return;
        }

        this.state.isRunning = true;

        // Sync every configured interval
        this.syncInterval = setInterval(() => {
            this.sync();
        }, this.config.syncIntervalMinutes * 60 * 1000);

        // Run initial sync
        this.sync();

        console.log(`[TorchiCloudSync] Auto-sync started (every ${this.config.syncIntervalMinutes} minutes)`);
    },

    // Stop auto-sync
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.state.isRunning = false;
        console.log('[TorchiCloudSync] Auto-sync stopped');
    },

    // ==================== MAIN SYNC OPERATIONS ====================

    // Perform full sync
    async sync() {
        if (this.state.syncInProgress) {
            console.log('[TorchiCloudSync] Sync already in progress, skipping...');
            return { success: false, reason: 'Sync in progress' };
        }

        this.state.syncInProgress = true;
        console.log('[TorchiCloudSync] Starting sync...');

        try {
            // Step 1: Export current data
            const exportData = this.exportForSync();

            // Step 2: Create iCloud-compatible file
            const syncFile = this.createSyncFile(exportData);

            // Step 3: Check for remote changes (simulated)
            const remoteData = await this.checkRemoteChanges();

            // Step 4: Handle conflicts if any
            if (remoteData && this.hasConflicts(remoteData)) {
                const resolution = await this.resolveConflicts(remoteData);
                if (!resolution.success) {
                    this.state.syncInProgress = false;
                    return resolution;
                }
            }

            // Step 5: Upload to iCloud (simulated)
            await this.uploadToiCloud(syncFile);

            // Step 6: Update manifest
            this.updateManifest();

            // Step 7: Record sync completion
            this.state.lastSync = new Date().toISOString();
            this.saveLastSync();

            this.state.syncInProgress = false;

            console.log('[TorchiCloudSync] Sync completed successfully');
            this.triggerSyncEvent('syncCompleted', { timestamp: this.state.lastSync });

            return { success: true, timestamp: this.state.lastSync };

        } catch (error) {
            console.error('[TorchiCloudSync] Sync error:', error);
            this.state.syncInProgress = false;
            this.triggerSyncEvent('syncError', { error: error.message });
            return { success: false, error: error.message };
        }
    },

    // Export data for sync
    exportForSync() {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            deviceId: this.manifest.deviceId,
            data: {
                members: this.deepClone(members),
                bookings: this.deepClone(bookings),
                smsHistory: this.deepClone(smsHistory),
                emailHistory: this.deepClone(emailHistory),
                activityFeed: this.deepClone(activityFeed)
            },
            checksums: this.calculateChecksums()
        };

        return exportData;
    },

    // Create sync file for iCloud
    createSyncFile(exportData) {
        const syncFile = {
            filename: `torch-atl-sync-${this.manifest.deviceId}.json`,
            content: JSON.stringify(exportData, null, 2),
            metadata: {
                createdBy: this.manifest.deviceId,
                createdAt: new Date().toISOString(),
                fileSize: 0,
                checksum: ''
            }
        };

        // Calculate file size and checksum
        syncFile.metadata.fileSize = new Blob([syncFile.content]).size;
        syncFile.metadata.checksum = this.simpleHash(syncFile.content);

        if (this.config.debugMode) {
            console.log('[TorchiCloudSync] Sync file created:', syncFile.metadata);
        }

        return syncFile;
    },

    // ==================== iCLOUD OPERATIONS (SIMULATED) ====================

    // Simulate checking for remote changes
    async checkRemoteChanges() {
        // In a real implementation, this would:
        // 1. Use iCloud Drive API or CloudKit
        // 2. Check for files from other devices
        // 3. Download and parse remote data

        // For simulation, we'll check localStorage for "remote" data
        const remoteData = this.loadFromStorage('remoteSimulation');

        if (remoteData) {
            console.log('[TorchiCloudSync] Remote data found');
            return remoteData;
        }

        return null;
    },

    // Simulate uploading to iCloud
    async uploadToiCloud(syncFile) {
        // In a real implementation, this would:
        // 1. Write file to iCloud Drive container
        // 2. Use CloudKit to save records
        // 3. Handle iCloud authentication

        // For simulation, we'll save to localStorage and create a downloadable file
        this.saveToStorage('lastSyncFile', syncFile);

        // Create download capability
        this.lastSyncBlob = new Blob([syncFile.content], { type: 'application/json' });

        console.log('[TorchiCloudSync] Data prepared for iCloud sync');
        console.log(`[TorchiCloudSync] File size: ${this.formatBytes(syncFile.metadata.fileSize)}`);

        return true;
    },

    // Download sync file for manual iCloud upload
    downloadSyncFile() {
        const exportData = this.exportForSync();
        const syncFile = this.createSyncFile(exportData);

        const blob = new Blob([syncFile.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = syncFile.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[TorchiCloudSync] Sync file downloaded:', syncFile.filename);

        return syncFile.filename;
    },

    // Import from iCloud file
    async importFromiCloud(fileContent) {
        try {
            const importData = JSON.parse(fileContent);

            // Validate structure
            if (!importData.version || !importData.data) {
                throw new Error('Invalid sync file format');
            }

            // Check for conflicts
            if (this.hasConflicts(importData)) {
                const resolution = await this.resolveConflicts(importData);
                if (!resolution.success) {
                    return resolution;
                }
            }

            // Apply imported data
            this.applyImportedData(importData);

            console.log('[TorchiCloudSync] Import completed successfully');
            this.triggerSyncEvent('importCompleted', { timestamp: new Date().toISOString() });

            return { success: true };

        } catch (error) {
            console.error('[TorchiCloudSync] Import error:', error);
            return { success: false, error: error.message };
        }
    },

    // ==================== CONFLICT RESOLUTION ====================

    // Check if there are conflicts between local and remote data
    hasConflicts(remoteData) {
        if (!remoteData || !remoteData.checksums) {
            return false;
        }

        const localChecksums = this.calculateChecksums();
        const remoteChecksums = remoteData.checksums;

        // If the data came from the same device, no conflict
        if (remoteData.deviceId === this.manifest.deviceId) {
            return false;
        }

        // Check if any data has diverged
        const dataTypes = ['members', 'bookings', 'smsHistory', 'emailHistory', 'activityFeed'];

        for (const type of dataTypes) {
            if (localChecksums[type] !== remoteChecksums[type]) {
                // Check if both have changes since last sync
                const lastSyncChecksum = this.manifest.dataVersions[type]?.checksum;
                if (localChecksums[type] !== lastSyncChecksum &&
                    remoteChecksums[type] !== lastSyncChecksum) {
                    // Both have changes - conflict!
                    this.state.conflicts.push({
                        type: type,
                        localChecksum: localChecksums[type],
                        remoteChecksum: remoteChecksums[type],
                        detectedAt: new Date().toISOString()
                    });
                }
            }
        }

        return this.state.conflicts.length > 0;
    },

    // Resolve conflicts
    async resolveConflicts(remoteData) {
        console.log('[TorchiCloudSync] Resolving conflicts...');

        const resolutions = [];

        for (const conflict of this.state.conflicts) {
            const resolution = await this.resolveConflict(conflict, remoteData);
            resolutions.push(resolution);
        }

        // Clear conflicts after resolution
        this.state.conflicts = [];

        // Check if all resolutions succeeded
        const allResolved = resolutions.every(r => r.resolved);

        if (allResolved) {
            console.log('[TorchiCloudSync] All conflicts resolved');
            return { success: true, resolutions: resolutions };
        } else {
            console.log('[TorchiCloudSync] Some conflicts require manual resolution');
            return {
                success: false,
                reason: 'Manual resolution required',
                unresolvedConflicts: resolutions.filter(r => !r.resolved)
            };
        }
    },

    // Resolve a single conflict
    async resolveConflict(conflict, remoteData) {
        // Resolution strategies:
        // 1. Last-write-wins (default)
        // 2. Merge (for arrays like members, bookings)
        // 3. Manual (prompt user)

        const strategy = this.getResolutionStrategy(conflict.type);

        switch (strategy) {
            case 'merge':
                return this.mergeConflict(conflict.type, remoteData);

            case 'lastWriteWins':
                return this.lastWriteWinsResolution(conflict.type, remoteData);

            case 'manual':
            default:
                return { resolved: false, conflict: conflict, requiresManual: true };
        }
    },

    // Determine resolution strategy based on data type
    getResolutionStrategy(dataType) {
        const strategies = {
            members: 'merge',
            bookings: 'merge',
            smsHistory: 'merge',
            emailHistory: 'merge',
            activityFeed: 'lastWriteWins'
        };

        return strategies[dataType] || 'lastWriteWins';
    },

    // Merge conflict - combine records from both sources
    mergeConflict(dataType, remoteData) {
        console.log(`[TorchiCloudSync] Merging ${dataType}...`);

        let localData, remoteDataArr;

        switch (dataType) {
            case 'members':
                localData = members;
                remoteDataArr = remoteData.data.members;
                members = this.mergeArraysById(localData, remoteDataArr);
                break;

            case 'bookings':
                localData = bookings;
                remoteDataArr = remoteData.data.bookings;
                bookings = this.mergeArraysById(localData, remoteDataArr);
                break;

            case 'smsHistory':
                localData = smsHistory;
                remoteDataArr = remoteData.data.smsHistory;
                smsHistory = this.mergeArraysById(localData, remoteDataArr);
                break;

            case 'emailHistory':
                // Special handling for email history structure
                emailHistory.sent = this.mergeArraysById(emailHistory.sent, remoteData.data.emailHistory.sent);
                emailHistory.scheduled = this.mergeArraysById(emailHistory.scheduled, remoteData.data.emailHistory.scheduled);
                emailHistory.drafts = this.mergeArraysById(emailHistory.drafts, remoteData.data.emailHistory.drafts);
                break;
        }

        // Save merged data
        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveAll();
        }

        return { resolved: true, type: dataType, strategy: 'merge' };
    },

    // Merge two arrays by ID, keeping the most recently updated record
    mergeArraysById(localArray, remoteArray) {
        const merged = new Map();

        // Add local records
        localArray.forEach(item => {
            merged.set(item.id, item);
        });

        // Merge remote records
        remoteArray.forEach(remoteItem => {
            const localItem = merged.get(remoteItem.id);

            if (!localItem) {
                // New item from remote
                merged.set(remoteItem.id, remoteItem);
            } else {
                // Both have the item - keep the most recently updated
                const localUpdated = new Date(localItem.updatedAt || localItem.createdAt || 0);
                const remoteUpdated = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0);

                if (remoteUpdated > localUpdated) {
                    merged.set(remoteItem.id, remoteItem);
                }
            }
        });

        return Array.from(merged.values());
    },

    // Last-write-wins resolution
    lastWriteWinsResolution(dataType, remoteData) {
        const localTime = new Date(this.state.lastSync || 0);
        const remoteTime = new Date(remoteData.exportedAt);

        if (remoteTime > localTime) {
            // Remote is newer - use remote data
            this.applyDataType(dataType, remoteData.data[dataType]);
        }
        // Otherwise keep local data

        return { resolved: true, type: dataType, strategy: 'lastWriteWins' };
    },

    // Apply imported data
    applyImportedData(importData) {
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

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveAll();
        }
    },

    // Apply single data type
    applyDataType(dataType, data) {
        switch (dataType) {
            case 'members':
                members = data;
                break;
            case 'bookings':
                bookings = data;
                break;
            case 'smsHistory':
                smsHistory = data;
                break;
            case 'emailHistory':
                emailHistory = data;
                break;
            case 'activityFeed':
                activityFeed = data;
                break;
        }

        if (typeof TorchStorage !== 'undefined') {
            TorchStorage.saveAll();
        }
    },

    // ==================== MANIFEST MANAGEMENT ====================

    // Load manifest from storage
    loadManifest() {
        const savedManifest = this.loadFromStorage('syncManifest');
        if (savedManifest) {
            this.manifest = { ...this.manifest, ...savedManifest };
        }
    },

    // Save manifest to storage
    saveManifest() {
        this.saveToStorage('syncManifest', this.manifest);
    },

    // Update manifest after sync
    updateManifest() {
        const checksums = this.calculateChecksums();

        this.manifest.lastModified = new Date().toISOString();
        this.manifest.dataVersions = {
            members: { checksum: checksums.members, count: members.length },
            bookings: { checksum: checksums.bookings, count: bookings.length },
            smsHistory: { checksum: checksums.smsHistory, count: smsHistory.length },
            emailHistory: {
                checksum: checksums.emailHistory,
                sent: emailHistory.sent.length,
                scheduled: emailHistory.scheduled.length,
                drafts: emailHistory.drafts.length
            },
            activityFeed: { checksum: checksums.activityFeed, count: activityFeed.length }
        };

        this.saveManifest();
    },

    // Get sync manifest
    getManifest() {
        return {
            ...this.manifest,
            status: {
                isRunning: this.state.isRunning,
                lastSync: this.state.lastSync,
                pendingConflicts: this.state.conflicts.length
            }
        };
    },

    // ==================== UTILITY METHODS ====================

    // Get or create device ID
    getOrCreateDeviceId() {
        let deviceId = this.loadFromStorage('deviceId');

        if (!deviceId) {
            deviceId = 'torch-' + this.generateUUID();
            this.saveToStorage('deviceId', deviceId);
        }

        return deviceId;
    },

    // Generate UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // Calculate checksums for all data
    calculateChecksums() {
        return {
            members: this.simpleHash(JSON.stringify(members)),
            bookings: this.simpleHash(JSON.stringify(bookings)),
            smsHistory: this.simpleHash(JSON.stringify(smsHistory)),
            emailHistory: this.simpleHash(JSON.stringify(emailHistory)),
            activityFeed: this.simpleHash(JSON.stringify(activityFeed))
        };
    },

    // Simple hash function for checksums
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    },

    // Deep clone helper
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Save last sync time
    saveLastSync() {
        this.saveToStorage('lastSync', this.state.lastSync);
    },

    // Load from storage
    loadFromStorage(key) {
        try {
            const data = localStorage.getItem(`torch_icloud_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`[TorchiCloudSync] Error loading ${key}:`, e);
            return null;
        }
    },

    // Save to storage
    saveToStorage(key, data) {
        try {
            localStorage.setItem(`torch_icloud_${key}`, JSON.stringify(data));
        } catch (e) {
            console.error(`[TorchiCloudSync] Error saving ${key}:`, e);
        }
    },

    // Format bytes for display
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Trigger sync event
    triggerSyncEvent(event, data) {
        console.log(`[TorchiCloudSync Event] ${event}:`, data);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('torch-icloud-sync', {
                detail: { event: event, data: data, timestamp: new Date().toISOString() }
            }));
        }
    },

    // Get sync status
    getStatus() {
        return {
            enabled: this.config.syncEnabled,
            isRunning: this.state.isRunning,
            syncInProgress: this.state.syncInProgress,
            lastSync: this.state.lastSync,
            deviceId: this.manifest.deviceId,
            pendingChanges: this.state.pendingChanges.length,
            conflicts: this.state.conflicts.length,
            config: this.config
        };
    },

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };

        // Restart auto-sync if interval changed
        if (newConfig.syncIntervalMinutes && this.state.isRunning) {
            this.stopAutoSync();
            this.startAutoSync();
        }

        console.log('[TorchiCloudSync] Configuration updated:', this.config);
    },

    // Force sync now
    forceSync() {
        return this.sync();
    },

    // Clear all sync data (for reset)
    clearSyncData() {
        const keys = ['deviceId', 'syncManifest', 'lastSync', 'lastSyncFile', 'remoteSimulation'];
        keys.forEach(key => {
            localStorage.removeItem(`torch_icloud_${key}`);
        });

        this.state = {
            isRunning: false,
            lastSync: null,
            syncInProgress: false,
            pendingChanges: [],
            conflicts: []
        };

        this.manifest = {
            version: '1.0',
            deviceId: null,
            lastModified: null,
            dataVersions: {}
        };

        console.log('[TorchiCloudSync] Sync data cleared');
    }
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.TorchiCloudSync = TorchiCloudSync;
}

console.log('[TorchiCloudSync] iCloud sync module loaded');
