"""Make Wizard Chess's sound effects and voices with ElevenLabs, once.

    python3 make_audio.py sfx              sound effects -> sounds/<name>.mp3
    python3 make_audio.py lines            commentator and Professor Owl lines -> sounds/r-*.mp3, o-*.mp3
    python3 make_audio.py manifest         rewrite sounds/manifest.json

Voices are in audio_voices.json. The API key is read from ~/.elevenlabs_key.
The spoken lines come from the game itself (window.__wcLines) so they always match.
"""
import json, ssl, sys, time, urllib.request, functools, http.server, threading
from pathlib import Path
import certifi

HERE = Path(__file__).resolve().parent
OUT = HERE / 'sounds'
KEY = (Path.home() / '.elevenlabs_key').read_text().strip()
CTX = ssl.create_default_context(cafile=certifi.where())
VOICES = json.loads((HERE / 'audio_voices.json').read_text())

# name: (prompt, seconds)
SFX = {
    'move-p': ('a few quick footsteps of soldiers marching in armoured boots on a stone floor', 1.4),
    'move-n': ('a horse neighing, a short whinny, then a few galloping hooves on stone', 2.4),
    'move-b': ('a single deep solemn church bell toll, echoing in a cathedral', 2.6),
    'move-r': ('a heavy stone tower block grinding and sliding across a stone floor', 1.8),
    'move-q': ('magical sparkling shimmer and whoosh, enchanted fairy dust', 1.6),
    'move-k': ('a short regal medieval trumpet fanfare', 2.2),
    'battlecry': ('a fierce medieval knight shouting a short battle cry, charge', 1.3),
    'slash': ('a sword slashing swoosh followed by a metal clang', 1.0),
    'shatter': ('a stone statue being smashed and shattering into pieces, rubble falling', 2.0),
    'check': ('a deep medieval war horn blast, echoing', 2.2),
    'checkmate': ('huge cathedral bells ringing out in celebration', 4.5),
    'castle': ('a heavy castle portcullis gate with rattling chains', 2.0),
    'promote': ('an angelic choir singing a magical transformation chord with sparkles', 2.6),
    'start': ('a short roll of medieval war drums ending in a boom', 2.2),
    'owl': ('an owl hooting softly twice in a quiet night', 1.6),
    'fireball': ('a wizard casting a fireball: a magical whoosh of roaring fire flying through the air', 1.6),
    'arrow': ('a bow string twang and a magic arrow whistling through the air with a shimmering sparkle', 1.2),
    'beam': ('a holy beam of light: an angelic shimmering hum rising to a bright magical zap', 1.6),
    'firework': ('a single firework rocket bursting with a bang and crackling sparkles', 2.0),
}


def post(path, body):
    req = urllib.request.Request('https://api.elevenlabs.io/v1' + path, data=json.dumps(body).encode(),
                                 headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                return r.read()
        except Exception as e:
            print('  retry', path, e); time.sleep(3)
    raise RuntimeError('failed ' + path)


def lines():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(HERE))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        p = b.new_page(); p.goto(f'http://127.0.0.1:{srv.server_port}/#lesson=backrank', wait_until='domcontentloaded')
        p.wait_for_function('window.__wcLines', timeout=60000)
        out = p.evaluate('window.__wcLines()'); b.close()
    srv.shutdown()
    return out


def manifest():
    keys = sorted(f.stem for f in OUT.glob('*.mp3') if f.stat().st_size > 1000)
    (OUT / 'manifest.json').write_text(json.dumps(keys))
    print('manifest:', len(keys), 'clips')


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
    if cmd == 'sfx':
        for name, (prompt, secs) in SFX.items():
            f = OUT / f'{name}.mp3'
            if f.exists() and '--redo' not in sys.argv: continue
            f.write_bytes(post('/sound-generation', {'text': prompt, 'duration_seconds': secs, 'prompt_influence': 0.5}))
            print('sfx', name)
    elif cmd == 'lines':
        L = lines()
        print(len(L), 'lines,', sum(len(t) for t in L.values()), 'characters')
        settings = {'ron': {'stability': 0.35, 'similarity_boost': 0.8, 'style': 0.55, 'use_speaker_boost': True},
                    'owl': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.3, 'use_speaker_boost': True}}
        for i, (k, text) in enumerate(L.items()):
            f = OUT / f'{k}.mp3'
            if f.exists() and f.stat().st_size > 1000: continue
            who = 'ron' if k.startswith('r-') else 'owl'
            f.write_bytes(post(f'/text-to-speech/{VOICES[who]}?output_format=mp3_44100_128',
                               {'text': text, 'model_id': 'eleven_multilingual_v2', 'voice_settings': settings[who]}))
            if i % 25 == 0: print(f'{i + 1}/{len(L)}', k)
    manifest()
