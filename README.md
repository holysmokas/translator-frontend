# 🌍 Real-Time Translator - Frontend

A beautiful, responsive frontend for the Real-Time Translator application.

## Features

- 🗣️ 18+ languages supported
- ⚡ Real-time translation
- 🎥 Video chat integration
- 🔒 Private room codes
- 📱 Fully responsive design

## Quick Start

1. Clone this repo
2. Update `js/config.js` with your backend URL
3. Deploy to GitHub Pages, Vercel, or any static host

## Configuration

Edit `js/config.js` to point to your backend:

```javascript
const CONFIG = {
    API_BASE: 'https://your-backend-url.com',
    WS_BASE: 'wss://your-backend-url.com',
    // ...
};
```

## Deployment

### GitHub Pages

1. Go to repo Settings → Pages
2. Set source to "main" branch
3. Your site will be at `https://username.github.io/translator-frontend/`

### Vercel / Netlify

Just connect your repo - it's static HTML/CSS/JS, no build step needed.

## File Structure

```
translator-frontend/
├── index.html          # Main app page
├── css/
│   └── style.css       # All styles
├── js/
│   ├── config.js       # Configuration (API URLs)
│   └── app.js          # Main application logic
└── README.md
```

## License

MIT
# translator-frontend
# translator-frontend
# translator-frontend
