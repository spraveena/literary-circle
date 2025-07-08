// js/features/recommendations.js
/**
 * Enhanced smart book recommendation engine
 * Now pulls from real book databases instead of hardcoded data
 */

import appState from '../core/state.js';

class RecommendationManager {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.rateLimitDelay = 1000; // 1 second between API calls
        this.lastApiCall = 0;
        this.maxCacheSize = 1000;
        this.fallbackDatabase = this.initializeFallbackDatabase();
        this.genreMapping = this.initializeGenreMapping();
        this.apiProviders = this.initializeApiProviders();
        this.debugMode = false;
    }

    /**
     * Generate recommendations using external book databases
     * @param {Array} books - Optional book list, uses current club if not provided
     * @returns {Promise<Array>} Array of recommendation objects
     */
    async generate(books = null) {
        try {
            const bookList = books || this.getCurrentClubBooks();
            
            if (!bookList || bookList.length === 0) {
                throw new Error('No books available for recommendations');
            }

            this.log(`Generating recommendations for ${bookList.length} books`);

            // Analyze user's collection
            const analysis = this.analyzeCollection(bookList);
            
            // Get recommendations from multiple sources
            const recommendations = await this.fetchRecommendationsFromSources(analysis, bookList);
            
            // Enhance with detailed book information
            const enhancedRecommendations = await this.enhanceRecommendations(recommendations);
            
            // Filter, rank, and diversify
            const finalRecommendations = this.rankAndFilterRecommendations(
                enhancedRecommendations, 
                bookList, 
                analysis
            );

            this.log(`Generated ${finalRecommendations.length} recommendations`);
            
            return finalRecommendations;
            
        } catch (error) {
            console.error('Error generating recommendations:', error);
            
            // Fallback to local recommendations
            this.log('Falling back to local recommendation database');
            return this.generateFallbackRecommendations(books);
        }
    }

    /**
     * Fetch recommendations from multiple sources
     * @param {Object} analysis - User collection analysis
     * @param {Array} userBooks - User's current books
     * @returns {Promise<Array>} Raw recommendations
     */
    async fetchRecommendationsFromSources(analysis, userBooks) {
        const recommendations = [];
        const topGenres = Array.from(analysis.genres.entries()).slice(0, 3);
        const topKeywords = Array.from(analysis.keywords.entries()).slice(0, 5);

        try {
            // Search by genres
            for (const [genre, count] of topGenres) {
                const genreBooks = await this.searchByGenre(genre, Math.min(count * 2, 10));
                recommendations.push(...genreBooks);
                
                // Rate limiting
                await this.respectRateLimit();
            }

            // Search by keywords and themes
            for (const [keyword, count] of topKeywords.slice(0, 3)) {
                const keywordBooks = await this.searchByKeyword(keyword, Math.min(count * 2, 8));
                recommendations.push(...keywordBooks);
                
                await this.respectRateLimit();
            }

            // Search for books similar to user's favorites
            const favoriteBooks = userBooks.slice(0, 3); // Top 3 books
            for (const book of favoriteBooks) {
                const similarBooks = await this.findSimilarBooks(book, 5);
                recommendations.push(...similarBooks);
                
                await this.respectRateLimit();
            }

            // Get trending/popular books in preferred genres
            const trendingBooks = await this.getTrendingBooks(topGenres, 10);
            recommendations.push(...trendingBooks);

        } catch (error) {
            console.error('Error fetching from external sources:', error);
        }

        return this.removeDuplicates(recommendations);
    }

    /**
     * Search books by genre using Google Books API
     * @param {string} genre 
     * @param {number} maxResults 
     * @returns {Promise<Array>}
     */
    async searchByGenre(genre, maxResults = 10) {
        const cacheKey = `genre_${genre}_${maxResults}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const mappedGenre = this.genreMapping[genre.toLowerCase()] || genre;
            const query = `subject:${encodeURIComponent(mappedGenre)}`;
            const books = await this.googleBooksSearch(query, maxResults, {
                orderBy: 'relevance',
                filter: 'ebooks',
                langRestrict: 'en'
            });

            this.setCache(cacheKey, books);
            return books;

        } catch (error) {
            this.log(`Error searching by genre ${genre}:`, error);
            return [];
        }
    }

    /**
     * Search books by keyword
     * @param {string} keyword 
     * @param {number} maxResults 
     * @returns {Promise<Array>}
     */
    async searchByKeyword(keyword, maxResults = 8) {
        const cacheKey = `keyword_${keyword}_${maxResults}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const query = `intitle:${encodeURIComponent(keyword)} OR inauthor:${encodeURIComponent(keyword)}`;
            const books = await this.googleBooksSearch(query, maxResults, {
                orderBy: 'relevance'
            });

            this.setCache(cacheKey, books);
            return books;

        } catch (error) {
            this.log(`Error searching by keyword ${keyword}:`, error);
            return [];
        }
    }

    /**
     * Find books similar to a given book
     * @param {string} bookTitle 
     * @param {number} maxResults 
     * @returns {Promise<Array>}
     */
    async findSimilarBooks(bookTitle, maxResults = 5) {
        const cacheKey = `similar_${bookTitle}_${maxResults}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            // First, try to find the exact book to get its details
            const exactBook = await this.findExactBook(bookTitle);
            
            if (exactBook && exactBook.categories) {
                // Search for books in the same categories
                const category = exactBook.categories[0];
                const books = await this.searchByGenre(category, maxResults);
                this.setCache(cacheKey, books);
                return books;
            } else {
                // Fallback: search by title words
                const keywords = bookTitle.split(' ').filter(word => word.length > 3);
                const query = keywords.slice(0, 3).join(' ');
                const books = await this.googleBooksSearch(query, maxResults);
                this.setCache(cacheKey, books);
                return books;
            }

        } catch (error) {
            this.log(`Error finding similar books for ${bookTitle}:`, error);
            return [];
        }
    }

    /**
     * Find exact book details
     * @param {string} bookTitle 
     * @returns {Promise<Object|null>}
     */
    async findExactBook(bookTitle) {
        const cacheKey = `exact_${bookTitle}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const query = `intitle:"${encodeURIComponent(bookTitle)}"`;
            const books = await this.googleBooksSearch(query, 1, {
                orderBy: 'relevance'
            });

            const book = books.length > 0 ? books[0] : null;
            this.setCache(cacheKey, book);
            return book;

        } catch (error) {
            this.log(`Error finding exact book ${bookTitle}:`, error);
            return null;
        }
    }

    /**
     * Get trending books in specified genres
     * @param {Array} genres 
     * @param {number} maxResults 
     * @returns {Promise<Array>}
     */
    async getTrendingBooks(genres, maxResults = 10) {
        const cacheKey = `trending_${genres.map(g => g[0]).join('_')}_${maxResults}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const currentYear = new Date().getFullYear();
            const lastYear = currentYear - 1;
            
            // Search for recent popular books
            const query = `publishedDate:${lastYear}..${currentYear}`;
            const books = await this.googleBooksSearch(query, maxResults, {
                orderBy: 'newest'
            });

            this.setCache(cacheKey, books);
            return books;

        } catch (error) {
            this.log(`Error getting trending books:`, error);
            return [];
        }
    }

    /**
     * Core Google Books API search function
     * @param {string} query 
     * @param {number} maxResults 
     * @param {Object} options 
     * @returns {Promise<Array>}
     */
    async googleBooksSearch(query, maxResults = 10, options = {}) {
        try {
            const params = new URLSearchParams({
                q: query,
                maxResults: Math.min(maxResults, 40), // API limit
                key: this.getApiKey('google'), // Optional: add your API key for higher limits
                ...options
            });

            const url = `https://www.googleapis.com/books/v1/volumes?${params}`;
            
            this.log(`Searching Google Books: ${query}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Google Books API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.items) {
                return [];
            }

            return data.items.map(item => this.parseGoogleBookItem(item));

        } catch (error) {
            console.error('Google Books API error:', error);
            throw error;
        }
    }

    /**
     * Parse Google Books API response item
     * @param {Object} item 
     * @returns {Object}
     */
    parseGoogleBookItem(item) {
        const info = item.volumeInfo;
        
        return {
            id: item.id,
            title: info.title || 'Unknown Title',
            author: info.authors ? info.authors.join(', ') : 'Unknown Author',
            description: info.description || '',
            categories: info.categories || [],
            genres: this.extractGenres(info.categories || []),
            themes: this.extractThemes(info.description || ''),
            keywords: this.extractKeywords(info.title + ' ' + (info.description || '')),
            publishedDate: info.publishedDate || '',
            pageCount: info.pageCount || 0,
            averageRating: info.averageRating || 0,
            ratingsCount: info.ratingsCount || 0,
            thumbnail: info.imageLinks?.thumbnail || '',
            previewLink: info.previewLink || '',
            buyLink: item.saleInfo?.buyLink || '',
            isbn: this.extractISBN(info.industryIdentifiers || []),
            language: info.language || 'en',
            reason: this.generateReasonFromAPI(info),
            source: 'Google Books'
        };
    }

    /**
     * Generate recommendation reason from API data
     * @param {Object} bookInfo 
     * @returns {string}
     */
    generateReasonFromAPI(bookInfo) {
        const reasons = [];
        
        if (bookInfo.averageRating >= 4.0) {
            reasons.push('Highly rated');
        }
        
        if (bookInfo.categories && bookInfo.categories.length > 0) {
            reasons.push(`Popular ${bookInfo.categories[0].toLowerCase()}`);
        }
        
        if (bookInfo.ratingsCount > 1000) {
            reasons.push('Well-reviewed by readers');
        }
        
        if (bookInfo.publishedDate && new Date(bookInfo.publishedDate).getFullYear() >= new Date().getFullYear() - 2) {
            reasons.push('Recent publication');
        }
        
        return reasons.length > 0 ? reasons.join(', ') : 'Recommended for you';
    }

    /**
     * Extract ISBN from industry identifiers
     * @param {Array} identifiers 
     * @returns {string}
     */
    extractISBN(identifiers) {
        const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
        const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
        return isbn13?.identifier || isbn10?.identifier || '';
    }

    /**
     * Extract genres from categories
     * @param {Array} categories 
     * @returns {Array}
     */
    extractGenres(categories) {
        return categories.map(cat => {
            // Clean up category names
            return cat.split('/')[0].trim();
        }).slice(0, 3);
    }

    extractAuthorFromTitle(bookTitle) {
        // Look for patterns like "Title by Author" or "Title - Author"
        const byPattern = /(.+?)\s+by\s+(.+)/i;
        const dashPattern = /(.+?)\s+-\s+(.+)/i;
        
        let match = bookTitle.match(byPattern);
        if (match) {
            return match[2].trim();
        }
        
        match = bookTitle.match(dashPattern);
        if (match) {
            return match[2].trim();
        }
        
        return null;
    }

    /**
     * Extract themes from description
     * @param {string} description 
     * @returns {Array}
     */
    extractThemes(description) {
        const themeKeywords = {
            'family': ['family', 'mother', 'father', 'sister', 'brother', 'daughter', 'son', 'parent'],
            'love': ['love', 'romance', 'relationship', 'heart', 'passion'],
            'friendship': ['friend', 'friendship', 'companion', 'bond'],
            'war': ['war', 'battle', 'soldier', 'conflict', 'military'],
            'mystery': ['mystery', 'secret', 'hidden', 'unknown', 'puzzle'],
            'adventure': ['adventure', 'journey', 'quest', 'exploration', 'travel'],
            'identity': ['identity', 'self', 'discovery', 'becoming'],
            'power': ['power', 'control', 'authority', 'dominance'],
            'survival': ['survival', 'survive', 'danger', 'escape'],
            'redemption': ['redemption', 'forgiveness', 'second chance', 'renewal'],
            
            // Lifestyle themes
            'cooking': ['cooking', 'recipe', 'kitchen', 'chef', 'food', 'baking', 'cuisine', 'culinary', 'meal', 'dish'],
            'photography': ['photography', 'photo', 'camera', 'lens', 'picture', 'image', 'shoot', 'portrait', 'landscape'],
            'gardening': ['garden', 'plant', 'flower', 'grow', 'seed', 'soil', 'bloom', 'vegetable', 'herb', 'greenhouse'],
            'fitness': ['fitness', 'exercise', 'workout', 'gym', 'training', 'health', 'muscle', 'strength', 'cardio'],
            'travel': ['travel', 'trip', 'vacation', 'journey', 'explore', 'destination', 'abroad', 'adventure', 'guide'],
            'home improvement': ['home', 'house', 'renovation', 'decor', 'design', 'interior', 'diy', 'craft', 'build'],
            'fashion': ['fashion', 'style', 'clothing', 'dress', 'outfit', 'trend', 'beauty', 'makeup', 'wardrobe'],
            'technology': ['tech', 'computer', 'software', 'digital', 'internet', 'coding', 'programming', 'app'],
            'business': ['business', 'entrepreneur', 'startup', 'money', 'finance', 'investment', 'marketing', 'career'],
            'wellness': ['wellness', 'mindfulness', 'meditation', 'yoga', 'spiritual', 'healing', 'peace', 'balance'],
            'parenting': ['parenting', 'baby', 'toddler', 'raising', 'children', 'parent', 'childcare', 'pregnancy'],
            'art': ['art', 'painting', 'drawing', 'creative', 'artist', 'gallery', 'sculpture', 'design', 'illustration'],
            'music': ['music', 'song', 'instrument', 'band', 'musician', 'concert', 'melody', 'rhythm', 'piano'],
            'pets': ['pet', 'dog', 'cat', 'animal', 'puppy', 'kitten', 'training', 'care', 'veterinary'],
            'education': ['education', 'learning', 'teaching', 'school', 'study', 'knowledge', 'skill', 'course']
        };

        const themes = [];
        const text = description.toLowerCase(); // Use description, not title
        
        for (const [theme, keywords] of Object.entries(themeKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                themes.push(theme);
            }
        }
        
        return themes.slice(0, 3);
    }

    /**
     * Extract keywords from text
     * @param {string} text 
     * @returns {Array}
     */
    extractKeywords(text) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
        ]);
        
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 10);
    }

    determineGenres(title, words) {
        const genreKeywords = {
            // Fiction genres
            'fantasy': ['magic', 'wizard', 'dragon', 'fantasy', 'realm', 'kingdom', 'quest', 'sword', 'spell'],
            'science fiction': ['space', 'robot', 'future', 'alien', 'cyber', 'tech', 'mars', 'galaxy', 'android'],
            'mystery': ['mystery', 'detective', 'murder', 'crime', 'investigation', 'clue', 'suspect'],
            'romance': ['love', 'heart', 'passion', 'wedding', 'bride', 'romance', 'kiss'],
            'thriller': ['thriller', 'danger', 'escape', 'chase', 'survival', 'threat', 'killer'],
            'horror': ['horror', 'ghost', 'haunted', 'fear', 'nightmare', 'terror', 'zombie'],
            'historical fiction': ['historical', 'century', 'war', 'civil', 'revolution', 'empire', 'ancient'],
            'young adult': ['teen', 'high school', 'coming of age', 'teenager', 'youth'],
            'literary fiction': ['literary', 'prize', 'winner', 'acclaimed', 'debut'],
            'adventure': ['adventure', 'journey', 'expedition', 'explore', 'treasure', 'island'],
            
            // Non-fiction genres
            'biography': ['life', 'story', 'memoir', 'biography', 'autobiography'],
            'cookbook': ['cooking', 'recipe', 'kitchen', 'chef', 'food', 'baking', 'cuisine', 'culinary'],
            'photography': ['photography', 'photo', 'camera', 'lens', 'picture', 'image', 'visual'],
            'self-help': ['help', 'improve', 'guide', 'tips', 'success', 'better', 'change', 'habits'],
            'health & fitness': ['fitness', 'exercise', 'workout', 'health', 'diet', 'nutrition', 'wellness'],
            'travel': ['travel', 'guide', 'destination', 'journey', 'vacation', 'explore', 'tourism'],
            'home & garden': ['home', 'garden', 'design', 'decor', 'renovation', 'plant', 'diy'],
            'business': ['business', 'entrepreneur', 'finance', 'money', 'investment', 'marketing'],
            'technology': ['tech', 'computer', 'programming', 'software', 'digital', 'coding'],
            'art & design': ['art', 'design', 'creative', 'painting', 'drawing', 'craft'],
            'parenting': ['parenting', 'baby', 'child', 'family', 'raising', 'pregnancy'],
            'education': ['education', 'learning', 'teaching', 'study', 'academic', 'textbook']
        };
        
        const genres = [];
        const titleLower = title.toLowerCase();
        
        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            const hasKeyword = keywords.some(keyword => 
                titleLower.includes(keyword) || 
                words.some(word => word.toLowerCase() === keyword)
            );
            
            if (hasKeyword) {
                genres.push(genre);
            }
        }
        
        // Default genre if none found
        if (genres.length === 0) {
            genres.push('general fiction');
        }
        
        return genres.slice(0, 3); // Limit to 3 genres
    }


    /**
     * Enhance recommendations with additional data from multiple sources
     * @param {Array} recommendations 
     * @returns {Promise<Array>}
     */
    async enhanceRecommendations(recommendations) {
        const enhanced = [];
        
        for (const book of recommendations.slice(0, 20)) { // Limit to prevent too many API calls
            try {
                // Try to get additional data from Open Library
                const openLibraryData = await this.getOpenLibraryData(book.isbn || book.title);
                
                // Merge data from multiple sources
                const enhancedBook = {
                    ...book,
                    ...openLibraryData,
                    // Keep the best data from each source
                    rating: book.averageRating || openLibraryData?.rating || 0,
                    description: book.description || openLibraryData?.description || book.reason
                };
                
                enhanced.push(enhancedBook);
                
                // Rate limiting
                await this.respectRateLimit();
                
            } catch (error) {
                this.log(`Error enhancing book ${book.title}:`, error);
                enhanced.push(book); // Use original data if enhancement fails
            }
        }
        
        return enhanced;
    }

    /**
     * Get additional book data from Open Library
     * @param {string} identifier - ISBN or title
     * @returns {Promise<Object>}
     */
    async getOpenLibraryData(identifier) {
        if (!identifier) return {};
        
        const cacheKey = `openlibrary_${identifier}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            let url;
            
            if (identifier.match(/^\d+$/)) {
                // ISBN search
                url = `https://openlibrary.org/api/books?bibkeys=ISBN:${identifier}&format=json&jscmd=data`;
            } else {
                // Title search
                url = `https://openlibrary.org/search.json?title=${encodeURIComponent(identifier)}&limit=1`;
            }
            
            const response = await fetch(url);
            if (!response.ok) return {};
            
            const data = await response.json();
            const result = this.parseOpenLibraryData(data, identifier);
            
            this.setCache(cacheKey, result);
            return result;
            
        } catch (error) {
            this.log(`Error fetching Open Library data:`, error);
            return {};
        }
    }

    /**
     * Parse Open Library response
     * @param {Object} data 
     * @param {string} identifier 
     * @returns {Object}
     */
    parseOpenLibraryData(data, identifier) {
        try {
            if (identifier.match(/^\d+$/)) {
                // ISBN response format
                const bookKey = `ISBN:${identifier}`;
                const bookData = data[bookKey];
                
                return {
                    subjects: bookData?.subjects?.map(s => s.name) || [],
                    excerpts: bookData?.excerpts?.[0]?.text || '',
                    links: bookData?.links || []
                };
            } else {
                // Search response format
                const doc = data.docs?.[0];
                
                return {
                    subjects: doc?.subject || [],
                    firstSentence: doc?.first_sentence?.[0] || '',
                    publishYear: doc?.first_publish_year || null
                };
            }
        } catch (error) {
            this.log('Error parsing Open Library data:', error);
            return {};
        }
    }

    /**
     * Remove duplicate recommendations
     * @param {Array} recommendations 
     * @returns {Array}
     */
    removeDuplicates(recommendations) {
        const seen = new Set();
        const unique = [];
        
        for (const book of recommendations) {
            const key = `${book.title.toLowerCase()}_${book.author.toLowerCase()}`;
            
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(book);
            }
        }
        
        return unique;
    }

    /**
     * Fallback to local recommendations if APIs fail
     * @param {Array} books 
     * @returns {Array}
     */
    generateFallbackRecommendations(books) {
        // Use the original hardcoded logic as fallback
        const bookList = books || this.getCurrentClubBooks();
        const analysis = this.analyzeCollection(bookList);
        
        const scoredRecommendations = this.fallbackDatabase.map(book => {
            const score = this.calculateRecommendationScore(book, bookList, analysis);
            return {
                ...book,
                score,
                reason: book.reason,
                source: 'Local Database'
            };
        });
        
        return this.rankAndFilterRecommendations(scoredRecommendations, bookList, analysis);
    }

    /**
     * Initialize API providers configuration
     * @returns {Object}
     */
    initializeApiProviders() {
        return {
            googleBooks: {
                baseUrl: 'https://www.googleapis.com/books/v1',
                rateLimit: 1000, // 1 request per second
                quotaLimit: 1000 // per day without API key
            },
            openLibrary: {
                baseUrl: 'https://openlibrary.org',
                rateLimit: 1000, // 1 request per second
                quotaLimit: null // No strict limit
            }
        };
    }

    /**
     * Initialize genre mapping for better API searches
     * @returns {Object}
     */
    initializeGenreMapping() {
        return {
            'literary fiction': 'fiction',
            'contemporary fiction': 'fiction',
            'science fiction': 'science fiction',
            'fantasy': 'fantasy',
            'mystery': 'mystery',
            'thriller': 'thriller',
            'romance': 'romance',
            'historical fiction': 'historical fiction',
            'biography': 'biography',
            'memoir': 'biography',
            'horror': 'horror',
            'adventure': 'adventure',
            'young adult': 'young adult fiction',
            'children': 'juvenile fiction'
        };
    }

    /**
     * Get API key for specified provider
     * @param {string} provider 
     * @returns {string}
     */
    getApiKey(provider) {
        // For now, return empty string - Google Books API works without key (with rate limits)
        // You can add your API key directly here if needed:
        // const keys = {
        //     google: 'YOUR_API_KEY_HERE',
        // };
        // return keys[provider] || '';
        
        return ''; // No API key needed for basic Google Books API usage
    }

    /**
     * Respect rate limiting between API calls
     * @returns {Promise}
     */
    async respectRateLimit() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;
        
        if (timeSinceLastCall < this.rateLimitDelay) {
            const delay = this.rateLimitDelay - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastApiCall = Date.now();
    }

    /**
     * Cache management methods
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            this.log(`Cache hit: ${key}`);
            return cached.data;
        }
        
        if (cached) {
            this.cache.delete(key); // Remove expired cache
        }
        
        return null;
    }

    setCache(key, data) {
        // Manage cache size
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        this.log(`Cached: ${key}`);
    }

    clearCache() {
        this.cache.clear();
        this.log('Cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hitRate: this.calculateCacheHitRate()
        };
    }

    /**
     * Calculate cache hit rate
     * @returns {number}
     */
    calculateCacheHitRate() {
        // This would need to be tracked over time in a real implementation
        return 0; // Placeholder
    }

    /**
     * Enable debug logging
     * @param {boolean} enabled 
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Debug logging
     * @param {...any} args 
     */
    log(...args) {
        if (this.debugMode) {
            console.log('[RecommendationManager]', ...args);
        }
    }

    // Include all the original methods for analysis, scoring, etc.
    getCurrentClubBooks() {
        const club = appState.getCurrentClub();
        return club ? club.books : [];
    }

    analyzeCollection(books) {
        // ... (same as original implementation)
        const analysis = {
            genres: new Map(),
            themes: new Map(),
            authors: new Map(),
            keywords: new Map(),
            totalBooks: books.length,
            averageLength: 0,
            patterns: []
        };

        books.forEach(book => {
            const bookAnalysis = this.analyzeBook(book);
            
            bookAnalysis.genres.forEach(genre => {
                analysis.genres.set(genre, (analysis.genres.get(genre) || 0) + 1);
            });
            
            bookAnalysis.themes.forEach(theme => {
                analysis.themes.set(theme, (analysis.themes.get(theme) || 0) + 1);
            });
            
            if (bookAnalysis.author) {
                analysis.authors.set(bookAnalysis.author, (analysis.authors.get(bookAnalysis.author) || 0) + 1);
            }
            
            bookAnalysis.keywords.forEach(keyword => {
                analysis.keywords.set(keyword, (analysis.keywords.get(keyword) || 0) + 1);
            });
        });

        analysis.averageLength = books.reduce((sum, book) => sum + book.length, 0) / books.length;
        analysis.patterns = this.identifyPatterns(analysis);
        
        analysis.genres = new Map([...analysis.genres.entries()].sort((a, b) => b[1] - a[1]));
        analysis.themes = new Map([...analysis.themes.entries()].sort((a, b) => b[1] - a[1]));
        analysis.keywords = new Map([...analysis.keywords.entries()].sort((a, b) => b[1] - a[1]));

        return analysis;
    }

    analyzeBook(bookTitle) {
        // ... (same as original implementation)
        const title = bookTitle.toLowerCase();
        const words = title.split(/\s+/).filter(word => word.length > 2);
        
        const author = this.extractAuthorFromTitle(bookTitle);
        const genres = this.determineGenres(title, words);
        const themes = this.extractThemes(title, words);
        const keywords = this.extractKeywords(title, words);
        
        return {
            title: bookTitle,
            author,
            genres,
            themes,
            keywords,
            wordCount: words.length
        };
    }

    rankAndFilterRecommendations(recommendations, userBooks, analysis) {
        // Enhanced ranking that considers API data
        const filtered = recommendations.filter(rec => 
            !userBooks.some(userBook => 
                userBook.toLowerCase().includes(rec.title.toLowerCase()) ||
                rec.title.toLowerCase().includes(userBook.toLowerCase())
            )
        );
        
        const sorted = filtered.sort((a, b) => {
            // Prioritize books with better ratings and more data
            const scoreA = (a.score || 0) + (a.averageRating || 0) * 2;
            const scoreB = (b.score || 0) + (b.averageRating || 0) * 2;
            
            if (Math.abs(scoreA - scoreB) < 0.1) {
                return Math.random() - 0.5;
            }
            return scoreB - scoreA;
        });
        
        const diverse = this.ensureGenreDiversity(sorted);
        
        const count = Math.min(Math.max(3, Math.floor(userBooks.length * 1.5)), 6);
        return diverse.slice(0, count);
    }

    calculateRecommendationScore(book, userBooks, analysis) {
        // Enhanced scoring that uses API data
        let score = 0;
        
        // Genre matching
        if (book.genres) {
            book.genres.forEach(genre => {
                const genreCount = analysis.genres.get(genre.toLowerCase()) || 0;
                score += genreCount * 3;
            });
        }
        
        // Theme matching
        if (book.themes) {
            book.themes.forEach(theme => {
                const themeCount = analysis.themes.get(theme.toLowerCase()) || 0;
                score += themeCount * 2;
            });
        }
        
        // Rating bonus
        if (book.averageRating) {
            score += book.averageRating * 0.5;
        }
        
        // Popularity bonus
        if (book.ratingsCount && book.ratingsCount > 100) {
            score += Math.log10(book.ratingsCount) * 0.5;
        }
        
        // Recency bonus
        if (book.publishedDate) {
            const publishYear = new Date(book.publishedDate).getFullYear();
            const currentYear = new Date().getFullYear();
            const yearsDiff = currentYear - publishYear;
            
            if (yearsDiff <= 3) {
                score += 1;
            }
        }
        
        return Math.max(0, score);
    }

    // ... (include other original methods like identifyPatterns, ensureGenreDiversity, etc.)
    
    identifyPatterns(analysis) {
        const patterns = [];
        
        const topGenres = Array.from(analysis.genres.entries()).slice(0, 3);
        if (topGenres.length > 0) {
            patterns.push({
                type: 'genre_preference',
                description: `Strong preference for ${topGenres.map(([genre]) => genre).join(', ')}`,
                weight: 1.0
            });
        }
        
        const topThemes = Array.from(analysis.themes.entries()).slice(0, 2);
        if (topThemes.length > 0) {
            patterns.push({
                type: 'theme_preference',
                description: `Interested in themes of ${topThemes.map(([theme]) => theme).join(', ')}`,
                weight: 0.8
            });
        }
        
        return patterns;
    }

    ensureGenreDiversity(recommendations) {
        const genresUsed = new Set();
        const diverse = [];
        const remaining = [];
        
        recommendations.forEach(rec => {
            const primaryGenre = rec.genres?.[0] || 'general';
            if (!genresUsed.has(primaryGenre) && diverse.length < 6) {
                genresUsed.add(primaryGenre);
                diverse.push(rec);
            } else {
                remaining.push(rec);
            }
        });
        
        remaining.forEach(rec => {
            if (diverse.length < 6) {
                diverse.push(rec);
            }
        });
        
        return diverse;
    }

    initializeFallbackDatabase() {
        // Simplified fallback database (same as original)
        return [
            {
                title: "The Seven Husbands of Evelyn Hugo",
                author: "Taylor Jenkins Reid",
                reason: "Sophisticated character study with literary depth",
                genres: ["Contemporary Fiction"],
                themes: ["Character-Driven", "Hollywood History"],
                keywords: ["romance", "character", "hollywood"],
                averageRating: 4.4
            }
            // ... (include other fallback books)
        ];
    }
}

// Export singleton instance
const recommendationManager = new RecommendationManager();
export default recommendationManager;