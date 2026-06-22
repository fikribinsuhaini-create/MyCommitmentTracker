# Commitment Tracker

Mobile-first vanilla JavaScript PWA for monthly salary, commitments, savings, and remaining balance.

## Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Supabase Auth + Postgres
- Vercel static deploy

## Local setup

1. Create Supabase project.
2. Run SQL in `C:\Users\fikri\Documents\Codex\2026-06-22\c\supabase.sql`.
3. Edit `C:\Users\fikri\Documents\Codex\2026-06-22\c\config.js` with project URL and anon key.
4. Serve folder with static server.

## Deploy to Vercel

- Framework preset: `Other`
- Output directory: project root
- No build command needed

## Notes

- Private Vault PIN in `profiles.private_vault_pin` for casual privacy only.
- Dashboard excludes private savings totals by design.
- Commitment paid status resets each month because payments stored per `month`.
- Monthly snapshots auto-upsert on data refresh.
