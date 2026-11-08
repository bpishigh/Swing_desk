# One-off probe: what yfinance returns for US stocks (depth, dates, fields). Writes data/probe-us-yfinance.json. Public data only.
import json, datetime, warnings
warnings.filterwarnings("ignore")
import yfinance as yf
out = {"at": datetime.datetime.utcnow().isoformat() + "Z", "version": yf.__version__, "rows": {}}
for s in ["AAPL", "NVDA", "CELH", "PLUG", "SIVB"]:
    t = yf.Ticker(s); r = {}
    for name, fn in [
        ("quarterly_income_stmt", lambda: t.quarterly_income_stmt),
        ("earnings_dates", lambda: t.get_earnings_dates(limit=100)),
        ("insider_transactions", lambda: t.insider_transactions),
        ("institutional_holders", lambda: t.institutional_holders),
        ("major_holders", lambda: t.major_holders),
        ("upgrades_downgrades", lambda: t.upgrades_downgrades),
        ("short_info", lambda: {k: v for k, v in t.info.items() if k in ("sharesShort", "shortRatio", "shortPercentOfFloat", "dateShortInterest", "sharesShortPriorMonth")}),
    ]:
        try:
            d = fn()
            if d is None: r[name] = None
            elif isinstance(d, dict): r[name] = {"dict": {k: str(v)[:40] for k, v in d.items()}}
            elif name == "quarterly_income_stmt": r[name] = {"cols": [str(c)[:10] for c in d.columns], "rows": len(d.index)}
            else:
                idx = [str(i)[:10] for i in d.index] if name in ("earnings_dates", "upgrades_downgrades") else None
                r[name] = {"n": len(d), "range": [min(idx), max(idx)] if idx else None, "cols": [str(c) for c in d.columns][:10]}
                if name == "insider_transactions" and len(d):
                    for c in d.columns:
                        if "Start" in str(c) or "Date" in str(c): r[name]["date_range"] = [str(d[c].min())[:10], str(d[c].max())[:10]]
        except Exception as e:
            r[name] = {"err": f"{type(e).__name__}: {str(e)[:100]}"}
    out["rows"][s] = r
json.dump(out, open("data/probe-us-yfinance.json", "w"), indent=1, default=str)
for s, r in out["rows"].items(): print(s, json.dumps(r, default=str)[:600])
