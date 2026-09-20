# CivicPulse Georgia

A citizen-first view of Georgia legislation. CivicPulse Georgia turns bills, votes, and committee meetings into plain-language explanations that answer:

1. What is happening?
2. How could it affect me?
3. What happens next?
4. What can I do?

## Version 1

- Personalized home feed by topics of interest
- Plain-language bill discovery and detail pages
- Local, privacy-friendly bill following
- Public committee-meeting calendar
- Official representative lookup handoff
- Legislative process guide and glossary
- Responsive, keyboard-friendly interface
- Demo-data fallback when the public Supabase API is not configured

Staff-only LegiPulse features such as teams, private notes, editable agendas, sync controls, email lists, and AI regeneration are intentionally excluded.

## Run locally

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:4174`.

## Connect public legislative data

1. Apply `supabase/migrations/040_civicpulse_public_read_api.sql` to the same Supabase project used by LegiPulse.
2. Copy `.env.example` to `.env`.
3. Add the project URL and anonymous key.

Only three security-definer functions are exposed to anonymous users. They return public session, bill-cache, and meeting-cache data and do not expose profiles, teams, notes, email lists, or staff metadata.

Without these settings, the app intentionally uses the included representative demo dataset so design and product development can continue safely.

## Production build

```bash
npm run build
npm start
```

`server.js` serves the Vite output and supports client-side routes.
