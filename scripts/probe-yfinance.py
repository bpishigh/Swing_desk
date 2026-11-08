# One-off probe: what yfinance returns for NSE stocks (depth, dates, fields). Writes data/probe-yfinance.json. Public data only.
import json, datetime, warnings
warnings.filterwarnings("ignore")
import yfinance as yf
out = {"at": datetime.datetime.utcnow().isoformat() + "Z", "version": yf.__version__, "rows": {}}
for s in ["RELIANCE.NS", "ADANIENT.NS", "KPITTECH.NS", "JPPOWER.NS", "TCS.NS"]:
    t = yf.Ticker(s); r = {}
    def rng(df):
        try:
            return None if df is None or len(df) == 0 else [str(df.index.min())[:10], str(df.index.max())[:10]]
        except Exception: return None
    for name, fn in [
        ("quarterly_income_stmt", lambda: t.quarterly_income_stmt),
        ("income_stmt", lambda: t.income_stmt),
        ("quarterly_balance_sheet", lambda: t.quarterly_balance_sheet),
        ("earnings_dates", lambda: t.get_earnings_dates(limit=60)),
        ("insider_transactions", lambda: t.insider_transactions),
        ("insider_roster", lambda: t.insider_roster_holders),
        ("major_holders", lambda: t.major_holders),
        ("institutional_holders", lambda: t.institutional_holders),
        ("mutualfund_holders", lambda: t.mutualfund_holders),
        ("actions", lambda: t.actions),
        ("calendar", lambda: t.calendar),
    ]:
        try:
            d = fn()
            if d is None: r[name] = None
            elif isinstance(d, dict): r[name] = {"dict_keys": list(d.keys())[:12], "sample": {k: str(v)[:60] for k, v in list(d.items())[:6]}}
            elif name in ("quarterly_income_stmt", "income_stmt", "quarterly_balance_sheet"):
                r[name] = {"cols": [str(c)[:10] for c in d.columns], "rows": len(d.index), "sample_rows": [str(i) for i in list(d.index)[:8]]}
            else:
                r[name] = {"n": len(d), "range": rng(d), "cols": [str(c) for c in d.columns][:12], "head": json.loads(d.head(3).to_json(date_format="iso", default_handler=str)) if len(d) else None}
        except Exception as e:
            r[name] = {"err": f"{type(e).__name__}: {str(e)[:100]}"}
    out["rows"][s] = r
json.dump(out, open("data/probe-yfinance.json", "w"), indent=1, default=str)
for s, r in out["rows"].items():
    print(s, {k: (v if v is None or "err" in (v or {}) else (v.get("cols") if "cols" in v and "n" not in v else (v.get("n"), v.get("range")))) for k, v in r.items()})
