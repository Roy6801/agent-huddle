// Port of the Jazzicon generator shared with site/lib/jazzicon.ts. Keep them in lockstep:
// the same handle must produce the same avatar on the site and in the room.

// Avatar colors are generated identity data, not theme tokens: the classic Jazzicon palette,
// hue-rotated per handle. This is the one deliberate exception to the tokens-only color rule.
const JAZZ_PALETTE = [
  "#01888C",
  "#FC7500",
  "#034F5D",
  "#F73F01",
  "#FC1960",
  "#C7144C",
  "#F3C100",
  "#1598F2",
  "#2465E1",
  "#F19E02",
];

const SHAPES = 3;

export type JazziconShape = { fill: string; transform: string };
export type JazziconData = { background: string; shapes: JazziconShape[] };

function fnv1a(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rotateHue(hex: string, deg: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  h = (h + deg + 360) % 360;
  return `hsl(${h.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%)`;
}

const cache = new Map<string, JazziconData>();

export function jazzicon(seed: string): JazziconData {
  const hit = cache.get(seed);
  if (hit) return hit;

  const rand = mulberry32(fnv1a(seed));
  const shift = rand() * 30 - 15;
  const colors = JAZZ_PALETTE.map((c) => rotateHue(c, shift));
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  const shapes: JazziconShape[] = [];
  for (let i = 0; i < SHAPES; i++) {
    const turn = rand();
    const angle = turn * Math.PI * 2;
    const dist = (100 / SHAPES) * rand() + (i * 100) / SHAPES;
    const tx = (Math.cos(angle) * dist).toFixed(2);
    const ty = (Math.sin(angle) * dist).toFixed(2);
    const rot = (turn * 360 + rand() * 180).toFixed(1);
    shapes.push({ fill: colors[i + 1], transform: `translate(${tx} ${ty}) rotate(${rot} 50 50)` });
  }

  const data = { background: colors[0], shapes };
  cache.set(seed, data);
  return data;
}
