# ExecOS — AI Executive Assistant

An autonomous AI assistant that manages your inbox, calendar, and bookings. Built with Next.js 16, GPT-4o, and Clerk.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Core Flows](#core-flows)
  - [Authentication Flow](#1-authentication-flow)
  - [Google OAuth Integration Flow](#2-google-oauth-integration-flow)
  - [Autonomous Agent Flow](#3-autonomous-agent-flow)
  - [AI Console Chat Flow](#4-ai-console-chat-flow)
  - [API Key Storage Flow](#5-api-key-storage-flow)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Getting Started](#getting-started)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                        │
│                                                                  │
│  Landing Page  │  Dashboard  │  Monitoring  │  AI Console        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│                    Next.js 16 App Router                         │
│                                                                  │
│  proxy.ts (Clerk Middleware)                                     │
│  ├── Public:  /  /sign-in  /sign-up                             │
│  └── Protected: all other routes                                 │
│                                                                  │
│  Server Components (RSC)         Client Components               │
│  ├── app/(main)/dashboard        ├── ChatWindow                  │
│  ├── app/(main)/monitoring       ├── RunAgentButton              │
│  ├── app/(main)/console          └── ApiKeysForm                 │
│  └── app/settings                                                │
│                                                                  │
│  API Routes                                                      │
│  ├── POST /api/agents     → Autonomous agent trigger             │
│  ├── POST /api/chat       → Streaming GPT-4o chat                │
│  ├── GET  /api/auth/google → Google OAuth initiation             │
│  └── GET  /api/auth/google/callback → OAuth token exchange       │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────────────────────┐
│  PostgreSQL (Railway) │   │          External APIs               │
│                       │   │                                      │
│  users                │   │  Clerk      — Auth & sessions        │
│  integrations         │   │  OpenAI     — GPT-4o (chat + agent)  │
│  tasks                │   │  Gmail API  — Read, draft, search    │
│  agent_runs           │   │  Google Cal — Events & scheduling    │
│  chat_messages        │   │  Cal.com    — Bookings & availability │
└───────────────────────┘   └──────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Auth | Clerk |
| Database | PostgreSQL (Railway) |
| ORM | Drizzle ORM |
| AI | OpenAI GPT-4o |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Google APIs | googleapis |
| Encryption | AES-256-GCM (Node.js crypto) |

---

## Project Structure

```
my-app/
│
├── app/
│   ├── (auth)/                        # Public auth pages (no sidebar)
│   │   ├── sign-in/[[...sign-in]]/    # Clerk sign-in
│   │   └── sign-up/[[...sign-up]]/    # Clerk sign-up
│   │
│   ├── (main)/                        # Protected app (with sidebar layout)
│   │   ├── layout.tsx                 # Sidebar + auth guard + pro check
│   │   ├── dashboard/page.tsx         # Stats, agent status, onboarding
│   │   ├── monitoring/page.tsx        # Agent run history & email log
│   │   └── console/page.tsx           # AI chat interface
│   │
│   ├── api/
│   │   ├── agents/route.ts            # POST: trigger autonomous agent
│   │   ├── chat/route.ts              # POST: streaming GPT-4o chat
│   │   ├── auth/google/callback/      # GET: OAuth token exchange
│   │   └── route.ts                   # GET: OAuth initiation redirect
│   │
│   ├── settings/page.tsx              # API keys + Google integrations
│   ├── actions/settings.ts            # Server action: save encrypted keys
│   ├── layout.tsx                     # Root layout (ClerkProvider + fonts)
│   ├── page.tsx                       # Public landing page
│   └── globals.css                    # Tailwind + theme tokens
│
├── components/
│   ├── agents/
│   │   ├── run-agent-button.tsx       # Client: triggers /api/agents
│   │   └── email-detail.tsx           # Expandable email row in monitoring
│   ├── console/
│   │   ├── chat-context.tsx           # React Context: messages + streaming
│   │   └── chat-window.tsx            # Full chat UI (header, feed, input)
│   ├── settings/
│   │   └── api-keys-form.tsx          # Client: save OpenAI + Cal.com keys
│   └── ui/                            # shadcn/ui primitives
│
├── db/
│   ├── schema.ts                      # Drizzle table definitions + types
│   ├── queries.ts                     # All DB query functions
│   └── index.ts                       # Drizzle + postgres client init
│
├── lib/
│   ├── agent.ts                       # Autonomous GPT-4o agent loop
│   ├── encryption.ts                  # AES-256-GCM encrypt/decrypt
│   ├── google.ts                      # OAuth2 client + scope definitions
│   └── tools/
│       ├── index.ts                   # Tool definitions, executor, context builder
│       ├── gmail.ts                   # Gmail: search, read, draft
│       ├── calendar.ts                # Google Calendar: list, create
│       └── calcom.ts                  # Cal.com: bookings, availability
│
├── proxy.ts                           # Clerk middleware (route protection)
├── drizzle.config.ts                  # Drizzle Kit config
└── .env.local                         # Environment variables
```

---

## Environment Variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Database
DATABASE_URL=postgresql://...

# Encryption (for OAuth tokens + API keys at rest)
ENCRYPTION_KEY=<32-byte hex string>

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Cron job protection
CRON_SECRET=...
```

> **Per-user keys** (OpenAI, Cal.com) are entered by users in Settings and stored encrypted in the `users.preferences` JSON column.

---

## Core Flows

### 1. Authentication Flow

```
User visits any protected route
        │
        ▼
proxy.ts — Clerk middleware runs on every request
        │
        ├── Route is public (/, /sign-in, /sign-up)?
        │         └── Allow through
        │
        └── Route is protected?
                  │
                  ├── No Clerk session → redirect to /sign-in
                  │
                  └── Valid session → allow through
                            │
                            ▼
                  Server Component calls auth()
                            │
                            ▼
                  getOrCreateUser(clerkId, email, name)
                  — Looks up user in DB by Clerk ID
                  — Creates DB record on first visit
```

---

### 2. Google OAuth Integration Flow

```
User clicks "Connect Gmail" in Settings
        │
        ▼
GET /api/auth/google?provider=gmail
        │
        ├── Verify Clerk session
        ├── Generate CSRF state: base64(JSON({ nonce, provider }))
        ├── Store state in HttpOnly cookie (10 min TTL)
        └── Redirect → Google OAuth consent screen
                │
                ▼ (user approves)
GET /api/auth/google/callback?code=...&state=...
        │
        ├── Verify Clerk session
        ├── Validate CSRF state matches cookie
        ├── Parse provider from state
        ├── Exchange code → { access_token, refresh_token }
        ├── encrypt(access_token) + encrypt(refresh_token)
        ├── upsertIntegration() → save to integrations table
        ├── Clear state cookie
        └── Redirect → /settings?connected=gmail
```

---

### 3. Autonomous Agent Flow

```
Trigger: POST /api/agents
  (from RunAgentButton on Dashboard, or external cron with CRON_SECRET)
        │
        ▼
lib/agent.ts — runAgent(userId)
        │
        ├── createAgentRun() → status: "running"
        ├── Load user integrations (Gmail, Calendar tokens)
        ├── Decrypt OAuth tokens
        ├── Build tool context (gmailToken, calendarToken, calcomApiKey)
        │
        ▼
GPT-4o agentic loop (max 30 iterations)
        │
        ├── System prompt: process unread emails, create tasks/drafts/events
        │
        └── Each iteration:
            ├── Call GPT-4o with all available tools
            │
            ├── GPT returns tool_calls?
            │     YES → execute each tool:
            │           ├── search_emails        → Gmail API
            │           ├── read_email           → Gmail API
            │           ├── create_draft         → Gmail API
            │           ├── create_task          → PostgreSQL
            │           ├── list_calendar_events → Google Calendar API
            │           ├── create_calendar_event→ Google Calendar API
            │           ├── list_bookings        → Cal.com API
            │           ├── get_availability     → Cal.com API
            │           └── finish_run           → END LOOP
            │     NO  → END LOOP
            │
            └── Append tool results → next iteration
                        │
                        ▼
            completeAgentRun() → agent_runs table:
              status, summary, actionsLog[], emailsProcessed,
              tasksCreated, draftsCreated, durationMs
```

---

### 4. AI Console Chat Flow

```
User types message in AI Console → presses Enter
        │
        ▼
chat-context.tsx — sendMessage(text)
        │
        ├── Add user message to UI (optimistic)
        ├── Add empty assistant bubble (shows typing dots)
        │
        ▼
POST /api/chat  { message: "..." }
        │
        ├── Verify Clerk session
        ├── Get/create user record
        ├── Decrypt openaiApiKey from user.preferences
        ├── saveChatMessage(userId, "user", text) → DB
        ├── getChatHistory(userId, 40) → last 40 messages for context
        ├── getUserIntegrations() → build tool context
        │   (only tools with connected integrations are offered to GPT)
        │
        ▼
GPT-4o agentic loop
        │
        └── Each iteration:
            ├── GPT returns tool_calls?
            │     YES → stream "_Using tool: name..._" hint to UI
            │           execute tool → append result → next iteration
            │     NO  → stream final text in 20-char chunks → break
            │
            └── saveChatMessage(userId, "assistant", fullText) → DB
                        │
                        ▼
            ReadableStream → chat-context.tsx
            Appends each chunk to assistant message in real time
```

---

### 5. API Key Storage Flow

```
User enters OpenAI key in Settings → clicks Save
        │
        ▼
ApiKeysForm (client) — submits FormData via Server Action
        │
        ▼
saveApiKeys() — app/actions/settings.ts
        │
        ├── Verify Clerk session
        ├── Load user from DB
        ├── encrypt(openaiApiKey)   ← AES-256-GCM, random IV per call
        ├── encrypt(calcomApiKey)   ← same
        ├── Merge into user.preferences JSONB:
        │     { openaiApiKey: "iv:tag:ciphertext", calcomApiKey: "..." }
        └── UPDATE users SET preferences = { ... }

At runtime (chat / agent):
        decrypt(prefs.openaiApiKey) → plaintext key → OpenAI client
```

---

## Database Schema

```
users
  id (uuid PK), clerkId (unique), email, name
  subscriptionStatus: none | active | canceled | past_due
  agentEnabled (bool), onboardingCompleted (bool)
  preferences (jsonb)  ← encrypted API keys live here
  createdAt, updatedAt

integrations
  id, userId → users.id
  provider: gmail | google_calendar
  accessToken (AES encrypted), refreshToken (AES encrypted)
  expiresAt, scope[]

tasks
  id, userId → users.id
  title, description
  priority: low | medium | high
  status: pending | completed | cancelled
  dueDate, createdByAgent (bool)

agent_runs
  id, userId → users.id
  status: running | success | failed
  summary (text)
  actionsLog (jsonb[])  ← one ActionLogEntry per email processed
  emailsProcessed, tasksCreated, draftsCreated (int)
  errorMessage, startedAt, completedAt, durationMs

chat_messages
  id, userId → users.id
  role: user | assistant
  content, createdAt
```

---

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/google` | Clerk | Initiate Google OAuth, set CSRF cookie, redirect to Google |
| `GET` | `/api/auth/google/callback` | Clerk | Exchange code for tokens, encrypt and store |
| `POST` | `/api/agents` | Clerk or `CRON_SECRET` | Trigger autonomous agent run |
| `POST` | `/api/chat` | Clerk | Streaming GPT-4o chat with tool use |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Copy and fill in .env.local with your keys

# 3. Generate an ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Push database schema
npx drizzle-kit push

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up.

**First-time setup checklist:**
1. Sign up / sign in via Clerk
2. Go to Settings → add your **OpenAI API key**
3. Connect **Gmail** and **Google Calendar** via OAuth
4. Optionally add your **Cal.com API key**
5. Return to Dashboard → click **Run Agent Now**
