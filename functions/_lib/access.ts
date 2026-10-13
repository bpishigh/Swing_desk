// Verifies the Cloudflare Access login token on a request, so the portfolio endpoints work only for the owner and Partner even if the Access rule were ever misconfigured.
// Checks: RS256 signature against the team's published keys, issuer, audience (the Access application's AUD tag), expiry, and an allowed e-mail list.
export interface AccessEnv { TEAM_DOMAIN: string; POLICY_AUD: string; ALLOWED_EMAILS: string }
const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const json = (s: string) => JSON.parse(new TextDecoder().decode(b64u(s)));
let keyCache: { at: number; domain: string; keys: any[] } | null = null;

export async function verifyAccess(req: Request, env: AccessEnv, fetchFn: typeof fetch = fetch, nowMs = Date.now()): Promise<{ email: string } | null> {
  const token = req.headers.get('Cf-Access-Jwt-Assertion'); if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD || !env.ALLOWED_EMAILS) return null;
  const parts = token.split('.'); if (parts.length !== 3) return null;
  try {
    const head = json(parts[0]), claims = json(parts[1]);
    if (head.alg !== 'RS256') return null;
    const iss = `https://${env.TEAM_DOMAIN}`;
    if (claims.iss !== iss) return null;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]; if (!aud.includes(env.POLICY_AUD)) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return null;
    if (typeof claims.nbf === 'number' && claims.nbf * 1000 > nowMs + 60000) return null;
    if (!keyCache || keyCache.domain !== env.TEAM_DOMAIN || nowMs - keyCache.at > 600000 || !keyCache.keys.some((k) => k.kid === head.kid)) {
      const r = await fetchFn(`${iss}/cdn-cgi/access/certs`); if (!r.ok) return null;
      keyCache = { at: nowMs, domain: env.TEAM_DOMAIN, keys: (await r.json() as any).keys ?? [] };
    }
    const jwk = keyCache.keys.find((k) => k.kid === head.kid); if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    const email = String(claims.email ?? '').toLowerCase();
    const allowed = env.ALLOWED_EMAILS.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    return email && allowed.includes(email) ? { email } : null;
  } catch { return null; }
}
export const resetAccessCache = () => { keyCache = null; };
