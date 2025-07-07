// js/core/user.js
/**
 * User management and identification for collaborative features
 */

class UserManager {
    constructor() {
        this.currentUserId = null;
        this.USER_ID_KEY = 'literaryCircleUserId';
    }

    /**
     * Generate a unique user ID
     * @returns {string}
     */
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get current user ID, creating one if it doesn't exist
     * @returns {string}
     */
    getCurrentUserId() {
        if (!this.currentUserId) {
            this.currentUserId = localStorage.getItem(this.USER_ID_KEY);
            
            if (!this.currentUserId) {
                this.currentUserId = this.generateUserId();
                localStorage.setItem(this.USER_ID_KEY, this.currentUserId);
                console.log('🆔 Generated new user ID:', this.currentUserId);
            } else {
                console.log('🆔 Loaded existing user ID:', this.currentUserId);
            }
        }
        
        return this.currentUserId;
    }

    /**
     * Set a specific user ID (useful for testing or manual assignment)
     * @param {string} userId 
     */
    setUserId(userId) {
        this.currentUserId = userId;
        localStorage.setItem(this.USER_ID_KEY, userId);
        console.log('🆔 Set user ID:', userId);
    }

    /**
     * Clear current user ID and generate a new one
     * @returns {string} New user ID
     */
    resetUserId() {
        localStorage.removeItem(this.USER_ID_KEY);
        this.currentUserId = null;
        return this.getCurrentUserId();
    }

    /**
     * Check if a club belongs to the current user
     * @param {Object} club 
     * @returns {boolean}
     */
    isOwner(club) {
        return club.userId === this.getCurrentUserId() || club.isOwner === true;
    }

    /**
     * Check if a club is shared with the current user
     * @param {Object} club 
     * @returns {boolean}
     */
    isSharedWithUser(club) {
        return club.isShared === true || 
               (club.userId !== this.getCurrentUserId() && club.userId);
    }

    /**
     * Check if user has access to a club (owner or shared)
     * @param {Object} club 
     * @returns {boolean}
     */
    hasAccess(club) {
        return this.isOwner(club) || this.isSharedWithUser(club);
    }

    /**
     * Get user information object
     * @returns {Object}
     */
    getUserInfo() {
        return {
            id: this.getCurrentUserId(),
            createdAt: this.getCreationDate(),
            isAnonymous: true // Always anonymous for privacy
        };
    }

    /**
     * Get approximate creation date of user ID (for display purposes)
     * @returns {Date|null}
     */
    getCreationDate() {
        const userId = this.getCurrentUserId();
        if (userId && userId.startsWith('user_')) {
            try {
                const timestamp = userId.split('_')[1];
                return new Date(parseInt(timestamp));
            } catch (error) {
                console.warn('Could not parse user creation date');
            }
        }
        return null;
    }

    /**
     * Export user data for backup/transfer
     * @returns {Object}
     */
    exportUserData() {
        return {
            userId: this.getCurrentUserId(),
            createdAt: this.getCreationDate()?.toISOString(),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import user data from backup
     * @param {Object} userData 
     * @returns {boolean} Success status
     */
    importUserData(userData) {
        try {
            if (userData.userId) {
                this.setUserId(userData.userId);
                console.log('📥 Imported user data successfully');
                return true;
            }
        } catch (error) {
            console.error('Failed to import user data:', error);
        }
        return false;
    }
}

// Export singleton instance
const userManager = new UserManager();
export default userManager;