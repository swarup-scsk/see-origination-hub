// Lightweight client-side document export: download as a Word-openable .doc, or open an email draft.
// No external libraries — builds an HTML document and downloads it with a Word MIME type.

export type Section = { heading: string; rows?: [string, string][]; paragraphs?: [string, string][] };

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sectionHtml(s: Section): string {
  let html = `<h2 style="font-family:Arial;color:#1F3555;font-size:14pt;margin:16px 0 6px">${esc(s.heading)}</h2>`;
  if (s.rows) {
    html += `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Arial;font-size:10.5pt">`;
    html += s.rows.map(([k, v]) => `<tr><td style="background:#EEF2F7;font-weight:bold;width:240px">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
    html += `</table>`;
  }
  if (s.paragraphs) {
    html += s.paragraphs
      .map(([k, v]) => `<p style="font-family:Arial;font-size:10.5pt;margin:6px 0"><b>${esc(k)}:</b> ${esc(v)}</p>`)
      .join("");
  }
  return html;
}

export function buildDocHtml(title: string, subtitle: string, sections: Section[]): string {
  const body =
    `<h1 style="font-family:Arial;color:#1F3555;font-size:20pt;margin:0">${esc(title)}</h1>` +
    `<p style="font-family:Arial;color:#2E75B6;font-size:11pt;margin:4px 0 2px">${esc(subtitle)}</p>` +
    `<p style="font-family:Arial;color:#777;font-size:8.5pt;margin:0 0 12px">Generated ${new Date().toLocaleString()} · SEE Origination Hub</p>` +
    sections.map(sectionHtml).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>${body}</body></html>`;
}

export function downloadDoc(filename: string, html: string) {
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".doc") ? filename : filename + ".doc";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Plain-text version for an email body (mailto has length limits, so keep it concise).
export function emailDoc(subject: string, sections: Section[]) {
  const lines: string[] = [];
  for (const s of sections) {
    lines.push(s.heading.toUpperCase());
    (s.rows ?? []).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
    (s.paragraphs ?? []).forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
    lines.push("");
  }
  const body = lines.join("\n");
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
