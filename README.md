# US Macro Monitor

Monitor de la economía de EE.UU. con datos de **BEA, BLS y FRED**, que se actualiza solo.

- **Web:** `docs/index.html`, publicada con GitHub Pages.
- **Datos:** `docs/data.json`, generado por `scripts/fetch_data.py`.
- **Actualización:** `.github/workflows/update.yml` corre de lunes a viernes a las 13:10 y 21:10 UTC
  (después de los releases de las 8:30 de Nueva York). También se corre a mano desde
  *Actions → Actualizar datos → Run workflow*.

## Configuración (una sola vez)

1. *Settings → Secrets and variables → Actions → New repository secret*:
   `FRED_API_KEY` (obligatoria), `BEA_API_KEY` y `BLS_API_KEY`.
2. *Settings → Pages → Build and deployment*: Source **Deploy from a branch**,
   branch **main**, carpeta **/docs**.
3. *Actions → Actualizar datos → Run workflow* para la primera carga.

## Qué muestra

Resumen (indicadores clave con su percentil desde 2000 y una lectura automática del último dato),
Actividad, Consumidor, Precios (incluye mapa de calor de 13 rubros del core PCE), Empleo, Tasas y Externo.
Los títulos de cada gráfico se recalculan con cada actualización.
