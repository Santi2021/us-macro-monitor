// Prueba de la web antes de publicar datos nuevos: abre todas las vistas y falla si algo se rompe.
// Uso: CHROME=/ruta/a/chrome node scripts/smoke.mjs http://localhost:8123/
import puppeteer from "puppeteer-core";

const base = process.argv[2] || "http://localhost:8123/";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const problemas = [];
const espera = ms => new Promise(r => setTimeout(r, ms));

async function abrir(ruta, ancho = 1280) {
  const p = await browser.newPage();
  await p.setViewport({ width: ancho, height: 900 });
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if (m.type() === "error" && !/fonts\.g|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  p.on("requestfailed", r => { if (!/fonts\.g/.test(r.url())) errores.push("no cargó " + r.url()); });
  await p.goto(base + ruta, { waitUntil: "load", timeout: 60000 });
  await p.waitForFunction(() => window.__monitor && window.__monitor.listo, { timeout: 30000 });
  await espera(1200);
  // recorre la página para que se dibujen todos los gráficos
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
  await espera(600);
  const estado = await p.evaluate(() => ({ ...window.__monitor.vista, errores: window.__monitor.errores, modal: !!document.querySelector(".modal canvas"),
    lienzos: document.querySelectorAll("canvas").length, ancho: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  await p.close();
  return { estado, errores: errores.concat(estado.errores || []) };
}

const rutas = ["portada?periodo=todo", "portada", "mi", "tablero", "calendario", "actividad", "consumidor", "precios", "empleo", "tasas", "externo", "fiscal", "explorador", "metodologia", "metodologia/series", "metodologia/graficos", "metodologia/actualizaciones"];
const conGraficos = new Set(["portada", "mi", "actividad", "consumidor", "precios", "empleo", "tasas", "externo", "fiscal", "explorador"]);
for (const r of rutas) {
  const { estado, errores } = await abrir("#/" + r);
  const fallas = [...errores];
  if (conGraficos.has(r) && !(estado.graficos > 0)) fallas.push("no armó gráficos");
  // un gráfico sin datos no frena la publicación (el motor ya muestra la última versión buena y avisa), pero se informa
  if (estado.vacios > 0) console.log(`  aviso: ${estado.vacios} gráfico(s) sin datos en ${r}`);
  if (conGraficos.has(r) && estado.lienzos === 0) fallas.push("no dibujó ningún gráfico");
  if (estado.ancho > 2) fallas.push(`desborda horizontalmente ${estado.ancho}px`);
  console.log(`${fallas.length ? "✗" : "✓"} ${r}: ${estado.graficos ?? 0} gráficos, ${estado.lienzos} lienzos`);
  if (fallas.length) problemas.push(`${r}: ${fallas.join("; ")}`);
}
// enlace directo a un gráfico con opciones, y la portada en el celular
for (const [ruta, ancho, chequeo] of [["#/precios/cpi-vs-pce?vista=m", 1280, "modal"], ["#/portada", 400, null], ["#/calendario", 400, null]]) {
  const { estado, errores } = await abrir(ruta, ancho);
  const fallas = [...errores];
  if (chequeo === "modal" && !estado.modal) fallas.push("el enlace directo no abrió el gráfico");
  if (estado.ancho > 2) fallas.push(`desborda horizontalmente ${estado.ancho}px a ${ancho}px`);
  console.log(`${fallas.length ? "✗" : "✓"} ${ruta} (${ancho}px)`);
  if (fallas.length) problemas.push(`${ruta} (${ancho}px): ${fallas.join("; ")}`);
}
await browser.close();
if (problemas.length) {
  console.error("\nLa web no pasó la prueba:\n- " + problemas.join("\n- "));
  process.exit(1);
}
console.log("\nLa web pasó la prueba.");
