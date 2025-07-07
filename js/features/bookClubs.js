// js/features/bookClubs.js
/**
 * Book Club management functionality
 * Updated with user ownership and collaborative joining
 */

import appState from '../core/state.js';
import userManager from '../core/user.js';
import storageManager from '../core/storage.js';
import navigationManager from '../core/navigation.js';
import uiComponents from '../ui/components.js';
import supabaseManager from '../config/supabase.js';

class BookClubManager {
    constructor() {
        this.pendingOperation = null;
    }

    /**
     * Create a new book club
     * @param {string} name - Optional name, will use input field if not provided
     * @returns {Promise<string|null>} Club ID if successful
     */
    async create(name = null) {
        try {
            // Get name from input if not provided
            if (!name) {
                const input = document.getElementById('clubNameInput');
                name = input?.value?.trim();
                
                if (input) input.value = '';
            }

            if (!name) {
                console.warn('No club name provided');
                return null;
            }

            // Create club object with user ownership
            const clubId = this.generateClubId();
            const userId = userManager.getCurrentUserId();
            const clubData = {
                id: clubId,
                name: name,
                books: [],
                currentSelection: null,
                createdAt: new Date().toISOString(),
                userId: userId,
                isOwner: true
            };

            // Add to state
            appState.setBookClub(clubId, clubData);

            // Save to storage
            await storageManager.saveData();

            console.log(`📝 Created book club: ${name} for user: ${userId}`);
            
            if (supabaseManager.isCollaborativeMode()) {
                console.log(`☁️ Club "${name}" saved to cloud for collaboration`);
            }

            return clubId;

        } catch (error) {
            console.error('Error creating book club:', error);
            this.handleError('Failed to create reading group. Please try again.');
            return null;
        }
    }

    /**
     * Delete a book club with confirmation
     * @param {string} clubId 
     */
    delete(clubId) {
        const club = appState.getBookClub(clubId);
        
        if (!club) {
            console.error('Book club not found:', clubId);
            this.handleError('Reading group not found. Please refresh the page.');
            return;
        }

        // Check if user has permission to delete
        if (!userManager.isOwner(club)) {
            this.handleError('You do not have permission to delete this reading group.');
            return;
        }

        const bookCount = club.books.length;
        const confirmMessage = bookCount > 0 
            ? `Are you certain you wish to delete "${club.name}"?\n\nThis will permanently remove ${bookCount} book${bookCount === 1 ? '' : 's'} from this reading group.`
            : `Are you certain you wish to delete "${club.name}"?`;

        // Store pending operation
        this.pendingOperation = {
            type: 'delete',
            clubId: clubId,
            clubName: club.name
        };

        uiComponents.showConfirmation(confirmMessage, () => this.executeDelete(clubId));
    }

    /**
     * Execute the actual deletion after confirmation
     * @param {string} clubId 
     */
    async executeDelete(clubId) {
        try {
            const club = appState.getBookClub(clubId);
            
            if (!club) {
                console.error('Club not found during deletion:', clubId);
                return;
            }

            // Check permission again
            if (!userManager.isOwner(club)) {
                this.handleError('You do not have permission to delete this reading group.');
                return;
            }

            // Delete from cloud storage if in collaborative mode
            if (supabaseManager.isCollaborativeMode()) {
                const success = await storageManager.deleteClubFromSupabase(clubId);
                if (!success) {
                    console.warn('Failed to delete from cloud, but continuing with local deletion');
                }
            }

            // Remove from state
            const deleteSuccess = appState.removeBookClub(clubId);
            
            if (!deleteSuccess) {
                this.handleError('Failed to delete reading group.');
                return;
            }

            // Save to local storage
            storageManager.saveToLocalStorage();

            console.log(`🗑️ Deleted book club: ${club.name}`);

            // Navigate away if we were viewing the deleted club
            if (appState.currentClubId === clubId) {
                navigationManager.showHome();
            }

        } catch (error) {
            console.error('Error deleting book club:', error);
            this.handleError('Failed to delete reading group. Please try again.');
        } finally {
            this.pendingOperation = null;
        }
    }

    /**
     * Join a book club from a shared URL
     * @param {string} clubId 
     * @returns {Promise<boolean>} Success status
     */
    async joinFromUrl(clubId) {
        if (!supabaseManager.isCollaborativeMode()) {
            console.warn('Cannot join club - collaborative mode not enabled');
            return false;
        }

        try {
            console.log(`🔗 Attempting to join club: ${clubId}`);

            // Load club data from Supabase
            const clubData = await storageManager.loadClubFromSupabase(clubId);

            if (!clubData) {
                this.handleError('Could not find this reading group. Please check the link or make sure it still exists.');
                return false;
            }

            const userId = userManager.getCurrentUserId();

            // Check if user is already the owner
            if (clubData.userId === userId) {
                alert(`📚 You're already the owner of "${clubData.name}"`);
                navigationManager.showBookClub(clubId);
                this.cleanUpJoinUrl();
                return true;
            }

            // Add as shared club for this user
            const sharedClubData = {
                ...clubData,
                isOwner: false,
                isShared: true
            };

            appState.setBookClub(clubId, sharedClubData);

            // Save locally
            await storageManager.saveData();

            // Navigate to the club
            navigationManager.showBookClub(clubId);

            // Show success message
            alert(`🎉 Successfully joined "${clubData.name}"! You can now collaborate with other members.`);

            // Clean up URL
            this.cleanUpJoinUrl();

            return true;

        } catch (error) {
            console.error('Error joining club:', error);
            this.handleError('Error joining reading group. Please try again.');
            return false;
        }
    }

    /**
     * Clean up join URL parameters
     */
    cleanUpJoinUrl() {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    /**
     * Get list of all accessible clubs for current user
     * @returns {Array} Array of club objects
     */
    getAll() {
        return Object.values(appState.getBookClubs());
    }

    /**
     * Get list of clubs owned by current user
     * @returns {Array}
     */
    getOwned() {
        return this.getAll().filter(club => userManager.isOwner(club));
    }

    /**
     * Get list of clubs shared with current user
     * @returns {Array}
     */
    getShared() {
        return this.getAll().filter(club => userManager.isSharedWithUser(club));
    }

    /**
     * Get a specific club by ID
     * @param {string} clubId 
     * @returns {Object|null}
     */
    getById(clubId) {
        return appState.getBookClub(clubId);
    }

    /**
     * Update club metadata
     * @param {string} clubId 
     * @param {Object} updates 
     */
    async update(clubId, updates) {
        try {
            const club = appState.getBookClub(clubId);
            if (!club) {
                throw new Error('Club not found');
            }

            // Check permission for modifications
            if (!userManager.isOwner(club) && updates.name) {
                throw new Error('Only owners can modify club details');
            }

            // Merge updates (preserve ownership info)
            const updatedClub = { 
                ...club, 
                ...updates,
                userId: club.userId, // Preserve original owner
                isOwner: club.isOwner,
                isShared: club.isShared
            };
            
            appState.setBookClub(clubId, updatedClub);

            // Save to storage
            await storageManager.saveData();

            console.log(`📝 Updated club: ${club.name}`);

        } catch (error) {
            console.error('Error updating club:', error);
            this.handleError('Failed to update reading group.');
        }
    }

    /**
     * Generate unique club ID
     * @returns {string}
     */
    generateClubId() {
        return `club_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * Generate shareable URL for a club
     * @param {string} clubId 
     * @returns {string|null}
     */
    generateShareUrl(clubId) {
        const club = appState.getBookClub(clubId);
        if (!club || !userManager.isOwner(club)) {
            return null;
        }

        return `${window.location.origin}${window.location.pathname}?join=${clubId}`;
    }

    /**
     * Handle errors with user feedback
     * @param {string} message 
     */
    handleError(message) {
        console.error('BookClub Error:', message);
        alert(`❌ ${message}`);
    }

    /**
     * Get club statistics
     * @param {string} clubId 
     * @returns {Object}
     */
    getStats(clubId) {
        const club = appState.getBookClub(clubId);
        if (!club) return null;

        return {
            name: club.name,
            totalBooks: club.books.length,
            hasSelection: !!club.currentSelection,
            createdDate: new Date(club.createdAt).toLocaleDateString(),
            daysSinceCreation: Math.floor((Date.now() - new Date(club.createdAt)) / (1000 * 60 * 60 * 24)),
            isOwner: userManager.isOwner(club),
            isShared: userManager.isSharedWithUser(club),
            ownerId: club.userId
        };
    }

    /**
     * Get aggregated statistics for current user
     * @returns {Object}
     */
    getUserStats() {
        const allClubs = this.getAll();
        const ownedClubs = this.getOwned();
        const sharedClubs = this.getShared();
        
        const totalBooks = allClubs.reduce((sum, club) => sum + club.books.length, 0);
        const totalSelections = allClubs.filter(club => club.currentSelection).length;

        return {
            totalClubs: allClubs.length,
            ownedClubs: ownedClubs.length,
            sharedClubs: sharedClubs.length,
            totalBooks,
            totalSelections,
            collaborativeMode: supabaseManager.isCollaborativeMode()
        };
    }

    /**
     * Export club data
     * @param {string} clubId 
     * @returns {Object|null}
     */
    export(clubId) {
        const club = appState.getBookClub(clubId);
        if (!club || !userManager.isOwner(club)) return null;

        return {
            ...club,
            exportedAt: new Date().toISOString(),
            exportedBy: userManager.getCurrentUserId(),
            version: '1.1'
        };
    }

    /**
     * Import club data
     * @param {Object} clubData 
     * @returns {Promise<string|null>} Club ID if successful
     */
    async import(clubData) {
        try {
            // Validate imported data
            if (!clubData.name || !Array.isArray(clubData.books)) {
                throw new Error('Invalid club data format');
            }

            // Generate new ID to avoid conflicts
            const clubId = this.generateClubId();
            const userId = userManager.getCurrentUserId();
            
            const importedClub = {
                id: clubId,
                name: `${clubData.name} (Imported)`,
                books: clubData.books,
                currentSelection: null, // Reset selection
                createdAt: new Date().toISOString(),
                userId: userId,
                isOwner: true
            };

            appState.setBookClub(clubId, importedClub);
            await storageManager.saveData();

            console.log(`📥 Imported club: ${importedClub.name}`);
            return clubId;

        } catch (error) {
            console.error('Error importing club:', error);
            this.handleError('Failed to import reading group.');
            return null;
        }
    }

    /**
     * Duplicate an existing club
     * @param {string} sourceClubId 
     * @param {string} newName 
     * @returns {Promise<string|null>}
     */
    async duplicate(sourceClubId, newName = null) {
        try {
            const sourceClub = appState.getBookClub(sourceClubId);
            if (!sourceClub) {
                throw new Error('Source club not found');
            }

            const clubId = this.generateClubId();
            const userId = userManager.getCurrentUserId();
            const name = newName || `${sourceClub.name} (Copy)`;

            const duplicatedClub = {
                id: clubId,
                name: name,
                books: [...sourceClub.books], // Copy books array
                currentSelection: null, // Reset selection
                createdAt: new Date().toISOString(),
                userId: userId,
                isOwner: true
            };

            appState.setBookClub(clubId, duplicatedClub);
            await storageManager.saveData();

            console.log(`📋 Duplicated club: ${name}`);
            return clubId;

        } catch (error) {
            console.error('Error duplicating club:', error);
            this.handleError('Failed to duplicate reading group.');
            return null;
        }
    }
}

// Export singleton instance
const bookClubManager = new BookClubManager();
export default bookClubManager;