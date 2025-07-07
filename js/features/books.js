// js/features/books.js
/**
 * Book management functionality within clubs
 */

import appState from '../core/state.js';
import storageManager from '../core/storage.js';
import userManager from '../core/user.js';

class BookManager {
    constructor() {
        this.maxBooksPerClub = 100; // Reasonable limit
    }

    /**
     * Add a book to the current club
     * @param {string} title 
     * @returns {boolean} Success status
     */
    async addBook(title = null) {
        const club = appState.getCurrentClub();
        if (!club) {
            console.warn('No current club selected');
            return false;
        }

        // Get title from input if not provided
        if (!title) {
            const input = document.getElementById('bookInput');
            title = input?.value?.trim();
        }

        if (!title) {
            console.warn('No book title provided');
            return false;
        }

        // Check for duplicates
        if (club.books.includes(title)) {
            console.log(`Book "${title}" already in collection`);
            return false;
        }

        // Check limit
        if (club.books.length >= this.maxBooksPerClub) {
            alert(`Maximum of ${this.maxBooksPerClub} books per collection reached.`);
            return false;
        }

        // Add the book
        const success = appState.addBookToClub(club.id, title);
        
        if (success) {
            await storageManager.saveData();
            console.log(`📖 Added "${title}" to ${club.name}`);
        }

        return success;
    }

    /**
     * Remove a book by title
     * @param {string} title 
     * @returns {boolean} Success status
     */
    async removeBook(title) {
        const club = appState.getCurrentClub();
        if (!club) return false;

        const success = appState.removeBookFromClub(club.id, title);
        
        if (success) {
            await storageManager.saveData();
            console.log(`📚 Removed "${title}" from ${club.name}`);
        }

        return success;
    }

    /**
     * Remove a book by index
     * @param {number} index 
     * @returns {boolean} Success status
     */
    async removeByIndex(index) {
        const club = appState.getCurrentClub();
        if (!club) return false;

        const removedBook = appState.removeBookByIndex(club.id, index);
        
        if (removedBook) {
            await storageManager.saveData();
            console.log(`📚 Removed "${removedBook}" from ${club.name}`);
            return true;
        }

        return false;
    }

    /**
     * Clear all books from current club
     * @returns {boolean} Success status
     */
    async clearAll() {
        const club = appState.getCurrentClub();
        if (!club) return false;

        const success = appState.clearAllBooks(club.id);
        
        if (success) {
            await storageManager.saveData();
        }

        return success;
    }

    /**
     * Move a book to a different position
     * @param {number} fromIndex 
     * @param {number} toIndex 
     * @returns {boolean} Success status
     */
    async moveBook(fromIndex, toIndex) {
        const club = appState.getCurrentClub();
        if (!club || fromIndex < 0 || toIndex < 0 || 
            fromIndex >= club.books.length || toIndex >= club.books.length) {
            return false;
        }

        const books = club.books;
        const [movedBook] = books.splice(fromIndex, 1);
        books.splice(toIndex, 0, movedBook);

        await storageManager.saveData();
        console.log(`📖 Moved "${movedBook}" from position ${fromIndex} to ${toIndex}`);
        return true;
    }

    /**
     * Get random book from current club
     * @returns {string|null}
     */
    getRandomBook() {
        const club = appState.getCurrentClub();
        if (!club || club.books.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * club.books.length);
        return club.books[randomIndex];
    }

    /**
     * Select random book for club selection process
     * @returns {string|null}
     */
    selectRandom() {
        const club = appState.getCurrentClub();
        if (!club || club.books.length === 0) return null;

        const selection = this.getRandomBook();
        if (selection) {
            appState.setClubSelection(club.id, selection);
        }
        
        return selection;
    }

    /**
     * Regenerate selection (alias for selectRandom)
     * @returns {string|null}
     */
    regenerateSelection() {
        return this.selectRandom();
    }

    /**
     * Confirm current selection and remove from books
     * @returns {string|null} The confirmed selection
     */
    async confirmSelection() {
        const club = appState.getCurrentClub();
        if (!club) return null;

        const selection = appState.confirmSelection(club.id);
        
        if (selection) {
            await storageManager.saveData();
        }

        return selection;
    }

    /**
     * Search books in current club
     * @param {string} query 
     * @returns {Array} Matching books
     */
    searchBooks(query) {
        const club = appState.getCurrentClub();
        if (!club || !query) return [];

        const lowercaseQuery = query.toLowerCase();
        return club.books.filter(book => 
            book.toLowerCase().includes(lowercaseQuery)
        );
    }

    /**
     * Get book statistics for current club
     * @returns {Object}
     */
    getStats() {
        const club = appState.getCurrentClub();
        if (!club) return null;

        const totalBooks = club.books.length;
        const hasSelection = !!club.currentSelection;
        const averageLength = totalBooks > 0 ? 
            club.books.reduce((sum, book) => sum + book.length, 0) / totalBooks : 0;

        return {
            totalBooks,
            hasSelection,
            currentSelection: club.currentSelection,
            averageLength: Math.round(averageLength),
            canSelect: totalBooks > 0,
            isAtLimit: totalBooks >= this.maxBooksPerClub
        };
    }

    /**
     * Export books from current club
     * @returns {Object|null}
     */
    exportBooks() {
        const club = appState.getCurrentClub();
        if (!club || !userManager.isOwner(club)) return null;

        return {
            clubName: club.name,
            books: [...club.books],
            currentSelection: club.currentSelection,
            exportedAt: new Date().toISOString(),
            exportedBy: userManager.getCurrentUserId()
        };
    }

    /**
     * Import books to current club
     * @param {Array} books 
     * @returns {Promise<number>} Number of books imported
     */
    async importBooks(books) {
        const club = appState.getCurrentClub();
        if (!club || !userManager.isOwner(club)) return 0;

        if (!Array.isArray(books)) {
            console.error('Books must be an array');
            return 0;
        }

        let importedCount = 0;
        
        for (const book of books) {
            if (typeof book === 'string' && book.trim()) {
                const title = book.trim();
                
                // Check for duplicates and limits
                if (!club.books.includes(title) && 
                    club.books.length < this.maxBooksPerClub) {
                    
                    club.books.push(title);
                    importedCount++;
                }
            }
        }

        if (importedCount > 0) {
            await storageManager.saveData();
            console.log(`📥 Imported ${importedCount} books to ${club.name}`);
        }

        return importedCount;
    }

    /**
     * Suggest books based on existing collection (simple implementation)
     * @returns {Array}
     */
    getSuggestions() {
        const club = appState.getCurrentClub();
        if (!club || club.books.length === 0) return [];

        // Simple suggestions based on common words in titles
        const commonWords = this.extractCommonWords(club.books);
        
        // Mock suggestions - in a real app, this would use an API
        const suggestions = [
            'The Great Gatsby',
            'To Kill a Mockingbird',
            '1984',
            'Pride and Prejudice',
            'The Catcher in the Rye'
        ].filter(suggestion => !club.books.includes(suggestion));

        return suggestions.slice(0, 3);
    }

    /**
     * Extract common words from book titles (helper for suggestions)
     * @param {Array} books 
     * @returns {Array}
     */
    extractCommonWords(books) {
        const words = {};
        const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        
        books.forEach(book => {
            book.toLowerCase().split(' ').forEach(word => {
                const cleanWord = word.replace(/[^a-z]/g, '');
                if (cleanWord.length > 2 && !commonWords.includes(cleanWord)) {
                    words[cleanWord] = (words[cleanWord] || 0) + 1;
                }
            });
        });

        return Object.entries(words)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    /**
     * Validate book title
     * @param {string} title 
     * @returns {Object} Validation result
     */
    validateTitle(title) {
        if (!title || typeof title !== 'string') {
            return { valid: false, error: 'Title is required' };
        }

        const trimmedTitle = title.trim();
        
        if (trimmedTitle.length === 0) {
            return { valid: false, error: 'Title cannot be empty' };
        }

        if (trimmedTitle.length > 200) {
            return { valid: false, error: 'Title is too long (max 200 characters)' };
        }

        const club = appState.getCurrentClub();
        if (club && club.books.includes(trimmedTitle)) {
            return { valid: false, error: 'Book already in collection' };
        }

        return { valid: true, title: trimmedTitle };
    }
}

// Export singleton instance
const bookManager = new BookManager();
export default bookManager;