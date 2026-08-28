# AGENTS.md instructions for c:\Users\Administrateur\Downloads\Thumzo-main\Thumzo-main

<INSTRUCTIONS>
This is a separate project folder from the WhatsApp automation app.
Do not assume any monorepo structure, WhatsApp services, Next.js app router, or PostgreSQL backend outside Supabase.

Project type:
- AI thumbnail studio / thumbnail editor
- Single-project Vite + React + TypeScript app
- Thin Express server used to host Vite in dev and static files in production

Stack:
- Frontend: React 19 + React Router 7 + TypeScript + Tailwind CSS 4 + Motion
- Server: Express 5 in `server.ts`
- Auth/Data/Storage: Supabase (`@supabase/supabase-js`)
- AI: Google Gemini via `@google/genai`

Important files:
- `package.json` — scripts and dependencies
- `server.ts` — Express entrypoint, serves Vite middleware and `/api/health`
- `src/App.tsx` — top-level routing
- `src/context/AuthContext.tsx` — Supabase Google OAuth popup auth flow
- `src/context/layouts/DashboardLayout.tsx` — dashboard auth gating and shell
- `src/lib/supabase.ts` — Supabase client setup
- `src/services/geminiService.ts` — image analysis and thumbnail generation
- `src/services/storageService.ts` — Supabase Storage access for templates and user uploads
- `schema.sql` — Supabase schema and RLS policies

Current product surfaces:
- Marketing/public pages: landing, pricing, privacy, API docs
- Dashboard pages: studio, editor, templates, assets, bulk edits, settings
- Main functional surface is `src/pages/dashboard/StudioEditor.tsx`

Data model notes:
- Supabase tables defined in `schema.sql`: `profiles`, `assets`, `generations`, `drafts`
- Storage buckets referenced in code: `thumbnails` and `user-assets`
- Read the schema before changing field names; there are snake_case DB fields used by the UI

Working rules for this repo:
- Prefer editing existing files over adding abstractions
- Keep the current visual style unless the user asks for a redesign
- Preserve Supabase-based auth/storage flows instead of replacing them
- Do not invent backend APIs when the app currently talks directly to Supabase
- Validate assumptions against the actual code, especially around model selection and dashboard functionality

Run commands:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`

Known context:
- This repo currently appears independent from the WhatsApp project instructions
- Some dashboard sections are scaffolded/placeholder UI; do not describe them as fully implemented without checking the code first
</INSTRUCTIONS>
