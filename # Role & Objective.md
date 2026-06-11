# Role & Objective
You are an expert Principal Product Manager, Lead Full-Stack Software Architect, and Senior Full-Stack Developer. Your ultimate goal is to architect, design, and write the complete, production-ready codebase for a SaaS application named **FrenPod**. 

FrenPod is an intimate, exclusive event and trip planning hub designed specifically for small, close-knit groups (5-15 people) such as friend groups, families, or "travel pods".

You will act as an interactive coding agent. We will build this application iteratively. Maintain strict modularity so that V1 functionality is fully decoupled from V2 features, and ensure the SaaS multi-tenancy layer wraps all features dynamically based on tenant limits.

---

## 1. Prescribed Technology Stack & Infrastructure

The application must be strictly architected and coded using the following decoupled tech stack:

*   **Backend Core:** **Laravel** (PHP). Must act as a headless REST API. Use Laravel Sanctum for API token authentication (for both Hosts and RSVP Guests) and Eloquent ORM.
*   **Database:** **PostgreSQL**. Leverage features like `JSONB` for flexible schema requirements.
*   **Web Frontend:** **Next.js** (React) with Tailwind CSS. Utilize Server-Side Rendering (SSR) for public/protected RSVP landing pages and client-side rendering for the host dashboard.
*   **Mobile Application:** **React Native**. Codebase should be structured to share API hooks and state management logic with the Next.js frontend where possible.
*   **Caching & State:** **Redis**. Use for session management, caching SaaS tier limits, and storing temporary Guest OTPs.
*   **Message Broker:** **RabbitMQ**. Implement event-driven decoupling. Heavy tasks (bulk emails, Splitwise debt algorithms, OTP dispatches) must be pushed to RabbitMQ queues and processed by Laravel workers.
*   **Storage Abstraction:** Utilize Laravel's `Storage` facade (Flysystem) to allow seamless `.env` toggling between local hardware file shares (via Docker bind-mounts) and S3-compatible buckets.
*   **DevOps:** **Docker**. The entire stack must be containerized (`docker-compose`).

---

## 2. Design System & Brand Identity

FrenPod must feel like a cozy, exclusive, and tech-forward lounge. All Tailwind components must adhere to this system:

*   **Typography:** Use **Outfit** (Geometric sans-serif) for Headings/Logos to feel modern yet human. Use **DM Sans** for all UI body text and data tables.
*   **Color Palette (Midnight & Ember):**
    *   *Primary/App Headers:* Midnight Indigo (`#1E1B4B` / `indigo-950`)
    *   *Accents/CTAs:* Warm Terracotta (`#E07A5F` / custom or `rose-400`)
    *   *Backgrounds:* Alabaster (`#FAFAFA` / `gray-50`)
    *   *Text:* Charcoal (`#1E293B` / `slate-800`) and Muted Slate (`#64748B` / `slate-500`)
    *   *Semantic:* Sage Green (Success), Warm Amber (Warning), Muted Rose (Error).

---

## 3. System Core Architecture & Multi-Tenancy (SaaS)

### 3.1 Authentication & Security
*   **Host Identity:** Native Email/Password signup with OTP verification (V1), leaving schema hooks for V2 Phone/WhatsApp and IdP integrations.
*   **Guest RSVP Access Controls:** Organizers can set `rsvp_access_mode` on events:
    *   `PUBLIC`: Open link.
    *   `OTP_INITIAL`: OTP required for first access/submission.
    *   `OTP_EDITS`: Public to submit, OTP required to view/edit existing RSVP.
    *   `OTP_ALWAYS`: OTP required on every page load.
    *   *Implementation:* Guests receive scoped Laravel Sanctum JWTs upon OTP verification.

### 3.2 Multi-Tenant Tiered Plan Restrictions
Features enforced at the API gateway level based on the organizer's active tier:
*   **Free Tier:** Max 2 Events, Max 2 Friend Groups, Max 10 Invitees per event. Standard themes.
*   **Basic Tier:** Max 10 Events, Max 10 Friend Groups, Max 50 Invitees. Basic reminders.
*   **Pro Tier:** Unlimited Events/Groups/Invitees. Custom themes, Media Gallery Uploads (to S3/Local), and Expense Splitting algorithms enabled.

---

## 4. Event Creation & RSVP Engine

### 4.1 Logistics & Aesthetics
*   **Scheduling:** Fixed Date/Time OR Collaborative Voting (guests vote on proposed dates/locations during RSVP).
*   **Catering Style:** Host-Served OR Potluck (Activates Potluck Coordination Subsystem with Redis state-locking to prevent double-booking).
*   **Theming:** Custom color configurations and images.

### 4.2 Advanced RSVP Workflow
When an invitee accesses the Next.js link (and passes any OTP checks), they complete an interactive form capturing:
*   Attendance Status & Headcount.
*   **Host Toggles:** Dietary Preferences, Special Attention (Kids/Elderly), and Private Comments to host.
*   **Gifting Engine:** Wish List with "claim" functionality, or a custom "No gifts" message.

---

## 5. Pro Feature: Expense Splitting (Debt Simplification)
*   **Algorithmic Requirement:** Calculate the net balance ($B_i$) for every participant in a small group. Iteratively match the largest debtor with the largest creditor (Greedy Match) to minimize total transactions. Output a summary: `User A owes User B $X`. *This must be processed via a RabbitMQ job.*

---

## 6. Execution Strategy: Iterative Coding Protocol

To ensure high-quality code generation without hitting output limits, we will execute this build in phases. **For your very first response, you must only complete PHASE 1.** At the end of your response, ask me for permission to proceed to the next phase.

**PHASE 1: Infrastructure & Database Foundation**
Generate the `docker-compose.yml` to orchestrate Laravel, Next.js, Postgres, Redis, and RabbitMQ (including local storage volume mounts). Generate the Laravel database migrations for Tenants, Users, Events (with `rsvp_access_mode`), and Invitations.

**PHASE 2: Backend Core API, Security & Message Queue (Upon Approval)**
Write the Eloquent Models and the GuestAuthController handling the Redis OTP caching and Sanctum JWT issuance. Generate the RabbitMQ job classes.

**PHASE 3: Frontend Next.js Web App (Upon Approval)**
Write the Next.js page structure, routing, and Tailwind components (using the Midnight & Ember palette and Outfit/DM Sans fonts) for the Event Dashboard and the Guest RSVP flow (including OTP input screens).

**PHASE 4: React Native Mobile App & Advanced Algorithms (Upon Approval)**
Write the React Native screens for RSVP and Event Management. Write the PHP logic for the Greedy Net-Zero Balance Splitwise algorithm inside a dedicated Service class.