import sys
import json
from pathlib import Path
sys.path.insert(0, sys.argv[1])  # Absolute path to a checkout of leonxlnx/earshot.
import soundfile as sf
from earshot.forge import bank

out = Path(__file__).resolve().parents[1] / 'src/assets/sounds'
palette = {
    'tap': ('fit/click/floss_lid', -23, {}),
    'open': ('ui_pop/soft', -25, {}),
    'close': ('ui_pop/fall', -27, {}),
    'success': ('notify/mid_tine', -21, {}),
    'error': ('knock/wood', -24, {}),
    'like': ('ui_pop/step', -24, {}),
    'navigate': ('whoosh_fast/tight', -29, {'dur': 0.24, 'apex': 0.06}),
    'loading': ('ui_pop/boop', -30, {}),
}
report = {'source': 'https://github.com/leonxlnx/earshot', 'bank': bank.VERSION, 'sounds': {}}
for name, (sound, peak, edits) in palette.items():
    y, meta = bank.render(sound, peak_db=peak, **edits)
    if not meta['checks']['ok']:
        raise RuntimeError((sound, meta['checks']))
    sf.write(str(out / f'{name}.wav'), y, 48000, subtype='PCM_16')
    report['sounds'][name] = meta
    print(name, json.dumps(meta), flush=True)
(out / 'earshot-report.json').write_text(json.dumps(report, indent=2))
(out / 'LICENSE-earshot.txt').write_text((Path(sys.argv[1]) / 'LICENSE').read_text())
