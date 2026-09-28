import { Composition, registerRoot } from 'remotion';
import { withAudio } from './audio.jsx';
import { Booking, DURATION as BOOKING } from './Booking.jsx';
import { Community, DURATION as COMMUNITY } from './Community.jsx';

const video = { fps: 30, width: 1080, height: 1920 };

// Silent cuts (add trending audio at upload) and narrated cuts (voice-over + music bed).
const BookingNarrated = withAudio(Booking, 'Booking', BOOKING);
const CommunityNarrated = withAudio(Community, 'Community', COMMUNITY);

const Root = () => <>
  <Composition id="Booking" component={Booking} durationInFrames={BOOKING} {...video} />
  <Composition id="Community" component={Community} durationInFrames={COMMUNITY} {...video} />
  <Composition id="BookingNarrated" component={BookingNarrated} durationInFrames={BOOKING} {...video} />
  <Composition id="CommunityNarrated" component={CommunityNarrated} durationInFrames={COMMUNITY} {...video} />
</>;

registerRoot(Root);
