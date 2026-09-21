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

### Independent legislative-data sync

CivicPulse does not read from or write to the LegiPulse database. Its updater
reads bill and session data directly from LegiScan, reads meeting information
directly from the Georgia General Assembly, and writes only to the dedicated
CivicPulse Supabase project.

1. Copy `.env.sync.example` to `.env.sync`.
2. Add a server-side LegiScan API key and the CivicPulse project's backend
   secret key. Never put either key in a `VITE_` variable or expose it to
   browser code.
3. Run the updater manually when needed:

```bash
npm run sync:data
```

The updater refreshes every active regular or special session. Historical
sessions remain stored and are downloaded again only when LegiScan's
`dataset_hash` reports an archive correction. Bill writes are further limited
to new or changed `change_hash` values. Meetings for active sessions are
refreshed from the official Georgia schedule.

### Automatic updates

`.github/workflows/sync-legislative-data.yml` runs the same updater every six
hours and can also be started manually from the GitHub Actions page. Add these
repository secrets before enabling it:

- `LEGISCAN_API_KEY`
- `CIVICPULSE_SUPABASE_URL`
- `CIVICPULSE_SUPABASE_SECRET_KEY`

The scheduled job has no LegiPulse credentials and no connection to the
LegiPulse Supabase project.

Without these settings, the app intentionally uses the included representative demo dataset so design and product development can continue safely.

## Production build

```bash
npm run build
npm start
```

`server.js` serves the Vite output and supports client-side routes.
