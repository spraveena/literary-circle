// js/main.js
/**
 * Main application entry point
 * Updated with user management and enhanced collaborative features
 */

import supabaseManager from './config/supabase.js';
import appState from './core/state.js';
import userManager from './core/user.js';
import storageManager from './core/storage.js';
import navigationManager from './core/navigation.js';
import bookClubManager from './features/bookClubs.js';
import bookManager from './features/books.js';
import recommendationManager from './features/recommendations.js';
import realtimeManager from './features/realtime.js';
import uiComponents from './ui/components.js';

class LiteraryCircleApp {
    constructor() {
        this.isInitialized = false;
        this.version = '1.1.0';
    }

    /**
     * Initialize the entire application
     */
    async init() {
        try {
            console.log(`🚀 Initializing Literary Circle v${this.version}...`);

            // Initialize user management first
            await this.initializeUser();

            // Initialize core systems
            await this.initializeCore();

            // Set up event listeners
            this.setupEventListeners();

            // Initialize UI
            this.initializeUI();

            // Handle special URL parameters (join links)
            await this.handleSpecialUrls();

            // Show initial view
            navigationManager.showHome();

            this.isInitialized = true;
            console.log('✅ Literary Circle initialized successfully');

            // Show user stats in console for debugging
            this.logUserStats();

        } catch (error) {
            console.error('❌ Failed to initialize Literary Circle:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize user management system
     */
    async initializeUser() {
        // Get or create user ID
        const userId = userManager.getCurrentUserId();
        console.log(`👤 Current user: ${userId}`);
        
        // Log user creation date if available
        const creationDate = userManager.getCreationDate();
        if (creationDate) {
            console.log(`📅 User created: ${creationDate.toLocaleDateString()}`);
        }
    }

    /**
     * Initialize core application systems
     */
    async initializeCore() {
        // Initialize Supabase (optional)
        const supabaseEnabled = supabaseManager.initialize();
        
        // Load data from storage
        await storageManager.loadData();
        
        // Update collaboration status in UI
        uiComponents.updateCollaborationStatus();
        
        console.log('🔧 Core systems initialized');
        
        if (supabaseEnabled) {
            console.log('☁️ Collaborative features enabled');
        } else {
            console.log('📱 Running in local mode');
        }
    }

    /**
     * Set up application-wide event listeners
     */
    setupEventListeners() {
        // State change listeners
        appState.on('clubAdded', (data) => {
            uiComponents.updateBookClubsList();
            console.log(`📚 Club added: ${data.club.name} by user: ${data.club.userId}`);
        });

        appState.on('clubRemoved', (data) => {
            uiComponents.updateBookClubsList();
            console.log(`🗑️ Club removed: ${data.club.name}`);
        });

        appState.on('clubUpdated', (data) => {
            uiComponents.updateBookClubView();
            console.log(`📝 Club updated: ${data.club.name}`);
        });

        appState.on('currentClubChanged', (data) => {
            this.handleCurrentClubChange(data);
        });

        appState.on('bookAdded', (data) => {
            uiComponents.updateBookClubView();
            storageManager.saveData();
            console.log(`📖 Book added: "${data.book}" to ${data.club.name}`);
        });

        appState.on('bookRemoved', (data) => {
            uiComponents.updateBookClubView();
            storageManager.saveData();
            console.log(`📚 Book removed: "${data.book}" from ${data.club.name}`);
        });

        appState.on('allBooksCleared', (data) => {
            uiComponents.updateBookClubView();
            uiComponents.clearBookSelection();
            uiComponents.resetRecommendations();
            storageManager.saveData();
            console.log(`🧹 Cleared ${data.bookCount} books from ${data.club.name}`);
        });

        appState.on('selectionChanged', (data) => {
            uiComponents.showBookSelection(data.selection, false);
            console.log(`🎲 Selected: "${data.selection}" in ${data.club.name}`);
        });

        appState.on('selectionConfirmed', (data) => {
            uiComponents.showBookSelection(data.selection, true);
            uiComponents.updateBookClubView();
            storageManager.saveData();
            console.log(`✅ Confirmed selection: "${data.selection}" in ${data.club.name}`);
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));

        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

        console.log('👂 Event listeners set up');
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Set up DOM element references
        uiComponents.initializeElements();
        
        // Attach event handlers to DOM elements
        this.attachDOMEventHandlers();
        
        console.log('🎨 UI initialized');
    }

    /**
     * Attach event handlers to DOM elements
     */
    attachDOMEventHandlers() {
        // Book club creation
        const clubNameInput = document.getElementById('clubNameInput');
        const bookInput = document.getElementById('bookInput');

        if (clubNameInput) {
            clubNameInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.createBookClub();
                }
            });
        }

        if (bookInput) {
            bookInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.addBook();
                }
            });
        }

        // Make functions available globally for onclick handlers
        this.setupGlobalFunctions();
    }

    /**
     * Set up global functions for onclick handlers
     */
    setupGlobalFunctions() {
        window.showHome = () => navigationManager.showHome();
        window.showBookClub = (clubId) => navigationManager.showBookClub(clubId);
        window.createBookClub = () => this.createBookClub();
        window.handleDeleteClub = (clubId) => this.handleDeleteClub(clubId);
        window.addBook = () => this.addBook();
        window.removeBookByIndex = (index) => this.removeBookByIndex(index);
        window.clearAllBooks = () => this.clearAllBooks();
        window.selectRandomBook = () => this.selectRandomBook();
        window.regenerateSelection = () => this.regenerateSelection();
        window.confirmSelection = () => this.confirmSelection();
        window.getRecommendations = () => this.getRecommendations();
        window.handleClubNameKeyPress = (event) => this.handleClubNameKeyPress(event);
        window.handleKeyPress = (event) => this.handleKeyPress(event);
    }

    /**
     * Handle current club change
     */
    handleCurrentClubChange(data) {
        const { oldClubId, newClubId } = data;

        // Unsubscribe from old club's real-time updates
        if (oldClubId && supabaseManager.isCollaborativeMode()) {
            realtimeManager.unsubscribeFromBookClub(oldClubId);
        }

        // Subscribe to new club's real-time updates
        if (newClubId && supabaseManager.isCollaborativeMode()) {
            realtimeManager.subscribeToBookClub(newClubId);
        }

        // Update UI
        if (newClubId) {
            uiComponents.showBookClub(newClubId);
        } else {
            uiComponents.showHome();
        }
    }

    /**
     * Handle special URLs (like join links)
     */
    async handleSpecialUrls() {
        const urlParams = new URLSearchParams(window.location.search);
        const joinClubId = urlParams.get('join');

        if (joinClubId && supabaseManager.isCollaborativeMode()) {
            await bookClubManager.joinFromUrl(joinClubId);
        }
    }

    /**
     * Handle global keyboard shortcuts
     */
    handleGlobalKeydown(event) {
        // Escape key handling
        if (event.key === 'Escape') {
            // Close any open dialogs
            const overlay = document.getElementById('confirmationOverlay');
            if (overlay && overlay.style.display === 'flex') {
                uiComponents.hideConfirmation();
            }
        }

        // Ctrl/Cmd + H for home
        if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
            event.preventDefault();
            navigationManager.showHome();
        }

        // Ctrl/Cmd + N for new club
        if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
            event.preventDefault();
            const input = document.getElementById('clubNameInput');
            if (input) {
                input.focus();
            }
        }
    }

    /**
     * Handle before page unload
     */
    handleBeforeUnload(event) {
        // Save any pending changes
        storageManager.saveToLocalStorage();
    }

    /**
     * Club management functions
     */
    async createBookClub() {
        const clubId = await bookClubManager.create();
        if (clubId) {
            uiComponents.clearInputs();
        }
    }

    handleDeleteClub(clubId) {
        bookClubManager.delete(clubId);
    }

    /**
     * Book management functions
     */
    async addBook() {
        const club = appState.getCurrentClub();
        const input = document.getElementById('bookInput');
        const title = input?.value?.trim();
        
        if (title && club && !club.books.includes(title)) {
            const success = appState.addBookToClub(club.id, title);
            if (success && input) {
                input.value = '';
            }
        }
    }

    removeBookByIndex(index) {
        const club = appState.getCurrentClub();
        if (club) {
            appState.removeBookByIndex(club.id, index);
        }
    }

    clearAllBooks() {
        const club = appState.getCurrentClub();
        if (club && confirm('Clear all books from the collection?')) {
            appState.clearAllBooks(club.id);
        }
    }

    /**
     * Selection functions
     */
    selectRandomBook() {
        const club = appState.getCurrentClub();
        if (!club || club.books.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * club.books.length);
        const selection = club.books[randomIndex];
        appState.setClubSelection(club.id, selection);
    }

    regenerateSelection() {
        this.selectRandomBook();
    }

    confirmSelection() {
        const club = appState.getCurrentClub();
        if (club) {
            appState.confirmSelection(club.id);
        }
    }

    /**
     * Recommendation functions
     */
    async getRecommendations() {
        const club = appState.getCurrentClub();
        if (!club || club.books.length === 0) return;
        
        uiComponents.showRecommendationsLoading();
        
        try {
            const recommendations = await recommendationManager.generate(club.books);
            uiComponents.showRecommendations(recommendations);
        } catch (error) {
            console.error('Error generating recommendations:', error);
            uiComponents.showRecommendationsError();
        }
    }

    /**
     * Input handlers
     */
    handleClubNameKeyPress(event) {
        if (event.key === 'Enter') {
            this.createBookClub();
        }
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.addBook();
        }
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #8b4513;">
                    <h2>⚠️ Initialization Error</h2>
                    <p>Sorry, there was a problem starting the application.</p>
                    <p style="font-size: 14px; margin-top: 20px;">
                        <button onclick="window.location.reload()" style="padding: 10px 20px; cursor: pointer;">
                            Reload Page
                        </button>
                    </p>
                    <details style="margin-top: 20px; text-align: left; max-width: 500px; margin: 20px auto;">
                        <summary style="cursor: pointer;">Technical Details</summary>
                        <pre style="background: #f5f5f5; padding: 10px; margin-top: 10px; font-size: 12px; overflow: auto;">
                            ${error.stack || error.message}
                        </pre>
                    </details>
                </div>
            `;
        }
    }

    /**
     * Log user statistics for debugging
     */
    logUserStats() {
        const stats = appState.getUserStats();
        console.log('📊 User Statistics:', stats);
        
        if (supabaseManager.isCollaborativeMode()) {
            console.log('🤝 Collaborative mode active - changes sync in real-time');
        }
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            version: this.version,
            initialized: this.isInitialized,
            collaborativeMode: supabaseManager.isCollaborativeMode(),
            currentUser: userManager.getCurrentUserId(),
            currentClub: appState.getCurrentClub()?.name || null,
            userStats: appState.getUserStats()
        };
    }

    /**
     * Application management functions
     */
    async reset() {
        if (confirm('Reset all data? This cannot be undone.')) {
            appState.reset();
            storageManager.clearLocalData();
            window.location.reload();
        }
    }

    async exportData() {
        try {
            const data = storageManager.exportUserData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `literary-circle-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            console.log('📤 Data exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export data. Please try again.');
        }
    }

    async importData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const success = await storageManager.importUserData(data);
            if (success) {
                uiComponents.updateBookClubsList();
                alert('📥 Data imported successfully!');
            } else {
                alert('❌ Import failed. Please check the file format.');
            }
        } catch (error) {
            console.error('Import failed:', error);
            alert('❌ Import failed. Please check the file format.');
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new LiteraryCircleApp();
    await app.init();
    
    // Make app instance available globally for debugging
    window.literaryCircleApp = app;
    
    // Add development helpers in console
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🛠️ Development mode detected');
        console.log('Available commands:');
        console.log('  literaryCircleApp.getStatus() - Get app status');
        console.log('  literaryCircleApp.exportData() - Export data');
        console.log('  literaryCircleApp.reset() - Reset all data');
        
        // Make development functions available
        window.devTools = {
            exportData: () => app.exportData(),
            getStatus: () => app.getStatus(),
            getUserStats: () => appState.getUserStats(),
            reset: () => app.reset()
        };
    }
});

// Export for module usage
export default LiteraryCircleApp;