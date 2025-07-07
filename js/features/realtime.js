// js/features/realtime.js
/**
 * Real-time collaboration manager using Supabase
 * Handles live synchronization between multiple users
 */

import supabaseManager from '../config/supabase.js';
import appState from '../core/state.js';
import userManager from '../core/user.js';
import storageManager from '../core/storage.js';
import uiComponents from '../ui/components.js';

class RealtimeManager {
    constructor() {
        this.subscriptions = new Map();
        this.presenceChannels = new Map();
        this.connectionState = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.lastUpdate = new Map();
        this.conflictResolutionEnabled = true;
        this.debugMode = false;
    }

    /**
     * Initialize real-time system
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (!supabaseManager.isCollaborativeMode()) {
            this.log('Real-time not available - Supabase not configured');
            return false;
        }

        try {
            await this.setupConnectionMonitoring();
            this.setupGlobalErrorHandling();
            this.log('✅ Real-time system initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize real-time system:', error);
            return false;
        }
    }

    /**
     * Subscribe to real-time updates for a book club
     * @param {string} clubId 
     * @returns {Promise<boolean>} Success status
     */
    async subscribeToBookClub(clubId) {
        if (!supabaseManager.isCollaborativeMode()) {
            this.log('Cannot subscribe - real-time not available');
            return false;
        }

        if (this.subscriptions.has(clubId)) {
            this.log(`Already subscribed to club: ${clubId}`);
            return true;
        }

        try {
            const supabase = supabaseManager.getClient();
            
            // Create channel for book club updates
            const channel = supabase
                .channel(`book-club-${clubId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'book_clubs',
                    filter: `id=eq.${clubId}`
                }, (payload) => this.handleBookClubUpdate(payload))
                .subscribe((status) => {
                    this.handleSubscriptionStatus(clubId, status);
                });

            this.subscriptions.set(clubId, {
                channel,
                clubId,
                subscribedAt: new Date(),
                status: 'connecting'
            });

            // Set up presence tracking
            await this.setupPresenceTracking(clubId);

            this.log(`🔄 Subscribed to real-time updates for club: ${clubId}`);
            return true;

        } catch (error) {
            console.error('Error subscribing to book club:', error);
            this.handleSubscriptionError(clubId, error);
            return false;
        }
    }

    /**
     * Unsubscribe from a book club
     * @param {string} clubId 
     * @returns {boolean} Success status
     */
    unsubscribeFromBookClub(clubId) {
        const subscription = this.subscriptions.get(clubId);
        
        if (!subscription) {
            this.log(`No subscription found for club: ${clubId}`);
            return false;
        }

        try {
            // Unsubscribe from channel
            subscription.channel.unsubscribe();
            this.subscriptions.delete(clubId);

            // Clean up presence tracking
            this.cleanupPresenceTracking(clubId);

            this.log(`✋ Unsubscribed from club: ${clubId}`);
            return true;

        } catch (error) {
            console.error('Error unsubscribing from book club:', error);
            return false;
        }
    }

    /**
     * Set up presence tracking for a club
     * @param {string} clubId 
     */
    async setupPresenceTracking(clubId) {
        if (!supabaseManager.isCollaborativeMode()) return;

        try {
            const supabase = supabaseManager.getClient();
            const userId = userManager.getCurrentUserId();
            
            const presenceChannel = supabase
                .channel(`presence-${clubId}`)
                .on('presence', { event: 'sync' }, () => {
                    this.handlePresenceSync(clubId, presenceChannel);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    this.handlePresenceJoin(clubId, key, newPresences);
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    this.handlePresenceLeave(clubId, key, leftPresences);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        // Track this user's presence
                        await presenceChannel.track({
                            user_id: userId,
                            online_at: new Date().toISOString(),
                            club_id: clubId
                        });
                    }
                });

            this.presenceChannels.set(clubId, presenceChannel);
            this.log(`👥 Presence tracking enabled for club: ${clubId}`);

        } catch (error) {
            console.error('Error setting up presence tracking:', error);
        }
    }

    /**
     * Clean up presence tracking
     * @param {string} clubId 
     */
    cleanupPresenceTracking(clubId) {
        const presenceChannel = this.presenceChannels.get(clubId);
        
        if (presenceChannel) {
            presenceChannel.unsubscribe();
            this.presenceChannels.delete(clubId);
            this.log(`👥 Presence tracking cleaned up for club: ${clubId}`);
        }
    }

    /**
     * Handle book club update from real-time subscription
     * @param {Object} payload 
     */
    async handleBookClubUpdate(payload) {
        this.log('📡 Real-time update received:', payload);

        try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const userId = userManager.getCurrentUserId();

            // Ignore updates from this user to prevent loops
            if (newRecord && newRecord.user_id === userId) {
                this.log('Ignoring own update to prevent loop');
                return;
            }

            // Check for conflicts
            if (this.conflictResolutionEnabled) {
                const conflict = await this.detectConflict(payload);
                if (conflict) {
                    await this.resolveConflict(conflict);
                    return;
                }
            }

            switch (eventType) {
                case 'INSERT':
                case 'UPDATE':
                    await this.handleClubInsertOrUpdate(newRecord);
                    break;
                case 'DELETE':
                    await this.handleClubDelete(oldRecord);
                    break;
                default:
                    this.log(`Unknown event type: ${eventType}`);
            }

            // Update last sync time
            this.lastUpdate.set(newRecord?.id || oldRecord?.id, new Date());

        } catch (error) {
            console.error('Error handling real-time update:', error);
            this.handleUpdateError(error, payload);
        }
    }

    /**
     * Handle club insert or update
     * @param {Object} updatedClub 
     */
    async handleClubInsertOrUpdate(updatedClub) {
        const userId = userManager.getCurrentUserId();
        const currentClub = appState.getBookClub(updatedClub.id);

        // Determine if user has access to this club
        const hasAccess = updatedClub.user_id === userId || 
                         (updatedClub.shared_users && updatedClub.shared_users.includes(userId));

        if (!hasAccess) {
            this.log(`User ${userId} doesn't have access to club ${updatedClub.id}`);
            return;
        }

        // Create club data with ownership information
        const clubData = {
            id: updatedClub.id,
            name: updatedClub.name,
            books: updatedClub.books || [],
            currentSelection: updatedClub.current_selection,
            createdAt: updatedClub.created_at,
            userId: updatedClub.user_id,
            isOwner: updatedClub.user_id === userId,
            isShared: updatedClub.user_id !== userId
        };

        // Update state
        appState.setBookClub(updatedClub.id, clubData);

        // Update UI if we're currently viewing this club
        if (appState.currentClubId === updatedClub.id) {
            uiComponents.updateBookClubView();
            this.showRealtimeNotification('📚 Club updated by another member');
        } else {
            uiComponents.updateBookClubsList();
        }

        // Save locally as backup
        storageManager.saveToLocalStorage();

        this.log(`✅ Updated club: ${updatedClub.name}`);
    }

    /**
     * Handle club deletion
     * @param {Object} deletedClub 
     */
    async handleClubDelete(deletedClub) {
        const clubId = deletedClub.id;
        const club = appState.getBookClub(clubId);

        if (!club) {
            this.log(`Club ${clubId} not found in local state`);
            return;
        }

        // Remove from state
        appState.removeBookClub(clubId);

        // Update UI
        uiComponents.updateBookClubsList();

        // If we were viewing this club, go home
        if (appState.currentClubId === clubId) {
            this.showRealtimeNotification('📚 This club was deleted by its owner');
            setTimeout(() => {
                window.showHome();
            }, 2000);
        }

        // Save locally
        storageManager.saveToLocalStorage();

        this.log(`🗑️ Deleted club: ${deletedClub.name}`);
    }

    /**
     * Detect conflicts between local and remote changes
     * @param {Object} payload 
     * @returns {Object|null} Conflict details or null
     */
    async detectConflict(payload) {
        const { new: remoteRecord } = payload;
        const localClub = appState.getBookClub(remoteRecord.id);

        if (!localClub) return null;

        const remoteUpdatedAt = new Date(remoteRecord.updated_at);
        const lastLocalUpdate = this.lastUpdate.get(remoteRecord.id);

        // Check if local changes happened after the last known sync
        if (lastLocalUpdate && remoteUpdatedAt < lastLocalUpdate) {
            return {
                type: 'concurrent_modification',
                localClub,
                remoteRecord,
                conflictTime: new Date()
            };
        }

        // Check for book list conflicts
        const localBooks = new Set(localClub.books);
        const remoteBooks = new Set(remoteRecord.books || []);
        
        const localOnly = [...localBooks].filter(book => !remoteBooks.has(book));
        const remoteOnly = [...remoteBooks].filter(book => !localBooks.has(book));

        if (localOnly.length > 0 && remoteOnly.length > 0) {
            return {
                type: 'book_list_conflict',
                localClub,
                remoteRecord,
                localOnly,
                remoteOnly,
                conflictTime: new Date()
            };
        }

        return null;
    }

    /**
     * Resolve conflicts between local and remote data
     * @param {Object} conflict 
     */
    async resolveConflict(conflict) {
        this.log('⚠️ Resolving conflict:', conflict);

        switch (conflict.type) {
            case 'concurrent_modification':
                await this.resolveConcurrentModification(conflict);
                break;
            case 'book_list_conflict':
                await this.resolveBookListConflict(conflict);
                break;
            default:
                this.log(`Unknown conflict type: ${conflict.type}`);
        }
    }

    /**
     * Resolve concurrent modification conflicts
     * @param {Object} conflict 
     */
    async resolveConcurrentModification(conflict) {
        // Simple strategy: merge changes and notify user
        const { localClub, remoteRecord } = conflict;
        
        // Merge book lists (union of both)
        const mergedBooks = [...new Set([...localClub.books, ...(remoteRecord.books || [])])];
        
        // Use remote metadata but merged books
        const mergedClub = {
            ...localClub,
            name: remoteRecord.name,
            books: mergedBooks,
            currentSelection: remoteRecord.current_selection || localClub.currentSelection
        };

        appState.setBookClub(localClub.id, mergedClub);
        
        this.showRealtimeNotification('🔄 Changes merged with another user\'s updates');
        
        // Save the merged version
        await storageManager.saveData();
    }

    /**
     * Resolve book list conflicts
     * @param {Object} conflict 
     */
    async resolveBookListConflict(conflict) {
        const { localClub, remoteRecord, localOnly, remoteOnly } = conflict;
        
        // Merge all books together
        const mergedBooks = [...new Set([...localClub.books, ...(remoteRecord.books || [])])];
        
        const mergedClub = {
            ...localClub,
            books: mergedBooks
        };

        appState.setBookClub(localClub.id, mergedClub);
        
        const addedCount = localOnly.length + remoteOnly.length;
        this.showRealtimeNotification(`📚 ${addedCount} books merged from collaborative changes`);
        
        await storageManager.saveData();
    }

    /**
     * Handle presence sync events
     * @param {string} clubId 
     * @param {Object} channel 
     */
    handlePresenceSync(clubId, channel) {
        const state = channel.presenceState();
        const users = Object.keys(state);
        
        this.log(`👥 ${users.length} users present in club ${clubId}`);
        this.updatePresenceIndicator(clubId, users.length);
    }

    /**
     * Handle user joining presence
     * @param {string} clubId 
     * @param {string} key 
     * @param {Array} newPresences 
     */
    handlePresenceJoin(clubId, key, newPresences) {
        newPresences.forEach(presence => {
            const userId = presence.user_id;
            this.log(`👋 User ${userId} joined club ${clubId}`);
            
            if (userId !== userManager.getCurrentUserId()) {
                this.showRealtimeNotification('👋 Another member joined');
            }
        });
    }

    /**
     * Handle user leaving presence
     * @param {string} clubId 
     * @param {string} key 
     * @param {Array} leftPresences 
     */
    handlePresenceLeave(clubId, key, leftPresences) {
        leftPresences.forEach(presence => {
            const userId = presence.user_id;
            this.log(`👋 User ${userId} left club ${clubId}`);
        });
    }

    /**
     * Update presence indicator in UI
     * @param {string} clubId 
     * @param {number} userCount 
     */
    updatePresenceIndicator(clubId, userCount) {
        // Add presence indicator to current club view
        if (appState.currentClubId === clubId && userCount > 1) {
            const header = document.querySelector('.current-club');
            if (header && !header.querySelector('.presence-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'presence-indicator';
                indicator.innerHTML = ` <span class="status-indicator online"></span>${userCount} online`;
                header.appendChild(indicator);
            }
        }
    }

    /**
     * Handle subscription status changes
     * @param {string} clubId 
     * @param {string} status 
     */
    handleSubscriptionStatus(clubId, status) {
        const subscription = this.subscriptions.get(clubId);
        if (subscription) {
            subscription.status = status;
        }

        switch (status) {
            case 'SUBSCRIBED':
                this.connectionState = 'connected';
                this.reconnectAttempts = 0;
                this.log(`✅ Successfully subscribed to club ${clubId}`);
                this.showConnectionStatus('connected');
                break;
            case 'CHANNEL_ERROR':
                this.connectionState = 'error';
                this.log(`❌ Channel error for club ${clubId}`);
                this.handleSubscriptionError(clubId, new Error('Channel error'));
                break;
            case 'TIMED_OUT':
                this.connectionState = 'timeout';
                this.log(`⏰ Subscription timed out for club ${clubId}`);
                this.attemptReconnect(clubId);
                break;
            case 'CLOSED':
                this.connectionState = 'disconnected';
                this.log(`🔌 Connection closed for club ${clubId}`);
                break;
        }
    }

    /**
     * Handle subscription errors
     * @param {string} clubId 
     * @param {Error} error 
     */
    handleSubscriptionError(clubId, error) {
        console.error(`Subscription error for club ${clubId}:`, error);
        
        // Remove failed subscription
        this.subscriptions.delete(clubId);
        
        // Show error to user
        this.showRealtimeNotification('⚠️ Real-time sync temporarily unavailable');
        
        // Attempt reconnection
        this.attemptReconnect(clubId);
    }

    /**
     * Attempt to reconnect to a club
     * @param {string} clubId 
     */
    async attemptReconnect(clubId) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.log(`Max reconnection attempts reached for club ${clubId}`);
            this.showRealtimeNotification('❌ Unable to reconnect to real-time sync');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        this.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(async () => {
            try {
                await this.subscribeToBookClub(clubId);
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.attemptReconnect(clubId);
            }
        }, delay);
    }

    /**
     * Set up connection monitoring
     */
    async setupConnectionMonitoring() {
        // Monitor browser online/offline status
        window.addEventListener('online', () => {
            this.log('Browser came online');
            this.handleConnectionRestored();
        });

        window.addEventListener('offline', () => {
            this.log('Browser went offline');
            this.handleConnectionLost();
        });

        // Set up heartbeat to detect connection issues
        this.startHeartbeat();
    }

    /**
     * Start heartbeat monitoring
     */
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            this.checkConnectionHealth();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check connection health
     */
    async checkConnectionHealth() {
        if (!supabaseManager.isCollaborativeMode()) return;

        try {
            const supabase = supabaseManager.getClient();
            
            // Simple health check - try to query the database
            const { error } = await supabase
                .from('book_clubs')
                .select('id')
                .limit(1);

            if (error) {
                this.handleConnectionIssue(error);
            } else {
                this.handleConnectionHealthy();
            }
        } catch (error) {
            this.handleConnectionIssue(error);
        }
    }

    /**
     * Handle connection issues
     * @param {Error} error 
     */
    handleConnectionIssue(error) {
        this.log('Connection health check failed:', error);
        this.connectionState = 'unhealthy';
        this.showConnectionStatus('disconnected');
    }

    /**
     * Handle healthy connection
     */
    handleConnectionHealthy() {
        if (this.connectionState !== 'connected') {
            this.connectionState = 'connected';
            this.showConnectionStatus('connected');
        }
    }

    /**
     * Handle connection restored
     */
    async handleConnectionRestored() {
        this.showRealtimeNotification('🔄 Connection restored - syncing...');
        
        // Resubscribe to all active clubs
        const activeClubs = Array.from(this.subscriptions.keys());
        
        for (const clubId of activeClubs) {
            await this.subscribeToBookClub(clubId);
        }
        
        // Force data sync
        await storageManager.loadData();
        uiComponents.updateBookClubsList();
        uiComponents.updateBookClubView();
    }

    /**
     * Handle connection lost
     */
    handleConnectionLost() {
        this.connectionState = 'offline';
        this.showConnectionStatus('offline');
        this.showRealtimeNotification('📱 Working offline - changes will sync when reconnected');
    }

    /**
     * Set up global error handling
     */
    setupGlobalErrorHandling() {
        // Handle unhandled promise rejections in real-time operations
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message && event.reason.message.includes('supabase')) {
                console.error('Unhandled Supabase error:', event.reason);
                this.handleUpdateError(event.reason);
                event.preventDefault();
            }
        });
    }

    /**
     * Handle update errors
     * @param {Error} error 
     * @param {Object} payload 
     */
    handleUpdateError(error, payload = null) {
        console.error('Real-time update error:', error, payload);
        
        // Show user-friendly error message
        this.showRealtimeNotification('⚠️ Sync error - your changes are saved locally');
        
        // Attempt to recover by reloading data
        setTimeout(async () => {
            try {
                await storageManager.loadData();
                uiComponents.updateBookClubView();
            } catch (recoveryError) {
                console.error('Recovery failed:', recoveryError);
            }
        }, 5000);
    }

    /**
     * Show real-time notification to user
     * @param {string} message 
     */
    showRealtimeNotification(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'realtime-notification';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-primary);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 1000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    /**
     * Show connection status indicator
     * @param {string} status 
     */
    showConnectionStatus(status) {
        let indicator = document.querySelector('.connection-status');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'connection-status';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(indicator);
        }

        const statusConfig = {
            connected: { text: 'Connected', color: '#22c55e', dot: '🟢' },
            disconnected: { text: 'Disconnected', color: '#ef4444', dot: '🔴' },
            offline: { text: 'Offline', color: '#f59e0b', dot: '🟡' }
        };

        const config = statusConfig[status] || statusConfig.disconnected;
        
        indicator.innerHTML = `${config.dot} ${config.text}`;
        indicator.style.background = config.color;
        indicator.style.color = 'white';

        // Auto-hide after a delay for connected status
        if (status === 'connected') {
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.style.opacity = '0';
                    setTimeout(() => {
                        if (indicator.parentNode) {
                            indicator.parentNode.removeChild(indicator);
                        }
                    }, 300);
                }
            }, 3000);
        }
    }

    /**
     * Get real-time statistics
     * @returns {Object}
     */
    getStats() {
        return {
            activeSubscriptions: this.subscriptions.size,
            connectionState: this.connectionState,
            reconnectAttempts: this.reconnectAttempts,
            presenceChannels: this.presenceChannels.size,
            lastUpdates: Object.fromEntries(this.lastUpdate)
        };
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled 
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Log debug messages
     * @param {...any} args 
     */
    log(...args) {
        if (this.debugMode) {
            console.log('[RealtimeManager]', ...args);
        }
    }

    /**
     * Clean up all subscriptions
     */
    cleanup() {
        // Unsubscribe from all clubs
        for (const clubId of this.subscriptions.keys()) {
            this.unsubscribeFromBookClub(clubId);
        }

        // Clear presence channels
        for (const clubId of this.presenceChannels.keys()) {
            this.cleanupPresenceTracking(clubId);
        }

        // Clear heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // Reset state
        this.connectionState = 'disconnected';
        this.reconnectAttempts = 0;
        this.lastUpdate.clear();

        this.log('🧹 Real-time manager cleaned up');
    }
}

// Export singleton instance
const realtimeManager = new RealtimeManager();
export default realtimeManager;