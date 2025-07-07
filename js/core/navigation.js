// js/core/navigation.js
/**
 * Navigation and view management
 */

import appState from './state.js';
import uiComponents from '../ui/components.js';

class NavigationManager {
    constructor() {
        this.currentView = 'home';
        this.viewHistory = [];
    }

    /**
     * Show home view
     */
    showHome() {
        this.navigateTo('home');
        appState.setCurrentClubId(null);
        uiComponents.showHome();
        
        // Clean up any join URLs
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    /**
     * Show book club view
     * @param {string} clubId 
     */
    showBookClub(clubId) {
        const club = appState.getBookClub(clubId);
        if (!club) {
            console.error('Club not found:', clubId);
            this.showHome();
            return;
        }

        this.navigateTo('bookClub', { clubId });
        appState.setCurrentClubId(clubId);
        uiComponents.showBookClub(clubId);
    }

    /**
     * Navigate to a specific view
     * @param {string} view 
     * @param {Object} params 
     */
    navigateTo(view, params = {}) {
        // Add current view to history
        if (this.currentView !== view) {
            this.viewHistory.push({
                view: this.currentView,
                timestamp: Date.now()
            });
            
            // Limit history size
            if (this.viewHistory.length > 10) {
                this.viewHistory = this.viewHistory.slice(-10);
            }
        }

        this.currentView = view;
        console.log(`🧭 Navigated to: ${view}`, params);
    }

    /**
     * Go back to previous view
     */
    goBack() {
        if (this.viewHistory.length > 0) {
            const previousView = this.viewHistory.pop();
            
            if (previousView.view === 'home') {
                this.showHome();
            } else if (previousView.view === 'bookClub') {
                // For book club view, we'd need to store the club ID
                // For now, just go to home
                this.showHome();
            }
        } else {
            this.showHome();
        }
    }

    /**
     * Get current view
     * @returns {string}
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * Get navigation history
     * @returns {Array}
     */
    getHistory() {
        return [...this.viewHistory];
    }

    /**
     * Clear navigation history
     */
    clearHistory() {
        this.viewHistory = [];
    }
}

// Export singleton instance
const navigationManager = new NavigationManager();
export default navigationManager;