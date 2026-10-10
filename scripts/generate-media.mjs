/**
 * Generates branded placeholder media for the platform:
 *   /public/media/tours/<slug>-1..3.webp   (1600x1200)
 *   /public/media/destinations/<slug>.webp (1200x800)
 *   /public/media/categories/<slug>.webp   (800x800)
 *   /public/media/blog/<slug>.webp         (1200x675)
 *   /public/media/og-default.jpg           (1200x630)
 *   /public/media/logo.png                 (512x512)
 *
 * Images are abstract tropical gradients (deterministic per slug) with the
 * title text baked in — replace with real photography via Admin → Media
 * when available. Run: npm run media:generate
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "media");

const PALETTES = [
  ["#0F766E", "#134E4A", "#F97316"],
  ["#0EA5E9", "#155E75", "#22C55E"],
  ["#F97316", "#7C2D12", "#FACC15"],
  ["#8B5CF6", "#4C1D95", "#06B6D4"],
  ["#10B981", "#065F46", "#FBBF24"],
  ["#0891B2", "#164E63", "#FB7185"],
  ["#EF4444", "#7F1D1D", "#F59E0B"],
  ["#14B8A6", "#1E3A8A", "#FDE68A"],
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function svgCard({ w, h, title, emoji, tagline = "Bali Things To Do" }) {
  const p = PALETTES[hash(title) % PALETTES.length];
  const id = `g${hash(title).toString(36)}`;
  const big = Math.round(Math.min(w, h) * 0.28);
  const titleSize = Math.round(w * (title.length > 26 ? 0.045 : 0.06));
  const lines = wrap(title, title.length > 26 ? 20 : 24);
  const titleBlock = lines
    .map(
      (line, i) =>
        `<text x="${w / 2}" y="${h * 0.6 + i * (titleSize * 1.2)}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="${titleSize}" fill="#ffffff">${esc(line)}</text>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p[0]}"/>
      <stop offset="55%" stop-color="${p[1]}"/>
      <stop offset="100%" stop-color="${p[2]}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>
  <circle cx="${w * 0.85}" cy="${h * 0.18}" r="${Math.min(w, h) * 0.28}" fill="#ffffff" opacity="0.10"/>
  <circle cx="${w * 0.12}" cy="${h * 0.85}" r="${Math.min(w, h) * 0.34}" fill="#ffffff" opacity="0.08"/>
  <path d="M0 ${h * 0.82} Q ${w * 0.25} ${h * 0.72} ${w * 0.5} ${h * 0.82} T ${w} ${h * 0.82} L ${w} ${h} L 0 ${h} Z" fill="#0f1729" opacity="0.25"/>
  <text x="${w / 2}" y="${h * 0.42}" text-anchor="middle" font-size="${big}">${emoji}</text>
  ${titleBlock}
  <text x="${w / 2}" y="${h * 0.93}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.round(w * 0.022)}" fill="#ffffff" opacity="0.85">★ ${esc(tagline)}</text>
</svg>`;
}

function wrap(text, max) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length > max) {
      if (cur) lines.push(cur.trim());
      cur = word;
    } else cur += " " + word;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 2);
}

async function write(svg, file, opts = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const img = sharp(Buffer.from(svg));
  if (file.endsWith(".png")) await img.png().toFile(file);
  else if (file.endsWith(".jpg")) await img.jpeg({ quality: 84 }).toFile(file);
  else await img.webp({ quality: 82, ...opts }).toFile(file);
}

const TOURS = [
  ["ubud-atv-adventure", "Ubud ATV Adventure", "🏍️"],
  ["telaga-waja-river-rafting", "Telaga Waja River Rafting", "🛶"],
  ["bali-water-sport-adventure", "Bali Water Sport Adventure", "🌊"],
  ["nusa-penida-west-tour", "Nusa Penida West Tour", "🏝️"],
  ["mount-batur-sunrise-trek", "Mount Batur Sunrise Trek", "🌄"],
  ["ubud-cultural-day-tour", "Ubud Cultural Day Tour", "🎑"],
  ["bali-swings-and-terraces", "Bali Swings & Terraces", "🪢"],
  ["white-water-rafting-ayung", "Ayung River Rafting", "🚣"],
  ["bali-jungle-snorkeling", "Nusa Penida Snorkeling", "🤿"],
  ["seminyak-private-city-tour", "Seminyak Private City Tour", "🚗"],
  ["uluwatu-temple-and-kecak", "Uluwatu Temple & Kecak Dance", "🛕"],
  ["kintamani-volcano-cycling", "Kintamani Volcano Cycling", "🚴"],
  ["bali-cooking-class-ubud", "Bali Cooking Class Ubud", "🍳"],
  ["west-nusa-penida-snorkel", "West Nusa Penida Snorkel Safari", "🐠"],
  ["bali-zipline-adventure", "Bali Zipline Adventure", "🪂"],
  ["tibumana-waterfall-tour", "Tibumana Waterfall Tour", "💦"],
  ["bali-snorkeling-manta-point", "Nusa Penida Manta Point Snorkel Safari", "🤿"],
  ["bali-airport-transfer-private", "Private Airport Transfer", "🚐"],
];

const DESTINATIONS = [
  ["ubud", "Ubud", "🎑"],
  ["canggu", "Canggu", "🏄"],
  ["seminyak", "Seminyak", "🍹"],
  ["kuta", "Kuta", "🏖️"],
  ["uluwatu", "Uluwatu", "🌅"],
  ["nusa-penida", "Nusa Penida", "🏝️"],
  ["kintamani", "Kintamani", "🌋"],
  ["mount-batur", "Mount Batur", "⛰️"],
];

const CATEGORIES = [
  ["adventure", "Adventure", "🪂"],
  ["atv", "ATV", "🏍️"],
  ["rafting", "Rafting", "🛶"],
  ["water-sports", "Water Sports", "🌊"],
  ["cultural", "Cultural", "🎎"],
  ["temple", "Temple", "🛕"],
  ["sunrise", "Sunrise", "🌄"],
  ["cycling", "Cycling", "🚴"],
  ["trekking", "Trekking", "🥾"],
  ["private", "Private", "🚗"],
];

const BLOG = [
  ["best-things-to-do-in-bali", "37 Best Things To Do in Bali", "🌴"],
  ["ubud-travel-guide", "The Complete Ubud Travel Guide", "🌾"],
  ["nusa-penida-day-trip", "Nusa Penida Day Trip: Everything You Need To Know", "🏝️"],
  ["bali-with-kids", "Bali With Kids: 12 Family-Friendly Adventures", "👨‍👩‍👧"],
];

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  // Tour galleries
  for (const [slug, title, emoji] of TOURS) {
    for (let i = 1; i <= 3; i++) {
      const svg = svgCard({ w: 1600, h: 1200, title: i === 1 ? title : `${title} — ${i}`, emoji });
      await write(svg, path.join(OUT, "tours", `${slug}-${i}.webp`));
    }
  }
  // Destination heroes
  for (const [slug, title, emoji] of DESTINATIONS) {
    const svg = svgCard({ w: 1200, h: 800, title, emoji });
    await write(svg, path.join(OUT, "destinations", `${slug}.webp`));
  }
  // Category tiles
  for (const [slug, title, emoji] of CATEGORIES) {
    const svg = svgCard({ w: 800, h: 800, title, emoji });
    await write(svg, path.join(OUT, "categories", `${slug}.webp`));
  }
  // Blog images
  for (const [slug, title, emoji] of BLOG) {
    const svg = svgCard({ w: 1200, h: 675, title, emoji });
    await write(svg, path.join(OUT, "blog", `${slug}.webp`));
  }
  // OG default
  const og = svgCard({
    w: 1200,
    h: 630,
    title: "Best Bali Things To Do",
    emoji: "🌴",
    tagline: "Tours · Activities · Adventures",
  });
  await write(og, path.join(OUT, "og-default.jpg"));

  // Logo (simple palm mark on teal)
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="96" fill="#0F766E"/>
    <circle cx="256" cy="230" r="150" fill="#14B8A6" opacity="0.35"/>
    <path d="M256 120 C 300 160 340 175 392 170 C 350 205 330 225 316 268" fill="none" stroke="#F97316" stroke-width="26" stroke-linecap="round"/>
    <path d="M256 120 C 212 160 172 175 120 170 C 162 205 182 225 196 268" fill="none" stroke="#FDE68A" stroke-width="26" stroke-linecap="round"/>
    <path d="M256 130 L 256 400" stroke="#ffffff" stroke-width="30" stroke-linecap="round"/>
    <path d="M180 400 Q 256 360 332 400" fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round"/>
  </svg>`;
  await write(logo, path.join(OUT, "logo.png"));
  await fs.writeFile(
    path.join(OUT, "logo.svg"),
    logo.replace("<svg ", '<svg width="64" height="64" '),
    "utf8"
  );

  const count = await countFiles(OUT);
  console.log(`Generated ${count} media files in ${OUT}`);
}

async function countFiles(dir) {
  let n = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += await countFiles(path.join(dir, entry.name));
    else n++;
  }
  return n;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
