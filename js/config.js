// ========================================
// Mamnoon.ai Configuration
// ========================================

const CONFIG = {
    API_BASE: 'https://translation-server-production-d487.up.railway.app',
    WS_BASE: 'wss://translation-server-production-d487.up.railway.app',
    VERSION: '2.2.0'
};

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

window.CONFIG = CONFIG;
window.LANGUAGES = LANGUAGES;
