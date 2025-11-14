
TradeVerse Production bundle - README
------------------------------------

Files:
- backend/server.js      --> main API server
- backend/worker.js      --> scheduled worker for simulation and pass/fail
- backend/schema.sql     --> Postgres schema (run in your DB)
- frontend/pages/*       --> Next.js frontend pages

ENV variables required (backend):
- DATABASE_URL  (e.g., postgres://user:pass@host:5432/dbname)
- CASHFREE_APP_ID
- CASHFREE_SECRET_KEY
- PORT (optional)

How to run (local):
1. Create Postgres DB and run backend/schema.sql
2. Install dependencies:
   cd backend
   npm install express pg body-parser axios uuid cron
3. Start server:
   node server.js
4. Start worker:
   node worker.js
5. Frontend (Next.js):
   cd frontend
   npm install next react react-dom axios swr
   npm run dev

Cashfree payment flow (Option A - Payment Links):
- Create payment links in Cashfree dashboard for each challenge price.
- In admin UI, create challenge and paste payment_link.
- Users click payment link, pay on Cashfree page, then copy payment reference and go to /verify page to paste it.
- Backend /api/payment/confirm verifies reference via Cashfree API and creates user_challenge account.

Security & production notes:
- Use HTTPS, secure env vars, add JWT/Firebase Auth for users and admin.
- Implement deterministic seed for reproducible price series (store seed in user_challenges.seed).
- Add anti-cheat rules and manual review for flagged accounts.
- Use PM2 or systemd to keep worker running.
