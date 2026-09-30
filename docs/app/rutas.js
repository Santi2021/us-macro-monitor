// Direcciones legibles: #/seccion[/grafico][?vista=m&real=r&periodo=5]
// El período viaja en la dirección para que un enlace muestre exactamente lo mismo a quien lo recibe.
import { ST } from "./datos.js";
import { CAT } from "./catalogo.js";

export const SECCIONES = [
  ["portada", "Portada"], ["mi", "Mi monitor"], ["tablero", "Tablero"], ["calendario", "Calendario"], ["|"],
  ["actividad", "Actividad"], ["consumidor", "Consumidor"], ["precios", "Precios"], ["empleo", "Empleo"], ["tasas", "Tasas"], ["externo", "Externo y fiscal"], ["|"],
  ["explorador", "Explorador"], ["metodologia", "Metodología"],
];
const VALIDAS = new Set(SECCIONES.map(s => s[0]).filter(s => s !== "|"));
const VIEJAS = { resumen: "portada" };   // direcciones de la v3

export function leerRuta() {
  let h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [camino, query = ""] = h.split("?");
  const partes = camino.split("/").filter(Boolean);
  let sec = VIEJAS[partes[0]] || partes[0] || "portada";
  if (sec === "explorador" && partes[1] && partes[1].includes(":")) partes[1] = partes[1];   // v3: #explorador/k:t,...
  if (!VALIDAS.has(sec)) sec = "portada";
  const q = Object.fromEntries(new URLSearchParams(query));
  return { sec, sub: partes[1] || null, q };
}
export function rutaActual() { return leerRuta(); }

const periodoTxt = () => {
  const r = ST.rango;
  if (r.modo === "manual" && r.desde) return `${r.desde}_${r.hasta}`;
  return r.modo === "2022" ? null : r.modo;
};
export function aplicarPeriodoDeRuta(q) {
  const p = q.periodo;
  if (!p) return false;
  if (/^\d{4}-\d{2}_\d{4}-\d{2}$/.test(p)) { const [d, h] = p.split("_"); ST.rango = { modo: "manual", desde: d, hasta: h }; return true; }
  if (["2022", "5", "10", "2000", "todo"].includes(p)) { ST.rango = { modo: p, desde: null, hasta: null }; return true; }
  return false;
}
export function construir(sec, sub, extra = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) if (v != null && v !== "") q.set(k, v);
  const p = periodoTxt(); if (p && !q.has("periodo")) q.set("periodo", p);
  const s = q.toString();
  return `#/${sec}${sub ? "/" + sub : ""}${s ? "?" + s : ""}`;
}
export function enlaceGrafico(id, o = {}) {
  const c = CAT[id]; if (!c) return location.href;
  const defs = Object.fromEntries((c.ops || []).map(op => [op.id, op.valores[0][0]]));
  const extra = {}; for (const [k, v] of Object.entries(o)) if (defs[k] != null && v !== defs[k]) extra[k] = v;
  return location.origin + location.pathname + construir(c.frente || "portada", c.slug, extra);
}
export function navegar(sec, sub = null, extra = {}, reemplazar = false) {
  const h = construir(sec, sub, extra);
  if (reemplazar) history.replaceState(null, "", h); else if (location.hash !== h) location.hash = h;
  else window.dispatchEvent(new HashChangeEvent("hashchange"));
}
