# One-off probe (US Batch B coverage): operating income, trailing four quarters, from yfinance and the Polygon financials feed, against the figure SEC reports.
# Names: the first 150 non-financial top-500 names that report operating income to SEC (reference) and every non-financial name that does not. Writes data/us/probe-opinc.json. Public data; manual only.
import gzip, json, os, sys, time, glob
import urllib.request, urllib.error
sys.stdout.reconfigure(line_buffering=True)
F = json.load(open('data/us/fundamentals/latest.json'))
rows = F['rows']
names = [s for s, r in sorted(rows.items(), key=lambda kv: -(kv[1].get('tradedValue') or 0)) if not r.get('financial')]
def sec_ttm(sym):
    p = f'data/us/facts/{sym}.json.gz'
    if not os.path.exists(p): return None
    res = json.load(gzip.open(p))['results']
    last4 = res[-4:]
    if len(last4) < 4: return None
    vals = [q.get('extra', {}).get('q', {}).get('opIncome') for q in last4]
    return {'end': last4[-1]['period'], 'ttm': sum(vals) if all(v is not None for v in vals) else None}
ref, miss = [], []
for s in names:
    t = sec_ttm(s)
    if t and t['ttm'] is not None:
        if len(ref) < 150: ref.append(s)
    else: miss.append(s)
print(len(ref), 'reference;', len(miss), 'missing', flush=True)
out = {}
try:
    import yfinance as yf
except Exception as e:
    yf = None; print('no yfinance', e)
def yf_ttm(sym):
    q = yf.Ticker(sym).quarterly_income_stmt
    if q is None or q.empty: return None
    for lab in ('Operating Income', 'EBIT'):
        if lab in q.index:
            s = q.loc[lab].dropna()
            if len(s) >= 4:
                cols = sorted(s.index, reverse=True)[:4]
                return {'end': str(cols[0])[:10], 'ttm': float(sum(s[c] for c in cols)), 'label': lab}
    return None
KEY = os.environ.get('POLYGON_KEY', ''); poly_ok = bool(KEY); poly_t0 = time.time(); poly_status = None
def poly_ttm(sym):
    global poly_ok, poly_status
    u = f'https://api.polygon.io/vX/reference/financials?ticker={sym}&timeframe=ttm&limit=1&apiKey={KEY}'
    for a in range(3):
        try:
            j = json.load(urllib.request.urlopen(u, timeout=40)); poly_status = 200
            r = (j.get('results') or [None])[0]
            if not r: return None
            v = (r.get('financials', {}).get('income_statement', {}).get('operating_income_loss') or {}).get('value')
            return {'end': r.get('end_date'), 'ttm': v, 'filed': r.get('filing_date')}
        except urllib.error.HTTPError as e:
            poly_status = e.code
            if e.code == 429: time.sleep(15); continue
            if e.code in (401, 403): poly_ok = False
            return None
        except Exception: time.sleep(2)
    return None
for grp, lst in (('ref', ref), ('miss', miss)):
    for s in lst:
        o = {'group': grp, 'sec': sec_ttm(s)}
        if yf:
            try: o['yf'] = yf_ttm(s)
            except Exception as e: o['yf'] = {'error': str(e)[:80]}
            time.sleep(0.4)
        if poly_ok and (time.time() - poly_t0) < 1500: o['poly'] = poly_ttm(s)
        out[s] = o
    print(grp, 'done', len(out), 'polygon status', poly_status, flush=True)
json.dump({'polygonStatus': poly_status, 'rows': out}, open('data/us/probe-opinc.json', 'w'), indent=0)
