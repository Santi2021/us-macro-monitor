// Opciones de ECharts, leyenda HTML con valores y cursor sincronizado entre gráficos.
import { css, nf, sg, esc, unidadTxt, P, T, MES, DIA_MS, fPor, fq, el } from "./util.js";
import { ST, periodoLargo, iniciosFed } from "./datos.js";
import { valorEn } from "./calc.js";

// Eventos de referencia: Lehman, COVID y el inicio de cada ciclo de la Fed (se detectan solos en la tasa objetivo)
export function eventos() {
  const ev = [[P("2008-09-15"), "Lehman"], [P("2020-03-01"), "COVID"]];
  for (const t of iniciosFed(1)) ev.push([t, "Suba Fed"]);
  for (const t of iniciosFed(-1)) ev.push([t, "Baja Fed"]);
  if (ev.length === 2) ev.push([P("2022-03-16"), "Suba Fed"], [P("2024-09-18"), "Baja Fed"]);   // sin datos diarios
  return ev.sort((a, b) => a[0] - b[0]);
}
// Recesiones del NBER (mes del pico, mes del piso). Se actualiza cuando el NBER declara una nueva; el motor avisa.
export const RECESIONES = [["1948-11", "1949-10"], ["1953-07", "1954-05"], ["1957-08", "1958-04"], ["1960-04", "1961-02"],
  ["1969-12", "1970-11"], ["1973-11", "1975-03"], ["1980-01", "1980-07"], ["1981-07", "1982-11"], ["1990-07", "1991-03"],
  ["2001-03", "2001-11"], ["2007-12", "2009-06"], ["2020-02", "2020-04"]].map(([a, b]) => [P(a + "-01"), P(b + "-01")]);
const COVID = [Date.UTC(2020, 2, 1), Date.UTC(2022, 5, 1)];
const COVID_SHOCK = [Date.UTC(2020, 2, 1), Date.UTC(2021, 5, 1)];

export const paleta = () => [css("--s1"), css("--s2"), css("--s3"), css("--s4")];
export const colorSerie = (sp, s, i) => s.c === "gris" ? css("--muted") : s.c === "ink" ? css("--ink") : s.c != null ? paleta()[s.c] : (sp.tipo === "cat" && s.t === "line" ? css("--ink") : paleta()[i % 4]);
const FS = () => ST.prefs.letra === "grande" ? 1.14 : 1;
function redondo(v, paso, arriba) { return (arriba ? Math.ceil(v / paso) : Math.floor(v / paso)) * paso; }
function pasoLindo(r) { const e = Math.pow(10, Math.floor(Math.log10(r))); const f = r / e; return (f <= 2 ? 0.25 : f <= 5 ? 0.5 : 1) * e; }

// Recorta el eje cuando el shock de 2020-21 (u otro declarado por el gráfico) aplastaría la escala
export function recorteShock(sp) {
  if (sp.tipo || sp.yMin != null || sp.yMax != null || sp.sinRecorte || sp._rc || sp.series.some(s => s.der)) return;
  sp._rc = true;
  const [c0, c1] = sp.shock || COVID, [s0, s1] = sp.shock || COVID_SHOCK;
  const pts = sp.series.filter(s => !s.oculta).flatMap(s => s.d);
  if (!pts.some(p => p[0] >= s0 && p[0] <= s1)) return;
  const fuera = pts.filter(p => p[0] < c0 || p[0] > c1).map(p => p[1]);
  if (fuera.length < 6) return;
  const todos = pts.map(p => p[1]);
  const lo = Math.min(...fuera), hi = Math.max(...fuera), r = hi - lo || 1;
  const mn = Math.min(...todos), mx = Math.max(...todos);
  if (mx - hi > 0.4 * r || lo - mn > 0.4 * r) {
    const paso = pasoLindo(r * 1.25);
    if (mn < lo - 0.4 * r) sp.yMin = redondo(lo - 0.08 * r, paso, false);
    if (mx > hi + 0.4 * r) sp.yMax = redondo(hi + 0.08 * r, paso, true);
    sp.sub += sp.shock ? " Eje recortado para que el efecto de la pandemia no aplaste la escala." : " Eje recortado en la pandemia para no aplastar la escala.";
  }
}
// Versión del gráfico con sólo las series que el usuario deja visibles en la leyenda: el eje se recalcula para ellas
// (las referencias y bandas lejanas se dejan de lado) y es la que se descarga como imagen o CSV.
export function spVisible(sp) {
  const ocultas = sp._ocultas;
  if (!ocultas || !ocultas.size) return sp;
  const series = sp.series.map((s, i) => Object.assign({}, s, { c: s.c ?? (sp.tipo === "cat" && s.t === "line" ? "ink" : i % 4) })).filter(s => !ocultas.has(s.n));
  if (!series.length) return sp;
  if (series.every(s => s.der)) series.forEach(s => { s.der = false; });
  const out = Object.assign({}, sp, { series, yMin: null, yMax: null, _ocultas: null });
  if (!sp.tipo) {
    const vals = series.filter(s => !s.der).flatMap(s => s.d.map(p => p[1])).filter(v => v != null);
    if (vals.length) {
      const mn = Math.min(...vals), mx = Math.max(...vals), r = (mx - mn) || Math.abs(mx) || 1;
      const dentro = y => y >= mn - 0.25 * r && y <= mx + 0.25 * r;
      out.refs = (sp.refs || []).filter(x => dentro(x.y));
      if (sp.banda && !(sp.banda[1] >= mn - 0.25 * r && sp.banda[0] <= mx + 0.25 * r)) out.banda = null;
      if (sp.cero && mn > 0.25 * r) out.cero = false;
    }
  }
  return out;
}
const tooltipBase = () => ({ confine: true, backgroundColor: css("--surface"), borderColor: css("--line"), textStyle: { color: css("--ink"), fontSize: 13 * FS(), fontFamily: css("--font") } });

function opcionesLinea(sp, ancho, grande) {
  const col = paleta(), muted = css("--muted"), grid = css("--grid"), axis = css("--axis"), ref = css("--ref");
  const u = sp.unidad ?? "%", dec = sp.dec ?? 1, fs = (grande ? 14 : 12.5) * FS();
  const fx = fPor(sp.freq);
  const vis = sp.series.filter(s => s.d.length);
  const x0 = Math.min(...vis.map(s => s.d[0][0])), x1 = Math.max(...vis.map(s => s.d[s.d.length - 1][0]));
  // eje derecho sólo si conviven series de las dos escalas
  const conDer = vis.some(s => s.der) && vis.some(s => !s.der);
  const series = [];
  sp.series.forEach((s, i) => {
    const c = colorSerie(sp, s, i);
    const base = { name: s.n, data: s.d, z: 3, itemStyle: { color: c }, yAxisIndex: conDer && s.der ? 1 : 0 };
    if (s.t === "bar") { series.push(Object.assign(base, { type: "bar", stack: s.stack, barMaxWidth: 22, itemStyle: { color: c, borderRadius: [2, 2, 0, 0] } })); return; }
    // proyecciones: rombos sin línea
    if (s.t === "punto") { series.push(Object.assign(base, { type: "scatter", symbol: "diamond", symbolSize: grande ? 15 : 12, z: 7, itemStyle: { color: css("--surface"), borderColor: c, borderWidth: 2.5 } })); return; }
    series.push(Object.assign(base, {
      type: "line", stack: s.stack, showSymbol: false, symbol: "circle", symbolSize: 6,
      lineStyle: { width: s.w ?? (s.fina ? 1.2 : 2.2), color: c, type: s.punteada ? [6, 4] : "solid", opacity: s.fina ? 0.55 : 1 },
      areaStyle: s.area && (!sp.banda || s.stack) ? { color: c, opacity: s.stack ? 0.85 : 0.10 } : undefined,
    }));
    if (s.fin !== false && !s.fina && s.d.length) {
      const [t, v] = s.d[s.d.length - 1];
      series.push({ type: "scatter", name: s.n, data: [[t, s.finValor ?? v]], yAxisIndex: conDer && s.der ? 1 : 0, symbolSize: grande ? 10 : 8, z: 6, silent: true, tooltip: { show: false },
        itemStyle: { color: c, borderColor: css("--surface"), borderWidth: 2 } });
    }
  });
  const aux = { type: "line", name: "__aux", data: [], silent: true, tooltip: { show: false }, markLine: { symbol: "none", silent: true, data: [] }, markArea: { silent: true, data: [] } };
  for (const r of sp.refs || []) aux.markLine.data.push({ yAxis: r.y, label: { show: false }, lineStyle: { color: ref, type: [5, 4], width: 1.2 } });
  if (sp.banda) aux.markArea.data.push([{ yAxis: sp.banda[0], itemStyle: { color: css("--band") }, label: { show: false } }, { yAxis: sp.banda[1] }]);
  const conRec = mostrarRecesiones(sp, x0, x1);
  if (conRec) for (const [a, b] of RECESIONES) if (b >= x0 && a <= x1) aux.markArea.data.push([{ xAxis: Math.max(a, x0), itemStyle: { color: css("--rec") }, label: { show: false } }, { xAxis: Math.min(b, x1) }]);
  let hayEtiquetas = false;
  if (sp.eventos !== false && isFinite(x0) && x1 > x0) {
    const largo = (x1 - x0) > 12 * 365 * DIA_MS, anchoPlot = Math.max(100, ancho - 80);
    let ultimoX = -Infinity;
    for (const [t, l] of eventos()) {
      if (t < x0 || t > x1 || (largo && l.includes("Fed")) || (conRec && (l === "Lehman" || l === "COVID"))) continue;
      const px = (t - x0) / (x1 - x0) * anchoPlot;
      const conTexto = px - ultimoX > 72 && px > 24 && anchoPlot - px > 34;
      if (conTexto) { ultimoX = px; hayEtiquetas = true; }
      aux.markLine.data.push({ xAxis: t, lineStyle: { color: axis, type: "solid", width: 1 }, label: { show: conTexto, formatter: l, position: "end", color: muted, fontSize: fs - 1.5, distance: 4 } });
    }
  }
  series.push(aux);
  const hayBarras = sp.series.some(s => s.t === "bar");
  const decEjeAuto = dec > 0 ? 1 : 0;   // se ajusta al paso real del eje después de dibujar (ajustarEjes)
  const largo = (x1 - x0) > 3.5 * 365 * DIA_MS;
  return {
    useUTC: true, animationDuration: 300,
    textStyle: { fontFamily: css("--font"), color: css("--ink-2") },
    color: col,
    grid: { left: 8, right: 20, top: hayEtiquetas ? 24 : 12, bottom: 6, containLabel: true },
    legend: { show: false, data: sp.series.map(s => s.n) },
    tooltip: Object.assign(tooltipBase(), {
      trigger: "axis",
      axisPointer: { type: hayBarras ? "shadow" : "line", lineStyle: { color: axis }, shadowStyle: { color: css("--hover") } },
      formatter: ps => {
        const vistos = new Set();
        const ps2 = ps.filter(p => p.seriesType !== "scatter" && p.seriesName !== "__aux" && p.value && !vistos.has(p.seriesName) && vistos.add(p.seriesName));
        if (!ps2.length) return "";
        let h = `<div style="font-weight:600;margin-bottom:4px">${fx(ps2[0].value[0])}</div>`;
        for (const p of ps2) {
          const s = sp.series.find(x => x.n === p.seriesName) || {};
          h += `<div style="display:flex;gap:12px;justify-content:space-between;align-items:center"><span>${p.marker}${esc(p.seriesName)}</span><b style="font-variant-numeric:tabular-nums">${nf(p.value[1], s.dec ?? dec)}${unidadTxt(u)}</b></div>`;
        }
        return h;
      },
    }),
    xAxis: {
      type: "time", boundaryGap: hayBarras ? ["1%", "1%"] : false, minInterval: largo ? 365 * DIA_MS : undefined,
      axisLine: { lineStyle: { color: axis } }, axisTick: { show: false },
      axisLabel: { color: muted, fontSize: fs, hideOverlap: true, formatter: v => { const d = new Date(v); return d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : MES[d.getUTCMonth()]; } },
      splitLine: { show: false },
    },
    yAxis: [{
      type: sp.log ? "log" : "value", scale: !sp.cero,
      axisLabel: { color: muted, fontSize: fs, showMinLabel: sp.yMin == null || sp.yMin === 0, showMaxLabel: sp.yMax == null || sp.yMax === 100,
        formatter: v => nf(v, sp.decEje ?? decEjeAuto) + (u === "%" ? "%" : "") },
      splitLine: { lineStyle: { color: grid } },
      min: sp.yMin, max: sp.yMax,
    }].concat(conDer ? [{
      type: "value", scale: true, position: "right", splitLine: { show: false },
      axisLabel: { color: colorSerie(sp, vis.find(s => s.der), sp.series.indexOf(vis.find(s => s.der))), fontSize: fs,
        formatter: v => nf(v, sp.decEje ?? (dec > 0 ? 1 : 0)) + (u === "%" ? "%" : "") },
    }] : []),
    series,
  };
}
// Decimales del eje según el paso que eligió el gráfico: "18%" y no "18,0%" si las marcas son enteras
export function ajustarEjes(chart, sp) {
  if (!chart || sp.tipo || sp.decEje != null) return;
  try {
    const u = sp.unidad ?? "%", ejes = chart.getModel().getComponent("yAxis", 0) ? [0, 1] : [];
    const yAxis = ejes.map(i => {
      const m = chart.getModel().getComponent("yAxis", i); if (!m) return null;
      const paso = m.axis.scale.getInterval ? m.axis.scale.getInterval() : null; if (!paso) return null;
      const d = paso >= 1 - 1e-9 ? 0 : paso >= 0.1 - 1e-9 ? 1 : 2;
      return { axisLabel: { formatter: v => nf(v, d) + (u === "%" ? "%" : "") } };
    }).filter(Boolean);
    if (yAxis.length) chart.setOption({ yAxis }, { lazyUpdate: false });
  } catch (e) {}
}
export const mostrarRecesiones = (sp, x0, x1) => ST.prefs.recesiones !== false && sp.recesiones !== false && !sp.tipo &&
  (x1 - x0) > 9.5 * 365 * DIA_MS && RECESIONES.some(([a, b]) => b >= x0 && a <= x1);

function opcionesHeat(sp, ancho, grande) {
  const ink = css("--ink"), muted = css("--muted");
  const izq = ancho < 600 ? 128 : (sp.izq || 182), fs = (grande ? 13 : 12) * FS();
  return {
    textStyle: { fontFamily: css("--font"), color: css("--ink-2") },
    grid: { left: izq, right: 8, top: 8, bottom: ancho < 900 || sp.cols.length > 20 ? 96 : 72 },
    tooltip: Object.assign(tooltipBase(), { formatter: p => sp.tip ? sp.tip(p.value) : `<b>${esc(sp.filas[p.value[1]])}</b><br>${sp.cols[p.value[0]]}: ${nf(p.value[2], 1)}% anualizado 3m` }),
    xAxis: { type: "category", data: sp.cols, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: muted, fontSize: fs, interval: sp.cols.length > 20 ? (ancho < 900 ? 5 : 2) : 0, rotate: ancho < 900 ? 45 : 0 } },
    yAxis: { type: "category", data: sp.filas, inverse: true, axisTick: { show: false }, axisLine: { show: false },
      axisLabel: { color: css("--ink-2"), fontSize: ancho < 600 ? 11.5 : fs + 0.5, width: izq - 12, overflow: "truncate" } },
    visualMap: { min: sp.vmin ?? -4, max: sp.vmax ?? 8, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 180,
      text: sp.vtxt || ["8%", "−4%"], textStyle: { color: muted, fontSize: 12 }, inRange: { color: [css("--div-lo"), css("--div-mid"), css("--div-hi")] } },
    series: [{ type: "heatmap", data: sp.data, itemStyle: { borderColor: css("--surface"), borderWidth: 2, borderRadius: 3 },
      label: { show: ancho >= 700 && sp.cols.length <= 20, fontSize: fs - 0.5, fontFamily: css("--font"), formatter: p => nf(p.value[2], 1), color: ink },
      emphasis: { itemStyle: { borderColor: ink, borderWidth: 1 } } }],
  };
}

function opcionesCategoria(sp, ancho, grande) {
  const col = paleta(), ink = css("--ink"), muted = css("--muted"), fs = (grande ? 14 : 12.5) * FS();
  const u = sp.unidad ?? "pp", dec = sp.dec ?? 1;
  const series = sp.series.map((s, i) => {
    if (s.t === "line") {
      const vals = s.d.filter(v => v != null), mx = Math.max(...vals), mn = Math.min(...vals);
      let ult = s.d.length - 1; while (ult > 0 && s.d[ult] == null) ult--;
      const c = colorSerie(sp, s, i);
      return { type: "line", name: s.n, data: s.d, z: s.fina ? 3 : 5, symbol: sp.sinPuntos ? "none" : "circle", symbolSize: 7, connectNulls: true,
        endLabel: s.etiquetaFin ? { show: true, formatter: s.etiquetaFin, color: muted, fontSize: fs - 2, distance: 4 } : undefined,
        labelLayout: s.etiquetaFin ? { moveOverlap: "shiftY" } : undefined,
        emphasis: s.fina ? { focus: "series", lineStyle: { width: 2.2, opacity: 1 } } : undefined,
        lineStyle: { color: c, width: s.w ?? (s.fina ? 1.1 : 2), type: s.punteada ? [6, 4] : "solid", opacity: s.fina ? 0.5 : 1 },
        itemStyle: { color: c, borderColor: css("--surface"), borderWidth: 2 },
        label: s.etiquetas ? { show: true, position: "top", color: ink, fontSize: fs - 0.5, fontWeight: 600, distance: 8,
          formatter: p => p.value == null ? "" : (s.etiquetas === "todas" || p.dataIndex === ult || p.value === mx || p.value === mn) ? nf(p.value, dec) : "" } : undefined };
    }
    return { type: "bar", name: s.n, data: s.d, stack: sp.apilado === false ? undefined : "c", barMaxWidth: 34, barCategoryGap: "30%",
      itemStyle: { color: col[s.c ?? i], borderColor: css("--surface"), borderWidth: 1.5 } };
  });
  return {
    textStyle: { fontFamily: css("--font"), color: css("--ink-2") },
    grid: { left: 8, right: sp.series.some(s => s.etiquetaFin) ? 40 : 16, top: 26, bottom: 6, containLabel: true },
    legend: { show: false, data: sp.series.map(s => s.n) },
    tooltip: Object.assign(tooltipBase(), { trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: css("--hover") } },
      formatter: ps => `<div style="font-weight:600;margin-bottom:4px">${ps[0].axisValue}</div>` + ps.filter(p => p.value != null).map(p =>
        `<div style="display:flex;gap:12px;justify-content:space-between"><span>${p.marker}${esc(p.seriesName)}</span><b>${sp.signo === false ? nf(p.value, dec) : sg(p.value, dec)}${p.seriesType === "line" && sp.unidadLinea ? sp.unidadLinea : unidadTxt(u)}</b></div>`).join("") }),
    xAxis: { type: "category", data: sp.cats, axisTick: { show: false }, axisLine: { lineStyle: { color: css("--axis") } }, axisLabel: { color: muted, fontSize: fs, hideOverlap: true } },
    yAxis: { type: "value", scale: !!sp.escala, min: sp.yMin ?? undefined, max: sp.yMax ?? undefined, axisLabel: { color: muted, fontSize: fs, formatter: v => nf(v, sp.decEje ?? 0) + (u === "%" ? "%" : "") }, splitLine: { lineStyle: { color: css("--grid") } } },
    series,
  };
}
export function opciones(sp, ancho, grande) {
  if (sp.tipo === "heat") return opcionesHeat(sp, ancho, grande);
  if (sp.tipo === "cat") return opcionesCategoria(sp, ancho, grande);
  return opcionesLinea(sp, ancho, grande);
}

// Leyenda HTML: cada serie con su valor (el último, o el de la fecha bajo el cursor). Clic muestra u oculta.
export function leyenda(sp, getChart, redibujar) {
  const box = el("div", { class: "leyenda" });
  const api = { box, actualizar: () => {} };
  if (sp.tipo === "heat") return api;
  const u = sp.unidad ?? (sp.tipo === "cat" ? "pp" : "%"), dec = sp.dec ?? 1, conValor = sp.tipo !== "cat";
  const fx = fPor(sp.freq);
  const fecha = conValor ? el("span", { class: "fecha" }) : null;
  if (fecha) box.appendChild(fecha);
  const valores = [];
  sp.series.forEach((s, i) => {
    if (s.enLeyenda === false) return;
    const b = el("button", { type: "button", "aria-pressed": "true", title: "Mostrar u ocultar" });
    const clase = s.t === "bar" ? "barra" : s.t === "punto" ? "punto" : s.area ? "area" : s.punteada ? "punteada" : s.fina ? "fina" : "";
    b.innerHTML = `<i class="sw ${clase}" style="color:${colorSerie(sp, s, i)}"></i><span>${esc(s.n)}${conValor ? " <b></b>" : ""}</span>`;
    b.addEventListener("click", () => {
      const ch = getChart(); if (!ch) return;
      const oculta = b.getAttribute("aria-pressed") === "true";
      if (redibujar) {
        sp._ocultas = sp._ocultas || new Set();
        if (oculta && sp.series.filter(x => !sp._ocultas.has(x.n)).length <= 1) return;   // siempre queda al menos una
        oculta ? sp._ocultas.add(s.n) : sp._ocultas.delete(s.n);
        redibujar();
      } else ch.dispatchAction({ type: "legendToggleSelect", name: s.n });
      b.setAttribute("aria-pressed", oculta ? "false" : "true");
    });
    box.appendChild(b);
    if (conValor) valores.push([b.querySelector("b"), s]);
  });
  for (const r of sp.refs || []) if (r.l) box.insertAdjacentHTML("beforeend", `<span class="fija"><i class="sw ref"></i>${esc(r.l)}</span>`);
  if (sp.banda) box.insertAdjacentHTML("beforeend", `<span class="fija"><i class="sw banda"></i>${esc(sp.bandaTexto || "Rango normal 2000-19")}</span>`);
  const vis = sp.tipo ? [] : sp.series.filter(s => s.d.length && s.t !== "punto");
  if (vis.length && mostrarRecesiones(sp, Math.min(...vis.map(s => s.d[0][0])), Math.max(...vis.map(s => s.d[s.d.length - 1][0]))))
    box.insertAdjacentHTML("beforeend", `<span class="fija"><i class="sw rec"></i>Recesión (NBER)</span>`);
  api.actualizar = t => {
    let fUlt = null;
    for (const [b, s] of valores) {
      const p = t == null ? (s.d.length ? [s.d[s.d.length - 1][0], s.finValor ?? s.d[s.d.length - 1][1]] : null) : valorEn(s.d, t);
      b.textContent = p ? nf(p[1], s.dec ?? dec) + unidadTxt(u) : "–";
      if (p && s.t !== "punto" && (fUlt == null || p[0] > fUlt)) fUlt = p[0];
    }
    if (fecha) fecha.textContent = t == null ? (fUlt ? fx(fUlt) : "") : fx(valorEn(vis[0]?.d, t)?.[0] ?? t);
    box.classList.toggle("cursor", t != null);
  };
  api.actualizar(null);
  return api;
}

// Cursor sincronizado: al mover el mouse en un gráfico, los demás del grupo marcan la misma fecha
const GRUPOS = new Map();
export function unirCursor(grupo, chart, ley, sp) {
  if (sp.tipo) return;
  if (!GRUPOS.has(grupo)) GRUPOS.set(grupo, new Set());
  const miembros = GRUPOS.get(grupo);
  const yo = { chart, ley };
  miembros.add(yo);
  const marcar = (m, t) => {
    if (m.chart.isDisposed()) { miembros.delete(m); return; }
    m.ley.actualizar(t);
    if (m === yo) return;
    let px = null;
    try { px = t == null ? null : m.chart.convertToPixel({ xAxisIndex: 0 }, t); } catch (e) {}
    const alto = m.chart.getHeight();
    m.chart.setOption({ graphic: [{ id: "cursor", type: "line", silent: true, invisible: px == null || !isFinite(px), z: 50,
      shape: { x1: px || 0, y1: 8, x2: px || 0, y2: alto - 28 }, style: { stroke: css("--axis"), lineWidth: 1, lineDash: [3, 3] } }] }, { lazyUpdate: true });
  };
  // Sólo el gráfico que tiene el mouse encima transmite; así redibujar a los demás nunca rebota en un ciclo
  let raf = null, activo = false, ultimo = null;
  const zr = chart.getZr();
  zr.on("mousemove", () => { activo = true; });
  chart.on("updateAxisPointer", e => {
    if (!activo) return;
    const x = (e.axesInfo || []).find(a => a.axisDim === "x");
    if (!x || x.value === ultimo) return;
    ultimo = x.value;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => miembros.forEach(m => marcar(m, x.value)));
  });
  zr.on("globalout", () => {
    if (!activo) return;
    activo = false; ultimo = null;
    cancelAnimationFrame(raf); miembros.forEach(m => marcar(m, null));
  });
}
export const limpiarGrupos = () => GRUPOS.clear();
