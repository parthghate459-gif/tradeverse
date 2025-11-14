
/**
 * TradeVerse Production-ready Backend (Template)
 * - Uses Postgres (DATABASE_URL env)
 * - Admin endpoints to create challenges (with Cashfree payment link)
 * - /api/payment/confirm to verify Cashfree payment references (uses Cashfree Orders API)
 * - Worker logic (separate worker.js) handles simulation and pass/fail
 *
 * NOTE: You MUST set environment variables:
 * DATABASE_URL, CASHFREE_APP_ID, CASHFREE_SECRET_KEY, PORT
 *
 * Replace Cashfree verification logic with your merchant credentials.
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:pass@localhost:5432/propdb' });
async function query(sql, params){ const r = await pool.query(sql, params); return r; }

function genAccountLogin(){ return 'ACCT' + Math.floor(Math.random()*900000 + 100000); }

/** Admin: create challenge */
app.post('/api/admin/create-challenge', async (req, res) => {
  try {
    const { name, virtual_balance, target_pct, max_drawdown_pct, price_inr, payout_cap, duration_days, payment_link } = req.body;
    const r = await query(`INSERT INTO challenges(name, virtual_balance, target_pct, max_drawdown_pct, price_inr, payout_cap, duration_days, payment_link) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [
      name, virtual_balance, target_pct, max_drawdown_pct, price_inr, payout_cap||5000, duration_days||30, payment_link||null
    ]);
    res.json({ ok:true, challenge: r.rows[0] });
  } catch(e){ console.error(e); res.status(500).json({error:'db_error'}); }
});

/**
 * Payment confirmation endpoint (Option A flow - user pastes Cashfree payment reference)
 * In production, you should verify via Cashfree Orders / Payments API using your secret key.
 *
 * Expected body:
 * { user_id: "<uuid>", challenge_id: "<uuid>", cashfree_ref: "<order id or ref>" }
 */
app.post('/api/payment/confirm', async (req, res) => {
  try {
    const { user_id, challenge_id, cashfree_ref } = req.body;
    if(!user_id || !challenge_id || !cashfree_ref) return res.status(400).json({error:'missing'});
    // Verify with Cashfree - sample call (replace URL with real endpoint)
    // Docs: https://docs.cashfree.com/
    const appId = process.env.CASHFREE_APP_ID || '';
    const secret = process.env.CASHFREE_SECRET_KEY || '';
    // Example: GET /orders/{order_id} - here we'll simulate verification
    // const verifyUrl = `https://api.cashfree.com/pg/orders/${cashfree_ref}`;
    // const cfRes = await axios.get(verifyUrl, { headers: { 'x-client-id': appId, 'x-client-secret': secret }});
    // if(cfRes.data && cfRes.data.order && cfRes.data.order.status === 'PAID') { /* ok */ }
    // For now, assume verification success (mock)
    const verified = true;

    if(!verified) return res.status(400).json({ error:'not_paid' });

    // create user_challenge (same as webhook earlier)
    const chRes = await query('SELECT * FROM challenges WHERE id=$1', [challenge_id]);
    if(!chRes.rowCount) return res.status(400).json({ error:'challenge_missing' });
    const plan = chRes.rows[0];

    const accountLogin = genAccountLogin();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.duration_days * 24*3600*1000);

    const ins = await query(`INSERT INTO user_challenges(
      user_id, challenge_id, account_login, virtual_balance, current_equity, peak_equity, status, start_at, expires_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [
      user_id, challenge_id, accountLogin, plan.virtual_balance, plan.virtual_balance, plan.virtual_balance, 'ACTIVE', now, expiresAt
    ]);

    res.json({ ok:true, account: ins.rows[0] });
  } catch(e){ console.error(e); res.status(500).json({error:'server_error'}); }
});

/** Get challenges */
app.get('/api/challenges', async (req, res) => {
  const r = await query('SELECT id,name,price_inr,target_pct,virtual_balance,payment_link FROM challenges ORDER BY created_at DESC');
  res.json(r.rows);
});

/** Get account status */
app.get('/api/accounts/:login', async (req, res) => {
  const login = req.params.login;
  const r = await query('SELECT * FROM user_challenges WHERE account_login = $1', [login]);
  if (!r.rowCount) return res.status(404).send('not found');
  const uc = r.rows[0];
  const trades = await query('SELECT * FROM trades WHERE user_challenge_id = $1 AND status = $2', [uc.id, 'OPEN']);
  res.json({ account: uc, trades: trades.rows });
});

app.post('/api/accounts/:login/place-trade', async (req, res) => {
  const login = req.params.login;
  const { side='BUY', size=100, symbol='INSTR1', entry_price=null } = req.body;
  const r = await query('SELECT * FROM user_challenges WHERE account_login = $1', [login]);
  if (!r.rowCount) return res.status(404).send('acct not found');
  const uc = r.rows[0];
  if (uc.status !== 'ACTIVE') return res.status(400).send('not active');

  const price = entry_price || (100 + Math.random()*2);
  const tId = uuidv4();
  await query('INSERT INTO trades(id, user_challenge_id, side, symbol, entry_price, size, status) VALUES($1,$2,$3,$4,$5,$6,$7)', [
    tId, uc.id, side, symbol, price, size, 'OPEN'
  ]);
  res.json({ ok: true, tradeId: tId, entry_price: price });
});

app.post('/api/accounts/:login/close-trade', async (req, res) => {
  const login = req.params.login;
  const { tradeId, exitPrice=null } = req.body;
  const tr = await query('SELECT * FROM trades WHERE id = $1', [tradeId]);
  if (!tr.rowCount) return res.status(404).send('trade not found');
  const trade = tr.rows[0];
  if (trade.status !== 'OPEN') return res.status(400).send('not open');

  const price = exitPrice || (100 + Math.random()*2);
  const dir = trade.side === 'BUY' ? 1 : -1;
  const pnl = (price - trade.entry_price) * parseFloat(trade.size) * dir;

  await query('UPDATE trades SET status=$1, pnl=$2, closed_at=now() WHERE id=$3', ['CLOSED', pnl, tradeId]);

  const ucRes = await query('SELECT * FROM user_challenges WHERE id=$1', [trade.user_challenge_id]);
  const uc = ucRes.rows[0];
  const closedPnlRes = await query('SELECT COALESCE(SUM(pnl),0) AS s FROM trades WHERE user_challenge_id=$1 AND status=$2', [uc.id, 'CLOSED']);
  const closedSum = parseFloat(closedPnlRes.rows[0].s);
  const newEquity = parseFloat(uc.virtual_balance) + closedSum;
  const newPeak = Math.max(parseFloat(uc.peak_equity), newEquity);
  const profitPct = (newEquity - parseFloat(uc.virtual_balance)) / parseFloat(uc.virtual_balance) * 100;
  const drawdownPct = (newPeak - newEquity) / newPeak * 100;

  await query('UPDATE user_challenges SET current_equity=$1, peak_equity=$2, profit_pct=$3, drawdown_pct=$4 WHERE id=$5', [
    newEquity, newPeak, profitPct, drawdownPct, uc.id
  ]);

  res.json({ ok:true, pnl, newEquity, profitPct, drawdownPct });
});

const port = process.env.PORT || 3001;
app.listen(port, ()=>console.log('server', port));
