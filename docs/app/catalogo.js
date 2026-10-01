// Catálogo: cada gráfico es una definición (series, fórmula, selectores y cómo se arma su título).
// De acá salen el gráfico, su tabla, su ficha de fuentes, el buscador, los enlaces y la metodología.
import { T, P, nf, sg, fm, fq, fw, fd } from "./util.js";
import { last, prev, yoy, ann, pct, diff, roll, join, joinQ, toQ, indice, deflactar, rangoNormal, pctl, escala, racha, valorEn } from "./calc.js";
import { ST, S, SD, freqD, usaDiario, cut, fuente, meta } from "./datos.js";

export const FRENTES = { actividad: "Actividad", consumidor: "Consumidor", precios: "Precios", empleo: "Empleo", tasas: "Tasas", externo: "Externo", fiscal: "Fiscal" };

// ───────── Selectores ─────────
export const VISTA_M = { id: "vista", nombre: "Vista", valores: [["a", "Interanual"], ["m", "Mensual"], ["3", "3m anual."]] };
export const VISTA_Q = { id: "vista", nombre: "Vista", valores: [["a", "Interanual"], ["q", "Trim. anual."]] };
const REAL = (defl, txt) => ({ id: "real", nombre: "Precios", valores: [["n", "Nominal"], ["r", "Real"]], defl, txt });
const ESCALA_PBI = { id: "escala", nombre: "Escala", valores: [["usd", "US$"], ["pbi", "% del PBI"]] };
export const VT = { a: "interanual", m: "mensual", "3": "anualizado a 3 meses", q: "trimestral anualizado" };
const DEFL_TXT = { cpi: "deflactado por CPI", pce_p: "deflactado por el deflactor del PCE", ppi_capital: "deflactado por el PPI de bienes de capital" };

// Transformación según la vista elegida
function vista(a, v, freq = "M") {
  if (!a) return null;
  if (freq === "Q") return v === "q" ? ann(a, 1, 4) : yoy(a, 4);
  return v === "m" ? pct(a) : v === "3" ? ann(a, 3) : yoy(a);
}
const real = (a, o, defl) => o.real === "r" ? deflactar(a, S(defl)) : a;
// Series de un gráfico con vista: en "mensual" se ven barras (hasta dos series) y, con una sola, su promedio de 3 meses
function seriesVista(lista, o) {
  const out = lista.map(([n, a, c, extra]) => Object.assign({ n, d: cut(vista(a, o.vista)), c }, extra || {}));
  if (o.vista === "m") {
    if (out.length <= 2) out.forEach(s => { s.t = "bar"; delete s.area; delete s.w; });
    if (out.length === 1) out.push({ n: "Promedio 3 meses", d: cut(roll(pct(lista[0][1]), 3)), c: "ink", w: 1.8 });
  }
  return out;
}
// Referencia de la meta de 2% según la vista
const metaRef = o => o.vista === "m" ? { y: 0.165, l: "Meta 2% anual (0,17% mensual)" } : { y: 2, l: "Meta Fed 2%" };
const decV = o => o.vista === "m" ? 2 : 1;
const fechaDe = (a, f = "M") => a && a.length ? (f === "Q" ? fq : f === "W" ? fw : fm)(last(a)[0]) : "";

export const CAT = {};
function def(id, m) { CAT[id] = Object.assign({ id, ops: [] }, m); }

// ═════════════════════════ Actividad ═════════════════════════
def("contribuciones", { slug: "contribuciones-al-pbi", nombre: "Contribuciones al crecimiento del PBI", sin: ["pbi", "gdp", "crecimiento", "motores del pbi"],
  calc: "Contribución de cada componente del gasto al crecimiento real del PBI, en puntos porcentuales de la tasa trimestral anualizada (BEA, tabla 1.1.2). La línea es la suma: el PBI.",
  ks: ["gdp_growth", "c_consumo", "c_inversion", "c_gobierno", "c_externo"],
  f: () => {
    const ks = [["c_consumo", "Consumo"], ["c_inversion", "Inversión"], ["c_gobierno", "Gobierno"], ["c_externo", "Export. netas"]];
    const g = S("gdp_growth"); if (!g || ks.some(([k]) => !S(k))) return null;
    const gg = cut(g, Math.max(ST.T0, T(2021))), ts = gg.map(p => p[0]);
    const series = ks.map(([k, n], i) => { const m = new Map(S(k)); return { n, c: i, t: "bar", d: ts.map(t => m.get(t) ?? 0) }; });
    series.push({ n: "PBI real (%)", t: "line", etiquetas: true, d: gg.map(p => p[1]) });
    const u = series.slice(0, 4).map(s => [s.n, s.d[s.d.length - 1]]).sort((a, b) => b[1] - a[1])[0];
    return { tipo: "cat", freq: "Q", titulo: `PBI ${nf(last(g)[1])}% en ${fq(last(g)[0])}: el motor fue ${u[0].toLowerCase()} (${sg(u[1])} pp)`,
      sub: "Contribuciones al crecimiento real, en puntos porcentuales; la línea es el PBI, % trimestral anualizado. Desde 2021.", unidadLinea: "%", cats: ts.map(fq), series };
  } });
def("gdpnow", { slug: "gdpnow", nombre: "GDPNow vs PBI publicado", sin: ["nowcast", "atlanta", "pbi en tiempo real"],
  calc: "Última estimación del modelo GDPNow de la Fed de Atlanta para cada trimestre, contra el PBI real publicado por BEA (% trimestral anualizado).",
  ks: ["gdpnow", "gdp_growth"],
  f: () => {
    const g = S("gdp_growth"), n = S("gdpnow"); if (!g || !n) return null;
    const ult = last(n), pub = last(g);
    const ts = [...new Set([...cut(g, Math.max(ST.T0, T(2021))).map(p => p[0]), ...cut(n, Math.max(ST.T0, T(2021))).map(p => p[0])])].sort((a, b) => a - b);
    const mg = new Map(g), mn = new Map(n), enCurso = ult[0] > pub[0];
    const hist = (ST.DATA.gdpnow_hist || []).filter(h => P(h[1]) === ult[0]);
    const evol = hist.length > 1 ? ` En el trimestre en curso pasó de ${nf(hist[0][2])}% (${fd(P(hist[0][0]))}) a ${nf(hist[hist.length - 1][2])}%.` : "";
    return { tipo: "cat", freq: "Q", apilado: false, signo: false, unidad: "%",
      titulo: enCurso ? `GDPNow estima ${nf(ult[1])}% para ${fq(ult[0])}, contra ${nf(pub[1])}% del último trimestre publicado` : `El último PBI publicado fue ${nf(pub[1])}% en ${fq(pub[0])}`,
      sub: "PBI real publicado (barras) y la última estimación en tiempo real de la Fed de Atlanta para cada trimestre, % t/t anualizado." + evol,
      cats: ts.map(fq),
      series: [{ n: "PBI publicado", c: 0, t: "bar", d: ts.map(t => mg.get(t) ?? null) }, { n: "GDPNow", t: "line", c: 1, punteada: true, etiquetas: true, d: ts.map(t => mn.get(t) ?? null) }] };
  } });
def("demandaPrivada", { slug: "demanda-privada", nombre: "Demanda privada final vs PBI", sin: ["ventas finales", "final sales", "demanda interna"], ops: [VISTA_Q],
  calc: "Ventas finales reales a compradores privados domésticos (consumo + inversión fija privada) y PBI real. Vista interanual o trimestral anualizada.",
  ks: ["final_sales_priv", "gdp_real"],
  f: o => {
    const f = vista(S("final_sales_priv"), o.vista, "Q"), g = vista(S("gdp_real"), o.vista, "Q"); if (!f || !g) return null;
    const d = last(f)[1] - last(g)[1];
    return { freq: "Q", titulo: `La demanda privada crece ${nf(last(f)[1])}% ${VT[o.vista]}, ${nf(Math.abs(d))} pp ${d >= 0 ? "por encima" : "por debajo"} del PBI`,
      sub: "Consumo más inversión fija privada, en términos reales: el pulso de la demanda sin inventarios, gobierno ni comercio exterior.",
      series: [{ n: "Demanda privada final", d: cut(f), c: 0, w: 2.8 }, { n: "PBI real", d: cut(g), c: 1 }], refs: [{ y: 0 }] };
  } });
def("pbiGdi", { slug: "pbi-vs-gdi", nombre: "PBI vs GDI", sin: ["ingreso bruto", "gdi"],
  calc: "Producto medido por el gasto (PBI) y por el ingreso (GDI), variación interanual real.",
  ks: ["gdp_real", "gdi_real"],
  f: () => {
    const a = yoy(S("gdp_real"), 4), b = yoy(S("gdi_real"), 4); if (!a || !b) return null;
    const br = Math.abs(last(a)[1] - last(b)[1]);
    return { freq: "Q", titulo: br < 0.5 ? `Gasto e ingreso coinciden: el PBI crece ${nf(last(a)[1])}% interanual` : `Gasto (${nf(last(a)[1])}%) e ingreso (${nf(last(b)[1])}%) difieren en ${nf(br)} pp`,
      sub: "Producto medido por el gasto (PBI) y por el ingreso (GDI), variación interanual real. Cuando difieren, suele revisarse el PBI.",
      series: [{ n: "PBI real", d: cut(a), c: 0 }, { n: "GDI real", d: cut(b), c: 2 }], refs: [{ y: 0 }] };
  } });
def("brecha", { slug: "brecha-del-producto", nombre: "Brecha del producto y uso de la capacidad", sin: ["output gap", "potencial", "cbo", "holgura", "capacidad instalada", "recalentamiento"],
  calc: "Brecha del producto: PBI real sobre el PBI potencial que estima la Oficina de Presupuesto del Congreso (CBO), menos 1, en %. Uso de la capacidad: utilización de la capacidad industrial (Fed) menos su promedio 2000-19, en puntos, promedio del trimestre.",
  ks: ["gdp_real", "gdp_pot", "tcu"],
  f: () => {
    const b = join(S("gdp_real"), S("gdp_pot"), (a, c) => (a / c - 1) * 100); if (!b) return null;
    const ss = [{ n: "Brecha del producto (CBO)", d: cut(b), c: 0, w: 2.8, area: true }];
    const t = S("tcu"); let extra = "";
    if (t) {
      const base = t.filter(x => x[0] >= T(2000) && x[0] < T(2020)).map(x => x[1]), m = base.reduce((a, c) => a + c, 0) / base.length;
      const tq = toQ(t.map(([x, v]) => [x, v - m]));
      if (tq) ss.push({ n: `Uso de la capacidad vs. promedio 2000-19 (${nf(m)}%)`, d: cut(tq), c: 1 });
      extra = ` La industria usa ${nf(last(t)[1])}% de su capacidad (${fm(last(t)[0])}), ${sg(last(t)[1] - m)} pp contra su promedio.`;
    }
    const v = last(b)[1];
    return { freq: "Q", titulo: Math.abs(v) < 0.3 ? `La economía produce en línea con su potencial (brecha de ${nf(Math.abs(v))}%)` : `La economía produce ${nf(Math.abs(v))}% ${v > 0 ? "por encima" : "por debajo"} de su potencial`,
      sub: "Positivo: la economía usa más recursos de los que puede sostener y eso presiona sobre la inflación. Negativo: hay capacidad ociosa." + extra,
      series: ss, refs: [{ y: 0, l: "Potencial" }] };
  } });
def("productividad", { slug: "productividad-y-costo-laboral", nombre: "Productividad y costo laboral unitario", sin: ["productividad", "ulc", "costo laboral unitario", "ia", "inteligencia artificial"], ops: [VISTA_Q],
  calc: "Producto por hora y costo laboral unitario del sector empresas no agrícolas (BLS). El costo laboral unitario es la remuneración por hora dividida la productividad.",
  ks: ["productivity", "ulc"],
  f: o => {
    const p = vista(S("productivity"), o.vista, "Q"), u = vista(S("ulc"), o.vista, "Q"); if (!p || !u) return null;
    return { freq: "Q", titulo: `La productividad crece ${nf(last(p)[1])}% ${VT[o.vista]} y el costo laboral unitario ${nf(last(u)[1])}%`,
      sub: "Sector empresas no agrícolas. Si la productividad sube, las empresas pueden pagar salarios más altos sin subir precios: un costo laboral unitario cerca de 2% es compatible con la meta de inflación.",
      series: [{ n: "Productividad", d: cut(p), c: 0, w: 2.8 }, { n: "Costo laboral unitario", d: cut(u), c: 1 }], refs: [{ y: 0 }, { y: 2, l: "2%" }] };
  } });
def("encuestas", { slug: "encuestas-manufactureras", nombre: "Encuestas manufactureras de la Fed", sin: ["philly fed", "empire state", "pmi", "ism", "encuestas", "manufactura", "filadelfia", "nueva york"],
  calc: "Índices de difusión de actividad general de las encuestas manufactureras de la Fed de Filadelfia y de la Fed de Nueva York (Empire State): porcentaje de empresas que ven mejora menos el que ve deterioro. La línea gruesa es el promedio de las dos, promedio móvil de 3 meses.",
  ks: ["philly", "empire"],
  f: () => {
    const a = S("philly"), b = S("empire"); if (!a && !b) return null;
    const ss = [];
    if (a) ss.push({ n: "Filadelfia", d: cut(a), c: 0, fina: true });
    if (b) ss.push({ n: "Nueva York", d: cut(b), c: 1, fina: true });
    const prom = a && b ? roll(join(a, b, (x, y) => (x + y) / 2), 3) : null;
    if (prom) ss.push({ n: "Promedio, 3 meses", d: cut(prom), c: "ink", w: 2.6 });
    const v = prom ? last(prom)[1] : last(a || b)[1];
    return { titulo: `Las encuestas de la Fed ${v >= 0 ? "muestran expansión" : "muestran contracción"} en la industria: promedio de 3 meses en ${sg(v)}`,
      sub: `Por encima de cero, más empresas ven mejora que deterioro. En ${fechaDe(a || b)}: Filadelfia ${a ? sg(last(a)[1]) : "–"}, Nueva York ${b ? sg(last(b)[1]) : "–"}. Son los primeros datos de cada mes, dos semanas antes que la producción industrial.`,
      unidad: "", dec: 1, series: ss, refs: [{ y: 0 }] };
  } });
def("industria", { slug: "produccion-industrial", nombre: "Producción industrial", sin: ["industria", "indpro", "manufactura"], ops: [VISTA_M],
  calc: "Índice de producción industrial de la Fed (2017 = 100), transformado según la vista.",
  ks: ["indpro"],
  f: o => {
    const a = S("indpro"); if (!a) return null;
    const v = vista(a, o.vista), r = racha(v, fm);
    return { titulo: `Producción industrial ${sg(last(v)[1], decV(o))}% ${VT[o.vista]} en ${fechaDe(v)}${r ? ", " + r : ""}`,
      sub: "Índice de producción industrial de la Fed: manufactura, minería y servicios públicos.", dec: decV(o),
      series: seriesVista([["Producción industrial", a, 0]], o), refs: [{ y: 0 }] };
  } });
def("ventas", { slug: "ventas-minoristas", nombre: "Ventas minoristas", sin: ["retail", "consumo", "comercio"], ops: [VISTA_M, REAL("cpi")],
  calc: "Ventas minoristas y de servicios de comida (Census), desestacionalizadas. En vista real se deflactan por el CPI general.",
  ks: ["retail", "cpi"],
  f: o => {
    const a = real(S("retail"), o, "cpi"); if (!a) return null;
    const v = vista(a, o.vista), r = racha(v, fm);
    return { titulo: `Ventas minoristas ${sg(last(v)[1], decV(o))}% ${VT[o.vista]}${o.real === "r" ? " en términos reales" : ""} en ${fechaDe(v)}${r ? ", " + r : ""}`,
      sub: o.real === "r" ? "Ventas minoristas deflactadas por el CPI general: cuánto más (o menos) se compra, sin el efecto de los precios." : "Ventas minoristas nominales: incluyen el efecto de los precios. La vista real las deflacta por el CPI.",
      dec: decV(o), series: seriesVista([[o.real === "r" ? "Ventas reales" : "Ventas nominales", a, 1]], o), refs: [{ y: 0 }] };
  } });
def("ordenes", { slug: "ordenes-de-capital", nombre: "Órdenes de bienes de capital", sin: ["core orders", "capex", "bienes durables", "inversión en equipos"], ops: [VISTA_M, REAL("ppi_capital")],
  calc: "Órdenes nuevas de bienes de capital sin defensa ni aviones (Census, M3). En vista real se deflactan por el PPI de bienes de capital (BLS).",
  ks: ["core_orders", "ppi_capital"],
  f: o => {
    const a = real(S("core_orders"), o, "ppi_capital"); if (!a) return null;
    const v = vista(a, o.vista);
    return { titulo: `Órdenes de bienes de capital ${sg(last(v)[1], decV(o))}% ${VT[o.vista]}${o.real === "r" ? " en términos reales" : ""} en ${fechaDe(v)}`,
      sub: "Bienes de capital sin defensa ni aviones: el adelanto de la inversión en equipos." + (o.real === "r" ? " Deflactadas por el PPI de bienes de capital." : ""),
      dec: decV(o), series: seriesVista([["Órdenes de capital", a, 0]], o), refs: [{ y: 0 }] };
  } });
def("viviendas", { slug: "viviendas", nombre: "Inicios y permisos de viviendas", sin: ["housing starts", "permisos", "construcción", "vivienda"],
  calc: "Viviendas iniciadas y permisos de construcción (Census), en miles, tasa anual desestacionalizada. Los permisos adelantan a los inicios uno o dos meses.",
  ks: ["housing_starts", "permits"],
  f: () => {
    const h = S("housing_starts"), p = S("permits"); if (!h) return null;
    const v = last(h)[1];
    const ss = [{ n: "Inicios", d: cut(h), c: 0 }];
    if (p) ss.push({ n: "Permisos", d: cut(p), c: 3, w: 1.8 });
    return { titulo: `Inicios de viviendas en ${nf(v, 0)} mil por año` + (p ? `; los permisos, que los adelantan, en ${nf(last(p)[1], 0)} mil` : ""),
      sub: "En miles, tasa anual desestacionalizada. Es el sector más sensible a la tasa hipotecaria.",
      unidad: "mil", dec: 0, banda: rangoNormal(h), bandaTexto: "Rango normal de los inicios 2000-19", series: ss };
  } });
def("capex", { slug: "inversion-tecnologica", nombre: "Inversión tecnológica / PBI", sin: ["ia", "data centers", "software", "punto com", "capex tecnológico"],
  calc: "Inversión en equipos de procesamiento de información más software (BEA), sobre PBI nominal. El pico punto com es el máximo anterior a 2003.",
  ks: ["inv_info", "inv_software", "gdp_nom"],
  f: () => {
    const e = S("inv_info"), s = S("inv_software"), g = S("gdp_nom"); if (!e || !s || !g) return null;
    const ep = join(e, g, (a, b) => a / b * 100), sp = join(s, g, (a, b) => a / b * 100), tot = join(ep, sp, (a, b) => a + b);
    const pc = Math.max(...tot.filter(p => p[0] < T(2003)).map(p => p[1])), d = last(tot)[1] - pc;
    return { titulo: d > 0 ? `La inversión tecnológica supera el pico punto com en ${nf(d, 2)} pp del PBI` : `La inversión tecnológica está a ${nf(-d, 2)} pp del pico punto com`,
      sub: "Equipos de procesamiento de información + software, % del PBI nominal, desde 2000. Las estructuras (data centers) no tienen serie propia.",
      freq: "Q", dec: 2, decEje: 1, cero: true, eventos: false, sinRecorte: true,
      series: [{ n: "Equipos de información", d: cut(ep, T(2000)), area: true, stack: "t", c: 0, fin: false }, { n: "Software (tope = total)", d: cut(sp, T(2000)), area: true, stack: "t", c: 2, finValor: last(tot)[1] }],
      refs: [{ y: pc, l: `Pico punto com: ${nf(pc, 2)}%` }] };
  } });
def("ganancias", { slug: "ganancias-corporativas", nombre: "Ganancias corporativas / PBI", sin: ["profits", "márgenes", "empresas"],
  calc: "Ganancias corporativas con ajustes de valuación de inventarios y amortización (BEA), sobre PBI nominal.",
  ks: ["profits", "gdp_nom"],
  f: () => {
    const p = S("profits"), g = S("gdp_nom"); if (!p || !g) return null;
    const r = join(p, g, (a, b) => a / b * 100), v = last(r)[1];
    return { freq: "Q", titulo: `Las ganancias corporativas equivalen al ${nf(v)}% del PBI: percentil ${pctl(r, v)} desde 2000`,
      sub: "Ganancias corporativas (con ajustes de inventario y amortización) sobre PBI nominal.", banda: rangoNormal(r), series: [{ n: "Ganancias / PBI", d: cut(r), c: 2 }] };
  } });

// ═════════════════════════ Consumidor ═════════════════════════
const BASE19 = T(2019, 12);
def("ingresoConsumo", { slug: "ingreso-vs-consumo", nombre: "Ingreso real vs consumo real", sin: ["ingreso disponible", "consumo real"],
  calc: "Ingreso disponible real y consumo real (BEA), índice diciembre 2019 = 100. La base fija hace que la conclusión no dependa del período elegido.",
  ks: ["dpi_real", "pce_real"],
  f: () => {
    const a = indice(S("dpi_real"), BASE19), b = indice(S("pce_real"), BASE19); if (!a || !b) return null;
    const va = last(a)[1] - 100, vb = last(b)[1] - 100;
    return { titulo: `Desde dic-19, el ingreso real creció ${nf(va)}% y el consumo real ${nf(vb)}%`,
      sub: "Índice diciembre 2019 = 100 (último mes normal antes de la pandemia). Si el consumo crece más que el ingreso, baja el ahorro.",
      unidad: "", dec: 1, eventos: false, series: [{ n: "Ingreso disponible real", d: cut(a), c: 0 }, { n: "Consumo real", d: cut(b), c: 1 }], refs: [{ y: 100 }] };
  } });
def("ahorro", { slug: "tasa-de-ahorro", nombre: "Tasa de ahorro", sin: ["saving rate", "ahorro"],
  calc: "Ahorro personal como % del ingreso disponible (BEA).",
  ks: ["saving_rate"],
  f: () => {
    const s = S("saving_rate"); if (!s) return null;
    const rn = rangoNormal(s), v = last(s)[1];
    const pos = rn ? (v < rn[0] ? "debajo de" : v > rn[1] ? "encima de" : "dentro de") : "respecto de";
    return { titulo: `Tasa de ahorro en ${nf(v)}%: ${pos} su rango normal`, sub: "% del ingreso disponible.", banda: rn, series: [{ n: "Tasa de ahorro", d: cut(s), c: 2 }] };
  } });
def("credito", { slug: "credito-al-consumo", nombre: "Crédito al consumo", sin: ["consumer credit", "tarjetas", "préstamos", "g.19"], ops: [VISTA_M, REAL("cpi")],
  calc: "Crédito al consumo total en circulación (Fed, G.19): tarjetas, préstamos para autos y estudiantiles, sin hipotecas. En vista real se deflacta por el CPI general.",
  ks: ["consumer_credit", "cpi"],
  f: o => {
    const a = real(S("consumer_credit"), o, "cpi"); if (!a) return null;
    const v = vista(a, o.vista);
    return { titulo: `El crédito al consumo ${last(v)[1] >= 0 ? "crece" : "cae"} ${nf(Math.abs(last(v)[1]), decV(o))}% ${VT[o.vista]}${o.real === "r" ? " en términos reales" : ""}`,
      sub: "Stock de crédito al consumo sin hipotecas. Si crece más que el ingreso, parte del consumo se financia con deuda.", dec: decV(o),
      series: seriesVista([["Crédito al consumo", a, 3]], o), refs: [{ y: 0 }] };
  } });
def("morosidad", { slug: "morosidad-de-tarjetas", nombre: "Morosidad de tarjetas y préstamos al consumo", sin: ["delinquency", "mora", "tarjetas", "default"],
  calc: "Tasa de morosidad de los préstamos de tarjetas de crédito y del total de préstamos al consumo de los bancos comerciales, desestacionalizada (Fed), % de los préstamos.",
  ks: ["delinq_cards", "delinq_consumer"],
  f: () => {
    const m = S("delinq_cards"); if (!m) return null;
    const v = last(m)[1], rn = rangoNormal(m);
    return { freq: "Q", titulo: `La morosidad de tarjetas está en ${nf(v, 2)}%: ${rn ? (v > rn[1] ? "por encima de" : v < rn[0] ? "por debajo de" : "dentro de") : "respecto de"} su rango normal`,
      sub: "Préstamos de tarjetas con más de 30 días de atraso, % del total. Es la primera señal de que el consumidor se estira más de lo que puede pagar.",
      dec: 2, banda: rn, bandaTexto: "Rango normal de tarjetas 2000-19",
      series: [{ n: "Tarjetas de crédito", d: cut(m), c: 1, w: 2.6 }].concat(S("delinq_consumer") ? [{ n: "Total préstamos al consumo", d: cut(S("delinq_consumer")), c: 0 }] : []) };
  } });
def("consumoTipo", { slug: "consumo-por-tipo", nombre: "Consumo real por tipo de gasto", sin: ["durables", "servicios", "bienes"],
  calc: "Consumo real de servicios, no durables y durables (BEA), índice diciembre 2019 = 100.",
  ks: ["pce_serv", "pce_ndur", "pce_dur"],
  f: () => {
    const ks = [["pce_serv", "Servicios"], ["pce_ndur", "No durables"], ["pce_dur", "Durables"]];
    const ss = ks.map(([k, n], i) => ({ n, d: cut(indice(S(k), BASE19)), c: i })); if (ss.some(s => !s.d || !s.d.length)) return null;
    const lider = ss.reduce((a, b) => last(a.d)[1] > last(b.d)[1] ? a : b);
    return { titulo: `${lider.n} lideran el consumo real: ${sg(last(lider.d)[1] - 100)}% desde dic-19`, sub: "Consumo real por tipo de gasto. Índice diciembre 2019 = 100.",
      unidad: "", dec: 1, eventos: false, series: ss, refs: [{ y: 100 }] };
  } });
def("motores", { slug: "salarios-y-transferencias", nombre: "Salarios y transferencias", sin: ["remuneración", "ingreso personal", "transferencias"], ops: [VISTA_M, REAL("pce_p")],
  calc: "Remuneración a asalariados y transferencias del gobierno a personas (BEA). En vista real se deflactan por el deflactor del PCE, el mismo que usa BEA para el ingreso real.",
  ks: ["comp", "transfers", "pce_p"],
  f: o => {
    const c = real(S("comp"), o, "pce_p"), t = real(S("transfers"), o, "pce_p"); if (!c || !t) return null;
    const a = vista(c, o.vista), b = vista(t, o.vista);
    return { titulo: `Salarios ${sg(last(a)[1], decV(o))}% y transferencias ${sg(last(b)[1], decV(o))}% ${VT[o.vista]}${o.real === "r" ? ", en términos reales" : ""}`,
      sub: "Las dos fuentes principales del ingreso personal." + (o.real === "r" ? " Deflactadas por el deflactor del PCE." : " En dólares corrientes."),
      dec: decV(o), shock: [T(2020, 3), T(2022, 12)], shockVentana: [T(2020, 3), T(2022, 12)],
      series: seriesVista([["Remuneración a asalariados", c, 0], ["Transferencias del gobierno", t, 1]], o), refs: [{ y: 0 }] };
  } });
def("autos", { slug: "ventas-de-autos", nombre: "Ventas de vehículos", sin: ["autos", "vehículos", "durables", "light vehicles"],
  calc: "Ventas totales de vehículos (BEA), en millones de unidades, tasa anual desestacionalizada, y su promedio de 3 meses.",
  ks: ["autos"],
  f: () => {
    const a = S("autos"); if (!a) return null;
    const m3 = roll(a, 3);
    return { titulo: `Se venden ${nf(last(a)[1])} millones de vehículos por año (promedio de 3 meses: ${nf(last(m3)[1])} millones)`,
      sub: "Millones de unidades, tasa anual desestacionalizada. Es el gasto durable más sensible a la tasa de interés y al crédito, y el que primero se adelanta ante subas de precios.",
      unidad: "M", dec: 1, banda: rangoNormal(a), bandaTexto: "Rango normal 2000-19", series: [{ n: "Ventas del mes", d: cut(a), c: 0, fina: true }, { n: "Promedio 3 meses", d: cut(m3), c: 0 }] };
  } });
def("riqueza", { slug: "patrimonio-de-los-hogares", nombre: "Patrimonio de los hogares / ingreso", sin: ["riqueza", "net worth", "efecto riqueza", "z.1", "patrimonio", "acciones"],
  calc: "Patrimonio neto de los hogares y entidades sin fines de lucro (Fed, cuentas financieras Z.1, fin de trimestre) sobre el ingreso disponible nominal anual (BEA, promedio del trimestre).",
  ks: ["net_worth", "dpi_nom"],
  f: () => {
    const r = join(S("net_worth"), toQ(S("dpi_nom")), (a, b) => a / 1000 / b); if (!r) return null;
    const v = last(r)[1];
    return { freq: "Q", titulo: `El patrimonio de los hogares equivale a ${nf(v, 1)} veces su ingreso anual: percentil ${pctl(r, v)} desde 2000`,
      sub: "Cuando suben las acciones y las viviendas, los hogares gastan más y ahorran menos aunque el ingreso no acompañe: es el efecto riqueza. Se publica unos 70 días después del cierre del trimestre.",
      unidad: "veces", dec: 2, decEje: 1, banda: rangoNormal(r), series: [{ n: "Patrimonio / ingreso disponible", d: cut(r), c: 2 }] };
  } });
def("servicioDeuda", { slug: "carga-de-la-deuda", nombre: "Carga de la deuda de los hogares", sin: ["debt service", "deuda de los hogares", "carga financiera", "cuotas"],
  calc: "Pagos de capital e intereses de hipotecas y crédito al consumo como % del ingreso disponible (Fed).",
  ks: ["debt_service"],
  f: () => {
    const s = S("debt_service"); if (!s) return null;
    const v = last(s)[1], rn = rangoNormal(s);
    return { freq: "Q", titulo: `Los hogares destinan ${nf(v)}% de su ingreso a pagar deudas: ${rn ? (v > rn[1] ? "por encima de" : v < rn[0] ? "por debajo de" : "dentro de") : "respecto de"} su rango normal`,
      sub: "Cuotas de hipotecas y crédito al consumo, % del ingreso disponible. Mide el margen que tienen los hogares antes de tener que recortar gasto; con hipotecas a tasa fija, sube despacio aunque suban las tasas.",
      banda: rn, bandaTexto: "Rango normal 2005-19", series: [{ n: "Servicio de la deuda / ingreso", d: cut(s), c: 1 }] };
  } });
def("sentimiento", { slug: "confianza-del-consumidor", nombre: "Confianza del consumidor", sin: ["michigan", "sentiment", "umich"],
  calc: "Índice de sentimiento del consumidor de la Universidad de Michigan (1966 T1 = 100).",
  ks: ["sentiment", "infl_exp_1y"],
  f: () => {
    const s = S("sentiment"), e = S("infl_exp_1y"); if (!s) return null;
    const v = last(s)[1];
    return { titulo: `Confianza del consumidor en ${nf(v)}: percentil ${pctl(s, v)} desde 2000`,
      sub: "Índice de la Universidad de Michigan." + (e ? ` Los mismos hogares esperan ${nf(last(e)[1])}% de inflación a un año.` : ""), unidad: "", dec: 1,
      banda: rangoNormal(s), series: [{ n: "Confianza del consumidor", d: cut(s), c: 0 }] };
  } });

// ═════════════════════════ Precios ═════════════════════════
def("pce", { slug: "pce", nombre: "Inflación PCE general y core", sin: ["inflación", "pce", "core pce", "precios"], ops: [VISTA_M],
  calc: "Índice de precios del gasto de consumo personal (BEA), general y sin alimentos ni energía (core). Es la medida que apunta la Fed.",
  ks: ["pce_core", "pce_p"],
  f: o => {
    const c = S("pce_core"), h = S("pce_p"); if (!c || !h) return null;
    const vc = vista(c, o.vista), v = last(vc)[1];
    const titulo = o.vista === "m" ? `Core PCE ${sg(v, 2)}% mensual en ${fechaDe(vc)}, contra ${sg(prev(vc)[1], 2)}% del mes anterior`
      : `Core PCE en ${nf(v)}% ${VT[o.vista]}: ${nf(Math.abs(v - 2))} pp ${v >= 2 ? "por encima" : "por debajo"} de la meta`;
    return { titulo, sub: "La diferencia entre general y core es energía y alimentos.", dec: decV(o),
      banda: o.vista === "a" ? rangoNormal(vc) : null, bandaTexto: "Rango normal del core 2000-19",
      series: seriesVista([["PCE core", c, 0, { w: 2.8 }], ["PCE general", h, 1]], o), refs: [metaRef(o)] };
  } });
def("momentum", { slug: "momentum-del-core", nombre: "Momentum del core PCE", sin: ["desinflación", "3 meses", "6 meses"],
  calc: "Core PCE: variación interanual, anualizada a 6 meses y anualizada a 3 meses.",
  ks: ["pce_core"],
  f: () => {
    const c = S("pce_core"); if (!c) return null;
    const y = yoy(c), m3 = ann(c, 3), m6 = ann(c, 6);
    const verbo = last(m3)[1] < last(y)[1] ? "se desacelera" : "se acelera";
    return { titulo: `El core ${verbo}: ${nf(last(m3)[1])}% anualizado a 3 meses vs ${nf(last(y)[1])}% interanual`,
      sub: `Si el anualizado corto queda por debajo del interanual, la desinflación sigue. A 6 meses: ${nf(last(m6)[1])}%.`,
      series: [{ n: "Interanual", d: cut(y), c: 0, w: 2.8 }, { n: "3 meses anualizado", d: cut(m3), c: 3, w: 1.6 }], refs: [{ y: 2, l: "Meta Fed 2%" }] };
  } });
def("subyacente", { slug: "inflacion-subyacente", nombre: "Núcleo de la inflación: mediana y media recortada", sin: ["mediana", "media recortada", "trimmed mean", "median cpi", "cleveland", "dallas", "subyacente"],
  calc: "Tres medidas del núcleo de la inflación, interanuales: PCE core (BEA), PCE media recortada (Fed de Dallas: descarta cada mes los rubros con subas y bajas más extremas) y CPI mediana (Fed de Cleveland: la suba del rubro del medio).",
  ks: ["pce_core", "pce_trim", "cpi_median"],
  f: () => {
    const c = yoy(S("pce_core")), t = S("pce_trim"), m = yoy(S("cpi_median")); if (!c) return null;
    const ss = [{ n: "PCE core", d: cut(c), c: 0, w: 2.8 }];
    if (t) ss.push({ n: "PCE media recortada (Dallas)", d: cut(t), c: 2 });
    if (m) ss.push({ n: "CPI mediana (Cleveland)", d: cut(m), c: 1 });
    const vs = ss.map(x => last(x.d)).filter(Boolean).map(x => x[1]), mn = Math.min(...vs), mx = Math.max(...vs);
    return { titulo: `El núcleo de la inflación va de ${nf(mn)}% a ${nf(mx)}% interanual según la medida`,
      sub: "Las medidas que descartan los rubros extremos muestran si la inflación es general o depende de pocos precios. Si las tres coinciden, la lectura es firme. Mediana y media recortada salen unos días después que el PCE.",
      series: ss, refs: [{ y: 2, l: "Meta Fed 2%" }] };
  } });
def("ppi", { slug: "ppi", nombre: "Precios al productor (PPI)", sin: ["ppi", "mayoristas", "productor", "cañería"],
  calc: "Índice de precios al productor para la demanda final (BLS), general y sin alimentos ni energía, variación interanual. El BLS no desestacionaliza el PPI core, por eso sólo se muestra interanual.",
  ks: ["ppi_fd", "ppi_core"],
  f: () => {
    const a = yoy(S("ppi_fd")), b = yoy(S("ppi_core")); if (!a) return null;
    const ss = [{ n: "PPI demanda final", d: cut(a), c: 1 }];
    if (b) ss.push({ n: "PPI sin alimentos ni energía", d: cut(b), c: 0, w: 2.8 });
    return { titulo: `Los precios al productor suben ${nf(last(a)[1])}% interanual` + (b ? `; sin alimentos ni energía, ${nf(last(b)[1])}%` : ""),
      sub: "Lo que cobran las empresas por lo que venden: anticipa parte de lo que después llega al CPI y al PCE. Serie desde 2010.",
      series: ss, refs: [{ y: 0 }, { y: 2, l: "2%" }] };
  } });
def("bienesCore", { slug: "bienes-core-y-aranceles", nombre: "Bienes core y precios de importación", sin: ["aranceles", "tariffs", "bienes core", "importación", "core goods", "traslado"], ops: [VISTA_M],
  calc: "CPI de bienes sin alimentos ni energía (BLS) y precios de importación de todos los productos (BLS). El precio de importación se mide sin el arancel.",
  ks: ["cpi_core_goods", "import_prices"],
  f: o => {
    const g = S("cpi_core_goods"), i = S("import_prices"); if (!g) return null;
    const lista = [["CPI bienes core", g, 1, { w: 2.8 }]];
    if (i) lista.push(["Precios de importación", i, 0]);
    const vg = vista(g, o.vista), vi = i ? vista(i, o.vista) : null;
    return { titulo: `Los bienes core del CPI ${last(vg)[1] >= 0 ? "suben" : "bajan"} ${nf(Math.abs(last(vg)[1]), decV(o))}% ${VT[o.vista]}` + (vi ? `; los importados, antes del arancel, ${sg(last(vi)[1], decV(o))}%` : ""),
      sub: "Si los bienes al consumidor suben y los precios de importación no, el arancel lo absorbe el comprador local y se traslada a precios. Los precios de importación incluyen combustibles y no están desestacionalizados: en vista mensual, mirar la tendencia.",
      dec: decV(o), series: seriesVista(lista, o), refs: [{ y: 0 }] };
  } });
export function rubros() { return Object.keys(ST.DATA.series).filter(k => k.startsWith("cat:")).map(k => ({ k, n: ST.DATA.series[k].n, a3: ann(S(k), 3) })).filter(r => r.a3); }
def("heat", { slug: "rubros-del-core", nombre: "Mapa de calor: rubros del core PCE", sin: ["rubros", "componentes", "heatmap", "vivienda", "salud", "autos"],
  calc: "Inflación anualizada a 3 meses de los 13 rubros del PCE core (BEA, tabla NIPA 2.8.4), últimos 18 meses.",
  ks: ["cat:Salud"],
  f: () => {
    const rs = rubros(); if (rs.length < 5) return null;
    const fechas = rs[0].a3.slice(-18).map(p => p[0]);
    const ult = rs.map(r => ({ n: r.n, m: new Map(r.a3), v: last(r.a3)[1] })).sort((a, b) => b.v - a.v);
    const data = []; ult.forEach((r, yi) => fechas.forEach((t, xi) => { const v = r.m.get(t); if (v != null) data.push([xi, yi, v]); }));
    const cal = ult.filter(r => r.v > 3).length;
    return { tipo: "heat", titulo: `${cal} de ${ult.length} rubros del núcleo corren arriba de 3% anual`,
      sub: "Inflación por rubro del PCE core, anualizada a 3 meses. Gris = cerca de 2%; rojo, arriba; azul, abajo. Ordenado por el último mes. No depende del período elegido.",
      fuenteTxt: "BEA, tabla NIPA 2.8.4", cols: fechas.map(fm), filas: ult.map(r => r.n), data, series: [],
      tabla: { cab: ["Rubro", ...fechas.slice(-6).map(fm)], filas: ult.map(r => [r.n, ...fechas.slice(-6).map(t => nf(r.m.get(t)))]) } };
  } });
def("difusion", { slug: "difusion", nombre: "Difusión de la inflación", sin: ["amplitud", "rubros arriba de 3%"],
  calc: "Porcentaje de los 13 rubros del PCE core con inflación anualizada a 3 meses mayor a 3%, promedio móvil de 3 meses.",
  ks: ["cat:Salud"],
  f: () => {
    const rs = rubros(); if (rs.length < 5) return null;
    const m = new Map();
    for (const r of rs) for (const [t, v] of r.a3) { const e = m.get(t) || [0, 0]; e[0] += v > 3 ? 1 : 0; e[1]++; m.set(t, e); }
    const s = roll([...m].sort((a, b) => a[0] - b[0]).map(([t, [a, n]]) => [t, a / n * 100]), 3);
    return { titulo: `La presión de precios alcanza al ${nf(last(s)[1], 0)}% de los rubros del núcleo`,
      sub: "Porcentaje de rubros del PCE core con inflación anualizada a 3 meses mayor a 3% (promedio móvil 3 meses).", fuenteTxt: "BEA, tabla NIPA 2.8.4",
      dec: 0, banda: rangoNormal(s), yMin: 0, yMax: 100, series: [{ n: "Rubros arriba de 3%", d: cut(s), c: 1 }] };
  } });
def("serviciosBienes", { slug: "servicios-y-bienes", nombre: "Inflación de servicios, bienes y supercore", sin: ["supercore", "servicios", "bienes"], ops: [VISTA_M],
  calc: "Índices de precios PCE de servicios, de bienes y de servicios sin energía ni vivienda (supercore), BEA.",
  ks: ["pce_services", "pce_goods", "pce_supercore"],
  f: o => {
    const s = S("pce_services"), g = S("pce_goods"), sc = S("pce_supercore"); if (!s || !g) return null;
    const lista = [["Servicios", s, 0], ["Bienes", g, 1]];
    if (sc) lista.push(["Supercore", sc, 2]);
    const vs = vista(s, o.vista), vg = vista(g, o.vista);
    return { titulo: `Servicios en ${nf(last(vs)[1], decV(o))}% y bienes en ${nf(last(vg)[1], decV(o))}% ${VT[o.vista]}`,
      sub: "La inflación persistente vive en servicios. El supercore (servicios sin energía ni vivienda) es la medida que sigue la Fed.", dec: decV(o),
      series: seriesVista(lista, o), refs: [{ y: 0 }] };
  } });
def("componentes", { slug: "alimentos-vs-core", nombre: "Alimentos vs core", sin: ["alimentos", "comida"], ops: [VISTA_M],
  calc: "Índices de precios PCE de alimentos y bebidas para consumo en el hogar, y core (BEA).",
  ks: ["pce_food", "pce_core"],
  f: o => {
    const f = S("pce_food"), c = S("pce_core"); if (!f || !c) return null;
    const vf = vista(f, o.vista), vc = vista(c, o.vista);
    return { titulo: `Alimentos ${sg(last(vf)[1], decV(o))}% y core ${sg(last(vc)[1], decV(o))}% ${VT[o.vista]}`,
      sub: "Alimentos contra el núcleo. La energía, que se mueve en otra escala, va aparte.", dec: decV(o),
      series: seriesVista([["Core", c, 0, { w: 2.8 }], ["Alimentos", f, 3]], o), refs: [{ y: 0 }] };
  } });
def("energia", { slug: "energia", nombre: "Inflación de energía", sin: ["nafta", "combustibles", "petróleo", "electricidad"], ops: [VISTA_M],
  calc: "Índice de precios PCE de bienes y servicios de energía (BEA).",
  ks: ["pce_energy"],
  f: o => {
    const e = S("pce_energy"); if (!e) return null;
    const v = vista(e, o.vista), x = last(v)[1];
    return { titulo: `La energía ${x >= 0 ? "sube" : "baja"} ${nf(Math.abs(x), decV(o))}% ${VT[o.vista]}`,
      sub: "Precios de energía del PCE (combustibles, electricidad y gas).", dec: decV(o),
      series: seriesVista([["Energía", e, 1, { area: true }]], o), refs: [{ y: 0 }] };
  } });
def("cpiPce", { slug: "cpi-vs-pce", nombre: "CPI core vs PCE core", sin: ["cpi", "ipc", "inflación minorista"], ops: [VISTA_M],
  calc: "CPI sin alimentos ni energía (BLS) y PCE core (BEA). El CPI pondera más la vivienda; la Fed apunta al PCE.",
  ks: ["cpi_core", "pce_core"],
  f: o => {
    const a = S("cpi_core"), b = S("pce_core"); if (!a || !b) return null;
    const va = vista(a, o.vista), vb = vista(b, o.vista);
    return { titulo: `CPI core ${o.vista === "m" ? sg(last(va)[1], 2) : nf(last(va)[1])}% vs PCE core ${o.vista === "m" ? sg(last(vb)[1], 2) : nf(last(vb)[1])}% ${VT[o.vista]}`,
      sub: "El CPI pondera más la vivienda; la Fed apunta al PCE. El CPI mensual es el dato que mira el mercado el día del release.", dec: decV(o),
      series: seriesVista([["PCE core", b, 0, { w: 2.8 }], ["CPI core", a, 1]], o), refs: [metaRef(o)] };
  } });
def("vivienda", { slug: "cpi-vivienda", nombre: "CPI vivienda vs CPI core", sin: ["shelter", "alquileres", "vivienda", "oer"], ops: [VISTA_M],
  calc: "Componente de vivienda del CPI (alquileres y alquiler equivalente de los propietarios, BLS) contra el CPI core.",
  ks: ["cpi_shelter", "cpi_core"],
  f: o => {
    const v = S("cpi_shelter"), c = S("cpi_core"); if (!v || !c) return null;
    const vv = vista(v, o.vista), vc = vista(c, o.vista);
    return { titulo: `Vivienda ${nf(last(vv)[1], decV(o))}% vs CPI core ${nf(last(vc)[1], decV(o))}% ${VT[o.vista]}`,
      sub: "La vivienda pesa cerca del 40% del CPI core y se mueve con un año de rezago respecto de los alquileres de mercado.", dec: decV(o),
      series: seriesVista([["CPI vivienda", v, 1, { w: 2.8 }], ["CPI core", c, 0]], o), refs: [metaRef(o)] };
  } });
def("expectativas", { slug: "expectativas-de-inflacion", nombre: "Expectativas de inflación", sin: ["breakeven", "5y5y", "michigan", "anclaje"],
  calc: "Inflación esperada a 1 año por los hogares (U. de Michigan), 5 años dentro de 5 años implícita en bonos (Fed de St. Louis) y breakeven a 10 años.",
  ks: ["infl_exp_1y", "infl_exp_5y5y", "breakeven10"],
  f: () => {
    const m = S("infl_exp_1y"), f = SD("infl_exp_5y5y"), b = SD("breakeven10"); if (!m || !f) return null;
    const ss = [{ n: "Mercado, 5 años dentro de 5", d: cut(f), c: 0, w: 2.8, dec: 2 }, { n: "Hogares, 1 año", d: cut(m), c: 1, dec: 1 }];
    if (b) ss.push({ n: "Breakeven 10 años", d: cut(b), c: 2, w: 1.6, dec: 2 });
    return { titulo: `Expectativas: hogares ${nf(last(m)[1])}% a 1 año, mercado ${nf(last(f)[1], 2)}% a largo plazo`,
      sub: "Si las expectativas de largo plazo se mantienen cerca de 2-2,5%, la Fed considera que la inflación está anclada.",
      dec: 2, decEje: 1, series: ss, refs: [{ y: 2, l: "Meta Fed 2%" }] };
  } });

// ═════════════════════════ Empleo ═════════════════════════
def("nominas", { slug: "nominas", nombre: "Nóminas no agrícolas", sin: ["payrolls", "nfp", "empleo", "puestos de trabajo"],
  calc: "Variación mensual del empleo asalariado no agrícola (BLS, encuesta de establecimientos), en miles, y su promedio de 3 meses.",
  ks: ["payrolls"],
  f: () => {
    const p = S("payrolls"); if (!p) return null;
    const d = diff(p), m3 = roll(d, 3), desde = Math.max(ST.T0, T(2021));
    // revisión de los dos meses previos contra su primera publicación
    let rev = "";
    const prim = ST.DATA.primeras && ST.DATA.primeras.payrolls;
    if (prim) {
      let tot = 0, n = 0;
      for (const i of [1, 2]) {
        const obs = new Date(d[d.length - 1 - i][0]).toISOString().slice(0, 10), r = prim[obs];
        if (r) { tot += d[d.length - 1 - i][1] - (r[2] - r[1]); n++; }
      }
      if (n) rev = ` Revisión de los ${n === 2 ? "dos meses" : "mes"} previo${n === 2 ? "s" : ""}: ${sg(tot, 0)} mil.`;
    }
    return { titulo: `La economía suma ${nf(last(m3)[1], 0)} mil puestos por mes (promedio de 3 meses)`,
      sub: `Variación mensual de las nóminas no agrícolas, en miles. Último mes: ${sg(last(d)[1], 0)} mil.${rev} Con el crecimiento actual de la población, unos 80 mil por mes mantienen estable el desempleo.` + (ST.T0 < T(2021) ? " Desde 2021, para que la pandemia no aplaste la escala." : ""),
      unidad: "mil", dec: 0, eventos: false, sinRecorte: true,
      series: [{ n: "Cambio mensual", d: cut(d, desde), t: "bar", c: 0 }, { n: "Promedio 3 meses", d: cut(m3, desde), c: 1, w: 2.4 }], refs: [{ y: 0 }, { y: 80, l: "Equilibrio aprox. (80 mil)" }] };
  } });
def("desempleo", { slug: "desempleo", nombre: "Tasa de desempleo", sin: ["unemployment", "u3", "desocupación"],
  calc: "Tasa de desempleo U-3 y desempleo ampliado U-6 (BLS, encuesta de hogares), % de la fuerza laboral. El U-6 suma a quienes dejaron de buscar y a quienes trabajan menos horas de las que quieren.",
  ks: ["unemployment", "u6"],
  f: () => {
    const u = S("unemployment"); if (!u) return null;
    const v = last(u)[1], min12 = Math.min(...u.slice(-12).map(p => p[1])), r = racha(u, fm);
    return { titulo: `Desempleo en ${nf(v)}%, ${nf(v - min12)} pp sobre su mínimo de 12 meses${r ? " (" + r + ")" : ""}`, sub: "Tasa de desempleo (U-3) y desempleo ampliado (U-6), % de la fuerza laboral." + (S("u6") ? ` U-6: ${nf(last(S("u6"))[1])}%.` : ""),
      banda: rangoNormal(u), bandaTexto: "Rango normal del U-3 2000-19", series: [{ n: "Desempleo (U-3)", d: cut(u), c: 0, w: 2.8 }].concat(S("u6") ? [{ n: "Desempleo ampliado (U-6)", d: cut(S("u6")), c: 1 }] : []) };
  } });
def("sahm", { slug: "regla-de-sahm", nombre: "Regla de Sahm", sin: ["recesión", "sahm"],
  calc: "Promedio de 3 meses de la tasa de desempleo menos su mínimo de los 12 meses previos, en tiempo real (Fed de St. Louis).",
  ks: ["sahm"],
  f: () => {
    const s = S("sahm"); if (!s) return null;
    const v = last(s)[1];
    return { titulo: v >= 0.5 ? `Regla de Sahm activada: ${nf(v, 2)} pp, por encima del umbral de 0,5` : `Regla de Sahm en ${nf(v, 2)} pp: ${nf(0.5 - v, 2)} pp por debajo del umbral de recesión`,
      sub: "Superar 0,5 pp marcó el inicio de cada recesión desde 1970.", dec: 2, decEje: 1, unidad: "pp",
      series: [{ n: "Indicador de Sahm", d: cut(s), c: 1, area: true }], refs: [{ y: 0.5, l: "Umbral de recesión 0,5" }, { y: 0 }] };
  } });
def("tension", { slug: "vacantes-por-desocupado", nombre: "Vacantes por desocupado", sin: ["jolts", "vacantes", "tensión laboral"],
  calc: "Vacantes (BLS, JOLTS) sobre desocupados (BLS).",
  ks: ["openings", "unemployed"],
  f: () => {
    const o = S("openings"), u = S("unemployed"); if (!o || !u) return null;
    const r = join(o, u, (a, b) => a / b);
    return { titulo: `Hay ${nf(last(r)[1], 2)} vacantes por cada desocupado`,
      sub: "Por encima de 1, el mercado laboral está más ajustado que equilibrado.", unidad: "", dec: 2, banda: rangoNormal(r),
      series: [{ n: "Vacantes por desocupado", d: cut(r), c: 0 }], refs: [{ y: 1, l: "1 vacante por desocupado" }] };
  } });
def("rotacion", { slug: "contrataciones-renuncias-despidos", nombre: "Contrataciones, renuncias y despidos", sin: ["jolts", "hires", "quits", "layoffs", "renuncias", "despidos", "contrataciones", "rotación"],
  calc: "Tasas de contrataciones, renuncias voluntarias y despidos, % del empleo por mes (BLS, JOLTS).",
  ks: ["hires", "quits", "layoffs"],
  f: () => {
    const h = S("hires"), q = S("quits"), l = S("layoffs"); if (!q) return null;
    const ss = [];
    if (h) ss.push({ n: "Contrataciones", d: cut(h), c: 0, w: 2.6 });
    ss.push({ n: "Renuncias", d: cut(q), c: 2 });
    if (l) ss.push({ n: "Despidos", d: cut(l), c: 1 });
    let titulo = `Tasa de renuncias en ${nf(last(q)[1])}%: percentil ${pctl(q, last(q)[1])} desde 2000`;
    if (h && l) {
      const ph = pctl(h, last(h)[1]), pl = pctl(l, last(l)[1]);
      const lectura = ph < 25 && pl < 50 ? "se contrata poco y se despide poco" : ph < 25 ? "se contrata poco y los despidos suben" : pl > 75 ? "los despidos están altos" : "la rotación es normal";
      titulo = `Contrataciones en ${nf(last(h)[1])}% (percentil ${ph}) y despidos en ${nf(last(l)[1])}% (percentil ${pl}): ${lectura}`;
    }
    return { titulo, sub: "% del empleo por mes; percentiles desde 2000. Las renuncias adelantan los salarios (renuncia quien consigue algo mejor); los despidos adelantan el desempleo. Con pocas contrataciones, quien pierde el empleo tarda más en reubicarse.",
      series: ss };
  } });
def("composicion", { slug: "quien-crea-empleo", nombre: "¿Quién crea el empleo?", sin: ["salud", "gobierno", "empleo privado", "sectores", "composición", "nóminas por sector"],
  calc: "Variación mensual del empleo, promedio de 3 meses, en miles (BLS): resto del sector privado (privado menos salud y asistencia social), salud y asistencia social, y gobierno. La línea es el total.",
  ks: ["payrolls_priv", "payrolls_health", "payrolls_gov"],
  f: () => {
    const p = S("payrolls_priv"), h = S("payrolls_health"), g = S("payrolls_gov"); if (!p || !h || !g) return null;
    const desde = Math.max(ST.T0, T(2021));
    const partes = [["Privado sin salud", join(p, h, (a, b) => a - b), 0], ["Salud y asistencia social", h, 2], ["Gobierno", g, 1]]
      .map(([n, a, c]) => ({ n, c, t: "bar", stack: "e", d: cut(roll(diff(a), 3), desde) }));
    const tot = cut(roll(diff(join(p, g, (a, b) => a + b)), 3), desde);
    const [r, s_, gv] = partes.map(x => last(x.d)[1]);
    const titulo = r <= 0 ? `El sector privado sin salud ${r < 0 ? "pierde" : "no crea"} empleo: ${sg(r, 0)} mil por mes; salud y gobierno suman ${nf(s_ + gv, 0)} mil`
      : `El sector privado sin salud suma ${nf(r, 0)} mil puestos por mes; salud y gobierno, ${nf(s_ + gv, 0)} mil`;
    return { titulo, sub: "Promedio de 3 meses, miles de puestos por mes. Salud y gobierno crecen por razones propias (envejecimiento, presupuesto); el resto del sector privado es el que refleja el ciclo." + (ST.T0 < T(2021) ? " Desde 2021." : ""),
      unidad: "mil", dec: 0, cero: true, eventos: false, sinRecorte: true, series: partes.concat([{ n: "Total", d: tot, c: "ink", w: 2 }]), refs: [{ y: 0 }] };
  } });
def("salarioReal", { slug: "salario-real", nombre: "Salario horario y salario real", sin: ["salarios", "ahe", "salario real", "poder adquisitivo"], ops: [VISTA_M, REAL("cpi")],
  calc: "Salario horario promedio del sector privado (BLS). En vista nominal se compara con el CPI general; en vista real se deflacta por el CPI.",
  ks: ["ahe", "cpi"],
  f: o => {
    const w = S("ahe"), c = S("cpi"); if (!w || !c) return null;
    if (o.real === "r") {
      const r = deflactar(w, c), v = vista(r, o.vista);
      return { titulo: `El salario real ${last(v)[1] >= 0 ? "sube" : "cae"} ${nf(Math.abs(last(v)[1]), decV(o))}% ${VT[o.vista]}`,
        sub: "Salario horario deflactado por el CPI general: el poder de compra del salario.", dec: decV(o),
        series: seriesVista([["Salario real", r, 0, { area: true }]], o), refs: [{ y: 0 }] };
    }
    const vw = vista(w, o.vista), vc = vista(c, o.vista);
    return { titulo: `Los salarios suben ${nf(last(vw)[1], decV(o))}% ${VT[o.vista]}: ${sg(last(vw)[1] - last(join(vw, vc, (a, b) => b))[1], decV(o))} pp contra el CPI`,
      sub: "Salario horario promedio del sector privado contra la inflación que enfrenta el trabajador (CPI general).", dec: decV(o),
      series: seriesVista([["Salario horario", w, 0, { w: 2.8 }], ["CPI general", c, 1]], o), refs: [{ y: 0 }] };
  } });
def("eci", { slug: "costo-laboral-eci", nombre: "Índice de costo laboral (ECI) vs salario horario", sin: ["eci", "salarios", "costo laboral"], ops: [VISTA_Q],
  calc: "Índice de costo laboral, salarios del sector privado (BLS, trimestral), contra el salario horario promedio llevado a trimestre. El ECI mantiene fija la composición del empleo.",
  ks: ["eci", "ahe"],
  f: o => {
    const e = S("eci"), w = toQ(S("ahe")); if (!e || !w) return null;
    const ve = vista(e, o.vista, "Q"), vw = join(vista(w, o.vista, "Q"), ve, a => a);
    return { freq: "Q", titulo: `Los salarios medidos por el ECI suben ${nf(last(ve)[1])}% ${VT[o.vista]}`,
      sub: "El ECI no cambia cuando cambia la composición del empleo (por ejemplo, si se pierden puestos de bajo salario): es la medida de salarios que mira la Fed.",
      series: [{ n: "ECI salarios", d: cut(ve), c: 0, w: 2.8 }, { n: "Salario horario promedio", d: cut(vw), c: 1 }], refs: [{ y: 3.5, l: "Compatible con 2% de inflación (≈3,5%)" }] };
  } });
def("epop", { slug: "empleo-25-54", nombre: "Empleo 25-54 y participación", sin: ["epop", "participación", "prime age"],
  calc: "Proporción de la población de 25 a 54 años con empleo y tasa de participación de toda la población (BLS).",
  ks: ["epop_prime", "participation"],
  f: () => {
    const e = S("epop_prime"), p = S("participation"); if (!e) return null;
    const v = last(e)[1];
    const ss = [{ n: "Empleo 25-54", d: cut(e), c: 2 }];
    if (p) ss.push({ n: "Participación (total)", d: cut(p), c: 0, w: 1.8 });
    return { titulo: `Empleo 25-54 años en ${nf(v)}%: percentil ${pctl(e, v)} desde 2000`,
      sub: "El empleo de 25 a 54 años no depende del envejecimiento ni de cuántos buscan trabajo; la participación total sí.",
      banda: rangoNormal(e), bandaTexto: "Rango normal del empleo 25-54 2000-19", series: ss };
  } });
def("pedidos", { slug: "pedidos-iniciales", nombre: "Pedidos iniciales de desempleo", sin: ["claims", "initial claims", "seguro de desempleo"],
  calc: "Pedidos iniciales semanales del seguro de desempleo (Dpto. de Trabajo), desestacionalizados, y su promedio de 4 semanas, en miles.",
  ks: ["claims"],
  f: () => {
    const c = escala(S("claims"), 1 / 1000); if (!c) return null;
    const m4 = roll(c, 4), r = racha(m4, fw, "semanas");
    return { freq: "W", titulo: `Pedidos iniciales de desempleo: ${nf(last(c)[1], 0)} mil en la semana, ${nf(last(m4)[1], 0)} mil en promedio de 4 semanas${r ? " (" + r + ")" : ""}`,
      sub: `Dato semanal, semana al ${fw(last(c)[0])}. Es el dato de mayor frecuencia del mercado laboral.`,
      unidad: "mil", dec: 0, banda: rangoNormal(m4), bandaTexto: "Rango normal 2000-19",
      series: [{ n: "Semanal", d: cut(c), c: 1, fina: true }, { n: "Promedio 4 semanas", d: cut(m4), c: 1 }] };
  } });
def("continuos", { slug: "pedidos-continuos", nombre: "Pedidos continuos de desempleo", sin: ["continuing claims"],
  calc: "Personas que siguen cobrando el seguro de desempleo (Dpto. de Trabajo), semanal, en millones.",
  ks: ["cont_claims"],
  f: () => {
    const c = escala(S("cont_claims"), 1 / 1e6); if (!c) return null;
    const m4 = roll(c, 4);
    return { freq: "W", titulo: `Pedidos continuos en ${nf(last(c)[1], 2)} millones`,
      sub: `Semana al ${fw(last(c)[0])}. Mide cuánto tarda en reubicarse quien pierde el empleo.`,
      unidad: "M", dec: 2, banda: rangoNormal(m4), series: [{ n: "Semanal", d: cut(c), c: 0, fina: true }, { n: "Promedio 4 semanas", d: cut(m4), c: 0 }] };
  } });

// ═════════════════════════ Tasas ═════════════════════════
def("curvaTesoro", { slug: "curva-del-tesoro", nombre: "Curva del Tesoro", sin: ["curva", "yield curve", "rendimientos", "bonos"],
  calc: "Rendimiento de los bonos del Tesoro por plazo (constant maturity), datos diarios, hoy y hace 1, 6 y 12 meses.",
  ks: ["ust10"],
  f: () => {
    const cv = ST.DATA.curva; if (!cv || Object.keys(cv).length < 6) return null;
    const plazos = Object.keys(cv);
    const fechas = [...new Set(plazos.flatMap(p => cv[p].map(o => o[0])))].filter(f => P(f) <= ST.T1).sort();
    if (!fechas.length) return null;
    const hoy = fechas[fechas.length - 1];
    const cerca = obj => fechas.filter(f => f <= obj).pop();
    const menos = (f, meses) => { const d = new Date(P(f)); d.setUTCMonth(d.getUTCMonth() - meses); return d.toISOString().slice(0, 10); };
    const cortes = [[hoy, "Hoy", 0], [cerca(menos(hoy, 1)), "Hace 1 mes", 1], [cerca(menos(hoy, 6)), "Hace 6 meses", 2], [cerca(menos(hoy, 12)), "Hace 12 meses", 3]].filter(c => c[0]);
    const val = (p, f) => { const o = cv[p].filter(x => x[0] <= f).pop(); return o ? o[1] : null; };
    const series = cortes.map(([f, n, c], i) => ({ n: `${n} (${fd(P(f))}${i ? "-" + String(new Date(P(f)).getUTCFullYear()).slice(2) : ""})`, t: "line", c, w: i ? 1.8 : 3, punteada: i > 0, etiquetas: i === 0 ? "todas" : false, d: plazos.map(p => val(p, f)) }));
    const y2 = val("2A", hoy), y10 = val("10A", hoy), m3 = val("3M", hoy);
    const c1 = cortes[1] ? (val("10A", hoy) - val("10A", cortes[1][0])) * 100 : null, c6 = cortes[2] ? (val("10A", hoy) - val("10A", cortes[2][0])) * 100 : null;
    return { tipo: "cat", titulo: `Curva del Tesoro: 3 meses ${nf(m3, 2)}%, 2 años ${nf(y2, 2)}%, 10 años ${nf(y10, 2)}%`,
      sub: "Rendimiento por plazo, datos diarios. Compara la forma de la curva hoy con hace 1, 6 y 12 meses." + (c1 != null && c6 != null ? ` El 10 años cambió ${sg(c1, 0)} pb en un mes y ${sg(c6, 0)} pb en 6 meses.` : "") + " No depende del período elegido.",
      fuenteTxt: "Tesoro de EE.UU. vía FRED", unidad: "%", dec: 2, decEje: 1, signo: false, escala: true, cats: plazos, series };
  } });
const txtFrec = k => { const f = freqD(k); return f === "D" ? "datos diarios" : f === "W" ? "datos semanales" : "promedios mensuales"; };
function notaParcial() {
  if (usaDiario()) return "";
  const cv = ST.DATA.curva && ST.DATA.curva["10A"]; if (!cv || !cv.length) return "";
  const f = cv[cv.length - 1][0], d = new Date(P(f));
  return d.getUTCDate() < 28 ? ` El último punto es el promedio del mes en curso hasta el ${d.getUTCDate()}-${fm(P(f)).split("-")[0]}.` : "";
}
def("curva", { slug: "fed-y-treasuries", nombre: "Fed y Treasuries", sin: ["fondos federales", "tasa de política", "treasuries", "bonos"],
  calc: "Tasa efectiva de fondos federales y rendimientos de Treasuries a 2, 10 y 30 años. Datos diarios con períodos de hasta 5 años; promedios mensuales con períodos más largos.",
  ks: ["fed_funds", "ust2", "ust10", "ust30"],
  f: () => {
    const ks = [["fed_funds", "Fondos federales"], ["ust2", "2 años"], ["ust10", "10 años"], ["ust30", "30 años"]];
    const ss = ks.map(([k, n], i) => ({ n, d: cut(SD(k)), c: i, dec: 2 })).filter(s => s.d && s.d.length); if (ss.length < 3) return null;
    return { freq: freqD("ust10"), titulo: `Fed ${nf(last(ss[0].d)[1], 2)}%, 2 años ${nf(last(ss[1].d)[1], 2)}%, 10 años ${nf(last(ss[2].d)[1], 2)}%`,
      sub: `Tasa de fondos federales y Treasuries por plazo, ${txtFrec("ust10")}.` + notaParcial(), fuenteTxt: "Fed y Tesoro de EE.UU. vía FRED", dec: 2, series: ss };
  } });
def("pendiente", { slug: "pendiente-de-la-curva", nombre: "Pendiente de la curva", sin: ["10-2", "10-3m", "inversión de la curva", "spread"],
  calc: "Treasury 10 años menos 2 años, y 10 años menos letra de 3 meses, en puntos básicos. Datos diarios con períodos de hasta 5 años; promedios mensuales con períodos más largos.",
  ks: ["ust10", "ust2", "spread_10y3m"],
  f: () => {
    const a = SD("ust10"), b = SD("ust2"), c = SD("spread_10y3m"); if (!a || !b) return null;
    const s = join(a, b, (x, y) => (x - y) * 100), v = last(s)[1];
    const ss = [{ n: "10 años − 2 años", d: cut(s), c: 0 }];
    if (c) ss.push({ n: "10 años − 3 meses", d: escala(cut(c), 100), c: 1 });
    return { titulo: v >= 0 ? `Curva 10-2 positiva en ${nf(v, 0)} pb` : `Curva 10-2 invertida en ${nf(-v, 0)} pb`,
      sub: `La inversión 10-3 meses precedió a las últimas recesiones; el riesgo suele aparecer cuando vuelve a positiva. En puntos básicos, ${txtFrec("ust10")}.`, fuenteTxt: "Tesoro de EE.UU. vía FRED",
      freq: freqD("ust10"), unidad: "pb", dec: 0, series: ss, refs: [{ y: 0 }] };
  } });
def("tasaReal", { slug: "tasa-real", nombre: "Tasa real a 10 años", sin: ["tips", "breakeven", "tasa real"],
  calc: "Rendimiento de los TIPS a 10 años (tasa real) e inflación esperada implícita (breakeven a 10 años).",
  ks: ["tips10", "breakeven10"],
  f: () => {
    const r = SD("tips10"), be = SD("breakeven10"); if (!r || !be) return null;
    const v = last(r)[1];
    return { freq: freqD("tips10"), titulo: `Tasa real a 10 años en ${nf(v, 2)}% e inflación esperada en ${nf(last(be)[1], 2)}%: la tasa real está en el percentil ${pctl(r, v)} desde 2003`,
      sub: `El rendimiento nominal a 10 años se divide en tasa real (TIPS) e inflación esperada (breakeven), ${txtFrec("tips10")}. La inflación esperada va en el eje derecho: se mueve en un rango mucho más chico y en el mismo eje se vería plana.`,
      fuenteTxt: "Tesoro de EE.UU. vía FRED", dec: 2,
      series: [{ n: "Tasa real (TIPS)", d: cut(r), c: 0, w: 2.8 }, { n: "Inflación esperada (breakeven, eje derecho)", d: cut(be), c: 1, der: true }] };
  } });
def("primaPlazo", { slug: "prima-por-plazo", nombre: "Prima por plazo a 10 años", sin: ["term premium", "kim wright"],
  calc: "Prima por plazo del bono a 10 años según el modelo Kim-Wright de la Fed.",
  ks: ["term_premium"],
  f: () => {
    const t = SD("term_premium"); if (!t) return null;
    const v = last(t)[1];
    return { titulo: `La prima por plazo a 10 años está en ${nf(v, 2)}%: percentil ${pctl(t, v)} desde 2000`,
      sub: "Compensación extra por prestar a 10 años en vez de renovar a corto plazo. Sube con el riesgo fiscal y la incertidumbre de inflación.",
      freq: freqD("term_premium"), dec: 2, banda: rangoNormal(S("term_premium")), series: [{ n: "Prima por plazo 10 años", d: cut(t), c: 0 }], refs: [{ y: 0 }] };
  } });
def("descuenta", { slug: "que-descuenta-el-mercado", nombre: "Qué descuenta el mercado de la Fed", sin: ["recortes", "subas", "expectativas de tasa", "2 años", "fed funds", "política esperada"],
  calc: "Treasury a 2 años menos tasa efectiva de fondos federales, en puntos básicos. Datos diarios con períodos de hasta 5 años; promedios mensuales con períodos más largos.",
  ks: ["ust2", "fed_funds"],
  f: () => {
    const a = SD("ust2"), f = SD("fed_funds"); if (!a || !f) return null;
    const s = join(a, f, (x, y) => (x - y) * 100);
    const v = last(s)[1];
    const n = Math.round(Math.abs(v) / 25);
    const titulo = Math.abs(v) < 12.5 ? `El mercado no descuenta cambios de tasa: el 2 años está ${sg(v, 0)} pb contra la Fed`
      : `El mercado descuenta ${v < 0 ? "recortes" : "subas"}: el 2 años está ${nf(Math.abs(v), 0)} pb ${v < 0 ? "debajo" : "encima"} de la Fed (unos ${n} movimientos de 0,25)`;
    return { titulo, sub: "Treasury a 2 años menos tasa de fondos federales. Negativo: el mercado espera recortes en los próximos dos años; positivo, subas. Es una aproximación: el 2 años incluye también una prima por plazo pequeña." + notaParcial(),
      freq: freqD("ust2"), unidad: "pb", dec: 0, series: [{ n: "2 años − fondos federales", d: cut(s), c: 0, area: true }], refs: [{ y: 0 }] };
  } });
def("politica", { slug: "tasa-real-de-la-fed", nombre: "Tasa real de la Fed", sin: ["política monetaria", "restrictiva", "neutral"],
  calc: "Tasa efectiva de fondos federales menos inflación core PCE interanual.",
  ks: ["fed_funds", "pce_core"],
  f: () => {
    const f = S("fed_funds"), c = yoy(S("pce_core")); if (!f || !c) return null;
    const r = join(f, c, (a, b) => a - b), fu = last(SD("fed_funds")), v = fu[1] - last(c)[1];
    const lectura = v > 1.3 ? "restrictiva" : v >= 0.5 ? "dentro del rango neutral" : v >= 0 ? "levemente expansiva" : "expansiva";
    return { titulo: `Tasa real de la Fed en ${nf(v)}%: política ${lectura}`,
      sub: `Tasa de fondos federales menos inflación core PCE interanual. El título usa la tasa al ${fw(fu[0])} y la inflación de ${fm(last(c)[0])}; el gráfico, promedios mensuales. La tasa neutral no se observa: se estima. La proyección de largo plazo de la propia Fed (tasa nominal cerca de 3% menos la meta de 2%) da cerca de 1%, y los modelos de la Fed de Nueva York la ubican entre 0,5% y 1,3%. Por eso se muestra un rango y no un número.`,
      banda: [0.5, 1.3], bandaTexto: "Rango de estimaciones de la tasa neutral real (0,5% a 1,3%)",
      series: [{ n: "Tasa real de la Fed", d: cut(r), c: 0, area: true }], refs: [{ y: 0 }] };
  } });
def("hipotecaria", { slug: "spread-hipotecario", nombre: "Tasa hipotecaria y spread", sin: ["hipoteca", "mortgage", "freddie mac", "vivienda"],
  calc: "Tasa hipotecaria fija a 30 años de la encuesta semanal de Freddie Mac (se publica los jueves) menos Treasury a 10 años del mismo día. Con períodos de más de 5 años, promedios mensuales. Fuentes diarias como Mortgage News Daily suelen dar valores algo más altos: miden las tasas ofrecidas cada día, no el promedio de la encuesta semanal.",
  ks: ["mortgage30", "ust10"],
  f: () => {
    const m = SD("mortgage30"), t = SD("ust10"); if (!m || !t) return null;
    const sp = join(m, t, (a, b) => a - b), rn = rangoNormal(join(S("mortgage30"), S("ust10"), (a, b) => a - b));
    return { freq: freqD("mortgage30"), titulo: `Hipotecaria a 30 años en ${nf(last(m)[1], 2)}% (Freddie Mac, semana al ${fw(last(m)[0])}), ${nf(last(sp)[1], 2)} pp sobre el Treasury a 10 años`,
      sub: rn ? `El spread normal 2000-19 va de ${nf(rn[0], 1)} a ${nf(rn[1], 1)} pp: por encima, el crédito hipotecario está caro respecto de los bonos.` : "Spread entre la tasa hipotecaria y el Treasury a 10 años.",
      unidad: "pp", dec: 2, banda: rn, series: [{ n: "Spread hipotecaria − Treasury 10 años", d: cut(sp), c: 1 }] };
  } });
def("nfci", { slug: "condiciones-financieras", nombre: "Condiciones financieras (NFCI)", sin: ["nfci", "condiciones financieras", "spreads", "crédito", "chicago fed"],
  calc: "Índice nacional de condiciones financieras de la Fed de Chicago y su subíndice de crédito, promedio mensual. Cero es el promedio histórico; positivo, más restrictivo; negativo, más laxo.",
  ks: ["nfci", "nfci_credit"],
  f: () => {
    const n = SD("nfci"), c = SD("nfci_credit"); if (!n) return null;
    const v = last(n)[1];
    const ss = [{ n: "NFCI", d: cut(n), c: 0, w: 2.6, dec: 2 }];
    if (c) ss.push({ n: "Subíndice de crédito", d: cut(c), c: 1, dec: 2 });
    return { titulo: `Condiciones financieras ${v < 0 ? "más laxas" : "más restrictivas"} que el promedio: NFCI en ${nf(v, 2)}`,
      sub: "Resume más de 100 indicadores de riesgo, crédito y apalancamiento. Por encima de cero, el sistema financiero frena a la economía; por debajo, la empuja." + notaParcial(),
      freq: freqD("nfci"), unidad: "", dec: 2, series: ss, refs: [{ y: 0, l: "Promedio histórico (0)" }] };
  } });
def("spreads", { slug: "spreads-de-credito", nombre: "Spreads de crédito corporativo", sin: ["spreads", "high yield", "baa", "crédito corporativo", "riesgo corporativo"],
  calc: "Rendimiento de los bonos corporativos Baa de Moody's menos el Treasury a 10 años, y spread ajustado por opciones del índice high yield de ICE BofA (FRED publica sólo sus últimos 3 años). Promedios mensuales.",
  ks: ["baa_spread", "hy_oas"],
  f: () => {
    const b = SD("baa_spread"), h = SD("hy_oas"); if (!b && !h) return null;
    const ss = [];
    if (b) ss.push({ n: "Baa − Treasury 10 años", d: cut(b), c: 0, w: 2.6 });
    if (h) ss.push({ n: "High yield (ICE BofA)", d: cut(h), c: 1 });
    return { titulo: b ? `El spread corporativo Baa está en ${nf(last(b)[1], 2)} pp: percentil ${pctl(b, last(b)[1])} desde 2000` : `Spread high yield en ${nf(last(h)[1], 2)} pp`,
      sub: "Lo que paga de más una empresa respecto del Tesoro. Spreads bajos: el mercado presta sin pedir compensación por riesgo. Cuando se abren rápido, suele anticipar un freno de la economía." + notaParcial(),
      freq: freqD("baa_spread"), unidad: "pp", dec: 2, banda: b ? rangoNormal(S("baa_spread")) : null, bandaTexto: "Rango normal Baa 2000-19", series: ss };
  } });
def("hyCalidad", { slug: "high-yield-por-calidad", nombre: "High yield por calidad: BB contra CCC", sin: ["ccc", "bb", "junk", "basura", "high yield", "descompresión", "estrés de crédito"],
  calc: "Spreads ajustados por opciones de los índices ICE BofA de high yield BB (el tramo de mejor calidad) y CCC y menor (el peor crédito que todavía se financia en el mercado). FRED publica sólo sus últimos 3 años.",
  ks: ["hy_bb", "hy_ccc", "hy_oas"],
  f: () => {
    const bb = SD("hy_bb"), ccc = SD("hy_ccc"), h = SD("hy_oas"); if (!bb || !ccc) return null;
    const r = join(ccc, bb, (a, b) => a / b); if (!r) return null;
    const v = last(r)[1], m = r.reduce((x, p) => x + p[1], 0) / r.length;
    const ss = [{ n: "CCC y menor", d: cut(ccc), c: 1, w: 2.6 }];
    if (h) ss.push({ n: "High yield total", d: cut(h), c: 2 });
    ss.push({ n: "BB", d: cut(bb), c: 0 });
    return { freq: freqD("hy_ccc"), titulo: `El crédito CCC paga ${nf(last(ccc)[1], 2)} pp sobre el Tesoro y el BB ${nf(last(bb)[1], 2)} pp: el CCC rinde ${nf(v, 1)} veces el spread del BB (promedio de 3 años: ${nf(m, 1)} veces)`,
      sub: "El índice high yield total hoy tiene más peso de BB, así que tarda en reflejar el estrés. El primer movimiento aparece en el CCC: si su spread sube mientras el BB no se mueve, el mercado empieza a castigar al peor crédito. Sólo 3 años de historia en FRED.",
      unidad: "pp", dec: 2, series: ss };
  } });
def("balanceFed", { slug: "balance-de-la-fed", nombre: "Balance de la Fed y reservas bancarias", sin: ["qt", "qe", "balance", "reservas", "liquidez", "h.4.1"],
  calc: "Activos totales de la Reserva Federal y reservas de los bancos depositadas en la Fed (Fed, H.4.1), promedio mensual de datos semanales, en billones de US$.",
  ks: ["fed_assets", "reserves", "gdp_nom"],
  f: () => {
    const a = escala(SD("fed_assets"), 1e-6), r = escala(SD("reserves"), 1e-6); if (!a) return null;
    const pico = Math.max(...a.map(p => p[1])), g = S("gdp_nom");
    const pbi = g ? ` Equivale a ${nf(last(a)[1] * 1000 / last(g)[1] * 100, 0)}% del PBI.` : "";
    const ss = [{ n: "Activos totales", d: cut(a), c: 0, area: true, w: 2.6 }];
    if (r) ss.push({ n: "Reservas bancarias", d: cut(r), c: 2 });
    return { titulo: `La Fed tiene activos por US$ ${nf(last(a)[1], 2)} billones, ${nf((1 - last(a)[1] / pico) * 100, 0)}% menos que en su pico`,
      sub: "Billones de US$. Cuando la Fed achica su balance retira liquidez del sistema; las reservas bancarias muestran cuánto margen queda antes de que se tense el mercado de dinero." + pbi,
      freq: freqD("fed_assets"), unidad: "billones", dec: 2, series: ss };
  } });

// ═════════════════════════ Externo ═════════════════════════ ═════════════════════════
def("balanza", { slug: "balanza-comercial", nombre: "Balanza comercial", sin: ["comercio exterior", "déficit comercial", "importaciones", "exportaciones", "aranceles"], ops: [ESCALA_PBI],
  calc: "Balanza de bienes y servicios (BEA y Census), mensual. En % del PBI: saldo mensual anualizado (× 12) sobre el PBI nominal del trimestre.",
  ks: ["trade_balance", "gdp_nom"],
  f: o => {
    const b0 = S("trade_balance"); if (!b0) return null;
    const pbi = o.escala === "pbi";
    const b = pbi ? joinQ(b0, S("gdp_nom"), (x, g) => x * 12 / 1000 / g * 100) : escala(b0, 1 / 1000); if (!b) return null;
    const s = cut(b), m3 = cut(roll(b, 3));
    const v = last(s)[1], m12 = s.slice(-13, -1).reduce((x, y) => x + y[1], 0) / Math.min(12, s.length - 1);
    return { titulo: pbi ? `Déficit comercial de ${nf(-v, 1)}% del PBI en ${fechaDe(s)}, contra ${nf(-m12, 1)}% de promedio en 12 meses`
        : `Déficit comercial de US$ ${nf(-v, 1)} mil M en ${fechaDe(s)}, contra ${nf(-m12, 1)} de promedio en 12 meses`,
      sub: pbi ? "Saldo mensual anualizado como % del PBI nominal: permite comparar a lo largo del tiempo." : "Balanza de bienes y servicios, en miles de millones de US$ por mes.",
      unidad: pbi ? "%" : "mil M", dec: 1, decEje: pbi ? 1 : 0, cero: true, eventos: false, sinRecorte: true,
      series: [{ n: "Balanza del mes", d: s, t: "bar", c: 1 }, { n: "Promedio 3 meses", d: m3, c: 0, w: 2.2 }], refs: [{ y: 0 }] };
  } });
def("expoImpo", { slug: "exportaciones-e-importaciones", nombre: "Exportaciones e importaciones", sin: ["exportaciones", "importaciones", "comercio", "aranceles", "adelantamiento"], ops: [VISTA_M],
  calc: "Exportaciones e importaciones de bienes y servicios (BEA y Census), base balanza de pagos, nominales y desestacionalizadas.",
  ks: ["exports", "imports"],
  f: o => {
    const e = S("exports"), i = S("imports"); if (!e || !i) return null;
    const ve = vista(e, o.vista), vi = vista(i, o.vista);
    return { titulo: `Exportaciones ${sg(last(ve)[1], decV(o))}% e importaciones ${sg(last(vi)[1], decV(o))}% ${VT[o.vista]} en ${fechaDe(ve)}`,
      sub: "Nominales. Cuando las importaciones se adelantan a una suba de aranceles, restan en el PBI por exportaciones netas y suman casi lo mismo en inventarios: el efecto neto es menor de lo que parece.",
      dec: decV(o), series: seriesVista([["Exportaciones", e, 0], ["Importaciones", i, 1]], o), refs: [{ y: 0 }] };
  } });
def("cuentaCorriente", { slug: "cuenta-corriente", nombre: "Cuenta corriente / PBI", sin: ["cuenta corriente", "current account", "balanza de pagos", "financiamiento externo"],
  calc: "Saldo de la cuenta corriente de la balanza de pagos (BEA), trimestral, anualizado (× 4) sobre el PBI nominal.",
  ks: ["current_account", "gdp_nom"],
  f: () => {
    const r = join(S("current_account"), S("gdp_nom"), (a, b) => a * 4 / 1000 / b * 100); if (!r) return null;
    const v = last(r)[1];
    return { freq: "Q", titulo: `${v < 0 ? "Déficit" : "Superávit"} de cuenta corriente de ${nf(Math.abs(v))}% del PBI en ${fq(last(r)[0])}`,
      sub: "Bienes, servicios, rentas y transferencias con el resto del mundo. El déficit se financia con capital del exterior: es lo que el mundo le presta o invierte en EE.UU. cada año.",
      banda: rangoNormal(r), series: [{ n: "Cuenta corriente / PBI", d: cut(r), c: 1, area: true }], refs: [{ y: 0 }] };
  } });
def("capexImport", { slug: "importaciones-de-capital", nombre: "Importaciones de capital vs inversión tecnológica", sin: ["importaciones", "equipos"],
  calc: "Variación interanual de las importaciones de bienes de capital sin autos y de la inversión en equipos de información más software (BEA).",
  ks: ["imp_capital", "inv_info", "inv_software"],
  f: () => {
    const i = S("imp_capital"), e = S("inv_info"), s = S("inv_software"); if (!i || !e || !s) return null;
    const iq = yoy(i, 4), cq = yoy(join(e, s, (a, b) => a + b), 4); if (!iq || !cq) return null;
    return { freq: "Q", titulo: `Importaciones de capital ${sg(last(iq)[1])}% vs inversión tecnológica ${sg(last(cq)[1])}% interanual`,
      sub: "Si crecen juntas, parte del boom de inversión se abastece afuera y resta en la balanza comercial.", fuenteTxt: "BEA vía FRED",
      series: [{ n: "Inversión tecnológica", d: cut(cq), c: 0 }, { n: "Importaciones de bienes de capital", d: cut(iq), c: 1 }], refs: [{ y: 0 }] };
  } });
def("dolar", { slug: "dolar", nombre: "Dólar multilateral", sin: ["dxy", "tipo de cambio", "usd", "dólar amplio", "broad dollar", "multilateral"],
  calc: "Índice del dólar contra las monedas de los 26 principales socios comerciales, ponderadas por comercio (Fed, índice broad nominal), promedio mensual.",
  ks: ["dollar"],
  f: () => {
    const d = SD("dollar"); if (!d) return null;
    const y = yoy(S("dollar")), v = last(d)[1];
    return { titulo: `El dólar multilateral ${last(y)[1] >= 0 ? "sube" : "cae"} ${nf(Math.abs(last(y)[1]))}% interanual: percentil ${pctl(d, v)} desde 2006`,
      sub: `Dólar contra las monedas de los 26 principales socios comerciales de EE.UU., ponderadas por comercio (índice broad de la Fed), ${txtFrec("dollar")}. A diferencia del DXY, que pesa casi 60% el euro, incluye China, México y Canadá.` + notaParcial(),
      freq: freqD("dollar"), unidad: "", dec: 1, series: [{ n: "Dólar multilateral", d: cut(d), c: 0 }] };
  } });
def("terminos", { slug: "terminos-de-intercambio", nombre: "Términos de intercambio", sin: ["términos de intercambio", "precios de exportación", "precios de importación"],
  calc: "Índice de precios de exportación sobre índice de precios de importación (BLS), base 2000 = 100. Sube cuando lo que EE.UU. vende al mundo se encarece respecto de lo que compra.",
  ks: ["export_prices", "import_prices"],
  f: () => {
    const r = join(S("export_prices"), S("import_prices"), (a, b) => a / b * 100); if (!r) return null;
    const y = yoy(r), v = last(y)[1];
    return { titulo: `Los términos de intercambio ${Math.abs(v) < 0.5 ? "se mantienen estables" : v > 0 ? "mejoran" : "empeoran"}: ${sg(v)}% interanual`,
      sub: "Precios de exportación sobre precios de importación, 2000 = 100. Con la producción de petróleo y gas de EE.UU., la energía cara ya no empeora sus términos de intercambio como antes.",
      unidad: "", dec: 1, series: [{ n: "Términos de intercambio", d: cut(r), c: 0 }], refs: [{ y: 100, l: "2000 = 100" }] };
  } });

// ═════════════════════════ Fiscal ═════════════════════════
export const deficitPBI = () => joinQ(roll(S("deficit"), 12, true), S("gdp_nom"), (a, b) => a / 1000 / b * 100);
export const interesesPBI = () => join(S("interest_fed"), S("gdp_nom"), (a, b) => a / b * 100);
def("deficit", { slug: "deficit-fiscal", nombre: "Resultado fiscal total y primario", sin: ["déficit", "fiscal", "primario", "tesoro"],
  calc: "Resultado del gobierno federal acumulado 12 meses (Monthly Treasury Statement) sobre PBI nominal. El primario suma los intereses pagados (BEA, trimestral) como % del PBI.",
  ks: ["deficit", "gdp_nom", "interest_fed"],
  f: () => {
    const r = deficitPBI(); if (!r) return null;
    const i = interesesPBI(), prim = i ? joinQ(r, i, (a, b) => a + b) : null;
    const v = last(r)[1];
    const ss = [{ n: "Resultado total", d: cut(r), c: 1, area: true }];
    if (prim) ss.push({ n: "Resultado primario (sin intereses)", d: cut(prim), c: 0, w: 2 });
    return { titulo: (v < 0 ? `Déficit fiscal de ${nf(-v)}% del PBI en 12 meses` : `Superávit fiscal de ${nf(v)}% del PBI en 12 meses`) + (prim ? `; sin intereses, ${last(prim)[1] < 0 ? "déficit" : "superávit"} de ${nf(Math.abs(last(prim)[1]))}%` : ""),
      sub: "Negativo = déficit. La distancia entre las dos líneas es el costo de los intereses de la deuda.", banda: rangoNormal(r), bandaTexto: "Rango normal del total 2000-19",
      series: ss, refs: [{ y: 0 }] };
  } });
def("ingresosGastos", { slug: "ingresos-y-gastos-federales", nombre: "Ingresos y gastos del gobierno federal / PBI", sin: ["gasto público", "recaudación", "ingresos fiscales", "gasto federal"],
  calc: "Ingresos corrientes y gastos corrientes del gobierno federal (BEA, cuentas nacionales, tasa anual desestacionalizada) sobre PBI nominal.",
  ks: ["fed_receipts", "fed_expend", "gdp_nom"],
  f: () => {
    const g = S("gdp_nom"), rp = join(S("fed_receipts"), g, (a, b) => a / b * 100), ep = join(S("fed_expend"), g, (a, b) => a / b * 100); if (!rp || !ep) return null;
    return { freq: "Q", titulo: `El gobierno federal gasta ${nf(last(ep)[1])}% del PBI y recauda ${nf(last(rp)[1])}%`,
      sub: "Cuentas nacionales: gasto corriente (incluye intereses, no la inversión pública). La distancia entre las dos líneas es el déficit corriente; muestra si el déficit viene por más gasto o por menos recaudación.",
      series: [{ n: "Gastos", d: cut(ep), c: 1, w: 2.6 }, { n: "Ingresos", d: cut(rp), c: 0, w: 2.6 }], shock: [T(2020, 3), T(2021, 6)] };
  } });
def("intereses", { slug: "intereses-de-la-deuda", nombre: "Intereses de la deuda / PBI", sin: ["intereses", "costo de la deuda"],
  calc: "Intereses pagados por el gobierno federal (BEA) sobre PBI nominal.",
  ks: ["interest_fed", "gdp_nom", "fed_receipts"],
  f: () => {
    const r = interesesPBI(); if (!r) return null;
    const v = last(r)[1], max = Math.max(...r.map(p => p[1])), fmax = r.find(p => p[1] === max)[0];
    const rec = join(S("interest_fed"), S("fed_receipts"), (a, b) => a / b * 100);
    return { freq: "Q", titulo: `Los intereses de la deuda federal cuestan ${nf(v, 2)}% del PBI` + (rec ? ` y se llevan ${nf(last(rec)[1], 0)}% de la recaudación` : ""),
      sub: `Intereses pagados por el gobierno federal sobre PBI nominal. Máximo de la serie: ${nf(max, 2)}% (${fq(fmax)}).`, dec: 2, series: [{ n: "Intereses / PBI", d: cut(r), c: 1 }] };
  } });
def("deuda", { slug: "deuda-publica", nombre: "Deuda federal en manos del público / PBI", sin: ["deuda", "debt", "deuda pública"],
  calc: "Deuda federal en manos del público (excluye la que el Tesoro le debe a fondos del propio gobierno, como la seguridad social) sobre PBI (Tesoro y Fed de St. Louis).",
  ks: ["debt_public", "debt_gdp"],
  f: () => {
    const d = S("debt_public"), t = S("debt_gdp");
    if (!d && t) return { freq: "Q", titulo: `Deuda pública federal total en ${nf(last(t)[1], 0)}% del PBI`, sub: "Incluye la deuda que el Tesoro tiene con fondos del propio gobierno (seguridad social).", dec: 0, series: [{ n: "Deuda total / PBI", d: cut(t), c: 0 }] };
    if (!d) return null;
    return { freq: "Q", titulo: `La deuda federal en manos del público llega al ${nf(last(d)[1], 0)}% del PBI`,
      sub: "Excluye la deuda que el Tesoro tiene con fondos del propio gobierno (seguridad social)." + (t ? ` Con ella, la deuda total es ${nf(last(t)[1], 0)}% del PBI.` : ""),
      dec: 0, series: [{ n: "Deuda en manos del público / PBI", d: cut(d), c: 0 }] };
  } });

def("nominalTasa", { slug: "pbi-nominal-vs-tasa", nombre: "PBI nominal vs tasa a 10 años", sin: ["r vs g", "sostenibilidad de la deuda"],
  calc: "Variación interanual del PBI nominal (BEA) contra el Treasury a 10 años promedio del trimestre.",
  ks: ["gdp_nom", "ust10"],
  f: () => {
    const n = yoy(S("gdp_nom"), 4), t = toQ(S("ust10")); if (!n || !t) return null;
    const tt = join(n, t, (a, b) => b), d = last(n)[1] - last(tt)[1];
    return { freq: "Q", titulo: d > 0 ? `El PBI nominal crece ${nf(d)} pp por encima de la tasa a 10 años` : `La tasa a 10 años supera al PBI nominal por ${nf(-d)} pp`,
      sub: "Si el nominal corre por encima del costo de financiamiento, la deuda se licúa como % del PBI.", fuenteTxt: "BEA y Tesoro de EE.UU. vía FRED",
      series: [{ n: "PBI nominal, interanual", d: cut(n), c: 1 }, { n: "Treasury 10 años", d: cut(tt), c: 0 }], shock: [T(2020, 3), T(2022, 6)] };
  } });

def("aranceles", { slug: "aranceles", nombre: "Aranceles: tasa efectiva y recaudación", sin: ["aranceles", "tariffs", "customs", "derechos de importación", "tasa arancelaria"],
  calc: "Derechos de importación cobrados por el gobierno federal (BEA, tasa anual) sobre importaciones de bienes (BEA, cuentas nacionales): la tasa arancelaria efectiva.",
  ks: ["customs", "imp_goods"],
  f: () => {
    const c = S("customs"), t = join(c, S("imp_goods"), (a, b) => a / b * 100); if (!t) return null;
    return { freq: "Q", titulo: `La tasa arancelaria efectiva es ${nf(last(t)[1])}% y la recaudación por aranceles llega a US$ ${nf(last(c)[1], 0)} mil M por año`,
      sub: "Aranceles cobrados sobre el valor de los bienes importados, trimestral. Es la tasa que efectivamente se paga, no la anunciada: descuenta exenciones, cambios de proveedor y demoras en el cobro.",
      cero: true, series: [{ n: "Tasa arancelaria efectiva", d: cut(t), c: 1, area: true }] };
  } });

// ═════════════════════════ Organización por frente ═════════════════════════
export const BLOQUES = {
  actividad: [["¿Cuánto crece y qué lo empuja?", [["contribuciones", "ancha"], ["gdpnow"], ["demandaPrivada"]]],
    ["¿Está por encima o por debajo de su potencial?", [["brecha"], ["productividad"]]],
    ["¿Qué dicen los datos del mes?", [["encuestas"], ["industria"], ["ordenes"], ["viviendas"]]],
    ["¿Dónde está el ciclo de inversión y ganancias?", [["capex"], ["ganancias"], ["pbiGdi", "ancha"]]]],
  consumidor: [["¿Cuánto gasta?", [["ventas"], ["consumoTipo"], ["autos"], ["sentimiento"]]],
    ["¿Con qué lo paga?", [["ingresoConsumo"], ["motores"], ["ahorro"], ["credito"]]],
    ["¿Cuánto aguanta?", [["riqueza"], ["servicioDeuda"], ["morosidad", "ancha"]]]],
  precios: [["¿Dónde está la inflación y hacia dónde va?", [["pce"], ["momentum"], ["subyacente", "ancha"]]],
    ["¿Es amplia o concentrada?", [["heat", "ancha alta"], ["difusion"], ["serviciosBienes"]]],
    ["¿Qué viene por la cañería?", [["ppi"], ["bienesCore"]]],
    ["Componentes y otras medidas", [["cpiPce"], ["vivienda"], ["componentes"], ["energia"], ["expectativas", "ancha"]]]],
  empleo: [["¿Cuánto empleo se crea y dónde?", [["nominas", "ancha"], ["composicion"], ["desempleo"]]],
    ["¿Qué tan ajustado está el mercado?", [["sahm"], ["tension"], ["rotacion"], ["epop"]]],
    ["¿Los salarios son compatibles con 2% de inflación?", [["salarioReal"], ["eci"]]],
    ["Señales semanales", [["pedidos"], ["continuos"]]]],
  tasas: [["¿Qué forma tiene la curva?", [["curvaTesoro", "ancha"], ["curva"], ["pendiente"]]],
    ["¿Qué hace y qué se espera de la Fed?", [["politica"], ["descuenta"], ["balanceFed", "ancha"]]],
    ["¿Qué hay detrás de la tasa larga?", [["tasaReal"], ["primaPlazo"]]],
    ["¿Cómo están el crédito y las condiciones financieras?", [["spreads"], ["hyCalidad"], ["nfci"], ["hipotecaria"]]]],
  externo: [["¿Cuánto le compra y le vende al mundo?", [["balanza", "ancha"], ["expoImpo"], ["cuentaCorriente"]]],
    ["Precios, moneda e inversión", [["dolar"], ["terminos"], ["capexImport", "ancha"]]]],
  fiscal: [["¿Cuánto gasta, cuánto recauda y cuánto pide prestado?", [["deficit", "ancha"], ["ingresosGastos"], ["aranceles"]]],
    ["¿Cuánto cuesta la deuda y es sostenible?", [["intereses"], ["deuda"], ["nominalTasa", "ancha"]]]],
};
export const PREGUNTAS_CICLO = [["brecha", "ancha"], ["heat", "ancha alta"], ["composicion"], ["politica"]];
for (const [f, bloques] of Object.entries(BLOQUES)) for (const [, lista] of bloques) for (const [id] of lista) CAT[id].frente = f;
export const porSlug = s => Object.values(CAT).find(c => c.slug === s);
export const defaultsDe = id => Object.fromEntries((CAT[id].ops || []).map(op => [op.id, op.valores[0][0]]));

// Arma el gráfico con sus opciones; agrega fuente y datos comunes
export function armar(id, o = {}) {
  const c = CAT[id]; if (!c) return null;
  const oo = Object.assign(defaultsDe(id), o);
  let sp = null;
  try { sp = c.f(oo); } catch (e) { console.error(id, e); }
  if (!sp) return null;
  sp.id = id; sp.o = oo; sp.ks = c.ks.filter(k => ST.DATA.series[k]);
  sp.fuente = sp.fuenteTxt || fuente(...sp.ks);
  const real = (c.ops || []).find(op => op.id === "real");
  if (real && oo.real === "r") sp.sub += ` Vista real ${DEFL_TXT[real.defl]}.`;
  return sp;
}

// ═════════════════════════ Indicadores (tiles, cabeceras y tablero) ═════════════════════════
// Serie diaria equivalente a un indicador (para comparar el último cierre contra el de un mes antes)
function diarioDe(ind) {
  const D = ST.D; if (!D) return null;
  if (typeof ind.ultD === "string") return D[ind.ultD];
  if (ind.id === "ust2") return D.ust2;
  if (ind.id === "ust10") return D.ust10;
  if (ind.id === "curva") return join(D.ust10, D.ust2, (a, b) => (a - b) * 100);
  if (ind.id === "descuenta") return join(D.ust2, D.fed_funds, (a, b) => (a - b) * 100);
  return null;
}
const valorEnD = (a, t) => { let r = null; for (let i = a.length - 1; i >= 0; i--) if (a[i][0] <= t) { r = a[i][1]; break; } return r; };
const ult_diario = plazo => { const c = ST.DATA.curva && ST.DATA.curva[plazo]; return c && c.length ? [P(c[c.length - 1][0]), c[c.length - 1][1]] : null; };
export const IND = [
  { id: "pbi", f: "actividad", n: "PBI real", nota: "t/t anualizado", u: "%", d: 1, q: true, ks: ["gdp_growth"], g: "contribuciones", s: () => S("gdp_growth") },
  { id: "gdpnow", f: "actividad", n: "GDPNow", nota: "estimación del trimestre", u: "%", d: 1, q: true, ks: ["gdpnow"], g: "gdpnow", s: () => S("gdpnow") },
  { id: "brecha", f: "actividad", n: "Brecha del producto", nota: "% del potencial (CBO)", u: "%", d: 1, q: true, ks: ["gdp_real", "gdp_pot"], g: "brecha", s: () => join(S("gdp_real"), S("gdp_pot"), (a, c) => (a / c - 1) * 100) },
  { id: "demanda", f: "actividad", n: "Demanda privada final", nota: "interanual real", u: "%", d: 1, q: true, ks: ["final_sales_priv"], g: "demandaPrivada", s: () => yoy(S("final_sales_priv"), 4) },
  { id: "indpro", f: "actividad", n: "Producción industrial", nota: "interanual", u: "%", d: 1, ks: ["indpro"], g: "industria", s: () => yoy(S("indpro")) },
  { id: "retail", f: "consumidor", n: "Ventas minoristas", nota: "interanual nominal", u: "%", d: 1, ks: ["retail"], g: "ventas", s: () => yoy(S("retail")) },
  { id: "ordenes", f: "actividad", n: "Órdenes de capital", nota: "interanual, sin defensa ni aviones", u: "%", d: 1, ks: ["core_orders"], g: "ordenes", s: () => yoy(S("core_orders")) },
  { id: "viviendas", f: "actividad", n: "Inicios de viviendas", nota: "miles por año", u: "mil", d: 0, ks: ["housing_starts"], g: "viviendas", s: () => S("housing_starts") },
  { id: "consumo", f: "consumidor", n: "Consumo real", nota: "interanual", u: "%", d: 1, ks: ["pce_real"], g: "consumoTipo", s: () => yoy(S("pce_real")) },
  { id: "ingreso", f: "consumidor", n: "Ingreso disponible real", nota: "interanual", u: "%", d: 1, ks: ["dpi_real"], g: "ingresoConsumo", s: () => yoy(S("dpi_real")) },
  { id: "ahorro", f: "consumidor", n: "Tasa de ahorro", nota: "% del ingreso disponible", u: "%", d: 1, ks: ["saving_rate"], g: "ahorro", s: () => S("saving_rate") },
  { id: "morosidad", f: "consumidor", n: "Morosidad de tarjetas", nota: "% de los préstamos", u: "%", d: 2, q: true, ks: ["delinq_cards"], g: "morosidad", s: () => S("delinq_cards") },
  { id: "confianza", f: "consumidor", n: "Confianza del consumidor", nota: "índice U. de Michigan", u: "", d: 1, ks: ["sentiment"], g: "sentimiento", s: () => S("sentiment") },
  { id: "core", f: "precios", n: "Core PCE", nota: "interanual", u: "%", d: 1, ks: ["pce_core"], g: "pce", s: () => yoy(S("pce_core")) },
  { id: "core3", f: "precios", n: "Core PCE, 3 meses", nota: "anualizado", u: "%", d: 1, ks: ["pce_core"], g: "momentum", s: () => ann(S("pce_core"), 3) },
  { id: "pce", f: "precios", n: "PCE general", nota: "interanual", u: "%", d: 1, ks: ["pce_p"], g: "pce", s: () => yoy(S("pce_p")) },
  { id: "cpicore", f: "precios", n: "CPI core", nota: "interanual", u: "%", d: 1, ks: ["cpi_core"], g: "cpiPce", s: () => yoy(S("cpi_core")) },
  { id: "ppi", f: "precios", n: "PPI demanda final", nota: "interanual", u: "%", d: 1, ks: ["ppi_fd"], g: "ppi", s: () => yoy(S("ppi_fd")) },
  { id: "exp5", ultD: "infl_exp_5y5y", f: "precios", n: "Inflación esperada 5y5y", nota: "mercado, largo plazo", u: "%", d: 2, ks: ["infl_exp_5y5y"], g: "expectativas", s: () => S("infl_exp_5y5y") },
  { id: "exp1", f: "precios", n: "Inflación esperada 1 año", nota: "hogares, U. de Michigan", u: "%", d: 1, ks: ["infl_exp_1y"], g: "expectativas", s: () => S("infl_exp_1y") },
  { id: "nominas", f: "empleo", n: "Nóminas", nota: "miles por mes, prom. 3m", u: "mil", d: 0, ks: ["payrolls"], g: "nominas", s: () => roll(diff(S("payrolls")), 3) },
  { id: "desempleo", f: "empleo", n: "Desempleo", nota: "% de la fuerza laboral", u: "%", d: 1, ks: ["unemployment"], g: "desempleo", s: () => S("unemployment") },
  { id: "sahm", f: "empleo", n: "Regla de Sahm", nota: "umbral de recesión 0,5", u: "pp", d: 2, ks: ["sahm"], g: "sahm", s: () => S("sahm") },
  { id: "tension", f: "empleo", n: "Vacantes por desocupado", nota: "JOLTS / desocupados", u: "", d: 2, ks: ["openings", "unemployed"], g: "tension", s: () => join(S("openings"), S("unemployed"), (a, b) => a / b) },
  { id: "contrataciones", f: "empleo", n: "Tasa de contrataciones", nota: "% del empleo por mes, JOLTS", u: "%", d: 1, ks: ["hires"], g: "rotacion", s: () => S("hires") },
  { id: "salario", f: "empleo", n: "Salario horario", nota: "interanual", u: "%", d: 1, ks: ["ahe"], g: "salarioReal", s: () => yoy(S("ahe")) },
  { id: "eci", f: "empleo", n: "ECI salarios", nota: "interanual", u: "%", d: 1, q: true, ks: ["eci"], g: "eci", s: () => yoy(S("eci"), 4) },
  { id: "pedidos", f: "empleo", n: "Pedidos de desempleo", nota: "miles, promedio 4 semanas", u: "mil", d: 0, w: true, ks: ["claims"], g: "pedidos", s: () => roll(escala(S("claims"), 1 / 1000), 4) },
  { id: "fed", f: "tasas", n: "Fondos federales", nota: "tasa efectiva, último dato", ultD: "fed_funds", u: "%", d: 2, ks: ["fed_funds"], g: "curva", s: () => S("fed_funds") },
  { id: "ust2", f: "tasas", n: "Treasury 2 años", nota: "último cierre", u: "%", d: 2, ks: ["ust2"], g: "curvaTesoro", diario: "2A", s: () => S("ust2") },
  { id: "ust10", f: "tasas", n: "Treasury 10 años", nota: "último cierre", u: "%", d: 2, ks: ["ust10"], g: "curvaTesoro", diario: "10A", s: () => S("ust10") },
  { id: "tips", f: "tasas", n: "Tasa real 10 años", nota: "TIPS, último cierre", ultD: "tips10", u: "%", d: 2, ks: ["tips10"], g: "tasaReal", s: () => S("tips10") },
  { id: "curva", f: "tasas", n: "Curva 10-2", nota: "puntos básicos, último cierre", u: "pb", d: 0, ks: ["ust10"], g: "pendiente", diario: ["10A", "2A"], s: () => join(S("ust10"), S("ust2"), (a, b) => (a - b) * 100) },
  { id: "prima", ultD: "term_premium", f: "tasas", n: "Prima por plazo 10 años", nota: "Kim-Wright", u: "%", d: 2, ks: ["term_premium"], g: "primaPlazo", s: () => S("term_premium") },
  { id: "nfci", f: "tasas", n: "Condiciones financieras", nota: "NFCI semanal, 0 = promedio", ultD: "nfci", u: "", d: 2, ks: ["nfci"], g: "nfci", s: () => S("nfci") },
  { id: "descuenta", f: "tasas", n: "2 años − Fed", nota: "pb, último cierre; negativo = descuenta recortes", ultD: () => { const a = ST.D.ust2, b = ST.D.fed_funds; return a && b ? [a[a.length - 1][0], (a[a.length - 1][1] - (valorEnD(b, a[a.length - 1][0]) ?? b[b.length - 1][1])) * 100] : null; }, u: "pb", d: 0, ks: ["ust2", "fed_funds"], g: "descuenta", s: () => join(S("ust2"), S("fed_funds"), (a, b) => (a - b) * 100) },
  { id: "baa", f: "tasas", n: "Spread corporativo Baa", nota: "pp sobre el Treasury 10 años, último cierre", ultD: "baa_spread", u: "pp", d: 2, ks: ["baa_spread"], g: "spreads", s: () => S("baa_spread") },
  { id: "hipo", f: "tasas", n: "Hipotecaria 30 años", nota: "Freddie Mac, semanal", ultD: "mortgage30", u: "%", d: 2, ks: ["mortgage30"], g: "hipotecaria", s: () => S("mortgage30") },
  { id: "balanza", f: "externo", n: "Balanza comercial", nota: "US$ mil M por mes, prom. 3m", u: "mil M", d: 1, ks: ["trade_balance"], g: "balanza", s: () => roll(escala(S("trade_balance"), 1 / 1000), 3) },
  { id: "dolar", f: "externo", n: "Dólar multilateral", nota: "interanual", u: "%", d: 1, ks: ["dollar"], g: "dolar", s: () => yoy(S("dollar")) },
  { id: "cc", f: "externo", n: "Cuenta corriente", nota: "% del PBI", u: "%", d: 1, q: true, ks: ["current_account"], g: "cuentaCorriente", s: () => join(S("current_account"), S("gdp_nom"), (a, b) => a * 4 / 1000 / b * 100) },
  { id: "deficit", f: "fiscal", n: "Resultado fiscal", nota: "% del PBI, 12 meses", u: "%", d: 1, ks: ["deficit"], g: "deficit", s: () => deficitPBI() },
  { id: "intereses", f: "fiscal", n: "Intereses de la deuda", nota: "% del PBI", u: "%", d: 2, q: true, ks: ["interest_fed"], g: "intereses", s: () => interesesPBI() },
  { id: "deuda", f: "fiscal", n: "Deuda en manos del público", nota: "% del PBI", u: "%", d: 0, q: true, ks: ["debt_public"], g: "deuda", s: () => S("debt_public") },
  { id: "aranceles", f: "fiscal", n: "Tasa arancelaria efectiva", nota: "aranceles / importaciones de bienes", u: "%", d: 1, q: true, ks: ["customs", "imp_goods"], g: "aranceles", s: () => join(S("customs"), S("imp_goods"), (a, b) => a / b * 100) },
];
export const INDX = Object.fromEntries(IND.map(i => [i.id, i]));
export const RESUMEN_TILES = ["pbi", "gdpnow", "core", "cpicore", "desempleo", "nominas", "sahm", "ahorro", "fed", "ust10", "tips", "curva"];
export const CABECERA_TILES = {
  actividad: ["pbi", "gdpnow", "brecha", "demanda", "indpro", "ordenes"],
  consumidor: ["consumo", "ingreso", "retail", "ahorro", "morosidad", "confianza"],
  precios: ["core", "core3", "cpicore", "ppi", "exp5", "exp1"],
  empleo: ["nominas", "desempleo", "sahm", "tension", "contrataciones", "pedidos"],
  tasas: ["fed", "ust2", "ust10", "curva", "descuenta", "tips"],
  externo: ["balanza", "cc", "dolar"],
  fiscal: ["deficit", "intereses", "deuda", "aranceles"],
};
export function valorInd(ind) {
  let a = null;
  try { a = ind.s(); } catch (e) { a = null; }
  if (!a || !a.length) return null;
  a = a.slice();
  let fechaTxt = null;
  if (ind.diario && ST.T1 === Infinity) {
    // tasas: el último punto pasa a ser el último cierre diario (no el promedio parcial del mes)
    const pl = Array.isArray(ind.diario) ? ind.diario : [ind.diario];
    const xs = pl.map(ult_diario);
    if (xs.every(Boolean)) {
      const v = pl.length === 2 ? (xs[0][1] - xs[1][1]) * 100 : xs[0][1];
      a[a.length - 1] = [a[a.length - 1][0], v];
      fechaTxt = fw(xs[0][0]);
    }
  }
  if (ind.ultD && ST.T1 === Infinity && ST.D && !fechaTxt) {
    // último dato diario o semanal en lugar del promedio del mes
    const u = typeof ind.ultD === "function" ? ind.ultD() : (ST.D[ind.ultD] && ST.D[ind.ultD][ST.D[ind.ultD].length - 1]);
    if (u) { a[a.length - 1] = [a[a.length - 1][0], u[1]]; fechaTxt = fw(u[0]); }
  }
  const [t, v] = last(a), per = ind.q ? 1 : ind.w ? 4 : 3;
  let p = prev(a), cmpTxt = null;
  const dd = fechaTxt ? diarioDe(ind) : null;
  if (dd && dd.length) {
    const u = dd[dd.length - 1], x = valorEn(dd, u[0] - 30 * 864e5);
    if (x) { p = [x[0], x[1]]; cmpTxt = "hace un mes"; }
  }
  const p3 = prev(a, per), p12 = prev(a, ind.q ? 4 : ind.w ? 52 : 12);
  const rn = rangoNormal(a);
  return { a, t, v, fechaTxt, cmpTxt, prev: p ? p[1] : null, cambio: p ? v - p[1] : null, tend: p3 ? v - p3[1] : null, hace12: p12 ? p12[1] : null,
    pctl: pctl(a, v) ?? 50, banda: rn ? [pctl(a, rn[0]), pctl(a, rn[1])] : null };
}
export const fechaInd = (ind, r) => r.fechaTxt || (ind.q ? fq(r.t) : ind.w ? fw(r.t) : fm(r.t));
export function specIndicador(ind) {
  const r = valorInd(ind); if (!r) return null;
  return { id: "ind-" + ind.id, o: {}, titulo: `${ind.n}: ${nf(r.v, ind.d)}${ind.u === "%" ? "%" : ind.u ? " " + ind.u : ""} (${fechaInd(ind, r)}), percentil histórico ${r.pctl}`,
    sub: `${ind.nota[0].toUpperCase()}${ind.nota.slice(1)}. Percentil: posición del último dato en la historia desde 2000.`, ks: ind.ks, freq: ind.q ? "Q" : ind.w ? "W" : "M",
    fuente: fuente(...ind.ks), unidad: ind.u, dec: ind.d, banda: rangoNormal(r.a), series: [{ n: ind.n, d: cut(r.a), c: 0 }] };
}

// ═════════════════════════ Lectura por frente ═════════════════════════
export function lineasLectura() {
  const L = {};
  const intento = (k, f) => { try { const r = f(); if (r) L[k] = r; } catch (e) {} };
  intento("actividad", () => {
    const g = S("gdp_growth"), n = S("gdpnow"), ks = [["c_consumo", "el consumo"], ["c_inversion", "la inversión"], ["c_gobierno", "el gasto público"], ["c_externo", "el sector externo"]];
    const m = ks.map(([k, nm]) => [nm, last(S(k))[1]]).sort((a, b) => b[1] - a[1])[0];
    let t = `El PBI creció ${nf(last(g)[1])}% anualizado en ${fq(last(g)[0])}; lo que más aportó fue ${m[0]} (${sg(m[1])} pp).`;
    if (n && last(n)[0] > last(g)[0]) t += ` Para ${fq(last(n)[0])}, GDPNow estima ${nf(last(n)[1])}%.`;
    return t;
  });
  intento("consumidor", () => {
    const c = yoy(S("pce_real")), i = yoy(S("dpi_real")), s = last(S("saving_rate"))[1];
    return `El consumo real crece ${nf(last(c)[1])}% interanual contra ${nf(last(i)[1])}% del ingreso disponible real; la tasa de ahorro está en ${nf(s)}%.`;
  });
  intento("precios", () => {
    const c = S("pce_core"), y = last(yoy(c))[1], m3 = last(ann(c, 3))[1];
    const rs = rubros(), cal = rs.filter(r => last(r.a3)[1] > 3).length, e = S("infl_exp_5y5y");
    return `El core PCE corre a ${nf(y)}% interanual y ${nf(m3)}% anualizado a 3 meses` + (rs.length ? `; ${cal} de ${rs.length} rubros superan 3%` : "") + (e ? `. El mercado espera ${nf(last(e)[1], 2)}% a largo plazo.` : ".");
  });
  intento("empleo", () => {
    const p = roll(diff(S("payrolls")), 3), u = last(S("unemployment"))[1], sh = S("sahm");
    return `La economía suma ${nf(last(p)[1], 0)} mil puestos por mes en promedio de 3 meses, con desempleo en ${nf(u)}%` + (sh ? ` y la regla de Sahm en ${nf(last(sh)[1], 2)} pp (umbral 0,5).` : ".");
  });
  intento("tasas", () => {
    const r = SD("tips10"), v = last(r)[1], f = last(SD("fed_funds"))[1], c = last(yoy(S("pce_core")))[1];
    return `La tasa real a 10 años está en ${nf(v, 2)}% (percentil ${pctl(r, v)} desde 2003) y la tasa real de la Fed en ${nf(f - c)}%.`;
  });
  intento("externo", () => {
    const b = armar("balanza"), c = armar("cuentaCorriente"); if (!b) return null;
    return b.titulo + "." + (c ? ` ${c.titulo}.` : "");
  });
  intento("fiscal", () => {
    const d = armar("deficit"), i = armar("intereses"); if (!d) return null;
    return d.titulo + "." + (i ? ` ${i.titulo}.` : "");
  });
  return L;
}
