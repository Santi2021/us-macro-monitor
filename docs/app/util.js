// Utilidades sin estado: formato de números y fechas, DOM, almacenamiento y avisos.
export const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const DIA_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DIA_MS = 864e5;

export const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// Un valor que redondea a cero se muestra "0,0", nunca "-0,0" ni "+0,0"
const redondo = (v, d) => { const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return r === 0 ? 0 : r; };
export const nf = (v, d = 1) => v == null || !isFinite(v) ? "–" : redondo(v, d).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const sg = (v, d = 1) => v == null || !isFinite(v) ? "–" : (redondo(v, d) > 0 ? "+" : "") + nf(v, d);
export const T = (y, m = 1) => Date.UTC(y, m - 1, 1);
export const P = s => Date.parse(s.length > 10 ? s : s + "T00:00:00Z");
// Guion que no se corta al final de renglón ("Q2-26" y "ago-26" quedan enteros en los títulos)
const GUION = "\u2011";
export const sinGuionFijo = x => String(x).replace(/\u2011/g, "-");
export const fm = t => { const d = new Date(t); return MES[d.getUTCMonth()] + GUION + String(d.getUTCFullYear()).slice(2); };
export const fq = t => { const d = new Date(t); return "Q" + (Math.floor(d.getUTCMonth() / 3) + 1) + GUION + String(d.getUTCFullYear()).slice(2); };
export const fw = t => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, "0")}-${MES[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`; };
export const fd = t => { const d = new Date(t); return `${DIA[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}-${MES[d.getUTCMonth()]}`; };
export const fLargo = t => { const d = new Date(t); return `${d.getUTCDate()} de ${MES_LARGO[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
export const fPor = f => f === "Q" ? fq : f === "W" || f === "D" ? fw : fm;
export const hoyUTC = () => { const h = new Date(); return Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()); };
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const unidadTxt = u => u === "%" ? "%" : u ? " " + u : "";
export const sinTildes = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Hora de Buenos Aires (UTC-3 todo el año) a partir de un instante UTC
export function horaBA(isoUTC) {
  const t = P(isoUTC) - 3 * 36e5, d = new Date(t);
  return { dia: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), txt: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` };
}
// "8:30" en Nueva York de una fecha dada, convertido a Buenos Aires con el horario de verano de EE.UU. de esa fecha
export function nyABA(fecha, hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number), [y, mo, d] = fecha.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h + 4, m);  // suponiendo EDT
  const hNY = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(guess)));
  const utc = hNY === h ? guess : guess + 36e5;
  const ba = new Date(utc - 3 * 36e5);
  return `${ba.getUTCHours()}:${String(ba.getUTCMinutes()).padStart(2, "0")}`;
}

export function el(tag, attrs = {}, html) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  if (html != null) e.innerHTML = html;
  return e;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch (e) { return def; } };

let tToast;
export function toast(msg) {
  let t = $(".toast");
  if (!t) { t = el("div", { class: "toast", role: "status" }); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, 2600);
}
export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch (e) { return false; }
}
export function descargar(nombre, contenido, tipo = "text/csv;charset=utf-8") {
  const blob = contenido instanceof Blob ? contenido : new Blob(["﻿" + contenido], { type: tipo });
  const a = el("a", { href: URL.createObjectURL(blob), download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const csvCelda = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csvNum = v => v == null || !isFinite(v) ? "" : String(Math.round(v * 1e6) / 1e6).replace(".", ",");

export const ICONOS = {
  ampliar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bajar: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M2.5 13.5h11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  enlace: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.8 2.8 0 0 1 4 4L11 8.5M9 11.5l-1.2 1.2a2.8 2.8 0 0 1-4-4L5 7.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  estrella: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor"/></svg>',
  estrellaV: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  buscar: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  ajustes: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="4.5" r="1.6" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="6" cy="11.5" r="1.6" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
  cerrar: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  logo: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 15.5 7 10l3.5 3 6.5-8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="5" r="1.6" fill="currentColor"/></svg>',
};
