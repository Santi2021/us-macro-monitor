// Componente de gráfico: título, barra (pestañas y selectores), leyenda, gráfico, tabla, fuentes, datos y acciones.
// El mismo componente se usa en las secciones, en Mi monitor y en la ventana ampliada.
import { sinGuionFijo, el, esc, nf, sg, fm, fq, fw, fd, fPor, P, css, unidadTxt, ICONOS, toast, copiar, descargar, csvCelda, csvNum, horaBA, fLargo } from "./util.js";
import { last, prev, pctl } from "./calc.js";
import { ST, S, meta, fuente, enlaceSerie, FREC_TXT, proximoRelease, incorporado, guardarPrefs, orgDe } from "./datos.js";
import { CAT, armar } from "./catalogo.js";
import { opciones, leyenda, recorteShock, unirCursor, colorSerie, spVisible, ajustarEjes } from "./graficos.js";
import { enlaceGrafico } from "./rutas.js";

const VIVOS = new Set();
export function limpiarGraficos() { for (const c of VIVOS) { try { c.dispose(); } catch (e) {} } VIVOS.clear(); }
const observador = "IntersectionObserver" in window ? new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) { observador.unobserve(e.target); e.target._dibujar && e.target._dibujar(); }
}, { rootMargin: "300px" }) : null;

// Estrellas (Mi monitor)
export const esEstrella = id => (ST.prefs.estrellas || []).includes(id);
export function botonEstrella(id, nombre) {
  const b = el("button", { type: "button", class: "star", "aria-pressed": String(esEstrella(id)), title: esEstrella(id) ? "Quitar de Mi monitor" : "Agregar a Mi monitor", "aria-label": `Mi monitor: ${nombre}` },
    esEstrella(id) ? ICONOS.estrella : ICONOS.estrellaV);
  b.addEventListener("click", e => {
    e.stopPropagation();
    const lista = ST.prefs.estrellas || (ST.prefs.estrellas = []);
    const i = lista.indexOf(id);
    if (i >= 0) lista.splice(i, 1); else lista.push(id);
    guardarPrefs();
    const on = i < 0;
    document.querySelectorAll(`.star[data-id="${CSS.escape(id)}"]`).forEach(x => { x.setAttribute("aria-pressed", String(on)); x.innerHTML = on ? ICONOS.estrella : ICONOS.estrellaV; x.title = on ? "Quitar de Mi monitor" : "Agregar a Mi monitor"; });
    toast(on ? `${nombre}: agregado a Mi monitor` : `${nombre}: quitado de Mi monitor`);
  });
  b.dataset.id = id;
  return b;
}

// Línea de datos del gráfico: de cuándo es el dato, cuándo entró al monitor y cuándo sale el próximo
function metaLinea(sp) {
  const k = (sp.ks || []).find(k => ST.DATA.series[k]);
  if (!k) return "";
  const m = meta(k), s = S(k), partes = [];
  if (s) partes.push(`<span>Dato: ${m.f === "Q" ? fq(last(s)[0]) : m.f === "W" ? "semana al " + fw(last(s)[0]) : fm(last(s)[0])}</span>`);
  const inc = incorporado(k);
  if (inc) { const h = horaBA(inc); partes.push(`<span title="Momento en que el monitor incorporó el dato (hora de Buenos Aires)">Incorporado: ${fd(h.dia)} ${h.txt}</span>`); }
  const pr = ST.T1 === Infinity ? proximoRelease(sp.ks) : null;
  if (pr && pr.diario) partes.push("<span>Se actualiza varias veces por semana</span>");
  else if (pr) partes.push(`<span>Próximo: ${fd(pr.fecha)}</span>`);
  partes.push(`<span>${esc(sp.fuente || "")}</span>`);
  return partes.join("");
}

function tablaDe(sp) {
  const t = el("table", { class: "datos" });
  let cab, filas;
  if (sp.tabla) { cab = sp.tabla.cab; filas = sp.tabla.filas; }
  else if (sp.tipo === "cat") {
    cab = ["", ...sp.series.map(s => s.n)];
    filas = sp.cats.map((c, i) => [c, ...sp.series.map(s => nf(s.d[i], sp.dec ?? 1))]);
    if (sp.freq === "Q") filas.reverse();
  } else {
    const fx = fPor(sp.freq), dec = sp.dec ?? 1;
    const ts = [...new Set(sp.series.flatMap(s => s.d.map(p => p[0])))].sort((a, b) => b - a).slice(0, 60);
    const ms = sp.series.map(s => new Map(s.d));
    cab = [sp.freq === "Q" ? "Trimestre" : sp.freq === "W" ? "Semana" : "Mes", ...sp.series.map(s => s.n)];
    filas = ts.map(t => [fx(t), ...ms.map((m, i) => nf(m.get(t), sp.series[i].dec ?? dec))]);
  }
  t.innerHTML = "<thead><tr>" + cab.map(c => `<th scope="col">${esc(c)}</th>`).join("") + "</tr></thead><tbody>" +
    filas.map(f => "<tr>" + f.map(c => `<td>${esc(c)}</td>`).join("") + "</tr>").join("") + "</tbody>";
  return t;
}

function fuentesDe(sp) {
  const c = CAT[sp.id], box = el("div", { class: "panel-fuentes" });
  const principal = sp.series.find(s => Array.isArray(s.d) && s.d.length && Array.isArray(s.d[0]));
  let stats = "";
  if (principal && !sp.tipo) {
    const d = principal.d, u = sp.unidad ?? "%", dec = principal.dec ?? sp.dec ?? 1, fx = fPor(sp.freq);
    const mx = d.reduce((m, p) => p[1] > m[1] ? p : m), mn = d.reduce((m, p) => p[1] < m[1] ? p : m);
    const f = v => nf(v, dec) + unidadTxt(u);
    stats = `<div><h4>${esc(principal.n)}, en el período</h4><div class="stats">
      <div><span>Último</span><b>${f(last(d)[1])}</b><small>${fx(last(d)[0])}</small></div>
      <div><span>Anterior</span><b>${d.length > 1 ? f(prev(d)[1]) : "–"}</b><small>${d.length > 1 ? fx(prev(d)[0]) : ""}</small></div>
      <div><span>Máximo</span><b>${f(mx[1])}</b><small>${fx(mx[0])}</small></div>
      <div><span>Mínimo</span><b>${f(mn[1])}</b><small>${fx(mn[0])}</small></div>
      <div><span>Percentil histórico</span><b>${pctl(principal.d, last(d)[1]) ?? "–"}</b><small>dentro del período</small></div>
    </div></div>`;
  }
  const filas = (sp.ks || []).map(k => {
    const m = meta(k), s = S(k), url = enlaceSerie(k);
    return `<tr><td>${esc(m.n)}</td><td>${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(m.id)}</a>` : esc(m.id)}</td><td>${esc(orgDe(k))}</td><td>${esc(m.u)}</td><td>${FREC_TXT[m.f] || m.f}</td><td>${s ? fPor(m.f)(last(s)[0]) : "–"}</td></tr>`;
  }).join("");
  box.innerHTML = `${c && c.calc ? `<div><h4>Cómo se calcula</h4><p>${esc(c.calc)}</p></div>` : ""}${stats}
    <div><h4>Series</h4><div class="panel-tabla" style="max-height:none;margin:0"><table class="datos"><thead><tr><th>Serie</th><th>Código</th><th>Fuente</th><th>Unidad</th><th>Frecuencia</th><th>Último dato</th></tr></thead><tbody>${filas}</tbody></table></div></div>
    <div><h4>Cita</h4><p>${esc(cita(sp))}</p></div>`;
  return box;
}
const cita = sp => `Fuente: ${sp.fuente || "BEA, BLS y Fed"}. US Macro Monitor (@SantiGonzalezAR), consultado el ${fLargo(Date.now())}.`;

// ───────── Tarjeta ─────────
// opts: { clase, grande, grupo, o (opciones iniciales), spFijo (spec armado de afuera: indicadores y explorador) }
export function tarjeta(id, opts = {}) {
  const c = CAT[id];
  const art = el("article", { class: "card " + (opts.clase || "") + (opts.grande ? " grande" : ""), "data-id": id });
  let o = Object.assign({}, opts.o || {}), sp = null, chart = null, ley = null, pestana = "g";
  const construir = () => opts.spFijo ? opts.spFijo() : armar(id, o);
  sp = construir();
  if (!sp || (sp.tipo !== "heat" && !sp.series.some(s => s.d && s.d.length))) {
    art.innerHTML = `<h3>Sin datos para este gráfico</h3><p class="sub">Falta alguna de sus series en el período elegido o en la última actualización.</p>`;
    art._vacio = true;
    return art;
  }
  const nombre = c ? c.nombre : sp.titulo;
  art.innerHTML = `<div class="card-h"><h3></h3></div><p class="sub"></p>
    <div class="barra"><div class="pestanas" role="tablist"><button type="button" role="tab" data-p="g" aria-selected="true">Gráfico</button><button type="button" role="tab" data-p="t" aria-selected="false">Tabla</button><button type="button" role="tab" data-p="f" aria-selected="false">Fuentes</button></div><div class="selectores"></div></div>
    <div class="cuerpo"></div>
    <div class="meta-g"></div>
    <footer><div class="acciones">
      <button type="button" class="b-bajar" aria-haspopup="menu">${ICONOS.bajar}Descargar</button>
      ${c ? `<button type="button" class="b-enlace">${ICONOS.enlace}Enlace</button>` : ""}
      ${opts.grande ? "" : `<button type="button" class="b-ampliar">${ICONOS.ampliar}Ampliar</button>`}
    </div></footer>`;
  if (c) art.querySelector(".card-h").appendChild(botonEstrella(id, nombre));
  else if (opts.estrella) art.querySelector(".card-h").appendChild(botonEstrella(opts.estrella, "Esta combinación del explorador"));
  const cuerpo = art.querySelector(".cuerpo");

  // selectores (vista, real, escala) declarados por el gráfico
  const sel = art.querySelector(".selectores");
  for (const op of (c && !opts.spFijo ? c.ops : []) || []) {
    const g = el("div", { class: "seg chico", role: "group", "aria-label": op.nombre });
    for (const [v, txt] of op.valores) {
      const b = el("button", { type: "button", "aria-pressed": String((o[op.id] ?? op.valores[0][0]) === v), title: op.id === "real" && v === "r" ? `Deflactado (${op.defl === "cpi" ? "CPI" : op.defl === "pce_p" ? "deflactor del PCE" : "PPI de bienes de capital"})` : null }, esc(txt));
      b.addEventListener("click", () => { o[op.id] = v; g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); rehacer(); });
      g.appendChild(b);
    }
    sel.appendChild(g);
  }

  const pintarTextos = () => {
    art.querySelector("h3").textContent = sp.titulo;
    art.querySelector(".sub").textContent = sp.sub;
    art.querySelector(".meta-g").innerHTML = metaLinea(sp);
  };
  const dibujarGrafico = () => {
    if (chart) { chart.dispose(); VIVOS.delete(chart); chart = null; }
    cuerpo.innerHTML = "";
    const box = el("div", { class: "chart", role: "img", "aria-label": sp.titulo });
    ley = leyenda(sp, () => chart, () => { if (chart) { const v = spVisible(sp); chart.setOption(opciones(v, box.clientWidth, !!opts.grande), { notMerge: true }); ajustarEjes(chart, v); } });
    cuerpo.appendChild(ley.box);
    cuerpo.appendChild(box);
    const init = () => {
      if (!box.isConnected) return;
      chart = echarts.init(box, null, { renderer: "canvas" });
      chart.setOption(opciones(spVisible(sp), box.clientWidth, !!opts.grande));
      ajustarEjes(chart, spVisible(sp));
      VIVOS.add(chart);
      if (opts.grupo) unirCursor(opts.grupo, chart, ley, sp);
      art._chart = chart;
    };
    if (observador && !opts.grande) { box._dibujar = init; observador.observe(box); } else requestAnimationFrame(init);
  };
  const mostrar = () => {
    if (pestana === "g") dibujarGrafico();
    else { if (chart) { chart.dispose(); VIVOS.delete(chart); chart = null; } cuerpo.innerHTML = ""; cuerpo.appendChild(pestana === "t" ? el("div", { class: "panel-tabla" }).appendChild(tablaDe(sp)).parentNode : fuentesDe(sp)); }
  };
  const rehacer = () => { const n = construir(); if (!n) { toast("No hay datos para esa vista"); return; } sp = n; recorteShock(sp); pintarTextos(); mostrar(); };

  art.querySelectorAll(".pestanas button").forEach(b => b.addEventListener("click", () => {
    pestana = b.dataset.p;
    art.querySelectorAll(".pestanas button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    mostrar();
  }));
  const amp = art.querySelector(".b-ampliar");
  if (amp) amp.addEventListener("click", () => abrirGrafico(id, { o: { ...o }, spFijo: opts.spFijo }));
  const en = art.querySelector(".b-enlace");
  if (en) en.addEventListener("click", async () => { const ok = await copiar(enlaceGrafico(id, o)); toast(ok ? "Enlace copiado" : "No se pudo copiar el enlace"); });
  art.querySelector(".b-bajar").addEventListener("click", e => menuDescargas(e.currentTarget, () => sp, () => chart));

  recorteShock(sp);
  pintarTextos();
  mostrar();
  art._sp = () => sp;
  return art;
}

// ───────── Ventana ampliada y paneles ─────────
let modalAbierto = null;
export function abrirGrafico(id, opts = {}) {
  cerrarModal();
  const t = tarjeta(id, Object.assign({}, opts, { grande: true }));
  abrirModal(t, t.querySelector("h3")?.textContent || "");
}
export function abrirPanel(titulo, sub, nodo) {
  cerrarModal();
  const d = el("div", { class: "panel-doc" }, `<h2>${esc(titulo)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}`);
  d.appendChild(nodo);
  abrirModal(d, titulo);
}
function abrirModal(contenido, etiqueta) {
  const m = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": etiqueta });
  const dlg = el("div", { class: "dialogo" });
  const x = el("button", { type: "button", class: "cerrar", "aria-label": "Cerrar" }, ICONOS.cerrar);
  x.addEventListener("click", cerrarModal);
  dlg.append(x, contenido); m.appendChild(dlg);
  m.addEventListener("click", e => { if (e.target === m) cerrarModal(); });
  document.body.appendChild(m); document.body.classList.add("bloqueado");
  modalAbierto = { m, anterior: document.activeElement };
  x.focus();
}
export function cerrarModal() {
  if (!modalAbierto) return false;
  const { m, anterior } = modalAbierto;
  m.querySelectorAll(".chart").forEach(c => { const i = echarts.getInstanceByDom(c); if (i) { i.dispose(); VIVOS.delete(i); } });
  m.remove(); document.body.classList.remove("bloqueado"); modalAbierto = null;
  if (anterior && anterior.focus) anterior.focus();
  return true;
}
export const hayModal = () => !!modalAbierto;
export function redimensionar() { for (const c of VIVOS) { try { c.resize(); } catch (e) {} } }

// ───────── Descargas ─────────
function menuDescargas(boton, getSp, getChart) {
  cerrarPops();
  const sp = getSp();
  const pop = el("div", { class: "pop", role: "menu" });
  const items = [
    ["PNG para X (1200 × 675)", () => exportarPNG(spVisible(sp), 1200, 675, "x")],
    ["PNG para informe (1200 × 900)", () => exportarPNG(spVisible(sp), 1200, 900, "informe")],
    ["Copiar imagen", () => copiarImagen(spVisible(sp))],
    null,
    ["CSV de lo que se ve", () => csvVisible(spVisible(sp))],
    ["CSV de las series originales", () => csvOriginal(sp)],
    null,
    ["Copiar cita", async () => toast(await copiar(cita(sp)) ? "Cita copiada" : "No se pudo copiar")],
  ];
  for (const it of items) {
    if (!it) { pop.appendChild(el("hr")); continue; }
    const b = el("button", { type: "button", class: "item", role: "menuitem" }, esc(it[0]));
    b.addEventListener("click", () => { cerrarPops(); it[1](); });
    pop.appendChild(b);
  }
  colocar(pop, boton);
}
export function colocar(pop, ancla) {
  document.body.appendChild(pop);
  const r = ancla.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w)), top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  pop.style.left = left + window.scrollX + "px"; pop.style.top = top + window.scrollY + "px";
  pop.querySelector("button")?.focus();
  // se cierra con un clic afuera; el oyente se quita siempre al cerrar, así no queda uno viejo que cierre el próximo menú
  fueraDePop = e => { if (!pop.contains(e.target)) cerrarPops(); };
  setTimeout(() => { if (pop.isConnected) document.addEventListener("click", fueraDePop); }, 0);
}
let fueraDePop = null;
export function cerrarPops() {
  if (fueraDePop) { document.removeEventListener("click", fueraDePop); fueraDePop = null; }
  document.querySelectorAll(".pop").forEach(p => p.remove());
}

const nombreArchivo = (sp, ext) => `us-macro-monitor-${(CAT[sp.id]?.slug || sp.id || "grafico")}-${new Date().toISOString().slice(0, 10)}.${ext}`;
function csvVisible(sp) {
  let filas = [];
  if (sp.tabla) filas = [sp.tabla.cab, ...sp.tabla.filas];
  else if (sp.tipo === "cat") filas = [["", ...sp.series.map(s => s.n)], ...sp.cats.map((c, i) => [c, ...sp.series.map(s => csvNum(s.d[i]))])];
  else {
    const ts = [...new Set(sp.series.flatMap(s => s.d.map(p => p[0])))].sort((a, b) => a - b), ms = sp.series.map(s => new Map(s.d));
    filas = [["fecha", ...sp.series.map(s => s.n)], ...ts.map(t => [new Date(t).toISOString().slice(0, 10), ...ms.map(m => csvNum(m.get(t)))])];
  }
  filas.push([], [cita(sp)]);
  descargar(nombreArchivo(sp, "csv"), filas.map(f => f.map(x => csvCelda(typeof x === "string" ? sinGuionFijo(x) : x)).join(";")).join("\n"));
}
function csvOriginal(sp) {
  const ks = sp.ks || [];
  const ts = [...new Set(ks.flatMap(k => ST.DATA.series[k].d.map(p => p[0])))].sort();
  const ms = ks.map(k => new Map(ST.DATA.series[k].d));
  const filas = [["fecha", ...ks.map(k => `${meta(k).n} (${meta(k).id}, ${meta(k).u})`)], ...ts.map(t => [t, ...ms.map(m => csvNum(m.get(t)))]), [], [cita(sp)]];
  descargar(nombreArchivo(sp, "csv").replace(".csv", "-original.csv"), filas.map(f => f.map(csvCelda).join(";")).join("\n"));
}
// un mapa de calor con muchas filas necesita más alto para que se lean todos los nombres
const altoPara = (sp, H) => sp.tipo === "heat" && sp.filas && sp.filas.length > 16 ? Math.max(H, 330 + sp.filas.length * 26) : H;
async function copiarImagen(sp) {
  try {
    const blob = await componerPNG(sp, 1200, altoPara(sp, 675));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast("Imagen copiada: pegala en el chat o en X");
  } catch (e) { exportarPNG(sp, 1200, 675, "x"); toast("El navegador no permite copiar imágenes: se descargó el PNG"); }
}
async function exportarPNG(sp, W, H, tipo) {
  const blob = await componerPNG(sp, W, altoPara(sp, H));
  descargar(nombreArchivo(sp, "png").replace(".png", `-${tipo}.png`), blob);
}
function envolver(ctx, texto, ancho) {
  const pal = String(texto).split(" "), lin = []; let l = "";
  for (const p of pal) { const t = l ? l + " " + p : p; if (ctx.measureText(t).width > ancho && l) { lin.push(l); l = p; } else l = t; }
  if (l) lin.push(l);
  return lin;
}
// Imagen de marco fijo: título, subtítulo, leyenda con valores, gráfico dibujado a ese tamaño, fuente y firma
export function componerPNG(sp, W, H) {
  return new Promise(resolve => {
    const k = 2, pad = 40, fnt = css("--font");
    const c = document.createElement("canvas"); c.width = W * k; c.height = H * k;
    const ctx = c.getContext("2d"); ctx.scale(k, k);
    ctx.fillStyle = css("--surface"); ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top";
    ctx.font = `600 26px ${fnt}`; const lt = envolver(ctx, sp.titulo, W - pad * 2).slice(0, 2);
    ctx.font = `400 16px ${fnt}`; const ls = envolver(ctx, sp.sub, W - pad * 2).slice(0, 3);
    let y = pad - 6;
    ctx.fillStyle = css("--ink"); ctx.font = `600 26px ${fnt}`; for (const l of lt) { ctx.fillText(l, pad, y); y += 34; }
    y += 4; ctx.fillStyle = css("--muted"); ctx.font = `400 16px ${fnt}`; for (const l of ls) { ctx.fillText(l, pad, y); y += 22; }
    // leyenda
    const u = sp.unidad ?? (sp.tipo === "cat" ? "pp" : "%"), dec = sp.dec ?? 1;
    const items = sp.tipo === "heat" ? [] : sp.series.filter(s => s.enLeyenda !== false).map((s, i) => ({ c: colorSerie(sp, s, sp.series.indexOf(s)), forma: s.t === "bar" || s.area ? "cuadro" : s.t === "punto" ? "rombo" : s.punteada ? "punteada" : "linea",
      t: s.n + (sp.tipo !== "cat" && s.d.length ? "  " + nf(s.finValor ?? s.d[s.d.length - 1][1], s.dec ?? dec) + unidadTxt(s.u ?? u) : "") }))
      .concat((sp.refs || []).filter(r => r.l).map(r => ({ c: css("--ref"), t: r.l, forma: "punteada" })))
      .concat(sp.banda ? [{ c: css("--band"), t: sp.bandaTexto || "Rango normal 2000-19", forma: "cuadro" }] : []);
    y += 10; ctx.font = `500 15px ${fnt}`;
    let x = pad;
    for (const it of items) {
      const w = ctx.measureText(it.t).width + 34;
      if (x + w > W - pad && x > pad) { x = pad; y += 24; }
      ctx.strokeStyle = it.c; ctx.fillStyle = it.c; ctx.lineWidth = 3; ctx.setLineDash(it.forma === "punteada" ? [5, 4] : []);
      if (it.forma === "cuadro") { ctx.fillRect(x + 3, y + 3, 12, 12); }
      else if (it.forma === "rombo") { ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 16, y + 9); ctx.lineTo(x + 9, y + 16); ctx.lineTo(x + 2, y + 9); ctx.closePath(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x + 18, y + 9); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = css("--ink-2"); ctx.fillText(it.t, x + 24, y); x += w;
    }
    if (items.length) y += 28;
    const pie = 34, altoG = H - y - pie - pad * 0.6, anchoG = W - pad * 2 + 16;
    // gráfico a tamaño fijo en un contenedor fuera de pantalla
    const tmp = el("div", { style: `position:fixed;left:-99999px;top:0;width:${anchoG}px;height:${altoG}px` });
    document.body.appendChild(tmp);
    const ch = echarts.init(tmp, null, { renderer: "canvas", devicePixelRatio: k });
    const op = opciones(sp, anchoG, true); op.animation = false;
    ch.setOption(op);
    ajustarEjes(ch, sp);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, pad - 8, y, anchoG, altoG);
      ch.dispose(); tmp.remove();
      const yp = H - pie - 4;
      ctx.strokeStyle = css("--line"); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, yp - 8); ctx.lineTo(W - pad, yp - 8); ctx.stroke();
      ctx.fillStyle = css("--muted"); ctx.font = `400 14px ${fnt}`; ctx.fillText("Fuente: " + (sp.fuente || ""), pad, yp);
      ctx.fillStyle = css("--ink"); ctx.font = `600 15px ${fnt}`; const f = "@SantiGonzalezAR"; ctx.fillText(f, W - pad - ctx.measureText(f).width, yp);
      c.toBlob(resolve, "image/png");
    };
    img.src = ch.getDataURL({ type: "png", pixelRatio: k, backgroundColor: css("--surface") });
  });
}
