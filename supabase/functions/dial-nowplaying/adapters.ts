// Fuentes oficiales de "sonando ahora" para radios que publican su lista al aire (más fiables que el metadato ICY)
type NP = { song?: string | null; artist?: string | null; album?: string | null; year?: string | null; artwork?: string | null; program?: string | null; program_desc?: string | null };
const get = async (u: string) => { const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (DialEspejo)", Accept: "application/json" }, signal: AbortSignal.timeout(5000) }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
const strip = (h: string) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// Triton Digital (StreamTheWorld): publica la canción en curso por "mount" para cualquier radio que use su red
export async function triton(url: string): Promise<NP | null> {
  const m = url.match(/streamtheworld\.com(?::\d+)?\/(?:api\/livestream-redirect\/)?([A-Za-z0-9_]+?)(?:\.(?:aac|mp3))?(?:[?\/]|$)/);
  if (!m) return null;
  const base = m[1], tries = [base, base.replace(/_SC$/, ""), base.replace(/(AAC)?(_SC)?$/, "AAC"), base.replace(/AAC$/, "")];
  for (const mount of [...new Set(tries)]) {
    try {
      const r = await fetch(`https://np.tritondigital.com/public/nowplaying?mountName=${encodeURIComponent(mount)}&numberToFetch=1&eventType=track`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const x = await r.text();
      const p = (n: string) => { const k = x.match(new RegExp(`name="${n}"><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`)); return k ? k[1].trim() : null; };
      const title = p("cue_title"); if (!title) continue;
      const start = Number(p("cue_time_start") || 0), dur = Number(p("cue_time_duration") || 0);
      if (start && Date.now() - start > (dur ? dur + 180000 : 25 * 60000)) return null; // dato viejo: mejor nada
      return { song: title, artist: p("track_artist_name"), album: p("track_album_name") };
    } catch (_) { /* siguiente mount */ }
  }
  return null;
}
export async function adapter(src: string): Promise<NP | null> {
  try {
    if (src.startsWith("abc:")) {
      const st = src.slice(4);
      const j = await get(`https://music.abcradio.net.au/api/v1/plays/search.json?station=${encodeURIComponent(st)}&limit=1&order=desc`);
      const it = j.items?.[0]; if (!it) return null;
      const fresh = !it.played_time || Date.now() - Date.parse(it.played_time) < 15 * 60000;
      if (!fresh) return null;
      return { song: it.summary?.title || null, artist: it.summary?.artist || null, album: it.release?.title || null, artwork: it.release?.artwork?.[0]?.url || null };
    }
    if (src === "kexp") {
      const j = await get("https://api.kexp.org/v2/plays/?limit=1");
      const it = j.results?.[0]; if (!it) return null;
      let program: string | null = null, program_desc: string | null = null;
      if (it.show_uri) { try { const s = await get(it.show_uri); program = s.program_name || null; program_desc = [s.host_names?.join(", "), s.tagline].filter(Boolean).join(" · ") || null; } catch (_) { /* opcional */ } }
      if (it.play_type !== "trackplay") return { program, program_desc };
      return { song: it.song || null, artist: it.artist || null, album: it.album || null, year: it.release_date ? String(it.release_date).slice(0, 4) : null, artwork: it.image_uri || it.thumbnail_uri || null, program, program_desc };
    }
    if (src === "nts") {
      const j = await get("https://www.nts.live/api/v2/live");
      const now = j.results?.[0]?.now; if (!now) return null;
      const d = now.embeds?.details || {};
      return { program: now.broadcast_title || null, program_desc: strip(d.description || "") || null, artwork: d.media?.picture_medium || null };
    }
    if (src.startsWith("rf:")) {
      // Radio France (FIP y sus webradios): el paso en curso del más profundo es la canción; el de nivel 1, el programa
      const j = await get(`https://api.radiofrance.fr/livemeta/pull/${encodeURIComponent(src.slice(3))}`);
      const now = Date.now() / 1000;
      const cur = Object.values(j.steps || {}).filter((s: any) => s.start <= now && s.end > now) as any[];
      const song = cur.filter((s) => s.embedType === "song").sort((a, b) => b.depth - a.depth)[0];
      const prog = cur.filter((s) => s.embedType !== "song").sort((a, b) => a.depth - b.depth)[0];
      if (!song && !prog) return null;
      return { song: song?.title || null, artist: song ? (song.performers || song.highlightedArtists?.join?.(", ") || song.authors || null) : null, album: song?.titreAlbum || null,
        year: song?.anneeEditionMusique ? String(song.anneeEditionMusique) : null, artwork: song?.visual || null, program: prog?.title || null };
    }
    if (src.startsWith("bbc:")) {
      const j = await get(`https://rms.api.bbc.co.uk/v2/services/${encodeURIComponent(src.slice(4))}/segments/latest?experience=domestic&offset=0&limit=1`);
      const it = j.data?.[0]; if (!it || it.offset?.now_playing === false) return null;
      return { artist: it.titles?.primary || null, song: it.titles?.secondary || null, album: it.titles?.tertiary || null, artwork: it.image_url ? String(it.image_url).replace("{recipe}", "320x320") : null };
    }
    if (src.startsWith("rp")) {
      const j = await get(`https://api.radioparadise.com/api/now_playing?chan=${src.slice(3) || "0"}`);
      return { song: j.title || null, artist: j.artist || null, album: j.album || null, year: j.year || null, artwork: j.cover_med || j.cover || null };
    }
    if (src.startsWith("laut:")) {
      // laut.fm publica la canción en curso de cada emisora (a veces con foto del artista)
      const j = await get(`https://api.laut.fm/station/${encodeURIComponent(src.slice(5))}/current_song`);
      if (!j?.title) return null;
      return { song: j.title, artist: j.artist?.name || j.artist_name || null, album: j.album || null, year: j.releaseyear ? String(j.releaseyear) : null, artist_image: j.artist?.image || null } as NP;
    }
    if (src === "kcrw") {
      const j = await get("https://tracklist-api.kcrw.com/Simulcast/all/1");
      const it = Array.isArray(j) ? j[0] : null; if (!it) return null;
      const real = it.title && it.artist && !/^\[?break\]?$/i.test(it.title);
      return { song: real ? it.title : null, artist: real ? it.artist : null, album: real ? it.album || null : null, artwork: real ? it.albumImage || null : null, program: it.program_title || null };
    }
  } catch (_) { return null; }
  return null;
}
