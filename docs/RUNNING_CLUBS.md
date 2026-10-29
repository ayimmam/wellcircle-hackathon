# Running communities in Addis Ababa and Hawassa

The FYP renders `frontend/src/components/feed/RunningClubsCard.jsx` as a single banner below
stories and ahead of personalized content for every user, even when feed requests fail.
Its Explore Running Communities link opens `/running-clubs`, a separate shared
page with the community dropdown, details and contact links.
The banner stays above the personalized feed; it does not stick to the viewport. Both app
builds use this component and the same local artwork extracted from the supplied
`GreatRun Running Clubs – Telegram Mini App preview.html`.

The directory includes four Addis Ababa clubs and three Hawassa communities
from `docs/hawassa running clubs.pdf`: Hawassa Run LIT, Powerplus Gym and Robi
Fitness. Every option and detail identifies its city. Gym/fitness listings retain
their supplied category rather than being presented as verified running clubs.
Phone numbers use standard `tel:+251...` links. `@TEDLA GUYE` is a supplied display
name, not a valid Telegram username, so it is not turned into an invented URL.

Edit the directory in `frontend/src/data/runningClubs.js`. These are contact-led
club listings, not dated event reservations. The supplied schedules are a guide;
users must confirm current arrangements, local time conventions and fees with
the club. The GreatRun banner makes no race-date/countdown claim.

## Information still needed

- Hawassa Run LIT: a confirmed social/profile URL, meeting-point map and any
  schedule changes. Supplied: Mon/Wed/Fri 6 AM, Medaniyalem Church, Tedla Guye,
  0938651675.
- Powerplus Gym (Hawassa): Saturday time, exact location and social/profile URL.
  Supplied contacts: 0942425050 / 0967230500.
- Robi Fitness (Hawassa): next session date, time, exact location and profile URL.
  Supplied frequency: every 15 days; contact 0943313282.

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
