# Maker Desk

Local continuation of [kaveh.grok.me](https://kaveh.grok.me/) — a Limitless CLOB desk for books you can print volume on without eating the spread.

The live grok.me app was built in Grok Build Mode. This repo is the editable source so we can keep shipping without the hosted remix lock.

## Run

```cmd
npm install
npm run dev
```

Or double-click `Start-Maker-Desk.cmd`. Open `http://127.0.0.1:5174/`.

The Vite dev server proxies `https://api.limitless.exchange` (browser CORS would block it).

## This slice

- Books / Packs / Traders, matching the live desk
- Local scoring: safest volume, most volume, highest win P, MAKE/TAKE tickets
- Watchlist in localStorage (no Grok login)
- FA / EN
- Referral `r=YVH0J7QD0S` on every Limitless link
- Share a ticket to X
- Wallet lookup on Traders
- Ambassador promo strip + disclosure

## Verify

```cmd
npm run test:run
npm run build
```
