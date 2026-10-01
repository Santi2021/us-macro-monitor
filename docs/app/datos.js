// Estado global, acceso a series, fuentes, calendario y revisiones.
import { T, P, DIA_MS, hoyUTC, fm, fq, fw, fd, nf, sg, unidadTxt, leer, guardar, horaBA } from "./util.js";
import { last, prev, diff, pct, yoy, escala } from "./calc.js";

export const VERSION = "5.2";
export const ST = {
  DATA: null,
  rango: { modo: "2022", desde: null, hasta: null },
  T0: T(2022), T1: Infinity, ULT: Infinity,
  diarios: new Set(),
  prefs: leer("umm-prefs", { tema: "auto", letra: "normal", recesiones: true, estrellas: [] }),
};
export const guardarPrefs = () => guardar("umm-prefs", ST.prefs);

export function calcularRango() {
  const d = new Date(ST.ULT === Infinity ? Date.now() : ST.ULT);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, r = ST.rango;
  ST.T1 = Infinity;
  if (r.modo === "2022") ST.T0 = T(2022);
  else if (r.modo === "2000") ST.T0 = T(2000);
  else if (r.modo === "todo") ST.T0 = T(1947);
  else if (r.modo === "manual" && r.desde) {
    const [y0, m0] = r.desde.split("-").map(Number), [y1, m1] = r.hasta.split("-").map(Number);
    ST.T0 = T(y0, m0);
    ST.T1 = T(y1, m1) >= T(y, m) ? Infinity : Date.UTC(y1, m1, 0);
  } else if (r.modo === "manual") ST.T0 = T(2022);
  else ST.T0 = T(y - Number(r.modo), m);
}
// Series en formato compacto {t0, dt: días entre datos, v: valores} → [[fecha, valor], ...]. Acepta también el formato viejo.
export function expandir(x) {
  if (Array.isArray(x)) return x;
  if (!x || !x.t0) return [];
  let t = P(x.t0); const out = new Array(x.v.length);
  for (let i = 0; i < x.v.length; i++) { t += x.dt[i] * DIA_MS; out[i] = [new Date(t).toISOString().slice(0, 10), x.v[i]]; }
  return out;
}
export function prepararDatos(D) { for (const s of Object.values(D.series || {})) s.d = expandir(s.d); return D; }
// La historia completa (desde 1947) vive en un archivo aparte que se carga sólo cuando el período lo pide
export const necesitaHistoria = () => ST.T0 < Date.UTC(1999, 5, 1) && !ST.historia;
export async function cargarHistoria() {
  const r = await fetch("historia.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const h = await r.json();
  for (const [k, x] of Object.entries(h.series || {})) { const d = expandir(x); if (ST.DATA.series[k] && d.length > ST.DATA.series[k].d.length) ST.DATA.series[k].d = d; }
  ST.historia = true;
  cache.clear();
}
export const periodoLargo = () => ST.T0 <= (ST.ULT === Infinity ? Date.now() : ST.ULT) - 9.5 * 365 * DIA_MS;

// Serie con datos hasta el fin del período (si el período termina antes de hoy, todo se calcula "a esa fecha")
const cache = new Map();
export function S(k) {
  const s = ST.DATA && ST.DATA.series[k];
  if (!s) return null;
  let a = cache.get(k);
  if (!a) { a = s.d.map(([d, v]) => [P(d), v]); cache.set(k, a); }
  const b = ST.T1 === Infinity ? a : a.filter(p => p[0] <= ST.T1);
  return b.length ? b : null;
}
export const limpiarCache = () => cache.clear();

// ───────── Series diarias (mercado) ─────────
// Con períodos de hasta 5 años y medio los gráficos de mercado usan el dato diario; con períodos más largos, el promedio mensual.
export async function cargarDiarios() {
  try {
    const r = await fetch("diarios.json", { cache: "no-cache" });
    if (!r.ok) return;
    const j = await r.json(), out = {};
    for (const [k, v] of Object.entries(j.series || {})) {
      const t0 = P(v.t0);
      if (v.d) out[k] = v.d.map(([n, x]) => [t0 + n * DIA_MS, x]);   // formato anterior
      else { let t = t0; out[k] = v.v.map((x, i) => [t += v.dt[i] * DIA_MS, x]); }
    }
    ST.D = out;
  } catch (e) { ST.D = null; }
}
// Inicios de ciclo de la Fed (fecha exacta del primer movimiento): primer movimiento en una dirección después de uno
// en la dirección contraria, confirmado por otro en 12 meses (o el ciclo en curso). Sale de la tasa objetivo.
export function iniciosFed(signo) {
  const a = (ST.D && ST.D.fed_obj) || [], b = (ST.D && ST.D.fed_obj_sup) || [], corte = Date.UTC(2008, 11, 1);
  const obj = a.filter(p => p[0] < corte).concat(b.filter(p => p[0] >= corte));
  if (obj.length < 10) return [];
  const movs = []; for (let i = 1; i < obj.length; i++) { const d = obj[i][1] - obj[i - 1][1]; if (Math.abs(d) >= 0.01) movs.push([obj[i][0], Math.sign(d)]); }
  const out = [];
  for (let i = 1; i < movs.length; i++) {
    const [t, s] = movs[i]; if (s !== signo || movs[i - 1][1] !== -signo) continue;
    const lim = t + 365 * DIA_MS, sigue = movs.slice(i + 1).some(([u, x]) => u <= lim && x === signo);
    if ((sigue || lim > Date.now()) && (!out.length || t - out[out.length - 1] > 365 * DIA_MS)) out.push(t);
  }
  return out.filter(t => t >= Date.UTC(1988, 0, 1));
}
export const usaDiario = () => !!ST.D && ((ST.T1 === Infinity ? Date.now() : ST.T1) - ST.T0) <= 5.5 * 365 * DIA_MS;
// Serie de mercado: diaria si corresponde, mensual si no. Devuelve [serie, frecuencia]
export function SD(k) {
  if (usaDiario() && ST.D[k] && ST.D[k].length) {
    const a = ST.D[k], b = ST.T1 === Infinity ? a : a.filter(p => p[0] <= ST.T1);
    if (b.length) return b;
  }
  return S(k);
}
export const freqD = k => usaDiario() && ST.D && ST.D[k] ? (["mortgage30", "nfci", "nfci_credit", "anfci", "fed_assets", "reserves", "tga"].includes(k) ? "W" : "D") : "M";
export const cut = (a, desde = ST.T0) => a ? a.filter(p => p[0] >= desde) : null;
export const meta = k => ST.DATA.series[k];

export function orgDe(k) { const s = ST.DATA.series[k]; if (!s) return null; return s.org ? s.org + (s.src === "FRED" ? " vía FRED" : "") : s.src; }
export function fuente(...ks) { return [...new Set(ks.map(orgDe).filter(Boolean))].join(" · "); }
export function enlaceSerie(k) {
  const s = ST.DATA.series[k]; if (!s) return null;
  if (s.src === "FRED") return `https://fred.stlouisfed.org/series/${s.id}`;
  if (s.src === "BLS") return `https://data.bls.gov/timeseries/${s.id}`;
  if (s.src === "BEA") return "https://apps.bea.gov/iTable/?reqid=19&step=2&isuri=1&categories=survey";
  return null;
}
export const FREC_TXT = { M: "mensual", Q: "trimestral", W: "semanal", D: "diaria" };

// ───────── Releases ─────────
export const RELEASES_ES = {
  "Personal Income and Outlays": "Ingresos y gastos personales",
  "Gross Domestic Product": "PBI",
  "Employment Situation": "Informe de empleo",
  "Consumer Price Index": "CPI",
  "Producer Price Index": "PPI (precios mayoristas)",
  "Job Openings and Labor Turnover Survey": "JOLTS",
  "Unemployment Insurance Weekly Claims Report": "Pedidos de desempleo",
  "G.17 Industrial Production and Capacity Utilization": "Producción industrial",
  "Advance Monthly Sales for Retail and Food Services": "Ventas minoristas",
  "Surveys of Consumers": "Confianza del consumidor",
  "U.S. International Trade in Goods and Services": "Comercio exterior",
  "Manufacturer's Shipments, Inventories, and Orders (M3) Survey": "Órdenes de la industria",
  "New Residential Construction": "Construcción de viviendas",
  "Monthly Treasury Statement": "Resultado fiscal mensual",
  "GDPNow": "GDPNow",
  "Sahm Rule Recession Indicator": "Regla de Sahm",
  "Debt to Gross Domestic Product Ratios": "Deuda pública / PBI",
  "Employment Cost Index": "Índice de costo laboral (ECI)",
  "G.19 Consumer Credit": "Crédito al consumo",
  "Charge-Off and Delinquency Rates on Loans and Leases at Commercial Banks": "Morosidad bancaria",
  "Productivity and Costs": "Productividad y costos",
  "Manufacturing Business Outlook Survey": "Encuesta de la Fed de Filadelfia",
  "Empire State Manufacturing Survey": "Encuesta Empire State (Fed de Nueva York)",
  "U.S. Import and Export Price Indexes": "Precios de importación y exportación",
  "U.S. International Transactions": "Balanza de pagos",
  "Z.1 Financial Accounts of the United States": "Cuentas financieras (Z.1)",
  "Household Debt Service Ratios": "Carga de la deuda de los hogares",
  "Supplemental Estimates, Motor Vehicles": "Ventas de vehículos",
  "Summary of Economic Projections": "Proyecciones de la Fed",
  "FOMC Press Release": "Decisión de tasa de la Fed",
};
// Organismo, hora de Nueva York e importancia (3 alta, 2 media, 1 baja)
const RELEASE_INFO = [
  [/Debt to Gross/, "Fed de St. Louis", "", 1],
  [/Employment Situation/, "BLS", "8:30", 3], [/Consumer Price Index/, "BLS", "8:30", 3], [/Personal Income/, "BEA", "8:30", 3],
  [/^Gross Domestic Product$/, "BEA", "8:30", 3], [/Retail/, "Census", "8:30", 3], [/Job Openings/, "BLS", "10:00", 3],
  [/Weekly Claims/, "Dpto. de Trabajo", "8:30", 2], [/Surveys of Consumers/, "U. de Michigan", "10:00", 2],
  [/G\.17/, "Fed", "9:15", 2], [/Residential Construction/, "Census", "8:30", 2], [/\(M3\)/, "Census", "10:00", 2],
  [/International Trade/, "BEA y Census", "8:30", 2], [/Producer Price/, "BLS", "8:30", 2], [/Monthly Treasury/, "Tesoro", "14:00", 1],
  [/Sahm/, "Fed de St. Louis", "", 1], [/Employment Cost/, "BLS", "8:30", 2], [/Consumer Credit/, "Fed", "15:00", 1],
  [/Charge-Off/, "Fed", "", 1], [/Summary of Economic Projections/, "Fed", "14:00", 3], [/FOMC|Target Range/, "Fed", "14:00", 3], [/Productivity and Costs/, "BLS", "8:30", 2], [/Business Outlook/, "Fed de Filadelfia", "8:30", 2],
  [/Empire State/, "Fed de Nueva York", "8:30", 2], [/Import and Export Price|Import Price/, "BLS", "8:30", 1], [/International Transactions/, "BEA", "8:30", 1],
  [/Z\.1|Financial Accounts/, "Fed", "12:00", 1], [/Debt Service/, "Fed", "", 1], [/Motor Vehicle/, "BEA", "", 1],
];
const FUERA_DE_AGENDA = /H\.4\.1|ICE BofA|Median Consumer|Median CPI|Trimmed Mean|Budget|Economic Outlook|Potential|Moody|Factors Affecting|H\.10|Primary Mortgage|Arbitrage-Free|H\.15|Interest Rate Spreads|GDPNow|Recession|Business Cycle|Treasury Inflation|Selected Interest|Financial Conditions/;
export const nombreRelease = n => RELEASES_ES[n] || n;
export function infoRelease(n) { const r = RELEASE_INFO.find(([re]) => re.test(n)); return r ? { org: r[1], hora: r[2], imp: r[3] } : { org: "", hora: "", imp: 1 }; }

export function releasesDiarios() {
  const c = new Map(), nombres = new Map();
  for (const e of ST.DATA.calendario || []) { c.set(e.rid, (c.get(e.rid) || 0) + 1); nombres.set(e.rid, e.nombre); }
  return new Set([...c].filter(([r, n]) => n > 30 || FUERA_DE_AGENDA.test(nombres.get(r) || "")).map(([r]) => r));
}
export const agenda = () => (ST.DATA.calendario || []).filter(c => !ST.diarios.has(c.rid) && c.series.length);

// Próximas corridas de la actualización automática (UTC, lunes a viernes)
const CORRIDAS_UTC = [[13, 10], [15, 10], [21, 10]];
export function proximaCorrida() {
  const ahora = Date.now();
  for (let d = 0; d < 7; d++) {
    const base = new Date(ahora + d * DIA_MS);
    if (base.getUTCDay() === 0 || base.getUTCDay() === 6) continue;
    for (const [h, m] of CORRIDAS_UTC) {
      const t = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m);
      if (t > ahora) return t;
    }
  }
  return null;
}
function detectadoDesde(c) {
  // el release se considera incorporado si alguna de sus series registró un dato nuevo ese día o después
  const v = ST.DATA.vistos || {};
  let mejor = null;
  for (const k of c.series) {
    const x = v[k]; if (!x) continue;
    if (x.det.slice(0, 10) >= c.fecha && (!mejor || x.det < mejor)) mejor = x.det;
  }
  return mejor;
}
function diasHabiles(desde, hasta) {
  let n = 0;
  for (let d = desde + DIA_MS; d <= hasta; d += DIA_MS) { const w = new Date(d).getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
// Estado honesto de un release: prog (programado), esp (esperando), pub (publicado), sin (sin dato nuevo)
export function estadoRelease(c) {
  const hoy = hoyUTC(), f = P(c.fecha);
  if (f > hoy) return { e: "prog", txt: "Programado" };
  if (!ST.DATA.vistos) return { e: "pub", txt: "Publicado" };   // datos de la versión anterior del motor
  const det = detectadoDesde(c);
  if (det) return { e: "pub", txt: "Publicado", det };
  if (diasHabiles(f, hoy) <= 1) {
    const pc = proximaCorrida();
    return { e: "esp", txt: "Esperando", nota: pc ? `Entra en la próxima actualización (${horaBA(new Date(pc).toISOString()).txt} h de Buenos Aires).` : "" };
  }
  return { e: "sin", txt: "Sin dato nuevo", nota: "La fuente no publicó cambios en las series que sigue el monitor, o el dato se demoró." };
}
export function proximoRelease(ks) {
  const rids = new Set(ks.map(k => ST.DATA.series[k] && ST.DATA.series[k].rel).filter(Boolean));
  if (!rids.size) return null;
  if ([...rids].every(r => ST.diarios.has(r))) return { diario: true };
  const hoy = hoyUTC();
  const e = agenda().filter(c => rids.has(c.rid) && (P(c.fecha) > hoy || estadoRelease(c).e === "esp")).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  return e ? { fecha: P(e.fecha), nombre: nombreRelease(e.nombre) } : null;
}
export function releaseDe(k) {
  const rid = ST.DATA.series[k] && ST.DATA.series[k].rel;
  return rid ? (ST.DATA.calendario || []).find(c => c.rid === rid) : null;
}
// Momento en que el monitor incorporó el último dato de la serie
export const incorporado = k => ST.DATA.vistos && ST.DATA.vistos[k] ? ST.DATA.vistos[k].det : null;

// ───────── Revisiones ─────────
// Primera publicación del valor transformado (fn sobre [v(obs-2), v(obs-1), v(obs)]) de una observación
export function primeraPub(k, obsISO, fn) {
  const r = ST.DATA.primeras && ST.DATA.primeras[k] && ST.DATA.primeras[k][obsISO];
  return r ? fn(r) : null;
}
// Dato del mes, anterior (revisado) y primera publicación del anterior
export function datoConRevision(k, tipo) {
  const a = S(k); if (!a || a.length < 3) return null;
  const tf = tipo === "diff" ? r => r[2] - r[1] : tipo === "pct" ? r => (r[2] / r[1] - 1) * 100 : r => r[2];
  const serie = tipo === "diff" ? diff(a) : tipo === "pct" ? pct(a) : a;
  const u = last(serie), p = prev(serie);
  const obsPrev = new Date(p[0]).toISOString().slice(0, 10);
  const pp = primeraPub(k, obsPrev, tf);
  return { t: u[0], v: u[1], ant: p[1], antPrimera: pp };
}

// ───────── Resultados por release (calendario, qué cambió) ─────────
export function resultadoRelease(nombre) {
  const r = [];
  const add = (n, k, tipo, d, u = "%", signo = false, f = 1) => {
    const x = datoConRevision(k, tipo); if (!x) return;
    const fmt = v => (signo ? sg(v * f, d) : nf(v * f, d)) + unidadTxt(u);
    const revisado = x.antPrimera != null && Math.abs(x.antPrimera - x.ant) * f >= Math.pow(10, -d) / 2;
    r.push({ n, v: fmt(x.v), p: fmt(x.ant), pr: revisado ? fmt(x.antPrimera) : null, k });
  };
  const addSerie = (n, k, a, d, u = "%", signo = false) => {
    if (!a || a.length < 2) return;
    const fmt = v => (signo ? sg(v, d) : nf(v, d)) + unidadTxt(u);
    r.push({ n, v: fmt(last(a)[1]), p: fmt(prev(a)[1]), k });
  };
  try {
    if (/Debt to Gross/.test(nombre)) add("Deuda / PBI", "debt_public", "nivel", 0);
    else if (/Employment Situation/.test(nombre)) { add("Nóminas", "payrolls", "diff", 0, "mil", true); add("Desempleo", "unemployment", "nivel", 1); }
    else if (/Consumer Price Index/.test(nombre)) { add("CPI core m/m", "cpi_core", "pct", 1, "%", true); addSerie("a/a", "cpi_core", yoy(S("cpi_core")), 1); }
    else if (/Personal Income/.test(nombre)) { add("PCE core m/m", "pce_core", "pct", 1, "%", true); addSerie("a/a", "pce_core", yoy(S("pce_core")), 1); }
    else if (/^Gross Domestic Product$/.test(nombre)) add("PBI real", "gdp_growth", "nivel", 1, "%");
    else if (/Retail/.test(nombre)) add("Ventas m/m", "retail", "pct", 1, "%", true);
    else if (/Job Openings/.test(nombre)) add("Vacantes", "openings", "nivel", 2, "M", false, 1 / 1000);
    else if (/Weekly Claims/.test(nombre)) addSerie("Pedidos, semana", "claims", escala(S("claims"), 1 / 1000), 0, "mil");
    else if (/Surveys of Consumers/.test(nombre)) { addSerie("Confianza", "sentiment", S("sentiment"), 1, ""); addSerie("Infl. esperada", "infl_exp_1y", S("infl_exp_1y"), 1); }
    else if (/G\.17/.test(nombre)) add("Producción m/m", "indpro", "pct", 1, "%", true);
    else if (/Residential Construction/.test(nombre)) add("Inicios", "housing_starts", "nivel", 0, "mil");
    else if (/\(M3\)/.test(nombre)) add("Órdenes de capital m/m", "core_orders", "pct", 1, "%", true);
    else if (/International Trade/.test(nombre)) add("Balanza", "trade_balance", "nivel", 1, "mil M", false, 1 / 1000);
    else if (/Producer Price/.test(nombre)) { if (S("ppi_fd")) add("PPI demanda final m/m", "ppi_fd", "pct", 1, "%", true); else addSerie("PPI bienes de capital m/m", "ppi_capital", pct(S("ppi_capital")), 1, "%", true); }
    else if (/Productivity and Costs/.test(nombre)) { addSerie("Productividad a/a", "productivity", yoy(S("productivity"), 4), 1); addSerie("Costo laboral unitario a/a", "ulc", yoy(S("ulc"), 4), 1); }
    else if (/Business Outlook/.test(nombre)) addSerie("Actividad (difusión)", "philly", S("philly"), 1, "", true);
    else if (/Empire State/.test(nombre)) addSerie("Condiciones generales (difusión)", "empire", S("empire"), 1, "", true);
    else if (/Import and Export Price|Import Price/.test(nombre)) addSerie("Precios de importación a/a", "import_prices", yoy(S("import_prices")), 1);
    else if (/International Transactions/.test(nombre)) addSerie("Cuenta corriente", "current_account", escala(S("current_account"), 1 / 1000), 0, "mil M");
    else if (/Summary of Economic Projections/.test(nombre)) { const p = S("sep_ff"); if (p) r.push({ n: `Tasa proyectada fin ${new Date(p[0][0]).getUTCFullYear()}`, v: nf(p[0][1], 2) + "%", k: "sep_ff" }); }
    else if (/FOMC|Target Range/.test(nombre)) { const a = ST.D && ST.D.fed_obj_sup; if (a && a.length > 1) r.push({ n: "Tasa objetivo (techo)", v: nf(a[a.length - 1][1], 2) + "%", p: nf(a[a.length - 2][1], 2) + "%", k: "fed_obj_sup" }); }
    else if (/Motor Vehicle/.test(nombre)) addSerie("Ventas, millones por año", "autos", S("autos"), 1, "");
    else if (/Debt Service/.test(nombre)) addSerie("Servicio de la deuda / ingreso", "debt_service", S("debt_service"), 1);
    else if (/Monthly Treasury/.test(nombre)) addSerie("Resultado del mes", "deficit", escala(S("deficit"), 1 / 1000), 0, "mil M");
    else if (/Sahm/.test(nombre)) addSerie("Sahm", "sahm", S("sahm"), 2, "pp");
    else if (/Employment Cost/.test(nombre)) addSerie("ECI a/a", "eci", yoy(S("eci"), 4), 1);
    else if (/Consumer Credit/.test(nombre)) addSerie("Crédito a/a", "consumer_credit", yoy(S("consumer_credit")), 1);
    else if (/Charge-Off/.test(nombre)) addSerie("Morosidad tarjetas", "delinq_cards", S("delinq_cards"), 2);
  } catch (e) { console.warn(e); }
  return r;
}

// ───────── Vigía ─────────
export function vigia() {
  const D = ST.DATA, hoy = hoyUTC(), items = [];
  const gen = P(D.generado), horas = (Date.now() - gen) / 36e5;
  for (const [k, s] of Object.entries(D.series)) {
    if (!s.d.length || k === "fed_obj") continue;   // la tasa objetivo vieja terminó en 2008
    const ult = P(s.d[s.d.length - 1][0]);
    const limite = s.f === "Q" ? 300 : s.f === "W" ? 20 : 95;   // días desde el período del último dato
    const dias = Math.round((hoy - ult) / DIA_MS);
    const resp = D.respaldo && D.respaldo[k];
    items.push({ k, n: s.n, org: orgDe(k), f: s.f, ult, estado: resp ? "alerta" : dias > limite ? "alerta" : "ok",
      motivo: resp ? resp : dias > limite ? `sin datos nuevos hace ${dias} días` : "" });
  }
  const problemas = items.filter(i => i.estado !== "ok").length + Object.keys(D.fallas || {}).filter(k => !D.series[k]).length;
  // rojo si se perdió un día hábil entero de actualizaciones (el archivo no se reescribe si nada cambió)
  const genDia = Date.UTC(new Date(gen).getUTCFullYear(), new Date(gen).getUTCMonth(), new Date(gen).getUTCDate());
  const habiles = diasHabiles(genDia, hoy), horaUTC = new Date().getUTCHours();
  const atrasado = habiles >= 2 || (habiles === 1 && horaUTC >= 22 && new Date().getUTCDay() % 6 !== 0);
  const estado = atrasado ? "error" : problemas ? "alerta" : "ok";
  const texto = estado === "error" ? `Sin actualizar hace ${Math.round(horas)} h` : estado === "alerta" ? `${problemas} serie${problemas > 1 ? "s" : ""} para revisar` : "Datos al día";
  return { estado, texto, items, horas };
}
