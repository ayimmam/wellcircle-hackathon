Interface sounds are generated from Earshot 0.4.0's DSP bank, not recordings.
Source: https://github.com/leonxlnx/earshot (MIT; license included).
The fitted click's source is CC0: the bank entry `fit/click/floss_lid`
retains its provenance in Earshot's `earshot/forge/bank/fit.json`.

Reproduce from a Python environment with numpy, scipy, soundfile, numba and
pyloudnorm installed:

```sh
python frontend/scripts/generate-ui-sounds.py /absolute/path/to/earshot
```

`earshot-report.json` contains the rendered assets' onset, length, peak,
momentary loudness and model-free audit. All eight have zero audit warnings.
The close cue's tail note describes the bank member's intentional second pop.
Realness and semantic models were not run; these are deliberately synthesized
UI effects. Measurements do not establish aesthetic quality; audition on
phones and headphones for taste and volume preferences.

The shared AppShell enables feedback after a user gesture. Browser and
Telegram Mini App builds import these same assets. The menu's Interface
sounds toggle persists on this device. Telegram chat messages and inline
keyboard buttons use Telegram's own notification/audio behavior.

The additional iPhone-inspired UI roles are `like` (ui_pop/step), `navigate`
(whoosh_fast/tight, shaped to 240 ms), and `loading` (ui_pop/boop). These are
original Earshot bank renders, not Apple sound recordings. Their measured peaks
are -24, -29 and -30 dBFS respectively; all pass the bank audit without warnings.
Route changes play once after a gesture; the initial route stays silent.
Concurrent cold resources share one loading cue after 700 ms, canceled when
loading ends. Cached/fast requests and background polling stay silent. The same
device mute preference controls every role.
