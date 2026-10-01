// Arranque: cabecera, navegación, período, ajustes, vigía y ruteo.
import { el, esc, $, $$, P, fm, fLargo, ICONOS, horaBA, fd, guardar, leer, toast } from "./util.js";
import { ST, VERSION, calcularRango, guardarPrefs, releasesDiarios, vigia, limpiarCache, necesitaHistoria, cargarHistoria, cargarDiarios, prepararDatos } from "./datos.js";
import { FRENTES, CAT, porSlug, seccionConHistoria } from "./catalogo.js";
import { SECCIONES, leerRuta, construir, navegar, aplicarPeriodoDeRuta } from "./rutas.js";
import { limpiarGraficos, abrirGrafico, abrirPanel, cerrarModal, hayModal, colocar, cerrarPops, redimensionar } from "./tarjeta.js";
import { limpiarGrupos } from "./graficos.js";
import { estadoPrueba, vistaPortada, vistaMi, vistaFrente, vistaCiclo, vistaTablero, vistaCalendario, vistaExplorador, vistaMetodologia, leerExplora, moverSemana } from "./vistas.js";
import { abrirBuscador, atajos, configurarAcciones } from "./buscador.js";

// Datos para la prueba automática (scripts/smoke.mjs)
window.__monitor = { listo: false, errores: [], rutas: SECCIONES.filter(s => s[0] !== "|").map(s => s[0]), vista: null };
window.addEventListener("error", e => window.__monitor.errores.push(String(e.message)));
window.addEventListener("unhandledrejection", e => window.__monitor.errores.push(String(e.reason)));

let SEC = "portada", reabrir = null;

// ───────── Apariencia ─────────
function aplicarApariencia() {
  const r = document.documentElement, p = ST.prefs;
  if (p.tema === "claro") r.dataset.theme = "light"; else if (p.tema === "oscuro") r.dataset.theme = "dark"; else delete r.dataset.theme;
  if (p.letra === "grande") r.dataset.letra = "grande"; else delete r.dataset.letra;
}
const acciones = {
  tema: t => { ST.prefs.tema = t; guardarPrefs(); aplicarApariencia(); render(); toast(`Tema ${t === "auto" ? "automático" : t}`); },
  letra: l => { ST.prefs.letra = l; guardarPrefs(); aplicarApariencia(); render(); toast(`Letra ${l}`); },
  periodo: m => { ST.rango = { modo: m, desde: null, hasta: null }; guardarRango(); irConPeriodo(); },
  flecha: n => { if (SEC === "calendario") { moverSemana(n); render(); } },
};
configurarAcciones(acciones);

// ───────── Cabecera ─────────
function cabecera() {
  const top = $("#top");
  top.innerHTML = `<div class="marca"><a class="logo inicio" href="#/portada" title="Ir al inicio" aria-label="Ir al inicio">${ICONOS.logo}</a><div>
      <h1><a class="inicio" href="#/portada" title="Ir al inicio">US Macro Monitor</a><small>v${VERSION}</small></h1>
      <div class="fila"><p id="meta"></p><button type="button" class="vigia" id="vigia"><i></i><span></span></button></div></div></div>
    <div class="herr">
      <button type="button" class="buscar-btn" id="b-buscar" aria-label="Buscar (Ctrl+K)">${ICONOS.buscar}<span>Buscar</span><kbd>Ctrl K</kbd></button>
      <div class="periodo"><div class="seg" role="group" aria-label="Período" id="rango">
        <button type="button" data-r="2022">Desde 2022</button><button type="button" data-r="5">5 años</button><button type="button" data-r="10">10 años</button><button type="button" data-r="2000">Desde 2000</button><button type="button" data-r="todo" title="Cada serie desde su inicio (desde 1947)">Todo</button><button type="button" data-r="manual" aria-expanded="false">Elegir fechas</button></div></div>
      <button type="button" class="icono-btn" id="b-ajustes" aria-label="Ajustes" aria-haspopup="menu">${ICONOS.ajustes}</button>
      <form class="manual" id="manual" hidden>
        <label>Desde <input type="month" id="m-desde" min="1947-01" required></label>
        <label>Hasta <input type="month" id="m-hasta" min="1947-01" required></label>
        <button type="submit">Aplicar</button></form>
    </div>`;
  // logo y nombre: vuelven a la portada con el período por defecto, arriba de todo
  $$(".marca .inicio").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    cerrarPops(); cerrarModal();
    ST.rango = { modo: "2022", desde: null, hasta: null }; guardarRango();
    navegar("portada");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  $("#b-buscar").addEventListener("click", abrirBuscador);
  $("#b-ajustes").addEventListener("click", e => menuAjustes(e.currentTarget));
  $$("#rango button").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.r === "manual") {
      ST.rango.modo = "manual";
      const d = $("#m-desde"), h = $("#m-hasta");
      if (!d.value) d.value = ST.rango.desde || "2019-01";
      if (!h.value) h.value = ST.rango.hasta || h.max;
      marcarRango(); d.focus(); return;
    }
    ST.rango = { modo: b.dataset.r, desde: null, hasta: null };
    guardarRango(); irConPeriodo();
  }));
  $("#manual").addEventListener("submit", e => {
    e.preventDefault();
    let d = $("#m-desde").value, h = $("#m-hasta").value;
    if (!d || !h) return;
    if (d > h) [d, h] = [h, d];
    ST.rango = { modo: "manual", desde: d, hasta: h };
    guardarRango(); irConPeriodo();
  });
  $("#vigia").addEventListener("click", () => navegar("metodologia", "series"));
}
function menuAjustes(boton) {
  cerrarPops();
  const p = ST.prefs;
  const pop = el("div", { class: "pop", role: "menu", "aria-label": "Ajustes" });
  const grupo = (titulo, opciones, actual, fn) => {
    pop.appendChild(el("h4", {}, titulo));
    const seg = el("div", { class: "fila" }); const s = el("div", { class: "seg chico" });
    for (const [v, t] of opciones) { const b = el("button", { type: "button", "aria-pressed": String(actual === v) }, t); b.addEventListener("click", () => { cerrarPops(); fn(v); }); s.appendChild(b); }
    seg.appendChild(s); pop.appendChild(seg);
  };
  grupo("Tema", [["auto", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]], p.tema || "auto", acciones.tema);
  grupo("Tamaño de letra", [["normal", "Normal"], ["grande", "Grande"]], p.letra || "normal", acciones.letra);
  grupo("Recesiones (períodos de 10 años o más)", [["si", "Mostrar"], ["no", "Ocultar"]], p.recesiones === false ? "no" : "si", v => { ST.prefs.recesiones = v === "si"; guardarPrefs(); render(); });
  pop.appendChild(el("hr"));
  const at = el("button", { type: "button", class: "item" }, "Atajos de teclado <small>?</small>");
  at.addEventListener("click", () => { cerrarPops(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })); });
  pop.appendChild(at);
  pop.addEventListener("click", e => e.stopPropagation());
  colocar(pop, boton);
}
function marcarRango() {
  $$("#rango button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.r === ST.rango.modo)));
  const abierto = ST.rango.modo === "manual";
  $("#manual").hidden = !abierto;
  $("#rango [data-r=manual]").setAttribute("aria-expanded", String(abierto));
  if (ST.rango.modo === "manual" && ST.rango.desde) { $("#m-desde").value = ST.rango.desde; $("#m-hasta").value = ST.rango.hasta; }
}
const guardarRango = () => guardar("umm-rango2", ST.rango);
function irConPeriodo() {
  const r = leerRuta();
  const q = Object.assign({}, r.q); delete q.periodo;
  navegar(r.sec, r.sub, q, true);
  render();
}
function actualizarMeta() {
  const g = horaBA(ST.DATA.generado);
  let h = `Actualizado el <b>${fd(g.dia)} ${g.txt}</b> · ${Object.keys(ST.DATA.series).length} series`;
  if (ST.T1 !== Infinity) h += ` · <span class="aviso">Viendo datos hasta ${fm(ST.T1)}</span>`;
  $("#meta").innerHTML = h;
  const v = vigia(), b = $("#vigia");
  b.className = "vigia " + (v.estado === "ok" ? "" : v.estado);
  b.querySelector("span").textContent = v.texto;
  b.title = "Estado de las series";
}

// ───────── Navegación ─────────
function navegacion() {
  const nav = $("#tabs"); nav.innerHTML = "";
  for (const [id, n] of SECCIONES) {
    if (id === "|") { nav.appendChild(el("span", { class: "sep", "aria-hidden": "true" })); continue; }
    nav.appendChild(el("a", { href: construir(id), "data-s": id, "aria-current": id === SEC ? "page" : null }, esc(n)));
  }
  const mov = $("#nav-movil");
  mov.innerHTML = `<select aria-label="Sección">${SECCIONES.filter(s => s[0] !== "|").map(([id, n]) => `<option value="${id}" ${id === SEC ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  const b = el("button", { type: "button", class: "icono-btn", "aria-label": "Buscar" }, ICONOS.buscar);
  b.addEventListener("click", abrirBuscador);
  mov.appendChild(b);
  mov.querySelector("select").addEventListener("change", e => navegar(e.target.value));
}

// ───────── Render ─────────
let cargandoHistoria = false;
function render() {
  cerrarPops();
  calcularRango();
  if (necesitaHistoria() || (seccionConHistoria(SEC) && !ST.historia)) {
    if (!cargandoHistoria) {
      cargandoHistoria = true;
      $("#main").innerHTML = `<p class="vacio-txt" style="margin-top:32px">Cargando la historia completa (desde 1947)…</p>`;
      cargarHistoria().then(() => { cargandoHistoria = false; render(); if (reabrir) { const f = reabrir; reabrir = null; f(); } })
        .catch(e => { cargandoHistoria = false; ST.historia = true; toast("No se pudo cargar la historia completa; se muestra desde 1998"); window.__monitor.errores.push("historia: " + e); render(); });
    }
    return;
  }
  limpiarGraficos(); limpiarGrupos(); limpiarCache();
  calcularRango(); marcarRango(); actualizarMeta(); navegacion();
  estadoPrueba.graficos = 0; estadoPrueba.vacios = 0;
  const main = $("#main"); main.innerHTML = "";
  const r = leerRuta();
  try {
    if (SEC === "portada") vistaPortada(main);
    else if (SEC === "mi") vistaMi(main);
    else if (SEC === "tablero") vistaTablero(main, render);
    else if (SEC === "calendario") vistaCalendario(main, render);
    else if (SEC === "explorador") vistaExplorador(main, render);
    else if (SEC === "metodologia") vistaMetodologia(main, r.sub);
    else if (SEC === "ciclo") vistaCiclo(main);
    else vistaFrente(main, SEC);
  } catch (e) {
    console.error(e); window.__monitor.errores.push(String(e));
    main.innerHTML = `<section class="estado"><h2>Algo falló al armar esta vista</h2><p>${esc(e.message)}. Probá con otra sección; el aviso ya quedó registrado.</p></section>`;
  }
  window.__monitor.vista = { ruta: SEC, graficos: estadoPrueba.graficos, vacios: estadoPrueba.vacios };
}
function alCambiarRuta() {
  const r = leerRuta();
  if (aplicarPeriodoDeRuta(r.q)) guardarRango();
  if (r.sec === "mi" && r.q.set) { ST.prefs.estrellas = r.q.set.split(",").filter(Boolean); guardarPrefs(); }
  if (r.sec === "explorador") leerExplora(r.sub, r.q);
  const cambioSec = r.sec !== SEC;
  SEC = r.sec;
  cerrarModal();
  render();
  if (cambioSec) window.scrollTo({ top: 0 });
  // enlace directo a un gráfico: se abre ampliado con sus opciones
  if (r.sub && r.sec !== "metodologia" && r.sec !== "explorador") {
    const c = porSlug(r.sub);
    if (c) {
      const o = {}; for (const op of c.ops || []) if (r.q[op.id]) o[op.id] = r.q[op.id];
      if (cargandoHistoria) reabrir = () => abrirGrafico(c.id, { o }); else abrirGrafico(c.id, { o });
    }
  }
}

// ───────── Inicio ─────────
function iniciar(json) {
  ST.DATA = prepararDatos(json);
  ST.diarios = releasesDiarios();
  const fin = Object.values(json.series).map(s => s.d.length ? s.d[s.d.length - 1][0] : "").filter(f => f <= new Date().toISOString().slice(0, 10)).sort().pop();
  ST.ULT = P(fin);
  $("#m-desde").max = fin.slice(0, 7); $("#m-hasta").max = fin.slice(0, 7);
  const r = leer("umm-rango2", null); if (r && r.modo) ST.rango = r;
  // una dirección vieja de la v3 (#precios, #explorador/k:t) pasa al formato nuevo
  if (location.hash && !location.hash.startsWith("#/")) {
    const v = location.hash.slice(1).split("/")[0];
    const sub = location.hash.slice(1).split("/")[1];
    history.replaceState(null, "", construir(v === "resumen" ? "portada" : v, null, sub && v === "explorador" ? { s: sub } : {}));
  }
  SEC = null;
  alCambiarRuta();
  window.__monitor.listo = true;
}
aplicarApariencia();
cabecera();
atajos();
window.addEventListener("hashchange", alCambiarRuta);
window.addEventListener("scroll", () => $("#tabs").classList.toggle("con-sombra", window.scrollY > 120), { passive: true });
let tRes, anchoPrevio = window.innerWidth;
window.addEventListener("resize", () => {
  clearTimeout(tRes);
  tRes = setTimeout(() => { if (ST.DATA && Math.abs(window.innerWidth - anchoPrevio) > 60 && !hayModal()) { anchoPrevio = window.innerWidth; render(); } else redimensionar(); }, 200);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => ST.DATA && ST.prefs.tema === "auto" && render());

if (typeof echarts === "undefined") {
  $("#main").innerHTML = `<section class="estado"><h2>No cargó la librería de gráficos</h2><p>Recargá la página. Si sigue, el archivo vendor/echarts-5.5.1.min.js no se está publicando.</p></section>`;
} else {
  // los datos diarios se piden en paralelo; si fallan, los gráficos usan el promedio mensual
  Promise.all([fetch("data.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))), cargarDiarios()])
    .then(([d]) => iniciar(d))
    .catch(e => {
      console.error(e); window.__monitor.errores.push(String(e));
      $("#meta").textContent = "Sin datos todavía";
      $("#main").innerHTML = `<section class="estado"><h2>No se pudieron cargar los datos</h2><p>Recargá la página. Si el problema sigue, la actualización automática avisa por mail.</p></section>`;
    });
}
