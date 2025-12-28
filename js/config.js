// ========================================
// Configuration - Change these for your deployment
// ========================================

const CONFIG = {
    // Backend API URL (Railway, Render, or your own server)
    API_BASE: 'https://translation-server-production-d487.up.railway.app',
    
    // WebSocket URL (same as API but with wss://)
    WS_BASE: 'wss://translation-server-production-d487.up.railway.app',
    
    // App version
    VERSION: '2.1.0',
    
    // Feature flags
    FEATURES: {
        VIDEO_ENABLED: true,
        VOICE_ENABLED: false,  // Coming soon
        AUTH_ENABLED: true
    }
};

// Language definitions
const LANGUAGES = {
    'en': { name: 'English', flag: '🇺🇸' },
    'zh': { name: 'Chinese', flag: '🇨🇳' },
    'es': { name: 'Spanish', flag: '🇪🇸' },
    'fr': { name: 'French', flag: '🇫🇷' },
    'de': { name: 'German', flag: '🇩🇪' },
    'ja': { name: 'Japanese', flag: '🇯🇵' },
    'ko': { name: 'Korean', flag: '🇰🇷' },
    'pt': { name: 'Portuguese', flag: '🇵🇹' },
    'it': { name: 'Italian', flag: '🇮🇹' },
    'ru': { name: 'Russian', flag: '🇷🇺' },
    'ar': { name: 'Arabic', flag: '🇸🇦' },
    'hi': { name: 'Hindi', flag: '🇮🇳' },
    'tr': { name: 'Turkish', flag: '🇹🇷' },
    'nl': { name: 'Dutch', flag: '🇳🇱' },
    'pl': { name: 'Polish', flag: '🇵🇱' },
    'vi': { name: 'Vietnamese', flag: '🇻🇳' },
    'th': { name: 'Thai', flag: '🇹🇭' },
    'fa': { name: 'Persian', flag: '🇮🇷' }
};

// Export for use in other files
window.CONFIG = CONFIG;
window.LANGUAGES = LANGUAGES;
