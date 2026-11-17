# One-off: Yahoo (yfinance) sector/industry for every NSE EQ name above Rs 5 crore/day, to learn a map from Yahoo industry to NSE broad industry
# using the ~750 names NSE already classifies (Nifty 100/Midcap 150/Smallcap 250/Microcap 250). Writes data/india/probe-industry-yf.json. Output only.
import json, glob, time, urllib.request
import yfinance as yf
seg = json.load(open('data/india/segments.json'))
known = {**seg.get('scanExtra', {}), **seg['industry']}
if not seg.get('scanExtra'):
    req = urllib.request.Request('https://archives.nseindia.com/content/indices/ind_niftymicrocap250_list.csv', headers={'user-agent': 'Mozilla/5.0'})
    for l in urllib.request.urlopen(req, timeout=30).read().decode('utf-8-sig').splitlines()[1:]:
        c = l.split(',')
        if len(c) > 2 and c[2].strip() not in known: known[c[2].strip()] = c[1].strip()
files = sorted(glob.glob('data/india/bhav/20*.json'))[-20:]
tv = {}
for f in files:
    for s, r in json.load(open(f))['rows'].items():
        if r[0] == 'EQ' and r[5] and r[6]: tv.setdefault(s, []).append(r[5] * r[6])
names = [s for s, v in tv.items() if len(v) >= 15 and sum(v) / len(v) >= 5e7]   # Rs 5 crore = 5e7
print('names above floor', len(names), 'with NSE industry', sum(1 for s in names if s in known))
out = {}
for i, s in enumerate(sorted(names)):
    try:
        info = yf.Ticker(s + '.NS').info
        out[s] = {'sector': info.get('sector'), 'industry': info.get('industry'), 'nse': known.get(s)}
    except Exception as e:
        out[s] = {'error': str(e)[:80], 'nse': known.get(s)}
    if i % 50 == 0: print(i, flush=True)
    time.sleep(0.4)
json.dump(out, open('data/india/probe-industry-yf.json', 'w'), indent=0)
print('got', sum(1 for v in out.values() if v.get('industry')))
