// Club information and artwork supplied in docs/GreatRun Running Clubs – Telegram Mini App preview.html.
// Schedules are indicative, not dated events. Keep missing destinations null rather than inventing links.
export const runningClubs = [
  {
    id: 'bert', name: 'Bertusew Running Club', subtitle: 'Sunday social runs · 4–6 km',
    description: 'Friendly Sunday social runs open to everyone. Social runs are free.',
    tags: ['Running', 'Free', 'Open to everyone'],
    details: [['Schedule', 'Sunday social run · contact the club for the start time'], ['Meet at', 'Yetebabert Square Sport Center meeting square. Confirm the exact location with the club.'], ['Distance', '4–6 km'], ['Open to', 'Everyone']],
    url: 'https://t.me/bertusewrunningclub', action: 'Join Telegram Community',
    walk: true,
  },
  {
    id: 'sat', name: 'Satenaw Running Club', subtitle: 'Thursdays · Friendship Park',
    description: 'Group runs to keep your 10K training on track.',
    tags: ['Running', 'Open to everyone'],
    details: [['Thursday', '5:30 PM · Friendship Park'], ['Sunday', 'Additional session · contact the club for the time and location'], ['Open to', 'Everyone']],
    url: 'https://t.me/satenaw_runclub', action: 'Join Telegram Community',
  },
  {
    id: 'bole', name: 'Bole Burners Running Club', subtitle: 'Saturday & Wednesday runs',
    description: 'Early-morning and midweek evening runs with a lively crew.',
    tags: ['Running', 'Open to everyone'],
    details: [['Saturday', '7:00 AM'], ['Wednesday', '6:00 PM'], ['Meet at', 'Contact the club for the meeting point'], ['Open to', 'Everyone'], ['TikTok', '@boleburners']],
    url: null, missingContact: 'Find @boleburners on TikTok for the latest updates. A confirmed profile link will be added here.',
  },
  {
    id: 'son', name: 'Sonder Running Club', subtitle: 'Sunday session',
    description: 'Sunday group runs for runners of every level.',
    tags: ['Running', 'Open to everyone'],
    details: [['Sunday', 'Running session · contact the club for the time and location'], ['Open to', 'Everyone'], ['TikTok', '@sonder.running.cl']],
    url: null, missingContact: 'Find @sonder.running.cl on TikTok for the latest updates. A confirmed profile link will be added here.',
  },
];
