// js/features/recommendations.js
/**
 * Smart book recommendation engine
 * Generates personalized suggestions based on user's collection
 */

import appState from '../core/state.js';

class RecommendationManager {
    constructor() {
        this.recommendationDatabase = this.initializeDatabase();
        this.genreWeights = new Map();
        this.authorWeights = new Map();
        this.themeWeights = new Map();
        this.minRecommendations = 3;
        this.maxRecommendations = 6;
    }

    /**
     * Generate recommendations for current club
     * @param {Array} books - Optional book list, uses current club if not provided
     * @returns {Promise<Array>} Array of recommendation objects
     */
    async generate(books = null) {
        try {
            const bookList = books || this.getCurrentClubBooks();
            
            if (!bookList || bookList.length === 0) {
                throw new Error('No books available for recommendations');
            }

            // Simulate API delay for better UX
            await this.simulateProcessingDelay();

            // Analyze user's collection
            const analysis = this.analyzeCollection(bookList);
            
            // Generate scored recommendations
            const recommendations = this.generateScoredRecommendations(bookList, analysis);
            
            // Filter and rank results
            const finalRecommendations = this.rankAndFilterRecommendations(
                recommendations, 
                bookList, 
                analysis
            );

            console.log(`📚 Generated ${finalRecommendations.length} recommendations for ${bookList.length} books`);
            
            return finalRecommendations;
            
        } catch (error) {
            console.error('Error generating recommendations:', error);
            throw new Error('Unable to generate recommendations at this time');
        }
    }

    /**
     * Get books from current club
     * @returns {Array}
     */
    getCurrentClubBooks() {
        const club = appState.getCurrentClub();
        return club ? club.books : [];
    }

    /**
     * Simulate processing delay for better UX
     * @returns {Promise}
     */
    async simulateProcessingDelay() {
        const delay = Math.random() * 1500 + 1000; // 1-2.5 seconds
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Analyze user's book collection for patterns
     * @param {Array} books 
     * @returns {Object} Analysis results
     */
    analyzeCollection(books) {
        const analysis = {
            genres: new Map(),
            themes: new Map(),
            authors: new Map(),
            keywords: new Map(),
            totalBooks: books.length,
            averageLength: 0,
            patterns: []
        };

        // Analyze each book
        books.forEach(book => {
            const bookAnalysis = this.analyzeBook(book);
            
            // Aggregate genres
            bookAnalysis.genres.forEach(genre => {
                analysis.genres.set(genre, (analysis.genres.get(genre) || 0) + 1);
            });
            
            // Aggregate themes
            bookAnalysis.themes.forEach(theme => {
                analysis.themes.set(theme, (analysis.themes.get(theme) || 0) + 1);
            });
            
            // Aggregate authors
            if (bookAnalysis.author) {
                analysis.authors.set(bookAnalysis.author, (analysis.authors.get(bookAnalysis.author) || 0) + 1);
            }
            
            // Aggregate keywords
            bookAnalysis.keywords.forEach(keyword => {
                analysis.keywords.set(keyword, (analysis.keywords.get(keyword) || 0) + 1);
            });
        });

        // Calculate average title length
        analysis.averageLength = books.reduce((sum, book) => sum + book.length, 0) / books.length;
        
        // Identify patterns
        analysis.patterns = this.identifyPatterns(analysis);
        
        // Sort maps by frequency
        analysis.genres = new Map([...analysis.genres.entries()].sort((a, b) => b[1] - a[1]));
        analysis.themes = new Map([...analysis.themes.entries()].sort((a, b) => b[1] - a[1]));
        analysis.keywords = new Map([...analysis.keywords.entries()].sort((a, b) => b[1] - a[1]));

        return analysis;
    }

    /**
     * Analyze individual book for characteristics
     * @param {string} bookTitle 
     * @returns {Object}
     */
    analyzeBook(bookTitle) {
        const title = bookTitle.toLowerCase();
        const words = title.split(/\s+/).filter(word => word.length > 2);
        
        // Extract potential author (simple heuristic)
        const author = this.extractAuthorFromTitle(bookTitle);
        
        // Determine genres based on keywords
        const genres = this.determineGenres(title, words);
        
        // Determine themes
        const themes = this.determineThemes(title, words);
        
        // Extract keywords
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

    /**
     * Simple author extraction from title
     * @param {string} title 
     * @returns {string|null}
     */
    extractAuthorFromTitle(title) {
        // Simple pattern matching for "by Author" or "- Author"
        const patterns = [
            /by\s+([a-zA-Z\s]+)$/i,
            /-\s+([a-zA-Z\s]+)$/i,
            /,\s+([a-zA-Z\s]+)$/i
        ];
        
        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return null;
    }

    /**
     * Determine genres based on title keywords
     * @param {string} title 
     * @param {Array} words 
     * @returns {Array}
     */
    determineGenres(title, words) {
        const genreKeywords = {
            'mystery': ['mystery', 'detective', 'murder', 'crime', 'investigation'],
            'romance': ['love', 'heart', 'romance', 'wedding', 'kiss'],
            'fantasy': ['magic', 'dragon', 'wizard', 'fantasy', 'realm', 'quest'],
            'science fiction': ['space', 'future', 'robot', 'alien', 'time', 'technology'],
            'historical': ['war', 'century', 'historical', 'empire', 'ancient'],
            'thriller': ['danger', 'chase', 'escape', 'conspiracy', 'threat'],
            'literary fiction': ['life', 'story', 'novel', 'tale', 'narrative'],
            'biography': ['life', 'biography', 'memoir', 'story', 'journey'],
            'horror': ['dark', 'night', 'fear', 'haunted', 'ghost'],
            'adventure': ['journey', 'adventure', 'expedition', 'travel', 'quest']
        };
        
        const genres = [];
        const allText = title + ' ' + words.join(' ');
        
        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            const matches = keywords.filter(keyword => allText.includes(keyword));
            if (matches.length > 0) {
                genres.push(genre);
            }
        }
        
        // Default to literary fiction if no specific genre found
        if (genres.length === 0) {
            genres.push('literary fiction');
        }
        
        return genres;
    }

    /**
     * Determine themes based on title content
     * @param {string} title 
     * @param {Array} words 
     * @returns {Array}
     */
    determineThemes(title, words) {
        const themeKeywords = {
            'family': ['family', 'mother', 'father', 'sister', 'brother', 'daughter', 'son'],
            'friendship': ['friend', 'friendship', 'companion', 'together'],
            'love': ['love', 'heart', 'romance', 'relationship'],
            'war': ['war', 'battle', 'soldier', 'conflict'],
            'coming of age': ['young', 'childhood', 'growing', 'youth'],
            'identity': ['identity', 'self', 'who', 'being'],
            'power': ['power', 'king', 'queen', 'ruler', 'control'],
            'survival': ['survival', 'survive', 'escape', 'danger'],
            'redemption': ['redemption', 'forgiveness', 'second', 'chance'],
            'sacrifice': ['sacrifice', 'give', 'loss', 'cost']
        };
        
        const themes = [];
        const allText = title + ' ' + words.join(' ');
        
        for (const [theme, keywords] of Object.entries(themeKeywords)) {
            const matches = keywords.filter(keyword => allText.includes(keyword));
            if (matches.length > 0) {
                themes.push(theme);
            }
        }
        
        return themes;
    }

    /**
     * Extract meaningful keywords from title
     * @param {string} title 
     * @param {Array} words 
     * @returns {Array}
     */
    extractKeywords(title, words) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
        ]);
        
        return words
            .filter(word => !stopWords.has(word))
            .filter(word => word.length > 2)
            .map(word => word.toLowerCase());
    }

    /**
     * Identify patterns in user's collection
     * @param {Object} analysis 
     * @returns {Array}
     */
    identifyPatterns(analysis) {
        const patterns = [];
        
        // Genre preferences
        const topGenres = Array.from(analysis.genres.entries()).slice(0, 3);
        if (topGenres.length > 0) {
            patterns.push({
                type: 'genre_preference',
                description: `Strong preference for ${topGenres.map(([genre]) => genre).join(', ')}`,
                weight: 1.0
            });
        }
        
        // Theme preferences
        const topThemes = Array.from(analysis.themes.entries()).slice(0, 2);
        if (topThemes.length > 0) {
            patterns.push({
                type: 'theme_preference',
                description: `Interested in themes of ${topThemes.map(([theme]) => theme).join(', ')}`,
                weight: 0.8
            });
        }
        
        // Author preferences (if multiple books by same author)
        const repeatedAuthors = Array.from(analysis.authors.entries()).filter(([_, count]) => count > 1);
        if (repeatedAuthors.length > 0) {
            patterns.push({
                type: 'author_preference',
                description: `Enjoys books by ${repeatedAuthors.map(([author]) => author).join(', ')}`,
                weight: 0.6
            });
        }
        
        // Title length preference
        if (analysis.averageLength > 25) {
            patterns.push({
                type: 'length_preference',
                description: 'Prefers longer, more descriptive titles',
                weight: 0.3
            });
        }
        
        return patterns;
    }

    /**
     * Generate scored recommendations
     * @param {Array} userBooks 
     * @param {Object} analysis 
     * @returns {Array}
     */
    generateScoredRecommendations(userBooks, analysis) {
        return this.recommendationDatabase.map(book => {
            const score = this.calculateRecommendationScore(book, userBooks, analysis);
            return {
                ...book,
                score,
                matchReasons: this.generateMatchReasons(book, analysis)
            };
        });
    }

    /**
     * Calculate recommendation score for a book
     * @param {Object} book 
     * @param {Array} userBooks 
     * @param {Object} analysis 
     * @returns {number}
     */
    calculateRecommendationScore(book, userBooks, analysis) {
        let score = 0;
        
        // Genre matching (highest weight)
        book.genres.forEach(genre => {
            const genreCount = analysis.genres.get(genre.toLowerCase()) || 0;
            score += genreCount * 3;
        });
        
        // Theme matching
        book.themes.forEach(theme => {
            const themeCount = analysis.themes.get(theme.toLowerCase()) || 0;
            score += themeCount * 2;
        });
        
        // Keyword matching
        const userText = userBooks.join(' ').toLowerCase();
        book.keywords.forEach(keyword => {
            if (userText.includes(keyword)) {
                score += 1.5;
            }
        });
        
        // Partial title word matching
        userBooks.forEach(userBook => {
            const userWords = userBook.toLowerCase().split(' ');
            userWords.forEach(word => {
                if (word.length > 3 && book.keywords.some(k => k.includes(word))) {
                    score += 1;
                }
            });
        });
        
        // Diversity bonus (slight preference for books that expand horizons)
        const hasNewGenre = book.genres.some(genre => 
            !analysis.genres.has(genre.toLowerCase())
        );
        if (hasNewGenre) {
            score += 0.5;
        }
        
        // Popularity/quality indicator (simulated)
        if (book.rating && book.rating > 4.0) {
            score += 1;
        }
        
        return Math.max(0, score);
    }

    /**
     * Generate human-readable match reasons
     * @param {Object} book 
     * @param {Object} analysis 
     * @returns {Array}
     */
    generateMatchReasons(book, analysis) {
        const reasons = [];
        
        // Check genre matches
        const matchingGenres = book.genres.filter(genre => 
            analysis.genres.has(genre.toLowerCase())
        );
        if (matchingGenres.length > 0) {
            reasons.push(`Similar ${matchingGenres.join(', ')} style`);
        }
        
        // Check theme matches
        const matchingThemes = book.themes.filter(theme => 
            analysis.themes.has(theme.toLowerCase())
        );
        if (matchingThemes.length > 0) {
            reasons.push(`Explores ${matchingThemes.join(', ')} themes`);
        }
        
        // Check for diversity
        const newGenres = book.genres.filter(genre => 
            !analysis.genres.has(genre.toLowerCase())
        );
        if (newGenres.length > 0) {
            reasons.push(`Expands into ${newGenres.join(', ')}`);
        }
        
        return reasons;
    }

    /**
     * Rank and filter final recommendations
     * @param {Array} recommendations 
     * @param {Array} userBooks 
     * @param {Object} analysis 
     * @returns {Array}
     */
    rankAndFilterRecommendations(recommendations, userBooks, analysis) {
        // Filter out books already in user's collection
        const filtered = recommendations.filter(rec => 
            !userBooks.some(userBook => 
                userBook.toLowerCase().includes(rec.title.toLowerCase()) ||
                rec.title.toLowerCase().includes(userBook.toLowerCase())
            )
        );
        
        // Sort by score, with randomization for ties
        const sorted = filtered.sort((a, b) => {
            if (Math.abs(a.score - b.score) < 0.1) {
                return Math.random() - 0.5; // Randomize similar scores
            }
            return b.score - a.score;
        });
        
        // Ensure variety in genres
        const diverse = this.ensureGenreDiversity(sorted);
        
        // Return top recommendations
        const count = Math.min(
            Math.max(this.minRecommendations, Math.floor(userBooks.length * 1.5)),
            this.maxRecommendations
        );
        
        return diverse.slice(0, count);
    }

    /**
     * Ensure genre diversity in recommendations
     * @param {Array} recommendations 
     * @returns {Array}
     */
    ensureGenreDiversity(recommendations) {
        const genresUsed = new Set();
        const diverse = [];
        const remaining = [];
        
        // First pass: one per genre
        recommendations.forEach(rec => {
            const primaryGenre = rec.genres[0];
            if (!genresUsed.has(primaryGenre) && diverse.length < this.maxRecommendations) {
                genresUsed.add(primaryGenre);
                diverse.push(rec);
            } else {
                remaining.push(rec);
            }
        });
        
        // Second pass: fill remaining slots
        remaining.forEach(rec => {
            if (diverse.length < this.maxRecommendations) {
                diverse.push(rec);
            }
        });
        
        return diverse;
    }

    /**
     * Get recommendation statistics
     * @param {Array} books 
     * @returns {Object}
     */
    getRecommendationStats(books = null) {
        const bookList = books || this.getCurrentClubBooks();
        const analysis = this.analyzeCollection(bookList);
        
        return {
            totalBooks: bookList.length,
            topGenres: Array.from(analysis.genres.entries()).slice(0, 3),
            topThemes: Array.from(analysis.themes.entries()).slice(0, 3),
            patterns: analysis.patterns,
            recommendationCount: Math.min(
                Math.max(this.minRecommendations, Math.floor(bookList.length * 1.5)),
                this.maxRecommendations
            )
        };
    }

    /**
     * Initialize the recommendation database
     * @returns {Array}
     */
    initializeDatabase() {
        return [
            {
                title: "The Seven Husbands of Evelyn Hugo",
                author: "Taylor Jenkins Reid",
                reason: "Sophisticated character study with literary depth and narrative complexity",
                genres: ["Contemporary Fiction", "Literary Fiction"],
                themes: ["Character-Driven", "Hollywood History", "LGBTQ Literature", "Secrets"],
                keywords: ["romance", "character", "hollywood", "secrets", "drama", "contemporary"],
                rating: 4.4
            },
            {
                title: "Where the Crawdads Sing",
                author: "Delia Owens",
                reason: "Lyrical prose exploring themes of isolation and human connection with nature",
                genres: ["Literary Fiction", "Mystery"],
                themes: ["Nature Writing", "Coming-of-Age", "Southern Gothic", "Isolation"],
                keywords: ["nature", "mystery", "coming-of-age", "isolation", "literary", "southern"],
                rating: 4.3
            },
            {
                title: "The Invisible Life of Addie LaRue",
                author: "V.E. Schwab",
                reason: "Elegant magical realism examining memory, art, and the human condition",
                genres: ["Fantasy", "Historical Fiction"],
                themes: ["Magical Realism", "Art & Artists", "Philosophy of Memory", "Love"],
                keywords: ["fantasy", "magic", "historical", "art", "memory", "immortal"],
                rating: 4.2
            },
            {
                title: "Educated",
                author: "Tara Westover",
                reason: "Powerful memoir exploring education, family dynamics, and personal transformation",
                genres: ["Memoir", "Biography"],
                themes: ["Education & Learning", "Family Dynamics", "Personal Growth", "Survival"],
                keywords: ["memoir", "education", "family", "growth", "true story", "inspiring"],
                rating: 4.5
            },
            {
                title: "The Midnight Library",
                author: "Matt Haig",
                reason: "Philosophical exploration of life's possibilities and the nature of regret",
                genres: ["Philosophical Fiction", "Contemporary Fiction"],
                themes: ["Life Choices", "Mental Health", "Existential Literature", "Philosophy"],
                keywords: ["philosophy", "choices", "mental health", "life", "regret", "alternative"],
                rating: 4.1
            },
            {
                title: "Circe",
                author: "Madeline Miller",
                reason: "Mythological retelling with beautiful prose and strong female protagonist",
                genres: ["Fantasy", "Historical Fiction"],
                themes: ["Mythology", "Feminism", "Greek Myths", "Transformation"],
                keywords: ["mythology", "greek", "magic", "female", "gods", "transformation"],
                rating: 4.3
            },
            {
                title: "The Thursday Murder Club",
                author: "Richard Osman",
                reason: "Cozy mystery with humor and heart, perfect for book club discussions",
                genres: ["Mystery", "Cozy Mystery"],
                themes: ["Humor", "Friendship", "Retirement", "Community"],
                keywords: ["mystery", "humor", "elderly", "friendship", "club", "cozy"],
                rating: 4.2
            },
            {
                title: "Klara and the Sun",
                author: "Kazuo Ishiguro",
                reason: "Thoughtful science fiction exploring humanity through an AI's perspective",
                genres: ["Science Fiction", "Literary Fiction"],
                themes: ["Artificial Intelligence", "Philosophy", "Coming-of-Age", "Love"],
                keywords: ["sci-fi", "ai", "robot", "philosophy", "future", "love"],
                rating: 4.0
            },
            {
                title: "The Guest List",
                author: "Lucy Foley",
                reason: "Gripping psychological thriller with multiple perspectives and dark secrets",
                genres: ["Thriller", "Mystery"],
                themes: ["Psychological", "Wedding", "Multiple POV", "Secrets"],
                keywords: ["thriller", "wedding", "secrets", "murder", "island", "psychological"],
                rating: 4.1
            },
            {
                title: "Homegoing",
                author: "Yaa Gyasi",
                reason: "Multigenerational saga exploring family, history, and identity",
                genres: ["Historical Fiction", "Literary Fiction"],
                themes: ["Family Saga", "African History", "Identity", "Slavery"],
                keywords: ["historical", "family", "africa", "generations", "slavery", "identity"],
                rating: 4.4
            },
            {
                title: "The Song of Achilles",
                author: "Madeline Miller",
                reason: "Beautifully written retelling of Greek mythology with emotional depth",
                genres: ["Fantasy", "Historical Fiction"],
                themes: ["Mythology", "Love", "War", "Greek Myths"],
                keywords: ["mythology", "greek", "achilles", "love", "war", "beautiful"],
                rating: 4.4
            },
            {
                title: "Anxious People",
                author: "Fredrik Backman",
                reason: "Heartwarming story about human connection and the struggles we all face",
                genres: ["Contemporary Fiction", "Humor"],
                themes: ["Mental Health", "Human Connection", "Family", "Forgiveness"],
                keywords: ["anxiety", "people", "humor", "heart", "connection", "family"],
                rating: 4.2
            },
            {
                title: "The Vanishing Half",
                author: "Brit Bennett",
                reason: "Powerful exploration of identity, family, and the choices that define us",
                genres: ["Literary Fiction", "Historical Fiction"],
                themes: ["Identity", "Family", "Race", "Choices"],
                keywords: ["identity", "twins", "race", "family", "choices", "powerful"],
                rating: 4.3
            },
            {
                title: "Mexican Gothic",
                author: "Silvia Moreno-Garcia",
                reason: "Atmospheric gothic horror with feminist themes and beautiful prose",
                genres: ["Horror", "Gothic"],
                themes: ["Feminism", "Gothic Horror", "Mexican Culture", "Family"],
                keywords: ["gothic", "horror", "mexican", "atmospheric", "feminist", "dark"],
                rating: 4.1
            },
            {
                title: "The Atlas Six",
                author: "Olivie Blake",
                reason: "Dark academia fantasy with complex characters and magical realism",
                genres: ["Fantasy", "Dark Academia"],
                themes: ["Academia", "Magic", "Power", "Competition"],
                keywords: ["fantasy", "academia", "magic", "dark", "competition", "power"],
                rating: 3.9
            },
            {
                title: "Beartown",
                author: "Fredrik Backman",
                reason: "Intense drama about a small town, hockey, and the impact of violence",
                genres: ["Contemporary Fiction", "Drama"],
                themes: ["Community", "Violence", "Sports", "Morality"],
                keywords: ["hockey", "town", "community", "violence", "intense", "drama"],
                rating: 4.3
            },
            {
                title: "The House in the Cerulean Sea",
                author: "TJ Klune",
                reason: "Whimsical fantasy about found family, acceptance, and magical beings",
                genres: ["Fantasy", "LGBTQ Literature"],
                themes: ["Found Family", "Acceptance", "Magic", "Love"],
                keywords: ["fantasy", "family", "magic", "acceptance", "whimsical", "love"],
                rating: 4.4
            },
            {
                title: "Project Hail Mary",
                author: "Andy Weir",
                reason: "Science fiction adventure with humor, heart, and scientific problem-solving",
                genres: ["Science Fiction", "Adventure"],
                themes: ["Science", "Problem-Solving", "Friendship", "Sacrifice"],
                keywords: ["science", "space", "problem", "adventure", "friendship", "humor"],
                rating: 4.5
            },
            {
                title: "The Priory of the Orange Tree",
                author: "Samantha Shannon",
                reason: "Epic fantasy with dragons, strong female characters, and rich world-building",
                genres: ["Fantasy", "Epic Fantasy"],
                themes: ["Dragons", "Female Protagonists", "Epic Adventure", "Magic"],
                keywords: ["fantasy", "dragons", "epic", "magic", "adventure", "female"],
                rating: 4.2
            },
            {
                title: "Normal People",
                author: "Sally Rooney",
                reason: "Intimate character study of complex relationships and modern life",
                genres: ["Contemporary Fiction", "Literary Fiction"],
                themes: ["Relationships", "Coming-of-Age", "Class", "Mental Health"],
                keywords: ["relationships", "modern", "complex", "intimate", "class", "youth"],
                rating: 4.0
            }
        ];
    }

    /**
     * Add a new book to the recommendation database
     * @param {Object} book 
     */
    addToDatabase(book) {
        if (this.validateBookEntry(book)) {
            this.recommendationDatabase.push(book);
            console.log(`📚 Added "${book.title}" to recommendation database`);
        }
    }

    /**
     * Validate book entry for database
     * @param {Object} book 
     * @returns {boolean}
     */
    validateBookEntry(book) {
        const required = ['title', 'author', 'reason', 'genres', 'themes', 'keywords'];
        return required.every(field => book[field] && book[field].length > 0);
    }

    /**
     * Get database statistics
     * @returns {Object}
     */
    getDatabaseStats() {
        const genreCounts = new Map();
        const authorCounts = new Map();
        
        this.recommendationDatabase.forEach(book => {
            book.genres.forEach(genre => {
                genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
            });
            authorCounts.set(book.author, (authorCounts.get(book.author) || 0) + 1);
        });
        
        return {
            totalBooks: this.recommendationDatabase.length,
            genreDistribution: Object.fromEntries(genreCounts),
            authorCounts: Object.fromEntries(authorCounts),
            averageRating: this.recommendationDatabase
                .filter(book => book.rating)
                .reduce((sum, book) => sum + book.rating, 0) / 
                this.recommendationDatabase.filter(book => book.rating).length
        };
    }
}

// Export singleton instance
const recommendationManager = new RecommendationManager();
export default recommendationManager;