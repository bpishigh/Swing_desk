// Sends one Telegram message. Usage: node scripts/alert.mjs "text"
// Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (GitHub repository secrets). Exits 1 on any failure so a broken channel is visible in CI.
const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHAT_ID;
const text = process.argv.slice(2).join(' ') || 'Swing Desk test alert';
if (!token || !chat) { console.error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set'); process.exit(1); }
const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: chat, text: `Swing Desk: ${text}` }),
});
const body = await res.text();
if (!res.ok) { console.error('Telegram error', res.status, body.slice(0, 200)); process.exit(1); }
console.log('alert sent');
