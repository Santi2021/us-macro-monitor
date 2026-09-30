// Vistas: portada, Mi monitor, tablero, calendario, frentes, explorador y metodología.
import { el, esc, nf, sg, fm, fq, fw, fd, fLargo, P, T, DIA_MS, DIA_LARGO, MES, hoyUTC, unidadTxt, horaBA, nyABA, ICONOS, descargar, csvCelda, csvNum, toast, copiar, fPor } from "./util.js";
import { last, yoy, ann, pct, diff, deflactar, aMensual, indice, join } from "./calc.js";
import { ST, S, cut, meta, fuente, orgDe, enlaceSerie, FREC_TXT, VERSION, agenda, estadoRelease, infoRelease, nombreRelease, proximoRelease, resultadoRelease, vigia, releaseDe } from "./datos.js";
import { CAT, FRENTES, BLOQUES, PREGUNTAS_CICLO, IND, INDX, RESUMEN_TILES, CABECERA_TILES, valorInd, fechaInd, lineasLectura, armar } from "./catalogo.js";
import { tarjeta, abrirGrafico, abrirPanel, botonEstrella, esEstrella } from "./tarjeta.js";
import { construir, navegar } from "./rutas.js";
import { paleta } from "./graficos.js";

export const estadoPrueba = { graficos: 0, vacios: 0 };

// ───────── Indicadores ─────────
function sparkline(a, ancho = 200, alto = 30) {
  if (!a || a.length < 2) return "";
  const v = a.map(p => p[1]), mn = Math.min(...v), mx = Math.max(...v), pad = 4;
  const x = i => i / (v.length - 1) * (ancho - pad), y = t => alto - pad - (mx === mn ? 0.5 : (t - mn) / (mx - mn)) * (alto - 2 * pad);
  const d = v.map((t, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(t).toFixed(1)).join("");
  return `<svg class="spark" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d} L${x(v.length - 1).toFixed(1)} ${alto} L0 ${alto}Z" fill="var(--s1)" opacity=".08"/>
    <path d="${d}" fill="none" stroke="var(--s1)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
const barraPctl = (r, clase = "pctl") => `<i>${r.banda ? `<s style="left:${r.banda[0]}%;width:${Math.max(2, r.banda[1] - r.banda[0])}%"></s>` : ""}<b style="left:calc(${r.pctl}% - 1px)"></b></i>`;
export function tile(id) {
  const ind = INDX[id], r = ind && valorInd(ind);
  if (!ind || !r) return null;
  const e = el("div", { class: "tile", tabindex: "0", role: "button", "aria-label": `${ind.n}: ${nf(r.v, ind.d)}${unidadTxt(ind.u)}. Ver gráfico` });
  const per = ind.q ? "trim." : ind.w ? "semana" : "mes";
  e.innerHTML = `<div class="lab">${esc(ind.n)}</div>
    <div class="val">${nf(r.v, ind.d)}<small>${ind.u === "%" ? "%" : esc(ind.u)}</small></div>
    <div class="del">${fechaInd(ind, r)} · ${esc(ind.nota)}</div>
    <div class="cmb">${r.cambio != null ? `${r.cambio > 0 ? "▲" : r.cambio < 0 ? "▼" : "="} ${nf(Math.abs(r.cambio), ind.d)} vs. ${per} anterior` : ""}</div>
    ${sparkline(r.a.slice(ind.q ? -16 : ind.w ? -104 : -36))}
    <div class="pctl" title="Posición del último dato en la historia desde 2000 (0 = mínimo, 100 = máximo). La franja es el rango normal 2000-19.">${barraPctl(r)}<span>Percentil histórico ${r.pctl}</span></div>`;
  e.appendChild(botonEstrella("ind:" + id, ind.n));
  const abrir = () => abrirGrafico(ind.g);
  e.addEventListener("click", abrir);
  e.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } });
  return e;
}
function tiraTiles(ids) {
  const t = el("div", { class: "tiles" });
  ids.forEach(id => { const x = tile(id); if (x) t.appendChild(x); });
  return t;
}
function grilla(main, lista, grupo) {
  const gr = el("div", { class: "grid" });
  for (const [id, cl] of lista) {
    const t = tarjeta(id, { clase: cl, grupo });
    estadoPrueba.graficos++; if (t._vacio) estadoPrueba.vacios++;
    gr.appendChild(t);
  }
  main.appendChild(gr);
}
function bloque(main, titulo, lista, grupo) {
  main.appendChild(el("h2", { class: "bloque" }, esc(titulo)));
  grilla(main, lista, grupo);
}

// ───────── Avisos ─────────
const graficoDeRelease = nombre => {
  const r = resultadoRelease(nombre)[0]; if (!r) return null;
  return Object.values(CAT).find(c => c.ks[0] === r.k || c.ks.includes(r.k))?.id || null;
};
function lineaResultado(r) {
  return `${esc(r.n)} <b>${esc(r.v)}</b>${r.p ? ` · ant. ${esc(r.p)}${r.pr ? ` <span class="rev" title="Primera publicación: ${esc(r.pr)}">®</span>` : ""}` : ""}`;
}
function avisos() {
  const lista = (ST.DATA.avisos || []).filter(a => Date.now() - P(a.det) < 7 * DIA_MS).slice(-2);
  const demorados = agenda().filter(c => estadoRelease(c).e === "sin" && Date.now() - P(c.fecha) < 5 * DIA_MS);
  if (demorados.length >= 3) lista.push({ texto: `${demorados.length} publicaciones de los últimos días no trajeron datos nuevos: puede tratarse de una demora de las fuentes.` });
  if (!lista.length) return null;
  const box = el("div", { class: "avisos" });
  for (const a of lista) box.appendChild(el("div", { class: "aviso-b", role: "note" }, esc(a.texto)));
  return box;
}

// ───────── Portada ─────────
function agendaResumen() {
  const hoy = hoyUTC(), ag = agenda();
  const prox = ag.filter(c => ["prog", "esp"].includes(estadoRelease(c).e) && P(c.fecha) <= hoy + 14 * DIA_MS)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || infoRelease(b.nombre).imp - infoRelease(a.nombre).imp).slice(0, 7);
  const salio = ag.filter(c => estadoRelease(c).e === "pub" && P(c.fecha) >= hoy - 10 * DIA_MS)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || infoRelease(b.nombre).imp - infoRelease(a.nombre).imp).slice(0, 7);
  const item = (c, pasado) => {
    const t = P(c.fecha), dias = Math.round((t - hoy) / DIA_MS), res = resultadoRelease(c.nombre), info = infoRelease(c.nombre);
    const cuando = dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : dias === -1 ? "Ayer" : dias > 0 ? `en ${dias} días` : `hace ${-dias} días`;
    const hora = info.hora ? nyABA(c.fecha, info.hora) : "";
    const linea = res.length ? res.map(r => pasado ? `${r.n}: ${r.v}${r.p ? ` (ant. ${r.p}${r.pr ? " ®" : ""})` : ""}` : `${r.n}: último ${r.v}`).join(" · ") : "";
    const g = graficoDeRelease(c.nombre);
    return `<li class="${dias === 0 ? "hoy" : ""}"><div class="fch">${fd(t)}<small>${cuando}${hora && !pasado ? " · " + hora + " h" : ""}</small></div>
      <div class="rel"><a href="${g ? construir(CAT[g].frente, CAT[g].slug) : construir("calendario")}"><b>${esc(nombreRelease(c.nombre))}</b>${imp(info.imp)}</a>${linea ? `<span class="det">${esc(linea)}</span>` : ""}</div></li>`;
  };
  const d = el("div", { class: "dupla" });
  d.innerHTML = `<section class="panel"><h2>Próximos datos <a href="${construir("calendario")}">Ver calendario</a></h2>
      ${prox.length ? `<ul class="lista">${prox.map(c => item(c, false)).join("")}</ul>` : `<p class="vacio-txt">Sin publicaciones en las próximas dos semanas.</p>`}</section>
    <section class="panel"><h2>Lo que salió <a href="${construir("calendario")}">Ver calendario</a></h2>
      ${salio.length ? `<ul class="lista">${salio.map(c => item(c, true)).join("")}</ul>` : `<p class="vacio-txt">Sin publicaciones en los últimos 10 días.</p>`}</section>`;
  return d;
}
const imp = n => `<span class="imp" title="Importancia ${n === 3 ? "alta" : n === 2 ? "media" : "baja"}">${[1, 2, 3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
function lectura() {
  const L = lineasLectura();
  const s = el("section", { class: "panel lectura", style: "margin-top:16px" });
  s.innerHTML = `<h2>Lectura del último dato</h2><ul>${Object.entries(FRENTES).filter(([k]) => L[k]).map(([k, n]) => `<li><span>${n}</span><div>${esc(L[k])}</div></li>`).join("")}</ul>
    <p class="nota">Esta lectura y los títulos de cada gráfico se calculan con el último dato cada vez que se abre la página: cambian solos con cada actualización.</p>`;
  return s;
}
export function vistaPortada(main) {
  if (ST.T1 === Infinity) { const a = avisos(); if (a) main.appendChild(a); }
  main.appendChild(tiraTiles(RESUMEN_TILES));
  if (ST.T1 === Infinity) main.appendChild(agendaResumen());
  main.appendChild(lectura());
  bloque(main, "Las preguntas del ciclo", PREGUNTAS_CICLO, "portada");
}

// ───────── Mi monitor ─────────
const SET_PROPUESTO = ["ind:core3", "ind:nominas", "ind:sahm", "ind:tips", "ind:curva", "ind:dolar", "momentum", "nominas", "tasaReal", "pendiente"];
export function vistaMi(main) {
  const est = ST.prefs.estrellas || [];
  const propuesto = !est.length;
  const lista = propuesto ? SET_PROPUESTO : est;
  const inds = lista.filter(x => x.startsWith("ind:")).map(x => x.slice(4)).filter(x => INDX[x]);
  const gs = lista.filter(x => CAT[x]);
  const cab = el("section", { class: "cabecera" });
  cab.innerHTML = `<div><h2>Mi monitor</h2><p>${propuesto ? "Todavía no marcaste nada: este es un set propuesto. Tocá la estrella de cualquier indicador o gráfico para armar el tuyo." : `Tus ${inds.length} indicadores y ${gs.length} gráficos. Se guardan en este navegador; con el enlace los abrís en otro dispositivo.`}</p></div>`;
  const bar = el("div", { class: "filtros", style: "margin:0" });
  const b1 = el("button", { type: "button", class: "btn" }, `${ICONOS.enlace}Enlace de mi monitor`);
  b1.addEventListener("click", async () => { const url = location.origin + location.pathname + construir("mi", null, { set: lista.join(",") }); toast(await copiar(url) ? "Enlace copiado: guardalo como favorito" : "No se pudo copiar"); });
  bar.appendChild(b1);
  if (!propuesto) {
    const b2 = el("button", { type: "button", class: "btn" }, "Ordenar");
    b2.addEventListener("click", () => ordenarMi());
    bar.appendChild(b2);
  }
  cab.appendChild(bar);
  if (inds.length) cab.appendChild(tiraTiles(inds));
  main.appendChild(cab);
  if (gs.length) grilla(main, gs.map(id => [id, ""]), "mi");
  else if (!propuesto) main.appendChild(el("p", { class: "vacio-mi" }, "Todavía no marcaste gráficos. Tocá la estrella al lado del título de cualquier gráfico."));
}
function ordenarMi() {
  const lista = ST.prefs.estrellas.slice();
  const box = el("div");
  const pintar = () => {
    box.innerHTML = "";
    lista.forEach((x, i) => {
      const nombre = x.startsWith("ind:") ? INDX[x.slice(4)]?.n + " (indicador)" : CAT[x]?.nombre;
      const f = el("div", { style: "display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--grid)" }, `<span style="flex:1">${esc(nombre || x)}</span>`);
      const sube = el("button", { type: "button", class: "btn", "aria-label": "Subir", disabled: i === 0 || null }, "↑");
      const baja = el("button", { type: "button", class: "btn", "aria-label": "Bajar", disabled: i === lista.length - 1 || null }, "↓");
      sube.onclick = () => { [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; pintar(); };
      baja.onclick = () => { [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]]; pintar(); };
      f.append(sube, baja); box.appendChild(f);
    });
    const ok = el("button", { type: "button", class: "btn", style: "margin-top:12px" }, "Guardar orden");
    ok.onclick = async () => { ST.prefs.estrellas = lista; (await import("./datos.js")).guardarPrefs(); (await import("./tarjeta.js")).cerrarModal(); window.dispatchEvent(new HashChangeEvent("hashchange")); };
    box.appendChild(ok);
  };
  pintar();
  abrirPanel("Ordenar Mi monitor", "Los indicadores van arriba y los gráficos abajo, cada grupo en este orden.", box);
}

// ───────── Frentes ─────────
export function vistaFrente(main, sec) {
  const L = lineasLectura();
  const cab = el("section", { class: "cabecera" });
  cab.innerHTML = `<div><h2>${FRENTES[sec]}</h2>${L[sec] ? `<p>${esc(L[sec])}</p>` : ""}</div>`;
  cab.appendChild(tiraTiles(CABECERA_TILES[sec] || []));
  main.appendChild(cab);
  for (const [titulo, lista] of BLOQUES[sec]) bloque(main, titulo, lista, sec);
}

// ───────── Tablero ─────────
const TAB = { frente: "todos", orden: null, dir: 1 };
export function vistaTablero(main, rerender) {
  const filtros = el("div", { class: "filtros" });
  filtros.innerHTML = [["todos", "Todos"], ...Object.entries(FRENTES)].map(([k, n]) => `<button type="button" data-f="${k}" aria-pressed="${TAB.frente === k}">${n}</button>`).join("");
  filtros.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { TAB.frente = b.dataset.f; rerender(); }));
  const der = el("div", { class: "der" }, "<span>Clic en un encabezado para ordenar; en una fila, para ver el gráfico.</span>");
  const csv = el("button", { type: "button", class: "btn" }, `${ICONOS.bajar}CSV`);
  der.appendChild(csv); filtros.appendChild(der);
  main.appendChild(filtros);
  const COLS = [["n", "Indicador"], ["v", "Último"], ["t", "Fecha"], ["prev", "Anterior"], ["cambio", "Cambio"], ["tend", "Tendencia"], ["hace12", "Hace 1 año"], ["pctl", "Percentil histórico"], ["spark", "2 años"], ["prox", "Próximo dato"]];
  const filas = IND.filter(i => TAB.frente === "todos" || i.f === TAB.frente).map(ind => ({ ind, r: valorInd(ind) })).filter(x => x.r);
  const val = (x, c) => c === "n" ? x.ind.n : c === "prox" ? ((proximoRelease(x.ind.ks) || {}).fecha || Infinity) : x.r[c];
  const box = el("div", { class: "tablero" }), tabla = el("table");
  tabla.innerHTML = `<thead><tr>${COLS.map(([c, n]) => `<th scope="col" data-c="${c}" ${TAB.orden === c ? `aria-sort="${TAB.dir > 0 ? "ascending" : "descending"}"` : ""}>${n}</th>`).join("")}</tr></thead><tbody></tbody>`;
  const cuerpo = tabla.querySelector("tbody");
  const fila = ({ ind, r }) => {
    const pr = proximoRelease(ind.ks);
    const tr = el("tr", { class: "fila", tabindex: "0" });
    const cel = v => v == null ? "–" : nf(v, ind.d) + (ind.u === "%" ? "%" : "");
    tr.innerHTML = `<td class="nom"><b>${esc(ind.n)}</b><small>${esc(ind.nota)}</small></td>
      <td class="val">${cel(r.v)}${ind.u && ind.u !== "%" ? ` <small style="font-weight:400;color:var(--muted)">${esc(ind.u)}</small>` : ""}</td>
      <td>${fechaInd(ind, r)}</td><td>${cel(r.prev)}</td>
      <td>${r.cambio == null ? "–" : `${r.cambio > 0 ? "▲" : r.cambio < 0 ? "▼" : "="} ${nf(Math.abs(r.cambio), ind.d)}`}</td>
      <td title="Cambio contra ${ind.q ? "el trimestre anterior" : ind.w ? "4 semanas atrás" : "3 meses atrás"}">${r.tend == null ? "–" : (r.tend > 0 ? "↗ " : r.tend < 0 ? "↘ " : "→ ") + sg(r.tend, ind.d)}</td>
      <td>${cel(r.hace12)}</td>
      <td><span class="barra-p">${barraPctl(r)}${r.pctl}</span></td>
      <td>${sparkline(r.a.slice(ind.q ? -8 : ind.w ? -104 : -24), 92, 26)}</td>
      <td>${pr && pr.diario ? "diario" : pr ? fd(pr.fecha) : "–"}</td>`;
    const abrir = () => abrirGrafico(ind.g);
    tr.addEventListener("click", abrir);
    tr.addEventListener("keydown", e => { if (e.key === "Enter") abrir(); });
    return tr;
  };
  if (TAB.orden) {
    filas.sort((a, b) => { const x = val(a, TAB.orden), y = val(b, TAB.orden); return (typeof x === "string" ? x.localeCompare(y) : (x ?? -Infinity) - (y ?? -Infinity)) * TAB.dir; });
    filas.forEach(f => cuerpo.appendChild(fila(f)));
  } else {
    for (const [k, n] of Object.entries(FRENTES)) {
      const g = filas.filter(f => f.ind.f === k); if (!g.length) continue;
      cuerpo.insertAdjacentHTML("beforeend", `<tr class="grupo"><td colspan="${COLS.length}">${n}</td></tr>`);
      g.forEach(f => cuerpo.appendChild(fila(f)));
    }
  }
  tabla.querySelectorAll("th").forEach(th => th.addEventListener("click", () => {
    const c = th.dataset.c; if (c === "spark") return;
    if (TAB.orden === c) { if (TAB.dir === -1) { TAB.orden = null; TAB.dir = 1; } else TAB.dir = -1; } else { TAB.orden = c; TAB.dir = c === "n" || c === "prox" ? 1 : -1; }
    rerender();
  }));
  csv.addEventListener("click", () => {
    const cab = ["Frente", "Indicador", "Nota", "Unidad", "Último", "Fecha", "Anterior", "Cambio", "Tendencia", "Hace 1 año", "Percentil histórico"];
    const rows = filas.map(({ ind, r }) => [FRENTES[ind.f], ind.n, ind.nota, ind.u, csvNum(r.v), fechaInd(ind, r), csvNum(r.prev), csvNum(r.cambio), csvNum(r.tend), csvNum(r.hace12), r.pctl]);
    descargar(`us-macro-monitor-tablero-${new Date().toISOString().slice(0, 10)}.csv`, [cab, ...rows, [], [`US Macro Monitor (@SantiGonzalezAR), ${fLargo(Date.now())}. Fuentes: BEA, BLS, Census, Fed, Tesoro y U. de Michigan.`]].map(f => f.map(csvCelda).join(";")).join("\n"));
  });
  box.appendChild(tabla); main.appendChild(box);
  main.appendChild(el("p", { class: "nota" }, "Tendencia: cambio contra 3 meses atrás (un trimestre en series trimestrales, 4 semanas en semanales). Percentil histórico: posición del último dato en la historia desde 2000; la franja es el rango normal 2000-19. Las tasas muestran el último cierre diario."));
}

// ───────── Calendario ─────────
let CAL = { offset: 0, soloAlta: false };
export const moverSemana = n => { CAL.offset = Math.max(-8, Math.min(12, CAL.offset + n)); };
export function vistaCalendario(main, rerender) {
  const hoy = hoyUTC();
  const lunes = hoy - ((new Date(hoy).getUTCDay() + 6) % 7) * DIA_MS + CAL.offset * 7 * DIA_MS;
  const ag = agenda().filter(c => !CAL.soloAlta || infoRelease(c.nombre).imp === 3);
  const ultimoPub = new Map();
  for (const c of agenda()) if (P(c.fecha) <= hoy && (!ultimoPub.has(c.rid) || c.fecha > ultimoPub.get(c.rid))) ultimoPub.set(c.rid, c.fecha);
  const nav = el("div", { class: "cal-nav" });
  nav.innerHTML = `<h2>Semana del ${fd(lunes)} al ${fd(lunes + 4 * DIA_MS)}</h2>
    <div class="seg" role="group" aria-label="Importancia"><button type="button" data-imp="0" aria-pressed="${!CAL.soloAlta}">Todos</button><button type="button" data-imp="1" aria-pressed="${CAL.soloAlta}">Sólo alta</button></div>
    <div class="seg" role="group" aria-label="Semana"><button type="button" data-o="-1" aria-pressed="false">‹ Anterior</button><button type="button" data-o="0" aria-pressed="${CAL.offset === 0}">Esta semana</button><button type="button" data-o="1" aria-pressed="false">Siguiente ›</button></div>`;
  nav.querySelectorAll("[data-o]").forEach(b => b.addEventListener("click", () => { const o = Number(b.dataset.o); CAL.offset = o === 0 ? 0 : Math.max(-8, Math.min(12, CAL.offset + o)); rerender(); }));
  nav.querySelectorAll("[data-imp]").forEach(b => b.addEventListener("click", () => { CAL.soloAlta = b.dataset.imp === "1"; rerender(); }));
  main.appendChild(nav);
  const grid = el("div", { class: "semana-grid" });
  for (let i = 0; i < 5; i++) {
    const dia = lunes + i * DIA_MS, f = new Date(dia).toISOString().slice(0, 10);
    const lista = ag.filter(c => c.fecha === f).sort((a, b) => {
      const ha = infoRelease(a.nombre).hora || "99:99", hb = infoRelease(b.nombre).hora || "99:99";
      return ha.padStart(5, "0").localeCompare(hb.padStart(5, "0")) || infoRelease(b.nombre).imp - infoRelease(a.nombre).imp;
    });
    const col = el("section", { class: "dia" + (dia === hoy ? " hoy" : "") });
    const d = new Date(dia);
    col.innerHTML = `<header><b>${DIA_LARGO[d.getUTCDay()]} ${d.getUTCDate()}</b>${dia === hoy ? '<span class="etiq-hoy">Hoy</span>' : `<span>${MES[d.getUTCMonth()]}</span>`}</header><div class="eventos"></div>`;
    const cont = col.querySelector(".eventos");
    if (!lista.length) cont.innerHTML = `<div class="nada">Sin publicaciones${CAL.soloAlta ? " de importancia alta" : ""}</div>`;
    for (const c of lista) {
      const info = infoRelease(c.nombre), est = estadoRelease(c), esUlt = ultimoPub.get(c.rid) === c.fecha, res = resultadoRelease(c.nombre);
      const g = graficoDeRelease(c.nombre);
      const card = el(g ? "a" : "div", { class: "evento" + (info.imp === 3 ? " alta" : ""), href: g ? construir(CAT[g].frente, CAT[g].slug) : null });
      let cuerpo = "";
      if (res.length && est.e === "pub" && esUlt) cuerpo = res.map(r => `<span>${lineaResultado(r)}</span>`).join("");
      else if (res.length && est.e !== "pub") cuerpo = res.map(r => `<span>${esc(r.n)}: <small>último</small> <b>${esc(r.v)}</b></span>`).join("");
      const hora = info.hora ? `${nyABA(c.fecha, info.hora)} h (${info.hora} NY)` : "";
      const etiq = est.e === "pub" && est.det ? `Publicado · ${horaBA(est.det).txt}` : est.txt;
      card.innerHTML = `<div class="hora"><span>${hora}${info.org ? (hora ? " · " : "") + esc(info.org) : ""}</span><span class="estado-r ${est.e}" title="${esc(est.nota || "")}"><i></i>${esc(etiq)}</span></div>
        <b>${esc(nombreRelease(c.nombre))}${imp(info.imp)}</b>${cuerpo ? `<div class="res">${cuerpo}</div>` : ""}`;
      cont.appendChild(card);
    }
    grid.appendChild(col);
  }
  main.appendChild(grid);
  main.appendChild(el("div", { class: "leyenda-estados" }, `<span class="estado-r prog"><i></i>Programado</span><span class="estado-r esp"><i></i>Esperando: ya salió, entra en la próxima actualización</span><span class="estado-r pub"><i></i>Publicado: el dato ya está en el monitor</span><span class="estado-r sin"><i></i>Sin dato nuevo</span><span>${imp(3)} importancia alta · ${imp(2)} media · ® anterior revisado</span>`));
  main.appendChild(el("p", { class: "cal-pie" }, "Fechas del calendario oficial que publica FRED; se actualiza solo. Hora de Buenos Aires con la de Nueva York entre paréntesis; la diferencia cambia sola con el horario de verano de EE.UU. Tasas, dólar y GDPNow se actualizan varias veces por semana y no figuran acá. Clic en una publicación para ver su gráfico."));
}

// ───────── Explorador ─────────
const TRANSF = [["nivel", "Nivel"], ["yoy", "Variación interanual"], ["ann3", "Anualizada a 3 meses"], ["pct", "Variación contra el período anterior"], ["dif", "Diferencia contra el período anterior"], ["idx", "Índice (inicio = 100)"], ["rcpi", "Real, deflactado por CPI"], ["rpce", "Real, deflactado por el deflactor del PCE"]];
let EXPLORA = [], OPERA = { op: "", a: 0, b: 1 };
function grupoSerie(k) {
  if (k.startsWith("cat:")) return "Precios: rubros del core";
  const g = [["actividad", /^(gdp|gdi|c_|profits|inv_|indpro|retail|core_orders|housing|permits|final_sales)/], ["consumidor", /^(dpi|pce_real|saving|pce_dur|pce_ndur|pce_serv$|comp|transfers|sentiment)/],
    ["precios", /^(pce_|cpi|ppi|infl_)/], ["empleo", /^(payrolls|unemploy|ahe|epop|participation|openings|quits|claims|cont_|sahm)/], ["tasas", /^(fed_|ust|tips|breakeven|term_|spread|mortgage)/], ["externo", /^(dollar|trade|imp_|deficit|interest|debt)/]];
  const m = g.find(([, re]) => re.test(k)); return m ? FRENTES[m[0]] : "Otras";
}
function aplicarTransf(k, tr) {
  let s = S(k); if (!s) return null;
  const f = ST.DATA.series[k].f;
  if (f === "W" && ["rcpi", "rpce", "yoy", "ann3"].includes(tr)) s = aMensual(s);
  const q = f === "Q";
  if (tr === "yoy") return yoy(s, q ? 4 : 12);
  if (tr === "ann3") return q ? ann(s, 1, 4) : ann(s, 3);
  if (tr === "pct") return pct(s);
  if (tr === "dif") return diff(s);
  if (tr === "idx") { const c = cut(s); return c && c.length ? indice(c, c[0][0]) : null; }
  if (tr === "rcpi") return deflactar(q ? s : s, S("cpi"));
  if (tr === "rpce") return deflactar(s, S("pce_p"));
  return s;
}
export function leerExplora(sub, q) {
  const txt = q.s || (sub && sub.includes(":") ? sub : "");
  if (!txt) return;
  const e = txt.split(",").map(x => { const i = x.lastIndexOf(":"); return { k: x.slice(0, i), t: x.slice(i + 1) }; })
    .filter(({ k, t }) => ST.DATA.series[k] && TRANSF.some(([id]) => id === t)).slice(0, 4);
  if (e.length) EXPLORA = e;
  if (q.op && ["dif", "coc"].includes(q.op)) { const [a, b] = (q.ab || "0,1").split(",").map(Number); OPERA = { op: q.op, a, b }; }
}
const guardarExplora = () => navegar("explorador", null, { s: EXPLORA.map(e => `${e.k}:${e.t}`).join(","), op: OPERA.op || null, ab: OPERA.op ? `${OPERA.a},${OPERA.b}` : null }, true);
export function vistaExplorador(main, rerender) {
  if (!EXPLORA.length) EXPLORA = [{ k: "pce_core", t: "yoy" }, { k: "cpi_core", t: "yoy" }];
  const col = paleta();
  const claves = Object.keys(ST.DATA.series).sort((a, b) => grupoSerie(a).localeCompare(grupoSerie(b)) || ST.DATA.series[a].n.localeCompare(ST.DATA.series[b].n));
  const grupos = [...new Set(claves.map(grupoSerie))];
  const opcionesSerie = sel => grupos.map(g => `<optgroup label="${esc(g)}">${claves.filter(k => grupoSerie(k) === g).map(k => `<option value="${esc(k)}" ${k === sel ? "selected" : ""}>${esc(ST.DATA.series[k].n)}</option>`).join("")}</optgroup>`).join("");
  const selector = el("section", { class: "selector" });
  selector.innerHTML = `<div><h2 style="margin:0;font-size:18px">Explorador de series</h2><p class="nota" style="margin-top:2px">Elegí hasta 4 de las ${claves.length} series del monitor y cómo mostrarlas. El período es el de la cabecera; la dirección de la página guarda la combinación para compartirla.</p></div>
    <div class="filas">${EXPLORA.map((e, i) => `<div class="fila"><i style="background:${col[i]}"></i>
      <select data-i="${i}" data-campo="k" aria-label="Serie ${i + 1}">${opcionesSerie(e.k)}</select>
      <select data-i="${i}" data-campo="t" aria-label="Transformación ${i + 1}">${TRANSF.map(([id, n]) => `<option value="${id}" ${id === e.t ? "selected" : ""}>${n}</option>`).join("")}</select>
      <button type="button" class="btn quitar" data-i="${i}" ${EXPLORA.length === 1 ? "disabled" : ""}>Quitar</button></div>`).join("")}</div>
    <div class="botones">${EXPLORA.length < 4 ? '<button type="button" class="btn agregar">Agregar serie</button>' : ""}<button type="button" class="btn copiar">${ICONOS.enlace}Copiar enlace</button></div>
    ${EXPLORA.length >= 2 ? `<div class="op"><span>Operación entre dos series:</span>
      <select data-op="op"><option value="">Ninguna</option><option value="dif" ${OPERA.op === "dif" ? "selected" : ""}>Diferencia (A − B)</option><option value="coc" ${OPERA.op === "coc" ? "selected" : ""}>Cociente (A ÷ B)</option></select>
      <span>A:</span><select data-op="a">${EXPLORA.map((e, i) => `<option value="${i}" ${OPERA.a === i ? "selected" : ""}>Serie ${i + 1}</option>`).join("")}</select>
      <span>B:</span><select data-op="b">${EXPLORA.map((e, i) => `<option value="${i}" ${OPERA.b === i ? "selected" : ""}>Serie ${i + 1}</option>`).join("")}</select></div>` : ""}`;
  selector.querySelectorAll("select[data-campo]").forEach(s => s.addEventListener("change", () => { EXPLORA[Number(s.dataset.i)][s.dataset.campo] = s.value; guardarExplora(); rerender(); }));
  selector.querySelectorAll("select[data-op]").forEach(s => s.addEventListener("change", () => { const c = s.dataset.op; OPERA[c] = c === "op" ? s.value : Number(s.value); guardarExplora(); rerender(); }));
  selector.querySelectorAll(".quitar").forEach(b => b.addEventListener("click", () => { EXPLORA.splice(Number(b.dataset.i), 1); OPERA = { op: "", a: 0, b: 1 }; guardarExplora(); rerender(); }));
  const ag = selector.querySelector(".agregar"); if (ag) ag.addEventListener("click", () => { EXPLORA.push({ k: "ust10", t: "nivel" }); guardarExplora(); rerender(); });
  selector.querySelector(".copiar").addEventListener("click", async () => toast(await copiar(location.href) ? "Enlace copiado" : "No se pudo copiar: usá la barra de direcciones"));
  const box = el("div", { class: "explorador" });
  box.appendChild(selector);
  const unidadDe = e => e.t === "idx" ? "índice" : ["yoy", "ann3", "pct"].includes(e.t) ? "%" : ST.DATA.series[e.k].u;
  const spFijo = () => {
    const series = EXPLORA.map((e, i) => {
      const d = aplicarTransf(e.k, e.t); if (!d) return null;
      const tn = TRANSF.find(([id]) => id === e.t)[1].toLowerCase();
      return { n: `${ST.DATA.series[e.k].n}${e.t === "nivel" ? "" : ", " + tn}`, d: cut(d), c: i, k: e.k, t: e.t, raw: d };
    });
    const ok = series.filter(s => s && s.d.length);
    if (!ok.length) return null;
    const fs = ok.map(s => ST.DATA.series[s.k].f);
    let lista = ok.map(({ raw, ...s }) => s);
    if (OPERA.op && series[OPERA.a] && series[OPERA.b] && OPERA.a !== OPERA.b) {
      const A = series[OPERA.a], B = series[OPERA.b];
      const a = ST.DATA.series[A.k].f === "W" ? aMensual(A.raw) : A.raw, b = ST.DATA.series[B.k].f === "W" ? aMensual(B.raw) : B.raw;
      const r = join(a, b, OPERA.op === "dif" ? (x, y) => x - y : (x, y) => x / y);
      if (r) lista = [{ n: `${A.n} ${OPERA.op === "dif" ? "−" : "÷"} ${B.n}`, d: cut(r), c: "ink", w: 2.6 }, ...lista.map(s => Object.assign(s, { w: 1.4 }))];
    }
    const unidades = [...new Set(EXPLORA.map(unidadDe))];
    return { id: "explorador", o: {}, titulo: lista.map(s => s.n).join(" vs "), freq: fs.every(f => f === "W") ? "W" : fs.every(f => f === "Q") ? "Q" : "M",
      sub: unidades.length > 1 ? `Atención: las series tienen unidades distintas (${unidades.join(", ")}) y comparten el mismo eje.` : `Unidad: ${unidades[0] || "–"}.`,
      ks: ok.map(s => s.k), fuente: fuente(...ok.map(s => s.k)), unidad: unidades.length === 1 && unidades[0] === "%" && !OPERA.op ? "%" : "", dec: 2, series: lista };
  };
  const g = el("div", { class: "grid" });
  const t = tarjeta("explorador", { clase: "ancha alta", spFijo });
  estadoPrueba.graficos++; if (t._vacio) estadoPrueba.vacios++;
  g.appendChild(t); box.appendChild(g); main.appendChild(box);
}

// ───────── Metodología ─────────
const CHANGELOG = [
  ["4.0", "2026-09-30", ["Plataforma: buscador (Ctrl+K), atajos, Mi monitor, enlaces directos por gráfico, tema y tamaño de letra.",
    "Cada gráfico con pestañas Gráfico, Tabla y Fuentes, línea de datos, descargas (PNG para X e informe, CSV y cita) y cursor sincronizado.",
    "Selectores de vista (interanual, mensual, 3 meses) en 11 gráficos y de nominal o real en 5.",
    "Calendario con estados reales (programado, esperando, publicado, sin dato nuevo), tres niveles de importancia, revisiones y hora de Buenos Aires.",
    "Motor de datos con respaldo por serie, validación, registro de corridas y aviso por mail ante problemas.",
    "Correcciones: base fija dic-2019 en índices de ingreso y consumo, pedidos de desempleo semanales, industria y ventas separadas, deuda en manos del público, resultado primario, spread hipotecario, participación y permisos de construcción."]],
  ["3.0", "2026-09-30", ["Leyendas con valores fuera del gráfico, cabeceras por sección, tablero de indicadores, calendario semanal, vigía de datos y explorador."]],
  ["2.0", "2026-09-29", ["Período global, rango normal, recorte de la pandemia, ventana ampliada y PNG firmado."]],
];
const GLOSARIO = [
  ["Core", "Inflación sin alimentos ni energía, que son los componentes más volátiles."],
  ["PCE", "Índice de precios del gasto de consumo personal (BEA). Es la medida de inflación a la que apunta la Fed; pondera menos la vivienda que el CPI."],
  ["CPI", "Índice de precios al consumidor (BLS). Sale antes que el PCE y es el dato que más mueve al mercado."],
  ["Supercore", "Inflación de servicios sin energía ni vivienda: la parte más ligada a salarios."],
  ["Interanual", "Variación contra el mismo período del año anterior."],
  ["3 meses anualizado", "Variación de los últimos 3 meses llevada a tasa anual. Anticipa giros que el interanual tarda en mostrar."],
  ["Real", "Monto sin el efecto de los precios: se divide por un índice de precios y se expresa en dólares del último período."],
  ["Rango normal", "Franja entre los percentiles 10 y 90 del período 2000-2019: lo habitual antes de la pandemia."],
  ["Percentil histórico", "Posición del último dato dentro de su historia desde 2000: 0 es el mínimo y 100 el máximo."],
  ["Regla de Sahm", "Promedio de 3 meses del desempleo menos su mínimo de los 12 meses previos. Superar 0,5 pp coincidió con el inicio de cada recesión desde 1970."],
  ["JOLTS", "Encuesta de vacantes y rotación laboral del BLS: vacantes, contrataciones, renuncias y despidos."],
  ["GDI", "Producto medido por el lado del ingreso. En teoría igual al PBI; en la práctica difiere por errores de medición."],
  ["GDPNow", "Estimación del PBI del trimestre en curso que la Fed de Atlanta actualiza con cada dato nuevo."],
  ["TIPS", "Bonos del Tesoro indexados por inflación. Su rendimiento es la tasa real de mercado."],
  ["Breakeven", "Diferencia entre el bono nominal y el TIPS del mismo plazo: la inflación que descuenta el mercado."],
  ["Prima por plazo", "Compensación extra por prestar a largo plazo en vez de renovar a corto. Estimada con el modelo Kim-Wright de la Fed."],
  ["Resultado primario", "Resultado fiscal sin contar los intereses de la deuda."],
  ["Recesión (NBER)", "Período entre un pico y un piso de la actividad, según el comité de fechado del NBER."],
];
export function vistaMetodologia(main, sub) {
  const partes = [["leer", "Cómo leer el monitor"], ["graficos", "Fichas de los gráficos"], ["series", "Series y estado"], ["actualizaciones", "Actualizaciones"], ["glosario", "Glosario"], ["cambios", "Registro de cambios"]];
  const actual = partes.some(p => p[0] === sub) ? sub : "leer";
  const cont = el("div", { class: "metodo" });
  const nav = el("nav", { "aria-label": "Metodología" }, partes.map(([id, n]) => `<a href="${construir("metodologia", id)}" ${id === actual ? 'aria-current="true"' : ""}>${n}</a>`).join(""));
  const doc = el("article", { class: "doc" });
  cont.append(nav, doc);
  main.appendChild(cont);
  if (actual === "leer") {
    doc.innerHTML = `<h2>Cómo leer el monitor</h2>
      <p>El US Macro Monitor reúne ${Object.keys(ST.DATA.series).length} series oficiales de BEA, BLS, Census, la Fed, el Tesoro y la Universidad de Michigan. Se actualiza solo tres veces por día hábil; ningún dato se carga a mano.</p>
      <h3>Títulos</h3><p>Cada título se calcula con el último dato cada vez que se abre la página. No hay textos escritos a mano que puedan quedar viejos: si el dato cambia, el título cambia.</p>
      <h3>Período</h3><p>El selector de la cabecera aplica a todos los gráficos. "Elegir fechas" permite ver el monitor como estaba en un momento pasado: todo se calcula con los datos hasta esa fecha.</p>
      <h3>Vista y precios</h3><p>Los gráficos que lo admiten muestran la variación interanual, la mensual (barras, como se publica el dato) o la de 3 meses anualizada, y los montos en dólares corrientes o reales. Cada gráfico declara qué deflactor usa y por qué.</p>
      <h3>Rango normal y percentil</h3><p>La franja celeste marca lo habitual entre 2000 y 2019 (percentiles 10 a 90). El percentil histórico ubica el último dato en su historia desde 2000.</p>
      <h3>Recesiones</h3><p>En períodos de 10 años o más, las franjas grises marcan las recesiones oficiales del NBER. Se pueden apagar en Ajustes.</p>
      <h3>Estados del calendario</h3><p><b>Programado</b>: todavía no salió. <b>Esperando</b>: ya salió y entra en la próxima actualización. <b>Publicado</b>: el dato ya está en el monitor. <b>Sin dato nuevo</b>: la fuente no publicó cambios en las series que sigue el monitor. El símbolo ® indica que el dato anterior fue revisado; al pasar el mouse se ve su primera publicación.</p>
      <h3>Atajos</h3><p>Ctrl+K o / abren el buscador; la tecla ? muestra todos los atajos.</p>`;
  } else if (actual === "graficos") {
    doc.innerHTML = `<h2>Fichas de los gráficos</h2><p>${Object.keys(CAT).length} gráficos, cada uno con su fórmula y sus series. La misma ficha aparece en la pestaña Fuentes de cada gráfico.</p>`;
    for (const [f, n] of Object.entries(FRENTES)) {
      doc.insertAdjacentHTML("beforeend", `<h3>${n}</h3>`);
      for (const c of Object.values(CAT).filter(c => c.frente === f)) {
        const ops = (c.ops || []).map(o => o.id === "vista" ? "vista" : o.id === "real" ? "nominal o real" : "escala").join(", ");
        doc.insertAdjacentHTML("beforeend", `<div class="ficha-g"><b><a href="${construir(f, c.slug)}">${esc(c.nombre)}</a></b><p>${esc(c.calc || "")}</p><p style="color:var(--muted)">Series: ${c.ks.filter(k => ST.DATA.series[k]).map(k => esc(meta(k).id)).join(", ")}${ops ? ` · Selectores: ${ops}` : ""}</p></div>`);
      }
    }
  } else if (actual === "series") {
    const v = vigia();
    const orden = v.items.slice().sort((a, b) => (a.estado === "ok") - (b.estado === "ok") || a.n.localeCompare(b.n));
    doc.innerHTML = `<h2>Series y estado</h2><p>${v.items.length} series. Una serie figura para revisar si la fuente no respondió, si su dato no pasó la validación (se muestra la versión anterior) o si no suma datos nuevos en más tiempo del que dura su ciclo normal de publicación.</p>
      <div class="tabla-wrap"><table class="datos"><thead><tr><th>Serie</th><th>Código</th><th>Fuente</th><th>Frecuencia</th><th>Último dato</th><th>Estado</th></tr></thead><tbody>${orden.map(i => {
        const m = meta(i.k), url = enlaceSerie(i.k);
        return `<tr><td>${esc(i.n)}</td><td>${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(m.id)}</a>` : esc(m.id)}</td><td>${esc(i.org || "")}</td><td>${FREC_TXT[i.f] || i.f}</td><td>${fPor(i.f)(i.ult)}</td><td><span class="punto ${i.estado === "ok" ? "" : "alerta"}"></span>${i.estado === "ok" ? "Al día" : esc(i.motivo)}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  } else if (actual === "actualizaciones") {
    const cs = (ST.DATA.corridas || []).slice().reverse();
    doc.innerHTML = `<h2>Actualizaciones</h2><p>El monitor se actualiza de lunes a viernes a las 10:10, 12:10 y 18:10 de Buenos Aires (13:10, 15:10 y 21:10 UTC). Cada corrida baja todas las fuentes, valida cada serie contra su versión anterior y, si algo falla, conserva la última versión buena. Se registran las corridas que cambiaron algún dato.</p>
      ${cs.length ? `<div class="tabla-wrap"><table class="datos"><thead><tr><th>Corrida</th><th>Datos nuevos</th><th>Revisados</th><th>Problemas</th></tr></thead><tbody>${cs.map(c => {
        const h = horaBA(c.ts), prob = Object.keys({ ...c.fallas, ...c.respaldo });
        return `<tr><td>${fd(h.dia)} ${h.txt}</td><td style="white-space:normal">${c.nuevos.map(k => esc(meta(k)?.n || k)).join(", ") || "–"}</td><td style="white-space:normal">${c.revisados.filter(k => !k.startsWith("cat:")).map(k => esc(meta(k)?.n || k)).join(", ") || "–"}</td><td style="white-space:normal">${prob.length ? `<span class="punto alerta"></span>${prob.map(esc).join(", ")}` : "Ninguno"}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<p class="nota">El registro empieza con la primera actualización de la versión 4.</p>`}
      <h3>Avisos recientes</h3>${(ST.DATA.avisos || []).length ? `<ul>${ST.DATA.avisos.slice().reverse().map(a => `<li>${fd(horaBA(a.det).dia)}: ${esc(a.texto)}</li>`).join("")}</ul>` : "<p>Sin avisos en los últimos 7 días.</p>"}`;
  } else if (actual === "glosario") {
    doc.innerHTML = `<h2>Glosario</h2><dl>${GLOSARIO.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join("")}</dl>`;
  } else {
    doc.innerHTML = `<h2>Registro de cambios</h2>${CHANGELOG.map(([v, f, items]) => `<h3>Versión ${v} · ${fLargo(P(f))}</h3><ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("")}`;
  }
}
