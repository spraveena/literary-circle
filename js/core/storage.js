// js/core/storage.js
/**
 * Data persistence layer - handles localStorage and Supabase operations
 * Updated with user-based filtering and enhanced collaborative features
 */

import supabaseManager from '../config/supabase.js';
import appState from './state.js';
import userManager from './user.js';

class StorageManager {
    constructor() {
        this.LOCAL_STORAGE_KEY = 'literaryCircleBookClubs';
    }

    /**
     * Save data to both local storage and Supabase
     * @returns {Promise<void>}
     */
    async saveData() {
        // Always save locally as backup
        this.saveToLocalStorage();
        
        // If collaborative mode is enabled, also save to Supabase
        if (supabaseManager.isCollaborativeMode()) {
            await this.saveToSupabase();
        }
    }

    /**
     * Load data from local storage and Supabase
     * @returns {Promise<void>}
     */
    async loadData() {
        // Always load local data first
        this.loadFromLocalStorage();
        
        // If collaborative mode is enabled, load from Supabase
        if (supabaseManager.isCollaborativeMode()) {
            await this.loadFromSupabase();
        }
    }

    /**
     * Save to local storage
     */
    saveToLocalStorage() {
        try {
            const bookClubs = appState.getAllBookClubs(); // Get all clubs for local backup
            localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(bookClubs));
            console.log('💾 Data saved to local storage');
        } catch (error) {
            console.error('Error saving to local storage:', error);
        }
    }

    /**
     * Load from local storage with user filtering
     */
    loadFromLocalStorage() {
        try {
            const savedClubs = localStorage.getItem(this.LOCAL_STORAGE_KEY);
            if (savedClubs) {
                const allClubs = JSON.parse(savedClubs);
                const userId = userManager.getCurrentUserId();
                
                // Filter to only include user's clubs or shared clubs
                Object.keys(allClubs).forEach(clubId => {
                    const club = allClubs[clubId];
                    if (club.userId === userId || club.isOwner || club.isShared) {
                        appState.setBookClub(clubId, club);
                    }
                });
                
                console.log(`📱 Loaded ${Object.keys(appState.getBookClubs()).length} accessible book clubs from local storage`);
            }
        } catch (error) {
            console.error('Error loading from local storage:', error);
        }
    }

    /**
     * Save user's clubs to Supabase
     * @returns {Promise<void>}
     */
    async saveToSupabase() {
        const supabase = supabaseManager.getClient();
        if (!supabase) return;

        try {
            const bookClubs = appState.getBookClubs(); // Only get accessible clubs
            const userId = userManager.getCurrentUserId();
            
            for (const [clubId, club] of Object.entries(bookClubs)) {
                // Only save clubs that this user owns
                if (userManager.isOwner(club)) {
                    const { error } = await supabase
                        .from('book_clubs')
                        .upsert({
                            id: clubId,
                            name: club.name,
                            books: club.books,
                            current_selection: club.currentSelection,
                            created_at: club.createdAt,
                            updated_at: new Date().toISOString(),
                            user_id: club.userId || userId
                        });

                    if (error) {
                        console.error('Error saving club to Supabase:', error);
                    } else {
                        console.log(`☁️ Saved club "${club.name}" to cloud`);
                    }
                }
            }
        } catch (error) {
            console.error('Supabase save error:', error);
        }
    }

    /**
     * Load user's clubs from Supabase
     * @returns {Promise<void>}
     */
    async loadFromSupabase() {
        const supabase = supabaseManager.getClient();
        if (!supabase) return;

        try {
            const userId = userManager.getCurrentUserId();
            
            // Load clubs that belong to this user OR clubs that have been shared with them
            const { data, error } = await supabase
                .from('book_clubs')
                .select('*')
                .or(`user_id.eq.${userId},shared_users.cs.{${userId}}`);

            if (error) {
                console.error('Error loading from Supabase:', error);
                return;
            }

            if (data) {
                // Process loaded clubs
                data.forEach(club => {
                    const isOwner = club.user_id === userId;
                    const isShared = club.user_id !== userId;
                    
                    appState.setBookClub(club.id, {
                        id: club.id,
                        name: club.name,
                        books: club.books || [],
                        currentSelection: club.current_selection,
                        createdAt: club.created_at,
                        userId: club.user_id,
                        isOwner: isOwner,
                        isShared: isShared
                    });
                });
                
                console.log(`☁️ Loaded ${data.length} book clubs from cloud for user: ${userId}`);
            }
        } catch (error) {
            console.error('Supabase load error:', error);
        }
    }

    /**
     * Save a specific book club to Supabase
     * @param {string} clubId 
     * @returns {Promise<boolean>} Success status
     */
    async saveClubToSupabase(clubId) {
        const supabase = supabaseManager.getClient();
        if (!supabase) return false;

        try {
            const club = appState.getBookClub(clubId);
            if (!club || !userManager.isOwner(club)) {
                console.warn('Cannot save club - not found or not owner');
                return false;
            }

            const { error } = await supabase
                .from('book_clubs')
                .upsert({
                    id: clubId,
                    name: club.name,
                    books: club.books,
                    current_selection: club.currentSelection,
                    created_at: club.createdAt,
                    updated_at: new Date().toISOString(),
                    user_id: club.userId
                });

            if (error) {
                console.error('Error saving club to Supabase:', error);
                return false;
            }

            console.log(`☁️ Saved club "${club.name}" to cloud`);
            return true;
        } catch (error) {
            console.error('Supabase save error:', error);
            return false;
        }
    }

    /**
     * Delete a book club from Supabase
     * @param {string} clubId 
     * @returns {Promise<boolean>} Success status
     */
    async deleteClubFromSupabase(clubId) {
        const supabase = supabaseManager.getClient();
        if (!supabase) return true; // Consider successful if not using Supabase

        try {
            const club = appState.getBookClub(clubId);
            if (!club || !userManager.isOwner(club)) {
                console.warn('Cannot delete club - not found or not owner');
                return false;
            }

            const { error } = await supabase
                .from('book_clubs')
                .delete()
                .eq('id', clubId)
                .eq('user_id', userManager.getCurrentUserId()); // Extra safety check

            if (error) {
                console.error('Error deleting from Supabase:', error);
                return false;
            }

            console.log('☁️ Deleted club from cloud database');
            return true;
        } catch (error) {
            console.error('Supabase delete error:', error);
            return false;
        }
    }

    /**
     * Load a specific book club from Supabase (for joining)
     * @param {string} clubId 
     * @returns {Promise<Object|null>}
     */
    async loadClubFromSupabase(clubId) {
        const supabase = supabaseManager.getClient();
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .from('book_clubs')
                .select('*')
                .eq('id', clubId)
                .single();

            if (error) {
                console.error('Error loading club from Supabase:', error);
                return null;
            }

            if (data) {
                return {
                    id: data.id,
                    name: data.name,
                    books: data.books || [],
                    currentSelection: data.current_selection,
                    createdAt: data.created_at,
                    userId: data.user_id
                };
            }

            return null;
        } catch (error) {
            console.error('Supabase load error:', error);
            return null;
        }
    }

    /**
     * Share a club with another user (placeholder for future implementation)
     * @param {string} clubId 
     * @param {string} targetUserId 
     * @returns {Promise<boolean>}
     */
    async shareClubWithUser(clubId, targetUserId) {
        const supabase = supabaseManager.getClient();
        if (!supabase) return false;

        try {
            const club = appState.getBookClub(clubId);
            if (!club || !userManager.isOwner(club)) {
                return false;
            }

            // This would require a more complex database schema
            // For now, we'll just log the intention
            console.log(`🤝 Would share club ${clubId} with user ${targetUserId}`);
            
            // TODO: Implement actual sharing mechanism
            return true;
        } catch (error) {
            console.error('Error sharing club:', error);
            return false;
        }
    }

    /**
     * Get storage statistics
     * @returns {Object}
     */
    getStorageStats() {
        const localSize = localStorage.getItem(this.LOCAL_STORAGE_KEY)?.length || 0;
        const clubCount = Object.keys(appState.getBookClubs()).length;
        
        return {
            localStorageSize: localSize,
            totalClubs: clubCount,
            collaborativeMode: supabaseManager.isCollaborativeMode(),
            userId: userManager.getCurrentUserId()
        };
    }

    /**
     * Clear all local data (useful for testing or reset)
     */
    clearLocalData() {
        localStorage.removeItem(this.LOCAL_STORAGE_KEY);
        appState.reset();
        console.log('🗑️ Local data cleared');
    }

    /**
     * Export user's data for backup
     * @returns {Object}
     */
    exportUserData() {
        const clubs = appState.getBookClubs();
        const userInfo = userManager.getUserInfo();
        
        return {
            user: userInfo,
            clubs: clubs,
            exportedAt: new Date().toISOString(),
            version: '1.1'
        };
    }

    /**
     * Import user data from backup
     * @param {Object} data 
     * @returns {Promise<boolean>}
     */
    async importUserData(data) {
        try {
            if (!data.clubs || !data.user) {
                throw new Error('Invalid data format');
            }

            // Import user info if needed
            if (data.user.id) {
                userManager.setUserId(data.user.id);
            }

            // Import clubs
            Object.entries(data.clubs).forEach(([clubId, club]) => {
                appState.setBookClub(clubId, {
                    ...club,
                    userId: userManager.getCurrentUserId(), // Assign to current user
                    isOwner: true
                });
            });

            await this.saveData();
            console.log('📥 User data imported successfully');
            return true;
        } catch (error) {
            console.error('Error importing user data:', error);
            return false;
        }
    }
}

// Export singleton instance
const storageManager = new StorageManager();
export default storageManager;