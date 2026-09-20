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

## Standalone database

CivicPulse uses its own Supabase project. It does not connect to the LegiPulse
staff database from the browser.

1. Create a new Supabase project for CivicPulse.
2. Apply `supabase/migrations/001_civicpulse_public_data.sql` to that project.
3. Copy `.env.example` to `.env`.
4. Add the **new CivicPulse project's** URL and anonymous key.

The migration creates CivicPulse-owned session, bill, and meeting tables. Only
three security-definer read functions are exposed to anonymous users. Direct
table access is denied.

### Copy public data from LegiPulse

The optional import script copies only shared provider data. It does not copy
users, teams, notes, analysis, email lists, or other staff information.

1. Copy `.env.sync.example` to `.env.sync`.
2. Add a backend secret key for the LegiPulse source project and the new
   CivicPulse target project. Never use these keys in `VITE_` variables or
   expose them to browser code.
3. Run:

```bash
npm run sync:data
```

The script refuses to run when source and target URLs are identical. It upserts
public session, bill, and meeting snapshots so archived data stays available.

Without these settings, the app intentionally uses the included representative demo dataset so design and product development can continue safely.

## Production build

```bash
npm run build
npm start
```

`server.js` serves the Vite output and supports client-side routes.
