# US Batch B fallback (owner decision 17 Nov 2026: "use yfinance now"): quarterly operating income from yfinance, only for non-financial top-500 names whose
# SEC facts lack operating income in any of the last four quarters. Used by scripts/build-fundamentals-us.mjs ONLY for quarters SEC leaves empty; flagged in the table.
# Writes data/us/yf-opinc.json {fetchedAt, rows:{SYM:{quarters:{'YYYY-MM-DD':value}}}}. Names already fetched keep their rows if a later fetch fails.
import gzip, json, os, sys, time
sys.stdout.reconfigure(line_buffering=True)
import yfinance as yf
F = json.load(open('data/us/fundamentals/latest.json'))['rows']
OUT = 'data/us/yf-opinc.json'
old = json.load(open(OUT)) if os.path.exists(OUT) else {'rows': {}}
def lacks(sym):
    p = f'data/us/facts/{sym}.json.gz'
    if not os.path.exists(p): return False
    last4 = json.load(gzip.open(p))['results'][-4:]
    return any(q.get('extra', {}).get('q', {}).get('opIncome') is None for q in last4)
names = [s for s, r in sorted(F.items(), key=lambda kv: -(kv[1].get('tradedValue') or 0)) if not r.get('financial') and lacks(s)]
print(len(names), 'names lack operating income in a recent quarter')
rows = {}
for i, s in enumerate(names):
    try:
        q = yf.Ticker(s).quarterly_income_stmt
        v = None
        if q is not None and not q.empty:
            for lab in ('Operating Income', 'EBIT'):
                if lab in q.index:
                    x = q.loc[lab].dropna(); v = {str(c)[:10]: float(x[c]) for c in x.index}; break
        if v: rows[s] = {'quarters': v}
        elif s in old['rows']: rows[s] = old['rows'][s]
    except Exception as e:
        print(s, 'failed', str(e)[:60])
        if s in old['rows']: rows[s] = old['rows'][s]
    if i % 50 == 0: print(i, flush=True)
    time.sleep(0.4)
json.dump({'fetchedAt': time.strftime('%Y-%m-%dT%H:%MZ', time.gmtime()), 'source': 'yfinance quarterly_income_stmt', 'rows': rows}, open(OUT, 'w'))
print('rows', len(rows))
