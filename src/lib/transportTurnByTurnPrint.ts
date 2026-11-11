export type TurnByTurnStep = {
  instruction: string;
  name: string;
  distanceMi: number;
  durationSec: number;
  segmentIndex?: number;
};

export type TurnByTurnStop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  pickupTime: string;
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatTurnDuration(durationSec: number): string {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return "";
  if (durationSec < 45) return `${Math.max(1, Math.round(durationSec))} sec`;
  const minutes = durationSec / 60;
  if (minutes < 10) return `${minutes.toFixed(1)} min`;
  return `${Math.round(minutes)} min`;
}

export function formatTurnDistance(distanceMi: number): string {
  if (!Number.isFinite(distanceMi) || distanceMi <= 0) return "";
  if (distanceMi < 0.1) return `${Math.round(distanceMi * 5280)} ft`;
  return `${distanceMi.toFixed(2)} mi`;
}

function googleMapsDirUrl(stops: TurnByTurnStop[]): string {
  return `https://www.google.com/maps/dir/${stops.map((s) => `${s.lat},${s.lng}`).join("/")}`;
}

export function buildTurnByTurnPrintHtml(options: {
  bus: string;
  routeName: string;
  totalDistanceMi: number;
  totalDurationSec: number;
  steps: TurnByTurnStep[];
  stopLabels: string[];
  stops: TurnByTurnStop[];
}): string {
  const sections: string[] = [];
  let curSeg = -1;
  let legItems: string[] = [];
  const flushLeg = () => {
    if (legItems.length) {
      sections.push(`<ol>${legItems.join("")}</ol>`);
      legItems = [];
    }
  };

  options.steps.forEach((step) => {
    const seg = step.segmentIndex ?? 0;
    if (seg !== curSeg) {
      flushLeg();
      curSeg = seg;
      const from = options.stopLabels[seg] || `Stop ${seg + 1}`;
      const to = options.stopLabels[seg + 1] || `Stop ${seg + 2}`;
      const segSteps = options.steps.filter((s) => (s.segmentIndex ?? 0) === seg);
      const segSec = segSteps.reduce((sum, s) => sum + (s.durationSec || 0), 0);
      const segMi = segSteps.reduce((sum, s) => sum + (s.distanceMi || 0), 0);
      const meta = [formatTurnDistance(segMi), formatTurnDuration(segSec)].filter(Boolean).join(" · ");
      sections.push(
        `<h2 style="font-family:Arial;font-size:14pt;color:#1f4e79;">Leg ${seg + 1}: ${esc(from)} → ${esc(to)}${meta ? ` <span style="font-size:11pt;color:#555;font-weight:normal;">(${esc(meta)})</span>` : ""}</h2>`,
      );
    }
    const dist = formatTurnDistance(step.distanceMi);
    const dur = formatTurnDuration(step.durationSec);
    const onStreet = step.name && step.name !== "-" ? ` <i>(on ${esc(step.name)})</i>` : "";
    const qty = [dist, dur].filter(Boolean).join(", ");
    legItems.push(`<li style="margin-bottom:4pt;">${esc(step.instruction)}${onStreet}${qty ? ` — <b>${esc(qty)}</b>` : ""}</li>`);
  });
  flushLeg();

  const stopList = options.stops
    .map((stop, i) => {
      const label = options.stopLabels[i] || stop.name;
      const time = stop.pickupTime && stop.pickupTime !== "—" ? ` · ${esc(stop.pickupTime)}` : "";
      return `<li style="margin-bottom:6pt;"><b>${esc(label)}</b>${time}<br/><span style="color:#555;">${esc(stop.address)}</span></li>`;
    })
    .join("");

  const gmaps = options.stops.length >= 2 ? googleMapsDirUrl(options.stops) : "";
  const totals = [
    options.totalDistanceMi > 0 ? `${options.totalDistanceMi.toFixed(1)} mi` : "",
    options.totalDurationSec > 0 ? `~${Math.round(options.totalDurationSec / 60)} min` : "",
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${esc(options.bus)} directions</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11pt;color:#222;margin:24px;}
  h1{font-size:18pt;color:#0f3a5f;margin-bottom:4pt;}
  .meta{color:#555;font-size:10pt;margin-bottom:18pt;}
  ol.stops{margin:0 0 18pt 18pt;}
  @media print { a { color: inherit; text-decoration: none; } }
</style>
</head><body>
<h1>${esc(options.bus)} — ${esc(options.routeName)}</h1>
<div class="meta">${totals.length ? `Total: <b>${esc(totals.join(" · "))}</b>` : "Stop list"} · first stop to last stop</div>
<h2 style="font-family:Arial;font-size:14pt;color:#1f4e79;">Stops</h2>
<ol class="stops">${stopList}</ol>
${gmaps ? `<p style="font-size:10pt;margin-bottom:18pt;">Open in Google Maps: <a href="${esc(gmaps)}">${esc(gmaps)}</a></p>` : ""}
${sections.join("\n")}
</body></html>`;
}

export function openTurnByTurnPrintWindow(html: string): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    try {
      popup.print();
    } catch {
      /* print UI may still be available from the window */
    }
  }, 250);
  return true;
}

export function downloadTurnByTurnHtml(html: string, fileBase: string): void {
  const blob = new Blob(["\ufeff", html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase.replace(/\s+/g, "_")}_directions.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
