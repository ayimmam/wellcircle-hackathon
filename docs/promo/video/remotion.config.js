import { Config } from '@remotion/cli/config';

// Serve the FRAME=video capture output directly: re-run ../capture.mjs and re-render, no copying.
Config.setPublicDir('../screens-video');
