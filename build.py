#!/usr/bin/env python3
"""Inlines src/style.css and src/js/*.js into src/template.html and writes index.html."""
import glob, os, sys
root = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(root, 'src')
tpl = open(os.path.join(src, 'template.html'), encoding='utf-8').read()
css = open(os.path.join(src, 'style.css'), encoding='utf-8').read()
js = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(src, 'js', '*.js'))))
if '</script' in js.lower():
    sys.exit('JS contains a closing script tag')
out = tpl.replace('/*@@CSS@@*/', css).replace('/*@@JS@@*/', js)
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(out)
open('/tmp/bundle.js', 'w', encoding='utf-8').write('(function(){\n' + js + '\n})();')
print('built', len(out), 'bytes')
