# Thumora AI

Thumora AI is a Vite + React thumbnail-first creator image studio with Supabase auth/storage, server-side OpenAI image generation, Gemini-assisted prompt tooling, and Whop-based billing.

## Launch scope

- `/`
- `/pricing`
- `/login`
- `/signup`
- `/studio`
- `/studio/editor`
- `/templates`
- `/tools`
- `/assets`
- `/api-docs`
- `/settings/billing`
- `/terms-of-service`
- `/privacy-policy`

Legacy recovery routes and blog/help content are intentionally out of the launch surface. `/bulk-edits` now redirects to `/tools` for backward compatibility.

`/api-docs` documents the current authenticated app API surface. It is not a separate public developer platform with standalone API keys.

## Stack

- Frontend: React 19, TypeScript, React Router 7, Tailwind CSS 4, Motion
- Local server: Express 5 in `server.ts`
- Auth/data/storage: Supabase
- AI image generation: OpenAI GPT Image via server endpoints
- AI prompt tooling and analysis: Google Gemini via server endpoints
- Billing: Whop checkout + webhooks
- Deploy target: Vercel SPA + `api/` functions

## API endpoints

- `GET /api/health`
- `GET /api/billing/me`
- `POST /api/billing/checkout`
- `POST /api/ai/generate`
- `POST /api/ai/analyze`
- `POST /api/webhooks/whop`

The browser no longer uses a public provider key. AI generation runs through authenticated server handlers.

## Billing model

- Hobby: free, 3 credits every 30 days
- Creator: 20 monthly credits
- Creator+: 60 monthly credits
- Ultra: 400 monthly credits
- Top-up: one-time 25 credit pack

Credit state is stored in Supabase through:

- `billing_memberships`
- `credit_ledger`
- `processed_webhooks`

`schema.sql` also defines helper functions for:

- lazy free-credit grants
- credit balance reads
- atomic credit consumption

## Environment

Copy `.env.example` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `WHOP_API_KEY`
- `WHOP_WEBHOOK_SECRET`
- `WHOP_COMPANY_ID`
- `WHOP_CREATOR_PLAN_ID`
- `WHOP_CREATOR_PLUS_PLAN_ID`
- `WHOP_ULTRA_PLAN_ID`
- `WHOP_TOP_UP_PLAN_ID`
- `APP_URL`

Optional S3 admin storage vars remain supported for the local admin utility.

## Local development

```bash
npm install
npm run dev
```

The local Express server serves the Vite app in development and exposes the same API handlers used by Vercel functions.

## Verification

```bash
npm run lint
npm run build
```

## Deploy

- Create a new private GitHub repo named `Thumora-AI`
- Push the baseline to `main`
- Create a new Vercel project named `thumora-ai`
- Configure the environment variables above
- Deploy preview first, then production
- Update Supabase auth URLs and Whop redirect/webhook URLs after the production URL is stable
