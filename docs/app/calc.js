// Transformaciones de series. Una serie es un arreglo [[t (ms UTC), valor], ...] ordenado por fecha.
import { T } from "./util.js";

export const last = a => a && a.length ? a[a.length - 1] : null;
export const prev = (a, n = 1) => a && a.length > n ? a[a.length - 1 - n] : null;

function lagged(a, k, fn) {
  if (!a) return null;
  const out = [];
  for (let i = k; i < a.length; i++) if (a[i - k][1]) out.push([a[i][0], fn(a[i][1], a[i - k][1])]);
  return out.length ? out : null;
}
export const yoy = (a, k = 12) => lagged(a, k, (x, y) => (x / y - 1) * 100);
export const ann = (a, k, per = 12) => lagged(a, k, (x, y) => (Math.pow(x / y, per / k) - 1) * 100);
export const pct = (a, k = 1) => lagged(a, k, (x, y) => (x / y - 1) * 100);
export const diff = (a, k = 1) => lagged(a, k, (x, y) => x - y);
export const escala = (a, f) => a ? a.map(p => [p[0], p[1] * f]) : null;

export function roll(a, w, suma = false) {
  if (!a || a.length < w) return null;
  const out = [];
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i][1];
    if (i >= w) s -= a[i - w][1];
    if (i >= w - 1) out.push([a[i][0], suma ? s : s / w]);
  }
  return out;
}
export function join(a, b, fn) {
  if (!a || !b) return null;
  const m = new Map(b); const r = a.filter(p => m.has(p[0])).map(p => [p[0], fn(p[1], m.get(p[0]))]);
  return r.length ? r : null;
}
// Une una serie mensual con una trimestral (el mes toma el valor de su trimestre)
export function joinQ(m, q, fn) {
  if (!m || !q) return null;
  const mq = new Map(q);
  const r = m.map(([t, v]) => { const d = new Date(t); const k = Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1); return mq.has(k) ? [t, fn(v, mq.get(k))] : null; }).filter(Boolean);
  return r.length ? r : null;
}
// Mensual a trimestral (promedio; sólo trimestres completos)
export function toQ(a) {
  if (!a) return null;
  const g = new Map();
  for (const [t, v] of a) {
    const d = new Date(t), k = Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
    if (!g.has(k)) g.set(k, []); g.get(k).push(v);
  }
  return [...g].filter(([, v]) => v.length === 3).map(([k, v]) => [k, v.reduce((x, y) => x + y, 0) / 3]);
}
// Semanal a mensual (promedio del mes)
export function aMensual(a) {
  if (!a) return null;
  const g = new Map();
  for (const [t, v] of a) { const d = new Date(t), k = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); if (!g.has(k)) g.set(k, []); g.get(k).push(v); }
  return [...g].map(([k, v]) => [k, v.reduce((x, y) => x + y, 0) / v.length]);
}
// Índice con base fija (valor en la fecha base = 100); si la serie empieza después, base en su primer dato
export function indice(a, base) {
  if (!a || !a.length) return null;
  const b = a.find(p => p[0] >= base) || a[0];
  return a.map(p => [p[0], p[1] / b[1] * 100]);
}
// Deflacta una serie nominal con un índice de precios: resultado en moneda del último período del deflactor
export function deflactar(a, defl) {
  if (!a || !defl) return null;
  const m = new Map(defl), ult = defl[defl.length - 1][1];
  const r = a.filter(p => m.has(p[0])).map(p => [p[0], p[1] / m.get(p[0]) * ult]);
  return r.length ? r : null;
}
export function rangoNormal(a) {
  if (!a) return null;
  const r = a.filter(p => p[0] >= T(2000) && p[0] < T(2020)).map(p => p[1]).sort((x, y) => x - y);
  if (r.length < 12) return null;
  const q = f => r[Math.round(f * (r.length - 1))];
  return [q(0.1), q(0.9)];
}
export function pctl(a, v) {
  const r = a.filter(p => p[0] >= T(2000)).map(p => p[1]);
  return r.length ? Math.round(r.filter(x => x <= v).length / r.length * 100) : null;
}
// Percentiles 10 y 90 del rango normal expresados como posición 0-100 dentro de toda la historia
export function bandaPctl(a) {
  const rn = rangoNormal(a); if (!rn) return null;
  return [pctl(a, rn[0]), pctl(a, rn[1])];
}
// "el mayor en 14 meses", "el menor desde mar-21": contexto histórico del último dato
export function racha(a, fx, unidad = "meses") {
  if (!a || a.length < 8) return "";
  const v = a[a.length - 1][1];
  let n = 0, i = a.length - 2;
  const mayor = v > a[i][1];
  while (i >= 0 && (mayor ? a[i][1] < v : a[i][1] > v)) { n++; i--; }
  if (n < 6) return "";
  if (i < 0) return mayor ? "el máximo de la serie" : "el mínimo de la serie";
  return n >= 24 ? `el ${mayor ? "mayor" : "menor"} desde ${fx(a[i][0])}` : `el ${mayor ? "mayor" : "menor"} en ${n + 1} ${unidad}`;
}
// Valor en una fecha: el último dato en o antes de t (búsqueda binaria)
export function valorEn(a, t) {
  if (!a || !a.length || t < a[0][0]) return null;
  let lo = 0, hi = a.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m][0] <= t) lo = m; else hi = m - 1; }
  return a[lo];
}
