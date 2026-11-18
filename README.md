# ARENA Esports Platform

Standalone Next.js App Router application for the community tournament platform. The existing Discord bot in the sibling `BOT` folder is intentionally unchanged.

## Architecture

- `src/app`: server-rendered pages, authentication entry points, and API routes.
- `src/components`: client-side navigation, tournament filtering, registration, and auth forms.
- `src/lib/tournaments`: framework-independent bracket and scoring rules.
- `src/lib/supabase`: cookie-aware server client and browser auth client.
- `supabase/migrations`: normalized PostgreSQL schema, triggers, transaction-safe points RPC, and RLS policies.
- `tests`: executable domain tests for bracket byes and tournament scoring.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Without Supabase credentials the public tournament board uses clearly labeled development preview data. Registration and account creation remain disabled; preview entries are never persisted.

## Supabase setup

1. Create a Supabase project and copy its project URL and anon key into `.env.local`.
2. Apply `supabase/migrations/0001_platform.sql` using the Supabase CLI (`supabase db push`) or SQL editor.
3. Configure Supabase Auth email verification and the local/deployed redirect URLs.
4. Create the first administrator through an operationally controlled process; never accept a role from signup metadata. The `profiles.role` field is server controlled by RLS.
5. Enable Realtime on `notifications` if live inbox updates are added.

Do not expose a service-role key to the browser. Provider credentials belong only in server environment variables. Brawl Stars requires an official API token; BGMI verification is manual until authorized statistics access exists. Minecraft profile lookups and server plugin submissions require a separately authenticated adapter before they can be enabled. Free Fire and VALORANT stats are not fabricated or scraped.

## Commands

```powershell
npm run dev
npm run test
npm run lint
npm run build
```

## Current implementation boundary

Implemented now:

- Responsive tournament discovery and preview/live Supabase tournament feeds.
- Supabase email/password signup, login, reset, session middleware, and protected player dashboards.
- Profile editing, gaming-account submission, team creation, invitations, player/team registrations, reward ledgers, rewards, the store catalogue, notifications APIs, and server-authorized administrator overview.
- Normalized PostgreSQL schema, RLS policies, transaction-safe tournament registration, point award/debit/redeem RPCs, match verification, and audit logging.
- Tested single-elimination bye handling and configurable BGMI placement/kill scoring.

Credential-dependent or follow-on modules:

- BGMI statistics remain an administrator-verification submission workflow until authorized API access exists.
- Brawl Stars lookup needs `BRAWL_STARS_API_TOKEN`; other official/authorized adapters must be supplied for Free Fire and VALORANT.
- Minecraft supports manual account linking and the schema is ready for a plugin API, but no public profile or server endpoint is activated by default.
- Affiliate products link only to authorized URLs. Integrated checkout requires a configured merchant/provider and server-side signing. No payment is simulated as live.
- Double elimination, round robin, and points-format bracket UI engines remain follow-on modules beyond the shared scoring/bracket foundations.
- Full Supabase Realtime subscriptions, complete admin CRUD screens, order fulfilment, and automated provider synchronization require operational configuration and follow-on UI/API implementation.