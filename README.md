# Idea Board

A minimal responsive community board built with Next.js App Router, TypeScript, React, and Supabase PostgreSQL. No visitor accounts or payments. Visitors can submit a title, description and nickname, browse newest/top ideas, and vote once per identified browser for each idea.

## Architecture and privacy

Browser → Next.js API routes → Supabase REST API → PostgreSQL.

Only the Next.js server uses environment variables. There are no `NEXT_PUBLIC_` credentials and no Supabase service-role/secret key. The server uses the publishable key with the `anon` role and an additional application credential. RLS verifies its SHA-256 hash for every write. A signed, HttpOnly, Secure-in-production, SameSite=Lax cookie identifies each browser. An HMAC of its random value becomes the database voter ID. A different HMAC per idea forms the public vote token, so public tokens cannot link a visitor across ideas.

The `ideas` and `votes` tables both have RLS. Public visitors may read ideas and only the `id`/`idea_id` vote columns; voter IDs and vote timestamps are not publicly readable. Insert grants cover only required columns. Database defaults control timestamps. No public update/delete privileges exist. The aggregate `idea_board` view uses `security_invoker = true` and therefore respects underlying RLS/grants. No privileged `SECURITY DEFINER` application functions are used.

`UNIQUE (idea_id, voter_id)` prevents duplicate votes, including concurrent requests. Foreign keys prevent votes on nonexistent ideas. PostgreSQL and API constraints validate field lengths. API routes check same-origin JSON requests and cap request bodies at 8 KB. React escapes displayed text.

This is browser identification, not proof of a unique person. Clearing cookies, using another browser/device, or deliberately requesting fresh identifiers can allow another vote. There is no CAPTCHA, spam moderation, or distributed rate limiter in v1. Nicknames and ideas are public: do not submit private information. The essential voter cookie lasts one year. Rotating BOARD_API_SECRET invalidates existing cookies/vote recognition; plan rotations accordingly.

## Local setup, explained

1. Install Node.js 24 and clone this repository. Run `npm ci` to install the exact lockfile versions. If your default npm cache is not writable, use `npm --cache ./work/npm-cache ci`.
2. Create a Supabase project, or use your existing project. Copy its Project URL and **publishable** API key from Project Settings → API Keys. Never use a secret or service-role key for this app.
3. Copy `.env.example` to `.env.local`. Fill `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Generate a server-only application secret using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and save it as `BOARD_API_SECRET`. Keep it out of Git; `.gitignore` already excludes local environment files. This app's existing local environment is already configured: do not overwrite it.
4. For a **new database only**, run `node scripts/prepare-schema.mjs`. Open Supabase → SQL Editor and run `work/schema-configured.sql`. This creates both tables, indexes, RLS policies, restricted column grants and the aggregate view. The script substitutes the hash of the application secret; the raw secret is never stored in SQL. Do not rerun the initial schema on an already-configured database. The connected project for this delivery is already configured.
5. Run `npm run dev` and open http://localhost:3000. Submit an idea, vote, refresh, and confirm the vote persists and cannot be repeated in the same browser.
6. Run `npm run typecheck` and `npm run build`. Run `npm start` to serve the production build.

### Integration tests

With the app running and `.env.local` configured, `npm test` checks public reads, input validation, request-size limits, origin enforcement, direct-write denial, voter-ID privacy, submission, persisted counts, update/delete denial, and concurrent duplicate votes. Set `TEST_BASE_URL=https://your-project.vercel.app` to test a deployment. Tests create a **temporary idea and one vote in the configured database** and write its exact ID to `work/test-record.json`. Remove only that record afterward as a database administrator using its ID; the foreign key cascades its vote. Do not run against a database you cannot clean up. The production API intentionally has no delete endpoint.

## Deploy on Vercel Hobby, explained

1. Push the source and lockfile to GitHub. Never commit `.env.local`, `.vercel`, `work`, or `node_modules`.
2. In Vercel, import the GitHub repository into your Hobby workspace. Framework: **Next.js**; root: repository root; Node: **24.x**; install: `npm ci`; build: `npm run build`; leave output directory at Next.js's default. No paid resources or upgrades are required by this code. Check your account's current plan limits in Vercel before changing plans.
3. Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `BOARD_API_SECRET` in Project Settings → Environment Variables. Use the **same BOARD_API_SECRET registered by hash in Supabase**, stored as an encrypted/sensitive server environment variable. Enable the intended Production/Preview/Development targets. A separate Supabase project and secret for previews is recommended when you want to isolate preview submissions; this initial delivery uses one database.
4. Deploy the `main` branch to Production. No additional hosting server is needed; Next.js API routes run in Vercel Functions and use HTTPS to Supabase. After environment changes, redeploy so functions receive them.
5. Open the production URL in a signed-out browser. Verify loading, submission, votes, refresh persistence, duplicate rejection and mobile layout. If Vercel authentication blocks public visitors, configure production access for the intended audience in Deployment Protection.
6. With Git integration enabled, subsequent pushes to `main` deploy to production; other branches receive previews. Confirm the Git repository is listed in Vercel → Project Settings → Git. Supabase migrations are separate: review/apply SQL before deploying code that depends on it.

## Database administration

`supabase/schema.sql` is the reproducible initial schema template. `supabase/security-hardening.sql` removes public execution permissions from an optional pre-existing RLS automation trigger; apply only if that function exists. Run Supabase Security Advisor after schema changes. The delivery's advisor check returned no findings.

To rotate the application credential, generate a replacement, update the hash literal in `private.board_voter()` using `CREATE OR REPLACE FUNCTION` with the same signature and permissions, update local and Vercel secrets, then redeploy. Avoid rotating just one side; writes will fail until hashes match. A maintenance window avoids mixed old/new instances.

## Project files

- `app/board.tsx`, `app/globals.css`: responsive board, form, sort, pagination and vote state.
- `app/api/ideas/route.ts`, `app/api/votes/route.ts`: validated server endpoints.
- `lib/server.ts`: server-only environment access, signed cookie and Supabase requests.
- `supabase/schema.sql`: tables, constraints, indexes, RLS and least-privilege grants.
- `tests/board.test.mjs`: real API/database verification.

Official references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vercel deployment documentation](https://vercel.com/docs/deployments).
