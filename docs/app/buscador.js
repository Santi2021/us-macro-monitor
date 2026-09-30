// Buscador rápido (Ctrl+K o /) y atajos de teclado. El índice se arma solo con el catálogo.
import { el, esc, sinTildes, leer, guardar } from "./util.js";
import { CAT, FRENTES, IND } from "./catalogo.js";
import { ST } from "./datos.js";
import { SECCIONES, navegar } from "./rutas.js";
import { abrirGrafico, abrirPanel, cerrarModal, hayModal, cerrarPops } from "./tarjeta.js";

let acciones = {};
export function configurarAcciones(a) { acciones = a; }

function indice() {
  const items = [];
  for (const c of Object.values(CAT)) items.push({ tipo: "Gráficos", txt: c.nombre, det: FRENTES[c.frente] || "", clave: [c.nombre, ...(c.sin || []), FRENTES[c.frente] || ""].join(" "), ir: () => abrirGrafico(c.id), id: "g:" + c.id });
  for (const i of IND) items.push({ tipo: "Indicadores", txt: i.n, det: i.nota, clave: `${i.n} ${i.nota}`, ir: () => abrirGrafico(i.g), id: "i:" + i.id });
  for (const [s, n] of SECCIONES) if (s !== "|") items.push({ tipo: "Secciones", txt: n, det: "", clave: n, ir: () => navegar(s), id: "s:" + s });
  for (const [n, f, det] of [
    ["Tema oscuro", () => acciones.tema("oscuro"), "apariencia"], ["Tema claro", () => acciones.tema("claro"), "apariencia"], ["Tema automático", () => acciones.tema("auto"), "apariencia"],
    ["Letra grande", () => acciones.letra("grande"), "legibilidad"], ["Letra normal", () => acciones.letra("normal"), "legibilidad"],
    ["Período: desde 2022", () => acciones.periodo("2022"), "período"], ["Período: 5 años", () => acciones.periodo("5"), "período"],
    ["Período: 10 años", () => acciones.periodo("10"), "período"], ["Período: desde 2000", () => acciones.periodo("2000"), "período"],
    ["Bajar el tablero en CSV", () => { navegar("tablero"); setTimeout(() => document.querySelector(".filtros .btn")?.click(), 400); }, "tablero"],
    ["Estado de los datos", () => navegar("metodologia", "series"), "metodología"], ["Glosario", () => navegar("metodologia", "glosario"), "metodología"],
    ["Atajos de teclado", () => ayuda(), "ayuda"],
  ]) items.push({ tipo: "Acciones", txt: n, det, clave: n + " " + det, ir: f, id: "a:" + n });
  return items;
}
// Coincidencia tolerante: todas las letras de la búsqueda en orden (encuentra "hipotecria" en "hipotecaria")
function puntaje(q, texto) {
  const t = sinTildes(texto);
  if (!q) return 1;
  const pal = q.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const p of pal) {
    const i = t.indexOf(p);
    if (i >= 0) { total += 100 - Math.min(i, 60) + (i === 0 || t[i - 1] === " " ? 40 : 0); continue; }
    let j = 0, salto = 0, prevPos = -1;
    for (const ch of p) { const k = t.indexOf(ch, prevPos + 1); if (k < 0) return 0; salto += k - prevPos - 1; prevPos = k; j++; }
    if (salto > p.length * 2) return 0;
    total += 30 - salto;
  }
  return total;
}
export function abrirBuscador() {
  cerrarPops();
  if (document.querySelector(".buscador")) return;
  const items = indice();
  const recientes = leer("umm-recientes", []);
  const cont = el("div", { class: "buscador", role: "dialog", "aria-modal": "true", "aria-label": "Buscar" });
  cont.innerHTML = `<div class="caja"><input type="search" placeholder="Buscar gráficos, indicadores, secciones o acciones…" aria-label="Buscar" autocomplete="off" spellcheck="false">
    <div class="res" role="listbox"></div><div class="pie-b"><span><kbd>↑</kbd> <kbd>↓</kbd> elegir</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div></div>`;
  const input = cont.querySelector("input"), res = cont.querySelector(".res");
  let lista = [], sel = 0;
  const pintar = () => {
    const q = sinTildes(input.value.trim());
    if (!q) {
      const rec = recientes.map(id => items.find(i => i.id === id)).filter(Boolean);
      lista = [...rec.map(r => Object.assign({}, r, { tipo: "Recientes" })), ...items.filter(i => i.tipo === "Secciones")];
    } else {
      lista = items.map(i => [i, puntaje(q, i.clave) + (sinTildes(i.txt).startsWith(q) ? 80 : 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 14).map(x => x[0]);
      const orden = ["Gráficos", "Indicadores", "Secciones", "Acciones"];
      lista.sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
    }
    sel = Math.min(sel, Math.max(0, lista.length - 1));
    let h = "", g = null;
    lista.forEach((it, i) => {
      if (it.tipo !== g) { g = it.tipo; h += `<div class="grupo">${esc(g)}</div>`; }
      h += `<div class="item" role="option" data-i="${i}" aria-selected="${i === sel}"><span>${esc(it.txt)}</span><small>${esc(it.det)}</small></div>`;
    });
    res.innerHTML = h || `<div class="grupo">Sin resultados</div>`;
    res.querySelectorAll(".item").forEach(x => {
      x.addEventListener("mousemove", () => { if (sel !== Number(x.dataset.i)) { sel = Number(x.dataset.i); marcar(); } });
      x.addEventListener("click", () => elegir(Number(x.dataset.i)));
    });
  };
  const marcar = () => res.querySelectorAll(".item").forEach(x => { const on = Number(x.dataset.i) === sel; x.setAttribute("aria-selected", String(on)); if (on) x.scrollIntoView({ block: "nearest" }); });
  const cerrar = () => cont.remove();
  const elegir = i => {
    const it = lista[i]; if (!it) return;
    guardar("umm-recientes", [it.id, ...recientes.filter(x => x !== it.id)].slice(0, 5));
    cerrar(); cerrarModal(); it.ir();
  };
  input.addEventListener("input", () => { sel = 0; pintar(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(lista.length - 1, sel + 1); marcar(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); marcar(); }
    else if (e.key === "Enter") { e.preventDefault(); elegir(sel); }
    else if (e.key === "Escape") { e.preventDefault(); cerrar(); }
  });
  cont.addEventListener("click", e => { if (e.target === cont) cerrar(); });
  document.body.appendChild(cont);
  pintar(); input.focus();
}

const ATAJOS = [["Ctrl+K o /", "Buscar"], ["?", "Esta ayuda"], ["P", "Portada"], ["M", "Mi monitor"], ["T", "Tablero"], ["C", "Calendario"],
  ["1 a 6", "Actividad, Consumidor, Precios, Empleo, Tasas, Externo y fiscal"], ["E", "Explorador"], ["G", "Metodología"],
  ["D", "Cambiar tema claro u oscuro"], ["L", "Letra grande o normal"], ["← →", "Semana anterior o siguiente (calendario)"], ["Esc", "Cerrar ventanas"]];
function ayuda() {
  const box = el("div", { class: "ayuda-atajos" }, ATAJOS.map(([k, t]) => `<div><span>${esc(t)}</span><kbd>${esc(k)}</kbd></div>`).join(""));
  abrirPanel("Atajos de teclado", "Funcionan en cualquier parte de la página, salvo mientras se escribe en un campo.", box);
}
export function atajos() {
  const frentes = Object.keys(FRENTES);
  document.addEventListener("keydown", e => {
    const t = e.target, escribiendo = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); abrirBuscador(); return; }
    if (e.key === "Escape") { cerrarPops(); if (!document.querySelector(".buscador")) cerrarModal(); return; }
    if (escribiendo || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".buscador")) return;
    const k = e.key.toLowerCase();
    if (k === "/") { e.preventDefault(); abrirBuscador(); return; }
    if (k === "?") { e.preventDefault(); ayuda(); return; }
    if (hayModal()) return;
    const ir = { p: "portada", m: "mi", t: "tablero", c: "calendario", e: "explorador", g: "metodologia" }[k];
    if (ir) { navegar(ir); return; }
    if (/^[1-6]$/.test(k)) { navegar(frentes[Number(k) - 1]); return; }
    if (k === "d") acciones.tema(document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches) ? "claro" : "oscuro");
    if (k === "l") acciones.letra(ST.prefs.letra === "grande" ? "normal" : "grande");
    if ((k === "arrowleft" || k === "arrowright") && acciones.flecha) acciones.flecha(k === "arrowleft" ? -1 : 1);
  });
}
