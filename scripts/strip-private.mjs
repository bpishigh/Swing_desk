// Removes passages wrapped in <!--private-->...<!--/private--> from a document before it is published on the static site.
// The wrapped text stays in the repository file; only the published copy loses it. Fails (throws) on an unclosed marker so nothing private slips through.
export function stripPrivate(md) {
  let out = '', i = 0;
  while (i < md.length) {
    const a = md.indexOf('<!--private-->', i);
    if (a < 0) { out += md.slice(i); break; }
    out += md.slice(i, a);
    const b = md.indexOf('<!--/private-->', a);
    if (b < 0) throw new Error('unclosed <!--private--> marker');
    out += '[removed from the published copy]';
    i = b + '<!--/private-->'.length;
  }
  if (/<!--\/?private-->/.test(out)) throw new Error('stray private marker');
  return out;
}
