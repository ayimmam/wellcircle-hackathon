# Pinned Addis running clubs

The FYP renders `frontend/src/components/feed/RunningClubsCard.jsx` ahead of
stories and personalized content for every user, even when feed requests fail.
This is a permanent first placement, not a viewport-sticky panel. Both app
builds use this component and the same local artwork extracted from the supplied
`GreatRun Running Clubs – Telegram Mini App preview.html`.

Edit the directory in `frontend/src/data/runningClubs.js`. These are contact-led
club listings, not dated event reservations. The supplied schedules are a guide;
users must confirm current arrangements, local time conventions and fees with
the club. The GreatRun banner makes no race-date/countdown claim.

## Information still needed

- Bole Burners: confirmed TikTok profile URL for `@boleburners`; meeting points
  for Saturday and Wednesday. Supplied times: Saturday 7 AM, Wednesday 6 PM.
- Sonder: confirmed TikTok profile URL for `@sonder.running.cl`; Sunday start
  time and meeting point.
- Bertusew: Sunday start time and precise location/map for the run. The preview
  says Megenagna / Yetebabert Square Sport Center; older repository records say
  CMC, so the area is omitted until clarified. Telegram link supplied:
  https://t.me/bertusewrunningclub.
- Satenaw: Sunday start time and meeting point; any Friendship Park entrance
  fee. Supplied Thursday schedule: 5:30 PM at Friendship Park. Telegram link:
  https://t.me/satenaw_runclub.
- All clubs: changes to indicative schedules and confirmation that clock times
  use the international clock rather than Ethiopian clock time.
- Bertusew walk: next confirmed date and time. The supplied 18/02/2019 Ethiopian
  calendar announcement, 12:00 meeting / 12:35 departure, is shown as historical
  only. Its Piazza map is retained for reference, not advertised as a next event.

Missing profile URLs are plain contact instructions, never dead CTA links.
Telegram links use the native Mini App API when signed initData is present;
browser builds retain normal external anchors. No bot polling worker change
is needed: the Telegram Mini App runs the same shared FYP.
