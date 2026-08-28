# Resend New-User Automation Emails

## Summary
- Integrate Resend as a server-only mailer and add a 4-email onboarding flow for brand-new users.
- Trigger onboarding after the user becomes authenticated for the first time, not at raw form submit. That means password signup starts after email confirmation and first sign-in.
- Send the immediate welcome email to every new user. Send the Day 1, Day 3, and Day 7 follow-up emails only if the user opted into marketing emails.
- Support all signup paths on `/signup`: password, magic link, and Google. Do not backfill existing users.

## Key Changes
- Schema:
  - Extend `profiles` with `marketing_email_opt_in BOOLEAN DEFAULT FALSE`, `marketing_email_opt_in_at TIMESTAMPTZ`, `marketing_email_opt_out_at TIMESTAMPTZ`, `signup_source TEXT`, and `onboarding_initialized_at TIMESTAMPTZ`.
  - Add `onboarding_email_jobs` with `user_id`, `email`, `step_key`, `subject`, `scheduled_for`, `status`, `sent_at`, `resend_email_id`, `last_error`, `requires_marketing_opt_in`, `created_at`, and `updated_at`.
  - Add a unique constraint on `(user_id, step_key)` and an index on `(status, scheduled_for)`.
- Env and config:
  - Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `CRON_SECRET` to server env handling and `.env.example`.
  - Add one Vercel cron in `vercel.json` for `GET /api/cron/onboarding-emails` on a daily schedule compatible with Hobby plans.
- Public interfaces:
  - Update `AuthContext` so `login`, `signupWithPassword`, and `sendMagicLink` accept signup context and marketing-consent data.
  - Add `POST /api/account/onboarding` for authenticated onboarding initialization.
  - Add `GET /api/cron/onboarding-emails` for the cron worker.
  - Add `GET /api/email/unsubscribe` for public opt-out links.
- Email implementation:
  - Add `resend`, `react-email`, and `@react-email/components`.
  - Add a small server mailer utility plus React Email templates under `emails/`.
  - Use four templates: immediate welcome, Day 1 getting-started tips, Day 3 studio/tools tips, Day 7 power-user/pricing tips.

## Implementation Details
- Frontend auth flow:
  - Keep the existing signup checkbox for optional marketing emails.
  - Password signup and magic-link signup from `/signup` pass metadata into Supabase auth via `options.data`.
  - Google signup from `/signup` must require the same terms acceptance as the other signup methods and store a short-lived local pending-signup marker before opening the popup.
  - Google login from `/login` stays a pure sign-in path and must not start onboarding.
- Onboarding init handler:
  - `POST /api/account/onboarding` authenticates the user, upserts `profiles`, resolves consent with precedence `request body > Supabase user_metadata > existing profile`, stores `signup_source`, inserts any missing onboarding jobs, sends the welcome email immediately, and sets `onboarding_initialized_at`.
  - Use deterministic Resend idempotency keys, starting with `welcome-${user.id}`, so retries cannot duplicate sends.
  - Wire the route in both `server.ts` and `api/index.ts`.
- Cron worker:
  - `GET /api/cron/onboarding-emails` checks `Authorization: Bearer ${CRON_SECRET}`.
  - It picks up due `pending` or retryable jobs, skips marketing-gated emails when the user is opted out, sends via Resend, and updates `sent_at`, `status`, `resend_email_id`, and `last_error`.
  - Schedule jobs at onboarding time for Day 1, Day 3, and Day 7 relative to `onboarding_initialized_at`.
- Unsubscribe:
  - Add signed unsubscribe links to the three marketing-gated emails.
  - `GET /api/email/unsubscribe` verifies an HMAC-signed token, flips `marketing_email_opt_in` to `false`, and stamps `marketing_email_opt_out_at`.
  - No settings-page email preference UI in v1; unsubscribe is handled from the email link.

## Test Plan
- Run `npm run lint` and `npm run build`.
- Password signup with email confirmation:
  - No onboarding email at raw signup submit.
  - First confirmed sign-in sends exactly one welcome email and creates exactly three queued follow-up jobs.
- Magic-link signup from `/signup` behaves the same as password signup.
- Google signup from `/signup` requires terms acceptance, respects the marketing checkbox, and creates onboarding once.
- Google login or magic-link login from `/login` does not create onboarding jobs.
- Re-running the cron does not duplicate already-sent emails.
- Clicking unsubscribe disables the remaining follow-up emails without affecting login, billing, or existing account data.

## Assumptions
- The Resend key shared in chat is treated as exposed and should be rotated before production use; only the rotated key is stored in env.
- `onboarding@thumoraai.com` is the verified sender for production. Local testing may temporarily use `onboarding@resend.dev` until domain verification is complete.
- V1 email copy is English, matching the current product copy and routes.
