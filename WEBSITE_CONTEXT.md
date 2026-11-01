# Smart Bus (`kolkata-buses`) — Comprehensive System & Codebase Architecture Context

> **Document Purpose**: This document serves as complete, authoritative context for any AI agent, developer, or engineer working on, extending, or debugging the **Smart Bus** Kolkata public transit web application. It describes what the application does, its architecture, directory structure, data models, frontend state, backend RPC APIs, transit integrations, styling system, and runtime behaviors.

---

## 1. Executive Summary & Purpose

**Smart Bus** is a full-stack, mobile-first, and desktop-optimized transit companion web application engineered specifically for the city of **Kolkata, West Bengal, India**. 

### Primary Objectives
1. **Official WBTC Route Intelligence**: Full cataloging and fast searching of **131 official West Bengal Transport Corporation (WBTC) city bus routes**, scraped directly from official WBTC publications (`wbtconline.in`).
2. **Interactive Transit Map**: A customized Google Maps interface featuring live bus coordinates, simulated real-time vehicle movement across Kolkata's arterial corridors (EM Bypass, AJC Bose Rd, Vidyasagar Setu, Howrah Bridge, VIP Rd), route overlays, traffic layers, transit layers, and user geolocation tracking.
3. **Hybrid Real-Time Architecture**: Built to consume official GTFS-Realtime / Yatri Sathi vehicle position feeds when configured (`WBTC_VEHICLE_FEED_URL`), while gracefully falling back to deterministic, smooth client-side simulation when no live feed is available.
4. **Active Ride Tracking Pipeline ("I've Boarded")**: Allows riders to flag that they have boarded a specific bus, locking map focus onto the vehicle, prioritizing arrival notifications, and keeping state synchronized in the database.
5. **Private Safety Circle ("Close People")**: A transit safety feature allowing authenticated riders to maintain a private group of family or friends (e.g. "Maa", "Arjun"). Members can view each other's boarding statuses (e.g., "Boarded AC-24", "Waiting"), view opt-in live GPS positions on a group map, generate invite tokens, and receive push notifications when a loved one boards a bus.
6. **Live Rider Community Chat**: A crowd-sourced bulletin where commuters post real-time updates tagged with their boarded bus route.
7. **Trip Planner**: Route discovery based on origin, destination, and intermediate stoppage string matching.

---

## 2. Technology Stack & Key Dependencies

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Language** | TypeScript (v5.9.3), ESM (`"type": "module"`) |
| **Frontend Framework** | React 19 (`react`, `react-dom`) |
| **Client Routing** | Single-page layout with tabbed state machine in `Home.tsx` + fallback routes via `wouter` |
| **API Client & State** | tRPC v11 (`@trpc/client`, `@trpc/react-query`) with `@tanstack/react-query` v5 and `superjson` |
| **Styling & Design System** | Tailwind CSS v4 (`@tailwindcss/vite`, `@tailwindcss/typography`, `tw-animate-css`) with custom CSS variables and utility classes in `client/src/index.css` |
| **Component Primitives** | Radix UI primitives (`@radix-ui/react-*`), Lucide Icons (`lucide-react`), Sonner Toasts (`sonner`) |
| **Animation Engine** | Framer Motion (`framer-motion` v12) for smooth marker movements, splash animations, and modals |
| **Map Rendering** | Google Maps JavaScript API (loaded dynamically via proxy loader in `Map.tsx`), supporting `AdvancedMarkerElement`, Traffic, Transit, and dark mode custom styles |
| **Server Framework** | Express 4 (`express`) on Node.js, served via `http.createServer` |
| **API Protocol** | tRPC v11 (`@trpc/server`) with Express adapter mounted at `/api/trpc` |
| **Database & ORM** | MySQL via `mysql2` + Drizzle ORM (`drizzle-orm`, `drizzle-kit`) |
| **Authentication** | OAuth 2.0 / OpenID Connect with CSRF protection (`__Host-oauth_state` nonce cookies and `app_session_id` tokens) |
| **Dev & Bundling** | Vite 7 (`vite`, `@vitejs/plugin-react`), `tsx` watch mode, `esbuild` for server bundles |
| **Testing** | Vitest (`vitest`) |
| **Offline & Push** | Service Worker (`client/public/sw.js`) with Web Push Notification API |

---

## 3. High-Level Architecture & Data Flow

```mermaid
graph TD
    subgraph Client["Frontend Client (React 19 + Vite)"]
        UI["App / Home.tsx (Tab State Machine)"]
        GMap["GoogleKolkataMap (Map.tsx)"]
        TRPC_Client["tRPC Client / React Query"]
        SW["Service Worker (sw.js - Push Alerts)"]
    end

    subgraph Server["Backend Server (Express + tRPC)"]
        ExpressApp["Express Application (server/_core/index.ts)"]
        TRPC_Router["appRouter (server/routers.ts)"]
        OAuthHandler["OAuth Routes (server/_core/oauth.ts)"]
        StorageProxy["Storage / Media Proxy"]
        FeedAdapter["WBTC GTFS/GPS Feed Adapter"]
    end

    subgraph DataStore["Persistence & External Services"]
        MySQL[("MySQL Database (Drizzle ORM)")]
        ExternalFeed["External WBTC / Yatri Sathi GPS Endpoint"]
        GoogleMapsAPI["Google Maps Platform API"]
    end

    UI --> TRPC_Client
    UI --> GMap
    GMap --> GoogleMapsAPI
    TRPC_Client -- "/api/trpc" --> TRPC_Router
    TRPC_Router --> MySQL
    TRPC_Router --> FeedAdapter
    FeedAdapter -. "HTTP Fetch (AbortSignal 8s)" .-> ExternalFeed
    OAuthHandler --> MySQL
    SW -. Push Events .-> UI
```

---

## 4. Complete Directory Structure

```
kolkata-buses/
├── .gitignore
├── .prettierrc
├── package.json               # Root dependencies, build & dev scripts
├── tsconfig.json              # Client TypeScript compiler config
├── tsconfig.node.json         # Node TypeScript compiler config
├── vite.config.ts             # Vite configuration with aliases and Manus debug collector
├── vitest.config.ts           # Vitest configuration for unit tests
├── drizzle.config.ts          # Drizzle kit migrations & schema configuration
├── SMART_BUS_RESEARCH.md      # Research notes on WBTC routes, GTFS-RT, and pilot programs
│
├── client/                    # Frontend source code
│   ├── index.html             # HTML entry point (meta tags, fonts, root div)
│   ├── public/
│   │   ├── sw.js              # Service Worker for push notification handling
│   │   └── __manus__/         # Runtime debug hooks
│   └── src/
│       ├── main.tsx           # Client entrypoint: QueryClient, tRPC client, auth redirects
│       ├── App.tsx            # Root component with Sonner Toaster, TooltipProvider, ErrorBoundary
│       ├── const.ts           # Client-side OAuth startLogin() and session constants
│       ├── index.css          # Comprehensive design system, dark/light variables, glassmorphic UI
│       ├── wbtc-routes.ts     # 131 official WBTC city bus routes with origins, destinations, stops
│       ├── _core/
│       │   └── hooks/
│       │       └── useAuth.ts # Authentication hook (me query, logout mutation, login trigger)
│       ├── components/
│       │   ├── AIChatBox.tsx  # Extensible AI chat UI component with streaming support
│       │   ├── DashboardLayout.tsx # Template dashboard layout with sidebar & header
│       │   ├── DashboardLayoutSkeleton.tsx # Skeleton placeholder for dashboard
│       │   ├── ErrorBoundary.tsx # React error boundary catching render crashes
│       │   ├── ManusDialog.tsx # Feedback / issue reporting dialog
│       │   ├── Map.tsx        # Interactive Google Maps component for Kolkata
│       │   └── ui/            # Radix UI + Tailwind component library (buttons, inputs, dialogs, etc.)
│       ├── contexts/
│       │   └── ThemeContext.tsx # Context for managing theme state
│       ├── hooks/
│       │   ├── useComposition.ts # Handles IME composition for Asian text inputs
│       │   ├── useMobile.tsx  # Responsive screen width detection hook
│       │   └── usePersistFn.ts # Memoized persistent function references
│       ├── lib/
│       │   ├── trpc.ts        # createTRPCReact<AppRouter>() instance
│       │   └── utils.ts       # Utility helper: clsx + twMerge (cn)
│       └── pages/
│           ├── Home.tsx       # Main transit application (all 7 tabs, map view, sidebar, state)
│           ├── ComponentShowcase.tsx # Catalog of Radix / Tailwind UI components
│           └── NotFound.tsx   # 404 error page
│
├── server/                    # Backend server source code
│   ├── index.ts               # Standalone production static server entrypoint
│   ├── routers.ts             # Primary tRPC appRouter definitions
│   ├── db.ts                  # Database queries and mutations using Drizzle ORM
│   ├── storage.ts             # S3 / cloud storage upload and signed URL utilities
│   ├── smartbus.test.ts       # Automated unit tests for public transit & group routers
│   ├── auth.logout.test.ts    # Automated test verifying cookie clearing on logout
│   └── _core/
│       ├── index.ts           # Primary Express server entrypoint (dev & prod)
│       ├── context.ts         # tRPC context generator (extracts auth user from cookie/bearer)
│       ├── trpc.ts            # tRPC router and procedure helpers (publicProcedure, protectedProcedure)
│       ├── env.ts             # Environment variable parser
│       ├── cookies.ts         # Secure cookie serialization helpers
│       ├── oauth.ts           # OAuth callback handler and session token issuer
│       ├── sdk.ts             # Authentication SDK client for token validation
│       ├── systemRouter.ts    # Health check and admin notification router
│       ├── storageProxy.ts    # Local storage proxy endpoint
│       ├── vite.ts            # Vite dev middleware server configuration
│       ├── llm.ts             # Server-side LLM invocation wrapper
│       ├── imageGeneration.ts # Image generation wrapper
│       ├── notification.ts    # Notification dispatching utilities
│       ├── voiceTranscription.ts # Audio transcription utilities
│       └── heartbeat.ts       # Health monitoring and status reporting
│
├── shared/                    # Code shared across client and server
│   ├── const.ts               # Cookie names, session durations, error messages, OAuth state encode/decode
│   ├── types.ts               # Shared TypeScript type declarations
│   └── _core/                 # Shared core constants and helpers
│
└── drizzle/                   # Database schemas and migration files
    ├── schema.ts              # Drizzle table definitions: users, profiles, boardings, messages, contacts
    ├── relations.ts           # Schema relations
    ├── 0000_*.sql             # Initial Drizzle SQL migration
    └── 0001_*.sql             # Migration adding location sharing and contact tables
```

---

## 5. Database Schema & Data Models

The database uses **MySQL**, managed via **Drizzle ORM** (`drizzle/schema.ts`).

### Tables Overview

```mermaid
erDiagram
    users ||--o| userProfiles : "has"
    users ||--o{ boardingSessions : "boards"
    users ||--o{ communityMessages : "posts"
    users ||--o{ pushSubscriptions : "registers"
    users ||--o{ closeContacts : "owns"

    users {
        int id PK
        varchar openId UK
        text name
        varchar email
        varchar loginMethod
        enum role "user | admin"
        timestamp createdAt
        timestamp updatedAt
        timestamp lastSignedIn
    }

    userProfiles {
        int id PK
        int userId FK
        varchar displayName
        varchar homeStop
        enum preferredTheme "light | dark"
        int notificationsEnabled "0 or 1"
        timestamp createdAt
        timestamp updatedAt
    }

    boardingSessions {
        int id PK
        int userId FK
        varchar route
        varchar vehicleId
        varchar boardedStop
        varchar destinationStop
        enum status "active | completed"
        timestamp boardedAt
        timestamp completedAt
    }

    communityMessages {
        int id PK
        int userId FK
        varchar route
        text body
        timestamp createdAt
    }

    pushSubscriptions {
        int id PK
        int userId FK
        varchar endpoint UK
        text p256dh
        text auth
        timestamp createdAt
    }

    closeContacts {
        int id PK
        int userId FK
        varchar displayName
        varchar email
        varchar relation
        varchar route
        enum boardingStatus "unknown | waiting | boarded"
        double lat
        double lng
        int locationSharing "0 or 1"
        timestamp createdAt
        timestamp updatedAt
    }
```

### Schema Details (`drizzle/schema.ts`)
1. **`users`**:
   - `id`: Auto-incrementing primary key.
   - `openId`: Unique string identifier from OAuth provider.
   - `name`, `email`, `loginMethod`: Profile attributes.
   - `role`: `'user' | 'admin'` (defaults to `'user'`, owner matches `ENV.ownerOpenId`).
   - Timestamps: `createdAt`, `updatedAt`, `lastSignedIn`.

2. **`userProfiles`**:
   - `userId`: References `users.id`.
   - `displayName`: Custom display name for rider.
   - `homeStop`: User's primary boarding stop (e.g., "Esplanade", "Garia", "Salt Lake").
   - `preferredTheme`: `'light' | 'dark'` (default `'dark'`).
   - `notificationsEnabled`: Integer flag (`1` or `0`).

3. **`boardingSessions`**:
   - Records when a user taps "I've boarded".
   - `status`: `'active' | 'completed'`.
   - When a new ride starts, existing active rides for that user are marked `'completed'`.
   - Stores `route`, `vehicleId`, `boardedStop`, `destinationStop`, `boardedAt`, `completedAt`.

4. **`communityMessages`**:
   - Rider crowd-sourced updates.
   - Stores message `body`, optional tagged `route` (e.g. "AC-24"), and foreign key `userId`.
   - Left-joined with `users` to display author `userName`.

5. **`pushSubscriptions`**:
   - Stores W3C Web Push endpoint URLs, `p256dh` public key, and `auth` secret for background notifications.

6. **`closeContacts`**:
   - Represents a member in the rider's private safety circle.
   - `displayName`: e.g., "Maa", "Arjun", "Brother".
   - `relation`: Relationship description.
   - `route`: The bus route the contact is currently riding.
   - `boardingStatus`: `'unknown' | 'waiting' | 'boarded'`.
   - `lat`, `lng`: Real-time coordinates if sharing is active.
   - `locationSharing`: Integer toggle (`1` = sharing consented, `0` = paused).

---

## 6. Backend API (tRPC Routers)

The API is fully type-safe, built with tRPC v11, and mounted at `/api/trpc` in `server/routers.ts`.

### 1. `auth` Router
- **`auth.me`** (`publicProcedure.query`): Returns the current authenticated `User` object from session context, or `null`.
- **`auth.logout`** (`publicProcedure.mutation`): Clears the session cookie (`app_session_id`) and returns `{ success: true }`.

### 2. `transit` Router
- **`transit.snapshot`** (`publicProcedure.query`):
  - Inspects `process.env.WBTC_VEHICLE_FEED_URL`.
  - If not configured, immediately returns `{ source: "not-configured", checkedAt: Date.now(), vehicles: [] }`.
  - If configured, fetches the external feed with an `AbortSignal.timeout(8000)` and `Accept: application/json` headers.
  - Normalizes JSON vehicle objects (accepts keys `lat`, `latitude`, `lng`, `lon`, `longitude`, `bearing`, `speed`, `route_id`, etc.).
  - Filters invalid coordinates and returns `{ source: "official-feed", checkedAt: Date.now(), vehicles: [...] }`.
  - On network or parsing failure, returns `{ source: "error", checkedAt: Date.now(), vehicles: [] }`.

### 3. `profile` Router
- **`profile.get`** (`protectedProcedure.query`): Retrieves the user's `userProfile` record.
- **`profile.save`** (`protectedProcedure.input(profileInput).mutation`): Upserts `displayName`, `homeStop`, `preferredTheme`, and `notificationsEnabled`.

### 4. `boarding` Router
- **`boarding.current`** (`protectedProcedure.query`): Retrieves the user's currently active boarding session.
- **`boarding.board`** (`protectedProcedure.input(...).mutation`): Marks previous active boarding sessions as `completed` and creates a new `active` boarding session.
- **`boarding.complete`** (`protectedProcedure.input({ id }).mutation`): Marks the specified boarding session as `completed`.

### 5. `community` Router
- **`community.list`** (`publicProcedure.input({ route? }).query`): Fetches up to 60 recent messages, optionally filtered by route, joined with user names.
- **`community.send`** (`protectedProcedure.input({ body, route? }).mutation`): Inserts a message (max 500 characters) and returns the created message.

### 6. `push` Router
- **`push.register`** (`protectedProcedure.input({ endpoint, p256dh?, auth? }).mutation`): Saves or updates the user's web push notification subscription.

### 7. `group` Router
- **`group.list`** (`protectedProcedure.query`): Lists all close contacts created by the logged-in user, ordered by `updatedAt DESC`.
- **`group.add`** (`protectedProcedure.input({ displayName, email?, relation? }).mutation`): Creates a new contact with default status `'unknown'` and `locationSharing: 0`.
- **`group.update`** (`protectedProcedure.input({ id, route?, boardingStatus?, lat?, lng?, locationSharing? }).mutation`): Updates a contact's boarding status, route, coordinates, or sharing consent.

### 8. `system` Router (`server/_core/systemRouter.ts`)
- **`system.health`** (`publicProcedure.query`): Returns `{ ok: true }`.
- **`system.notifyOwner`** (`adminProcedure.mutation`): Sends urgent operational alerts to the system administrator.

---

## 7. Frontend Architecture & User Interface

The application is structured as a responsive single-page application in `client/src/pages/Home.tsx` with an application rail on desktop and a bottom navigation bar on mobile.

### Navigation State Machine (`activeTab`)
`Home.tsx` manages view state through seven primary tabs:

```
[ home ]          -> Interactive live map with selected bus inspection, boarding card, and arrival timeline
[ search ]        -> Instant search for active buses and the full 131 WBTC official catalog
[ trip ]          -> Origin/destination trip planner and WBTC route sheet reader
[ community ]     -> Close People safety circle, invite generator, and live rider chat
[ favorites ]     -> Shortlist of bookmarked routes with quickest ETA calculations
[ notifications ] -> Arrival notices, delay alerts, and push permission management
[ settings ]      -> Profile settings, home stop, dark mode toggle, and privacy modals
```

### Tab Descriptions

#### 1. Live Map (`home`)
- **Google Maps Canvas**: Embedded via `GoogleKolkataMap` (`client/src/components/Map.tsx`), centered at Kolkata (`22.5726° N, 88.3639° E`).
- **Real-time Markers**: Custom HTML markers with bus icons, route numbers, and pulse rings. Color-coded per route (e.g. V1: Coral, AC47: Cyan, AC58: Purple, AC35: Amber, AC24: Blue).
- **Movement Simulation & Live Sync**: When no live feed is available, buses smoothly interpolate coordinates across key Kolkata intersections (Esplanade, Park Street, Salt Lake, Howrah, Garia) using `Math.sin`/`Math.cos` over tick intervals. When `transitQuery` receives live vehicles, real GPS positions override the simulation.
- **Map Controls**:
  - `Layers`: Toggles traffic and transit overlays.
  - `One bus` / `All buses`: Switches between focusing exclusively on the active route vs. displaying all live fleet vehicles.
  - `Locate`: Uses HTML5 Geolocation (`navigator.geolocation`) to place a pulsating user marker and pan the map.
  - `Follow this bus`: Keeps the selected bus centered as its coordinates update.
- **Details Panel**:
  - Displays route name, AC status, direction, next stop, ETA countdown, and speed gauge.
  - **Boarding Action**: "I've boarded" button creates an active session on the backend.
  - **Stop-by-Stop Timeline**: Visual progress tracker showing origin, current position, intermediate stops, and terminus.
- **Mobile Bottom Sheet**: On smaller viewports, tapping any bus opens an animated slide-up bottom sheet with quick metrics and tracking actions.

#### 2. Search Buses (`search`)
- Large search input with keyboard shortcut `<kbd>⌘ K</kbd>`.
- Searches across active routes, vehicle locations, and stops.
- Lists active buses with live ETA pills and AC badges.
- Includes the **Official WBTC Route Directory** displaying all 131 routes scraped from `wbtconline.in/wbtc-city-bus-routes`, searchable by origin, destination, or via points.

#### 3. Plan Trip (`trip`)
- Inputs for `From` (Origin) and `To` (Destination).
- Performs instant multi-stop matching across the 131 WBTC routes.
- Clicking any result selects the bus and switches to the live map.
- Includes a WBTC Timetable reference card linking to the official Intra-City Route PDF (`INTRA_CITY_RTS_Latest-small.pdf`).

#### 4. Community & Group (`community`)
- **Private Group ("My close people")**:
  - Allows riders to add trusted contacts (e.g. "Maa", "Arjun").
  - Displays each person's status (`On bus`, `Waiting`, `Unknown`), current route tag, and live location toggle.
  - **Live Group Map**: Embedded Google Map rendering the exact coordinates of group members who consented to location sharing.
  - **Invite Link Generator**: Creates secure tokens (`/join/{token}`) that can be copied or shared via `navigator.share()`.
  - **Boarding Notifications**: Automatically detects when a group member's status changes to `boarded` and fires a desktop notification (`notifyBoarding`).
- **Live Rider Chat**:
  - Route-badged chat room for public commuter advisories.
  - Commuters can type their boarded bus route to badge their messages.
  - Auto-refreshes every 15 seconds.

#### 5. Favorites (`favorites`)
- Bookmarking engine stored in local React state (persisting across route selections).
- Calculates the minimum arrival ETA among all favorited buses.
- Quick cards to jump immediately to any favorited route.

#### 6. Notifications (`notifications`)
- Feed of transit updates (e.g. "V1 arriving in 3 minutes", "AC47 delayed by 8 minutes").
- One-click button to request browser push permissions (`Notification.requestPermission()`).
- Automatically registers the Service Worker push subscription with the backend via `trpc.push.register`.

#### 7. Settings (`settings`)
- Rider profile editor: Display name and home stop.
- Theme switch: Daylight mode (`.light-shell`) vs. Midnight mode (`.dark-shell`).
- Account management: Sign In / Sign Out actions.
- Information dialogs: "About Smart Bus" and "Privacy & Safety" modals.

---

## 8. Transit Data & WBTC Integration

### Official WBTC Route Dataset (`client/src/wbtc-routes.ts`)
The project includes a verified catalog of **131 official WBTC routes** structured as:
```typescript
export type WBTCRoute = {
  sl: number;
  route: string;
  origin: string;
  destination: string;
  stops: string;
};
```
*Examples of routes included*:
- `3`: Dahighat ↔ Sealdah (via Khidderpur, Mominpur, Hazra, Elgin Rd, Park St, Esplanade, Moulali)
- `15`: Ultadanga ↔ Howrah (via Khanna, Hatibagan, Nimtala Ghat, Howrah Bridge)
- `AC-1`: Jadavpur ↔ Howrah (via Prince Anwar Shah Rd, Tollygunge Phari, Hazra, Esplanade)
- `AC-2`: Barasat ↔ Howrah Station (via Airport Gate 1, Teghoria, Kestopur, Ultadanga, Girish Park)
- `AC-4A`: Parnasree ↔ Shapoorji (via New Alipore, Ruby, Nicco Park, Newtown, Unitech)
- `AC-12`: Howrah ↔ Shapoorji (via Rajarhat / Newtown)
- `V1`: Tollygunge ↔ Airport

### Live Vehicle Adapter (`server/routers.ts`)
The server provides a standardized transit adapter designed for Kolkata's expanding GPS vehicle tracking infrastructure:
- Target endpoint specified via `WBTC_VEHICLE_FEED_URL`.
- Accepts either GTFS-Realtime JSON feeds or REST vehicle arrays.
- Adapts attributes:
  - `id`: Unique vehicle identifier.
  - `route`: Route identifier (e.g. "AC-2", "V1").
  - `lat`, `lng`: WGS84 GPS decimal coordinates.
  - `bearing`: Vehicle heading in degrees.
  - `speed`: Vehicle speed in km/h.
  - `updatedAt`: ISO timestamp.
- **Safety**: Built-in 8-second timeout, error catching, and type filtering ensure the server never hangs or crashes if the external feed goes offline.

---

## 9. Design System & Aesthetics (`client/src/index.css`)

The application implements a custom transit-focused design system with two distinct color palettes:

### Color Themes

#### Midnight Mode (`.dark`, default)
- **Background**: Deep obsidian blue (`#07121f`).
- **Panels**: Translucent glass (`rgba(15, 29, 47, 0.76)` with backdrop blur).
- **Text**: Crisp ice white (`#edf5ff`) and cool slate (`#8191a6`).
- **Accents**: Neon Cyan (`#55e4dc`), Electric Blue (`#438fff`), Coral (`#ff6b62`), Mint (`#4ce0c2`), Amber (`#ffbd67`).
- **Map Base**: Deep midnight navy (`#1b2b3b`).

#### Daylight Mode (`.light-shell`)
- **Background**: Crisp soft blue-grey (`#eef4fb`).
- **Panels**: Translucent pearl (`rgba(255, 255, 255, 0.76)`).
- **Text**: Dark navy (`#0d1b2f`) and muted slate (`#718097`).

### Typography
- **Display / Headings**: `'Sora'`, sans-serif (modern geometric font with high legibility).
- **Body / Interface**: `'DM Sans'`, sans-serif.

---

## 10. Authentication & Security Flow

The app uses a secure OAuth flow designed for modern browser environments:

1. **Login Trigger**: Calling `startLogin()` in `client/src/const.ts` generates a cryptographically secure UUID `nonce`, stores it in a `__Host-oauth_state` cookie (`Path=/; Secure; SameSite=None`), and redirects to the OAuth portal with a base64-encoded `state`.
2. **Callback Handling**: `server/_core/oauth.ts` handles `/api/oauth/callback`. It decodes `state`, validates that the nonce matches the `__Host-oauth_state` cookie (preventing CSRF login attacks), and exchanges the code for user info.
3. **Session Token**: On successful authentication, the server creates a JWT session token stored in an HTTP-only cookie (`app_session_id`, valid for 1 year).
4. **Iframe / WebView Fallback**: For environments blocking third-party cookies (Safari ITP, embedded WebViews), the token is forwarded via `Authorization: Bearer <token>` in `main.tsx`.
5. **Role-Based Access**: Procedures in `server/_core/trpc.ts` enforce access:
   - `publicProcedure`: Open to all requests.
   - `protectedProcedure`: Rejects unauthenticated requests with `UNAUTHED_ERR_MSG`.
   - `adminProcedure`: Requires `user.role === 'admin'`.

---

## 11. Environment Variables Reference

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Server | MySQL connection string (e.g. `mysql://user:pass@host:3306/db`) |
| `WBTC_VEHICLE_FEED_URL` | Server | Optional URL for live WBTC / Yatri Sathi GTFS-RT vehicle JSON feed |
| `JWT_SECRET` | Server | Secret key used for signing session tokens |
| `OAUTH_SERVER_URL` | Server | OAuth token exchange provider endpoint |
| `OWNER_OPEN_ID` | Server | OpenID of the super-admin user |
| `VITE_APP_ID` | Shared | Unique application identifier |
| `VITE_OAUTH_PORTAL_URL` | Client | URL of the OAuth authorization portal |
| `VITE_FRONTEND_FORGE_API_KEY` | Client | API key for Google Maps proxy loading |
| `VITE_FRONTEND_FORGE_API_URL` | Client | Base proxy URL for Google Maps services |
| `PORT` | Server | HTTP server port (defaults to `3000`) |
| `NODE_ENV` | Shared | Environment mode: `'development'` or `'production'` |

---

## 12. Operational & Development Commands

All commands are run from the repository root:

```bash
# 1. Install dependencies
pnpm install

# 2. Start development server (runs tsx watch on server/_core/index.ts with Vite HMR)
pnpm run dev

# 3. Typecheck codebase
pnpm run check

# 4. Run automated test suite (Vitest)
pnpm run test

# 5. Format codebase with Prettier
pnpm run format

# 6. Push database schema migrations (Drizzle)
pnpm run db:push

# 7. Build for production (Vite client bundle + esbuild server bundle)
pnpm run build

# 8. Start production server
pnpm start
```

---

## 13. Critical Testing & Validation Points for Future Agents

When modifying or extending this codebase, verify these key integration points:
1. **tRPC Contract Integrity**: If updating `server/routers.ts` or `drizzle/schema.ts`, ensure `server/smartbus.test.ts` passes (`pnpm test`). The `transit.snapshot` query must never throw even if `WBTC_VEHICLE_FEED_URL` is missing or unreachable.
2. **Offline & Simulated Fallback**: Ensure the live map in `Home.tsx` continues to function and render animated bus movements even when `transitQuery` returns 0 vehicles.
3. **Map Marker Cleanup**: When switching between "One bus" and "All buses" or updating `vehicles`, ensure `markersRef.current.forEach(m => m.map = null)` cleans up existing markers to avoid memory leaks or duplicate icons on Google Maps.
4. **Push Notification Graceful Degradation**: Always check for `"Notification" in window` and `"serviceWorker" in navigator` before invoking push APIs to avoid breaking non-supporting mobile browsers.
5. **Location Sharing Privacy**: Never send a contact's `lat`/`lng` coordinates to other clients unless `locationSharing === 1`.
6. **WBTC Route Formatting**: When matching route names, always use `normalizeRoute(value)` (which removes non-alphanumeric characters and converts to uppercase) to ensure strings like `"AC-24"`, `"AC24"`, and `"ac 24"` match reliably.
