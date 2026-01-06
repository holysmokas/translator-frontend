// ========================================
// Mamnoon.ai Configuration
// ========================================

const CONFIG = {
    API_BASE: 'https://translation-server-production-d487.up.railway.app',
    WS_BASE: 'wss://translation-server-production-d487.up.railway.app',
    VERSION: '2.3.0'
};

const LANGUAGES = {
    'en': { name: 'English', flag: '🇺🇸' },
    'zh': { name: 'Chinese (Simplified)', flag: '🇨🇳' },
    'zh-TW': { name: 'Chinese (Traditional)', flag: '🇹🇼' },
    'es': { name: 'Spanish', flag: '🇪🇸' },
    'fr': { name: 'French', flag: '🇫🇷' },
    'de': { name: 'German', flag: '🇩🇪' },
    'ja': { name: 'Japanese', flag: '🇯🇵' },
    'ko': { name: 'Korean', flag: '🇰🇷' },
    'pt': { name: 'Portuguese', flag: '🇵🇹' },
    'pt-BR': { name: 'Portuguese (Brazil)', flag: '🇧🇷' },
    'it': { name: 'Italian', flag: '🇮🇹' },
    'ru': { name: 'Russian', flag: '🇷🇺' },
    'ar': { name: 'Arabic', flag: '🇸🇦' },
    'hi': { name: 'Hindi', flag: '🇮🇳' },
    'bn': { name: 'Bengali', flag: '🇧🇩' },
    'pa': { name: 'Punjabi', flag: '🇮🇳' },
    'ta': { name: 'Tamil', flag: '🇮🇳' },
    'te': { name: 'Telugu', flag: '🇮🇳' },
    'mr': { name: 'Marathi', flag: '🇮🇳' },
    'gu': { name: 'Gujarati', flag: '🇮🇳' },
    'ur': { name: 'Urdu', flag: '🇵🇰' },
    'tr': { name: 'Turkish', flag: '🇹🇷' },
    'nl': { name: 'Dutch', flag: '🇳🇱' },
    'pl': { name: 'Polish', flag: '🇵🇱' },
    'uk': { name: 'Ukrainian', flag: '🇺🇦' },
    'cs': { name: 'Czech', flag: '🇨🇿' },
    'sk': { name: 'Slovak', flag: '🇸🇰' },
    'hu': { name: 'Hungarian', flag: '🇭🇺' },
    'ro': { name: 'Romanian', flag: '🇷🇴' },
    'bg': { name: 'Bulgarian', flag: '🇧🇬' },
    'hr': { name: 'Croatian', flag: '🇭🇷' },
    'sr': { name: 'Serbian', flag: '🇷🇸' },
    'sl': { name: 'Slovenian', flag: '🇸🇮' },
    'el': { name: 'Greek', flag: '🇬🇷' },
    'he': { name: 'Hebrew', flag: '🇮🇱' },
    'vi': { name: 'Vietnamese', flag: '🇻🇳' },
    'th': { name: 'Thai', flag: '🇹🇭' },
    'id': { name: 'Indonesian', flag: '🇮🇩' },
    'ms': { name: 'Malay', flag: '🇲🇾' },
    'tl': { name: 'Filipino', flag: '🇵🇭' },
    'fa': { name: 'Persian', flag: '🇮🇷' },
    'sw': { name: 'Swahili', flag: '🇰🇪' },
    'af': { name: 'Afrikaans', flag: '🇿🇦' },
    'da': { name: 'Danish', flag: '🇩🇰' },
    'sv': { name: 'Swedish', flag: '🇸🇪' },
    'no': { name: 'Norwegian', flag: '🇳🇴' },
    'fi': { name: 'Finnish', flag: '🇫🇮' },
    'et': { name: 'Estonian', flag: '🇪🇪' },
    'lv': { name: 'Latvian', flag: '🇱🇻' },
    'lt': { name: 'Lithuanian', flag: '🇱🇹' },
    'ca': { name: 'Catalan', flag: '🇪🇸' },
    'eu': { name: 'Basque', flag: '🇪🇸' },
    'gl': { name: 'Galician', flag: '🇪🇸' }
};

window.CONFIG = CONFIG;
window.LANGUAGES = LANGUAGES;
