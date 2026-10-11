// Converts a Claude Docs "read" result (JSON with data.xml, prose engine) to markdown for docs/.
// Usage: node tools/doc-xml-to-md.mjs <read-result.json> <out.md> "<header line>"
// Handles the tags the two source-of-truth docs use: paragraph (heading), text, bold, code, list/listItem (bullet, ordered, check),
// table/row/cell, codeBlock, date and mention chips (written as plain text). Anything else throws, so a new construct is noticed.
import { readFileSync, writeFileSync } from 'node:fs';
const [, , inFile, outFile, header = ''] = process.argv;
const j = JSON.parse(readFileSync(inFile, 'utf8'));
const xml = j.data.xml;
const rev = j.data.rev;

// tiny XML tokenizer
const tokens = [];
const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z]+)((?:\s+[A-Za-z-]+='[^']*')*)\s*(\/?)>|([^<]+)/g;
let m;
while ((m = re.exec(xml))) {
  if (m[1] !== undefined) tokens.push({ t: 'cdata', v: m[1] });
  else if (m[3]) tokens.push({ t: m[2] ? 'close' : m[5] ? 'self' : 'open', name: m[3], attrs: Object.fromEntries([...(m[4] || '').matchAll(/([A-Za-z-]+)='([^']*)'/g)].map((a) => [a[1], a[2]])) });
  else tokens.push({ t: 'text', v: m[6] });
}
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
let i = 0;
function parseNode() {
  const tk = tokens[i++];
  if (tk.t === 'text') return { name: '#text', v: unesc(tk.v), kids: [] };
  if (tk.t === 'cdata') return { name: '#cdata', v: tk.v, kids: [] };
  const n = { name: tk.name, attrs: tk.attrs, kids: [] };
  if (tk.t === 'self') return n;
  while (tokens[i].t !== 'close') n.kids.push(parseNode());
  i++; return n;
}
const root = parseNode();
const inline = (n) => n.kids.map((k) => {
  switch (k.name) {
    case '#text': return k.v;
    case 'text': return inline(k);
    case 'bold': return '**' + inline(k) + '**';
    case 'code': return '`' + inline(k) + '`';
    case 'date': return k.attrs.value;
    case 'mention': return '@' + (k.attrs.name || 'user');
    default: throw new Error('unknown inline ' + k.name);
  }
}).join('').replace(/\*\*\*\*/g, '').replace(/ /g, ' ');
const cellText = (c) => c.kids.map((p) => inline(p)).join(' ').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
function table(t) {
  const rows = t.kids.filter((r) => r.name === 'row').map((r) => r.kids.filter((c) => c.name === 'cell').map(cellText));
  if (!rows.length) return '';
  const w = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(w - r.length).fill('')];
  const hdr = pad(rows[0]);
  return ['| ' + hdr.join(' | ') + ' |', '| ' + hdr.map(() => '---').join(' | ') + ' |', ...rows.slice(1).map((r) => '| ' + pad(r).join(' | ') + ' |')].join('\n');
}
function list(l, depth = 0) {
  return l.kids.filter((x) => x.name === 'listItem').map((it, idx) => {
    const para = it.kids.find((k) => k.name === 'paragraph');
    const kind = l.attrs.kind;
    const mark = kind === 'ordered' ? `${idx + 1}.` : kind === 'check' ? (it.attrs?.checked === 'true' ? '- [x]' : '- [ ]') : '-';
    const sub = it.kids.filter((k) => k.name === 'list').map((s) => '\n' + list(s, depth + 1)).join('');
    return '    '.repeat(depth) + mark + ' ' + (para ? inline(para) : '') + sub;
  }).join('\n');
}
const out = [];
for (const b of root.kids) {
  if (b.name === 'paragraph') {
    const text = inline(b).trim(); if (!text) continue;
    out.push((b.attrs.heading ? '#'.repeat(+b.attrs.heading) + ' ' : '') + text);
  } else if (b.name === 'list') out.push(list(b));
  else if (b.name === 'table') out.push(table(b));
  else if (b.name === 'codeBlock') out.push('```' + (b.attrs.language || '') + '\n' + b.kids.map((k) => k.v).join('') + '\n```');
  else throw new Error('unknown block ' + b.name);
}
writeFileSync(outFile, (header ? header + '\n\n' : '') + out.join('\n\n') + '\n');
console.log(outFile, 'rev', rev, out.length, 'blocks');
