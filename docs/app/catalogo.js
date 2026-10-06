// Catálogo: cada gráfico es una definición (series, fórmula, selectores y cómo se arma su título).
// De acá salen el gráfico, su tabla, su ficha de fuentes, el buscador, los enlaces y la metodología.
import { T, P, MES, nf, sg, fm, fq, fw, fd, esc, unidadTxt } from "./util.js";
import { last, prev, yoy, ann, pct, diff, roll, join, joinQ, joinQUlt, toQ, indice, deflactar, rangoNormal, pctl, escala, racha, valorEn } from "./calc.js";
import { ST, S, SD, freqD, usaDiario, periodoLargo, iniciosFed, cut, fuente, meta, nombreRelease, infoRelease } from "./datos.js";

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
// Proyecciones de la Fed (mediana del SEP) como puntos a fin de cada año (año en curso y el siguiente)
// En el gráfico va sólo la de este año (la del próximo estiraría el eje un año al vacío); el texto menciona las dos
function sepPuntos(k, mes = 11, hasta = 0) {
  const a = S(k); if (!a) return null;
  const y = new Date().getUTCFullYear();
  const pts = a.filter(p => { const yy = new Date(p[0]).getUTCFullYear(); return yy >= y && yy <= y + hasta; }).map(p => [Date.UTC(new Date(p[0]).getUTCFullYear(), mes, 1), p[1]]);
  return pts.length ? pts : null;
}
const sepTxt = (k, dec = 1) => { const p = sepPuntos(k, 11, 1); return p ? p.map(x => `${nf(x[1], dec)}% a fin de ${new Date(x[0]).getUTCFullYear()}`).join(" y ") : ""; };
function def(id, m) { CAT[id] = Object.assign({ id, ops: [] }, m); }

// ═════════════════════════ Actividad ═════════════════════════
const DIA = 864e5;
// Nombre corto de cada publicación, para anotar sobre un gráfico
const CORTOS = [[/Employment Situation/, "Empleo"], [/Retail/, "Ventas"], [/Producer Price/, "PPI"], [/Consumer Price/, "CPI"], [/Job Openings/, "JOLTS"],
  [/^Gross Domestic/, "PBI"], [/Personal Income/, "Ingresos y gastos"], [/G\.17/, "Industria"], [/Residential Construction/, "Viviendas"], [/\(M3\)/, "Órdenes"],
  [/International Trade/, "Comercio"], [/Weekly Claims/, "Pedidos de desempleo"], [/Surveys of Consumers/, "Michigan"], [/Construction Spending/, "Construcción"],
  [/Business Outlook/, "Filadelfia"], [/Empire State/, "Empire"], [/Motor Vehicle/, "Autos"], [/Import and Export/, "Precios de importación"]];
const nombreCorto = n => (CORTOS.find(([re]) => re.test(n)) || [null, nombreRelease(n)])[1];
// Proyección de crecimiento de la Fed como texto (el rombo no va en un gráfico de tasa trimestral)
const sepPBI = () => { const p = sepPuntos("sep_gdp", 9, 1); return p ? ` La Fed proyecta ${p.map(x => `${nf(x[1])}% para ${new Date(x[0]).getUTCFullYear()}`).join(" y ")} (cuarto trimestre contra cuarto trimestre).` : ""; };
def("contribuciones", { slug: "contribuciones-al-pbi", nombre: "Contribuciones al crecimiento del PBI", sin: ["pbi", "gdp", "crecimiento", "motores del pbi", "inventarios"],
  calc: "Contribución de cada componente del gasto al crecimiento real del PBI, en puntos porcentuales de la tasa trimestral anualizada (BEA, tabla 1.1.2). La inversión se separa en fija (fábricas, equipos, software, viviendas) y variación de inventarios, que es ruido de corto plazo. La suma de los cinco es el PBI. La línea punteada es el promedio de 4 trimestres. Hasta 24 trimestres.",
  ks: ["gdp_growth", "c_consumo", "c_fija", "c_inventarios", "c_gobierno", "c_externo", "sep_gdp"],
  f: () => {
    const g = S("gdp_growth"); if (!g) return null;
    const conFija = S("c_fija") && S("c_inventarios");
    const ks = conFija ? [["c_consumo", "Consumo", 0], ["c_fija", "Inversión fija", 1], ["c_inventarios", "Inventarios", "gris"], ["c_gobierno", "Gobierno", 2], ["c_externo", "Export. netas", 3]]
      : [["c_consumo", "Consumo", 0], ["c_inversion", "Inversión", 1], ["c_gobierno", "Gobierno", 2], ["c_externo", "Export. netas", 3]];
    if (ks.some(([k]) => !S(k))) return null;
    const desde = Math.max(ST.T0, g[Math.max(0, g.length - 24)][0]);
    const gg = cut(g, desde), ts = gg.map(p => p[0]), m4 = new Map(roll(g, 4) || []);
    const series = ks.map(([k, n, c]) => { const m = new Map(S(k)); return { n, c, t: "bar", d: ts.map(t => m.get(t) ?? 0), k }; });
    series.push({ n: "PBI real (%)", t: "line", etiquetas: true, d: gg.map(p => p[1]) });
    series.push({ n: "Promedio 4 trimestres", t: "line", c: "ink", w: 1.4, punteada: true, d: ts.map(t => m4.get(t) ?? null) });
    const u = ts.length - 1, val = k => series.find(s => s.k === k)?.d[u] ?? 0;
    const ruido = (conFija ? val("c_inventarios") : 0) + val("c_externo"), nucleo = last(g)[1] - ruido;
    // el componente que más cambió contra el trimestre anterior
    const cambio = series.filter(s => s.k).map(s => ({ n: s.n, a: s.d[u], b: s.d[u - 1] })).filter(x => x.b != null).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))[0];
    const art = { "Consumo": "el consumo", "Inversión fija": "la inversión fija", "Inversión": "la inversión", "Inventarios": "los inventarios", "Gobierno": "el gobierno", "Export. netas": "las exportaciones netas" };
    const quien = cambio ? art[cambio.n] || cambio.n.toLowerCase() : "";
    const giro = cambio ? (Math.sign(cambio.a) !== Math.sign(cambio.b) && Math.abs(cambio.b) >= 0.1 ? `${quien} pasó de ${cambio.b < 0 ? "restar" : "sumar"} a ${cambio.a < 0 ? "restar" : "sumar"}` : `${quien} pasó de ${sg(cambio.b)} a ${sg(cambio.a)} pp`) : "";
    return { tipo: "cat", freq: "Q", titulo: `PBI ${nf(last(g)[1])}% en ${fq(last(g)[0])}: sin inventarios ni exportaciones netas, ${nf(nucleo)}%` + (giro ? `; ${giro}` : ""),
      sub: "Contribuciones al crecimiento, pp de la tasa trimestral anualizada. Los inventarios, en gris, son ruido de corto plazo." + sepPBI(), unidadLinea: "%", cats: ts.map(fq), series };
  } });
def("gdpnow", { slug: "gdpnow", nombre: "GDPNow vs PBI publicado", sin: ["nowcast", "atlanta", "pbi en tiempo real", "gdpnow"],
  calc: "Última estimación del modelo GDPNow de la Fed de Atlanta para cada trimestre, contra el PBI real publicado por BEA (% trimestral anualizado). El movimiento del último mes y el dato que más lo explicó salen del archivo de versiones del modelo (ALFRED, Fed de St. Louis) cruzado con el calendario de publicaciones. El error promedio compara la última estimación de cada trimestre con la primera publicación del PBI.",
  ks: ["gdpnow", "gdp_growth", "gdp_1ra"],
  f: () => {
    const g = S("gdp_growth"), n = S("gdpnow"); if (!g || !n) return null;
    const ult = last(n), pub = last(g), enCurso = ult[0] > pub[0];
    // trimestres visibles: los del período elegido desde que existe el GDPNow
    const desde = Math.max(ST.T0, n[0][0]);
    const ts = [...new Set([...cut(g, desde).map(p => p[0]), ...cut(n, desde).map(p => p[0])])].sort((a, b) => a - b);
    const mg = new Map(g), mn = new Map(n);
    // recorrido del trimestre en curso: movimiento del último mes y el dato que más lo movió
    const rec = ST.DATA.gdpnow_rec || {}, hist = ST.DATA.gdpnow_hist || [];
    const q = new Date(ult[0]).toISOString().slice(0, 10);
    const m = new Map((rec[q] || []).map(([f, v]) => [f, v])); for (const [f, t, v] of hist) if (t === q && !m.has(f)) m.set(f, v);
    const camino = [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([f, v]) => [P(f), v]);
    let mov = "";
    if (enCurso && camino.length > 1) {
      const hace = valorEn(camino, last(camino)[0] - 30 * DIA) || camino[0], dm = last(camino)[1] - hace[1];
      let motor = null, mayor = 0;
      for (let i = 1; i < camino.length; i++) {
        const d = camino[i][1] - camino[i - 1][1]; if (camino[i][0] < last(camino)[0] - 30 * DIA || Math.abs(d) <= Math.abs(mayor)) continue;
        const f = new Date(camino[i][0]).toISOString().slice(0, 10), f0 = new Date(camino[i][0] - 3 * DIA).toISOString().slice(0, 10);
        const rel = (ST.DATA.calendario || []).filter(c => c.fecha <= f && c.fecha >= f0 && infoRelease(c.nombre).imp >= 2 && !/GDPNow|FOMC|Summary of Economic|Target Range/.test(c.nombre))
          .sort((x, y) => infoRelease(y.nombre).imp - infoRelease(x.nombre).imp || y.fecha.localeCompare(x.fecha))[0];
        if (rel) { motor = nombreCorto(rel.nombre); mayor = d; }
      }
      mov = Math.abs(dm) < 0.1 ? ": sin cambios en el último mes" : `: ${dm > 0 ? "subió" : "bajó"} ${nf(Math.abs(dm))} pp en el último mes` + (motor ? `, sobre todo por el dato de ${motor}` : "");
    }
    // error de los últimos 8 trimestres contra la primera publicación del PBI
    const p1 = S("gdp_1ra"), err = p1 ? join(n, p1, (a, b) => Math.abs(a - b)) : null;
    const e8 = err && err.length >= 4 ? err.slice(-8) : null, em = e8 ? e8.reduce((x, y) => x + y[1], 0) / e8.length : null;
    return { tipo: "cat", freq: "Q", apilado: false, signo: false, unidad: "%",
      titulo: enCurso ? `GDPNow estima ${nf(ult[1])}% para ${fq(ult[0])}` + mov : `El último PBI publicado fue ${nf(pub[1])}% en ${fq(pub[0])}`,
      sub: "PBI real publicado (barras) y la última estimación en tiempo real de la Fed de Atlanta para cada trimestre, % trimestral anualizado." + (em != null ? ` Error promedio de los últimos ${e8.length} trimestres: ${nf(em)} pp.` : ""),
      cats: ts.map(fq),
      series: [{ n: "PBI publicado", c: 0, t: "bar", d: ts.map(t => mg.get(t) ?? null) }, { n: "GDPNow", t: "line", c: 1, punteada: true, etiquetas: ts.length <= 24, d: ts.map(t => mn.get(t) ?? null) }] };
  } });
def("demandaPrivada", { slug: "demanda-privada", nombre: "Demanda privada final", sin: ["ventas finales", "final sales", "demanda interna", "pbi núcleo"],
  calc: "Ventas finales reales a compradores privados domésticos: consumo más inversión fija privada (BEA). Deja afuera inventarios, gobierno y comercio exterior, los componentes ruidosos del PBI. Barras: variación trimestral anualizada (el momento); línea: interanual (la tendencia). Si las barras quedan por encima de la línea, la demanda se acelera.",
  ks: ["final_sales_priv", "gdp_real"],
  f: () => {
    const f = S("final_sales_priv"), g = S("gdp_real"); if (!f || !g) return null;
    const q = ann(f, 1, 4), a = yoy(f, 4), ga = yoy(g, 4); if (!q || !a) return null;
    const vq = last(q)[1], va = last(a)[1], acel = vq > va + 0.3 ? "se acelera" : vq < va - 0.3 ? "se frena" : "crece estable";
    return { freq: "Q", titulo: `La demanda privada ${acel}: ${nf(vq)}% anualizado en ${fq(last(q)[0])} contra ${nf(va)}% interanual; el PBI, ${nf(last(ga)[1])}%`,
      sub: "Consumo más inversión fija privada, real: la demanda de fondo, sin inventarios, gobierno ni comercio exterior.",
      series: [{ n: "Trimestral anualizado", d: cut(q), t: "bar", c: 0, suave: true }, { n: "Interanual", d: cut(a), c: 0, w: 3 }, { n: "PBI real, interanual", d: cut(ga), c: "gris", w: 1.4, punteada: true }], refs: [{ y: 0 }] };
  } });
def("brecha", { slug: "brecha-del-producto", nombre: "Brecha del producto y del desempleo", sin: ["output gap", "potencial", "cbo", "holgura", "recalentamiento", "okun", "nairu", "desempleo natural"],
  calc: "Brecha del producto: PBI real sobre el PBI potencial de la Oficina de Presupuesto del Congreso (CBO), menos 1, en %. Brecha del desempleo: tasa natural (no cíclica) de la CBO menos el desempleo, en puntos; positiva significa un mercado laboral más ajustado que lo normal. Las dos se leen igual: sobre cero, recalentamiento. La CBO revisa su potencial en cada informe, así que la historia puede moverse.",
  ks: ["gdp_real", "gdp_pot", "unemployment", "nrou"],
  f: () => {
    const b = join(S("gdp_real"), S("gdp_pot"), (a, c) => (a / c - 1) * 100); if (!b) return null;
    const u = toQ(S("unemployment")), n = S("nrou");
    const bu = u && n ? join(n, u, (a, c) => a - c) : null;
    const ss = [{ n: "Brecha del producto (CBO)", d: cut(b), c: 0, w: 2.6, area: true }];
    if (bu) ss.push({ n: "Brecha del desempleo (natural − actual)", ley: "Brecha del desempleo", d: cut(bu), c: 1, w: 2 });
    const v = last(b)[1], w = bu ? last(bu)[1] : null;
    const caliente = v > 0.3, ajustado = w != null && w > 0.1, flojo = w != null && w < -0.1;
    const diag = w == null ? "" : caliente && ajustado ? ": recalentamiento" : !caliente && v < -0.3 && flojo ? ": hay holgura" : caliente && flojo ? ": las dos medidas no coinciden" : "";
    return { freq: "Q", sinRecorte: false,
      titulo: `El PBI está ${nf(Math.abs(v))}% ${v >= 0 ? "sobre" : "bajo"} su potencial` + (w != null ? ` y el desempleo ${nf(Math.abs(w))} pp ${w >= 0 ? "bajo" : "sobre"} su nivel natural` : "") + diag,
      sub: "Las dos brechas se leen igual: sobre cero, la economía usa más recursos de los que puede sostener y presiona sobre los precios.",
      series: ss, refs: [{ y: 0, l: "Potencial / nivel natural" }] };
  } });
def("productividad", { slug: "productividad", nombre: "¿Hay un boom de productividad?", sin: ["productividad", "ia", "inteligencia artificial", "boom", "producto por hora"], historia: true,
  calc: "Producto por hora del sector empresas no agrícolas (BLS). Línea: crecimiento anualizado a 5 años, la tendencia; barras: variación interanual. Las referencias son el crecimiento anual promedio del boom 1995-2004 y del período 2005-19, calculados con los datos. La productividad trimestral se mueve al revés del ciclo (en 2020 saltó porque se perdieron empleos de baja productividad): por eso la lectura es la de 5 años.",
  ks: ["productivity"],
  f: () => {
    const p = S("productivity"); if (!p) return null;
    const a5 = ann(p, 20, 4), y = yoy(p, 4); if (!a5 || !y) return null;
    const nivel = t => valorEn(p, t)?.[1];
    const era = (a, b) => { const x = nivel(T(a, 1)), z = nivel(T(b, 10)); return x && z ? (Math.pow(z / x, 1 / (b - a + 0.75)) - 1) * 100 : null; };
    const boom = era(1995, 2004), normal = era(2005, 2019), v = last(a5)[1];
    const refs = [{ y: 0 }];
    if (boom) refs.push({ y: boom, l: `Boom 1995-2004: ${nf(boom)}%` });
    if (normal) refs.push({ y: normal, l: `2005-19: ${nf(normal)}%` });
    const lect = boom && normal ? (v >= boom ? "al nivel del boom 1995-2004" : v > normal ? `por encima de 2005-19 (${nf(normal)}%), todavía debajo del boom 1995-2004 (${nf(boom)}%)` : `en el ritmo de 2005-19 (${nf(normal)}%), lejos del boom 1995-2004`) : "";
    return { freq: "Q", titulo: `La productividad crece ${nf(v)}% anual en 5 años` + (lect ? `: ${lect}` : ""),
      sub: `Producto por hora, empresas no agrícolas. Línea: tendencia de 5 años; barras: interanual (último, ${nf(last(y)[1])}%).`,
      sinRecorte: true, series: [{ n: "Interanual", d: cut(y), t: "bar", c: 0, suave: true }, { n: "Anualizado a 5 años", d: cut(a5), c: 0, w: 3 }], refs };
  } });
def("encuestas", { slug: "encuestas-manufactureras", nombre: "Encuestas de la Fed: nuevos pedidos de la industria", sin: ["philly fed", "empire state", "pmi", "ism", "encuestas", "nuevos pedidos", "filadelfia", "nueva york"],
  calc: "Índices de difusión de nuevos pedidos y de actividad general de las encuestas manufactureras de la Fed de Filadelfia y de Nueva York (Empire State): porcentaje de empresas que ven mejora menos el que ve deterioro. Se promedian las dos encuestas y se suaviza con 3 meses. Los nuevos pedidos adelantan la actividad; la actividad general es la pregunta más anímica y volátil.",
  ks: ["philly_pedidos", "empire_pedidos", "philly", "empire"],
  f: () => {
    const prom = (a, b) => a && b ? roll(join(a, b, (x, y) => (x + y) / 2), 3) : a ? roll(a, 3) : b ? roll(b, 3) : null;
    const ped = prom(S("philly_pedidos"), S("empire_pedidos")), act = prom(S("philly"), S("empire")); if (!ped && !act) return null;
    const base = ped || act, v = last(base)[1], prev3 = valorEn(base, last(base)[0] - 92 * DIA);
    const ss = [];
    if (ped) ss.push({ n: "Nuevos pedidos", d: cut(ped), c: 0, w: 2.8 });
    if (act) ss.push({ n: "Actividad general", d: cut(act), c: "gris", w: 1.4 });
    return { titulo: `Nuevos pedidos de la industria en ${sg(v)} (promedio de 3 meses)` + (prev3 ? `, ${v - prev3[1] >= 0 ? "mejor" : "peor"} que hace 3 meses (${sg(prev3[1])})` : ""),
      sub: `Promedio de Filadelfia y Nueva York, 3 meses. Sobre cero, más empresas ven mejora que deterioro. Es el primer dato industrial de cada mes.`,
      unidad: "", dec: 1, series: ss, refs: [{ y: 0 }] };
  } });
def("industria", { slug: "industria-manufacturera", nombre: "Industria manufacturera: producción y uso de la capacidad", sin: ["industria", "manufactura", "relocalización", "reshoring", "capacidad instalada", "fábricas"],
  calc: "Índice de producción manufacturera de la Fed (2017 = 100) y uso de la capacidad manufacturera (%, eje derecho). La referencia es el máximo de la producción en 2007. El índice total de producción industrial suma minería y servicios públicos (que se mueven con el petróleo y el clima); acá va sólo manufactura.",
  ks: ["ip_man", "tcu_man"],
  f: () => {
    const m = S("ip_man"); if (!m) return null;
    const t = S("tcu_man"), pico = Math.max(...m.filter(p => p[0] >= T(2007) && p[0] < T(2008)).map(p => p[1]));
    const v = last(m)[1], d = (v / pico - 1) * 100, mm = pct(m);
    const ss = [{ n: "Producción manufacturera", d: cut(m), c: 0, w: 2.8 }];
    let txt = "";
    if (t) {
      ss.push({ n: "Uso de la capacidad (eje derecho)", d: cut(t), c: 1, w: 1.4, der: true, u: "%" });
      const base = t.filter(p => p[0] >= T(2000) && p[0] < T(2020)).map(p => p[1]), prom = base.reduce((a, b) => a + b, 0) / base.length;
      txt = `; uso de la capacidad ${nf(last(t)[1])}% (promedio 2000-19: ${nf(prom)}%)`;
    }
    return { titulo: `Producción manufacturera ${nf(Math.abs(d))}% ${d < 0 ? "bajo" : "sobre"} su máximo de 2007` + txt,
      sub: `Índice 2017 = 100. ${fechaDe(m)}: ${sg(last(mm)[1])}% en el mes.`, unidad: "", dec: 1, sinRecorte: true,
      series: ss, refs: [{ y: pico, l: "Máximo de 2007" }] };
  } });
def("ordenes", { slug: "ordenes-de-capital", nombre: "Órdenes y envíos de bienes de capital", sin: ["core orders", "capex", "bienes durables", "inversión en equipos", "envíos", "book to bill"],
  calc: "Órdenes nuevas y envíos de bienes de capital sin defensa ni aviones (Census, M3), deflactados por el PPI de bienes de capital (BLS): miles de millones de dólares constantes del último mes. Las órdenes adelantan a los envíos, y los envíos son lo que BEA usa para la inversión en equipos del PBI. Si las órdenes corren por encima de los envíos, se acumula cartera y la inversión sigue subiendo.",
  ks: ["core_orders", "core_ship", "ppi_capital"],
  f: () => {
    const defl = S("ppi_capital");
    const o = escala(deflactar(S("core_orders"), defl), 1e-3), e = escala(deflactar(S("core_ship"), defl), 1e-3); if (!o) return null;
    const o3 = roll(o, 3), e3 = e ? roll(e, 3) : null;
    const crec = o3.length > 3 ? (Math.pow(last(o3)[1] / o3[o3.length - 4][1], 4) - 1) * 100 : null;
    const comun = e3 ? join(o3, e3, (a, b) => a / b) : null, r = comun ? last(comun)[1] : null;
    const diag = r == null ? "" : r > 1.01 ? ", sobre los envíos: la inversión en equipos sube" : r < 0.99 ? ", bajo los envíos: se anticipa un freno" : ", a la par de los envíos";
    const ss = [{ n: "Órdenes, mensual", d: cut(o), c: 0, fina: true }, { n: "Órdenes, promedio 3 meses", d: cut(o3), c: 0, w: 2.8 }];
    if (e3) ss.push({ n: "Envíos, promedio 3 meses", d: cut(e3), c: 1, w: 2 });
    return { titulo: `Órdenes de capital reales ${sg(crec)}% anualizado en 3 meses` + diag,
      sub: "Sin defensa ni aviones, a precios constantes, miles de M de US$. Las órdenes adelantan a los envíos, que entran al PBI.",
      unidad: "mil M", dec: 1, series: ss };
  } });
def("viviendas", { slug: "vivienda", nombre: "Vivienda: permisos y casas nuevas sin vender", sin: ["housing starts", "permisos", "construcción", "vivienda", "casas", "stock"],
  calc: "Permisos de construcción de casas unifamiliares y de edificios de 5 o más unidades (Census), miles por año, promedio de 3 meses; y meses de stock de casas nuevas (cuánto tardaría en venderse lo que hay al ritmo actual), eje derecho. Las unifamiliares son la parte sensible a la tasa hipotecaria; los edificios siguen el ciclo del alquiler. Alrededor de 6 meses de stock es el equilibrio habitual: por encima, los constructores frenan.",
  ks: ["permits1", "permits5", "meses_stock"],
  f: () => {
    const u = S("permits1"), e = S("permits5"), st = S("meses_stock"); if (!u) return null;
    const u3 = roll(u, 3), cr = u3.length > 3 ? (Math.pow(last(u3)[1] / u3[u3.length - 4][1], 4) - 1) * 100 : null;
    const ss = [{ n: "Casas unifamiliares", d: cut(u3), c: 0, w: 2.8 }];
    if (e) ss.push({ n: "Edificios (5 o más unidades)", ley: "Edificios 5+ unidades", d: cut(roll(e, 3)), c: "gris", w: 1.6 });
    if (st) ss.push({ n: "Meses de stock (eje derecho)", d: cut(st), c: 1, w: 1.6, der: true, dec: 1, u: "meses" });
    const vs = st ? last(st)[1] : null;
    return { titulo: `Permisos de casas unifamiliares ${sg(cr, 0)}% anualizado en 3 meses` + (vs != null ? `; ${nf(vs)} meses de stock sin vender, ${vs > 6.5 ? "sobre" : vs < 5.5 ? "bajo" : "cerca de"} el equilibrio de 6` : ""),
      sub: "Permisos en miles por año, promedio de 3 meses. Con mucho stock sin vender, los constructores frenan.", unidad: "mil", dec: 0, series: ss };
  } });
def("capex", { slug: "inversion-tecnologica", nombre: "Inversión tecnológica / PBI", sin: ["ia", "data centers", "software", "punto com", "capex tecnológico", "inteligencia artificial"],
  calc: "Inversión en equipos de procesamiento de información más software (BEA), sobre PBI nominal; la referencia es el pico punto com (máximo anterior a 2003). El aporte al crecimiento suma las contribuciones de los dos rubros al PBI real del último trimestre (BEA). Los data centers como edificios son estructuras y no están incluidos: Census publica su construcción por separado, pero no está en FRED.",
  ks: ["inv_info", "inv_software", "gdp_nom", "c_info", "c_software", "gdp_growth"],
  f: () => {
    const e = S("inv_info"), s = S("inv_software"), g = S("gdp_nom"); if (!e || !s || !g) return null;
    const ep = join(e, g, (a, b) => a / b * 100), sp = join(s, g, (a, b) => a / b * 100), tot = join(ep, sp, (a, b) => a + b);
    const pc = Math.max(...tot.filter(p => p[0] < T(2003)).map(p => p[1])), v = last(tot)[1], d = v - pc;
    const ci = S("c_info"), cs = S("c_software"), gg = S("gdp_growth");
    const aporte = ci && cs ? last(ci)[1] + last(cs)[1] : null;
    return { titulo: `La inversión tecnológica pesa ${nf(v)}% del PBI (${sg(d)} pp contra el pico punto com)` + (aporte != null && gg ? ` y aportó ${nf(aporte)} pp al crecimiento` : ""),
      sub: "Equipos de procesamiento de información más software, % del PBI nominal. No incluye los edificios de los data centers.",
      freq: "Q", dec: 1, decEje: 1, cero: true, eventos: false, sinRecorte: true,
      series: [{ n: "Equipos de información", d: cut(ep), area: true, stack: "t", c: 0, fin: false }, { n: "Software (tope = total)", ley: "Software", d: cut(sp), area: true, stack: "t", c: 2, finValor: v }],
      refs: [{ y: pc, l: `Pico punto com: ${nf(pc)}%` }] };
  } });
def("ganancias", { slug: "margen-de-las-empresas", nombre: "Margen de las empresas no financieras", sin: ["profits", "márgenes", "empresas", "ganancias", "rentabilidad"], historia: true,
  calc: "Ganancias de las empresas no financieras (con ajustes de valuación de inventarios y de amortización) sobre su valor agregado bruto (BEA): la medida clásica de margen, que aísla el negocio doméstico de las ganancias en el exterior y del sector financiero. La referencia es el promedio desde 1960. Si el margen sube, la participación de los salarios en lo producido baja.",
  ks: ["profits_nf", "gva_nf"],
  f: () => {
    const p = S("profits_nf"), g = S("gva_nf"); if (!p || !g) return null;
    const m = join(p, g, (a, b) => a / b * 100).filter(x => x[0] >= T(1960)); if (!m.length) return null;
    const prom = m.reduce((a, b) => a + b[1], 0) / m.length, v = last(m)[1], max = Math.max(...m.map(x => x[1]));
    const y = yoy(p, 4), cy = y ? last(y)[1] : null;
    const nivel = v >= max - 0.05 ? "máximo desde 1960" : `percentil ${pctl(m, v)} desde 1960`;
    return { freq: "Q", sinRecorte: true,
      titulo: `Margen de las empresas en ${nf(v)}%, ${nivel}` + (cy != null ? `; ganancias ${sg(cy)}% interanual` : ""),
      sub: "Ganancias sobre valor agregado de las empresas no financieras. Una caída interanual de las ganancias antecedió a casi todas las recesiones.",
      series: [{ n: "Margen", d: cut(m), c: 2, w: 2.6 }], refs: [{ y: prom, l: `Promedio desde 1960: ${nf(prom)}%` }] };
  } });
def("pbiGdi", { slug: "pbi-vs-gdi", nombre: "PBI vs GDI: gasto contra ingreso", sin: ["ingreso bruto", "gdi", "revisiones", "discrepancia estadística"],
  calc: "El producto se mide por el gasto (PBI) y por el ingreso (GDI: salarios, ganancias, rentas); en teoría dan lo mismo y la diferencia es la discrepancia estadística. Barras: diferencia de crecimiento interanual GDI menos PBI. Línea punteada: promedio de PBI y GDI, que BEA publica y la Fed usa como mejor estimación del crecimiento real. El GDI sale un mes después que el PBI. Antecedente: un trabajo de la Fed (Nalewaik, 2010) encontró que el PBI tendía a revisarse hacia el GDI; investigaciones posteriores relativizaron ese resultado. La web no puede verificarlo, porque no tiene el GDI tal como se publicó en cada momento.",
  ks: ["gdp_real", "gdi_real", "gdp_gdi_prom"],
  f: () => {
    const a = yoy(S("gdp_real"), 4), b = yoy(S("gdi_real"), 4); if (!a || !b) return null;
    const dif = join(b, a, (x, y) => x - y), pr = yoy(S("gdp_gdi_prom"), 4), u = last(dif);
    const falta = last(a)[0] > last(b)[0];
    let n = 0; for (let i = dif.length - 1; i >= 0 && Math.sign(dif[i][1]) === Math.sign(u[1]); i--) n++;
    const niv = join(S("gdi_real"), S("gdp_real"), (x, y) => (x / y - 1) * 100), nv = niv ? valorEn(niv, u[0]) : null;
    const ss = [{ n: "GDI − PBI (pp)", d: cut(dif), t: "bar", c: 3, suave: true }, { n: "PBI real", d: cut(a), c: 0, w: 1.6 }, { n: "GDI real", d: cut(b), c: 1, w: 1.6 }];
    if (pr) ss.push({ n: "Promedio PBI-GDI", d: cut(pr), c: "ink", w: 2, punteada: true });
    const va = valorEn(a, u[0])[1], vb = valorEn(b, u[0])[1], vp = pr ? valorEn(pr, u[0]) : null;
    return { freq: "Q", titulo: `${fq(u[0])}: PBI ${nf(va)}% y GDI ${nf(vb)}% interanual` + (n >= 2 ? `; el ${u[1] > 0 ? "GDI" : "PBI"} crece más hace ${n} trimestres` : "") + (nv ? `; en nivel, GDI ${nf(Math.abs(nv[1]), 2)}% ${nv[1] >= 0 ? "sobre" : "bajo"} el PBI` : "") + (vp ? `; promedio de los dos: ${nf(vp[1])}%` : ""),
      sub: "PBI (gasto) y GDI (ingreso) reales, BEA, variación interanual. Barras: diferencia. El GDI de cada trimestre sale un mes después que el PBI." + (falta ? ` El GDI de ${fq(last(a)[0])} todavía no se publicó.` : ""),
      series: ss, refs: [{ y: 0 }] };
  } });
def("preciosPagados", { slug: "precios-pagados-industria", nombre: "Precios que pagan las fábricas", sin: ["precios pagados", "costos", "encuestas", "philly fed", "empire state", "aranceles", "cañería"],
  calc: "Índices de difusión de precios pagados por las empresas manufactureras en las encuestas de la Fed de Filadelfia y de Nueva York: porcentaje que paga más menos el que paga menos. Promedio de las dos, 3 meses. Eje derecho: PPI de demanda final, interanual (BLS). Desde 2002 la correlación con el PPI es más alta en el mismo mes (0,89) que con el PPI de 6 meses después (0,81) o de 12 meses después (0,39): es un dato coincidente que se publica antes, a mitad del mes que mide. Referencias: promedio 2015-19 y máximo de 2021-22.",
  ks: ["philly_precios", "empire_precios", "ppi_fd"],
  f: () => {
    const a = S("philly_precios"), b = S("empire_precios"); if (!a && !b) return null;
    const pr = a && b ? roll(join(a, b, (x, y) => (x + y) / 2), 3) : roll(a || b, 3), v = last(pr)[1];
    const p = promEntre(pr, 2015, 2019), mx = maxEntre(pr, 2021, 2022), ppi = yoy(S("ppi_fd"));
    const ss = [{ n: "Precios pagados, promedio 3 meses", d: cut(pr), c: 1, w: 2.8 }];
    if (ppi) ss.push({ n: "PPI demanda final, interanual (eje derecho)", d: cut(ppi), c: 0, w: 1.6, der: true, u: "%" });
    const refs = []; if (p != null) refs.push({ y: p, l: `Promedio 2015-19: ${nf(p, 0)}` }); if (mx) refs.push({ y: mx[1], l: `Máximo ${anio(mx[0])}: ${nf(mx[1], 0)}` });
    return { titulo: `Precios pagados por las fábricas: ${nf(v, 0)} (promedio 3 meses, ${fechaDe(pr)}), percentil ${pctl(pr, v)} desde 2001` + (p != null ? `; 2015-19: ${nf(p, 0)}` : "") + (mx ? `; máximo ${anio(mx[0])}: ${nf(mx[1], 0)}` : "") + (ppi ? `; PPI demanda final ${sg(last(ppi)[1])}% interanual` : ""),
      sub: "Saldo de respuestas (pagan más menos pagan menos), encuestas de Filadelfia y Nueva York. Se publica a mitad del mes, antes que el PPI del mismo mes.",
      unidad: "", dec: 0, series: ss, refs };
  } });
// ═════════════════════════ Consumidor ═════════════════════════
// Títulos con hechos medibles: el dato y su comparación (contra su historia, una referencia fija u otra serie), sin adjetivos ni causas.
const promEntre = (a, y0, y1) => { const x = (a || []).filter(p => p[0] >= T(y0) && p[0] < T(y1 + 1)).map(p => p[1]); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const maxEntre = (a, y0, y1) => { const x = (a || []).filter(p => p[0] >= T(y0) && p[0] < T(y1 + 1)); return x.length ? x.reduce((m, p) => p[1] > m[1] ? p : m) : null; };
const pctlDesde = (a, v, t0) => { const r = a.filter(p => p[0] >= t0).map(p => p[1]); return r.length ? Math.round(r.filter(x => x <= v).length / r.length * 100) : null; };
const anio = t => new Date(t).getUTCFullYear();
// "mínimo desde 2001" / "máximo de la serie": hasta dónde hay que ir para encontrar un valor tan extremo
function extremoDesde(a, menor) {
  const v = last(a)[1];
  for (let i = a.length - 2; i >= 0; i--) if (menor ? a[i][1] < v - 1e-9 : a[i][1] > v + 1e-9) return i >= a.length - 13 ? "" : `${menor ? "mínimo" : "máximo"} desde ${anio(a[i][0])}`;
  return `${menor ? "mínimo" : "máximo"} de la serie (desde ${anio(a[0][0])})`;
}
// Grupo de control: ventas sin autos, nafta, materiales de construcción ni restaurantes
function grupoControl() {
  let c = S("retail");
  for (const k of ["r_autos", "r_nafta", "r_materiales", "r_restaurantes"]) { if (!S(k)) return null; c = join(c, S(k), (a, b) => a - b); }
  return c;
}
const controlReal = () => { const c = grupoControl(); return c ? deflactar(c, S("cpi_core_goods")) : null; };
const SERIE_VENTAS = { id: "serie", nombre: "Serie", valores: [["c", "Grupo de control real"], ["t", "Total nominal"]] };

def("ventas", { slug: "ventas-minoristas", nombre: "Ventas minoristas: grupo de control", sin: ["retail", "consumo", "comercio", "control group", "grupo de control"], ops: [SERIE_VENTAS],
  calc: "Grupo de control: ventas minoristas y de servicios de comida (Census) menos autos y repuestos, estaciones de servicio, materiales de construcción y restaurantes. Es la parte que BEA usa para estimar el consumo de bienes del PBI. La versión real se deflacta por el CPI de bienes sin alimentos ni energía (BLS). Línea gruesa: variación de 3 meses anualizada; punteada: interanual. La opción \"Total nominal\" muestra las ventas totales sin deflactar, el titular del día de la publicación.",
  ks: ["retail", "r_autos", "r_nafta", "r_materiales", "r_restaurantes", "cpi_core_goods"],
  f: o => {
    const total = o.serie === "t" || !controlReal();
    const x = total ? S("retail") : controlReal(); if (!x) return null;
    const m = pct(x), m3 = ann(x, 3), a = yoy(x); if (!m || !m3 || !a) return null;
    const nombre = total ? "Ventas minoristas totales, nominales" : "Grupo de control real";
    return { titulo: `${nombre}: ${sg(last(m)[1])}% en ${fechaDe(m)}, ${sg(last(m3)[1])}% anualizado en 3 meses y ${sg(last(a)[1])}% interanual`,
      sub: total ? "Ventas totales en dólares corrientes: incluyen autos, nafta, materiales, restaurantes y el efecto de los precios." : "Ventas sin autos, nafta, materiales de construcción ni restaurantes, a precios constantes.",
      dec: 1, series: [{ n: "Anualizado a 3 meses", d: cut(m3), c: 0, w: 2.8 }, { n: "Interanual", d: cut(a), c: "gris", w: 1.4, punteada: true }], refs: [{ y: 0 }] };
  } });

// Desvío porcentual contra la tendencia log-lineal 2015-19 (último período normal antes de la pandemia)
function desvioTendencia(a) {
  if (!a) return null;
  const f = a.filter(p => p[0] >= T(2015) && p[0] < T(2020)); if (f.length < 48) return null;
  const n = f.length, xs = f.map(p => p[0] / DIA), ys = f.map(p => Math.log(p[1]));
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxy / sxx, c = my - b * mx;
  return { d: a.map(p => [p[0], (p[1] / Math.exp(c + b * p[0] / DIA) - 1) * 100]), ritmo: (Math.exp(b * 365.25) - 1) * 100 };
}
def("consumoTipo", { slug: "consumo-por-tipo", nombre: "Consumo real por tipo de gasto contra su tendencia", sin: ["durables", "servicios", "bienes", "tendencia", "prepandemia"],
  calc: "Consumo real de servicios, bienes no durables y bienes durables (BEA, índices de cantidad de la tabla 2.8.3, mensuales desde 1959), como desvío porcentual contra su propia tendencia 2015-19: una recta en logaritmos ajustada a esos cinco años (el último período sin pandemia) y extendida hasta hoy. Cada tipo se compara contra su propio ritmo porque crecen a velocidades distintas: los durables, por ejemplo, suben más rápido en términos reales porque la tecnología se abarata. En gris, el consumo total. Cero es estar en la tendencia.",
  ks: ["qi_serv", "qi_ndur", "qi_dur", "qi_pce"],
  f: () => {
    // índices de cantidad de BEA (desde 1959); si todavía no están, las series en dólares encadenados (desde 2007)
    const q = (k, alt) => S(k) || S(alt);
    const ks = [["qi_serv", "pce_serv", "Servicios", 0], ["qi_ndur", "pce_ndur", "No durables", 1], ["qi_dur", "pce_dur", "Durables", 2]];
    const ds = ks.map(([k, alt, n, c]) => ({ n, c, t: desvioTendencia(q(k, alt)) })); if (ds.some(x => !x.t)) return null;
    const tot = desvioTendencia(q("qi_pce", "pce_real"));
    const ss = ds.map(x => ({ n: `${x.n} (tendencia ${nf(x.t.ritmo)}% anual)`, d: cut(x.t.d), c: x.c, w: 2.4 }));
    if (tot) ss.push({ n: "Consumo total", ley: "Total", d: cut(tot.d), c: "gris", w: 1.4, punteada: true });
    const v = i => sg(last(ds[i].t.d)[1]);
    return { titulo: `Contra su tendencia 2015-19, en ${fechaDe(ds[0].t.d)}: servicios ${v(0)}%, no durables ${v(1)}%, durables ${v(2)}%` + (tot ? `; consumo total ${sg(last(tot.d)[1])}%` : ""),
      sub: "Desvío del consumo real contra la tendencia de cada tipo de gasto en 2015-19. Cero es estar en la tendencia.",
      dec: 1, eventos: false, series: ss, refs: [{ y: 0, l: "Tendencia 2015-19" }] };
  } });

def("autos", { slug: "ventas-de-autos", nombre: "Ventas de vehículos y tasa de los préstamos", sin: ["autos", "vehículos", "durables", "light vehicles", "préstamos para autos"],
  calc: "Ventas totales de vehículos livianos (BEA), millones de unidades, tasa anual desestacionalizada, y su promedio de 3 meses. La referencia es el promedio 2015-19. Eje derecho: tasa de los préstamos de bancos comerciales para auto nuevo a 60 meses (Fed, G.19), que se releva en el segundo mes de cada trimestre.",
  ks: ["autos", "auto_tasa"],
  f: () => {
    const a = S("autos"); if (!a) return null;
    const m3 = roll(a, 3), p = promEntre(a, 2015, 2019), t = S("auto_tasa");
    const ss = [{ n: "Ventas del mes", d: cut(a), c: 0, fina: true }, { n: "Promedio 3 meses", d: cut(m3), c: 0, w: 2.6 }];
    if (t) ss.push({ n: "Tasa a 60 meses (eje derecho)", d: cut(t), c: 1, w: 1.6, der: true, u: "%", dec: 2 });
    return { titulo: `${nf(last(a)[1])} millones de vehículos por año en ${fechaDe(a)} (promedio 3 meses: ${nf(last(m3)[1])})` + (p ? `; promedio 2015-19: ${nf(p)}` : "") + (t ? `; tasa del préstamo a 60 meses: ${nf(last(t)[1], 2)}% (${fm(last(t)[0])})` : ""),
      sub: "Millones de unidades, tasa anual desestacionalizada. Eje derecho: tasa de los préstamos bancarios para auto nuevo a 60 meses.",
      unidad: "M", dec: 1, series: ss, refs: p ? [{ y: p, l: `Promedio 2015-19: ${nf(p)} M` }] : [] };
  } });

def("sentimiento", { slug: "confianza-del-consumidor", nombre: "Confianza del consumidor y consumo real", sin: ["michigan", "sentiment", "umich", "confianza"], historia: true,
  calc: "Índice de sentimiento del consumidor de la Universidad de Michigan (1966 T1 = 100), eje izquierdo, y consumo real (BEA), variación interanual, eje derecho. El percentil se calcula sobre toda la historia del índice desde 1960. El consumo real mensual existe desde 2007.",
  ks: ["sentiment", "pce_real", "infl_exp_1y"],
  f: () => {
    const s = S("sentiment"), e = S("infl_exp_1y"), c = yoy(S("pce_real")); if (!s) return null;
    const v = last(s)[1], p = pctlDesde(s, v, T(1960));
    const ss = [{ n: "Confianza del consumidor", d: cut(s), c: 0, w: 2.4 }];
    if (c) ss.push({ n: "Consumo real, interanual (eje derecho)", d: cut(c), c: 1, w: 1.6, der: true, u: "%" });
    return { titulo: `Confianza del consumidor en ${nf(v)} en ${fechaDe(s)}, percentil ${p} desde 1960` + (c ? `; consumo real ${sg(last(c)[1])}% interanual en ${fechaDe(c)}` : ""),
      sub: "Índice de la Universidad de Michigan (eje izquierdo) y consumo real, variación interanual (eje derecho)." + (e ? ` Inflación esperada a un año en la misma encuesta: ${nf(last(e)[1])}%.` : ""),
      unidad: "", dec: 1, series: ss };
  } });

def("ingresoConsumo", { slug: "ingreso-vs-consumo", nombre: "Ingreso real vs consumo real", sin: ["ingreso disponible", "consumo real", "brecha"],
  calc: "Ingreso disponible real y consumo real (BEA), variación interanual. Las barras son la diferencia (consumo menos ingreso, en puntos): cuando es positiva, el consumo crece más que el ingreso, y por identidad contable la diferencia se cubre con menos ahorro o con más deuda.",
  ks: ["dpi_real", "pce_real"],
  f: () => {
    const i = yoy(S("dpi_real")), c = yoy(S("pce_real")); if (!i || !c) return null;
    const d = join(c, i, (a, b) => a - b), u12 = d.slice(-12), n = u12.filter(p => p[1] > 0).length;
    return { titulo: `Consumo real ${sg(last(c)[1])}% e ingreso real ${sg(last(i)[1])}% interanual en ${fechaDe(c)}; el consumo creció más en ${n} de los últimos 12 meses`,
      sub: "Variación interanual real. Barras: consumo menos ingreso, en puntos.",
      dec: 1, shock: [T(2020, 3), T(2022, 6)], shockVentana: [T(2020, 3), T(2022, 6)], series: [{ n: "Consumo menos ingreso (pp)", d: cut(d), t: "bar", c: "gris", suave: true }, { n: "Consumo real", d: cut(c), c: 1, w: 2.4 }, { n: "Ingreso disponible real", d: cut(i), c: 0, w: 2.4 }],
      refs: [{ y: 0 }] };
  } });

// Contribuciones al crecimiento interanual del ingreso disponible real, por fuente (identidad del ingreso personal de BEA)
const FUENTES_INGRESO = [["Salarios", ["comp"], 0], ["Transferencias", ["transfers"], 1], ["Otros ingresos", ["pi_int", "pi_div", "pi_prop", "pi_rent"], 2], ["Impuestos y aportes", ["pi_tax", "pi_contrib"], 3, -1]];
def("motores", { slug: "fuentes-del-ingreso", nombre: "Fuentes del ingreso real", sin: ["remuneración", "ingreso personal", "transferencias", "salarios", "dividendos", "intereses", "impuestos"],
  calc: "Contribución de cada fuente al crecimiento interanual del ingreso disponible real, en puntos (BEA, Ingreso Personal): el cambio en 12 meses de cada componente, en dólares corrientes, sobre el ingreso disponible de un año antes. Ingreso disponible = salarios + transferencias + otros ingresos (intereses, dividendos, cuentapropistas y alquileres) − impuestos y aportes a la seguridad social. La inflación es la diferencia entre el crecimiento nominal y el real (deflactor del PCE). La línea es el ingreso disponible real. En períodos de más de 5 años se muestra el último mes de cada trimestre.",
  ks: ["dpi_nom", "dpi_real", "comp", "transfers", "pi_int", "pi_div", "pi_prop", "pi_rent", "pi_tax", "pi_contrib"],
  f: () => {
    const dn = S("dpi_nom"), r = yoy(S("dpi_real")); if (!dn || !r) return null;
    if (FUENTES_INGRESO.some(([, ks]) => ks.some(k => !S(k)))) {
      // sin el detalle del ingreso: salarios y transferencias, interanual nominal
      const a = yoy(S("comp")), b = yoy(S("transfers")); if (!a || !b) return null;
      return { titulo: `Salarios ${sg(last(a)[1])}% y transferencias ${sg(last(b)[1])}% interanual en ${fechaDe(a)}`, sub: "Remuneración a asalariados y transferencias del gobierno, en dólares corrientes.",
        dec: 1, series: [{ n: "Salarios", d: cut(a), c: 0 }, { n: "Transferencias", d: cut(b), c: 1 }], refs: [{ y: 0 }] };
    }
    const mdn = new Map(dn), mr = new Map(r);
    const sumar = ks => ks.slice(1).reduce((acc, k) => join(acc, S(k), (a, b) => a + b), S(ks[0]));
    const comps = FUENTES_INGRESO.map(([n, ks, c, sgn]) => { const s = sumar(ks), m = new Map(s); return { n, c, sgn: sgn || 1, m, s }; });
    const t12 = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), 1); };
    let ts = [...mr.keys()].filter(t => mdn.has(t12(t)) && comps.every(x => x.m.has(t) && x.m.has(t12(t)))).filter(t => t >= ST.T0 && t <= ST.T1);
    if (!ts.length) return null;
    const trim = ts.length > 60; if (trim) ts = ts.filter(t => new Date(t).getUTCMonth() % 3 === 2 || t === ts[ts.length - 1]);
    const contrib = (x, t) => x.sgn * (x.m.get(t) - x.m.get(t12(t))) / mdn.get(t12(t)) * 100;
    const nominal = t => (mdn.get(t) / mdn.get(t12(t)) - 1) * 100;
    const series = comps.map(x => ({ n: x.n, t: "bar", c: x.c, d: ts.map(t => contrib(x, t)) }));
    series.push({ n: "Inflación", t: "bar", c: "gris", d: ts.map(t => mr.get(t) - nominal(t)) });
    series.push({ n: "Ingreso disponible real", t: "line", c: "ink", w: 2.2, d: ts.map(t => mr.get(t)) });
    // la base de los cheques de 2020-21 deja interanuales de ±20 pp hasta mediados de 2022: el eje se recorta a lo demás
    const rango = i => { const b = series.filter(x => x.t === "bar").map(x => x.d[i]); return [b.filter(v => v < 0).reduce((a, v) => a + v, 0), b.filter(v => v > 0).reduce((a, v) => a + v, 0), series[series.length - 1].d[i]]; };
    const idx = ts.map((t, i) => i), normal = idx.filter(i => ts[i] > T(2022, 6) || ts[i] < T(2020, 3));
    let yMin, yMax, recorte = "";
    if (normal.length && normal.length < ts.length) {
      const vs = normal.flatMap(rango), todos = idx.flatMap(rango), lo = Math.min(...vs), hi = Math.max(...vs), r = hi - lo;
      if (Math.min(...todos) < lo - 0.4 * r) yMin = Math.floor((lo - 0.1 * r) / 2) * 2;
      if (Math.max(...todos) > hi + 0.4 * r) yMax = Math.ceil((hi + 0.1 * r) / 2) * 2;
      if (yMin != null || yMax != null) recorte = " Eje recortado para que la base de la pandemia no aplaste la escala.";
    }
    const u = ts.length - 1, val = n => series.find(s => s.n === n).d[u];
    const otros = val("Otros ingresos");
    return { tipo: "cat", freq: "M", recesiones: false,
      titulo: `Ingreso disponible real ${sg(mr.get(ts[u]))}% interanual en ${fm(ts[u])}: salarios ${sg(val("Salarios"))} pp, transferencias ${sg(val("Transferencias"))} pp, otros ingresos ${sg(otros)} pp, impuestos ${sg(val("Impuestos y aportes"))} pp, inflación ${sg(val("Inflación"))} pp`,
      sub: "Aporte de cada fuente al crecimiento interanual del ingreso disponible real, en puntos." + (trim ? " Último mes de cada trimestre." : "") + recorte,
      unidadLinea: "%", sinPuntos: true, yMin, yMax, cats: ts.map(fm), series };
  } });

def("ahorro", { slug: "tasa-de-ahorro", nombre: "Tasa de ahorro", sin: ["saving rate", "ahorro"], historia: true,
  calc: "Ahorro personal como % del ingreso disponible (BEA). El percentil se calcula sobre toda la historia desde 1960. Referencias: promedio 2010-19 y promedio 2000-07. BEA revisa la serie todos los años (en la revisión de septiembre puede moverse más de un punto).",
  ks: ["saving_rate"],
  f: () => {
    const s = S("saving_rate"); if (!s) return null;
    const v = last(s)[1], p = pctlDesde(s, v, T(1960)), a = promEntre(s, 2010, 2019), b = promEntre(s, 2000, 2007);
    const refs = []; if (a != null) refs.push({ y: a, l: `Promedio 2010-19: ${nf(a)}%` }); if (b != null) refs.push({ y: b, l: `Promedio 2000-07: ${nf(b)}%` });
    return { titulo: `Tasa de ahorro ${nf(v)}% en ${fechaDe(s)}, percentil ${p} desde 1960` + (a != null ? `; promedio 2010-19: ${nf(a)}%` : "") + (b != null ? `; 2000-07: ${nf(b)}%` : ""),
      sub: "Ahorro personal, % del ingreso disponible.", series: [{ n: "Tasa de ahorro", d: cut(s), c: 2, w: 2.4 }], refs };
  } });

const MEDIDA_CREDITO = { id: "medida", nombre: "Medida", valores: [["i", "% del ingreso"], ["c", "Interanual"]] };
def("credito", { slug: "credito-al-consumo", nombre: "Crédito al consumo / ingreso", sin: ["consumer credit", "tarjetas", "préstamos", "g.19", "revolving", "deuda de los hogares"], ops: [MEDIDA_CREDITO], historia: true,
  calc: "Crédito al consumo total en circulación (Fed, G.19: tarjetas, préstamos para autos y estudiantiles, sin hipotecas) y su parte rotativa (tarjetas), como % del ingreso disponible anual nominal (BEA). La opción \"Interanual\" muestra el crecimiento nominal del stock. Alrededor de 2010 la serie de tarjetas tiene un escalón por un cambio contable (los bancos pasaron a consolidar carteras titulizadas).",
  ks: ["consumer_credit", "credit_revol", "dpi_nom"],
  f: o => {
    const cc = S("consumer_credit"), rv = S("credit_revol"), dn = S("dpi_nom"); if (!cc || !dn) return null;
    if (o.medida === "c") {
      const a = yoy(cc), b = rv ? yoy(rv) : null;
      return { titulo: `Crédito al consumo ${sg(last(a)[1])}% interanual en ${fechaDe(a)}` + (b ? `; tarjetas ${sg(last(b)[1])}%` : ""),
        sub: "Stock de crédito al consumo sin hipotecas, variación interanual nominal.", dec: 1,
        series: [{ n: "Crédito al consumo total", d: cut(a), c: 3, w: 2.4 }].concat(b ? [{ n: "Tarjetas (rotativo)", d: cut(b), c: 1, w: 1.6 }] : []), refs: [{ y: 0 }] };
    }
    const aMilM = x => x.length && x[x.length - 1][1] > 1e5 ? 1e-3 : 1;   // millones → miles de millones
    const kc = aMilM(cc), r = join(cc, dn, (a, b) => a * kc / b * 100);
    const kr = rv ? aMilM(rv) : 1, rr = rv ? join(rv, dn, (a, b) => a * kr / b * 100) : null;
    const v = last(r)[1], ext = extremoDesde(r, true);
    const d19 = valorEn(r, T(2019, 12)), d07 = valorEn(r, T(2007, 12));
    const refs = []; if (d07) refs.push({ y: d07[1], l: `Dic-2007: ${nf(d07[1])}%` }); if (d19) refs.push({ y: d19[1], l: `Dic-2019: ${nf(d19[1])}%` });
    return { titulo: `Crédito al consumo: ${nf(v)}% del ingreso disponible en ${fechaDe(r)}` + (ext ? `, ${ext}` : "") + (d19 ? `; dic-2019: ${nf(d19[1])}%` : "") + (rr ? `; tarjetas: ${nf(last(rr)[1])}%` : ""),
      sub: "Stock de crédito al consumo sin hipotecas y su parte en tarjetas, % del ingreso disponible anual.", dec: 1,
      series: [{ n: "Crédito al consumo total", d: cut(r), c: 3, w: 2.6 }].concat(rr ? [{ n: "Tarjetas (rotativo)", d: cut(rr), c: 1, w: 1.8 }] : []), refs };
  } });

def("riqueza", { slug: "patrimonio-de-los-hogares", nombre: "Patrimonio de los hogares / ingreso", sin: ["riqueza", "net worth", "efecto riqueza", "z.1", "patrimonio", "acciones"], historia: true,
  calc: "Patrimonio neto de los hogares y entidades sin fines de lucro (Fed, cuentas financieras Z.1, fin de trimestre) sobre el ingreso disponible nominal anual (BEA, promedio del trimestre). Referencias: máximos de 1999-2001 y de 2005-08, y promedio 1960-99. Se publica unas 10 semanas después del cierre del trimestre.",
  ks: ["net_worth", "dpi_nom"],
  f: () => {
    const r = join(S("net_worth"), toQ(S("dpi_nom")), (a, b) => a / 1000 / b); if (!r) return null;
    const v = last(r)[1], max = Math.max(...r.map(p => p[1]));
    const p00 = maxEntre(r, 1999, 2001), p06 = maxEntre(r, 2005, 2008), pr = promEntre(r, 1960, 1999);
    const pmax = r.reduce((m, p) => p[1] > m[1] ? p : m);
    const nivel = v >= max - 0.005 ? "máximo de la serie" : `máximo de la serie: ${nf(pmax[1], 2)} en ${fq(pmax[0])}`;
    const refs = []; if (p00) refs.push({ y: p00[1], l: `Máximo ${anio(p00[0])}: ${nf(p00[1], 2)}` }); if (p06) refs.push({ y: p06[1], l: `Máximo ${anio(p06[0])}: ${nf(p06[1], 2)}` }); if (pr != null) refs.push({ y: pr, l: `Promedio 1960-99: ${nf(pr, 2)}` });
    return { freq: "Q", titulo: `Patrimonio de los hogares: ${nf(v, 2)} veces el ingreso anual en ${fechaDe(r, "Q")}, ${nivel}` + (p00 && p06 ? `; máximos de ${anio(p00[0])}: ${nf(p00[1], 2)} y de ${anio(p06[0])}: ${nf(p06[1], 2)}` : ""),
      sub: "Patrimonio neto de los hogares sobre su ingreso disponible anual.",
      unidad: "veces", dec: 2, decEje: 1, series: [{ n: "Patrimonio / ingreso disponible", d: cut(r), c: 2, w: 2.4 }], refs };
  } });

def("servicioDeuda", { slug: "carga-de-la-deuda", nombre: "Carga de la deuda de los hogares", sin: ["debt service", "deuda de los hogares", "carga financiera", "cuotas"],
  calc: "Pagos de capital e intereses de hipotecas y crédito al consumo como % del ingreso disponible (Fed). La Fed rehízo la serie con una metodología nueva que arranca en 2005; antes de esa fecha se empalma la serie con la metodología anterior (desde 1980), reescalada por el cociente promedio de los primeros 12 trimestres en común. Referencias: máximo de 2006-08 y promedio 2010-19.",
  ks: ["debt_service"],
  f: () => {
    const s = S("debt_service"); if (!s) return null;
    const v = last(s)[1], pk = maxEntre(s, 2006, 2008), a = promEntre(s, 2010, 2019);
    const refs = []; if (pk) refs.push({ y: pk[1], l: `Máximo ${anio(pk[0])}: ${nf(pk[1])}%` }); if (a != null) refs.push({ y: a, l: `Promedio 2010-19: ${nf(a)}%` });
    return { freq: "Q", titulo: `Cuotas de deuda: ${nf(v)}% del ingreso disponible en ${fechaDe(s, "Q")}` + (a != null ? `; promedio 2010-19: ${nf(a)}%` : "") + (pk ? `; máximo de ${anio(pk[0])}: ${nf(pk[1])}%` : ""),
      sub: "Cuotas de hipotecas y crédito al consumo, % del ingreso disponible.", series: [{ n: "Servicio de la deuda / ingreso", d: cut(s), c: 1, w: 2.4 }], refs };
  } });

def("morosidad", { slug: "morosidad-de-tarjetas", nombre: "Morosidad de tarjetas y préstamos al consumo", sin: ["delinquency", "mora", "tarjetas", "default"],
  calc: "Tasa de morosidad (más de 30 días de atraso) de los préstamos de tarjetas de crédito y del total de préstamos al consumo de los bancos comerciales, desestacionalizada (Fed), % de los préstamos, trimestral. Referencias: promedio 2015-19 y máximo de 2008-10.",
  ks: ["delinq_cards", "delinq_consumer"],
  f: () => {
    const m = S("delinq_cards"); if (!m) return null;
    const v = last(m)[1], a = promEntre(m, 2015, 2019), pk = maxEntre(m, 2008, 2010), rec = maxEntre(m, 2022, 2100);
    const refs = []; if (pk) refs.push({ y: pk[1], l: `Máximo ${anio(pk[0])}: ${nf(pk[1], 2)}%` }); if (a != null) refs.push({ y: a, l: `Promedio 2015-19: ${nf(a, 2)}%` });
    const recTxt = rec && rec[0] < last(m)[0] && rec[1] > v ? `; máximo de ${anio(rec[0])}: ${nf(rec[1], 2)}%` : "";
    const tc = S("delinq_consumer");
    return { freq: "Q", titulo: `Morosidad de tarjetas ${nf(v, 2)}% en ${fechaDe(m, "Q")}` + recTxt + (a != null ? `; promedio 2015-19: ${nf(a, 2)}%` : "") + (pk ? `; ${anio(pk[0])}: ${nf(pk[1], 2)}%` : ""),
      sub: "Préstamos con más de 30 días de atraso, % del total, bancos comerciales." + (tc ? ` Total de préstamos al consumo: ${nf(last(tc)[1], 2)}%.` : ""),
      dec: 2, series: [{ n: "Tarjetas de crédito", d: cut(m), c: 1, w: 2.6 }].concat(tc ? [{ n: "Total préstamos al consumo", d: cut(tc), c: 0, w: 1.8 }] : []), refs };
  } });

// ═════════════════════════ Precios ═════════════════════════
// Promedio 2000-19 de la brecha CPI core − PCE core: convierte la meta de 2% (PCE) a la escala del CPI
function brechaCpiPce() {
  const a = yoy(S("cpi_core")), b = yoy(S("pce_core")); if (!a || !b) return null;
  return join(a, b, (x, y) => x - y);
}
def("pce", { slug: "pce", nombre: "Inflación PCE general y core", sin: ["inflación", "pce", "core pce", "precios", "meta"],
  calc: "Índice de precios del gasto de consumo personal (BEA), general y sin alimentos ni energía (core), variación interanual. Es la medida que apunta la Fed (meta 2%). El rombo es la mediana de la proyección de la Fed para el core a fin de año (Resumen de Proyecciones Económicas).",
  ks: ["pce_core", "pce_p", "sep_core"],
  f: () => {
    const c = yoy(S("pce_core")), h = yoy(S("pce_p")); if (!c || !h) return null;
    const sep = sepPuntos("sep_core");
    const ss = [{ n: "PCE core", d: cut(c), c: 0, w: 2.8 }, { n: "PCE general", d: cut(h), c: 1, w: 1.6 }];
    if (sep) ss.push({ n: "Proyección de la Fed para el core", t: "punto", c: 0, d: sep });
    return { titulo: `PCE core ${nf(last(c)[1])}% y general ${nf(last(h)[1])}% interanual en ${fechaDe(c)}; meta 2%` + (sep ? `; la Fed proyecta ${nf(sep[0][1])}% para el core a fin de ${anio(sep[0][0])}` : ""),
      sub: "Índice de precios del consumo personal (BEA), variación interanual. Core: sin alimentos ni energía.", dec: 1,
      series: ss, refs: [{ y: 2, l: "Meta Fed 2%" }] };
  } });

def("momentum", { slug: "momentum-del-core", nombre: "Core PCE a distintos horizontes", sin: ["desinflación", "3 meses", "6 meses", "momentum", "ritmo"],
  calc: "Core PCE (BEA): variación de cada mes anualizada (barras), anualizada a 3 meses, anualizada a 6 meses e interanual. Con períodos de 10 años o más se omiten las barras mensuales.",
  ks: ["pce_core"],
  f: () => {
    const c = S("pce_core"); if (!c) return null;
    const m1 = ann(c, 1), m3 = ann(c, 3), m6 = ann(c, 6), y = yoy(c);
    const ss = [];
    if (!periodoLargo()) ss.push({ n: "Cada mes, anualizado", d: cut(m1), t: "bar", c: 0, suave: true });
    ss.push({ n: "3 meses anualizado", d: cut(m3), c: 3, w: 1.6 }, { n: "6 meses anualizado", d: cut(m6), c: 0, w: 2.8 }, { n: "Interanual", d: cut(y), c: "gris", w: 1.4, punteada: true });
    return { titulo: `Core PCE anualizado en ${fechaDe(c)}: ${nf(last(m1)[1])}% en el mes, ${nf(last(m3)[1])}% a 3 meses, ${nf(last(m6)[1])}% a 6 meses y ${nf(last(y)[1])}% interanual`,
      sub: "Variación del core PCE anualizada a distintos horizontes. Barras: cada mes anualizado.", dec: 1,
      series: ss, refs: [{ y: 2, l: "Meta Fed 2%" }] };
  } });

def("subyacente", { slug: "inflacion-subyacente", nombre: "Núcleo de la inflación: mediana y media recortada", sin: ["mediana", "media recortada", "trimmed mean", "median cpi", "cleveland", "dallas", "subyacente"],
  calc: "Medidas del núcleo de la inflación, interanuales, en pares de la misma familia: PCE core (BEA) y PCE media recortada (Fed de Dallas: descarta cada mes los rubros con subas y bajas más extremas); CPI core (BLS) y CPI mediana (Fed de Cleveland: la suba del rubro del medio). Barras: PCE core menos media recortada, en puntos; la referencia es su promedio 2000-19.",
  ks: ["pce_core", "pce_trim", "cpi_core", "cpi_median"],
  f: () => {
    const c = yoy(S("pce_core")), t = S("pce_trim"), cc = yoy(S("cpi_core")), m = yoy(S("cpi_median")); if (!c) return null;
    const ss = [], refs = [{ y: 2, l: "Meta Fed 2%" }];
    const g = t ? join(c, t, (a, b) => a - b) : null, gp = g ? promEntre(g, 2000, 2019) : null;
    if (g) ss.push({ n: "PCE core − media recortada (pp)", d: cut(g), t: "bar", c: "gris", suave: true });
    ss.push({ n: "PCE core", d: cut(c), c: 0, w: 2.6 });
    if (t) ss.push({ n: "PCE media recortada (Dallas)", d: cut(t), c: 2, w: 1.8 });
    if (cc) ss.push({ n: "CPI core", d: cut(cc), c: 1, w: 1.4, punteada: true });
    if (m) ss.push({ n: "CPI mediana (Cleveland)", d: cut(m), c: 3, w: 1.4, punteada: true });
    if (gp != null) refs.push({ y: gp, l: `Brecha promedio 2000-19: ${sg(gp)} pp` });
    return { titulo: `Interanual en ${fechaDe(c)}: PCE core ${nf(last(c)[1])}%` + (t ? ` y media recortada ${nf(last(t)[1])}% (brecha ${sg(last(g)[1])} pp; promedio 2000-19: ${sg(gp)})` : "") + (cc && m ? `; CPI core ${nf(last(cc)[1])}% y mediana ${nf(last(m)[1])}%` : ""),
      sub: "Medidas que descartan los rubros extremos (Fed de Dallas y de Cleveland). Barras: PCE core menos media recortada.", dec: 1, series: ss, refs };
  } });

export function rubros() { return Object.keys(ST.DATA.series).filter(k => k.startsWith("cat:")).map(k => ({ k, n: ST.DATA.series[k].n, a3: ann(S(k), 3) })).filter(r => r.a3); }
// Pesos de los 13 rubros del core: gasto nominal de cada rubro sobre la suma de los 13 (BEA, tabla 2.8.5)
function pesosRubros(rs) {
  const g = rs.map(r => ({ n: r.n, m: new Map(S("peso:" + r.n) || []) })); if (g.some(x => !x.m.size)) return null;
  const ts = [...g[0].m.keys()].filter(t => g.every(x => x.m.has(t)));
  const out = new Map(g.map(x => [x.n, new Map()]));
  for (const t of ts) { const tot = g.reduce((s, x) => s + x.m.get(t), 0); for (const x of g) out.get(x.n).set(t, x.m.get(t) / tot); }
  return out;
}
const pesoEn = (m, t) => { if (!m || !m.size) return null; if (m.has(t)) return m.get(t); const ks = [...m.keys()].filter(k => k <= t); return ks.length ? m.get(ks[ks.length - 1]) : null; };

def("heat", { slug: "rubros-del-core", nombre: "Mapa de calor: rubros del core PCE", sin: ["rubros", "componentes", "heatmap", "vivienda", "salud", "autos", "aporte"],
  calc: "Inflación anualizada a 3 meses de los 13 rubros del PCE core (BEA, tabla NIPA 2.8.4), últimos 18 meses. El peso de cada rubro es su gasto nominal sobre el de los 13 (tabla 2.8.5) y su aporte es peso × inflación del rubro, en puntos de la inflación anualizada a 3 meses del conjunto. Orden: por aporte en el último mes. \"Vivienda y servicios públicos\" incluye electricidad y gas, que no son core: BEA no publica la vivienda sola en este cuadro. No depende del período elegido.",
  ks: ["cat:Salud", "peso:Salud"],
  f: () => {
    const rs = rubros(); if (rs.length < 5) return null;
    const fechas = rs[0].a3.slice(-18).map(p => p[0]), tu = fechas[fechas.length - 1];
    const pw = pesosRubros(rs);
    const ult = rs.map(r => { const m = new Map(r.a3), v = last(r.a3)[1], w = pw ? pesoEn(pw.get(r.n), tu) : null; return { n: r.n, m, v, w, ap: w != null ? w * v : null }; })
      .sort((a, b) => pw ? b.ap - a.ap : b.v - a.v);
    const data = []; ult.forEach((r, yi) => fechas.forEach((t, xi) => { const v = r.m.get(t); if (v != null) data.push([xi, yi, v]); }));
    const cal = ult.filter(r => r.v > 3), wcal = pw ? cal.reduce((s, r) => s + r.w, 0) * 100 : null;
    const top = pw ? ult.slice(0, 3).map(r => `${r.n.toLowerCase()} (${sg(r.ap, 2)} pp)`).join(", ") : "";
    const filas = ult.map(r => r.w != null ? `${r.n} · ${nf(r.w * 100, 0)}%` : r.n);
    return { tipo: "heat", izq: pw ? 214 : 182,
      titulo: pw ? `Rubros que más aportan al core a 3 meses en ${fm(tu)}: ${top}; ${cal.length} de ${ult.length} rubros, que pesan ${nf(wcal, 0)}% del core, corren arriba de 3%`
        : `${cal.length} de ${ult.length} rubros del núcleo corren arriba de 3% anual`,
      sub: "Inflación por rubro del PCE core, anualizada a 3 meses." + (pw ? " Junto al nombre, su peso en el core; orden por aporte (peso × inflación)." : " Ordenado por el último mes.") + " Gris = cerca de 2%; rojo, arriba; azul, abajo.",
      fuenteTxt: "BEA, tablas NIPA 2.8.4 y 2.8.5", cols: fechas.map(fm), filas, data, series: [],
      tip: v => { const r = ult[v[1]], w = r.w != null ? pesoEn(pw.get(r.n), fechas[v[0]]) : null; return `<b>${esc(r.n)}</b><br>${fm(fechas[v[0]])}: ${nf(v[2], 1)}% anualizado 3m` + (w != null ? `<br>Peso ${nf(w * 100, 1)}% · aporte ${sg(w * v[2], 2)} pp` : ""); },
      tabla: { cab: ["Rubro", "Peso", "Aporte", ...fechas.slice(-6).map(fm)], filas: ult.map(r => [r.n, r.w != null ? nf(r.w * 100, 1) + "%" : "–", r.ap != null ? sg(r.ap, 2) : "–", ...fechas.slice(-6).map(t => nf(r.m.get(t)))]) } };
  } });

def("difusion", { slug: "difusion", nombre: "Difusión de la inflación", sin: ["amplitud", "rubros arriba de 3%", "difusión"],
  calc: "Parte del core PCE en rubros con inflación anualizada a 3 meses mayor a 3%: suma de los pesos (gasto nominal, BEA tabla 2.8.5) de esos rubros entre los 13 del core; promedio móvil de 3 meses. En gris, la versión simple (cada rubro pesa igual). Referencias: promedio 2015-19 y máximo de 2021-23. Los rubros arrancan en 1999.",
  ks: ["cat:Salud", "peso:Salud"],
  f: () => {
    const rs = rubros(); if (rs.length < 5) return null;
    const pw = pesosRubros(rs), mS = new Map(), mW = new Map();
    for (const r of rs) for (const [t, v] of r.a3) {
      const e = mS.get(t) || [0, 0]; e[0] += v > 3 ? 1 : 0; e[1]++; mS.set(t, e);
      const w = pw ? pesoEn(pw.get(r.n), t) : null; if (w != null) { const f = mW.get(t) || [0, 0]; f[0] += v > 3 ? w : 0; f[1] += w; mW.set(t, f); }
    }
    const simple = roll([...mS].sort((a, b) => a[0] - b[0]).map(([t, [a, n]]) => [t, a / n * 100]), 3);
    const pond = mW.size ? roll([...mW].sort((a, b) => a[0] - b[0]).map(([t, [a, n]]) => [t, a / n * 100]), 3) : null;
    const base = pond || simple, p = promEntre(base, 2015, 2019), mx = maxEntre(base, 2021, 2023);
    const refs = []; if (p != null) refs.push({ y: p, l: `Promedio 2015-19: ${nf(p, 0)}%` }); if (mx) refs.push({ y: mx[1], l: `Máximo ${anio(mx[0])}: ${nf(mx[1], 0)}%` });
    const ss = pond ? [{ n: "Ponderada por gasto", d: cut(pond), c: 1, w: 2.8 }, { n: "Cada rubro pesa igual", d: cut(simple), c: "gris", w: 1.4 }] : [{ n: "Rubros arriba de 3%", d: cut(simple), c: 1, w: 2.8 }];
    return { titulo: (pond ? `En ${fechaDe(pond)}, rubros que pesan ${nf(last(pond)[1], 0)}% del core corren arriba de 3% anual (${nf(last(simple)[1], 0)}% de los rubros)` : `${nf(last(simple)[1], 0)}% de los rubros del core corren arriba de 3% anual en ${fechaDe(simple)}`)
        + (p != null ? `; promedio 2015-19: ${nf(p, 0)}%` : "") + (mx ? `; máximo ${anio(mx[0])}: ${nf(mx[1], 0)}%` : ""),
      sub: "Parte del core PCE con inflación anualizada a 3 meses mayor a 3%. Promedio móvil de 3 meses.", fuenteTxt: "BEA, tablas NIPA 2.8.4 y 2.8.5",
      dec: 0, yMin: 0, yMax: 100, series: ss, refs };
  } });

// Bienes core del PCE: rubros de bienes del core ponderados por su gasto de un año antes (aproximación al agregado de BEA)
const BIENES_CORE = ["Autos y repuestos", "Muebles y equipamiento", "Recreación (bienes)", "Otros durables", "Indumentaria y calzado", "Otros no durables"];
function bienesCorePce() {
  const xs = BIENES_CORE.map(n => ({ y: new Map(yoy(S("cat:" + n)) || []), w: new Map(S("peso:" + n) || []) })); if (xs.some(x => !x.y.size || !x.w.size)) return null;
  const ts = [...xs[0].y.keys()].filter(t => xs.every(x => x.y.has(t)));
  const out = [];
  for (const t of ts) { const d = new Date(t), t12 = Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), 1); const ws = xs.map(x => x.w.get(t12)); if (ws.some(w => w == null)) continue;
    const tot = ws.reduce((s, w) => s + w, 0); out.push([t, xs.reduce((s, x, i) => s + ws[i] / tot * x.y.get(t), 0)]); }
  return out.length ? out : null;
}
def("serviciosBienes", { slug: "servicios-y-bienes", nombre: "Inflación de servicios, supercore y bienes core", sin: ["supercore", "servicios", "bienes", "bienes core"],
  calc: "Índices de precios PCE de servicios y de servicios sin energía ni vivienda (supercore), BEA, variación interanual. Bienes core: los 6 rubros de bienes del PCE sin alimentos ni energía, ponderados por su gasto de un año antes (aproximación al agregado de BEA); si faltan los pesos, CPI de bienes sin alimentos ni energía (BLS). Entre paréntesis, el promedio 2015-19.",
  ks: ["pce_services", "pce_supercore", "cpi_core_goods"],
  f: () => {
    const s = yoy(S("pce_services")), sc = yoy(S("pce_supercore")), bp = bienesCorePce(), g = bp || yoy(S("cpi_core_goods")); if (!s || !g) return null;
    const pr = a => promEntre(a, 2015, 2019), nb = bp ? "Bienes core (PCE)" : "Bienes core (CPI)";
    const ss = [{ n: `Servicios (2015-19: ${nf(pr(s))}%)`, d: cut(s), c: 0, w: 2.4 }];
    if (sc) ss.push({ n: `Supercore (2015-19: ${nf(pr(sc))}%)`, d: cut(sc), c: 2, w: 2.4 });
    ss.push({ n: `${nb} (2015-19: ${nf(pr(g))}%)`, d: cut(g), c: 1, w: 2.4 });
    return { titulo: `Interanual en ${fechaDe(s)}: servicios ${nf(last(s)[1])}% (2015-19: ${nf(pr(s))}%)` + (sc ? `, supercore ${nf(last(sc)[1])}% (${nf(pr(sc))}%)` : "") + `, bienes core ${nf(last(g)[1])}% (${nf(pr(g))}%)`,
      sub: "Índices PCE. Supercore: servicios sin energía ni vivienda. Bienes core: sin alimentos ni energía" + (bp ? "." : ", medidos con el CPI."), dec: 1, series: ss, refs: [{ y: 0 }] };
  } });

def("ppi", { slug: "ppi", nombre: "Precios al productor vs al consumidor", sin: ["ppi", "mayoristas", "productor", "cañería"],
  calc: "Índice de precios al productor para la demanda final (BLS), general y sin alimentos ni energía, contra el CPI sin alimentos ni energía, variación interanual. Barras: PPI core menos CPI core. El BLS no desestacionaliza el PPI core, por eso sólo se muestra interanual. La serie arranca en 2010. Desde entonces, la correlación del PPI core con el CPI core es 0,82 en el mismo mes y 0,88 con el CPI core de 3 a 6 meses después.",
  ks: ["ppi_fd", "ppi_core", "cpi_core"],
  f: () => {
    const a = yoy(S("ppi_fd")), b = yoy(S("ppi_core")), c = yoy(S("cpi_core")); if (!a) return null;
    const ss = [], g = b && c ? join(b, c, (x, y) => x - y) : null;
    if (g) ss.push({ n: "PPI core − CPI core (pp)", d: cut(g), t: "bar", c: "gris", suave: true });
    if (b) ss.push({ n: "PPI sin alimentos ni energía", d: cut(b), c: 0, w: 2.8 });
    if (c) ss.push({ n: "CPI sin alimentos ni energía", d: cut(c), c: 1, w: 1.8 });
    ss.push({ n: "PPI demanda final", d: cut(a), c: "gris", w: 1.4, punteada: true });
    return { titulo: `Interanual en ${fechaDe(a)}: ` + (b && c ? `PPI core ${nf(last(b)[1])}% y CPI core ${nf(last(c)[1])}% (brecha ${sg(last(g)[1])} pp); ` : "") + `PPI general ${nf(last(a)[1])}%`,
      sub: "Precios al productor (BLS) contra precios al consumidor. Desde 2010, el PPI core se correlaciona más con el CPI core de 3 a 6 meses después (0,88) que con el del mismo mes (0,82).",
      dec: 1, series: ss, refs: [{ y: 0 }] };
  } });

def("bienesCore", { slug: "bienes-core-y-aranceles", nombre: "Bienes core, precios de importación y arancel efectivo", sin: ["aranceles", "tariffs", "bienes core", "importación", "core goods", "traslado"],
  calc: "CPI de bienes sin alimentos ni energía (BLS) y precios de importación sin combustibles (BLS), variación interanual; el precio de importación se mide sin el arancel y no está desestacionalizado. Eje derecho: tasa arancelaria efectiva, recaudación de aduana sobre importaciones de bienes (BEA, trimestral).",
  ks: ["cpi_core_goods", "import_sin_comb", "import_prices", "customs", "imp_goods"],
  f: () => {
    const g = yoy(S("cpi_core_goods")); if (!g) return null;
    const sc = !!S("import_sin_comb"), i = yoy(S("import_sin_comb") || S("import_prices"));
    const t = join(S("customs"), S("imp_goods"), (a, b) => a / b * 100);
    const ss = [{ n: "CPI bienes core", d: cut(g), c: 1, w: 2.8 }];
    if (i) ss.push({ n: sc ? "Importados sin combustibles (sin arancel)" : "Importados, todos (sin arancel)", d: cut(i), c: 0, w: 1.8 });
    if (t) ss.push({ n: "Arancel efectivo (eje derecho)", d: cut(t), c: 3, w: 1.8, der: true, u: "%" });
    return { titulo: `Interanual en ${fechaDe(g)}: CPI bienes core ${nf(last(g)[1])}%` + (i ? `, importados ${sc ? "sin combustibles" : "con combustibles"} (antes del arancel) ${nf(last(i)[1])}%` : "") + (t ? `; arancel efectivo ${nf(last(t)[1])}% (${fechaDe(t, "Q")})` : ""),
      sub: "Precios al consumidor de bienes sin alimentos ni energía, precios de importación sin arancel" + (sc ? " ni combustibles" : "") + ", y recaudación de aduana sobre importaciones de bienes (eje derecho).",
      dec: 1, series: ss, refs: [{ y: 0 }] };
  } });

def("cpiPce", { slug: "cpi-vs-pce", nombre: "CPI core vs PCE core", sin: ["cpi", "ipc", "inflación minorista", "brecha"],
  calc: "CPI sin alimentos ni energía (BLS) y PCE core (BEA), variación interanual. Barras: CPI core menos PCE core, en puntos; la referencia es su promedio 2000-19. Ponderan distinto: el CPI pesa más la vivienda; el PCE, salud y servicios financieros. La Fed apunta al PCE; el CPI es el dato del día de mercado y el que indexa los bonos TIPS.",
  ks: ["cpi_core", "pce_core"],
  f: () => {
    const a = yoy(S("cpi_core")), b = yoy(S("pce_core")); if (!a || !b) return null;
    const g = join(a, b, (x, y) => x - y), p = promEntre(g, 2000, 2019), v = last(g)[1];
    let n = 0; for (let i = g.length - 1; i >= 0 && Math.sign(g[i][1]) === Math.sign(v); i--) n++;
    const racha = n >= 3 ? `; el ${v < 0 ? "PCE" : "CPI"} corre arriba ${n >= 24 ? `desde ${fm(g[g.length - n][0])}` : `hace ${n} meses`}` : "";
    return { titulo: `Interanual en ${fechaDe(a)}: CPI core ${nf(last(a)[1])}% y PCE core ${nf(last(b)[1])}%; brecha ${sg(v, 2)} pp (promedio 2000-19: ${sg(p, 2)})` + racha,
      sub: "CPI (BLS) menos PCE (BEA), ambos sin alimentos ni energía. El CPI pesa más la vivienda; el PCE, salud y servicios financieros.", dec: 1,
      series: [{ n: "CPI core − PCE core (pp)", d: cut(g), t: "bar", c: "gris", suave: true, dec: 2 }, { n: "PCE core", d: cut(b), c: 0, w: 2.4 }, { n: "CPI core", d: cut(a), c: 1, w: 2 }],
      refs: [{ y: 0 }].concat(p != null ? [{ y: p, l: `Brecha promedio 2000-19: ${sg(p, 2)} pp` }] : []) };
  } });

def("vivienda", { slug: "cpi-vivienda", nombre: "CPI vivienda y core sin vivienda", sin: ["shelter", "alquileres", "vivienda", "oer", "supercore"],
  calc: "Componente de vivienda del CPI (alquileres y alquiler equivalente de los propietarios, BLS), interanual y anualizado a 3 meses, y CPI sin alimentos, vivienda ni energía (BLS), interanual. La vivienda es más del 40% del CPI core. La referencia es el promedio 2015-19 de la vivienda.",
  ks: ["cpi_shelter", "cpi_sin_vivienda"],
  f: () => {
    const v = S("cpi_shelter"); if (!v) return null;
    const y = yoy(v), m3 = ann(v, 3), sv = yoy(S("cpi_sin_vivienda")), p = promEntre(y, 2015, 2019);
    const ss = [{ n: "Vivienda, interanual", d: cut(y), c: 1, w: 2.8 }, { n: "Vivienda, 3 meses anualizado", d: cut(m3), c: 1, fina: true }];
    if (sv) ss.push({ n: "CPI core sin vivienda", d: cut(sv), c: 0, w: 2 });
    return { titulo: `CPI vivienda ${nf(last(y)[1])}% interanual y ${nf(last(m3)[1])}% anualizado a 3 meses en ${fechaDe(y)} (promedio 2015-19: ${nf(p)}%)` + (sv ? `; CPI core sin vivienda ${nf(last(sv)[1])}%` : ""),
      sub: "Alquileres y alquiler equivalente de los propietarios. La vivienda es más del 40% del CPI core; la otra línea es el core sin ella.", dec: 1,
      series: ss, refs: p != null ? [{ y: p, l: `Vivienda, promedio 2015-19: ${nf(p)}%` }] : [] };
  } });

// Del core al general: aporte de core, alimentos y energía al PCE general (peso de un año antes × variación interanual)
def("componentes", { slug: "del-core-al-general", nombre: "Del core al general: aporte de alimentos y energía", sin: ["alimentos", "comida", "energía", "nafta", "combustibles", "general vs core"],
  calc: "Aporte de cada parte al PCE general interanual, en puntos: su gasto nominal un año antes sobre el gasto total (BEA, tabla 2.8.5) por su variación de precios interanual (core, alimentos para consumo en el hogar y energía, BEA). La suma se aproxima al PCE general (línea); la diferencia es el efecto de la cadena de ponderaciones. En períodos de más de 5 años se muestra el último mes de cada trimestre.",
  ks: ["pce_p", "pce_core", "pce_food", "pce_energy", "peso:PCE total"],
  f: () => {
    const h = yoy(S("pce_p")), partes = [["Core", "pce_core", "PCE core", 0], ["Alimentos", "pce_food", "Alimentos", 2], ["Energía", "pce_energy", "Energía", 1]];
    const tot = new Map(S("peso:PCE total") || []);
    const ps = partes.map(([n, k, pk, c]) => ({ n, c, y: new Map(yoy(S(k)) || []), w: new Map(S("peso:" + pk) || []) }));
    if (!h || !tot.size || ps.some(p => !p.y.size || !p.w.size)) {
      const e = yoy(S("pce_energy")), f = yoy(S("pce_food")), c = yoy(S("pce_core")); if (!e || !f || !c) return null;
      return { titulo: `Interanual en ${fechaDe(c)}: core ${nf(last(c)[1])}%, alimentos ${nf(last(f)[1])}%, energía ${nf(last(e)[1])}%`, sub: "Índices de precios PCE (BEA).", dec: 1,
        series: [{ n: "Core", d: cut(c), c: 0, w: 2.6 }, { n: "Alimentos", d: cut(f), c: 2 }, { n: "Energía (eje derecho)", d: cut(e), c: 1, der: true, u: "%" }], refs: [{ y: 0 }] };
    }
    const t12 = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), 1); };
    const mh = new Map(h);
    let ts = h.map(p => p[0]).filter(t => t >= ST.T0 && t <= ST.T1 && tot.has(t12(t)) && ps.every(p => p.y.has(t) && p.w.has(t12(t))));
    if (!ts.length) return null;
    const trim = ts.length > 60; if (trim) ts = ts.filter(t => new Date(t).getUTCMonth() % 3 === 2 || t === ts[ts.length - 1]);
    const series = ps.map(p => ({ n: p.n, t: "bar", c: p.c, d: ts.map(t => p.w.get(t12(t)) / tot.get(t12(t)) * p.y.get(t)) }));
    series.push({ n: "PCE general", t: "line", c: "ink", w: 2.2, d: ts.map(t => mh.get(t)) });
    const u = ts.length - 1, v = i => series[i].d[u], yv = i => ps[i].y.get(ts[u]);
    return { tipo: "cat", freq: "M", sinPuntos: true,
      titulo: `PCE general ${nf(mh.get(ts[u]))}% interanual en ${fm(ts[u])}: core ${sg(v(0), 2)} pp, energía ${sg(v(2), 2)} pp, alimentos ${sg(v(1), 2)} pp; energía ${sg(yv(2))}% y alimentos ${sg(yv(1))}% interanual`,
      sub: "Aporte de cada parte al PCE general interanual, en puntos (peso de un año antes × variación interanual)." + (trim ? " Último mes de cada trimestre." : ""),
      unidadLinea: "%", cats: ts.map(fm), series };
  } });

def("expectativas", { slug: "expectativas-de-inflacion", nombre: "Expectativas de inflación", sin: ["breakeven", "5y5y", "michigan", "anclaje", "expectativas"],
  calc: "Inflación esperada implícita en los bonos del Tesoro indexados al CPI (Fed de St. Louis, diaria): 5 años dentro de 5 años, breakeven a 5 y a 10 años. Eje derecho: inflación esperada a 1 año por los hogares (Universidad de Michigan, mensual). Como los bonos ajustan por CPI y la meta de la Fed es de PCE, la referencia es 2% más la brecha promedio CPI − PCE core de 2000-19.",
  ks: ["infl_exp_5y5y", "breakeven5", "breakeven10", "infl_exp_1y"],
  f: () => {
    const f = SD("infl_exp_5y5y"), b5 = SD("breakeven5"), b10 = SD("breakeven10"), m = S("infl_exp_1y"); if (!f) return null;
    const pr = a => promEntre(a, 2015, 2019), br = brechaCpiPce(), eq = br ? 2 + promEntre(br, 2000, 2019) : null;
    const ss = [{ n: "Mercado, 5 años dentro de 5", d: cut(f), c: 0, w: 2.8, dec: 2 }];
    if (b5) ss.push({ n: "Breakeven 5 años", d: cut(b5), c: 2, w: 1.4, dec: 2 });
    if (b10) ss.push({ n: "Breakeven 10 años", d: cut(b10), c: 3, w: 1.4, dec: 2 });
    if (m) ss.push({ n: "Hogares, 1 año (eje derecho)", d: cut(m), c: 1, w: 1.8, der: true, u: "%", dec: 1 });
    const fS = S("infl_exp_5y5y"), b10S = S("breakeven10");
    return { titulo: `Mercado: 5y5y ${nf(last(f)[1], 2)}% (2015-19: ${nf(pr(fS), 2)}%)` + (b5 ? `, breakeven 5 años ${nf(last(b5)[1], 2)}%` : "") + (b10 ? `, 10 años ${nf(last(b10)[1], 2)}%` : "") + (m ? `; hogares a 1 año ${nf(last(m)[1])}% (2015-19: ${nf(pr(m))}%)` : ""),
      sub: "Inflación esperada implícita en bonos indexados al CPI (diaria) y encuesta de hogares de la Universidad de Michigan (mensual, eje derecho).",
      dec: 2, decEje: 1, series: ss, refs: eq != null ? [{ y: eq, l: `Meta 2% PCE ≈ ${nf(eq, 2)}% en CPI` }] : [{ y: 2, l: "2%" }] };
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

// ═════════════════════════ Empleo ═════════════════════════
// Recesiones fechadas por la NBER (las mismas que sombrea el gráfico)
const RECESIONES_NBER = [["1948-11", "1949-10"], ["1953-07", "1954-05"], ["1957-08", "1958-04"], ["1960-04", "1961-02"], ["1969-12", "1970-11"], ["1973-11", "1975-03"], ["1980-01", "1980-07"],
  ["1981-07", "1982-11"], ["1990-07", "1991-03"], ["2001-03", "2001-11"], ["2007-12", "2009-06"], ["2020-02", "2020-04"]].map(([a, b]) => [P(a + "-01"), P(b + "-01")]);
const prom12 = a => a && a.length >= 12 ? a.slice(-12).reduce((s, p) => s + p[1], 0) / 12 : null;
// Revisión de los dos meses previos contra su primera publicación (ALFRED)
function revisionNominas(d) {
  const prim = ST.DATA.primeras && ST.DATA.primeras.payrolls; if (!prim) return null;
  let tot = 0, n = 0;
  for (const i of [1, 2]) { const obs = new Date(d[d.length - 1 - i][0]).toISOString().slice(0, 10), r = prim[obs]; if (r) { tot += d[d.length - 1 - i][1] - (r[2] - r[1]); n++; } }
  return n ? { tot, n } : null;
}
def("nominas", { slug: "nominas", nombre: "Nóminas no agrícolas", sin: ["payrolls", "nfp", "empleo", "puestos de trabajo"],
  calc: "Variación mensual del empleo asalariado no agrícola (BLS, encuesta de establecimientos), en miles: barras, el dato de cada mes; líneas, los promedios de 3 y de 12 meses. La referencia es el promedio mensual 2015-19. La revisión compara los dos meses previos con su primera publicación (archivo de versiones ALFRED).",
  ks: ["payrolls"],
  f: () => {
    const p = S("payrolls"); if (!p) return null;
    const d = diff(p), m3 = roll(d, 3), m12 = roll(d, 12), pr = promEntre(d, 2015, 2019), rv = revisionNominas(d);
    return { titulo: `Nóminas ${sg(last(d)[1], 0)} mil en ${fechaDe(d)}; promedio 3 meses ${nf(last(m3)[1], 0)} mil, 12 meses ${nf(last(m12)[1], 0)} mil (2015-19: ${nf(pr, 0)} mil)` + (rv ? `; revisión de los ${rv.n === 2 ? "dos meses" : "mes"} previo${rv.n === 2 ? "s" : ""}: ${sg(rv.tot, 0)} mil` : ""),
      sub: "Variación mensual del empleo asalariado no agrícola (BLS, encuesta de establecimientos), en miles.",
      unidad: "mil", dec: 0, eventos: false, shock: [T(2020, 3), T(2021, 6)], shockVentana: [T(2020, 3), T(2021, 6)],
      series: [{ n: "Cambio mensual", d: cut(d), t: "bar", c: 0, suave: true }, { n: "Promedio 3 meses", d: cut(m3), c: 0, w: 2.6 }, { n: "Promedio 12 meses", d: cut(m12), c: 1, w: 1.6 }],
      refs: [{ y: 0 }].concat(pr != null ? [{ y: pr, l: `Promedio 2015-19: ${nf(pr, 0)} mil` }] : []) };
  } });

def("composicion", { slug: "quien-crea-empleo", nombre: "¿Quién crea el empleo?", sin: ["salud", "gobierno", "empleo privado", "sectores", "composición", "nóminas por sector"],
  calc: "Variación mensual del empleo, promedio de 3 meses, en miles (BLS): sector privado sin salud y asistencia social, salud y asistencia social, y gobierno. La línea es el total. El título suma los últimos 12 meses. En 2015-19, el privado sin salud explicó el 72% del empleo creado, salud el 21% y el gobierno el 7%.",
  ks: ["payrolls_priv", "payrolls_health", "payrolls_gov"],
  f: () => {
    const p = S("payrolls_priv"), h = S("payrolls_health"), g = S("payrolls_gov"); if (!p || !h || !g) return null;
    const ps = join(p, h, (a, b) => a - b);
    const partes = [["Privado sin salud", ps, 0], ["Salud y asistencia social", h, 2], ["Gobierno", g, 1]]
      .map(([n, a, c]) => ({ n, c, t: "bar", stack: "e", d: cut(roll(diff(a), 3)), a }));
    const tot = cut(roll(diff(join(p, g, (a, b) => a + b)), 3));
    const d12 = a => a.length > 12 ? a[a.length - 1][1] - a[a.length - 13][1] : null;
    const [r, s_, gv] = partes.map(x => d12(x.a)), t = r + s_ + gv;
    const m = partes.map(x => last(x.d)[1]);
    return { titulo: `Empleo creado en 12 meses a ${fechaDe(ps)}: ${sg(t, 0)} mil; salud ${sg(s_, 0)} mil, privado sin salud ${sg(r, 0)} mil, gobierno ${sg(gv, 0)} mil; último promedio de 3 meses: ${sg(m[1], 0)}, ${sg(m[0], 0)} y ${sg(m[2], 0)} mil por mes`,
      sub: "Variación mensual del empleo por sector, promedio de 3 meses, en miles (BLS). Línea: total.",
      unidad: "mil", dec: 0, cero: true, eventos: false, shock: [T(2020, 3), T(2021, 6)], shockVentana: [T(2020, 3), T(2021, 6)],
      series: partes.map(({ a, ...x }) => x).concat([{ n: "Total", d: tot, c: "ink", w: 2 }]), refs: [{ y: 0 }] };
  } });

def("desempleo", { slug: "desempleo", nombre: "Tasa de desempleo", sin: ["unemployment", "u3", "desocupación", "tasa natural", "nairu"],
  calc: "Tasa de desempleo U-3 y desempleo ampliado U-6 (BLS, encuesta de hogares), % de la fuerza laboral. El U-6 suma a quienes dejaron de buscar y a quienes trabajan menos horas de las que quieren. En gris, la tasa de desempleo no cíclica (natural) que estima la Oficina de Presupuesto del Congreso (CBO), trimestral. El rombo es la mediana de la proyección de la Fed para fin de año.",
  ks: ["unemployment", "u6", "nrou", "sep_unemp"],
  f: () => {
    const u = S("unemployment"); if (!u) return null;
    const v = last(u)[1], u12 = u.slice(-12), mn = Math.min(...u12.map(p => p[1])), mx = Math.max(...u12.map(p => p[1]));
    const nat = S("nrou"), natV = nat ? valorEn(nat, last(u)[0]) : null;
    const ciclo = u.filter(p => p[0] >= T(2021, 6)), pmin = ciclo.length ? ciclo.reduce((m, p) => p[1] < m[1] ? p : m) : null;
    const u6 = S("u6"), sep = sepPuntos("sep_unemp");
    const pos = v <= mn ? "mínimo de 12 meses" : v >= mx ? "máximo de 12 meses" : `rango de 12 meses ${nf(mn)}–${nf(mx)}%`;
    const ss = [{ n: "Desempleo (U-3)", d: cut(u), c: 0, w: 2.8 }];
    if (u6) ss.push({ n: "Desempleo ampliado (U-6)", d: cut(u6), c: 1, w: 1.6 });
    if (nat) ss.push({ n: "Tasa natural (CBO)", d: cut(nat.filter(p => p[0] <= last(u)[0])), c: "gris", w: 1.6, punteada: true, escalon: true, fin: false });
    if (sep) ss.push({ n: "Proyección de la Fed (U-3)", t: "punto", c: 0, d: sep });
    return { titulo: `Desempleo ${nf(v)}% en ${fechaDe(u)}, ${pos}` + (v <= mn && mx > v ? ` (máximo: ${nf(mx)}%)` : "") + (natV ? `; tasa natural CBO ${nf(natV[1])}%` : "") + (pmin ? `; mínimo del ciclo ${nf(pmin[1])}% (${fm(pmin[0])})` : "") + (u6 ? `; U-6 ${nf(last(u6)[1])}%` : "") + (sep ? `; la Fed proyecta ${nf(sep[0][1])}% a fin de ${anio(sep[0][0])}` : ""),
      sub: "U-3 y U-6 (BLS, encuesta de hogares), % de la fuerza laboral. Gris: tasa de desempleo no cíclica estimada por la CBO.", series: ss };
  } });

def("sahm", { slug: "regla-de-sahm", nombre: "Regla de Sahm", sin: ["recesión", "sahm"], historia: true,
  calc: "Promedio de 3 meses de la tasa de desempleo menos su mínimo de los 12 meses previos, en tiempo real (Fed de St. Louis). Las marcas señalan cada vez que cruzó 0,5 pp desde abajo, con su año; las bandas grises son las recesiones fechadas por la NBER.",
  ks: ["sahm"],
  f: () => {
    const s = S("sahm"); if (!s) return null;
    const v = last(s)[1], cr = [];
    for (let i = 1; i < s.length; i++) if (s[i][1] >= 0.5 && s[i - 1][1] < 0.5 && (!cr.length || s[i][0] - cr[cr.length - 1][0] > 365 * DIA)) cr.push(s[i]);
    const rec = s.filter(p => p[0] >= T(2023)).reduce((m, p) => p[1] > m[1] ? p : m, [0, -Infinity]);
    const enRec = t => RECESIONES_NBER.some(([a, b]) => t >= a - 200 * DIA && t <= b + 60 * DIA);
    const falsos = cr.filter(p => !enRec(p[0]) && p[0] >= T(1960));
    const vis = cr.filter(p => p[0] >= ST.T0);
    return { titulo: `Regla de Sahm ${sg(v, 2)} pp en ${fechaDe(s)} (umbral 0,5)` + (rec[1] > -Infinity && rec[1] >= 0.3 ? `; máximo reciente ${nf(rec[1], 2)} en ${fm(rec[0])}` + (rec[1] >= 0.5 && !enRec(rec[0]) ? ", cruce sin recesión hasta hoy" : "") : ""),
      sub: `Promedio de 3 meses del desempleo menos su mínimo de los 12 meses previos (Fed de St. Louis). Desde 1960 cruzó 0,5 en el inicio de cada recesión` + (falsos.length ? ` y ${falsos.length} ${falsos.length === 1 ? "vez" : "veces"} sin recesión (${falsos.map(p => anio(p[0])).join(" y ")}).` : "."),
      dec: 2, decEje: 1, unidad: "pp",
      series: [{ n: "Indicador de Sahm", d: cut(s), c: 1, w: 2.4 }].concat(vis.length ? [{ n: "Cruces de 0,5", t: "nota", c: 1, d: vis, textos: vis.map(p => String(anio(p[0]))), enLeyenda: false }] : []),
      refs: [{ y: 0.5, l: "Umbral 0,5 pp" }, { y: 0 }] };
  } });

def("tension", { slug: "vacantes-por-desocupado", nombre: "Vacantes por desocupado", sin: ["jolts", "vacantes", "tensión laboral"],
  calc: "Vacantes (BLS, encuesta JOLTS) sobre desocupados (BLS, encuesta de hogares). La línea de 1 marca igual número de vacantes que de desocupados. JOLTS tiene baja tasa de respuesta y se revisa mucho: el cociente hereda ese ruido.",
  ks: ["openings", "unemployed"],
  f: () => {
    const o = S("openings"), u = S("unemployed"); if (!o || !u) return null;
    const r = join(o, u, (a, b) => a / b), v = last(r)[1];
    const y19 = promEntre(r, 2019, 2019), p = promEntre(r, 2015, 2019), mx = maxEntre(r, 2021, 2023);
    const refs = [{ y: 1, l: "1 vacante por desocupado" }];
    if (y19 != null) refs.push({ y: y19, l: `2019: ${nf(y19, 2)}` }); if (p != null) refs.push({ y: p, l: `Promedio 2015-19: ${nf(p, 2)}` }); if (mx) refs.push({ y: mx[1], l: `Máximo ${fm(mx[0])}: ${nf(mx[1], 2)}` });
    return { titulo: `${nf(v, 2)} vacantes por desocupado en ${fechaDe(r)}` + (y19 != null ? `; 2019: ${nf(y19, 2)}` : "") + (p != null ? `; promedio 2015-19: ${nf(p, 2)}` : "") + (mx ? `; máximo ${fm(mx[0])}: ${nf(mx[1], 2)}` : ""),
      sub: "Vacantes (BLS, encuesta JOLTS) sobre desocupados (BLS, encuesta de hogares).", unidad: "", dec: 2,
      series: [{ n: "Vacantes por desocupado", d: cut(r), c: 0, w: 2.6 }], refs };
  } });

def("rotacion", { slug: "contrataciones-renuncias-despidos", nombre: "Contrataciones, renuncias y despidos", sin: ["jolts", "hires", "quits", "layoffs", "renuncias", "despidos", "contrataciones", "rotación"],
  calc: "Tasas de contrataciones, renuncias voluntarias y despidos, % del empleo por mes (BLS, JOLTS). Entre paréntesis, el promedio 2015-19. El título agrega hasta dónde hay que ir para encontrar un valor tan extremo, sin contar 2020.",
  ks: ["hires", "quits", "layoffs"],
  f: () => {
    const h = S("hires"), q = S("quits"), l = S("layoffs"); if (!q) return null;
    const sin20 = a => a.filter(p => p[0] < T(2020, 2) || p[0] >= T(2021));
    const item = (a, n) => { const p = promEntre(a, 2015, 2019), e = extremoDesde(sin20(a), last(a)[1] < p); return { n, a, p, txt: `${n.toLowerCase()} ${nf(last(a)[1])}% (2015-19: ${nf(p)}%${e ? `; ${e.replace("mínimo", "el menor").replace("máximo", "el mayor")}` : ""})` }; };
    const xs = [h && item(h, "Contrataciones"), item(q, "Renuncias"), l && item(l, "Despidos")].filter(Boolean);
    const cs = { Contrataciones: 0, Renuncias: 2, Despidos: 1 };
    return { titulo: `Tasas mensuales en ${fechaDe(q)}: ` + xs.map(x => x.txt).join(", "),
      sub: "% del empleo por mes (BLS, encuesta JOLTS). Entre paréntesis en la leyenda, el promedio 2015-19.",
      series: xs.map(x => ({ n: `${x.n} (2015-19: ${nf(x.p)}%)`, d: cut(x.a), c: cs[x.n], w: 2.2 })) };
  } });

def("epop", { slug: "empleo-25-54", nombre: "Empleo y participación 25-54 años", sin: ["epop", "participación", "prime age"],
  calc: "Proporción de la población de 25 a 54 años con empleo y tasa de participación de ese grupo (BLS, encuesta de hogares), eje izquierdo. Eje derecho: tasa de participación de toda la población de 16 años y más, que incluye a los mayores de 55 y por eso baja con el envejecimiento.",
  ks: ["epop_prime", "participation_prime", "participation"],
  f: () => {
    const e = S("epop_prime"), pp = S("participation_prime"), pt = S("participation"); if (!e) return null;
    const v = last(e)[1], e19 = promEntre(e, 2019, 2019), mx = maxEntre(e, 2021, 2100), pt19 = pt ? promEntre(pt, 2019, 2019) : null;
    const ss = [{ n: "Empleo 25-54", d: cut(e), c: 2, w: 2.8 }];
    if (pp) ss.push({ n: "Participación 25-54", d: cut(pp), c: 0, w: 1.6 });
    if (pt) ss.push({ n: "Participación total (eje derecho)", d: cut(pt), c: "gris", w: 1.6, der: true, u: "%" });
    const refs = []; if (e19 != null) refs.push({ y: e19, l: `Empleo 25-54, 2019: ${nf(e19)}%` });
    return { titulo: `Empleo 25-54 años ${nf(v)}% en ${fechaDe(e)} (2019: ${nf(e19)}%` + (mx && mx[1] > v ? `; máximo post-pandemia ${nf(mx[1])}% en ${fm(mx[0])}` : "") + ")" + (pp ? `; participación 25-54 ${nf(last(pp)[1])}%` : "") + (pt ? `; participación total ${nf(last(pt)[1])}% (2019: ${nf(pt19)}%)` : ""),
      sub: "% de la población (BLS, encuesta de hogares). La participación total incluye a los mayores de 55, por eso baja con el envejecimiento.",
      series: ss, refs };
  } });

def("salarioReal", { slug: "salario-real", nombre: "Salario horario y salario real", sin: ["salarios", "ahe", "salario real", "poder adquisitivo"],
  calc: "Salario horario promedio del sector privado (BLS) y CPI general (BLS), variación interanual. Barras: salario real, la diferencia entre los dos, en puntos. El salario horario promedio cambia con la composición del empleo (si se pierden puestos de bajo salario, el promedio sube sin que nadie cobre más); el ECI no.",
  ks: ["ahe", "cpi"],
  f: () => {
    const w = yoy(S("ahe")), c = yoy(S("cpi")); if (!w || !c) return null;
    const r = join(w, c, (a, b) => a - b), v = last(r)[1], p = promEntre(w, 2015, 2019);
    let n = 0; for (let i = r.length - 1; i >= 0 && Math.sign(r[i][1]) === Math.sign(v); i--) n++;
    return { titulo: `Interanual en ${fechaDe(w)}: salario horario ${nf(last(w)[1])}% (2015-19: ${nf(p)}%), CPI ${nf(last(c)[1])}%; salario real ${sg(v)}%` + (n >= 3 ? `; ${v < 0 ? "cae" : "sube"} hace ${n} meses` : ""),
      sub: "Salario horario promedio del sector privado (BLS) contra el CPI general. Cambia con la composición del empleo; el ECI (al lado) no.", dec: 1,
      shock: [T(2020, 3), T(2021, 6)], shockVentana: [T(2020, 3), T(2021, 6)],
      series: [{ n: "Salario real (pp)", d: cut(r), t: "bar", c: "gris", suave: true }, { n: "Salario horario", d: cut(w), c: 0, w: 2.8 }, { n: "CPI general", d: cut(c), c: 1, w: 1.6 }], refs: [{ y: 0 }] };
  } });

def("eci", { slug: "costo-laboral-eci", nombre: "Costo laboral: ECI y costo laboral unitario", sin: ["eci", "salarios", "costo laboral", "ulc", "costo laboral unitario"],
  calc: "Índice de costo laboral, salarios del sector privado (BLS, trimestral), y costo laboral unitario de las empresas no agrícolas (BLS: remuneración por hora sobre productividad), variación interanual. El ECI mantiene fija la composición del empleo. Referencias calculadas: 2% más el crecimiento anual de la productividad en 5 años (la suba de salarios que, con esa productividad, deja el costo por unidad producida en 2%), y 2% para el costo laboral unitario.",
  ks: ["eci", "ulc", "productivity"],
  f: () => {
    const e = yoy(S("eci"), 4), u = S("ulc") ? yoy(S("ulc"), 4) : null, pr = S("productivity"); if (!e) return null;
    const p5 = pr && pr.length > 20 ? (Math.pow(last(pr)[1] / pr[pr.length - 21][1], 1 / 5) - 1) * 100 : null, ref = p5 != null ? 2 + p5 : null;
    const pe = promEntre(e, 2015, 2019), pu = u ? promEntre(u, 2015, 2019) : null;
    const ss = [{ n: "ECI salarios privados", d: cut(e), c: 0, w: 2.8 }];
    if (u) ss.push({ n: "Costo laboral unitario", d: cut(u), c: 2, w: 1.8 });
    const refs = [{ y: 2, l: "2%" }]; if (ref != null) refs.push({ y: ref, l: `2% + productividad a 5 años: ${nf(ref)}%` });
    return { freq: "Q", titulo: `Interanual en ${fechaDe(e, "Q")}: ECI salarios ${nf(last(e)[1])}% (2% + productividad: ${nf(ref)}%; 2015-19: ${nf(pe)}%)` + (u ? `; costo laboral unitario ${nf(last(u)[1])}% (2015-19: ${nf(pu)}%)` : ""),
      sub: "Índice de costo laboral, salarios del sector privado (BLS), y costo laboral unitario de las empresas no agrícolas (BLS). El ECI mantiene fija la composición del empleo.",
      shock: [T(2020, 3), T(2021, 9)], shockVentana: [T(2020, 3), T(2021, 9)], series: ss, refs };
  } });

def("pedidos", { slug: "pedidos-iniciales", nombre: "Pedidos iniciales de desempleo", sin: ["claims", "initial claims", "seguro de desempleo"],
  calc: "Pedidos iniciales semanales del seguro de desempleo (Departamento de Trabajo), desestacionalizados, y su promedio de 4 semanas, en miles. Referencias: promedio 2019 y promedio 2015-19.",
  ks: ["claims"],
  f: () => {
    const c = escala(S("claims"), 1 / 1000); if (!c) return null;
    const m4 = roll(c, 4), u52 = c.slice(-52).map(p => p[1]), y19 = promEntre(c, 2019, 2019), p = promEntre(c, 2015, 2019);
    const refs = []; if (y19 != null) refs.push({ y: y19, l: `Promedio 2019: ${nf(y19, 0)} mil` }); if (p != null) refs.push({ y: p, l: `Promedio 2015-19: ${nf(p, 0)} mil` });
    return { freq: "W", titulo: `Pedidos iniciales: ${nf(last(c)[1], 0)} mil en la semana al ${fw(last(c)[0])}, promedio 4 semanas ${nf(last(m4)[1], 0)} mil; rango de 52 semanas ${nf(Math.min(...u52), 0)}–${nf(Math.max(...u52), 0)} mil; promedio 2019: ${nf(y19, 0)} mil`,
      sub: "Pedidos iniciales semanales del seguro de desempleo (Departamento de Trabajo), desestacionalizados, en miles.",
      unidad: "mil", dec: 0, series: [{ n: "Semanal", d: cut(c), c: 1, fina: true }, { n: "Promedio 4 semanas", d: cut(m4), c: 1, w: 2.6 }], refs };
  } });

def("continuos", { slug: "pedidos-continuos", nombre: "Pedidos continuos de desempleo", sin: ["continuing claims", "seguro de desempleo"],
  calc: "Personas que siguen cobrando el seguro de desempleo (Departamento de Trabajo), semanal, desestacionalizado, en millones, y su promedio de 4 semanas. Si quien pierde el empleo tarda más en conseguir otro, sube aunque los despidos no aumenten. Referencias: promedio 2019 y máximo desde 2022.",
  ks: ["cont_claims"],
  f: () => {
    const c = escala(S("cont_claims"), 1 / 1e6); if (!c) return null;
    const m4 = roll(c, 4), y19 = promEntre(c, 2019, 2019), mx = maxEntre(c, 2022, 2100);
    const refs = []; if (y19 != null) refs.push({ y: y19, l: `Promedio 2019: ${nf(y19, 2)} M` }); if (mx && mx[0] < last(c)[0]) refs.push({ y: mx[1], l: `Máximo ${fw(mx[0])}: ${nf(mx[1], 2)} M` });
    return { freq: "W", titulo: `Pedidos continuos: ${nf(last(c)[1], 2)} millones en la semana al ${fw(last(c)[0])}` + (mx && mx[0] < last(c)[0] ? `; máximo desde 2022: ${nf(mx[1], 2)} millones (${fm(mx[0])})` : "") + `; promedio 2019: ${nf(y19, 2)} millones`,
      sub: "Personas que siguen cobrando el seguro de desempleo (Departamento de Trabajo), semanal, desestacionalizado, en millones.",
      unidad: "M", dec: 2, series: [{ n: "Semanal", d: cut(c), c: 0, fina: true }, { n: "Promedio 4 semanas", d: cut(m4), c: 0, w: 2.6 }], refs };
  } });

// ═════════════════════════ Tasas ═════════════════════════
// Mediana móvil de 5 datos: saca los saltos de fin de mes de la tasa de fondos federales diaria sin correr los cambios de la Fed
const mediana5 = a => a && a.map((p, i) => { const v = a.slice(Math.max(0, i - 4), i + 1).map(x => x[1]).sort((x, y) => x - y); return [p[0], v[Math.floor(v.length / 2)]]; });
// Serie diaria completa (sin importar el período elegido) para los títulos que hablan del último dato
const diariaCompleta = k => ST.D && ST.D[k] && ST.T1 === Infinity ? ST.D[k] : SD(k);
const ultimoDato = k => last(diariaCompleta(k));
const txtFrec = k => { const f = freqD(k); return f === "D" ? "datos diarios" : f === "W" ? "datos semanales" : "promedios mensuales"; };
function notaParcial() {
  if (usaDiario()) return "";
  const cv = ST.DATA.curva && ST.DATA.curva["10A"]; if (!cv || !cv.length) return "";
  const f = cv[cv.length - 1][0], d = new Date(P(f));
  return d.getUTCDate() < 28 ? ` El último punto es el promedio del mes en curso hasta el ${d.getUTCDate()}-${MES[d.getUTCMonth()]}.` : "";
}
// Fecha corta sin el día de la semana: "29-sep"
const fdia = t => fd(t).replace(/^\S+ /, "");
const minEntre = (a, y0, y1) => { const x = (a || []).filter(p => p[0] >= T(y0) && p[0] < T(y1 + 1)); return x.length ? x.reduce((m, p) => p[1] < m[1] ? p : m) : null; };
// Último cambio de la tasa objetivo de la Fed (techo del rango): fecha, nivel y dirección
function ultimoCambioFed() {
  const a = ST.D && ST.D.fed_obj_sup; if (!a || a.length < 2) return null;
  const u = a[a.length - 1], p = a[a.length - 2];
  return { t: u[0], v: u[1], d: u[1] - p[1] };
}

def("curvaTesoro", { sinPeriodo: true, slug: "curva-del-tesoro", nombre: "Curva del Tesoro", sin: ["curva", "yield curve", "rendimientos", "bonos"],
  calc: "Rendimiento de los bonos del Tesoro por plazo (constant maturity), datos diarios, hoy y hace 1, 6 y 12 meses. Barras (eje derecho): cambio de cada plazo en el último mes, en puntos básicos. No depende del período elegido.",
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
    const series = cortes.map(([f, n, c], i) => ({ n: `${n} (${fdia(P(f))}${i ? "-" + String(new Date(P(f)).getUTCFullYear()).slice(2) : ""})`, ley: n, t: "line", c, w: i ? 1.8 : 3, punteada: i > 0, etiquetas: i === 0 ? "todas" : false, d: plazos.map(p => val(p, f)) }));
    const mes = cortes[1] && cortes[1][0], cb = p => mes && val(p, hoy) != null && val(p, mes) != null ? (val(p, hoy) - val(p, mes)) * 100 : null;
    if (mes) series.push({ n: "Cambio en 1 mes (pb, eje derecho)", t: "bar", c: "gris", suave: true, der: true, etiquetas: true, dec: 0, d: plazos.map(cb) });
    const pb = p => cb(p) != null ? `${p === "2A" ? "2 años" : p === "10A" ? "10 años" : "30 años"} ${sg(cb(p), 0)} pb` : "";
    return { tipo: "cat", titulo: `Curva del Tesoro al ${fdia(P(hoy))}: 3 meses ${nf(val("3M", hoy), 2)}%, 2 años ${nf(val("2A", hoy), 2)}%, 10 años ${nf(val("10A", hoy), 2)}%, 30 años ${nf(val("30A", hoy), 2)}%` + (mes ? `; en un mes, ${[pb("2A"), pb("10A"), pb("30A")].join(", ")}` : ""),
      sub: "Rendimiento por plazo (Tesoro de EE.UU.), datos diarios. Barras: cambio en el último mes, en puntos básicos.",
      fuenteTxt: "Tesoro de EE.UU. vía FRED", unidad: "%", unidadDer: "pb", dec: 2, decEje: 1, signo: false, escala: true, apilado: false, cats: plazos, fechaLey: fdia(P(hoy)), series };
  } });

def("curva", { slug: "fed-y-treasuries", nombre: "Fed y Treasuries", sin: ["fondos federales", "tasa de política", "treasuries", "bonos", "suba de tasa", "baja de tasa"],
  calc: "Tasa efectiva de fondos federales (mediana de 5 días para sacar los saltos de fin de mes), techo del rango objetivo de la Fed (escalón gris) y rendimientos de Treasuries a 2, 10 y 30 años. Datos diarios con períodos de hasta 5 años; promedios mensuales con períodos más largos. Los rombos son la mediana de la tasa que proyecta la Fed para fin de año.",
  ks: ["fed_funds", "fed_obj_sup", "ust2", "ust10", "ust30", "sep_ff"],
  f: () => {
    const ks = [["fed_funds", "Fondos federales"], ["ust2", "2 años"], ["ust10", "10 años"], ["ust30", "30 años"]];
    const limpia = (k, a) => k === "fed_funds" && freqD(k) === "D" ? mediana5(a) : a;
    const ss = ks.map(([k, n], i) => ({ n, d: cut(limpia(k, SD(k))), c: i, dec: 2, w: i ? 1.8 : 2.6 })).filter(s => s.d && s.d.length); if (ss.length < 3) return null;
    const obj = SD("fed_obj_sup");
    if (obj && obj.length) ss.push({ n: "Techo del rango objetivo", ley: "Techo del rango", d: cut(obj.concat(obj[obj.length - 1][0] < last(ss[1].d)[0] ? [[last(ss[1].d)[0], obj[obj.length - 1][1]]] : [])), c: "gris", w: 1.2, escalon: true, fin: false, dec: 2 });
    const sep = sepPuntos("sep_ff");
    if (sep) ss.push({ n: "Proyección de la Fed para su tasa", ley: "Proyección de la Fed", t: "punto", c: 0, d: sep, dec: 2 });
    const uc = ultimoCambioFed(), u = k => ultimoDato(k);
    const desde = k => { const a = diariaCompleta(k); const v0 = uc ? valorEn(a, uc.t - DIA) : null; return v0 ? (last(a)[1] - v0[1]) * 100 : null; };
    const ff = u("fed_funds");
    return { freq: freqD("ust10"),
      titulo: `Al ${fdia(ff[0])}: Fed ${nf(ff[1], 2)}%` + (uc ? ` (rango ${nf(uc.v - 0.25, 2)}-${nf(uc.v, 2)}%, ${uc.d > 0 ? "suba" : "baja"} del ${fdia(uc.t)}-${String(anio(uc.t)).slice(2)})` : "") + `, 2 años ${nf(u("ust2")[1], 2)}%, 10 años ${nf(u("ust10")[1], 2)}%, 30 años ${nf(u("ust30")[1], 2)}%` + (uc && desde("ust2") != null ? `; desde el último cambio: 2 años ${sg(desde("ust2"), 0)} pb, 10 años ${sg(desde("ust10"), 0)} pb` : ""),
      sub: `Tasa efectiva de fondos federales, techo del rango objetivo y Treasuries por plazo, ${txtFrec("ust10")}. Rombos: tasa que proyecta la Fed (mediana).` + notaParcial(), fuenteTxt: "Fed y Tesoro de EE.UU. vía FRED", dec: 2, series: ss };
  } });

// Episodios de curva 10-2 invertida de más de 3 meses (con promedios mensuales, para no contar días sueltos)
function inversiones() {
  const s = join(S("ust10"), S("ust2"), (x, y) => x - y); if (!s) return [];
  const out = []; let ini = null;
  s.forEach((p, i) => {
    if (p[1] < 0 && ini == null) ini = p[0];
    if ((p[1] >= 0 || i === s.length - 1) && ini != null) { const fin = p[1] >= 0 ? p[0] : null; if ((fin || p[0]) - ini > 90 * DIA) out.push([ini, fin]); ini = null; }
  });
  return out;
}
def("pendiente", { slug: "pendiente-de-la-curva", nombre: "Pendiente de la curva", sin: ["10-2", "10-3m", "inversión de la curva", "spread"], historia: true,
  calc: "Treasury 10 años menos 2 años, y 10 años menos letra de 3 meses, en puntos básicos. Datos diarios con períodos de hasta 5 años; promedios mensuales con períodos más largos. Las marcas señalan el inicio de cada inversión del 10-2 de más de 3 meses (en promedios mensuales). La referencia es el promedio del 10-2 entre 1976 y 2019.",
  ks: ["ust10", "ust2", "spread_10y3m"],
  f: () => {
    const a = SD("ust10"), b = SD("ust2"), c = SD("spread_10y3m"); if (!a || !b) return null;
    const s = join(a, b, (x, y) => (x - y) * 100), v = last(s)[1];
    const m = join(S("ust10"), S("ust2"), (x, y) => (x - y) * 100), pr = promEntre(m, 1976, 2019);
    const inv = inversiones(), ult = inv[inv.length - 1];
    const ss = [{ n: "10 años − 2 años", d: cut(s), c: 0, w: 2.6 }];
    if (c) ss.push({ n: "10 años − 3 meses", d: escala(cut(c), 100), c: 1, w: 1.6 });
    const vis = inv.filter(([i]) => i >= ST.T0 && i <= ST.T1);
    if (vis.length) ss.push({ n: "Inicio de inversión", t: "nota", c: 0, d: vis.map(([i]) => [i, 0]), textos: vis.map(([i]) => `Inversión ${anio(i)}`), enLeyenda: false });
    const fe = t => fm(t);
    return { titulo: `Al ${fdia(last(s)[0])}: 10-2 ${sg(v, 0)} pb` + (c ? `, 10-3 meses ${sg(last(c)[1] * 100, 0)} pb` : "") + (pr != null ? `; promedio 10-2 1976-2019: ${sg(pr, 0)} pb` : "") + (ult ? (ult[1] ? `; última inversión del 10-2: ${fe(ult[0])} a ${fe(ult[1])}` : `; invertida desde ${fe(ult[0])}`) : ""),
      sub: `Treasury a 10 años menos 2 años y menos 3 meses, en puntos básicos, ${txtFrec("ust10")}.`, fuenteTxt: "Tesoro de EE.UU. vía FRED",
      freq: freqD("ust10"), unidad: "pb", dec: 0, series: ss, refs: [{ y: 0 }].concat(pr != null ? [{ y: pr, l: `Promedio 10-2 1976-2019: ${nf(pr, 0)} pb` }] : []) };
  } });

def("politica", { slug: "tasa-real-de-la-fed", nombre: "Tasa real de la Fed y tasa neutral", sin: ["política monetaria", "restrictiva", "neutral", "r*", "r estrella"],
  calc: "Tasa efectiva de fondos federales menos inflación core PCE: interanual (línea gruesa) y anualizada a 6 meses (fina). El título usa el último dato diario de la tasa y el gráfico, promedios mensuales. La neutral es la tasa de largo plazo que proyecta la propia Fed (mediana de cada reunión con proyecciones) menos su meta de 2%: es una estimación, no se observa.",
  ks: ["fed_funds", "pce_core", "sep_lr"],
  f: () => {
    const f = S("fed_funds"), c = yoy(S("pce_core")), c6 = ann(S("pce_core"), 6); if (!f || !c) return null;
    const r = join(f, c, (a, b) => a - b), r6 = c6 ? join(f, c6, (a, b) => a - b) : null, fu = ultimoDato("fed_funds");
    const v = fu[1] - last(c)[1], v6 = c6 ? fu[1] - last(c6)[1] : null;
    const lr = S("sep_lr");
    const neutral = lr ? r.filter(p => p[0] >= lr[0][0]).map(p => { let x = null; for (const q of lr) if (q[0] <= p[0] + 31 * 864e5) x = q[1]; return [p[0], x - 2]; }).filter(p => p[1] != null) : null;
    const n = lr ? last(lr)[1] - 2 : null;
    if (neutral && neutral.length && last(lr)[0] > last(neutral)[0]) neutral.push([last(lr)[0], n]);
    // el último punto usa la tasa del último día, igual que el título
    const conHoy = (a, x) => a && fu[0] > last(a)[0] ? a.concat([[fu[0], x]]) : a;
    const ss = [{ n: "Tasa real, core interanual", d: cut(conHoy(r, v)), c: 0, w: 2.8 }];
    if (r6) ss.push({ n: "Tasa real, core a 6 meses", d: cut(conHoy(r6, v6)), c: 0, fina: true });
    if (neutral) ss.push({ n: "Neutral según la Fed (largo plazo − 2%)", ley: "Neutral según la Fed", d: cut(neutral), c: 1, w: 2, punteada: true, escalon: true });
    return { titulo: `Tasa real de la Fed al ${fdia(fu[0])}: ${nf(v)}% con core interanual (fondos ${nf(fu[1], 2)}% − core ${nf(last(c)[1])}%)` + (v6 != null ? `, ${nf(v6)}% con core a 6 meses` : "") + (n != null ? `; neutral según la Fed ${nf(n)}% (SEP de ${fm(last(lr)[0])})` : ""),
      sub: `Fondos federales menos core PCE (${fm(last(c)[0])}). Neutral: tasa de largo plazo que proyecta la Fed (mediana) menos su meta de 2%.`,
      series: ss, refs: [{ y: 0 }] };
  } });

def("senda", { sinPeriodo: true, slug: "que-descuenta-el-mercado", nombre: "Curva corta contra la Fed", sin: ["recortes", "subas", "expectativas de tasa", "letras", "fed funds", "política esperada", "senda"],
  calc: "Rendimiento de las letras y bonos del Tesoro a 1, 3 y 6 meses, 1 y 2 años (datos diarios), contra la tasa efectiva de fondos federales, ubicados en la fecha en que vence cada plazo; hoy y hace un mes. Los rombos son la mediana de la tasa que proyecta la Fed a fin de cada año. Las letras incluyen una diferencia estructural con los fondos federales (oferta del Tesoro, liquidez) y los bonos a 1-2 años, prima por plazo: no son la senda esperada pura, que se mide con futuros de fondos federales y OIS (no están en FRED). No depende del período elegido.",
  ks: ["fed_funds", "ust2", "sep_ff"],
  f: () => {
    const cv = ST.DATA.curva; if (!cv || !cv["1A"] || !cv["2A"]) return null;
    const fd_ = diariaCompleta("fed_funds"); if (!fd_) return null;
    const ff = last(fd_)[1];
    const plazos = [["1M", 1], ["3M", 3], ["6M", 6], ["1A", 12], ["2A", 24]].filter(([p]) => cv[p]);
    const ult = cv["1A"][cv["1A"].length - 1][0];
    const hace = (() => { const d = new Date(P(ult)); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
    const val = (p, f) => { const o = cv[p].filter(x => x[0] <= f).pop(); return o ? o[1] : null; };
    const mas = (f, m) => { const d = new Date(P(f)); d.setUTCMonth(d.getUTCMonth() + m); return d.getTime(); };
    const ffHace = valorEn(fd_, P(hace));
    const hoy = [[P(ult), ff], ...plazos.map(([p, m]) => [mas(ult, m), val(p, ult)])];
    const previo = [[P(hace), ffHace ? ffHace[1] : null], ...plazos.map(([p, m]) => [mas(hace, m), val(p, hace)])].filter(p => p[1] != null);
    const sep = sepPuntos("sep_ff", 11, 1);
    const d1 = (val("1A", ult) - ff) * 100, d2 = (val("2A", ult) - ff) * 100;
    const h1 = ffHace ? (val("1A", hace) - ffHace[1]) * 100 : null, h2 = ffHace ? (val("2A", hace) - ffHace[1]) * 100 : null;
    const ss = [{ n: `Hoy (${fdia(P(ult))})`, ley: "Hoy", d: hoy, c: 0, w: 3, dec: 2 }, { n: "Hace un mes", d: previo, c: 1, w: 1.8, punteada: true, dec: 2 }];
    if (sep) ss.push({ n: "Proyección de la Fed (fin de año)", t: "punto", c: 0, d: sep, dec: 2 });
    return { freq: "D", eventos: false, recesiones: false, sinRecorte: true, sinFecha: true, sinAvisoInicio: true, fechaLey: fdia(P(ult)),
      titulo: `Al ${fdia(P(ult))}: letra a 1 año ${nf(val("1A", ult), 2)}% y bono a 2 años ${nf(val("2A", ult), 2)}%, contra la Fed en ${nf(ff, 2)}% (${sg(d1, 0)} y ${sg(d2, 0)} pb)` + (h1 != null ? `; hace un mes: ${sg(h1, 0)} y ${sg(h2, 0)} pb` : "") + (sep ? `; la Fed proyecta ${sep.map(p => `${nf(p[1], 2)}% a fin de ${anio(p[0])}`).join(" y ")}` : ""),
      sub: "Rendimiento de letras y bonos cortos del Tesoro, ubicados en la fecha en que vence cada plazo, contra la tasa efectiva de fondos federales. Incluye la diferencia estructural entre letras y fondos federales, y prima por plazo.",
      fuenteTxt: "Fed y Tesoro de EE.UU. vía FRED", dec: 2, series: ss };
  } });

// Billones de US$: las series de la Fed vienen en millones o en miles de millones
const aBillones = a => a && a.length ? escala(a, last(a)[1] > 1e5 ? 1e-6 : 1e-3) : null;
def("balanceFed", { slug: "balance-de-la-fed", nombre: "Balance de la Fed: activos, reservas, RRP y cuenta del Tesoro", sin: ["qt", "qe", "balance", "reservas", "liquidez", "h.4.1", "rrp", "tga", "cuenta del tesoro"],
  calc: "Activos totales de la Reserva Federal (línea) y tres de sus pasivos (áreas apiladas): reservas de los bancos, recompra inversa a un día (RRP: donde los fondos de dinero dejan liquidez en la Fed) y cuenta general del Tesoro (TGA). Fed, H.4.1 y operaciones diarias; billones de US$. Los tres pasivos no suman los activos: faltan los billetes en circulación y otras partidas. Con los activos quietos, las reservas suben o bajan cuando se mueven la RRP o la cuenta del Tesoro.",
  ks: ["fed_assets", "reserves", "rrp", "tga", "gdp_nom"],
  f: () => {
    const a = aBillones(SD("fed_assets")); if (!a) return null;
    const r = aBillones(SD("reserves")), rp = aBillones(SD("rrp")), tg = aBillones(SD("tga"));
    const aw = aBillones(diariaCompleta("fed_assets")), pk = aw.reduce((m, p) => p[1] > m[1] ? p : m), h13 = valorEn(aw, last(aw)[0] - 91 * DIA);
    const g = S("gdp_nom"), rw = r ? aBillones(diariaCompleta("reserves")) : null;
    const ss = [{ n: "Activos totales", d: cut(a), c: 0, w: 2.8 }];
    if (r) ss.push({ n: "Reservas bancarias", d: cut(r), c: 2, area: true, stack: "p" });
    if (rp) ss.push({ n: "RRP", d: cut(rp), c: 1, area: true, stack: "p" });
    if (tg) ss.push({ n: "Cuenta del Tesoro (TGA)", d: cut(tg), c: 3, area: true, stack: "p" });
    const lt = k => { const x = aBillones(diariaCompleta(k)); return x ? nf(last(x)[1], 2) : null; };
    return { freq: freqD("fed_assets"),
      titulo: `Activos de la Fed US$ ${nf(last(aw)[1], 2)} billones al ${fdia(last(aw)[0])} (máximo ${fm(pk[0])}: ${nf(pk[1], 2)}` + (h13 ? `; 13 semanas: ${sg(last(aw)[1] - h13[1], 2)}` : "") + ")"
        + (rw ? `; reservas ${nf(last(rw)[1], 2)}` + (g ? ` (${nf(last(rw)[1] * 1000 / last(g)[1] * 100, 1)}% del PBI)` : "") : "") + (lt("rrp") ? `, RRP ${lt("rrp")}` : "") + (lt("tga") ? `, cuenta del Tesoro ${lt("tga")}` : ""),
      sub: "Balance de la Fed, billones de US$. Las reservas cambian cuando cambian los activos, la RRP o la cuenta del Tesoro.",
      unidad: "billones", dec: 2, series: ss };
  } });

def("tasaReal", { slug: "tasa-real", nombre: "Tasa real a 10 años", sin: ["tips", "breakeven", "tasa real", "descomposición"], historia: true,
  calc: "Rendimiento nominal del Treasury a 10 años, de los TIPS a 10 años (tasa real) y su diferencia (inflación esperada implícita, breakeven a 10 años), en el mismo eje: nominal = real + inflación esperada. La referencia es el promedio 2015-19 de la tasa real.",
  ks: ["ust10", "tips10", "breakeven10"],
  f: () => {
    const n = SD("ust10"), r = SD("tips10"), be = SD("breakeven10"); if (!r || !be) return null;
    const rw = diariaCompleta("tips10"), v = last(rw)[1], ext = extremoDesde(rw, false), pr = promEntre(S("tips10"), 2015, 2019);
    const ss = [];
    if (n) ss.push({ n: "Nominal 10 años", d: cut(n), c: "gris", w: 1.4, dec: 2 });
    ss.push({ n: "Tasa real (TIPS)", d: cut(r), c: 0, w: 2.8, dec: 2 }, { n: "Inflación esperada (breakeven)", d: cut(be), c: 1, w: 2, dec: 2 });
    const nv = ultimoDato("ust10");
    return { freq: freqD("tips10"),
      titulo: `10 años ${nf(nv[1], 2)}% al ${fdia(last(rw)[0])} = tasa real ${nf(v, 2)}% + inflación esperada ${nf(ultimoDato("breakeven10")[1], 2)}%` + (ext ? `; la tasa real, ${ext.replace("máximo", "la más alta")}` : "") + (pr != null ? ` (promedio 2015-19: ${nf(pr, 2)}%)` : ""),
      sub: `Treasury nominal a 10 años, TIPS a 10 años (tasa real) y su diferencia (inflación esperada), ${txtFrec("tips10")}.`,
      fuenteTxt: "Tesoro de EE.UU. vía FRED", dec: 2, series: ss, refs: pr != null ? [{ y: pr, l: `Tasa real, promedio 2015-19: ${nf(pr, 2)}%` }] : [] };
  } });

def("primaPlazo", { slug: "prima-por-plazo", nombre: "Prima por plazo a 10 años", sin: ["term premium", "kim wright"], historia: true,
  calc: "Prima por plazo del bono a 10 años según el modelo Kim-Wright de la Fed: la parte del rendimiento que no se explica por la tasa corta esperada. Es una estimación de modelo, no un precio de mercado; otros modelos (como el ACM de la Fed de Nueva York) dan niveles distintos. Referencias: promedios 1990-2007 y 2015-19.",
  ks: ["term_premium"],
  f: () => {
    const t = SD("term_premium"); if (!t) return null;
    const w = diariaCompleta("term_premium"), v = last(w)[1], ext = extremoDesde(w, v > 0 ? false : true);
    const a = promEntre(S("term_premium"), 1990, 2007), b = promEntre(S("term_premium"), 2015, 2019);
    const refs = [{ y: 0 }]; if (a != null) refs.push({ y: a, l: `Promedio 1990-2007: ${nf(a, 2)}%` }); if (b != null) refs.push({ y: b, l: `Promedio 2015-19: ${nf(b, 2)}%` });
    return { titulo: `Prima por plazo a 10 años ${nf(v, 2)}% al ${fdia(last(w)[0])}` + (ext ? `, ${ext.replace("máximo", "la más alta").replace("mínimo", "la más baja")}` : "") + (a != null ? `; promedio 1990-2007: ${nf(a, 2)}%; 2015-19: ${nf(b, 2)}%` : ""),
      sub: `Estimación del modelo Kim-Wright (Fed), ${txtFrec("term_premium")}: no se observa en el mercado; otros modelos dan niveles distintos.`,
      freq: freqD("term_premium"), dec: 2, series: [{ n: "Prima por plazo 10 años", d: cut(t), c: 0, w: 2.6 }], refs };
  } });

def("spreads", { slug: "spreads-de-credito", nombre: "Spreads de crédito corporativo", sin: ["spreads", "high yield", "baa", "crédito corporativo", "riesgo corporativo"], historia: true,
  calc: "Rendimiento de los bonos corporativos Baa de Moody's menos el Treasury a 10 años (desde 1986), y spread ajustado por opciones del índice high yield de ICE BofA (FRED publica sólo desde oct-23). Datos diarios con períodos de hasta 5 años; promedios mensuales con períodos más largos. Referencias: promedio 1986-2019 y máximo de 2008.",
  ks: ["baa_spread", "hy_oas"],
  f: () => {
    const b = SD("baa_spread"), h = SD("hy_oas"); if (!b && !h) return null;
    const ss = [];
    if (b) ss.push({ n: "Baa − Treasury 10 años", d: cut(b), c: 0, w: 2.6, dec: 2 });
    if (h) ss.push({ n: "High yield (ICE BofA, desde oct-23)", ley: "High yield", d: cut(h), c: 1, w: 1.4, dec: 2 });
    const bm = S("baa_spread"), pr = promEntre(bm, 1986, 2019), pk = maxEntre(bm, 2008, 2009);
    const bw = b ? diariaCompleta("baa_spread") : null, rec = bw ? minEntre(bw.slice(0, -1), new Date().getUTCFullYear() - 3, 2100) : null;
    const refs = []; if (pr != null) refs.push({ y: pr, l: `Promedio 1986-2019: ${nf(pr, 2)} pp` }); if (pk) refs.push({ y: pk[1], l: `Máximo ${fm(pk[0])}: ${nf(pk[1], 2)} pp` });
    return { titulo: (bw ? `Spread Baa ${nf(last(bw)[1], 2)} pp al ${fdia(last(bw)[0])}` + (rec ? ` (mínimo de 3 años: ${nf(rec[1], 2)} en ${fm(rec[0])}` : " (") + (pr != null ? `; promedio 1986-2019: ${nf(pr, 2)}` : "") + (pk ? `; máximo ${fm(pk[0])}: ${nf(pk[1], 2)}` : "") + ")" : "") + (h ? `${bw ? "; " : ""}high yield ${nf(ultimoDato("hy_oas")[1], 2)} pp` : ""),
      sub: `Rendimiento de bonos corporativos sobre el Tesoro, ${txtFrec("baa_spread")}. Baa: Moody's menos Treasury a 10 años. High yield: ICE BofA, ajustado por opciones; FRED publica sólo desde oct-23.` + notaParcial(),
      freq: freqD("baa_spread"), unidad: "pp", dec: 2, series: ss, refs };
  } });

def("hyCalidad", { slug: "high-yield-por-calidad", nombre: "High yield por calidad: CCC contra BB", sin: ["ccc", "bb", "junk", "basura", "high yield", "descompresión", "estrés de crédito"],
  calc: "Cociente entre los spreads ajustados por opciones de los índices ICE BofA de high yield CCC y menor (el peor crédito que todavía se financia en el mercado) y BB (el tramo de mejor calidad). La referencia es su promedio de 3 años. FRED publica sólo sus últimos 3 años.",
  ks: ["hy_bb", "hy_ccc"],
  f: () => {
    const bb = SD("hy_bb"), ccc = SD("hy_ccc"); if (!bb || !ccc) return null;
    const r = join(ccc, bb, (a, b) => a / b); if (!r) return null;
    const bw = diariaCompleta("hy_bb"), cw = diariaCompleta("hy_ccc"), rw = join(cw, bw, (a, b) => a / b);
    const m = rw.reduce((x, p) => x + p[1], 0) / rw.length, mn = Math.min(...rw.map(p => p[1])), mx = Math.max(...rw.map(p => p[1]));
    const t3 = last(cw)[0] - 91 * DIA, c3 = valorEn(cw, t3), b3 = valorEn(bw, t3);
    return { freq: freqD("hy_ccc"),
      titulo: `Spread CCC ${nf(last(cw)[1], 2)} pp y BB ${nf(last(bw)[1], 2)} pp al ${fdia(last(cw)[0])}` + (c3 && b3 ? ` (en 3 meses: ${sg((last(cw)[1] - c3[1]) * 100, 0)} y ${sg((last(bw)[1] - b3[1]) * 100, 0)} pb)` : "") + `; cociente CCC/BB ${nf(last(rw)[1], 1)} (promedio 3 años: ${nf(m, 1)}; rango ${nf(mn, 1)}-${nf(mx, 1)})`,
      sub: "Spreads ajustados por opciones de ICE BofA: CCC y menor sobre BB. FRED publica sólo los últimos 3 años.",
      unidad: "veces", dec: 2, series: [{ n: "CCC / BB", d: cut(r), c: 1, w: 2.6 }], refs: [{ y: m, l: `Promedio 3 años: ${nf(m, 1)}` }] };
  } });

def("nfci", { slug: "condiciones-financieras", nombre: "Condiciones financieras (NFCI)", sin: ["nfci", "anfci", "condiciones financieras", "spreads", "crédito", "chicago fed"], historia: true,
  calc: "Índice nacional de condiciones financieras de la Fed de Chicago (más de 100 indicadores de mercado de dinero, crédito, acciones y apalancamiento) y su versión ajustada (ANFCI), que descuenta lo que se explica por la inflación y la actividad del momento. Semanal. Cero es el promedio desde 1971; positivo, condiciones más restrictivas que el promedio; negativo, más laxas.",
  ks: ["nfci", "anfci"],
  f: () => {
    const n = SD("nfci"), a = SD("anfci"); if (!n) return null;
    const nw = diariaCompleta("nfci"), v = last(nw)[1], ext = extremoDesde(nw, v < 0);
    const ss = [{ n: "NFCI", d: cut(n), c: 0, w: 2.6, dec: 2 }];
    if (a) ss.push({ n: "NFCI ajustado", d: cut(a), c: 1, w: 1.6, dec: 2 });
    return { titulo: `NFCI ${nf(v, 2)} al ${fdia(last(nw)[0])}` + (ext ? `, ${ext.replace("mínimo", "el más laxo").replace("máximo", "el más restrictivo")}` : "") + ` (percentil ${pctlDesde(S("nfci"), v, T(1971))} desde 1971)` + (a ? `; NFCI ajustado ${nf(ultimoDato("anfci")[1], 2)}` : ""),
      sub: "Índice de condiciones financieras de la Fed de Chicago, semanal. Cero es el promedio desde 1971; positivo, más restrictivo; negativo, más laxo." + notaParcial(),
      freq: freqD("nfci"), unidad: "", dec: 2, series: ss, refs: [{ y: 0, l: "Promedio desde 1971 (0)" }] };
  } });

def("hipotecaria", { slug: "spread-hipotecario", nombre: "Tasa hipotecaria y spread", sin: ["hipoteca", "mortgage", "freddie mac", "vivienda"], historia: true,
  calc: "Tasa hipotecaria fija a 30 años de la encuesta semanal de Freddie Mac (se publica los jueves) y Treasury a 10 años del mismo día; barras: la diferencia. Con períodos de más de 5 años, promedios mensuales. La referencia es el promedio del spread 1990-2019. Fuentes diarias como Mortgage News Daily suelen dar valores algo más altos: miden las tasas ofrecidas cada día, no el promedio de la encuesta semanal.",
  ks: ["mortgage30", "ust10"],
  f: () => {
    const m = SD("mortgage30"), t = SD("ust10"); if (!m || !t) return null;
    const sp = join(m, t, (a, b) => a - b), mw = diariaCompleta("mortgage30"), tw = diariaCompleta("ust10");
    const spm = join(S("mortgage30"), S("ust10"), (a, b) => a - b), pr = promEntre(spm, 1990, 2019);
    const h2 = valorEn(mw, last(mw)[0] - 14 * DIA), mx = maxEntre(S("mortgage30"), 2022, 2100), tv = valorEn(tw, last(mw)[0]);
    return { freq: freqD("mortgage30"),
      titulo: `Hipotecaria a 30 años ${nf(last(mw)[1], 2)}% (Freddie Mac, semana al ${fw(last(mw)[0])}` + (h2 ? `; ${sg((last(mw)[1] - h2[1]) * 100, 0)} pb en 2 semanas` : "") + ")" + (tv ? `; Treasury 10 años ${nf(tv[1], 2)}%; spread ${nf(last(mw)[1] - tv[1], 2)} pp` : "") + (pr != null ? ` (promedio 1990-2019: ${nf(pr, 2)})` : "") + (mx ? `; máximo desde 2022: ${nf(mx[1], 2)}% (${fm(mx[0])})` : ""),
      sub: "Encuesta semanal de Freddie Mac (se publica los jueves) y Treasury a 10 años del mismo día. Barras: diferencia.",
      dec: 2, series: [{ n: "Spread (pp)", d: cut(sp), t: "bar", c: "gris", suave: true }, { n: "Hipotecaria 30 años", d: cut(m), c: 1, w: 2.8 }, { n: "Treasury 10 años", d: cut(t), c: 0, w: 1.4 }],
      refs: pr != null ? [{ y: pr, l: `Spread promedio 1990-2019: ${nf(pr, 2)} pp` }] : [] };
  } });

// ═════════════════════════ Externo ═════════════════════════
def("balanza", { slug: "balanza-comercial", nombre: "Balanza comercial: bienes y servicios", sin: ["comercio exterior", "déficit comercial", "importaciones", "exportaciones", "aranceles", "bienes", "servicios"], ops: [ESCALA_PBI],
  calc: "Balanza de bienes y de servicios (BEA y Census), base balanza de pagos, mensual. Barras apiladas: bienes (en general negativa) y servicios (en general positiva); línea: el saldo total y su promedio de 3 meses. En % del PBI: saldo mensual anualizado (× 12) sobre el PBI nominal del trimestre; los meses de un trimestre cuyo PBI todavía no se publicó usan el último PBI publicado (el PBI nominal crece ~1% por trimestre, así que el ratio cambia en centésimas cuando sale el dato). Referencias en el título: promedio de 12 meses, promedio de 2019 y el récord de la serie.",
  ks: ["trade_balance", "trade_goods", "trade_services", "gdp_nom"],
  f: o => {
    const b0 = S("trade_balance"); if (!b0) return null;
    const pbi = o.escala === "pbi";
    const conv = a => a ? (pbi ? joinQUlt(a, S("gdp_nom"), (x, g) => x * 12 / 1000 / g * 100) : escala(a, 1 / 1000)) : null;
    const b = conv(b0), g = conv(S("trade_goods")), sv = conv(S("trade_services")); if (!b) return null;
    const v = last(b)[1], m12 = b.slice(-13, -1).reduce((x, y) => x + y[1], 0) / 12, y19 = promEntre(b, 2019, 2019), rec = b.reduce((m, p) => p[1] < m[1] ? p : m);
    const u = pbi ? "% del PBI" : "mil M", fmt = x => pbi ? `${nf(x, 1)}%` : nf(x, 1);
    const ss = [];
    if (g && sv) ss.push({ n: "Bienes", d: cut(g), t: "bar", c: 1, stack: "b", suave: true }, { n: "Servicios", d: cut(sv), t: "bar", c: 2, stack: "b", suave: true });
    ss.push({ n: "Saldo total", d: cut(b), c: "ink", w: 1.4 }, { n: "Saldo, promedio 3 meses", d: cut(roll(b, 3)), c: 0, w: 2.6 });
    return { titulo: `Déficit comercial ${pbi ? "" : "US$ "}${fmt(-v)}${pbi ? "" : " mil M"} en ${fechaDe(b)}` + (g && sv ? `: bienes ${fmt(last(g)[1])}, servicios ${sg(last(sv)[1], 1)}` : "") + `; promedio 12 meses ${fmt(-m12)}; 2019: ${fmt(-y19)}; récord ${fm(rec[0])}: ${fmt(-rec[1])}`,
      sub: pbi ? "Saldo mensual anualizado como % del PBI nominal, bienes y servicios (BEA y Census)." + (last(S("trade_balance"))[0] > last(S("gdp_nom"))[0] + 92 * DIA ? ` Desde ${fm(Date.UTC(new Date(last(S("gdp_nom"))[0]).getUTCFullYear(), new Date(last(S("gdp_nom"))[0]).getUTCMonth() + 3, 1))}, sobre el PBI de ${fq(last(S("gdp_nom"))[0])} hasta que salga el siguiente.` : "") : "Balanza de bienes y servicios (BEA y Census), base balanza de pagos, miles de millones de US$ por mes.",
      unidad: pbi ? "%" : "mil M", dec: 1, decEje: pbi ? 1 : 0, cero: true, eventos: false, sinRecorte: true, series: ss, refs: [{ y: 0 }] };
  } });

const REAL_EXT = { id: "real", nombre: "Precios", valores: [["n", "Nominal"], ["r", "Real (aprox.)"]] };
def("expoImpo", { slug: "exportaciones-e-importaciones", nombre: "Exportaciones e importaciones", sin: ["exportaciones", "importaciones", "comercio", "aranceles", "adelantamiento"], ops: [REAL_EXT],
  calc: "Exportaciones e importaciones de bienes y servicios (BEA y Census), base balanza de pagos, desestacionalizadas, en miles de millones de US$ por mes: el dato del mes (fino) y su promedio de 3 meses (grueso). Se muestran en nivel porque el adelantamiento de importaciones de principios de 2025 distorsiona las variaciones interanuales un año después. La vista real (aproximada) las deflacta por los índices de precios de exportación e importación del BLS, que cubren bienes y no servicios. Si las importaciones crecen más que las exportaciones, por contabilidad restan en el PBI.",
  ks: ["exports", "imports", "export_prices", "import_prices"],
  f: o => {
    const real = o.real === "r";
    const e0 = escala(S("exports"), 1 / 1000), i0 = escala(S("imports"), 1 / 1000); if (!e0 || !i0) return null;
    const e = real ? deflactar(e0, S("export_prices")) : e0, i = real ? deflactar(i0, S("import_prices")) : i0; if (!e || !i) return null;
    const ye = yoy(e0), yi = yoy(i0), pe = yoy(S("export_prices")), pi = yoy(S("import_prices"));
    const fe = fechaDe(e0);
    return { titulo: `${fe.charAt(0).toUpperCase() + fe.slice(1)}: exportaciones US$ ${nf(last(e0)[1], 1)} mil M e importaciones ${nf(last(i0)[1], 1)} mil M por mes (promedio 3 meses: ${nf(last(roll(e0, 3))[1], 1)} y ${nf(last(roll(i0, 3))[1], 1)}); interanual nominal ${sg(last(ye)[1])}% y ${sg(last(yi)[1])}%` + (pe && pi ? `; precios de exportación ${sg(last(pe)[1])}% e importación ${sg(last(pi)[1])}%` : ""),
      sub: "Bienes y servicios, base balanza de pagos (BEA y Census), desestacionalizados, miles de millones de US$ por mes" + (real ? ", a precios del último mes (deflactados por los índices de precios de bienes del BLS)." : "."),
      unidad: "mil M", dec: 1, eventos: false,
      series: [{ n: "Exportaciones, mensual", d: cut(e), c: 0, fina: true, enLeyenda: false }, { n: "Exportaciones, promedio 3 meses", ley: "Exportaciones", det: "promedio 3 meses (línea fina: dato mensual)", d: cut(roll(e, 3)), c: 0, w: 2.6 }, { n: "Importaciones, mensual", d: cut(i), c: 1, fina: true, enLeyenda: false }, { n: "Importaciones, promedio 3 meses", ley: "Importaciones", det: "promedio 3 meses (línea fina: dato mensual)", d: cut(roll(i, 3)), c: 1, w: 2.6 }] };
  } });

def("cuentaCorriente", { slug: "cuenta-corriente", nombre: "Cuenta corriente / PBI", sin: ["cuenta corriente", "current account", "balanza de pagos", "financiamiento externo", "rentas", "ingreso primario"],
  calc: "Saldo de la cuenta corriente de la balanza de pagos (BEA) y sus componentes: bienes y servicios, ingreso primario (rentas: intereses, dividendos y utilidades que EE.UU. cobra del exterior menos los que paga) e ingreso secundario (transferencias). Trimestral, anualizado (× 4) sobre el PBI nominal. Por identidad, el déficit es lo que el resto del mundo le presta o invierte a EE.UU. en el período. Referencias: promedio 2015-19 y récord de la serie.",
  ks: ["current_account", "ca_gs", "ca_primario", "ca_secundario", "gdp_nom"],
  f: () => {
    const g = S("gdp_nom"), pb = a => a ? join(a, g, (x, y) => x * 4 / 1000 / y * 100) : null;
    const r = pb(S("current_account")); if (!r) return null;
    const cs = [["Bienes y servicios", pb(S("ca_gs")), 1], ["Rentas (ingreso primario)", pb(S("ca_primario")), 2], ["Transferencias", pb(S("ca_secundario")), 3]];
    const completos = cs.every(([, a]) => a);
    const v = last(r)[1], p = promEntre(r, 2015, 2019), rec = r.reduce((m, q) => q[1] < m[1] ? q : m);
    const ss = completos ? cs.map(([n, a, c]) => ({ n, d: cut(a), t: "bar", c, stack: "cc", suave: true })) : [];
    ss.push({ n: "Cuenta corriente", d: cut(r), c: "ink", w: 2.4 });
    const refs = [{ y: 0 }]; if (p != null) refs.push({ y: p, l: `Promedio 2015-19: ${nf(p)}%` }); refs.push({ y: rec[1], l: `Récord ${anio(rec[0])}: ${nf(rec[1])}%` });
    return { freq: "Q", titulo: `Cuenta corriente ${nf(v)}% del PBI en ${fq(last(r)[0])}` + (completos ? `: bienes y servicios ${nf(last(cs[0][1])[1])}%, rentas ${sg(last(cs[1][1])[1])}%, transferencias ${nf(last(cs[2][1])[1])}%` : "") + (p != null ? `; promedio 2015-19: ${nf(p)}%` : "") + `; récord ${anio(rec[0])}: ${nf(rec[1])}%`,
      sub: "Balanza de pagos (BEA), trimestral, anualizada sobre el PBI nominal.", cero: true, series: ss, refs };
  } });

def("dolar", { slug: "dolar", nombre: "Dólar multilateral, nominal y real", sin: ["dxy", "tipo de cambio", "usd", "dólar amplio", "broad dollar", "multilateral", "dólar real"],
  calc: "Índice del dólar contra las monedas de los 26 principales socios comerciales, ponderadas por comercio (Fed, índice broad), nominal (datos diarios con períodos de hasta 5 años) y real (ajustado por la inflación relativa con cada socio, mensual); los dos con base ene-2006 = 100. Antes de 2006 se empalma el índice broad anterior de la Fed (1973-2019, nominal y real), reescalado por el cociente promedio de los primeros 12 meses en común: las variaciones de ese tramo son las originales. A diferencia del DXY, incluye China, México y Canadá. Referencias: máximo de la serie nominal y promedio 2015-19.",
  ks: ["dollar", "dollar_real"],
  f: () => {
    const d = SD("dollar"); if (!d) return null;
    const w = diariaCompleta("dollar"), v = last(w)[1], mx = w.reduce((m, p) => p[1] > m[1] ? p : m), m1 = valorEn(w, last(w)[0] - 30.4 * DIA), pr = promEntre(S("dollar"), 2015, 2019);
    const re = S("dollar_real");
    const ss = [{ n: "Nominal", d: cut(d), c: 0, w: 2.6 }];
    if (re) ss.push({ n: "Real (mensual)", d: cut(re), c: 1, w: 1.8 });
    const refs = [{ y: mx[1], l: `Máximo nominal ${fm(mx[0])}: ${nf(mx[1], 1)}` }]; if (pr != null) refs.push({ y: pr, l: `Promedio 2015-19: ${nf(pr, 1)}` });
    return { freq: freqD("dollar"),
      titulo: `Dólar multilateral ${nf(v, 1)} al ${fdia(last(w)[0])}: ${sg((v / mx[1] - 1) * 100)}% desde su máximo de ${fm(mx[0])} (${nf(mx[1], 1)})` + (m1 ? `; ${sg((v / m1[1] - 1) * 100)}% en un mes` : "") + (re ? `; real ${nf(last(re)[1], 1)} (${fm(last(re)[0])})` : "") + (pr != null ? `; promedio 2015-19: ${nf(pr, 1)}` : ""),
      sub: `Contra 26 socios ponderados por comercio (índice broad de la Fed), ene-2006 = 100, ${txtFrec("dollar")}. Real: ajustado por la inflación relativa.` + notaParcial(),
      unidad: "", dec: 1, series: ss, refs };
  } });

def("terminos", { slug: "terminos-de-intercambio", nombre: "Términos de intercambio y petróleo", sin: ["términos de intercambio", "precios de exportación", "precios de importación", "petróleo", "wti"],
  calc: "Índice de precios de exportación sobre índice de precios de importación (BLS), 2000 = 100: sube cuando lo que EE.UU. vende al mundo se encarece respecto de lo que compra. Eje derecho: petróleo WTI (EIA vía FRED), US$ por barril; EE.UU. es exportador neto de energía desde la década pasada. Referencia: promedio 2015-19.",
  ks: ["export_prices", "import_prices", "wti"],
  f: () => {
    const r = join(S("export_prices"), S("import_prices"), (a, b) => a / b * 100); if (!r) return null;
    const v = last(r)[1], mx = r.reduce((m, p) => p[1] > m[1] ? p : m), pr = promEntre(r, 2015, 2019);
    const o = SD("wti"), ow = o ? diariaCompleta("wti") : null, oy = ow ? valorEn(ow, last(ow)[0] - 365 * DIA) : null;
    const ss = [{ n: "Términos de intercambio", d: cut(r), c: 0, w: 2.6 }];
    if (o) ss.push({ n: "Petróleo WTI (eje derecho)", d: cut(o), c: 1, w: 1.4, der: true, u: "US$", dec: 2 });
    return { titulo: `Términos de intercambio ${nf(v, 1)} en ${fechaDe(r)}` + (mx[0] < last(r)[0] ? ` (máximo de la serie: ${nf(mx[1], 1)} en ${fm(mx[0])}` : " (máximo de la serie") + (pr != null ? `; promedio 2015-19: ${nf(pr, 1)})` : ")") + (ow ? `; petróleo WTI US$ ${nf(last(ow)[1], 1)}` + (oy ? ` (${sg((last(ow)[1] / oy[1] - 1) * 100, 0)}% interanual)` : "") : ""),
      sub: "Precios de exportación sobre precios de importación (BLS), 2000 = 100. Eje derecho: petróleo WTI, US$ por barril.",
      unidad: "", dec: 1, series: ss, refs: pr != null ? [{ y: pr, l: `Promedio 2015-19: ${nf(pr, 1)}` }] : [] };
  } });

def("capexImport", { slug: "importaciones-de-capital", nombre: "Importaciones de capital vs inversión tecnológica", sin: ["importaciones", "equipos", "ia", "data centers", "semiconductores"],
  calc: "Importaciones de bienes de capital sin autos (BEA) e inversión en equipos de procesamiento de información más software (BEA), nominales, tasa anual, en miles de millones de US$. Línea punteada (eje derecho): importaciones de capital por cada dólar de inversión tecnológica. Las importaciones de capital incluyen también equipos no tecnológicos (maquinaria industrial, aviones civiles): la serie de computadoras y semiconductores no está en FRED trimestral.",
  ks: ["imp_capital", "inv_info", "inv_software"],
  f: () => {
    const i = S("imp_capital"), e = S("inv_info"), s = S("inv_software"); if (!i || !e || !s) return null;
    const t = join(e, s, (a, b) => a + b), r = join(i, t, (a, b) => a / b);
    const iy = yoy(i, 4), ty = yoy(t, 4), i3 = i.length > 3 ? last(i)[1] - i[i.length - 4][1] : null;
    return { freq: "Q", titulo: `${fq(last(i)[0])}: importaciones de bienes de capital US$ ${nf(last(i)[1], 0)} mil M (${sg(last(iy)[1])}% interanual; ${sg(i3, 0)} mil M en 3 trimestres) e inversión tecnológica ${nf(last(t)[1], 0)} mil M (${sg(last(ty)[1])}%); cociente ${nf(last(r)[1], 2)}`,
      sub: "Importaciones de bienes de capital sin autos e inversión en equipos de información más software (BEA), nominales, tasa anual. Punteada: importaciones por dólar de inversión tecnológica (eje derecho).", fuenteTxt: "BEA vía FRED",
      unidad: "mil M", dec: 0, eventos: false,
      series: [{ n: "Importaciones / inversión (eje derecho)", d: cut(r), c: "gris", w: 1.4, punteada: true, der: true, u: "", dec: 2 }, { n: "Importaciones de bienes de capital", d: cut(i), c: 1, w: 2.6 }, { n: "Inversión tecnológica", d: cut(t), c: 0, w: 2.6 }] };
  } });

// ═════════════════════════ Fiscal ═════════════════════════
// Resultado de 12 meses sobre PBI: los meses posteriores al último PBI publicado usan ese último PBI
export const deficitPBI = () => {
  const d = roll(S("deficit"), 12, true), g = S("gdp_nom"); if (!d || !g) return null;
  const r = d.map(([t, v]) => { const x = new Date(t), q = Date.UTC(x.getUTCFullYear(), Math.floor(x.getUTCMonth() / 3) * 3, 1), gg = valorEn(g, q); return gg ? [t, v / 1000 / gg[1] * 100] : null; }).filter(Boolean);
  return r.length ? r : null;
};
export const interesesPBI = () => join(S("interest_fed"), S("gdp_nom"), (a, b) => a / b * 100);
// Años como rangos: [2009, 2010, 2011, 2020, 2021] → "2009-11 y 2020-21"
function rangosAnios(ys) {
  const r = []; for (const y of [...new Set(ys)].sort()) { const u = r[r.length - 1]; if (u && y === u[1] + 1) u[1] = y; else r.push([y, y]); }
  const t = r.map(([a, b]) => a === b ? String(a) : `${a}-${String(b).slice(2)}`);
  return t.length > 1 ? t.slice(0, -1).join(", ") + " y " + t[t.length - 1] : t[0] || "";
}

def("deficit", { slug: "deficit-fiscal", nombre: "Resultado fiscal total y primario", sin: ["déficit", "fiscal", "primario", "tesoro"], historia: true,
  calc: "Resultado del gobierno federal acumulado 12 meses (Monthly Treasury Statement del Tesoro) sobre PBI nominal; negativo = déficit. El primario suma los intereses pagados (BEA, cuentas nacionales, trimestral) como % del PBI: la distancia entre las dos líneas es el costo de los intereses. Referencias: promedio 2015-19 y 2007. El título cuenta los años desde 1981 con un déficit igual o mayor al actual.",
  ks: ["deficit", "gdp_nom", "interest_fed"],
  f: () => {
    const r = deficitPBI(); if (!r) return null;
    const i = interesesPBI(), prim = i ? joinQ(r, i, (a, b) => a + b) : null;
    const v = last(r)[1], p = promEntre(r, 2015, 2019), p07 = promEntre(r, 2007, 2007);
    const anios = v < 0 ? r.filter(q => q[1] <= v + 1e-9 && q[0] < last(r)[0] - 300 * DIA).map(q => anio(q[0])) : [];
    const ss = [{ n: "Resultado total", d: cut(r), c: 1, w: 2.6 }];
    if (prim) ss.push({ n: "Resultado primario (sin intereses)", ley: "Primario", d: cut(prim), c: 0, w: 2 });
    const refs = [{ y: 0 }]; if (p != null) refs.push({ y: p, l: `Total, promedio 2015-19: ${nf(p)}%` }); if (p07 != null) refs.push({ y: p07, l: `Total, 2007: ${nf(p07)}%` });
    return { titulo: `${v < 0 ? "Déficit" : "Superávit"} fiscal ${nf(Math.abs(v))}% del PBI en 12 meses a ${fechaDe(r)}` + (prim ? `; primario ${nf(Math.abs(last(prim)[1]))}%${last(prim)[1] >= 0 ? " de superávit" : ""}` : "") + (p != null ? `; promedio 2015-19: ${nf(Math.abs(p))}%` : "") + (anios.length ? `; desde ${anio(r[0][0])}, déficits de ${nf(-v)}% o más sólo en ${rangosAnios(anios)}` : ""),
      sub: "Gobierno federal: resultado acumulado en 12 meses (Monthly Treasury Statement) sobre PBI nominal; negativo = déficit. Primario: sin intereses (BEA).",
      series: ss, refs };
  } });

def("ingresosGastos", { slug: "ingresos-y-gastos-federales", nombre: "Ingresos y gastos del gobierno federal / PBI", sin: ["gasto público", "recaudación", "ingresos fiscales", "gasto federal", "intereses"],
  calc: "Ingresos corrientes y gastos corrientes del gobierno federal (BEA, cuentas nacionales, tasa anual desestacionalizada) sobre PBI nominal. El gasto se muestra total y sin intereses (gasto total menos intereses pagados, BEA): la distancia entre las dos líneas de gasto son los intereses. Los cambios del título son contra el promedio de 2019.",
  ks: ["fed_receipts", "fed_expend", "interest_fed", "gdp_nom"],
  f: () => {
    const g = S("gdp_nom"), rp = join(S("fed_receipts"), g, (a, b) => a / b * 100), ep = join(S("fed_expend"), g, (a, b) => a / b * 100); if (!rp || !ep) return null;
    const ip = interesesPBI(), sp = ip ? join(ep, ip, (a, b) => a - b) : null;
    const y = a => promEntre(a, 2019, 2019), le = last(ep)[1], li = ip ? valorEn(ip, last(ep)[0])[1] : null;
    const ss = [{ n: "Recaudación", d: cut(rp), c: 0, w: 2.6 }, { n: "Gasto total", d: cut(ep), c: 1, w: 1.4 }];
    if (sp) ss.push({ n: "Gasto sin intereses", d: cut(sp), c: 1, w: 2.8 });
    const dG = le - y(ep), dI = ip ? li - y(ip) : null;
    return { freq: "Q", titulo: `${fq(last(ep)[0])}, % del PBI: gasto ${nf(le)} (2019: ${nf(y(ep))})` + (sp ? `, sin intereses ${nf(last(sp)[1])} (${nf(y(sp))})` : "") + `; recaudación ${nf(last(rp)[1])} (${nf(y(rp))})` + (dI != null ? `; de la suba del gasto desde 2019 (${sg(dG)} pp), ${sg(dI)} pp son intereses` : ""),
      sub: "Ingresos y gastos corrientes del gobierno federal (BEA, cuentas nacionales) sobre PBI nominal. La distancia entre las dos líneas naranjas son los intereses.",
      series: ss, shock: [T(2020, 3), T(2021, 6)], shockVentana: [T(2020, 3), T(2021, 6)] };
  } });

def("aranceles", { slug: "aranceles", nombre: "Aranceles: tasa efectiva y recaudación", sin: ["aranceles", "tariffs", "customs", "derechos de importación", "tasa arancelaria"],
  calc: "Tasa arancelaria efectiva: derechos de importación cobrados por el gobierno federal (BEA, tasa anual) sobre importaciones de bienes (BEA, cuentas nacionales). Es la tasa que se paga, no la anunciada: descuenta exenciones, acuerdos y cambios de proveedor. Barras (eje derecho): la recaudación de aduana, US$ miles de millones, tasa anual.",
  ks: ["customs", "imp_goods", "gdp_nom", "fed_receipts"],
  f: () => {
    const c = S("customs"), t = join(c, S("imp_goods"), (a, b) => a / b * 100); if (!t) return null;
    const v = last(t)[1], mx = maxEntre(t, 2025, 2100), pre = valorEn(t, T(2024, 10));
    const ant = t.filter(p => p[0] < T(2025) && p[1] >= v), desde = ant.length ? anio(ant[ant.length - 1][0]) : null;
    const pg = valorEn(join(c, S("gdp_nom"), (a, b) => a / b * 100), last(t)[0]), pr = valorEn(join(c, S("fed_receipts"), (a, b) => a / b * 100), last(t)[0]);
    return { freq: "Q", titulo: `Tasa arancelaria efectiva ${nf(v)}% en ${fq(last(t)[0])}` + (mx && mx[0] < last(t)[0] ? ` (máximo ${fq(mx[0])}: ${nf(mx[1])}%` : " (") + (pre ? `; ${fq(pre[0])}: ${nf(pre[1])}%)` : ")") + (desde ? `, la más alta desde ${desde} fuera de 2025` : "") + `; recaudación US$ ${nf(last(c)[1], 0)} mil M por año` + (pg ? `, ${nf(pg[1], 2)}% del PBI` : "") + (pr ? ` y ${nf(pr[1], 1)}% de la recaudación federal` : ""),
      sub: "Recaudación de aduana sobre importaciones de bienes (BEA, cuentas nacionales), trimestral. Barras: recaudación, US$ miles de millones por año (eje derecho).",
      cero: true, series: [{ n: "Recaudación de aduana (eje derecho)", d: cut(c), t: "bar", c: "gris", suave: true, der: true, u: "mil M", dec: 0 }, { n: "Tasa arancelaria efectiva", d: cut(t), c: 1, w: 2.8 }] };
  } });

def("intereses", { slug: "intereses-de-la-deuda", nombre: "Intereses de la deuda", sin: ["intereses", "costo de la deuda", "tasa implícita"], historia: true,
  calc: "Intereses pagados por el gobierno federal (BEA, cuentas nacionales) sobre PBI nominal, eje izquierdo. Eje derecho: tasa implícita de la deuda (intereses de los últimos 4 trimestres sobre la deuda en manos del público de un año antes; aproximación que combina cuentas nacionales y datos del Tesoro) y Treasury a 10 años, promedio del trimestre. Si el 10 años está por encima de la tasa implícita, cada bono que vence se renueva a una tasa más alta que la que pagaba. Referencias: promedio 2015-19 y máximo de la serie.",
  ks: ["interest_fed", "gdp_nom", "fed_receipts", "debt_public", "ust10"],
  f: () => {
    const r = interesesPBI(); if (!r) return null;
    const v = last(r)[1], mx = r.reduce((m, p) => p[1] > m[1] ? p : m), p = promEntre(r, 2015, 2019);
    const rec = join(S("interest_fed"), S("fed_receipts"), (a, b) => a / b * 100), r19 = rec ? promEntre(rec, 2019, 2019) : null;
    const it = S("interest_fed"), G = new Map(S("gdp_nom") || []), D = new Map(S("debt_public") || []);
    const imp = []; if (it) for (let k = 4; k < it.length; k++) { const t = it[k][0], t4 = it[k - 4][0]; if (D.has(t4) && G.has(t4)) imp.push([t, it.slice(k - 3, k + 1).reduce((s, q) => s + q[1], 0) / 4 / (D.get(t4) / 100 * G.get(t4)) * 100]); }
    const u10 = toQ(S("ust10")), u10d = ultimoDato("ust10");
    const ss = [{ n: "Intereses / PBI", d: cut(r), c: 1, w: 2.8 }];
    if (imp.length) ss.push({ n: "Tasa implícita de la deuda (eje derecho)", d: cut(imp), c: 0, w: 2, der: true, u: "%" });
    if (u10) ss.push({ n: "Treasury 10 años (eje derecho)", d: cut(u10), c: 0, fina: true, der: true, u: "%" });
    const refs = []; if (p != null) refs.push({ y: p, l: `Promedio 2015-19: ${nf(p, 2)}%` }); refs.push({ y: mx[1], l: `Máximo ${anio(mx[0])}: ${nf(mx[1], 2)}%` });
    return { freq: "Q", titulo: `Intereses ${nf(v, 2)}% del PBI en ${fq(last(r)[0])} (2015-19: ${nf(p, 1)}%; máximo ${anio(mx[0])}: ${nf(mx[1], 2)}%)` + (rec ? ` y ${nf(last(rec)[1], 1)}% de la recaudación (2019: ${nf(r19, 1)}%)` : "") + (imp.length ? `; tasa implícita de la deuda ${nf(last(imp)[1], 1)}% contra ${nf(u10d[1], 2)}% del 10 años` : ""),
      sub: "Intereses pagados por el gobierno federal (BEA) sobre PBI. Eje derecho: intereses sobre deuda en manos del público (tasa implícita) y Treasury a 10 años.",
      dec: 2, series: ss, refs };
  } });

def("deuda", { slug: "deuda-publica", nombre: "Deuda federal / PBI", sin: ["deuda", "debt", "deuda pública"],
  calc: "Deuda federal en manos del público (excluye la que el Tesoro le debe a fondos del propio gobierno, como la seguridad social) y deuda total, sobre PBI (Tesoro y Fed de St. Louis), trimestral. La serie arranca en 1970: el máximo histórico de 1946 (alrededor de 106%) queda fuera. Referencias: 2007, 2019 y máximo de la serie.",
  ks: ["debt_public", "debt_gdp"],
  f: () => {
    const d = S("debt_public"), t = S("debt_gdp"); if (!d && !t) return null;
    const a = d || t, v = last(a)[1], mx = a.reduce((m, p) => p[1] > m[1] ? p : m), y07 = promEntre(a, 2007, 2007), y19 = promEntre(a, 2019, 2019);
    const ss = []; if (d) ss.push({ n: "En manos del público", d: cut(d), c: 0, w: 2.8 }); if (t) ss.push({ n: "Total (con fondos del gobierno)", ley: "Total", d: cut(t), c: "gris", w: 1.6 });
    const refs = []; if (y07 != null) refs.push({ y: y07, l: `2007: ${nf(y07, 1)}%` }); if (y19 != null) refs.push({ y: y19, l: `2019: ${nf(y19, 1)}%` }); if (mx[0] < last(a)[0]) refs.push({ y: mx[1], l: `Máximo ${fq(mx[0])}: ${nf(mx[1], 1)}%` });
    return { freq: "Q", titulo: `Deuda ${d ? "en manos del público" : "federal total"} ${nf(v, 1)}% del PBI en ${fq(last(a)[0])} (2019: ${nf(y19, 1)}%; 2007: ${nf(y07, 1)}%` + (mx[0] < last(a)[0] ? `; máximo ${fq(mx[0])}: ${nf(mx[1], 1)}%)` : "; máximo de la serie)") + (d && t ? `; total con fondos del gobierno ${nf(last(t)[1], 1)}%` : ""),
      sub: "Deuda federal sobre PBI (Tesoro y Fed de St. Louis), trimestral. En manos del público: excluye la que el Tesoro le debe a fondos del propio gobierno.",
      dec: 1, decEje: 0, series: ss, refs };
  } });

// Dinámica de la deuda: cambio anual de deuda/PBI = efecto tasa contra crecimiento + déficit primario + ajustes (residuo)
def("nominalTasa", { slug: "dinamica-de-la-deuda", nombre: "¿Por qué cambia la deuda? Tasa, crecimiento y déficit", sin: ["r vs g", "sostenibilidad de la deuda", "dinámica de la deuda", "déficit primario"],
  calc: "Identidad de la dinámica de la deuda (la que usan el FMI y la CBO), interanual por trimestre, en puntos del PBI: el cambio de la deuda en manos del público / PBI se descompone en (1) tasa contra crecimiento: (tasa implícita − crecimiento del PBI nominal) / (1 + crecimiento) × deuda / PBI de un año antes; la tasa implícita son los intereses de 4 trimestres (BEA) sobre la deuda de un año antes; (2) déficit primario de los últimos 12 meses (Tesoro, sin los intereses del BEA) sobre PBI; (3) ajustes de stock y flujo: la diferencia, que incluye movimientos de caja del Tesoro, valuación y diferencias entre fuentes. En períodos de más de 10 años se muestra un trimestre por año.",
  ks: ["debt_public", "interest_fed", "gdp_nom", "deficit"],
  f: () => {
    const D = new Map(S("debt_public") || []), G = S("gdp_nom"), it = S("interest_fed"), def12 = roll(S("deficit"), 12, true); if (!D.size || !G || !it || !def12) return null;
    const MG = new Map(G), MI = new Map(it), MD = new Map(def12);
    const q4 = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), 1); };
    const finTrim = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 1); };
    const prom4 = (m, t) => { let s = 0; for (let k = 0; k < 4; k++) { const d = new Date(t); const u = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 3 * k, 1); if (!m.has(u)) return null; s += m.get(u); } return s / 4; };
    let ts = [...D.keys()].filter(t => D.has(q4(t)) && MG.has(q4(t)) && prom4(MG, t) && prom4(MI, t) != null && prom4(MG, q4(t)) && MD.has(finTrim(t)));
    ts = ts.filter(t => t >= ST.T0 && t <= ST.T1); if (!ts.length) return null;
    if (ts.length > 40) ts = ts.filter(t => new Date(t).getUTCMonth() === new Date(ts[ts.length - 1]).getUTCMonth());
    const fila = t => {
      const g = (prom4(MG, t) / prom4(MG, q4(t)) - 1), d0 = D.get(q4(t)), r = prom4(MI, t) / (d0 / 100 * MG.get(q4(t)));
      const rg = (r - g) / (1 + g) * d0, intPBI = prom4(MI, t) / prom4(MG, t) * 100, totPBI = MD.get(finTrim(t)) / 1000 / prom4(MG, t) * 100;
      const prim = -(totPBI + intPBI), cambio = D.get(t) - d0;
      return { rg, prim, aj: cambio - rg - prim, cambio, r: r * 100, g: g * 100 };
    };
    const fs = ts.map(fila), u = fs[fs.length - 1];
    const series = [{ n: "Tasa contra crecimiento", t: "bar", c: 0, d: fs.map(x => x.rg) }, { n: "Déficit primario", t: "bar", c: 1, d: fs.map(x => x.prim) }, { n: "Ajustes de stock y flujo", t: "bar", c: "gris", d: fs.map(x => x.aj) },
      { n: "Cambio de la deuda / PBI", t: "line", c: "ink", w: 2.2, d: fs.map(x => x.cambio) }];
    return { tipo: "cat", freq: "Q", sinPuntos: true, unidadLinea: " pp",
      titulo: `Deuda en manos del público ${sg(u.cambio, 1)} pp del PBI en el año a ${fq(ts[ts.length - 1])}: tasa contra crecimiento ${sg(u.rg, 1)} pp (tasa implícita ${nf(u.r, 1)}% vs PBI nominal ${nf(u.g, 1)}%), déficit primario ${sg(u.prim, 1)} pp, ajustes ${sg(u.aj, 1)} pp`,
      sub: "Identidad de la dinámica de la deuda: cambio anual de la deuda / PBI y sus componentes, en puntos del PBI." + (ts.length > 40 ? "" : ""),
      cats: ts.map(fq), series };
  } });

// ═════════════════════════ Ciclo ═════════════════════════
// Mapa del ciclo: cada indicador, cada mes, ubicado en su percentil histórico (desde 2000)
const MAPA = ["pbi", "brecha", "indpro", "ordenes", "viviendas", "retail", "consumo", "ingreso", "ahorro", "confianza", "morosidad",
  "core", "core3", "cpicore", "ppi", "exp1", "exp5", "nominas", "desempleo", "sahm", "tension", "contrataciones", "salario", "pedidos",
  "fed", "ust10", "tips", "curva", "baa", "nfci", "hipo", "dolar", "balanza", "deficit"];
const mensualDe = (ind, a) => {
  if (!a || !a.length) return null;
  if (ind.w) return aMensualC(a);
  if (ind.q) return a.flatMap(([t, v]) => { const d = new Date(t); return [0, 1, 2].map(k => [Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1), v]); });
  return a;
};
function aMensualC(a) { const g = new Map(); for (const [t, v] of a) { const d = new Date(t), k = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); if (!g.has(k)) g.set(k, []); g.get(k).push(v); } return [...g].map(([k, v]) => [k, v.reduce((x, y) => x + y, 0) / v.length]); }
def("mapa", { slug: "mapa-del-ciclo", nombre: "Mapa del ciclo", sin: ["percentiles", "mapa de calor", "panorama", "ciclo", "termómetro"],
  calc: "Para cada indicador y cada mes, el percentil del dato dentro de toda su historia desde 2000: 0 es el mínimo, 50 la mediana, 100 el máximo. Es la misma vara para todos los indicadores; en series que en 2000-07 vivieron en otro régimen (tasas, curva), el percentil depende de ese período. Los datos trimestrales se repiten en los tres meses del trimestre; los semanales se promedian por mes. Celdas con borde punteado: sin dato (por ejemplo, oct-25, por el cierre del gobierno). Zona extrema: percentil menor a 10 o mayor a 90 en alguno de los últimos 3 meses.",
  ks: ["gdp_growth"],
  f: () => {
    const filas = [], data = [], vals = [], enc = [];
    let fin = 0;
    const series = MAPA.map(id => INDX[id]).filter(Boolean).map(ind => { let a = null; try { a = mensualDe(ind, ind.s()); } catch (e) {} return a && a.length ? { ind, a } : null; }).filter(Boolean);
    for (const { a } of series) fin = Math.max(fin, last(a)[0]);
    const cols = []; for (let k = 35; k >= 0; k--) { const d = new Date(fin); cols.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1)); }
    const ultimo = [];   // percentil del último dato de cada indicador
    let frente = null;
    for (const { ind, a } of series) {
      const hist = a.filter(p => p[0] >= T(2000)).map(p => p[1]).sort((x, y) => x - y); if (hist.length < 24) continue;
      if (ind.f !== frente) { frente = ind.f; enc.push(filas.length); filas.push(FRENTES[frente] || frente); }
      const m = new Map(a), fi = filas.length; filas.push(ind.n);
      const pctOf = v => { let lo = 0; while (lo < hist.length && hist[lo] < v) lo++; return Math.min(100, Math.round(lo / (hist.length - 1) * 100)); };
      let ult = null;
      cols.forEach((t, xi) => { const v = m.get(t);
        if (v == null) { if (t >= a[0][0] && t <= last(a)[0]) data.push([xi, fi, -1]); return; }
        const pc = pctOf(v); data.push([xi, fi, pc]); vals.push([xi, fi, v, ind]); if (xi >= cols.length - 3) ult = { n: ind.n, pc }; });
      if (ult) ultimo.push(ult);
    }
    if (filas.length < 10) return null;
    const altos = ultimo.filter(u => u.pc >= 90).sort((x, y) => y.pc - x.pc), bajos = ultimo.filter(u => u.pc <= 10).sort((x, y) => x.pc - y.pc);
    const nom = xs => xs.slice(0, 4).map(u => `${u.n} (${u.pc})`).join(", ") + (xs.length > 4 ? ` y ${xs.length - 4} más` : "");
    const vmap = new Map(vals.map(v => [v[0] + ":" + v[1], v]));
    return { tipo: "heat", sinDato: true, encabezados: enc,
      titulo: `${altos.length + bajos.length} de ${ultimo.length} indicadores en zona extrema de su historia desde 2000` + (altos.length ? `; altos (percentil > 90): ${nom(altos)}` : "") + (bajos.length ? `; bajos (< 10): ${nom(bajos)}` : ""),
      sub: "Cada fila, un indicador; cada columna, un mes. Color: percentil del dato en su historia desde 2000 (azul, mínimo; gris, mediana; rojo, máximo). Mide distancia a lo normal, no si es bueno o malo. Borde punteado: sin dato.",
      fuenteTxt: "BEA, BLS, Census, Fed, Tesoro y U. de Michigan vía FRED", cols: cols.map(fm), filas, data, series: [], vmin: 0, vmax: 100, vtxt: ["Percentil 100", "0"], izq: 210,
      tip: ([x, y, pc]) => { const v = vmap.get(x + ":" + y); return `<b>${esc(filas[y])}</b><br>${fm(cols[x])}: ${v ? nf(v[2], v[3].d) + (v[3].u === "%" ? "%" : v[3].u ? " " + v[3].u : "") : ""} · percentil ${pc}`; },
      tabla: { cab: ["Indicador", ...cols.slice(-6).map(fm)], filas: filas.map((f, yi) => enc.includes(yi) ? null : [f, ...cols.slice(-6).map((t, j) => { const v = vmap.get((cols.length - 6 + j) + ":" + yi); return v ? nf(v[2], v[3].d) : ""; })]).filter(Boolean) } };
  } });

// Ciclos comparados: este ciclo de la Fed contra los anteriores, alineados al primer movimiento
// Los inicios se detectan solos en la tasa objetivo: primer movimiento en una dirección después de uno en la dirección contraria
const iniciosCiclo = signo => { const r = iniciosFed(signo).map(t => { const f = new Date(t); return Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), 1); }); return r.length ? r : null; };
const ANCLA = { id: "ancla", nombre: "Ciclo", valores: [["c", "Desde el primer recorte"], ["s", "Desde la primera suba"]] };
function ciclos(o, serie, modo) {
  const ini = iniciosCiclo(o.ancla === "s" ? 1 : -1); if (!ini || !ini.length || !serie) return null;
  const m = new Map(serie.map(p => { const d = new Date(p[0]); return [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), p[1]]; }));
  const meses = []; for (let k = -12; k <= 36; k++) meses.push(k);
  const fila = t0 => { const d0 = new Date(t0), base = m.get(t0); return meses.map(k => { const v = m.get(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + k, 1)); return v == null || (modo === "cambio" && base == null) ? null : modo === "cambio" ? v - base : v; }); };
  const actual = ini[ini.length - 1], previos = ini.slice(0, -1);
  const filas = previos.map(t => ({ t, d: fila(t) })).filter(x => x.d.some(v => v != null));
  // cada ciclo anterior se clasifica según haya empezado una recesión (NBER) entre 6 meses antes y 24 meses después del mes 0
  filas.forEach(f => { f.rec = RECESIONES_NBER.some(([a]) => a >= f.t - 183 * DIA && a <= f.t + 731 * DIA); });
  const promDe = fs => meses.map((_, i) => { const xs = fs.map(f => f.d[i]).filter(v => v != null); return xs.length >= 1 ? xs.reduce((a, b) => a + b, 0) / xs.length : null; });
  const conR = filas.filter(f => f.rec), sinR = filas.filter(f => !f.rec);
  const prom = promDe(filas), promR = conR.length ? promDe(conR) : null, promS = sinR.length ? promDe(sinR) : null;
  const da = fila(actual);
  let ultK = da.length - 1; while (ultK > 0 && da[ultK] == null) ultK--;
  // si la Fed ya cambió de dirección después del inicio de este ciclo: en qué mes
  const contra = iniciosCiclo(o.ancla === "s" ? -1 : 1) || [], giro = contra.find(t => t > actual);
  const dA = new Date(actual), mesGiro = giro ? (new Date(giro).getUTCFullYear() - dA.getUTCFullYear()) * 12 + new Date(giro).getUTCMonth() - dA.getUTCMonth() : null;
  return { meses, actual, filas, prom, promR, promS, conR, sinR, da, ultK, giro, mesGiro, anio: t => new Date(t).getUTCFullYear(), mesTxt: t => fm(t) };
}
function defCiclo(id, slug, nombre, sujeto, sin, ks, serieFn, modo, unidad, dec, explica, refFn) {
  def(id, { slug, nombre, sin, ops: [ANCLA], ks, historia: true, sinPeriodo: true, calc: `${explica} Cada línea gris es un ciclo anterior, con su año al final; al pasar el mouse por una se resalta. Los ciclos se alinean en el mes del primer movimiento de la tasa objetivo de la Fed (mes 0) y se detectan solos: el primer recorte después de una suba, o la primera suba después de un recorte. Desde 1988 (antes, la Fed movía su objetivo en pasos muy chicos y no hay ciclos claros). Los promedios se separan según haya empezado una recesión fechada por la NBER entre 6 meses antes y 24 meses después del mes 0; la regla se aplica sin excepciones (2019 cuenta como "con recesión" por la de 2020, aunque su causa fue la pandemia).`,
    f: o => {
      const c = ciclos(o, serieFn(), modo); if (!c) return null;
      const refCiclo = refFn ? refFn() : null;
      const dir = o.ancla === "s" ? "primera suba" : "primer recorte", deDir = o.ancla === "s" ? "de la primera suba" : "del primer recorte";
      const series = c.filas.map(f => ({ n: `${c.anio(f.t)} (${c.mesTxt(f.t)})`, etiquetaFin: String(c.anio(f.t)), t: "line", c: "gris", fina: true, d: f.d, enLeyenda: false }));
      const anios = fs => fs.map(f => c.anio(f.t)).join(", ");
      if (c.promR) series.push({ n: `Promedio con recesión (${anios(c.conR)})`, ley: "Con recesión", t: "line", c: "ink", w: 2, punteada: true, d: c.promR });
      if (c.promS) series.push({ n: `Promedio sin recesión (${anios(c.sinR)})`, ley: "Sin recesión", t: "line", c: 1, w: 2, punteada: true, d: c.promS });
      if (refCiclo) series.push({ n: refCiclo[1], t: "line", c: "gris", w: 1.2, punteada: true, d: c.meses.map(() => refCiclo[0]), enLeyenda: true });
      series.push({ n: `Este ciclo (${c.mesTxt(c.actual)})`, t: "line", c: 0, w: 3.2, d: c.da });
      const va = c.da[c.ultK], vp = c.prom[c.ultK], k = c.meses[c.ultK], vR = c.promR ? c.promR[c.ultK] : null, vS = c.promS ? c.promS[c.ultK] : null;
      const fmt = v => (modo === "cambio" ? sg(v, dec) : nf(v, dec)) + unidadTxt(unidad);
      // eje: percentiles 2 y 98 de todos los ciclos, siempre incluyendo este ciclo y el promedio
      const todos = c.filas.flatMap(f => f.d).filter(v => v != null).sort((a, b) => a - b), fijos = c.da.concat(c.promR || [], c.promS || [], refCiclo ? [refCiclo[0]] : []).filter(v => v != null);
      const q = f => todos[Math.round(f * (todos.length - 1))];
      let lo = Math.min(q(0.02), ...fijos), hi = Math.max(q(0.98), ...fijos);
      const r0 = (hi - lo) / 5 || 1, e = Math.pow(10, Math.floor(Math.log10(r0))), paso = (r0 / e <= 1 ? 1 : r0 / e <= 2 ? 2 : r0 / e <= 5 ? 5 : 10) * e;
      lo = Math.floor(lo / paso) * paso; hi = Math.ceil(hi / paso) * paso;
      const rango = todos.length && (todos[0] < lo || todos[todos.length - 1] > hi) ? [lo, hi, true] : [null, null, false];
      return { tipo: "cat", sinPuntos: true, signo: modo === "cambio", escala: true, unidad, dec, decEje: Math.min(dec, 1),
        titulo: c.ultK <= c.meses.indexOf(0) + 2 ? `${nombre}: el ciclo de ${o.ancla === "s" ? "subas" : "recortes"} actual empezó en ${c.mesTxt(c.actual)} (${Math.max(0, k)} ${k === 1 ? "mes" : "meses"} de historia)`
          : va == null ? `${nombre}: este ciclo contra los anteriores`
          : `Mes ${k} desde el ${dir} (${c.mesTxt(c.actual)}): ${sujeto} ${modo === "cambio" ? "cambió" : "está en"} ${fmt(va)}` + (vS != null ? `; ciclos sin recesión (${anios(c.sinR)}): ${fmt(vS)}` : "") + (vR != null ? `; con recesión (${anios(c.conR)}): ${fmt(vR)}` : "") + (c.giro ? `; en el mes ${c.mesGiro} la Fed ${o.ancla === "s" ? "empezó a bajar" : "volvió a subir"}` : ""),
        yMin: rango[0], yMax: rango[1],
        sub: `Meses ${o.ancla === "s" ? "desde la primera suba" : "desde el primer recorte"} de la Fed${modo === "cambio" ? "; cambio contra el mes 0" : ""}. En gris, los ciclos desde 1988; promedios separados según haya empezado una recesión (NBER) en los 24 meses siguientes.${rango[2] ? " Eje recortado: algún ciclo sale de la escala." : ""}`,
        cats: c.meses.map(x => (x > 0 ? "+" : "") + x), series };
    } });
}
defCiclo("cicloTasa", "ciclos-tasa-de-la-fed", "Tasa de la Fed", "la tasa de la Fed", ["ciclos", "recortes", "subas", "ciclo de tasas"], ["fed_funds", "fed_obj_sup"], () => S("fed_funds"), "cambio", "pp", 2, "Cambio de la tasa efectiva de fondos federales (promedio mensual) contra el mes del primer movimiento.");
defCiclo("cicloDesempleo", "ciclos-desempleo", "Desempleo", "el desempleo", ["ciclos", "desempleo", "aterrizaje suave"], ["unemployment", "fed_obj_sup"], () => S("unemployment"), "cambio", "pp", 1, "Cambio de la tasa de desempleo contra el mes del primer movimiento de la Fed.");
defCiclo("cicloCore", "ciclos-inflacion", "Core PCE", "el core PCE", ["ciclos", "inflación"], ["pce_core", "fed_obj_sup"], () => yoy(S("pce_core")), "nivel", "%", 1, "Inflación core PCE interanual. La referencia es la meta de 2% de la Fed.", () => [2, "Meta Fed 2%"]);
defCiclo("cicloSpread", "ciclos-spread", "Spread Baa", "el spread Baa", ["ciclos", "crédito", "spread"], ["baa_spread", "fed_obj_sup"], () => S("baa_spread"), "nivel", "pp", 2, "Spread de los bonos corporativos Baa sobre el Treasury a 10 años, promedio mensual. La referencia es su promedio 1986-2019, la misma de Tasas.", () => { const p = promEntre(S("baa_spread"), 1986, 2019); return p != null ? [p, `Promedio 1986-2019: ${nf(p, 2)} pp`] : null; });

// Revisiones: cuánto cambió el dato desde su primera publicación
def("revEmpleo", { slug: "revisiones-del-empleo", nombre: "Revisiones de las nóminas", sin: ["revisiones", "benchmark", "primera estimación", "nóminas", "confiabilidad"],
  calc: "Diferencia entre el cambio mensual de las nóminas que se conoce hoy y el que se publicó por primera vez (ALFRED, el archivo de versiones de la Fed de St. Louis), en miles. Incluye las revisiones de los dos meses siguientes y la revisión anual de febrero. Negativo: el primer dato sobreestimó el empleo. Los 2 últimos meses siguen abiertos (en gris claro) y la suma de 12 meses usa sólo meses cerrados. La serie de primeras publicaciones arranca en 2015.",
  ks: ["payrolls", "payrolls_1ra"],
  f: () => {
    const p1 = S("payrolls_1ra"), p = S("payrolls"); if (!p1 || !p) return null;
    const rev = join(diff(p), p1, (a, b) => a - b); if (!rev || rev.length < 15) return null;
    const cerr = rev.slice(0, -2), abiertos = rev.slice(-2), s12 = roll(cerr, 12, true), tot = last(s12)[1];
    // desde cuándo todas las sumas de 12 meses son del mismo signo
    let i = s12.length - 1; while (i > 0 && Math.sign(s12[i - 1][1]) === Math.sign(tot)) i--;
    const desdeSigno = s12.length - i >= 12 ? fm(s12[i][0]) : null;
    const pk = s12.reduce((m, q) => (tot < 0 ? q[1] < m[1] : q[1] > m[1]) ? q : m);
    return { titulo: `Revisiones de las nóminas en los 12 meses cerrados a ${fechaDe(cerr)}: ${sg(tot, 0)} mil (${sg(tot / 12, 0)} mil por mes)` + (desdeSigno ? `; ${tot < 0 ? "negativas" : "positivas"} en cada suma de 12 meses desde ${desdeSigno}` : "") + `; máximo ${tot < 0 ? "hacia abajo" : "hacia arriba"}: ${sg(pk[1], 0)} mil (${fm(pk[0])})`,
      sub: "Cambio mensual de las nóminas que se conoce hoy menos el publicado por primera vez (ALFRED), en miles. Gris claro: los 2 últimos meses, todavía abiertos.",
      unidad: "mil", dec: 0, cero: true, eventos: false, shock: [T(2020, 3), T(2021, 12)], shockVentana: [T(2020, 3), T(2021, 12)],
      series: [{ n: "Revisión del mes", t: "bar", c: 1, d: cut(cerr) }, { n: "Meses abiertos", sinValor: true, t: "bar", c: "gris", suave: true, d: cut(abiertos) }, { n: "Suma de 12 meses cerrados", c: "ink", w: 2.2, d: cut(s12) }], refs: [{ y: 0 }] };
  } });
def("revPBI", { slug: "revisiones-del-pbi", nombre: "Revisiones del PBI", sin: ["revisiones", "primera estimación", "pbi", "advance", "confiabilidad"],
  calc: "Crecimiento trimestral anualizado del PBI real tal como se publicó por primera vez (estimación anticipada, ALFRED) contra el dato vigente hoy (BEA). Barras: la revisión (hoy menos primera); positivo: la primera estimación subestimó. Las marcas señalan los trimestres que cambiaron de signo. Un trimestre que todavía no se revisó no entra en los promedios. La serie de primeras estimaciones arranca en 2014.",
  ks: ["gdp_growth", "gdp_1ra"],
  f: () => {
    const g1 = S("gdp_1ra"), g = S("gdp_growth"); if (!g1 || !g) return null;
    const rev = join(g, g1, (a, b) => a - b); if (!rev || rev.length < 4) return null;
    // el último trimestre está abierto sólo si todavía no se revisó (dato de hoy igual a la primera estimación)
    const abierto = Math.abs(last(rev)[1]) < 1e-9, cer = abierto ? rev.slice(0, -1) : rev, m = cer.reduce((x, y) => x + y[1], 0) / cer.length, ma = cer.reduce((x, y) => x + Math.abs(y[1]), 0) / cer.length;
    const mg = new Map(g), m1 = new Map(g1), signo = cer.filter(([t]) => Math.sign(mg.get(t)) !== Math.sign(m1.get(t)) && Math.abs(m1.get(t)) > 0.05);
    const uc = cer[cer.length - 1][0];
    const ss = [{ n: "Revisión (pp)", d: cut(rev), t: "bar", c: "gris", suave: true }, { n: "Dato de hoy", d: cut(g.filter(p => m1.has(p[0]) || p[0] > uc)), c: 0, w: 2.2 }, { n: "Primera estimación", d: cut(g1), c: 1, w: 1.6, punteada: true }];
    const vis = signo.filter(([t]) => t >= ST.T0);
    if (vis.length) ss.push({ n: "Cambió de signo", t: "nota", c: 1, d: vis.map(([t]) => [t, mg.get(t)]), textos: vis.map(([t]) => `${fq(t)}: ${sg(m1.get(t))} → ${sg(mg.get(t))}`), enLeyenda: false });
    return { freq: "Q", titulo: `Revisión del PBI desde ${anio(rev[0][0])}: promedio ${sg(m, 2)} pp por trimestre (${nf(ma, 2)} pp en valor absoluto)` + (signo.length ? `; ${signo.length} ${signo.length === 1 ? "trimestre cambió" : "trimestres cambiaron"} de signo (${signo.map(([t]) => fq(t)).join(" y ")})` : "") + `; ${fq(uc)}: de ${nf(m1.get(uc))}% a ${nf(mg.get(uc))}%`,
      sub: "% trimestral anualizado: estimación anticipada (ALFRED) contra el dato vigente (BEA). Barras: revisión.",
      series: ss, refs: [{ y: 0 }], shock: [T(2020, 3), T(2020, 12)], shockVentana: [T(2020, 3), T(2020, 12)] };
  } });

// ═════════════════════════ Organización por frente ═════════════════════════
export const BLOQUES = {
  actividad: [["¿Cuánto crece y qué lo empuja?", [["contribuciones", "ancha"], ["gdpnow"], ["demandaPrivada"]]],
    ["¿Está por encima de su potencial?", [["brecha"], ["productividad"]]],
    ["¿Qué dicen los datos del mes?", [["encuestas"], ["industria"], ["ordenes"], ["viviendas"]]],
    ["¿Dónde está el ciclo de inversión y ganancias?", [["capex"], ["ganancias"]]]],
  consumidor: [["¿Cuánto gasta?", [["ventas"], ["consumoTipo"], ["autos"], ["sentimiento"]]],
    ["¿Con qué lo paga?", [["ingresoConsumo"], ["motores"], ["ahorro"], ["credito"]]],
    ["¿Cuánto aguanta?", [["riqueza", "ancha"], ["servicioDeuda"], ["morosidad"]]]],
  precios: [["¿Dónde está la inflación y hacia dónde va?", [["pce"], ["momentum"], ["subyacente", "ancha"]]],
    ["¿Es amplia o concentrada?", [["heat", "ancha alta"], ["difusion"], ["serviciosBienes"]]],
    ["¿Qué viene por la cañería?", [["preciosPagados"], ["ppi"], ["bienesCore", "ancha"]]],
    ["Componentes y otras medidas", [["cpiPce"], ["vivienda"], ["componentes"], ["expectativas"]]]],
  empleo: [["¿Cuánto empleo se crea y dónde?", [["nominas", "ancha"], ["composicion"], ["desempleo"]]],
    ["¿Qué tan ajustado está el mercado?", [["sahm"], ["tension"], ["rotacion"], ["epop"]]],
    ["¿Los salarios son compatibles con 2% de inflación?", [["salarioReal"], ["eci"]]],
    ["Señales semanales", [["pedidos"], ["continuos"]]]],
  tasas: [["¿Qué forma tiene la curva?", [["curvaTesoro", "ancha"], ["curva"], ["pendiente"]]],
    ["¿Qué hace y qué se espera de la Fed?", [["politica"], ["senda"], ["balanceFed", "ancha"]]],
    ["¿Qué hay detrás de la tasa larga?", [["tasaReal"], ["primaPlazo"]]],
    ["¿Cómo están el crédito y las condiciones financieras?", [["spreads"], ["hyCalidad"], ["nfci"], ["hipotecaria"]]]],
  externo: [["¿Cuánto le compra y le vende al mundo?", [["balanza", "ancha"], ["expoImpo"], ["cuentaCorriente"]]],
    ["Precios, moneda e inversión", [["dolar"], ["terminos"], ["capexImport", "ancha"]]]],
  ciclo: [["¿Dónde está cada variable respecto de su historia?", [["mapa", "ancha muy-alta"]]],
    ["¿Este ciclo se parece a los anteriores?", [["cicloTasa"], ["cicloDesempleo"], ["cicloCore"], ["cicloSpread"]]],
    ["¿Qué tan confiable es el primer dato?", [["revEmpleo", "ancha"], ["revPBI"], ["pbiGdi"]]]],
  fiscal: [["¿Cuánto gasta, cuánto recauda y cuánto pide prestado?", [["deficit", "ancha"], ["ingresosGastos"], ["aranceles"]]],
    ["¿Cuánto cuesta la deuda y es sostenible?", [["intereses"], ["deuda"], ["nominalTasa", "ancha"]]]],
};
export const PREGUNTAS_CICLO = [["brecha", "ancha"], ["heat", "ancha alta"], ["composicion"], ["politica"]];
for (const [f, bloques] of Object.entries(BLOQUES)) for (const [, lista] of bloques) for (const [id] of lista) CAT[id].frente = f;
// Secciones con gráficos que usan la historia completa: se carga antes de dibujar
export const seccionConHistoria = sec => sec === "ciclo" || (BLOQUES[sec] || []).some(([, l]) => l.some(([id]) => CAT[id] && CAT[id].historia)) || (sec === "portada" && PREGUNTAS_CICLO.some(([id]) => CAT[id] && CAT[id].historia));
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
  { id: "indpro", f: "actividad", n: "Producción manufacturera", nota: "interanual", u: "%", d: 1, ks: ["ip_man"], g: "industria", s: () => yoy(S("ip_man") || S("indpro")) },
  { id: "retail", f: "consumidor", n: "Ventas: grupo de control", nota: "real, interanual", u: "%", d: 1, ks: ["retail", "r_autos", "r_nafta", "r_materiales", "r_restaurantes", "cpi_core_goods"], g: "ventas", s: () => yoy(controlReal() || S("retail")) },
  { id: "ordenes", f: "actividad", n: "Órdenes de capital", nota: "reales, prom. 3m, interanual", u: "%", d: 1, ks: ["core_orders"], g: "ordenes", s: () => yoy(roll(deflactar(S("core_orders"), S("ppi_capital")), 3)) },
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
  { id: "fed", f: "tasas", n: "Fondos federales", nota: "tasa efectiva", ultD: "fed_funds", u: "%", d: 2, ks: ["fed_funds"], g: "curva", s: () => S("fed_funds") },
  { id: "ust2", f: "tasas", n: "Treasury 2 años", nota: "último cierre", u: "%", d: 2, ks: ["ust2"], g: "curvaTesoro", diario: "2A", s: () => S("ust2") },
  { id: "ust10", f: "tasas", n: "Treasury 10 años", nota: "último cierre", u: "%", d: 2, ks: ["ust10"], g: "curvaTesoro", diario: "10A", s: () => S("ust10") },
  { id: "tips", f: "tasas", n: "Tasa real 10 años", nota: "TIPS, último cierre", ultD: "tips10", u: "%", d: 2, ks: ["tips10"], g: "tasaReal", s: () => S("tips10") },
  { id: "curva", f: "tasas", n: "Curva 10-2", nota: "puntos básicos, último cierre", u: "pb", d: 0, ks: ["ust10"], g: "pendiente", diario: ["10A", "2A"], s: () => join(S("ust10"), S("ust2"), (a, b) => (a - b) * 100) },
  { id: "prima", ultD: "term_premium", f: "tasas", n: "Prima por plazo 10 años", nota: "Kim-Wright", u: "%", d: 2, ks: ["term_premium"], g: "primaPlazo", s: () => S("term_premium") },
  { id: "nfci", f: "tasas", n: "Condiciones financieras", nota: "NFCI semanal, 0 = promedio", ultD: "nfci", u: "", d: 2, ks: ["nfci"], g: "nfci", s: () => S("nfci") },
  { id: "descuenta", f: "tasas", n: "2 años − Fed", nota: "pb, último cierre", ultD: () => { const a = ST.D.ust2, b = ST.D.fed_funds; return a && b ? [a[a.length - 1][0], (a[a.length - 1][1] - (valorEnD(b, a[a.length - 1][0]) ?? b[b.length - 1][1])) * 100] : null; }, u: "pb", d: 0, ks: ["ust2", "fed_funds"], g: "senda", s: () => join(S("ust2"), S("fed_funds"), (a, b) => (a - b) * 100) },
  { id: "baa", f: "tasas", n: "Spread corporativo Baa", nota: "pp sobre el Treasury 10 años, último cierre", ultD: "baa_spread", u: "pp", d: 2, ks: ["baa_spread"], g: "spreads", s: () => S("baa_spread") },
  { id: "hipo", f: "tasas", n: "Hipotecaria 30 años", nota: "Freddie Mac, semanal", ultD: "mortgage30", u: "%", d: 2, ks: ["mortgage30"], g: "hipotecaria", s: () => S("mortgage30") },
  { id: "balanza", f: "externo", n: "Balanza comercial", nota: "US$ mil M por mes, prom. 3m", u: "mil M", d: 1, ks: ["trade_balance"], g: "balanza", s: () => roll(escala(S("trade_balance"), 1 / 1000), 3) },
  { id: "dolar", f: "externo", n: "Dólar multilateral", nota: "interanual", u: "%", d: 1, ks: ["dollar"], g: "dolar", s: () => yoy(S("dollar")) },
  { id: "expo", f: "externo", n: "Exportaciones", nota: "interanual, bienes y servicios", u: "%", d: 1, ks: ["exports"], g: "expoImpo", s: () => yoy(S("exports")) },
  { id: "impo", f: "externo", n: "Importaciones", nota: "interanual, bienes y servicios", u: "%", d: 1, ks: ["imports"], g: "expoImpo", s: () => yoy(S("imports")) },
  { id: "terminos", f: "externo", n: "Términos de intercambio", nota: "precios de expo / impo, 2000 = 100", u: "", d: 1, ks: ["export_prices", "import_prices"], g: "terminos", s: () => join(S("export_prices"), S("import_prices"), (a, b) => a / b * 100) },
  { id: "cc", f: "externo", n: "Cuenta corriente", nota: "% del PBI", u: "%", d: 1, q: true, ks: ["current_account"], g: "cuentaCorriente", s: () => join(S("current_account"), S("gdp_nom"), (a, b) => a * 4 / 1000 / b * 100) },
  { id: "deficit", f: "fiscal", n: "Resultado fiscal", nota: "% del PBI, 12 meses", u: "%", d: 1, ks: ["deficit"], g: "deficit", s: () => deficitPBI() },
  { id: "gastos", f: "fiscal", n: "Gasto federal", nota: "% del PBI, cuentas nacionales", u: "%", d: 1, q: true, ks: ["fed_expend"], g: "ingresosGastos", s: () => join(S("fed_expend"), S("gdp_nom"), (a, b) => a / b * 100) },
  { id: "ingresos", f: "fiscal", n: "Recaudación federal", nota: "% del PBI, cuentas nacionales", u: "%", d: 1, q: true, ks: ["fed_receipts"], g: "ingresosGastos", s: () => join(S("fed_receipts"), S("gdp_nom"), (a, b) => a / b * 100) },
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
  externo: ["balanza", "expo", "impo", "cc", "dolar", "terminos"],
  fiscal: ["deficit", "gastos", "ingresos", "intereses", "deuda", "aranceles"],
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
    const r = SD("tips10"), v = ultimoDato("tips10")[1], f = ultimoDato("fed_funds")[1], c = last(yoy(S("pce_core")))[1];
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
