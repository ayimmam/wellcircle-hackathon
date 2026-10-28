# Well Circle development rules

- `frontend/src` is the single source for app features, routes, API functions,
  components, styling, translations, and tests used by the Telegram Mini App
  AND the browser app hosted on cPanel at `app.wellcircle.et`.
- Apply every feature, bug fix, UI change, and core-function change to that
  shared source. Never create another implementation under `wellcircle-web/src`.
- `wellcircle-web/src` owns browser authentication, its login/landing pages,
  session return destinations, phone-login country options, and browser CSS
  additions only. Its Vite config maps shared authentication imports to the
  browser AuthContext. `shared-source.js` enforces the small exception list.
- Keep Telegram-only pin bonuses, staff evidence submission and bot reminder
  delivery in `telegram-bot/`. Both apps expose these through Help & support.
  Do not invent browser rewards or browser notification delivery in their place.
- Before shipping an app feature, run `npm test --prefix frontend`,
  `npm run test:web --prefix frontend`, `npm run lint --prefix frontend`,
  `npm run build --prefix frontend`, and `npm run build --prefix wellcircle-web`.
  The web build checks parity and rejects duplicate feature imports.
- Include cPanel deployment in releases that change shared features. Follow
  `wellcircle-web/README.md`; a Vercel deployment does not update cPanel.
- Read `CLAUDE.md` for repository and backend conventions. Update
  `docs/API_CONTRACT.md` when the backend interface changes.
