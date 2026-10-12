// Minimal xlsx reader with no dependencies: zip central directory, shared strings, cell values of every sheet.
// readXlsx is sync (Node, zlib found at call time); readXlsxAsync uses DecompressionStream and runs in the browser. The parsing is shared.

function unzipRaw(buf            )                                                    {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map                                              ();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
    const data = buf.subarray(lho + 30 + lnlen + lelen, lho + 30 + lnlen + lelen + csize);
    if (method !== 0 && method !== 8) throw new Error('zip method ' + method);
    out.set(name, { method, data });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const unescape = (s        ) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const colIndex = (ref        ) => { let n = 0; for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const textOf = (xml        ) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('');

                                                         

function nodeInflate()                                {
  const z = (globalThis       ).process?.getBuiltinModule?.('node:zlib');
  if (!z) throw new Error('sync xlsx reading needs Node; use readXlsxAsync');
  return (d) => new Uint8Array(z.inflateRawSync(d));
}
export function readXlsx(buf            )          {
  const inf = nodeInflate();
  return parseSheets(new Map([...unzipRaw(buf)].map(([k, v]) => [k, v.method === 0 ? v.data : inf(v.data)])));
}
async function inflateWeb(d            )                      {
  const stream = new Blob([d            ]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function readXlsxAsync(buf            )                   {
  const out = new Map                    ();
  for (const [k, v] of unzipRaw(buf)) out.set(k, v.method === 0 ? v.data : await inflateWeb(v.data));
  return parseSheets(out);
}
function parseSheets(files                         )          {
  const dec = (n        ) => { const f = files.get(n); return f ? new TextDecoder().decode(f) : ''; };
  const shared = [...dec('xl/sharedStrings.xml').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const wb = dec('xl/workbook.xml');
  const rels = dec('xl/_rels/workbook.xml.rels');
  const target = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])?.[1] ?? '', /Target="([^"]+)"/.exec(m[0])?.[1] ?? '']         ));
  const sheets          = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unescape(/name="([^"]*)"/.exec(m[0])?.[1] ?? 'Sheet');
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1] ?? '';
    let path = target.get(rid) ?? '';
    path = path.startsWith('/') ? path.slice(1) : 'xl/' + path;
    const xml = dec(path);
    const rows             = [];
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const cells           = [];
      for (const c of (r[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], inner = c[2] ?? '';
        const ref = /r="([A-Z]+[0-9]+)"/.exec(attrs)?.[1];
        const t = /t="([^"]+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let val = '';
        if (t === 's' && v !== undefined) val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(inner);
        else if (v !== undefined) val = unescape(v);
        const idx = ref ? colIndex(ref) : cells.length;
        while (cells.length < idx) cells.push('');
        cells[idx] = val;
      }
      rows.push(cells);
    }
    sheets.push({ name, rows: rows.filter((x) => x.some((c) => c.trim() !== '')) });
  }
  return sheets;
}
