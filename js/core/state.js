// js/core/state.js
/**
 * Global application state management
 * Updated with user ownership and collaborative features
 */

import userManager from './user.js';

class AppState {
    constructor() {
        this.bookClubs = {};
        this.currentClubId = null;
        this.pendingDeleteClubId = null;
        this.realtimeSubscriptions = {};
        this.listeners = new Map();
    }

    /**
     * Get all book clubs accessible to current user
     * @returns {Object}
     */
    getBookClubs() {
        const userId = userManager.getCurrentUserId();
        const accessibleClubs = {};
        
        Object.keys(this.bookClubs).forEach(clubId => {
            const club = this.bookClubs[clubId];
            if (userManager.hasAccess(club)) {
                accessibleClubs[clubId] = club;
            }
        });
        
        return accessibleClubs;
    }

    /**
     * Get all book clubs (including non-accessible ones) - for internal use
     * @returns {Object}
     */
    getAllBookClubs() {
        return this.bookClubs;
    }

    /**
     * Get a specific book club by ID
     * @param {string} clubId 
     * @returns {Object|null}
     */
    getBookClub(clubId) {
        const club = this.bookClubs[clubId];
        if (club && userManager.hasAccess(club)) {
            return club;
        }
        return null;
    }

    /**
     * Get current active book club
     * @returns {Object|null}
     */
    getCurrentClub() {
        return this.currentClubId ? this.getBookClub(this.currentClubId) : null;
    }

    /**
     * Set current active club ID
     * @param {string} clubId 
     */
    setCurrentClubId(clubId) {
        const oldClubId = this.currentClubId;
        this.currentClubId = clubId;
        this.emit('currentClubChanged', { oldClubId, newClubId: clubId });
    }

    /**
     * Add or update a book club with ownership information
     * @param {string} clubId 
     * @param {Object} clubData 
     */
    setBookClub(clubId, clubData) {
        const isNew = !this.bookClubs[clubId];
        const userId = userManager.getCurrentUserId();
        
        // Ensure ownership information is set
        const enhancedClubData = {
            ...clubData,
            userId: clubData.userId || userId,
            isOwner: clubData.userId === userId || clubData.isOwner === true,
            isShared: clubData.userId !== userId && clubData.userId !== undefined
        };
        
        this.bookClubs[clubId] = enhancedClubData;
        
        if (isNew) {
            this.emit('clubAdded', { clubId, club: enhancedClubData });
        } else {
            this.emit('clubUpdated', { clubId, club: enhancedClubData });
        }
    }

    /**
     * Remove a book club
     * @param {string} clubId 
     */
    removeBookClub(clubId) {
        const club = this.bookClubs[clubId];
        if (club) {
            // Check if user has permission to delete
            if (!userManager.isOwner(club)) {
                console.warn('User does not have permission to delete this club');
                return false;
            }
            
            delete this.bookClubs[clubId];
            this.emit('clubRemoved', { clubId, club });
            
            // Clear current club if it was deleted
            if (this.currentClubId === clubId) {
                this.setCurrentClubId(null);
            }
            
            return true;
        }
        return false;
    }

    /**
     * Update entire book clubs object (for bulk operations)
     * @param {Object} newBookClubs 
     */
    setBookClubs(newBookClubs) {
        this.bookClubs = newBookClubs;
        this.emit('clubsUpdated', { clubs: newBookClubs });
    }

    /**
     * Add a book to a specific club
     * @param {string} clubId 
     * @param {string} bookTitle 
     */
    addBookToClub(clubId, bookTitle) {
        const club = this.getBookClub(clubId);
        if (club && !club.books.includes(bookTitle)) {
            club.books.push(bookTitle);
            this.emit('bookAdded', { clubId, book: bookTitle, club });
            return true;
        }
        return false;
    }

    /**
     * Remove a book from a specific club
     * @param {string} clubId 
     * @param {string} bookTitle 
     */
    removeBookFromClub(clubId, bookTitle) {
        const club = this.getBookClub(clubId);
        if (club) {
            club.books = club.books.filter(book => book !== bookTitle);
            this.emit('bookRemoved', { clubId, book: bookTitle, club });
            return true;
        }
        return false;
    }

    /**
     * Remove a book by index from a specific club
     * @param {string} clubId 
     * @param {number} index 
     */
    removeBookByIndex(clubId, index) {
        const club = this.getBookClub(clubId);
        if (club && index >= 0 && index < club.books.length) {
            const removedBook = club.books.splice(index, 1)[0];
            this.emit('bookRemoved', { clubId, book: removedBook, club });
            return removedBook;
        }
        return null;
    }

    /**
     * Clear all books from a club
     * @param {string} clubId 
     */
    clearAllBooks(clubId) {
        const club = this.getBookClub(clubId);
        if (club) {
            const bookCount = club.books.length;
            club.books = [];
            club.currentSelection = null;
            this.emit('allBooksCleared', { clubId, bookCount, club });
            return true;
        }
        return false;
    }

    /**
     * Set club selection
     * @param {string} clubId 
     * @param {string} selection 
     */
    setClubSelection(clubId, selection) {
        const club = this.getBookClub(clubId);
        if (club) {
            club.currentSelection = selection;
            this.emit('selectionChanged', { clubId, selection, club });
            return true;
        }
        return false;
    }

    /**
     * Confirm selection and remove from books
     * @param {string} clubId 
     */
    confirmSelection(clubId) {
        const club = this.getBookClub(clubId);
        if (club && club.currentSelection) {
            const selection = club.currentSelection;
            club.books = club.books.filter(book => book !== selection);
            this.emit('selectionConfirmed', { clubId, selection, club });
            club.currentSelection = null;
            return selection;
        }
        return null;
    }

    /**
     * Set pending delete club ID
     * @param {string} clubId 
     */
    setPendingDeleteClubId(clubId) {
        this.pendingDeleteClubId = clubId;
    }

    /**
     * Get pending delete club ID
     * @returns {string|null}
     */
    getPendingDeleteClubId() {
        return this.pendingDeleteClubId;
    }

    /**
     * Clear pending delete club ID
     */
    clearPendingDeleteClubId() {
        this.pendingDeleteClubId = null;
    }

    /**
     * Manage realtime subscriptions
     * @param {string} clubId 
     * @param {Object} subscription 
     */
    addRealtimeSubscription(clubId, subscription) {
        this.realtimeSubscriptions[clubId] = subscription;
    }

    /**
     * Remove realtime subscription
     * @param {string} clubId 
     */
    removeRealtimeSubscription(clubId) {
        if (this.realtimeSubscriptions[clubId]) {
            this.realtimeSubscriptions[clubId].unsubscribe();
            delete this.realtimeSubscriptions[clubId];
            return true;
        }
        return false;
    }

    /**
     * Get user's club statistics
     * @returns {Object}
     */
    getUserStats() {
        const userId = userManager.getCurrentUserId();
        const accessibleClubs = this.getBookClubs();
        const ownedClubs = Object.values(accessibleClubs).filter(club => userManager.isOwner(club));
        const sharedClubs = Object.values(accessibleClubs).filter(club => userManager.isSharedWithUser(club));
        
        const totalBooks = Object.values(accessibleClubs).reduce((sum, club) => sum + club.books.length, 0);
        
        return {
            userId,
            totalClubs: Object.keys(accessibleClubs).length,
            ownedClubs: ownedClubs.length,
            sharedClubs: sharedClubs.length,
            totalBooks,
            currentClub: this.currentClubId
        };
    }

    /**
     * Event system for state changes
     * @param {string} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event 
     * @param {Function} callback 
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     * @param {string} event 
     * @param {*} data 
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Reset all state (useful for testing)
     */
    reset() {
        this.bookClubs = {};
        this.currentClubId = null;
        this.pendingDeleteClubId = null;
        
        // Unsubscribe from all real-time subscriptions
        Object.keys(this.realtimeSubscriptions).forEach(clubId => {
            this.removeRealtimeSubscription(clubId);
        });
        
        this.listeners.clear();
    }
}

// Export singleton instance
const appState = new AppState();
export default appState;