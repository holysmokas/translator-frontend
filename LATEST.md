# Mamnoon.ai - Latest Documentation
**Last Updated:** January 6, 2025

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
| **Email** | Resend (invites + signup notifications) |
| **Signup Tracking** | Google Sheets webhook |

### Database Schema (Supabase)

```
profiles          - User profiles, subscription tier, Stripe customer ID, personal_room_code, pending_plan
sessions          - Room sessions (active/ended)
usage             - Monthly usage tracking per user
pending_invites   - Email invites waiting to be accepted
tier_limits       - Plan configuration (rooms, minutes, participants)
```

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
- [x] Real-time speech-to-text translation (42+ languages)
- [x] Video calling with Daily.co integration
- [x] Text chat with translation
- [x] Subtitle overlay on video
- [x] Unified conversation sidebar (voice 🎤 + text 💬)
- [x] Transcript export (TXT + JSON)
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
- [x] Language selection prompt before actions

### Payments & Billing
- [x] Stripe Checkout integration
- [x] Subscription management
- [x] Billing portal access
- [x] Webhook handling (subscription lifecycle)
- [x] Plan selection from landing page → signup → checkout flow
- [x] `pending_plan` stored for post-verification checkout redirect

### Invite System
- [x] Pre-invite flow (send before starting room)
- [x] Resend email integration for invite emails
- [x] Invite link with room code
- [x] Pending invites dashboard
- [x] Share via WhatsApp, Telegram, Copy Link, Calendar
- [x] Cancel invite properly deletes pending reservation

### Admin & Tracking
- [x] Google Sheets webhook for signup logging
- [x] Resend email notification on new signups (to holysmokasthatscheap@gmail.com)
- [x] Signup captures: name, email, selected plan, timestamp

### Legal & Compliance
- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Cookie Policy page
- [x] GDPR Compliance page
- [x] Footer links on landing page

### Mobile Responsive (NEW - Jan 6)
- [x] Mobile navigation with hamburger menu
- [x] Responsive hero section
- [x] Mobile-friendly app dashboard with slide-out sidebar
- [x] Touch-friendly controls (44px min touch targets)
- [x] Mobile room UI with stacked video/chat
- [x] Pseudo-fullscreen for iOS (native fullscreen not supported on iPhone)
- [x] Mobile account page with back button
- [x] Responsive pricing cards
- [x] Landscape orientation handling

---

## 🔧 Recent Updates (January 5-6, 2025)

### January 6, 2025
1. **Mobile Responsive Design** - Full mobile support added
2. **Resend Email Migration** - Replaced EmailJS with Resend for all emails
3. **Language Selection Flow** - Users now choose language before Create Invite/Quick Start/Join Room
4. **Invite Flow Fixes** - Cancel properly deletes reservation, form closes after sending
5. **Personal Room Fix** - Rooms now persist after server restart
6. **Pseudo-Fullscreen** - iOS-compatible fullscreen mode
7. **Account Page** - Added mobile back button

### January 5, 2025
1. **Signup flow fixed** - Plan parameter captured from URL
2. **Login redirect** - Users with `pending_plan` auto-redirect to checkout
3. **Legal pages** - Privacy, Terms, Cookies, GDPR
4. **Google Sheets logging** - Captures actual plan selection

---

## 📁 File Structure

### Frontend (`translator-frontend/`)
```
├── index.html          # Landing page
├── app.html            # Main application (dashboard + room)
├── login.html          # Login page
├── signup.html         # Signup page
├── pricing.html        # Pricing page
├── join.html           # Guest join page
├── checkout.html       # Post-checkout redirect
├── account.html        # Account settings
├── forgot-password.html
├── privacy.html        # Privacy Policy
├── terms.html          # Terms of Service
├── cookies.html        # Cookie Policy
├── gdpr.html           # GDPR Compliance
├── css/
│   └── style.css       # All styles (~2400 lines)
├── js/
│   ├── config.js       # API URLs only (no secrets)
│   └── app.js          # Main application logic (~3000 lines)
└── LATEST.md           # This document
```

### Backend (`translator-api/`)
```
├── main.py             # FastAPI application (~1600 lines)
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
RESEND_API_KEY=
```

### Frontend (config.js)
```javascript
const CONFIG = {
    API_BASE: 'https://translation-server-production-d487.up.railway.app',
    WS_BASE: 'wss://translation-server-production-d487.up.railway.app',
    VERSION: '2.3.0'
};
```

---

## 🚀 Deployment Process

### Frontend (GitHub Pages)
```bash
cd translator-frontend
git add .
git commit -m "Description of changes"
git push origin main
# Auto-deploys to GitHub Pages → mamnoon.ai
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

## 📱 ROADMAP: What's Next

### ✅ Phase 1: Mobile-Responsive Web - COMPLETE
- Responsive CSS for all screen sizes
- Touch-friendly controls
- Mobile room UI
- Works on iOS Safari and Android Chrome

### ⬅️ Phase 2: Progressive Web App (PWA) - NEXT UP
Convert to installable app (1-2 hours):
- `manifest.json` - App metadata, icons, colors
- Service Worker - Caching & offline support
- App icons (multiple sizes)
- "Add to Home Screen" prompt
- App-like experience without app store

**What users get:**
- Install icon on home screen
- Launches without browser chrome
- Works offline (basic features)
- Push notification ready

### Phase 3: Native iOS App (Capacitor)
Wrap web app in native shell for App Store:
- Apple Developer Account required ($99/year)
- Capacitor wraps existing code (90% reuse)
- Native camera/mic permissions
- Push notifications
- Apple Pay for subscriptions

**Free testing available:**
- Xcode Simulator (no device needed)
- Personal device testing (7-day limit, your phone only)
- TestFlight requires $99 subscription

### Phase 4: React Migration
Rewrite frontend in React for:
- Better code organization
- Component reusability
- Easier testing
- Larger developer pool
- Foundation for React Native mobile app

---

## 🎯 Business Strategy

### Competitive Positioning
- **Standalone platform** - Not a plugin for Zoom/Meet
- **Guest join via link** - Zero friction, no app install
- **Simple pricing** - Clear tiers vs per-minute billing
- **Speed to market** - Ship while competitors fundraise

### Key Competitors
| Company | Funding | Focus |
|---------|---------|-------|
| Talo AI | YC-backed | Video call translation |
| EzDubs | Acquired by Cisco | Voice-preserving translation |
| Sanas | $100M+ | Accent translation |
| DeepL Voice | $300M | Enterprise meetings |
| Google Meet | Google | Native translation |

### Market Size
- Language services: $76.8B (2025) → $98.1B (2028)
- Translation software: $62B → $96.5B (2033)
- Real-time translation: $1.2B → $3.5B (2033), 12.9% CAGR

---

## 📊 Tracking & Analytics

### Google Sheets Signup Log
- Webhook captures all signups
- Columns: Timestamp, Name, Email, Plan, Source

### Resend Email Notifications
- Signup notifications to: holysmokasthatscheap@gmail.com
- Invite emails from: noreply@mamnoon.ai

---

## 🐛 Known Issues / TODO

### Bugs
- [ ] None currently tracked

### Features to Add
- [ ] PWA support (next up)
- [ ] iOS app (Capacitor)
- [ ] Android app
- [ ] Push notifications
- [ ] Usage analytics dashboard
- [ ] Admin panel
- [ ] Team management (Business tier)
- [ ] SSO/SAML (Enterprise tier)

### Nice to Have
- [ ] Voice cloning (preserve speaker's voice)
- [ ] Recording & playback
- [ ] Calendar integration
- [ ] Slack/Teams integration
- [ ] Custom branding (Enterprise)

---

## 📝 Changelog

### January 6, 2025
- Complete mobile responsive design
- Migrated from EmailJS to Resend for all emails
- Language selection flow before actions
- Fixed invite flow (cancel deletes reservation, closes on send)
- Fixed personal room persistence after server restart
- Added pseudo-fullscreen for iOS
- Added back button on mobile account page
- Cleaned up config.js (removed EmailJS variables)

### January 5, 2025
- Added legal pages (Privacy, Terms, Cookies, GDPR)
- Fixed signup → checkout flow with `pending_plan`
- Added Google Sheets signup tracking
- Fixed plan capture from landing page
- Updated Stripe price IDs for production
- Created initial documentation

---

*This document should be updated with each significant change to the platform.*
