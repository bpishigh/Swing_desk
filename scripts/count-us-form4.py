# US Batch C, U-2 count only (docs/BATCH_C_US_PROPOSALS.md): open-market insider purchases (Form 4, code P, non-derivative) by officers or directors,
# one insider's lines in a filing added up, at least $250,000, form type 4 (amendments excluded). Counted per year for the current top-500 and the wider US eligible list. No returns read.
# Source: SEC quarterly Form 3/4/5 data sets. Writes data/us/count-form4.json.
import csv, io, json, os, sys, urllib.request, zipfile, collections, statistics, glob
csv.field_size_limit(10**8); sys.stdout.reconfigure(line_buffering=True)
UA = os.environ.get('SEC_UA') or 'swing-desk research noreply@github.com'
top = set(json.load(open('data/us/fundamentals/latest.json'))['rows'])
tk = json.load(open(sorted(glob.glob('data/us/tickers-*.json'))[-1]))
wide = {r[0] for r in tk['rows'] if r[1] in ('CS', 'ADRC')}
FLOOR = 250000
ev = []   # (date, sym, owner, value, lag, ceoCfo)
for y in range(2021, 2027):
    for q in range(1, 5):
        if y == 2026 and q > 3: continue
        url = f'https://www.sec.gov/files/structureddata/data/form-345/{y}q{q}_form345.zip'
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=300).read()
        except Exception as e:
            print(y, q, 'failed', e); continue
        z = zipfile.ZipFile(io.BytesIO(data))
        rd = lambda n: csv.DictReader(io.TextIOWrapper(z.open(n), encoding='utf-8', errors='replace'), delimiter='\t')
        sub = {r['ACCESSION_NUMBER']: r for r in rd('SUBMISSION.tsv') if r['DOCUMENT_TYPE'] == '4'}
        own = collections.defaultdict(dict)
        for r in rd('REPORTINGOWNER.tsv'):
            if r['ACCESSION_NUMBER'] in sub: own[r['ACCESSION_NUMBER']][r['RPTOWNERCIK']] = r
        agg = collections.defaultdict(float); tdate = {}
        for r in rd('NONDERIV_TRANS.tsv'):
            a = r['ACCESSION_NUMBER']
            if a not in sub or r['TRANS_CODE'] != 'P' or r.get('TRANS_ACQUIRED_DISP_CD') != 'A' or r.get('EQUITY_SWAP_INVOLVED') in ('1', 'true', 'TRUE'): continue
            try: v = float(r['TRANS_SHARES']) * float(r['TRANS_PRICEPERSHARE'])
            except: continue
            agg[a] += v; tdate[a] = min(tdate.get(a, r['TRANS_DATE']), r['TRANS_DATE'])
        n = 0
        for a, v in agg.items():
            if v < FLOOR: continue
            s = sub[a]; sym = (s['ISSUERTRADINGSYMBOL'] or '').strip().upper()
            if sym not in wide: continue
            owners = [o for o in own[a].values() if 'Officer' in o['RPTOWNER_RELATIONSHIP'] or 'Director' in o['RPTOWNER_RELATIONSHIP']]
            if not owners: continue
            from datetime import datetime as D
            f = D.strptime(s['FILING_DATE'], '%d-%b-%Y'); t = D.strptime(tdate[a], '%d-%b-%Y')
            title = ' '.join(o['RPTOWNER_TITLE'].upper() for o in owners)
            ev.append((f.strftime('%Y-%m-%d'), sym, owners[0]['RPTOWNER_NAME'] if 'RPTOWNER_NAME' in owners[0] else owners[0]['RPTOWNER_CIK'] if 'RPTOWNER_CIK' in owners[0] else a, v, (f - t).days, any(k in title for k in ('CEO', 'CHIEF EXECUTIVE', 'CFO', 'CHIEF FINANCIAL'))))
            n += 1
        print(y, q, 'events', n, flush=True)
def block(universe):
    by = collections.defaultdict(list)
    for e in ev:
        if e[1] in universe: by[e[0][:4]].append(e)
    out = {}
    for y, es in sorted(by.items()):
        dates = sorted(e[0] for e in es)
        out[y] = {'events': len(es), 'issuers': len({e[1] for e in es}), 'ceoCfo': sum(e[5] for e in es), 'medianLagDays': statistics.median(e[4] for e in es), 'medianValue': round(statistics.median(e[3] for e in es))}
    return out
res = {'rule': 'Form 4 code P, non-derivative, officer or director, one insider per filing summed, at least $250,000, form 4 only; filing date; no returns read', 'universes': {'top500Current': len(top), 'wideEligibleCurrent': len(wide)}, 'top500': block(top), 'wide': block(wide)}
json.dump(res, open('data/us/count-form4.json', 'w'), indent=1); print(json.dumps(res, indent=1))
