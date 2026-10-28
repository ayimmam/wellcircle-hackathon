// Club information and artwork supplied in docs/GreatRun Running Clubs – Telegram Mini App preview.html.
// Schedules are indicative, not dated events. Keep missing destinations null rather than inventing links.
export const runningClubs = [
  {
    id: 'bert', city: 'Addis Ababa', image: '/running-clubs/bert.jpg', name: 'Bertusew Running Club', subtitle: 'Sunday social runs · 4–6 km',
    description: 'Friendly Sunday social runs open to everyone. Social runs are free.',
    tags: ['Running', 'Free', 'Open to everyone'],
    details: [['Schedule', 'Sunday social run · contact the club for the start time'], ['Meet at', 'Yetebabert Square Sport Center meeting square. Confirm the exact location with the club.'], ['Distance', '4–6 km'], ['Open to', 'Everyone']],
    url: 'https://t.me/bertusewrunningclub', action: 'Join Telegram Community',
    walk: true,
  },
  {
    id: 'sat', city: 'Addis Ababa', image: '/running-clubs/sat.jpg', name: 'Satenaw Running Club', subtitle: 'Thursdays · Friendship Park',
    description: 'Group runs to keep your 10K training on track.',
    tags: ['Running', 'Open to everyone'],
    details: [['Thursday', '5:30 PM · Friendship Park'], ['Sunday', 'Additional session · contact the club for the time and location'], ['Open to', 'Everyone']],
    url: 'https://t.me/satenaw_runclub', action: 'Join Telegram Community',
  },
  {
    id: 'bole', city: 'Addis Ababa', image: '/running-clubs/bole.jpg', name: 'Bole Burners Running Club', subtitle: 'Saturday & Wednesday runs',
    description: 'Early-morning and midweek evening runs with a lively crew.',
    tags: ['Running', 'Open to everyone'],
    details: [['Saturday', '7:00 AM'], ['Wednesday', '6:00 PM'], ['Meet at', 'Contact the club for the meeting point'], ['Open to', 'Everyone'], ['TikTok', '@boleburners']],
    url: null, missingContact: 'Find @boleburners on TikTok for the latest updates. A confirmed profile link will be added here.',
  },
  {
    id: 'son', city: 'Addis Ababa', image: '/running-clubs/son.jpg', name: 'Sonder Running Club', subtitle: 'Sunday session',
    description: 'Sunday group runs for runners of every level.',
    tags: ['Running', 'Open to everyone'],
    details: [['Sunday', 'Running session · contact the club for the time and location'], ['Open to', 'Everyone'], ['TikTok', '@sonder.running.cl']],
    url: null, missingContact: 'Find @sonder.running.cl on TikTok for the latest updates. A confirmed profile link will be added here.',
  },
  // Source: docs/hawassa running clubs.pdf. Display names are not Telegram usernames.
  {
    id: 'hawassa-run-lit', city: 'Hawassa', name: 'Hawassa Run LIT',
    subtitle: 'Monday, Wednesday & Friday · 6:00 AM',
    description: 'Meet the Hawassa running community at Medaniyalem Church. Contact Tedla Guye to confirm your next run.',
    tags: ['Running'],
    details: [['Location', 'Hawassa'], ['Schedule', 'Every Monday, Wednesday and Friday at 6:00 AM'], ['Meet at', 'Medaniyalem Church, Hawassa'], ['Contact', 'Tedla Guye (@TEDLA GUYE)']],
    phones: ['0938651675'],
  },
  {
    id: 'powerplus', city: 'Hawassa', name: 'Powerplus Gym',
    subtitle: 'Weekly · Saturday',
    description: 'A Hawassa fitness community. Call the organizers for the Saturday session time and meeting point.',
    tags: ['Fitness'],
    details: [['Location', 'Hawassa'], ['Schedule', 'Every Saturday'], ['Time & place', 'Contact the organizers to confirm']],
    phones: ['0942425050', '0967230500'],
  },
  {
    id: 'robi', city: 'Hawassa', name: 'Robi Fitness', subtitle: 'Every 15 days',
    description: 'A Hawassa fitness community. Call to confirm the next session date, time and location.',
    tags: ['Fitness'],
    details: [['Location', 'Hawassa'], ['Schedule', 'Every 15 days'], ['Next session', 'Contact the organizers for the date, time and location']],
    phones: ['0943313282'],
  },
];
