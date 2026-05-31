// wishshelf-fetch — URLを受け取り、タイトル・画像・金額・画像候補をJSONで返すCloudflare Worker
// Cloudflareダッシュボード → Workers & Pages → Create Worker → このコードを貼り付け → Deploy
// 公開されたURL（例: https://wishshelf-fetch.xxxx.workers.dev）を index.html の FETCH_API に設定する

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const target = new URL(request.url).searchParams.get("url");
    if (!target) return json({ error: "url param required" }, 400);
    let abs = target;
    if (!/^https?:\/\//.test(abs)) abs = "https://" + abs;

    try {
      const out = { title: "", image: "", price: null, images: [] };

      // 1) ページHTMLを取得し、og:image / JSON-LD / 価格メタを解析
      const res = await fetch(abs, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WishShelfBot/1.0)", "Accept-Language": "ja,en" },
        cf: { cacheTtl: 300 },
      });
      const html = await res.text();
      parseHtml(html, abs, out);

      // 2) Shopify系（/products/◯◯）は .js で金額・画像を確実に補完
      try {
        const pu = new URL(abs);
        const m = pu.pathname.match(/\/products\/([^\/?#]+)/);
        if (m) {
          const r2 = await fetch(`${pu.origin}/products/${m[1]}.js`, { headers: { Accept: "application/json" } });
          if (r2.ok) {
            const p = await r2.json();
            if (p) {
              if (!out.title && p.title) out.title = p.title;
              if (p.price != null && out.price == null) out.price = Math.round(p.price / 100); // cents → 円
              if (Array.isArray(p.images)) {
                p.images.forEach((im) => {
                  let s = typeof im === "string" ? im : im && im.src;
                  if (s) { if (s.startsWith("//")) s = "https:" + s; out.images.push(s); }
                });
              }
            }
          }
        }
      } catch (e) {}

      out.images = [...new Set([out.image, ...out.images].filter(Boolean))].slice(0, 12);
      if (!out.image && out.images.length) out.image = out.images[0];
      return json(out, 200);
    } catch (e) {
      return json({ error: String(e) }, 502);
    }
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re);
  if (!tag) return "";
  const c = tag[0].match(/content=["']([^"']*)["']/i);
  return c ? c[1] : "";
}
function fix(src, base) {
  if (!src) return "";
  if (src.startsWith("//")) return "https:" + src;
  try { return new URL(src, base).href; } catch (e) { return src; }
}
function toYen(s) {
  const n = parseInt(String(s).replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}
function parseHtml(html, base, out) {
  out.title = meta(html, "og:title") || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim();

  const og = fix(meta(html, "og:image"), base);
  const tw = fix(meta(html, "twitter:image") || meta(html, "twitter:image:src"), base);
  if (og) { out.image = og; out.images.push(og); }
  if (tw) out.images.push(tw);

  const ogp = meta(html, "product:price:amount") || meta(html, "og:price:amount");
  if (ogp) out.price = toYen(ogp);

  // JSON-LD（@graph対応）から画像と価格
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    let data;
    try { data = JSON.parse(s[1].trim()); } catch (e) { continue; }
    const arr = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
    for (const o of arr) {
      if (!o || typeof o !== "object") continue;
      const im = o.image;
      if (im) {
        if (typeof im === "string") out.images.push(fix(im, base));
        else if (Array.isArray(im)) im.forEach((x) => out.images.push(fix(typeof x === "string" ? x : x && x.url, base)));
        else if (im.url) out.images.push(fix(im.url, base));
      }
      if (out.price == null) {
        let off = o.offers;
        if (Array.isArray(off)) off = off[0];
        const p = off && (off.price || off.lowPrice || (off.priceSpecification && off.priceSpecification.price));
        if (p) out.price = toYen(p);
      }
    }
  }
}
