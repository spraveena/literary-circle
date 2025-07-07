// js/ui/components.js
/**
 * UI components and view management
 * Updated with user ownership display and collaborative features
 */

import appState from '../core/state.js';
import userManager from '../core/user.js';
import supabaseManager from '../config/supabase.js';

class UIComponents {
    constructor() {
        this.elements = {};
        this.confirmationCallback = null;
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements = {
            // Home view elements
            homeView: document.getElementById('homeView'),
            bookClubView: document.getElementById('bookClubView'),
            navigation: document.getElementById('navigation'),
            currentClubName: document.getElementById('currentClubName'),
            clubNameInput: document.getElementById('clubNameInput'),
            bookClubsList: document.getElementById('bookClubsList'),

            // Book club view elements
            sharingSection: document.getElementById('sharingSection'),
            shareUrl: document.getElementById('shareUrl'),
            bookInput: document.getElementById('bookInput'),
            bookList: document.getElementById('bookList'),
            bookCount: document.getElementById('bookCount'),
            selectBtn: document.getElementById('selectBtn'),
            selectedBook: document.getElementById('selectedBook'),
            selectionButtons: document.getElementById('selectionButtons'),
            recommendationsContainer: document.getElementById('recommendationsContainer'),
            recommendBtn: document.getElementById('recommendBtn'),
            recommendDivider: document.getElementById('recommendDivider'),

            // Confirmation dialog
            confirmationOverlay: document.getElementById('confirmationOverlay'),
            confirmationMessage: document.getElementById('confirmationMessage')
        };

        console.log('🎨 UI elements initialized');
    }

    /**
     * Update the book clubs list with ownership indicators
     */
    updateBookClubsList() {
        if (!this.elements.bookClubsList) return;

        const userClubs = Object.values(appState.getBookClubs());
        
        if (userClubs.length === 0) {
            this.elements.bookClubsList.innerHTML = '<div class="empty-state">No reading groups yet. Create your first group above.</div>';
            return;
        }
        
        this.elements.bookClubsList.innerHTML = userClubs.map(club => {
            const ownershipLabel = userManager.isSharedWithUser(club) ? ' (Shared)' : '';
            const isOwner = userManager.isOwner(club);
            const deleteButton = isOwner ? 
                `<button class="btn btn-danger btn-small" onclick="handleDeleteClub('${club.id}')" type="button" title="Delete this reading group">Delete</button>` : 
                '';
            
            return `
                <div class="bookclub-card">
                    <div onclick="showBookClub('${club.id}')" style="cursor: pointer; padding: 0; margin: -35px; padding: 35px;">
                        <h3>${club.name}${ownershipLabel}</h3>
                        <div class="bookclub-meta">
                            ${club.books.length} titles • Created ${new Date(club.createdAt).toLocaleDateString()}
                            ${!isOwner ? ' • Read-only access' : ''}
                        </div>
                    </div>
                    <div class="bookclub-actions" style="position: relative; z-index: 10;">
                        <button class="btn btn-small" onclick="showBookClub('${club.id}')" type="button">Enter</button>
                        ${deleteButton}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Update the current book club view
     */
    updateBookClubView() {
        this.updateBookList();
        this.updateRecommendationButton();
        this.updateSharingSection();
        this.updateNavigationTitle();
    }

    /**
     * Update the book list display
     */
    updateBookList() {
        const club = appState.getCurrentClub();
        if (!club) return;
        
        if (!this.elements.bookList || !this.elements.bookCount) return;
        
        this.elements.bookCount.textContent = club.books.length;
        
        if (club.books.length === 0) {
            this.elements.bookList.innerHTML = '<div class="empty-state">No titles in collection</div>';
            if (this.elements.selectBtn) {
                this.elements.selectBtn.disabled = true;
            }
            return;
        }
        
        if (this.elements.selectBtn) {
            this.elements.selectBtn.disabled = false;
        }
        
        this.elements.bookList.innerHTML = club.books.map((book, index) => `
            <div class="book-item">
                <span class="book-title">${book}</span>
                <button class="delete-btn" onclick="removeBookByIndex(${index}); event.stopPropagation();" title="Remove book">×</button>
            </div>
        `).join('');
    }

    /**
     * Update the sharing section visibility and content
     */
    updateSharingSection() {
        if (!this.elements.sharingSection || !this.elements.shareUrl) return;
        
        const club = appState.getCurrentClub();
        const isCollaborative = supabaseManager.isCollaborativeMode();
        const isOwner = club ? userManager.isOwner(club) : false;
        
        if (isCollaborative && club && isOwner) {
            this.elements.sharingSection.style.display = 'block';
            const shareUrl = `${window.location.origin}${window.location.pathname}?join=${club.id}`;
            this.elements.shareUrl.value = shareUrl;
        } else {
            this.elements.sharingSection.style.display = 'none';
        }
    }

    /**
     * Update the navigation title
     */
    updateNavigationTitle() {
        const club = appState.getCurrentClub();
        if (club && this.elements.currentClubName) {
            const ownershipIndicator = userManager.isSharedWithUser(club) ? ' (Shared)' : '';
            this.elements.currentClubName.textContent = club.name + ownershipIndicator;
        }
    }

    /**
     * Update recommendation button visibility
     */
    updateRecommendationButton() {
        const club = appState.getCurrentClub();
        if (!club) return;
        
        if (this.elements.recommendBtn && this.elements.recommendDivider) {
            if (club.books.length > 0) {
                this.elements.recommendBtn.style.display = 'inline-block';
                this.elements.recommendDivider.style.display = 'block';
            } else {
                this.elements.recommendBtn.style.display = 'none';
                this.elements.recommendDivider.style.display = 'none';
            }
        }
    }

    /**
     * Update collaboration status indicator
     */
    updateCollaborationStatus() {
        const header = document.querySelector('.header p');
        
        if (supabaseManager.isCollaborativeMode()) {
            header.textContent = 'Real-time collaborative reading communities ✨';
            header.style.color = '#2d5016';
        } else {
            header.textContent = 'Thoughtful reading communities for discerning professionals';
            header.style.color = '#6b7460';
        }
    }

    /**
     * Show book selection display
     * @param {string} selectedBook 
     * @param {boolean} isConfirmed 
     */
    showBookSelection(selectedBook, isConfirmed = false) {
        if (!this.elements.selectedBook || !this.elements.selectionButtons) return;
        
        const confirmedClass = isConfirmed ? ' confirmed' : '';
        const confirmedMessage = isConfirmed ? 
            '<br><small style="font-size: 15px; opacity: 0.8; margin-top: 8px; display: block;">Selection confirmed — removed from collection</small>' : 
            '';
        
        this.elements.selectedBook.innerHTML = `
            <div class="selected-book${confirmedClass}">
                ${selectedBook}
                ${confirmedMessage}
            </div>
        `;
        
        this.elements.selectionButtons.style.display = isConfirmed ? 'none' : 'block';
    }

    /**
     * Clear book selection display
     */
    clearBookSelection() {
        if (this.elements.selectedBook && this.elements.selectionButtons) {
            this.elements.selectedBook.innerHTML = '';
            this.elements.selectionButtons.style.display = 'none';
        }
    }

    /**
     * Show loading state for recommendations
     */
    showRecommendationsLoading() {
        if (!this.elements.recommendationsContainer) return;
        
        this.elements.recommendationsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Curating personalized recommendations...</p>
            </div>
        `;
    }

    /**
     * Show recommendations
     * @param {Array} recommendations 
     */
    showRecommendations(recommendations) {
        if (!this.elements.recommendationsContainer) return;
        
        if (recommendations.length === 0) {
            this.elements.recommendationsContainer.innerHTML = `
                <div class="empty-state">No recommendations available at this time.</div>
            `;
            return;
        }
        
        this.elements.recommendationsContainer.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item">
                <h3>${rec.title}</h3>
                <div class="author">by ${rec.author}</div>
                <div class="reason">${rec.reason}</div>
                <div class="themes">${rec.themes.join(' • ')}</div>
            </div>
        `).join('');
    }

    /**
     * Show recommendations error
     */
    showRecommendationsError() {
        if (!this.elements.recommendationsContainer) return;
        
        this.elements.recommendationsContainer.innerHTML = `
            <div class="loading">
                <p>Unable to generate recommendations at this time. Please try again.</p>
            </div>
        `;
    }

    /**
     * Reset recommendations to empty state
     */
    resetRecommendations() {
        if (!this.elements.recommendationsContainer) return;
        
        this.elements.recommendationsContainer.innerHTML = 
            '<div class="empty-state">Build your collection to receive personalized recommendations</div>';
    }

    /**
     * Show confirmation dialog
     * @param {string} message 
     * @param {Function} callback 
     */
    showConfirmation(message, callback) {
        if (!this.elements.confirmationOverlay || !this.elements.confirmationMessage) return;
        
        this.elements.confirmationMessage.textContent = message;
        this.elements.confirmationOverlay.style.display = 'flex';
        this.confirmationCallback = callback;
        
        // Add keyboard support
        document.addEventListener('keydown', this.handleConfirmationKeydown.bind(this));
    }

    /**
     * Hide confirmation dialog
     */
    hideConfirmation() {
        if (!this.elements.confirmationOverlay) return;
        
        this.elements.confirmationOverlay.style.display = 'none';
        this.confirmationCallback = null;
        
        // Remove keyboard listener
        document.removeEventListener('keydown', this.handleConfirmationKeydown.bind(this));
    }

    /**
     * Handle confirmation dialog keyboard events
     * @param {KeyboardEvent} event 
     */
    handleConfirmationKeydown(event) {
        if (event.key === 'Escape') {
            this.hideConfirmation();
        } else if (event.key === 'Enter') {
            this.confirmAction();
        }
    }

    /**
     * Confirm the pending action
     */
    confirmAction() {
        if (this.confirmationCallback) {
            this.confirmationCallback();
        }
        this.hideConfirmation();
    }

    /**
     * Show view by ID
     * @param {string} viewId 
     */
    showView(viewId) {
        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.classList.remove('active'));
        
        // Show selected view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }
    }

    /**
     * Show home view
     */
    showHome() {
        this.showView('homeView');
        if (this.elements.navigation) {
            this.elements.navigation.style.display = 'none';
        }
        this.updateBookClubsList();
    }

    /**
     * Show book club view
     * @param {string} clubId 
     */
    showBookClub(clubId) {
        this.showView('bookClubView');
        if (this.elements.navigation) {
            this.elements.navigation.style.display = 'flex';
        }
        this.updateBookClubView();
    }

    /**
     * Copy share URL to clipboard
     */
    async copyShareUrl() {
        if (!this.elements.shareUrl) return;
        
        try {
            this.elements.shareUrl.select();
            this.elements.shareUrl.setSelectionRange(0, 99999); // For mobile devices
            
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(this.elements.shareUrl.value);
                alert('📋 Share link copied! Send this to invite others to your reading group.');
            } else {
                // Fallback for older browsers
                document.execCommand('copy');
                alert('📋 Share link copied! Send this to invite others to your reading group.');
            }
        } catch (error) {
            console.error('Failed to copy URL:', error);
            alert('📋 Link ready to copy: ' + this.elements.shareUrl.value);
        }
    }

    /**
     * Generate QR code for sharing
     */
    generateQRCode() {
        if (!this.elements.shareUrl) return;
        
        const shareUrl = this.elements.shareUrl.value;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;
        window.open(qrUrl, '_blank');
    }

    /**
     * Clear form inputs
     */
    clearInputs() {
        if (this.elements.clubNameInput) {
            this.elements.clubNameInput.value = '';
        }
        if (this.elements.bookInput) {
            this.elements.bookInput.value = '';
        }
    }

    /**
     * Show toast notification (for future enhancement)
     * @param {string} message 
     * @param {string} type 
     */
    showToast(message, type = 'info') {
        // Simple alert for now, could be enhanced with custom toast component
        console.log(`Toast [${type}]: ${message}`);
        
        // For important messages, show alert
        if (type === 'error' || type === 'success') {
            alert(message);
        }
    }

    /**
     * Get current form values
     * @returns {Object}
     */
    getFormValues() {
        return {
            clubName: this.elements.clubNameInput?.value?.trim() || '',
            bookTitle: this.elements.bookInput?.value?.trim() || ''
        };
    }

    /**
     * Set form values
     * @param {Object} values 
     */
    setFormValues(values) {
        if (values.clubName !== undefined && this.elements.clubNameInput) {
            this.elements.clubNameInput.value = values.clubName;
        }
        if (values.bookTitle !== undefined && this.elements.bookInput) {
            this.elements.bookInput.value = values.bookTitle;
        }
    }

    /**
     * Handle overlay click for modal closing
     * @param {Event} event 
     */
    handleOverlayClick(event) {
        if (event.target === event.currentTarget) {
            this.hideConfirmation();
        }
    }
}

// Export singleton instance
const uiComponents = new UIComponents();

// Make some functions globally available for onclick handlers
window.handleOverlayClick = (event) => uiComponents.handleOverlayClick(event);
window.hideConfirmation = () => uiComponents.hideConfirmation();
window.confirmDeletion = () => uiComponents.confirmAction();
window.copyShareUrl = () => uiComponents.copyShareUrl();
window.generateQRCode = () => uiComponents.generateQRCode();

export default uiComponents;