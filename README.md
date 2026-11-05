# WhatsCircle — Private Real-Time Group Chat & PWA

WhatsCircle is a real-time, WhatsApp-style group chat web application designed for a private circle of friends. It features **zero sign-up or passwords for regular users**, real-time messaging over WebSockets (Socket.IO), persistent SQLite database storage, full PWA installability, and a protected, rate-limited administrator portal (`/admin`).

---

## 🌟 Key Features

### User Experience (No Registration)
- **Instant Join**: Choose a username (3–20 characters, alphanumeric + underscore). No email, password, or verification code required.
- **Device-Bound Session**: Generates a cryptographically secure random session token stored in `localStorage`. The username remains reserved for that device so nobody else can impersonate them.
- **Leave / Change Name**: Clears the device token, allowing the user to switch identities or disconnect cleanly.
- **Rooms & Direct Messages (DMs)**:
  - Default `#General` room seeded on first boot.
  - Ability to create custom topic rooms (`#Gaming`, `#Trips`, etc.).
  - Private 1-to-1 direct messaging between any circle members.
- **Real-Time Communication (Socket.IO)**:
  - Instant message delivery with optimistic updates and server authoritativeness.
  - Live online/offline presence indicators.
  - "User is typing..." indicators.
  - Message delivery ticks:
    - Single check (`✓`): Sent to server.
    - Double check (`✓✓`): Delivered to recipient or room.
    - Double blue check (`✓✓`): Read by recipient.
- **Rich Chat Interactions**:
  - Floating emoji reactions with counter badges (👍, ❤️, 😂, 😮, 😢, 🙏, 🔥, 🎉 + full emoji picker).
  - Quoted message replies (shows author and quoted preview).
  - Delete own message (replaces content with *"This message was deleted"*).
  - Image sharing (validated PNG/JPEG/GIF/WEBP, up to 5 MB).
- **Notifications & Sounds**:
  - Web Audio API synthesized two-tone chime and send pop (works 100% offline with zero external audio assets).
  - Native browser desktop/mobile push notification support.
  - Unread message counters per room and direct conversation.
- **WhatsApp Design Aesthetic**:
  - WhatsApp emerald color palette (`#00a884`, `#075e54`, `#25d366`, `#128c7e`).
  - Dark mode (`#0c1317`, `#111b21`, `#202c33`) and Light mode (`#efeae2`, `#ffffff`, `#d9fdd3`).
  - Mobile-responsive view switching (chat list sidebar on mobile slides into conversation view with back arrow).
- **Progressive Web App (PWA)**:
  - Installable on desktop (Chromium/Edge) and mobile (Android and iOS Safari).
  - Includes custom icons (192px, 512px, maskable, apple-touch-icon).
  - In-app install button with guided iOS instructions.

### Admin Panel (`/admin`)
- **Completely Separate & Protected**: Accessible exclusively at `/admin` (not linked in the regular user UI).
- **Environment-Driven Credentials**: Username and password configured via `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars. The password is never stored in plaintext and is hashed with `bcrypt`.
- **Security & Rate Limiting**:
  - Failed logins are tracked per IP; after 5 failed attempts, the IP is locked out for 15 minutes.
  - Short-lived JWT session token and `X-Admin-CSRF` token headers for mutating requests.
  - Secure `httpOnly` cookie support.
- **Admin Management Capabilities**:
  - **Dashboard**: Live metrics (total users, online now, messages today, active rooms, total messages).
  - **User Moderation**: View all registered users, last seen timestamp, online status, kick online users, ban/unban with custom reason, rename, or permanently delete.
  - **Message Moderation**: Search messages across all rooms and DMs; delete any objectionable message.
  - **Room Management**: Create rooms, rename, clear room chat history, or delete non-default rooms.
  - **Broadcast**: Dispatch urgent banner announcements to all active users.
  - **Circle Settings**: Toggle new user joins on/off, set an optional circle invite code, adjust max upload limit (MB), and configure a banned-words list that automatically censors matches.
  - **Activity Logs**: Chronological audit log of joins, leaves, kicks, bans, and setting changes.
  - **Chat Export**: Download full circle chat history in CSV or JSON format.

---

## 🏗️ Architecture & Security Model

### 1. How the Username Session Works
1. When a user enters a username on the landing screen, `POST /api/auth/join` is called.
2. The server validates that:
   - Registrations are open (`allowNewUsers` setting).
   - The invite code matches (if configured in settings).
   - The username format matches `/^[a-zA-Z0-9_]{3,20}$/`.
   - The username is unique (case-insensitive: `LOWER(username) = LOWER(?)`).
3. If valid, the server creates the user record in SQLite and issues a cryptographically secure 256-bit random hex session token (`crypto.randomBytes(32).toString('hex')`).
4. The client saves `{ sessionToken, userId, username }` into `localStorage`.
5. On every subsequent visit or page refresh:
   - The client calls `GET /api/auth/verify-session` with `Bearer <token>`.
   - The server verifies the token against SQLite. If valid and not banned, the user immediately enters without any login prompt.
   - Socket.IO establishes a connection passing `{ sessionToken }` in its handshake auth.
6. The user can click **Leave Chat / Change Name** in the settings modal, which notifies the server (`POST /api/auth/leave`), clears `localStorage`, and returns them to the landing screen.

### 2. How Admin Authentication Works
1. `ADMIN_USERNAME` and `ADMIN_PASSWORD` are defined in the environment.
2. On server start, `bcrypt.hash()` hashes `ADMIN_PASSWORD` into memory.
3. When accessing `/admin`, the client submits credentials to `POST /api/admin/login`.
4. The server checks the IP in `admin_login_attempts`:
   - If locked (`locked_until > Date.now()`), request is rejected with `429 Too Many Requests`.
   - If password comparison fails via `bcrypt.compare()`, failed attempts increment. At 5 failures, the IP is locked out for 15 minutes.
5. On successful login, failed attempts are cleared, and a JWT signed with `ADMIN_JWT_SECRET` is issued along with a cryptographic CSRF token.
6. All admin endpoints (`/api/admin/*`) pass through `verifyAdmin` middleware which validates both the JWT and the `x-admin-csrf` header.

---

## 📁 Project Structure

```
├── .env.example              # Environment variables template
├── index.html                # Entry HTML with PWA meta & icons
├── metadata.json             # AI Studio metadata
├── package.json              # Project dependencies & scripts
├── public/
│   ├── apple-touch-icon.png  # iOS Safari home screen icon
│   ├── icon.svg              # Scalable SVG brand mark
│   ├── pwa-192x192.png       # PWA standard 192px icon
│   ├── pwa-512x512.png       # PWA standard 512px icon
│   └── pwa-maskable-512x512.png # PWA Android maskable icon
├── server.ts                 # Full-stack entry: Express + Socket.IO + Vite middleware
├── src/
│   ├── App.tsx               # Main app routing & session bootstrap
│   ├── main.tsx              # React DOM entry point
│   ├── index.css             # Tailwind v4 CSS & WhatsApp styles
│   ├── types/
│   │   └── index.ts          # Unified TypeScript interfaces
│   ├── hooks/
│   │   ├── usePWAInstall.ts  # PWA installation hook
│   │   └── useSound.ts       # Web Audio API chime generator
│   ├── services/
│   │   ├── api.ts            # Client REST API wrapper
│   │   └── socket.ts         # Socket.IO client singleton
│   ├── components/
│   │   ├── LandingJoin.tsx   # "Choose a username" onboarding screen
│   │   ├── ChatLayout.tsx    # WhatsApp dual-pane layout & socket hub
│   │   ├── Sidebar.tsx       # Conversation sidebar with search & tabs
│   │   ├── ChatArea.tsx      # Active chat stream, input, and typing
│   │   ├── MessageBubble.tsx # Message bubble with status ticks & reactions
│   │   ├── EmojiPicker.tsx   # Emoji reaction bar & categorized picker
│   │   ├── NewRoomModal.tsx  # Create extra room modal
│   │   ├── NewChatModal.tsx  # Start 1-on-1 direct message modal
│   │   ├── UserSettingsModal.tsx # Leave name, PWA, sound settings
│   │   ├── PWAInstallButton.tsx  # In-app PWA install trigger & iOS guide
│   │   └── admin/
│   │       └── AdminPortal.tsx   # Protected admin dashboard (/admin)
│   └── server/
│       ├── auth.ts           # Admin bcrypt auth & rate limiting
│       ├── db.ts             # SQLite database layer & seeding
│       └── socket.ts         # Real-time Socket.IO event orchestrator
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite & VitePWA configuration
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+ or 20+
- npm or bun

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default credentials in `.env`:
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=SecretCirclePassword2026!`
- `PORT=3000`

### 3. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000` with Express, Socket.IO, SQLite, and Vite integrated.

### 4. Accessing the App
- **Chat App (User UI)**: Open `http://localhost:3000/` in your browser. Choose any username and start chatting!
- **Admin Portal**: Open `http://localhost:3000/admin` in your browser. Log in using your configured admin credentials.

---

## 🚢 Production Deployment

WhatsCircle is self-contained and runs as a full-stack Node.js server.

### Deploying to Railway
1. Push your repository to GitHub.
2. In Railway, click **New Project** > **Deploy from GitHub repo**.
3. In Railway **Variables**, set:
   - `ADMIN_USERNAME`: Your chosen admin username
   - `ADMIN_PASSWORD`: A strong secret password
   - `ADMIN_JWT_SECRET`: A long random secret string
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
4. Set Build Command: `npm run build`
5. Set Start Command: `npm run start`

### Deploying to Render
1. Create a new **Web Service** on Render connected to your repository.
2. Set **Environment**: `Node`.
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `npm run start`
5. Under **Disks**, add a persistent disk mounted at `/data` with `DATABASE_PATH=/data/whatscircle.db` to keep chat history persisted across restarts.
6. Add your `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the **Environment Variables** tab.

### Deploying to VPS (Docker / PM2)
```bash
npm install
npm run build
pm2 start server.ts --name whatscircle --interpreter tsx
```

---

## 🛡️ Security Features
- **Rate-Limiting**: Chat messages are throttled to 5 messages per 3 seconds per user to prevent spam attacks.
- **Admin Protection**: Admin logins lock out after 5 consecutive failed attempts for 15 minutes.
- **Input Sanitization**: Content is validated, stripped of harmful scripts, and checked against the banned-words filter.
- **File Validation**: Image uploads are validated server-side for MIME type (PNG, JPEG, GIF, WEBP) and file size (default 5 MB maximum).
- **SQL Injection Prevention**: All database queries use parameterized prepared statements in `better-sqlite3`.
