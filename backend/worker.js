
/**
 * worker.js - production-ready worker (simulation)
 * Run separately (pm2 or systemd) as: node worker.js
 * Polls active accounts every minute and updates equity using price feed or market API
 */

const { Pool } = require('pg');
const cron = require('cron').CronJob;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:pass@localhost:5432/propdb' });
async function query(sql, params){ const r = await pool.query(sql, params); return r; }

// Per-account deterministic price seed idea: store seed in user_challenges (not implemented here)
// For now global price state:
const priceState = { price: 100, volatility: 0.002 };
function tickPrice() { const r = (Math.random() - 0.5) * 2; const change = priceState.price * priceState.volatility * r; priceState.price = Math.max(0.0001, priceState.price + change); return priceState.price; }

async function updateAll() {
  const currentPrice = tickPrice();
  const activeRes = await query("SELECT * FROM user_challenges WHERE status = 'ACTIVE'");
  for (const uc of activeRes.rows) {
    const tradesRes = await query('SELECT * FROM trades WHERE user_challenge_id=$1 AND status=$2', [uc.id, 'OPEN']);
    let unrealPnl = 0;
    for (const t of tradesRes.rows) {
      const dir = t.side === 'BUY' ? 1 : -1;
      unrealPnl += (currentPrice - parseFloat(t.entry_price)) * parseFloat(t.size) * dir;
    }
    const closedPnlRes = await query('SELECT COALESCE(SUM(pnl),0) AS s FROM trades WHERE user_challenge_id=$1 AND status=$2', [uc.id, 'CLOSED']);
    const closedSum = parseFloat(closedPnlRes.rows[0].s) || 0;
    const newEquity = parseFloat(uc.virtual_balance) + closedSum + unrealPnl;
    const newPeak = Math.max(parseFloat(uc.peak_equity), newEquity);
    const profitPct = (newEquity - parseFloat(uc.virtual_balance)) / parseFloat(uc.virtual_balance) * 100;
    const drawdownPct = (newPeak - newEquity) / newPeak * 100;

    await query('UPDATE user_challenges SET current_equity=$1, peak_equity=$2, profit_pct=$3, drawdown_pct=$4 WHERE id=$5', [
      newEquity, newPeak, profitPct, drawdownPct, uc.id
    ]);

    const chRes = await query('SELECT * FROM challenges WHERE id=$1', [uc.challenge_id]);
    const ch = chRes.rows[0];
    if (profitPct >= parseFloat(ch.target_pct)) {
      await query("UPDATE user_challenges SET status='PASSED' WHERE id=$1", [uc.id]);
      const payoutAmount = Math.min(ch.payout_cap, ch.payout_cap);
      await query('INSERT INTO payouts(user_challenge_id, user_id, amount, status) VALUES($1,$2,$3,$4)', [uc.id, uc.user_id, payoutAmount, 'PENDING']);
      console.log('PASSED', uc.account_login, payoutAmount);
    } else if (drawdownPct >= parseFloat(ch.max_drawdown_pct)) {
      await query("UPDATE user_challenges SET status='FAILED' WHERE id=$1", [uc.id]);
      console.log('FAILED', uc.account_login);
    }
  }
}

const job = new cron('*/1 * * * *', async ()=> { try { await updateAll(); } catch(e) { console.error(e); } });
job.start();
console.log('worker started');
