# Mamnoon.ai - Latest Documentation
**Last Updated:** January 5, 2025

---

## 🎯 Product Overview

**Mamnoon.ai** is a real-time translation platform for video calls. Users can speak in their native language and others see/hear the translation instantly. Built for global communication across business, healthcare, legal, government, and personal use cases.

**Live URLs:**
- Frontend: https://mamnoon.ai
- Backend API: https://translation-server-production-d487.up.railway.app
- GitHub Frontend: https://github.com/holysmokas/translator-frontend
- GitHub Backend: https://github.com/holysmokas/translator-api

---

## 🏗️ Current Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla HTML/CSS/JS (no framework) |
| **Backend** | Python FastAPI on Railway |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **Payments** | Stripe (subscriptions) |
| **Video** | Daily.co WebRTC |
| **Translation** | Azure Translator API |
| **Speech-to-Text** | Azure Speech SDK |
| **Email (Invites)** | EmailJS |
| **Signup Tracking** | Google Sheets webhook |

### Database Schema (Supabase)

```
profiles          - User profiles, subscription tier, Stripe customer ID
sessions          - Room sessions (active/ended)
usage             - Monthly usage tracking per user
pending_invites   - Email invites waiting to be accepted
tier_limits       - Plan configuration (rooms, minutes, participants)
```

**Note:** `pending_plan` column added to `profiles` for checkout flow after signup.

---

## 💰 Pricing Tiers

| Tier | Price | Rooms/Month | Session Length | Participants | Personal Room |
|------|-------|-------------|----------------|--------------|---------------|
| **Trial** | Free | 1 | 15 min | 2 | ❌ |
| **Starter** | $59/mo | 15 | 60 min | 2 | ❌ |
| **Professional** | $179/mo | 50 | 2 hours | 10 | ✅ |
| **Business** | $499/mo | 150 | 4 hours | 10 | ✅ |
| **Enterprise** | $1,199/mo | Unlimited | Unlimited | Unlimited | ✅ |

### Stripe Price IDs (Production)
```
Starter:      price_1SjGhoBBOVyvZcr49Tx6MkcD
Professional: price_1SjGijBBOVyvZcr4cVVLgXRJ
Business:     price_1SmAU7BBOVyvZcr4LSZFJ5iJ
Enterprise:   price_1SjGjgBBOVyvZcr43pGNnxA3
```

---

## ✅ Features Completed

### Core Functionality
- [x] Real-time speech-to-text translation (42 languages)
- [x] Video calling with Daily.co integration
- [x] Text chat with translation
- [x] Subtitle overlay on video (translated text only)
- [x] Unified conversation sidebar (voice 🎤 + text 💬 messages)
- [x] Transcript export (TXT + JSON for AI training)
- [x] Guest join via link (no account needed)

### User Management
- [x] Email/password authentication (Supabase)
- [x] Email verification required
- [x] Password reset flow
- [x] User profiles with subscription status
- [x] Usage tracking (rooms used per month)

### Room Features
- [x] Create room with invite flow
- [x] Quick start (no invite)
- [x] Join room by code
- [x] Personal meeting rooms (permanent links for paid users)
- [x] Room history in sidebar
- [x] Active session recovery (rejoin after disconnect)
- [x] Host controls (mute all, lock room, remove participant)
- [x] Participant list with languages shown

### Payments & Billing
- [x] Stripe Checkout integration
- [x] Subscription management
- [x] Billing portal access
- [x] Webhook handling (subscription lifecycle)
- [x] Plan selection from landing page → signup → checkout flow
- [x] `pending_plan` stored for post-verification checkout redirect

### Invite System
- [x] Pre-invite flow (send before room created)
- [x] EmailJS integration for invite emails
- [x] Invite link with room code
- [x] Pending invites dashboard

### Admin & Tracking
- [x] Google Sheets webhook for signup logging
- [x] Signup captures: name, email, selected plan, timestamp
- [x] EmailJS notification on new signups

### Legal & Compliance
- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Cookie Policy page
- [x] GDPR Compliance page
- [x] Footer links on landing page

### UI/UX
- [x] Dark theme throughout
- [x] Fullscreen mode with controls visible
- [x] Mute all toggle (state preserved)
- [x] Ghost participant cleanup on room start
- [x] Page reload on session end (clean state)
- [x] Back to home links on auth pages
- [x] "Create My Meeting Room" button for paid users without one

---

## 🔧 Recent Fixes (January 5, 2025)

1. **Signup flow fixed** - Plan parameter captured from URL, stored as `pending_plan`
2. **Login redirect** - Users with `pending_plan` auto-redirect to Stripe checkout
3. **Success message** - Signup confirmation now displays properly
4. **Google Sheets logging** - Now captures actual selected plan (not always "trial")
5. **Session end UI** - Page reloads cleanly instead of broken state
6. **Rejoin button** - Added to active sessions in room history

---

## 📁 File Structure

### Frontend (`translator-frontend/`)
```
├── index.html          # Landing page
├── app.html            # Main application (dashboard + room)
├── login.html          # Login page
├── signup.html         # Signup page (captures plan from URL)
├── pricing.html        # Pricing page (for logged-in users)
├── join.html           # Guest join page
├── checkout.html       # Post-checkout redirect
├── account.html        # Account settings
├── forgot-password.html
├── privacy.html        # Privacy Policy
├── terms.html          # Terms of Service
├── cookies.html        # Cookie Policy
├── gdpr.html           # GDPR Compliance
├── css/
│   └── style.css       # All styles
├── js/
│   ├── config.js       # API URLs, EmailJS config
│   └── app.js          # Main application logic (~2900 lines)
└── LATEST.md           # This document
```

### Backend (`translator-api/`)
```
├── main.py             # FastAPI application (~1500 lines)
├── requirements.txt    # Python dependencies
├── Procfile           # Railway deployment
├── runtime.txt        # Python version
└── app/
    └── services/
        ├── auth.py           # Supabase authentication
        ├── database.py       # Database operations
        ├── stripe_service.py # Payment processing
        ├── video.py          # Daily.co integration
        ├── translation.py    # Azure Translator
        ├── speech.py         # Azure Speech SDK
        └── room_manager.py   # WebSocket room management
```

---

## 🔑 Environment Variables

### Backend (Railway)
```
SUPABASE_URL=
SUPABASE_KEY=
DAILY_API_KEY=
AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_REGION=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Frontend (config.js)
```javascript
CONFIG = {
    API_BASE: 'https://translation-server-production-d487.up.railway.app',
    WS_BASE: 'wss://translation-server-production-d487.up.railway.app',
    EMAILJS_PUBLIC_KEY: '...',
    EMAILJS_SERVICE_ID: '...',
    EMAILJS_TEMPLATE_ID: '...',
    EMAILJS_TEMPLATE_SIGNUP: '...'
}
```

---

## 🚀 Deployment Process

### Frontend (GitHub Pages)
```bash
cd translator-frontend
git add .
git commit -m "Description of changes"
git push origin main
# Auto-deploys to GitHub Pages
```

### Backend (Railway)
```bash
cd translator-api
git add .
git commit -m "Description of changes"
git push origin main
# Auto-deploys to Railway
```

---

## 📱 ROADMAP: Mobile Strategy

### Phase 1: Mobile-Responsive Web ⬅️ NEXT
Make current web app work beautifully on mobile devices:
- Responsive CSS for all screen sizes
- Touch-friendly buttons and controls
- Mobile-optimized room UI
- Test on iOS Safari and Android Chrome

### Phase 2: Progressive Web App (PWA)
Convert to installable app:
- Service worker for offline caching
- Web app manifest
- "Add to Home Screen" prompt
- App-like experience without app store

### Phase 3: Native iOS App (App Store)
Simple mobile app with core features only:
```
┌─────────────────────────────┐
│      🌍 Mamnoon.ai          │
│                             │
│   [ 🇺🇸 Select Language ▼ ] │
│                             │
│   [ 🎙️ Start Session ]     │
│                             │
│   [ 🚪 Join Session  ]      │
│                             │
│   [ 🔗 My Meeting Room ]    │
│                             │
└─────────────────────────────┘
```

**Technical approach:** Capacitor (wrap existing web app)
- Reuse 90% of existing code
- Native iOS/Android shell
- Access to camera, mic, notifications
- App Store ready

### Phase 4: Enhanced Mobile Features
- Push notifications for invites
- Background audio support
- Apple/Google Pay for subscriptions
- Siri/Google Assistant integration

---

## 🎯 Business Strategy

### Target Market: Entire Landscape
Not niching down - going broad with simple, affordable pricing.

### Competitive Advantages
1. **Standalone platform** - Not a plugin for Zoom/Meet
2. **Guest join via link** - Zero friction, no app install
3. **Simple pricing** - Clear tiers vs confusing per-minute
4. **Speed** - Ship fast while competitors raise funding

### Key Competitors
| Company | Funding | Focus |
|---------|---------|-------|
| Talo AI | YC-backed | Video call translation |
| EzDubs | Acquired by Cisco | Voice-preserving translation |
| Sanas | $100M+ | Accent translation |
| DeepL Voice | $300M | Enterprise meetings |
| Google Meet | Google | Native translation |

### Go-to-Market
1. Product Hunt launch
2. SEO landing pages (/for-healthcare, /for-legal, etc.)
3. Google Ads on translation keywords
4. Content marketing
5. Let customers reveal winning verticals

---

## 📊 Tracking & Analytics

### Google Sheets Signup Log
- Webhook URL: `https://script.google.com/macros/s/AKfycbxwvH9-xXszKBmSKd_XcEHY8Cy-yAU_XXjqGdGXB35yLxuWFcXoZnFX0Sh1NdYCR4iu/exec`
- Columns: Timestamp, Name, Email, Plan, Source

### EmailJS Signup Notifications
- Template sends to: babak@mamnoon.ai
- Includes: user_name, user_email, signup_date, plan

---

## 🐛 Known Issues / TODO

### Bugs to Fix
- [ ] None currently tracked

### Features to Add
- [ ] Mobile responsive design
- [ ] PWA support
- [ ] iOS app (Capacitor)
- [ ] Android app
- [ ] Push notifications
- [ ] Usage analytics dashboard
- [ ] Admin panel
- [ ] Team management (Business tier)
- [ ] SSO/SAML (Enterprise tier)
- [ ] API access for integrations

### Nice to Have
- [ ] Voice cloning (preserve speaker's voice)
- [ ] Recording & playback
- [ ] Calendar integration
- [ ] Slack/Teams integration
- [ ] Custom branding (Enterprise)

---

## 📞 Support & Contact

- **Support Email:** support@mamnoon.ai
- **Privacy/GDPR:** privacy@mamnoon.ai, gdpr@mamnoon.ai
- **Legal:** legal@mamnoon.ai

---

## 📝 Changelog

### January 5, 2025
- Added legal pages (Privacy, Terms, Cookies, GDPR)
- Fixed signup → checkout flow with `pending_plan`
- Added Google Sheets signup tracking
- Added EmailJS signup notifications
- Fixed plan capture from landing page
- UI fixes: session end reload, success messages
- Added rejoin button to room history
- Updated Stripe price IDs for production
- Database purged for fresh start
- Documentation created (this file)

---

*This document should be updated with each significant change to the platform.*
