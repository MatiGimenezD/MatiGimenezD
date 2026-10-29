// Turns the last year of GitHub contributions into an audio-waveform SVG (assets/contributions.svg).
// Usage: GITHUB_TOKEN=... node scripts/waveform.mjs      (add --sample to draw fake data without a token)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LOGIN = process.env.GH_LOGIN || "MatiGimenezD";
const OUT = "assets/contributions.svg";

async function fetchDays() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
      variables: { login: LOGIN },
    }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
  return json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));
}

function sampleDays() {
  const days = [];
  const end = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end - i * 864e5);
    const weekend = [0, 6].includes(d.getUTCDay());
    const burst = Math.max(0, Math.sin(i / 23) * 9 + Math.sin(i / 5) * 3);
    days.push({ date: d.toISOString().slice(0, 10), count: Math.max(0, Math.round(burst * (weekend ? 0.3 : 1) + Math.random() * 2 - 0.6)) });
  }
  return days;
}

function render(days) {
  const W = 1280, H = 240, MID = 112, PAD = 28, MAXH = 82;
  const step = (W - PAD * 2) / days.length;
  const bw = Math.max(1.6, step * 0.72);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  const active = days.filter((d) => d.count > 0).length;

  let bars = "";
  days.forEach((d, i) => {
    const level = d.count / max;
    const half = d.count === 0 ? 1.2 : 4 + Math.sqrt(level) * (MAXH - 4);
    const x = PAD + i * step;
    const fill = level > 0.66 ? "#fff3da" : "#ff9a3c";
    const op = d.count === 0 ? 0.18 : 0.4 + level * 0.6;
    bars += `<rect x="${x.toFixed(1)}" y="${(MID - half).toFixed(1)}" width="${bw.toFixed(1)}" height="${(half * 2).toFixed(1)}" rx="${(bw / 2).toFixed(1)}" fill="${fill}" opacity="${op.toFixed(2)}"><title>${d.date}: ${d.count}</title></rect>`;
  });

  let months = "";
  let last = "";
  days.forEach((d, i) => {
    const m = d.date.slice(0, 7);
    if (m !== last && d.date.slice(8) <= "07") {
      const name = new Date(d.date + "T00:00:00Z").toLocaleString("en", { month: "short", timeZone: "UTC" }).toUpperCase();
      months += `<text x="${(PAD + i * step).toFixed(1)}" y="${H - 18}" fill="#6b6b6b" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" letter-spacing="2">${name}</text>`;
    }
    last = m;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
  <title id="t">${total} contributions on ${active} active days in the last year, drawn as an audio waveform</title>
  <rect width="${W}" height="${H}" rx="14" fill="#000"/>
  <text x="${PAD}" y="30" fill="#ff9a3c" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14" letter-spacing="3">// ${total} CONTRIBUTIONS · ${active} ACTIVE DAYS · LAST 12 MONTHS</text>
  <path d="M${PAD} ${MID}H${W - PAD}" stroke="#ff9a3c" stroke-opacity=".2"/>
  ${bars}
  ${months}
  <rect x="${PAD}" y="42" width="2" height="${MID * 2 - 84}" rx="1" fill="#fff3da" opacity=".85">
    <animate attributeName="x" values="${PAD};${W - PAD}" dur="14s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0;.85;.85;0" keyTimes="0;.04;.96;1" dur="14s" repeatCount="indefinite"/>
  </rect>
</svg>
`;
}

const days = process.argv.includes("--sample") ? sampleDays() : await fetchDays();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, render(days));
console.log(`wrote ${OUT} (${days.length} days)`);
