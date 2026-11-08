// Dial Espejo · "sonando ahora": primero la fuente oficial de la radio (si publica su lista al aire),
// luego el metadato ICY (StreamTitle) de la señal, completado con la carátula de iTunes o Deezer.
import { adapter, triton } from "./adapters.ts";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=15" } });

function blockedHost(h: string): boolean {
  h = h.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".supabase.co")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168) return true;
  }
  return h.includes(":"); // IPv6 literal
}

async function readIcy(url: string): Promise<{ raw: string | null; name: string | null; genre: string | null; description: string | null }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { headers: { "Icy-MetaData": "1", "User-Agent": "Mozilla/5.0 (DialEspejo)" }, signal: ctl.signal, redirect: "follow" });
    const name = r.headers.get("icy-name"), genre = r.headers.get("icy-genre"), description = r.headers.get("icy-description");
    const metaint = parseInt(r.headers.get("icy-metaint") || "0", 10);
    if (!metaint || !r.body) { ctl.abort(); return { raw: null, name, genre, description }; }
    const reader = r.body.getReader();
    let buf = new Uint8Array(0);
    const need = () => metaint + 1;
    while (buf.length < need() && buf.length < 600000) {
      const { value, done } = await reader.read(); if (done) break;
      const n = new Uint8Array(buf.length + value.length); n.set(buf); n.set(value, buf.length); buf = n;
    }
    if (buf.length < need()) { ctl.abort(); return { raw: null, name, genre, description }; }
    const len = buf[metaint] * 16;
    while (buf.length < metaint + 1 + len) {
      const { value, done } = await reader.read(); if (done) break;
      const n = new Uint8Array(buf.length + value.length); n.set(buf); n.set(value, buf.length); buf = n;
    }
    ctl.abort();
    if (!len) return { raw: null, name, genre, description };
    const meta = new TextDecoder("utf-8").decode(buf.slice(metaint + 1, metaint + 1 + len)).replace(/\0+$/, "");
    const m = meta.match(/StreamTitle='([\s\S]*?)';/);
    const raw = m && m[1].trim() ? m[1].trim() : null;
    return { raw, name, genre, description };
  } catch (_) {
    return { raw: null, name: null, genre: null, description: null };
  } finally { clearTimeout(t); }
}

function split(raw: string): { artist: string | null; song: string } {
  const clean = raw.replace(/\s+/g, " ").trim();
  const i = clean.indexOf(" - ");
  if (i > 0) return { artist: clean.slice(0, i).trim(), song: clean.slice(i + 3).trim() };
  return { artist: null, song: clean };
}

// ---------- Carátula ----------
// La electrónica llega con títulos como "Excited (Original Mix)", "Mind over Matter - 138 bpm" o artistas como
// "Grid, The" o "A & B"; se limpian y se prueba primero iTunes y luego Deezer (mejor catálogo de electrónica).
const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const cleanTitle = (t: string) => t
  .replace(/\s*[\(\[][^\)\]]*\b(mix|remix|edit|version|bpm|dub|rework|vip|remaster(ed)?|radio)\b[^\)\]]*[\)\]]/gi, "")
  .replace(/\s+-\s+[^-]*\b(mix|remix|edit|version|remaster(ed)?)\s*$/i, "")
  .replace(/\s*-?\s*\d+\s*bpm\s*$/i, "").trim();
const fixThe = (a: string) => a.replace(/^(.*),\s*the$/i, "The $1");
const firstArtist = (a: string) => fixThe(a).split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bfeaturing\b|\bx\b|\bvs\.?|\band\b)\s*/i)[0].trim();
const sameArtist = (a: string, b: string) => { const x = norm(a), y = norm(b); if (!x || !y) return false; return x.includes(y.slice(0, 6)) || y.includes(x.slice(0, 6)); };
const getJ = async (u: string) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(3500) }); return r.ok ? await r.json() : null; } catch (_) { return null; } };

type Art = { album: string | null; year: string | null; genre: string | null; artwork: string | null; link: string | null; artwork_kind?: string };
async function itunes(artist: string, song: string): Promise<Art | null> {
  const j = await getJ(`https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${song}`.slice(0, 120))}&media=music&entity=song&limit=5`);
  const hit = (j?.results || []).find((x: any) => sameArtist(artist, x.artistName || ""));
  if (!hit) return null;
  return { album: hit.collectionName || null, year: hit.releaseDate ? String(hit.releaseDate).slice(0, 4) : null, genre: hit.primaryGenreName || null,
    artwork: hit.artworkUrl100 ? String(hit.artworkUrl100).replace("100x100bb", "600x600bb") : null, link: hit.trackViewUrl || null };
}
async function deezer(artist: string, song: string): Promise<Art | null> {
  for (const q of [`artist:"${artist}" track:"${song}"`, `${artist} ${song}`]) {
    const j = await getJ(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
    const hit = (j?.data || []).find((x: any) => sameArtist(artist, x.artist?.name || ""));
    if (hit?.album?.cover_xl || hit?.album?.cover_big) return { album: hit.album.title || null, year: null, genre: null, artwork: hit.album.cover_xl || hit.album.cover_big, link: hit.link || null };
  }
  return null;
}
async function deezerAlbum(artist: string, album: string): Promise<Art | null> {
  const j = await getJ(`https://api.deezer.com/search/album?q=${encodeURIComponent(`artist:"${artist}" album:"${album}"`)}&limit=5`);
  const hit = (j?.data || []).find((x: any) => sameArtist(artist, x.artist?.name || "") && norm(x.title).includes(norm(album).slice(0, 8)));
  return hit?.cover_xl ? { album: hit.title, year: null, genre: null, artwork: hit.cover_xl, link: hit.link || null } : null;
}
async function deezerArtist(artist: string): Promise<string | null> {
  const j = await getJ(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=3`);
  const hit = (j?.data || []).find((x: any) => norm(x.name) === norm(artist));
  const pic = hit?.picture_xl || hit?.picture_big;
  return pic && !/\/artist\/\//.test(pic) ? pic : null; // la imagen genérica de Deezer no sirve
}
async function enrich(artist: string, song: string, album?: string | null, artistImage?: string | null): Promise<Art | null> {
  artist = artist.replace(/\s+live (at|on|in|from)\b.*$/i, "").trim() || artist; // "Quasi live at The WFMU Record Fair!"
  const A = fixThe(artist.trim()), A1 = firstArtist(artist), T = cleanTitle(song) || song;
  // 1) tal como viene, y limpio, en iTunes
  const tries: [string, string][] = [[A, song]];
  if (T !== song || A1 !== A) tries.push([A1, T]);
  if (A.includes(":")) tries.push([A.split(":")[0].trim(), T]); // "3 Amigos: Jellybean, Marlon D & Mena Keys"
  for (const [a, t] of tries) { const r = await itunes(a, t); if (r?.artwork) return r; }
  // 2) Deezer, que tiene mejor catálogo de electrónica
  for (const [a, t] of tries.reverse()) { const r = await deezer(a, t); if (r) return r; }
  // 3) el álbum, si la radio lo informa y no es solo el nombre del artista
  if (album && norm(album) !== norm(artist)) { const r = await deezerAlbum(A1, album); if (r) return r; }
  // 4) como último recurso, la foto del artista
  const pic = artistImage || await deezerArtist(A1);
  return pic ? { album: null, year: null, genre: null, artwork: pic, link: null, artwork_kind: "artist" } : null;
}
const merge = (out: Record<string, unknown>, it: Art | null) => {
  if (!it) return;
  Object.assign(out, { album: out.album || it.album, year: out.year || it.year, genre: out.genre || it.genre, artwork: it.artwork, link: it.link, artwork_kind: it.artwork_kind || "album" });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const qs = new URL(req.url).searchParams;
  const src = (qs.get("src") || "").slice(0, 40);
  const p = qs.get("url") || "";
  const out: Record<string, unknown> = {
    supported: true, fetched_at: new Date().toISOString(),
    raw: null, stream_name: null, stream_genre: null, stream_description: null,
    artist: null, song: null, album: null, year: null, genre: null, artwork: null, link: null, program: null, program_desc: null, source: null,
  };
  // 1) Fuente oficial de la radio, si existe
  if (src) {
    const a = await adapter(src) as any;
    if (a && (a.song || a.program)) {
      const { artist_image, ...rest } = a;
      Object.assign(out, rest, { source: src });
      if (a.song && a.artist && !a.artwork) merge(out, await enrich(a.artist, a.song, a.album, artist_image));
      return json(out);
    }
  }
  // 2) Metadato ICY de la señal
  if (!p) return json(out);
  let u: URL;
  try { u = new URL(p); } catch (_) { return json({ error: "URL inválida" }, 400); }
  if (!/^https?:$/.test(u.protocol) || blockedHost(u.hostname)) return json({ error: "URL no permitida" }, 400);
  if (/\.m3u8($|\?)/i.test(u.pathname)) return json({ ...out, supported: false, reason: "hls" });
  // Red Triton: más precisa que el ICY y trae álbum
  const tt = await triton(u.toString());
  if (tt && tt.song) {
    Object.assign(out, tt, { source: "triton" });
    if (tt.artist) merge(out, await enrich(tt.artist, tt.song, tt.album));
    return json(out);
  }
  const icy = await readIcy(u.toString());
  // Títulos que no son canciones (nombre de la radio, "Live", promociones): se descartan
  const junk = (t: string | null) => !t || /^(live|en vivo|online|stream|radio)$/i.test(t.trim()) || (icy.name && t.trim().toLowerCase() === icy.name.trim().toLowerCase()) || /promo|now playing info|playlist videos/i.test(t) || /^ad\s*\d*$/i.test(t.trim()) || /^(https?:\/\/|www\.)\S+$/i.test(t.trim());
  if (junk(icy.raw)) icy.raw = null;
  Object.assign(out, { raw: icy.raw, stream_name: icy.name, stream_genre: icy.genre, stream_description: icy.description, source: icy.raw ? "icy" : null });
  if (icy.raw) {
    const s = split(icy.raw);
    out.artist = s.artist; out.song = s.song;
    if (s.artist && s.song) {
      // Algunas radios mandan "Canción - Artista" al revés (Absolute Radio: "Beautiful Ones - Suede"): si no hay carátula, se prueba invertido
      const a1 = await enrich(s.artist, s.song);
      const a2 = !a1 || a1.artwork_kind === "artist" ? await enrich(s.song, s.artist) : null;
      if (a2 && a2.artwork_kind !== "artist") { out.artist = s.song; out.song = s.artist; merge(out, a2); } else merge(out, a1);
    }
  }
  return json(out);
});
