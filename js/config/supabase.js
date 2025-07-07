// js/config/supabase.js
/**
 * Supabase configuration and initialization
 * Updated with enhanced collaborative features
 */

const SUPABASE_CONFIG = {
    url: 'https://pfozpiskznvdiigqxbdg.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmb3pwaXNrem52ZGlpZ3F4YmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDA1NzQsImV4cCI6MjA2NzQ3NjU3NH0.PV0nz5wXuXjA-GVQcezdnnlnjfAgI-OfXe7v3uMwatA',
    enabled: true
};

class SupabaseManager {
    constructor() {
        this.client = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Supabase client
     * @returns {boolean} Success status
     */
    initialize() {
        if (SUPABASE_CONFIG.enabled && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL') {
            try {
                this.client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
                this.isInitialized = true;
                console.log('✅ Supabase initialized - Real-time collaboration enabled');
                return true;
            } catch (error) {
                console.error('❌ Supabase initialization failed:', error);
                return false;
            }
        } else {
            console.log('📱 Running in local mode - Set up Supabase for collaboration');
            return false;
        }
    }

    /**
     * Check if collaborative features are available
     * @returns {boolean}
     */
    isCollaborativeMode() {
        return this.client !== null && this.isInitialized;
    }

    /**
     * Get Supabase client instance
     * @returns {Object|null}
     */
    getClient() {
        return this.client;
    }

    /**
     * Get configuration for external use
     * @returns {Object}
     */
    getConfig() {
        return { ...SUPABASE_CONFIG };
    }
}

// Export singleton instance
const supabaseManager = new SupabaseManager();
export default supabaseManager;