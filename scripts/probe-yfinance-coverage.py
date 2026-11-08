# One-off probe, round 2: yfinance earnings-surprise coverage over the samples chosen by probe-filings-coverage.mjs. Writes data/probe-yfinance-coverage.json. Public data only.
import json, time, datetime, warnings
warnings.filterwarnings("ignore")
import yfinance as yf
s = json.load(open("data/probe-filings-coverage.json"))
india = [x + ".NS" for x in s["india"]["sample"]["listed"]] + [x + ".NS" for x in s["india"]["sample"]["absentNow"]]
us = s["us"]["sample"]
out = {"at": datetime.datetime.utcnow().isoformat() + "Z", "version": yf.__version__, "india": {}, "us": {}}
def probe(sym):
    r = {}
    try:
        ed = yf.Ticker(sym).get_earnings_dates(limit=100)
        if ed is None or len(ed) == 0: return {"n": 0}
        rep = ed.dropna(subset=["Reported EPS"])
        est = rep.dropna(subset=["EPS Estimate"])
        r = {"n": len(ed), "reported": len(rep), "withEstimate": len(est), "first": str(rep.index.min())[:10] if len(rep) else None, "last": str(rep.index.max())[:10] if len(rep) else None}
    except Exception as e:
        r = {"err": f"{type(e).__name__}: {str(e)[:80]}"}
    return r
for sym in india: out["india"][sym] = probe(sym); time.sleep(0.6)
for sym in us: out["us"][sym] = probe(sym); time.sleep(0.6)
json.dump(out, open("data/probe-yfinance-coverage.json", "w"), indent=1)
for m in ("india", "us"):
    v = out[m].values(); ok = [x for x in v if x.get("reported", 0) >= 8]
    print(m, "stocks", len(out[m]), ">=8 reported quarters", len(ok), "with estimate >=8", sum(1 for x in v if x.get("withEstimate", 0) >= 8), "errors", sum(1 for x in v if "err" in x), "empty", sum(1 for x in v if x.get("n") == 0))
