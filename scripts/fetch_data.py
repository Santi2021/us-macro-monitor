"""US Macro Monitor: baja FRED, BEA y BLS, valida y escribe docs/data.json.

Lo corre GitHub Actions de lunes a viernes (.github/workflows/update.yml).
Keys como secretos del repo: FRED_API_KEY (obligatoria), BEA_API_KEY, BLS_API_KEY.
Correrlo local: FRED_API_KEY=... BEA_API_KEY=... python scripts/fetch_data.py

Pasos de cada corrida:
  1. bajar      FRED (series y curva diaria), BLS, BEA y el calendario oficial de FRED
  2. validar    cada serie contra su versión anterior (reglas en `validar`)
  3. combinar   lo que falló o no pasó la validación se reemplaza por la última versión buena (respaldo)
  4. escribir   data.json con el registro de la corrida, lo detectado como nuevo y las primeras publicaciones

Además escribe, para el workflow:
  - $ALERTA_ARCHIVO (si está definida): resumen en markdown cuando hay que avisar (dos corridas seguidas con problemas)
"""
import os, sys, json, time, math, datetime as dt
import requests, pandas as pd

DESDE = 1947              # historia completa: cada serie desde su inicio (la mayoría 1947-1960)
CORTE_WEB = "1998-01-01"  # data.json lleva desde acá; historia.json lleva todo y se carga sólo para períodos largos
DESDE_BEA = 1999
HOY = dt.date.today()
AHORA = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "data.json")
HISTORIA = os.path.join(os.path.dirname(SALIDA), "historia.json")
PAUSA_FRED = 0.55          # FRED admite ~120 consultas por minuto
MAX_CORRIDAS = 30


def key(nombres, etiqueta, obligatoria=False):
    for n in nombres:
        if os.environ.get(n):
            return os.environ[n].strip()
    if obligatoria:
        sys.exit(f"Falta la key de {etiqueta} (secreto {nombres[0]} del repo).")
    print(f"[info] Sin key de {etiqueta}.")
    return ""


# -----------------------------------------------------------------------------
# Catálogo FRED: clave -> (id, nombre, unidad, frecuencia, organismo que produce el dato)
#   Frecuencia M: diarias y semanales se promedian a mensual. W: semanal tal cual.
# -----------------------------------------------------------------------------
FRED = {
    # Actividad
    "gdp_real":        ("GDPC1", "PBI real", "US$ miles de M de 2017", "Q", "BEA"),
    "gdp_growth":      ("A191RL1Q225SBEA", "PBI real, % t/t anualizado", "%", "Q", "BEA"),
    "gdi_real":        ("A261RX1Q020SBEA", "GDI real", "US$ miles de M de 2017", "Q", "BEA"),
    "gdp_nom":         ("GDP", "PBI nominal", "US$ miles de M", "Q", "BEA"),
    "gdp_defl":        ("GDPDEF", "Deflactor del PBI", "índice", "Q", "BEA"),
    "final_sales_priv":("LB0000031Q020SBEA", "Ventas finales reales a compradores privados domésticos", "US$ miles de M de 2017", "Q", "BEA"),
    "c_consumo":       ("DPCERY2Q224SBEA", "Contribución: consumo", "pp", "Q", "BEA"),
    "c_inversion":     ("A006RY2Q224SBEA", "Contribución: inversión", "pp", "Q", "BEA"),
    "c_gobierno":      ("A822RY2Q224SBEA", "Contribución: gobierno", "pp", "Q", "BEA"),
    "c_externo":       ("A019RY2Q224SBEA", "Contribución: exportaciones netas", "pp", "Q", "BEA"),
    "profits":         ("A053RC1Q027SBEA", "Ganancias corporativas", "US$ miles de M", "Q", "BEA"),
    "inv_info":        ("A679RC1Q027SBEA", "Inversión en equipos de información", "US$ miles de M", "Q", "BEA"),
    "inv_software":    ("B985RC1Q027SBEA", "Inversión en software", "US$ miles de M", "Q", "BEA"),
    "indpro":          ("INDPRO", "Producción industrial", "índice 2017=100", "M", "Fed"),
    "retail":          ("RSAFS", "Ventas minoristas", "US$ millones", "M", "Census"),
    "core_orders":     ("NEWORDER", "Órdenes de bienes de capital sin defensa ni aviones", "US$ millones", "M", "Census"),
    "housing_starts":  ("HOUST", "Inicios de viviendas", "miles, tasa anual", "M", "Census"),
    "permits":         ("PERMIT", "Permisos de construcción", "miles, tasa anual", "M", "Census"),
    "gdp_pot":         ("GDPPOT", "PBI potencial (CBO)", "US$ miles de M de 2017", "Q", "CBO"),
    "tcu":             ("TCU", "Utilización de la capacidad instalada", "%", "M", "Fed"),
    "productivity":    ("OPHNFB", "Productividad laboral, empresas no agrícolas", "índice 2017=100", "Q", "BLS"),
    "ulc":             ("ULCNFB", "Costo laboral unitario, empresas no agrícolas", "índice 2017=100", "Q", "BLS"),
    "philly":          ("GACDFSA066MSFRBPHI", "Encuesta manufacturera de la Fed de Filadelfia: actividad general", "índice de difusión", "M", "Fed de Filadelfia"),
    "empire":          ("GACDISA066MSFRBNY", "Encuesta Empire State de la Fed de Nueva York: condiciones generales", "índice de difusión", "M", "Fed de Nueva York"),
    "gdpnow":          ("GDPNOW", "GDPNow: estimación en tiempo real del PBI del trimestre", "%", "Q", "Fed de Atlanta"),
    # Consumidor
    "dpi_real":        ("DSPIC96", "Ingreso disponible real", "US$ miles de M de 2017", "M", "BEA"),
    "dpi_nom":         ("DSPI", "Ingreso disponible nominal", "US$ miles de M", "M", "BEA"),
    "pce_real":        ("PCEC96", "Consumo real", "US$ miles de M de 2017", "M", "BEA"),
    "saving_rate":     ("PSAVERT", "Tasa de ahorro", "%", "M", "BEA"),
    "pce_dur":         ("PCEDGC96", "Consumo real: durables", "US$ miles de M de 2017", "M", "BEA"),
    "pce_ndur":        ("PCENDC96", "Consumo real: no durables", "US$ miles de M de 2017", "M", "BEA"),
    "pce_serv":        ("PCESC96", "Consumo real: servicios", "US$ miles de M de 2017", "M", "BEA"),
    "comp":            ("W209RC1", "Remuneración a asalariados", "US$ miles de M", "M", "BEA"),
    "transfers":       ("PCTR", "Transferencias del gobierno", "US$ miles de M", "M", "BEA"),
    "sentiment":       ("UMCSENT", "Confianza del consumidor", "índice", "M", "U. de Michigan"),
    "consumer_credit": ("TOTALSL", "Crédito al consumo", "US$ millones", "M", "Fed"),
    "delinq_cards":    ("DRCCLACBS", "Morosidad de tarjetas de crédito (bancos)", "%", "Q", "Fed"),
    "delinq_consumer": ("DRCLACBS", "Morosidad de préstamos al consumo (bancos)", "%", "Q", "Fed"),
    "autos":           ("TOTALSA", "Ventas de vehículos", "millones, tasa anual", "M", "BEA"),
    "debt_service":    ("TDSP", "Servicio de la deuda de los hogares / ingreso disponible", "%", "Q", "Fed"),
    "net_worth":       ("TNWBSHNO", "Patrimonio neto de los hogares", "US$ millones", "Q", "Fed"),
    # Precios
    "pce_p":           ("PCEPI", "PCE general", "índice", "M", "BEA"),
    "pce_core":        ("PCEPILFE", "PCE core", "índice", "M", "BEA"),
    "pce_energy":      ("DNRGRG3M086SBEA", "PCE energía", "índice", "M", "BEA"),
    "pce_food":        ("DFXARG3M086SBEA", "PCE alimentos", "índice", "M", "BEA"),
    "pce_goods":       ("DGDSRG3M086SBEA", "PCE bienes", "índice", "M", "BEA"),
    "pce_services":    ("DSERRG3M086SBEA", "PCE servicios", "índice", "M", "BEA"),
    "pce_supercore":   ("IA001260M", "PCE servicios sin energía ni vivienda", "índice", "M", "BEA"),
    "ppi_capital":     ("WPSFD41312", "PPI bienes de capital", "índice", "M", "BLS"),
    "ppi_fd":          ("PPIFIS", "PPI demanda final", "índice", "M", "BLS"),
    "ppi_core":        ("PPICOR", "PPI demanda final sin alimentos ni energía (sin desestacionalizar)", "índice", "M", "BLS"),
    "cpi_median":      ("MEDCPIM094SFRBCLE", "CPI mediana", "índice", "M", "Fed de Cleveland"),
    "pce_trim":        ("PCETRIM12M159SFRBDAL", "PCE media recortada, interanual", "%", "M", "Fed de Dallas"),
    "import_prices":   ("IR", "Precios de importación (sin desestacionalizar)", "índice 2000=100", "M", "BLS"),
    "export_prices":   ("IQ", "Precios de exportación (sin desestacionalizar)", "índice 2000=100", "M", "BLS"),
    "infl_exp_1y":     ("MICH", "Inflación esperada a 1 año (encuesta)", "%", "M", "U. de Michigan"),
    "infl_exp_5y5y":   ("T5YIFR", "Inflación esperada 5 años dentro de 5 (mercado)", "%", "M", "Fed de St. Louis"),
    # Empleo (sólo FRED)
    "claims":          ("ICSA", "Pedidos iniciales de desempleo", "personas", "W", "Dpto. de Trabajo"),
    "cont_claims":     ("CCSA", "Pedidos continuos de desempleo", "personas", "W", "Dpto. de Trabajo"),
    "sahm":            ("SAHMREALTIME", "Indicador de Sahm en tiempo real", "pp", "M", "Fed de St. Louis"),
    "unemployed":      ("UNEMPLOY", "Desocupados", "miles", "M", "BLS"),
    "eci":             ("ECIWAG", "Índice de costo laboral: salarios, sector privado", "índice", "Q", "BLS"),
    # Tasas y mercados (promedio mensual)
    "fed_funds":       ("DFF", "Tasa de fondos federales", "%", "M", "Fed"),
    "fed_obj":         ("DFEDTAR", "Tasa objetivo de la Fed (hasta dic-2008)", "%", "M", "Fed"),
    "fed_obj_sup":     ("DFEDTARU", "Tasa objetivo de la Fed, límite superior (desde dic-2008)", "%", "M", "Fed"),
    "ust2":            ("DGS2", "Treasury 2 años", "%", "M", "Tesoro"),
    "ust10":           ("DGS10", "Treasury 10 años", "%", "M", "Tesoro"),
    "ust30":           ("DGS30", "Treasury 30 años", "%", "M", "Tesoro"),
    "tips10":          ("DFII10", "TIPS 10 años (tasa real)", "%", "M", "Tesoro"),
    "breakeven10":     ("T10YIE", "Breakeven 10 años", "%", "M", "Fed de St. Louis"),
    "term_premium":    ("THREEFYTP10", "Prima por plazo 10 años (Kim-Wright)", "%", "M", "Fed"),
    "spread_10y3m":    ("T10Y3M", "Treasury 10 años menos letra 3 meses", "%", "M", "Fed de St. Louis"),
    "mortgage30":      ("MORTGAGE30US", "Tasa hipotecaria 30 años", "%", "M", "Freddie Mac"),
    "dollar":          ("DTWEXBGS", "Dólar multilateral", "índice", "M", "Fed"),
    "nfci":            ("NFCI", "Índice de condiciones financieras (NFCI)", "índice", "M", "Fed de Chicago"),
    "nfci_credit":     ("NFCICREDIT", "NFCI: subíndice de crédito", "índice", "M", "Fed de Chicago"),
    "baa_spread":      ("BAA10Y", "Spread corporativo Baa − Treasury 10 años", "%", "M", "Moody's"),
    "hy_oas":          ("BAMLH0A0HYM2", "Spread high yield (ICE BofA, sólo últimos 3 años en FRED)", "%", "M", "ICE BofA"),
    "hy_bb":           ("BAMLH0A1HYBB", "Spread high yield BB (ICE BofA, sólo últimos 3 años en FRED)", "%", "M", "ICE BofA"),
    "hy_ccc":          ("BAMLH0A3HYC", "Spread high yield CCC y menor (ICE BofA, sólo últimos 3 años en FRED)", "%", "M", "ICE BofA"),
    "fed_assets":      ("WALCL", "Activos totales de la Fed", "US$ millones", "M", "Fed"),
    "reserves":        ("WRESBAL", "Reservas de los bancos en la Fed", "US$ millones", "M", "Fed"),
    # Externo
    "trade_balance":   ("BOPGSTB", "Balanza comercial de bienes y servicios", "US$ millones", "M", "BEA y Census"),
    "exports":         ("BOPTEXP", "Exportaciones de bienes y servicios", "US$ millones", "M", "BEA y Census"),
    "imports":         ("BOPTIMP", "Importaciones de bienes y servicios", "US$ millones", "M", "BEA y Census"),
    "current_account": ("IEABC", "Cuenta corriente", "US$ millones por trimestre", "Q", "BEA"),
    "imp_capital":     ("A650RC1Q027SBEA", "Importaciones de bienes de capital (sin autos)", "US$ miles de M", "Q", "BEA"),
    # Fiscal
    "deficit":         ("MTSDS133FMS", "Resultado fiscal federal mensual", "US$ millones", "M", "Tesoro"),
    "interest_fed":    ("A091RC1Q027SBEA", "Intereses pagados por el gobierno federal", "US$ miles de M", "Q", "BEA"),
    "debt_gdp":        ("GFDEGDQ188S", "Deuda pública federal total / PBI", "%", "Q", "Tesoro y Fed de St. Louis"),
    "debt_public":     ("FYGFGDQ188S", "Deuda federal en manos del público / PBI", "%", "Q", "Tesoro y Fed de St. Louis"),
    "fed_receipts":    ("FGRECPT", "Ingresos corrientes del gobierno federal", "US$ miles de M, tasa anual", "Q", "BEA"),
    "fed_expend":      ("FGEXPND", "Gastos corrientes del gobierno federal", "US$ miles de M, tasa anual", "Q", "BEA"),
    "customs":         ("B235RC1Q027SBEA", "Recaudación por aranceles", "US$ miles de M, tasa anual", "Q", "BEA"),
    "imp_goods":       ("A255RC1Q027SBEA", "Importaciones de bienes (cuentas nacionales)", "US$ miles de M, tasa anual", "Q", "BEA"),
    # Proyecciones de la Fed (mediana del SEP): un dato por año proyectado; el de largo plazo, uno por reunión
    "sep_ff":          ("FEDTARMD", "Proyección de la Fed: tasa de fondos federales a fin de año (mediana)", "%", "A", "Fed"),
    "sep_core":        ("JCXFEMD", "Proyección de la Fed: core PCE, cuarto trimestre (mediana)", "%", "A", "Fed"),
    "sep_unemp":       ("UNRATEMD", "Proyección de la Fed: desempleo, cuarto trimestre (mediana)", "%", "A", "Fed"),
    "sep_gdp":         ("GDPC1MD", "Proyección de la Fed: crecimiento del PBI, cuarto trimestre contra cuarto trimestre (mediana)", "%", "A", "Fed"),
    "sep_lr":          ("FEDTARMDLR", "Proyección de la Fed: tasa de largo plazo (mediana)", "%", "Q", "Fed"),
    # Ciclo
    "usrec":           ("USREC", "Recesión según el NBER (1 = sí)", "0/1", "M", "NBER"),
}
# Series cuyo promedio mensual no tiene sentido (flujos ya mensuales)
SIN_PROMEDIO = {"deficit"}
# Series de mercado: cambian todos los días, no cuentan como "novedad" de un release
ALTA_FRECUENCIA = {"fed_obj", "fed_obj_sup", "fed_funds", "ust2", "ust10", "ust30", "tips10", "breakeven10", "term_premium",
                   "mortgage30", "dollar", "infl_exp_5y5y", "spread_10y3m", "gdpnow", "nfci", "nfci_credit",
                   "baa_spread", "hy_oas", "hy_bb", "hy_ccc", "fed_assets", "reserves"}
# Versión diaria (o semanal, tal como la publica la fuente) de las series de mercado, en docs/diarios.json.
# La web la usa cuando el período elegido es corto; para períodos largos usa el promedio mensual.
DIARIAS = ["fed_obj", "fed_obj_sup", "fed_funds", "ust2", "ust10", "ust30", "tips10", "breakeven10", "spread_10y3m", "term_premium", "infl_exp_5y5y",
           "baa_spread", "hy_oas", "hy_bb", "hy_ccc", "dollar", "mortgage30", "nfci", "nfci_credit", "fed_assets", "reserves"]
DESDE_DIARIO = "2000-01-01"
# Series escalonadas (la tasa objetivo): se guardan sólo los días en que cambian, desde 1982
ESCALONES = {"fed_obj", "fed_obj_sup"}
DIARIOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "diarios.json")
# Series con pocos datos que cambian de forma por diseño (proyecciones): no se les aplica la regla de historia acortada
SIN_REGLA_HISTORIA = {"sep_ff", "sep_core", "sep_unemp", "sep_gdp", "hy_oas", "hy_bb", "hy_ccc"}
# Series que traen proyecciones a futuro (el PBI potencial de la CBO llega a 10 años): se cortan en hoy
HASTA_HOY = {"gdp_pot"}
# Series cuya primera publicación se guarda para mostrar revisiones
CLAVES_REVISION = {"payrolls", "gdp_growth", "retail", "pce_core", "pce_p", "cpi_core", "cpi", "openings",
                   "indpro", "housing_starts", "core_orders", "dpi_real", "pce_real", "trade_balance", "ahe", "ppi_fd"}

CURVA = [("1M", "DGS1MO"), ("3M", "DGS3MO"), ("6M", "DGS6MO"), ("1A", "DGS1"), ("2A", "DGS2"), ("3A", "DGS3"),
         ("5A", "DGS5"), ("7A", "DGS7"), ("10A", "DGS10"), ("20A", "DGS20"), ("30A", "DGS30")]

# BLS: clave -> (id BLS, id equivalente en FRED, nombre, unidad)
BLS = {
    "payrolls":     ("CES0000000001", "PAYEMS", "Nóminas no agrícolas", "miles de puestos"),
    "unemployment": ("LNS14000000", "UNRATE", "Tasa de desempleo", "%"),
    "ahe":          ("CES0500000003", "CES0500000003", "Salario horario promedio (privado)", "US$"),
    "epop_prime":   ("LNS12300060", "LNS12300060", "Tasa de empleo 25-54 años", "%"),
    "participation":("LNS11300000", "CIVPART", "Tasa de participación", "%"),
    "openings":     ("JTS000000000000000JOL", "JTSJOL", "Vacantes (JOLTS)", "miles"),
    "quits":        ("JTS000000000000000QUR", "JTSQUR", "Tasa de renuncias (JOLTS)", "%"),
    "cpi":          ("CUSR0000SA0", "CPIAUCSL", "CPI general", "índice"),
    "cpi_core":     ("CUSR0000SA0L1E", "CPILFESL", "CPI core", "índice"),
    "cpi_shelter":  ("CUSR0000SAH1", "CUSR0000SAH1", "CPI vivienda", "índice"),
    "cpi_core_goods": ("CUSR0000SACL1E", "CUSR0000SACL1E", "CPI bienes sin alimentos ni energía", "índice"),
    "u6":           ("LNS13327709", "U6RATE", "Desempleo ampliado (U-6)", "%"),
    "hires":        ("JTS000000000000000HIR", "JTSHIR", "Tasa de contrataciones (JOLTS)", "%"),
    "layoffs":      ("JTS000000000000000LDR", "JTSLDR", "Tasa de despidos (JOLTS)", "%"),
    "payrolls_priv":   ("CES0500000001", "USPRIV", "Empleo privado", "miles de puestos"),
    "payrolls_gov":    ("CES9000000001", "USGOVT", "Empleo público", "miles de puestos"),
    "payrolls_health": ("CES6562000001", "CES6562000001", "Empleo en salud y asistencia social", "miles de puestos"),
}

# BEA: rubros del PCE core, tabla NIPA 2.8.4 (mensual)
BEA_CAT = {
    "Autos y repuestos":         "Motor vehicles and parts",
    "Muebles y equipamiento":    "Furnishings and durable household equipment",
    "Recreación (bienes)":       "Recreational goods and vehicles",
    "Otros durables":            "Other durable goods",
    "Indumentaria y calzado":    "Clothing and footwear",
    "Otros no durables":         "Other nondurable goods",
    "Vivienda y serv. públicos": "Housing and utilities",
    "Salud":                     "Health care",
    "Transporte (servicios)":    "Transportation services",
    "Recreación (servicios)":    "Recreation services",
    "Restaurantes y hoteles":    "Food services and accommodations",
    "Servicios financieros":     "Financial services and insurance",
    "Otros servicios":           "Other services",
}


# -----------------------------------------------------------------------------
# 1. Bajar
# -----------------------------------------------------------------------------
def get(url, **params):
    """GET con reintentos. Respeta el ritmo de FRED y la pausa que pide BEA al bloquear."""
    for intento in range(4):
        try:
            if "stlouisfed.org" in url:
                time.sleep(PAUSA_FRED)
            r = requests.get(url, params=params, timeout=60)
            if r.status_code == 429:
                espera = int(r.headers.get("Retry-After", 0) or 0) or 20 * (intento + 1)
                print(f"  [espera] {url.split('/')[2]} pidió pausa de {espera}s")
                time.sleep(min(espera, 90)); continue
            if r.status_code >= 500:
                raise requests.HTTPError(f"{r.status_code}")
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError):
            if intento == 3:
                raise
            time.sleep(4 * (intento + 1))


def fred(key_, sid, freq, promedio=True, desde=None):
    p = dict(series_id=sid, api_key=key_, file_type="json", observation_start=desde or f"{DESDE}-01-01")
    if freq == "M" and promedio:
        p.update(frequency="m", aggregation_method="avg")
    obs = get("https://api.stlouisfed.org/fred/series/observations", **p)["observations"]
    return pd.Series({pd.Timestamp(o["date"]): float(o["value"])
                      for o in obs if o["value"] not in (".", "")}, dtype=float).sort_index()


def fred_release(key_, sid):
    """Release (id, nombre) de FRED al que pertenece una serie, para armar el calendario."""
    try:
        r = get("https://api.stlouisfed.org/fred/series/release", series_id=sid, api_key=key_, file_type="json").get("releases", [])
        return (r[0]["id"], r[0]["name"]) if r else None
    except Exception:
        return None


def primera_nominas(key_):
    """Cambio mensual de las nóminas tal como se publicó por primera vez (ALFRED: todas las versiones de PAYEMS).

    Para cada mes se toma la primera versión publicada de su nivel y el nivel del mes anterior vigente ese mismo día."""
    obs = get("https://api.stlouisfed.org/fred/series/observations", series_id="PAYEMS", api_key=key_, file_type="json",
              observation_start="2014-12-01", realtime_start="2014-12-01", realtime_end="9999-12-31")["observations"]
    vers = {}
    for o in obs:
        if o["value"] in (".", ""):
            continue
        vers.setdefault(o["date"], []).append((o["realtime_start"], o["realtime_end"], float(o["value"])))
    fechas = sorted(vers)
    out = {}
    for ant, f in zip(fechas, fechas[1:]):
        v0, _, nivel = min(vers[f])
        previo = next((v for rs, re_, v in vers[ant] if rs <= v0 <= re_), None)
        if previo is not None:
            out[pd.Timestamp(f)] = nivel - previo
    if len(out) < 24:
        raise RuntimeError(f"pocas primeras estimaciones ({len(out)})")
    return pd.Series(out, dtype=float).sort_index()


def primera_pbi(key_):
    """Crecimiento trimestral anualizado del PBI real tal como se publicó por primera vez (ALFRED, output_type=4)."""
    obs = get("https://api.stlouisfed.org/fred/series/observations", series_id="A191RL1Q225SBEA", api_key=key_, file_type="json",
              observation_start="2010-01-01", realtime_start="1776-07-04", realtime_end="9999-12-31", output_type=4)["observations"]
    s = pd.Series({pd.Timestamp(o["date"]): float(o["value"]) for o in obs if o["value"] not in (".", "")}, dtype=float).sort_index()
    if len(s) < 24:
        raise RuntimeError(f"pocas primeras estimaciones ({len(s)})")
    return s


def bls(key_, ids):
    out = {i: {} for i in ids}
    ventanas = [(a, min(a + 19, HOY.year)) for a in range(DESDE, HOY.year + 1, 20)]
    for a0, a1 in ventanas:
        body = {"seriesid": ids, "startyear": str(a0), "endyear": str(a1), "registrationkey": key_}
        r = requests.post("https://api.bls.gov/publicAPI/v2/timeseries/data/", json=body, timeout=90)
        r.raise_for_status()
        j = r.json()
        if j.get("status") != "REQUEST_SUCCEEDED":
            raise RuntimeError("; ".join(j.get("message", [])) or j.get("status"))
        for s in j["Results"]["series"]:
            for o in s["data"]:
                if not o["period"].startswith("M") or o["period"] == "M13":
                    continue
                try:
                    v = float(o["value"])
                except ValueError:
                    continue
                out[s["seriesID"]][pd.Timestamp(f"{o['year']}-{o['period'][1:]}-01")] = v
        time.sleep(0.5)
    return {i: pd.Series(d, dtype=float).sort_index() for i, d in out.items() if d}


def bea_t20804(key_):
    anios = ",".join(str(a) for a in range(DESDE_BEA, HOY.year + 1))
    j = get("https://apps.bea.gov/api/data", UserID=key_, method="GetData", datasetname="NIPA",
            TableName="T20804", Frequency="M", Year=anios, ResultFormat="JSON")
    res = j["BEAAPI"]["Results"]
    res = res[0] if isinstance(res, list) else res
    if "Error" in res:
        raise RuntimeError(res["Error"])
    df = pd.DataFrame(res["Data"])
    df["fecha"] = pd.to_datetime(df["TimePeriod"].str.replace("M", "-"), format="%Y-%m")
    df["valor"] = pd.to_numeric(df["DataValue"].str.replace(",", ""), errors="coerce")
    df["linea"] = df["LineDescription"].str.strip()
    df["LineNumber"] = pd.to_numeric(df["LineNumber"])
    primera = df.groupby("linea")["LineNumber"].min()
    df = df[df["LineNumber"] == df["linea"].map(primera)]
    ancho = df.pivot_table(index="fecha", columns="linea", values="valor").sort_index()
    cols = {c.lower(): c for c in ancho.columns}
    out = {}
    for lab, eng in BEA_CAT.items():
        col = cols.get(eng.lower()) or next((cols[c] for c in cols if c.startswith(eng.lower())), None)
        if col is not None:
            out[lab] = ancho[col].dropna()
    if len(out) < len(BEA_CAT):
        faltan = sorted(set(BEA_CAT) - set(out))
        raise RuntimeError(f"rubros no encontrados en T20804: {faltan}")
    return out


def empaquetar(s, nombre, unidad, freq, fuente, codigo, org, grupo=None, release=None):
    s = s.dropna()
    return {"n": nombre, "u": unidad, "f": freq, "src": fuente, "id": codigo, "org": org, "g": grupo,
            "rel": release, "d": [[d.strftime("%Y-%m-%d"), round(float(v), 4)] for d, v in s.items()]}


def bajar(anterior):
    """Devuelve (data, releases, curva, calendario, fallas). Nunca corta por una falla individual."""
    fred_key = key(["FRED_API_KEY"], "FRED", obligatoria=True)
    bea_key = key(["BEA_API_KEY"], "BEA")
    bls_key = key(["BLS_API_KEY"], "BLS")
    data, releases, fallas = {}, {}, {}
    rel_previo = {k: v.get("rel") for k, v in anterior.get("series", {}).items()}

    print("FRED…")
    for k, (sid, nombre, unidad, freq, org) in FRED.items():
        try:
            rel = fred_release(fred_key, sid)
            s = fred(fred_key, sid, freq, k not in SIN_PROMEDIO)
            if k in HASTA_HOY:
                s = s[s.index <= pd.Timestamp(HOY)]
            rid = rel[0] if rel else rel_previo.get(k)
            data[k] = empaquetar(s, nombre, unidad, freq, "FRED", sid, org, release=rid)
            if rel:
                releases[rel[0]] = rel[1]
        except Exception as e:
            fallas[k] = f"no se pudo bajar ({str(e)[:80]})"; print(f"  [aviso] {k} ({sid}): {e}")

    print("Primeras estimaciones (ALFRED)…")
    for k, fn, nombre, unidad, freq, org, sid in [
            ("payrolls_1ra", primera_nominas, "Nóminas: cambio mensual en su primera publicación", "miles de puestos", "M", "BLS", "PAYEMS"),
            ("gdp_1ra", primera_pbi, "PBI real: crecimiento en su primera publicación", "%", "Q", "BEA", "A191RL1Q225SBEA")]:
        try:
            data[k] = empaquetar(fn(fred_key), nombre, unidad, freq, "ALFRED", sid, org)
        except Exception as e:
            fallas[k] = f"no se pudo bajar ({str(e)[:80]})"; print(f"  [aviso] {k}: {e}")

    print("BLS…")
    series_bls = {}
    if bls_key:
        try:
            series_bls = bls(bls_key, [v[0] for v in BLS.values()])
        except Exception as e:
            print(f"  [aviso] BLS: {e} → uso FRED")
    for k, (bid, fid, nombre, unidad) in BLS.items():
        rel = fred_release(fred_key, fid)
        if rel:
            releases[rel[0]] = rel[1]
        rid = rel[0] if rel else rel_previo.get(k)
        try:
            if bid in series_bls:
                data[k] = empaquetar(series_bls[bid], nombre, unidad, "M", "BLS", bid, "BLS", release=rid)
            else:
                data[k] = empaquetar(fred(fred_key, fid, "M"), nombre, unidad, "M", "FRED", fid, "BLS", release=rid)
        except Exception as e:
            fallas[k] = f"no se pudo bajar ({str(e)[:80]})"; print(f"  [aviso] {k}: {e}")

    print("BEA…")
    rel_pio = data.get("pce_core", {}).get("rel")
    if bea_key:
        try:
            for lab, s in bea_t20804(bea_key).items():
                data["cat:" + lab] = empaquetar(s, lab, "índice", "M", "BEA", "T20804", "BEA", "pce_rubros", rel_pio)
        except Exception as e:
            fallas["bea_rubros"] = f"no se pudo bajar la tabla 2.8.4 de BEA ({str(e)[:80]})"; print(f"  [aviso] BEA T20804: {e}")
    else:
        fallas["bea_rubros"] = "falta la key de BEA"

    print("Curva del Tesoro…")
    curva = {}
    for plazo, sid in CURVA:
        try:
            obs = get("https://api.stlouisfed.org/fred/series/observations", series_id=sid, api_key=fred_key,
                      file_type="json", observation_start=(HOY - dt.timedelta(days=400)).isoformat())["observations"]
            curva[plazo] = [[o["date"], float(o["value"])] for o in obs if o["value"] not in (".", "")]
        except Exception as e:
            print(f"  [aviso] curva {plazo} ({sid}): {e}")
    if len(curva) < len(CURVA):
        fallas["curva"] = f"faltan plazos de la curva: {sorted(set(p for p, _ in CURVA) - set(curva))}"

    print("Calendario…")
    calendario, fallidos = [], []
    nombres = dict(releases)
    for r in anterior.get("calendario", []):
        nombres.setdefault(r["rid"], r["nombre"])
    for rid, nombre in sorted(nombres.items()):
        try:
            j = get("https://api.stlouisfed.org/fred/release/dates", release_id=rid, api_key=fred_key, file_type="json",
                    realtime_start=(HOY - dt.timedelta(days=60)).isoformat(),
                    realtime_end=(HOY + dt.timedelta(days=100)).isoformat(),
                    include_release_dates_with_no_data="true", limit=200, sort_order="asc")
            fechas = sorted({r["date"] for r in j.get("release_dates", [])})
        except Exception as e:
            print(f"  [aviso] calendario {rid} {nombre}: {e}")
            fallidos.append(nombre)
            fechas = sorted({c["fecha"] for c in anterior.get("calendario", []) if c["rid"] == rid})
        series = sorted(k for k, v in data.items() if v.get("rel") == rid and not k.startswith("cat:"))
        if not series:
            continue
        for f in fechas:
            calendario.append({"fecha": f, "rid": rid, "nombre": nombre, "series": series})
    calendario.sort(key=lambda c: (c["fecha"], c["nombre"]))
    if fallidos:
        fallas["calendario"] = f"se usó el calendario anterior para: {', '.join(fallidos)}"
    return data, releases, curva, calendario, fallas


# -----------------------------------------------------------------------------
# 2. Validar
# -----------------------------------------------------------------------------
def validar(k, nueva, vieja):
    """Devuelve None si la serie nueva es aceptable, o el motivo del rechazo.

    Reglas (se comparan contra la última versión buena, así que las revisiones normales pasan):
      - vacía o con todos los valores iguales a cero
      - fechas en el futuro
      - la historia se acorta más de 10% o el inicio se corre más de un año
      - el último valor salta más de 8 desvíos de los cambios históricos Y queda fuera del rango
        histórico ampliado en la mitad de su amplitud (las dos condiciones a la vez). Si pasa en tres o más
        series a la vez se acepta: es un shock real, no un error (ver `combinar`)
    """
    d = nueva["d"]
    if not d:
        return "vino vacía"
    vals = [v for _, v in d]
    if all(v == 0 for v in vals):
        return "todos los valores son cero"
    limite = (HOY + dt.timedelta(days=7)).isoformat()
    if nueva["f"] in ("M", "Q") and d[-1][0] > HOY.isoformat() and k != "gdpnow" and not k.startswith("sep_"):
        return f"trae una fecha futura ({d[-1][0]})"
    if nueva["f"] == "W" and d[-1][0] > limite:
        return f"trae una fecha futura ({d[-1][0]})"
    if vieja and vieja.get("d") and k not in SIN_REGLA_HISTORIA:
        vd = vieja["d"]
        if len(d) < 0.9 * len(vd):
            return f"la historia se acortó de {len(vd)} a {len(d)} datos"
        if d[0][0] > vd[0][0] and (pd.Timestamp(d[0][0]) - pd.Timestamp(vd[0][0])).days > 370:
            return f"el inicio se corrió de {vd[0][0]} a {d[0][0]}"
    if len(vals) > 24 and k not in ("usrec",):
        cambios = [b - a for a, b in zip(vals[:-2], vals[1:-1])]
        media = sum(cambios) / len(cambios)
        desvio = math.sqrt(sum((c - media) ** 2 for c in cambios) / len(cambios)) or 1e-9
        salto = abs(vals[-1] - vals[-2] - media) / desvio
        lo, hi = min(vals[:-1]), max(vals[:-1])
        amplitud = (hi - lo) or abs(hi) or 1
        fuera = vals[-1] < lo - 0.5 * amplitud or vals[-1] > hi + 0.5 * amplitud
        if salto > 8 and fuera:
            return f"último valor fuera de rango ({vals[-1]:,.2f}; salto de {salto:.0f} desvíos)"
    return None


# -----------------------------------------------------------------------------
# 3. Combinar
# -----------------------------------------------------------------------------
def combinar(data, anterior, fallas):
    """Reemplaza lo que falló o no pasó la validación por la última versión buena. Devuelve (data, respaldo, extremos).

    Un valor extremo aislado se rechaza (lo típico es un error de la fuente o un cambio de unidad). Si tres o más
    series traen valores extremos en la misma corrida, se aceptan todos: es un shock real, como abril de 2020.
    """
    viejas = anterior.get("series", {})
    motivos = {k: validar(k, data[k], viejas.get(k)) for k in data}
    extremos = [k for k, m in motivos.items() if m and "fuera de rango" in m]
    if len(extremos) >= 3:
        print(f"  [shock] {len(extremos)} series con valores extremos a la vez: se aceptan ({', '.join(extremos)})")
        for k in extremos:
            motivos[k] = None
    else:
        extremos = []
    respaldo = {}
    for k, motivo in motivos.items():
        if not motivo:
            continue
        print(f"  [rechazo] {k}: {motivo}")
        if viejas.get(k):
            data[k] = viejas[k]; respaldo[k] = f"rechazada: {motivo}; se muestra la versión anterior"
        else:
            del data[k]; respaldo[k] = f"rechazada: {motivo}; sin versión anterior"
    esperadas = set(FRED) | set(BLS) | {k for k in viejas if k.startswith("cat:")}
    for k in sorted(esperadas - set(data)):
        if viejas.get(k):
            data[k] = viejas[k]
            respaldo.setdefault(k, (fallas.get(k) or fallas.get("bea_rubros") or "no se pudo bajar") + "; se muestra la versión anterior")
    return data, respaldo, extremos


# -----------------------------------------------------------------------------
# 4. Registro: lo detectado como nuevo, primeras publicaciones, corridas y avisos
# -----------------------------------------------------------------------------
def detectar(data, anterior, respaldo):
    """vistos[k] = {obs, val, det}: última observación y cuándo se detectó por primera vez (o cambió su valor).

    Es lo que usa la web para decir que un release está "Publicado": no la hora, sino que el dato entró.
    """
    vistos = dict(anterior.get("vistos", {}))
    nuevos, revisados = [], []
    viejas = anterior.get("series", {})
    for k, v in data.items():
        if not v["d"] or k in respaldo:
            continue
        obs, val = v["d"][-1]
        prev = vistos.get(k)
        if prev is None:
            # primera vez que corre con este registro: se toma lo que había en el archivo anterior como línea de base
            vd = viejas.get(k, {}).get("d")
            base = vd[-1] if vd else [obs, val]
            vistos[k] = {"obs": obs, "val": val, "det": anterior.get("generado", AHORA) if base == [obs, val] else AHORA}
            if base != [obs, val] and k not in ALTA_FRECUENCIA:
                nuevos.append(k)
            continue
        if obs != prev["obs"]:
            vistos[k] = {"obs": obs, "val": val, "det": AHORA}
            if k not in ALTA_FRECUENCIA:
                nuevos.append(k)
        elif abs(val - prev["val"]) > 1e-9 and k not in ALTA_FRECUENCIA:
            vistos[k] = {"obs": obs, "val": val, "det": AHORA}
            revisados.append(k)
        elif k not in ALTA_FRECUENCIA:
            # revisión = algún dato ya publicado cambió de valor (se compara fecha por fecha: sumar historia no cuenta)
            viejo = dict(tuple(p) for p in (viejas.get(k, {}).get("d") or [])[:-1])
            if any(f in viejo and abs(viejo[f] - x) > 1e-9 for f, x in v["d"]):
                revisados.append(k)
    return vistos, nuevos, revisados


def primeras_publicaciones(data, anterior, respaldo):
    """primeras[k][obs] = [valor de obs-2, obs-1, obs] tal como estaban cuando obs apareció por primera vez.

    Con eso se calcula la primera publicación de un cambio mensual (nóminas) y su revisión posterior.
    """
    prim = {k: dict(v) for k, v in anterior.get("primeras", {}).items()}
    for k in CLAVES_REVISION:
        v = data.get(k)
        if not v or len(v["d"]) < 3 or k in respaldo:
            continue
        reg = prim.setdefault(k, {})
        obs = v["d"][-1][0]
        if obs not in reg:
            reg[obs] = [x[1] for x in v["d"][-3:]]
        for o in sorted(reg)[:-8]:
            del reg[o]
    return prim


def avisos_nuevos(anterior, revisados, respaldo):
    avisos = [a for a in anterior.get("avisos", [])
              if (dt.datetime.now(dt.timezone.utc) - dt.datetime.strptime(a["det"], "%Y-%m-%dT%H:%MZ").replace(tzinfo=dt.timezone.utc)).days < 7]
    por_org = {}
    for k in revisados:
        if k.startswith("cat:"):
            continue
        por_org.setdefault(FRED.get(k, (None, None, None, None, "BLS"))[4], []).append(k)
    for org, ks in por_org.items():
        if len(ks) >= 5:
            avisos.append({"det": AHORA, "tipo": "revision",
                           "texto": f"{org} revisó la historia de {len(ks)} series en esta actualización; los gráficos ya la incorporan."})
    if len(respaldo) >= 5:
        avisos.append({"det": AHORA, "tipo": "respaldo",
                       "texto": f"{len(respaldo)} series se muestran con su versión anterior porque la fuente no respondió o envió datos inválidos."})
    return avisos[-10:]


def alerta(corridas):
    """Texto para el issue si las dos últimas corridas tuvieron problemas; vacío si no."""
    if len(corridas) < 2:
        return ""
    a, b = corridas[-2], corridas[-1]
    if (a["respaldo"] or a["fallas"]) and (b["respaldo"] or b["fallas"]):
        filas = [f"- **{k}**: {m}" for k, m in {**b["fallas"], **b["respaldo"]}.items()]
        return ("Las dos últimas actualizaciones tuvieron problemas. La web sigue mostrando la última versión buena "
                "de cada serie afectada.\n\n" + "\n".join(filas) +
                f"\n\nÚltima corrida: {b['ts']}. Este aviso se cierra solo cuando una actualización sale limpia.")
    return ""


# -----------------------------------------------------------------------------
def diarios(fred_key):
    """Baja las series de mercado sin promediar y escribe docs/diarios.json.

    Formato compacto: {k: {"t0": "AAAA-MM-DD", "d": [[días desde t0, valor], ...]}}. Si una serie falla, viene vacía o
    pierde más de 10% de su historia, se conserva la versión anterior de esa serie."""
    try:
        with open(DIARIOS, encoding="utf-8") as f:
            previo = json.load(f).get("series", {})
    except (FileNotFoundError, json.JSONDecodeError):
        previo = {}
    out, fallas = {}, []
    for k in DIARIAS:
        sid = FRED[k][0]
        try:
            s = fred(fred_key, sid, "D", promedio=False, desde="1982-01-01" if k in ESCALONES else DESDE_DIARIO)
            if k in ESCALONES:
                s = s[s.diff().fillna(1) != 0]
            if s.empty or s.index[-1].date() > HOY + dt.timedelta(days=7):
                raise ValueError("vacía o con fechas futuras")
            t0 = s.index[0]
            nueva = {"t0": t0.strftime("%Y-%m-%d"), "d": [[int((d - t0).days), round(float(v), 4)] for d, v in s.items()]}
            if k in previo and len(nueva["d"]) < 0.9 * len(previo[k]["d"]):
                raise ValueError(f"la historia se acortó de {len(previo[k]['d'])} a {len(nueva['d'])}")
            out[k] = nueva
        except Exception as e:
            fallas.append(k)
            print(f"  [aviso] diaria {k} ({sid}): {e}")
            if k in previo:
                out[k] = previo[k]
    with open(DIARIOS, "w", encoding="utf-8") as f:
        json.dump({"generado": AHORA, "series": out}, f, separators=(",", ":"))
    print(f"Diarias: {len(out)} series, {os.path.getsize(DIARIOS) / 1024:,.0f} KB" + (f" · con respaldo: {', '.join(fallas)}" if fallas else ""))


def main():
    anterior = {}
    try:
        with open(SALIDA, encoding="utf-8") as f:
            anterior = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # la historia completa de la corrida anterior es la base para validar y para el respaldo
    try:
        with open(HISTORIA, encoding="utf-8") as f:
            hist = json.load(f).get("series", {})
    except (FileNotFoundError, json.JSONDecodeError):
        hist = {}
    base = dict(anterior)
    base["series"] = {k: dict(v, d=hist.get(k) or v["d"]) for k, v in anterior.get("series", {}).items()}

    data, releases, curva, calendario, fallas = bajar(anterior)

    esperadas = len(FRED) + len(BLS)
    caidas = [k for k in fallas if k in FRED or k in BLS]
    if len(caidas) > esperadas / 2:
        sys.exit(f"Fallaron {len(caidas)} de {esperadas} series: problema general (key o red). No se actualiza.")

    data, respaldo, extremos = combinar(data, base, fallas)
    try:
        diarios(key(["FRED_API_KEY"], "FRED", obligatoria=True))
    except Exception as e:
        print(f"  [aviso] no se pudieron escribir las series diarias: {e}")
    completa = data
    data = {k: dict(v, d=[p for p in v["d"] if p[0] >= CORTE_WEB]) for k, v in completa.items()}
    if not curva or len(curva) < len(CURVA):
        curva = anterior.get("curva", curva)
    vistos, nuevos, revisados = detectar(data, anterior, respaldo)
    primeras = primeras_publicaciones(data, anterior, respaldo)

    # Novedades (compatibilidad con la web v3)
    novedades = list(anterior.get("novedades", []))
    novedades += [{"k": k, "obs": data[k]["d"][-1][0], "det": AHORA, "tipo": "nuevo"} for k in nuevos]
    novedades += [{"k": k, "obs": data[k]["d"][-1][0], "det": AHORA, "tipo": "revisión"} for k in revisados]
    novedades = novedades[-200:]

    # Evolución de GDPNow dentro de cada trimestre: se guarda cada estimación nueva (FRED sólo guarda la última)
    gdpnow_hist = list(anterior.get("gdpnow_hist", []))
    if data.get("gdpnow", {}).get("d") and "gdpnow" not in respaldo:
        trim, val = data["gdpnow"]["d"][-1]
        if not gdpnow_hist or gdpnow_hist[-1][1:] != [trim, val]:
            gdpnow_hist.append([AHORA[:10], trim, val])
    gdpnow_hist = gdpnow_hist[-400:]

    corrida = {"ts": AHORA, "nuevos": nuevos, "revisados": revisados, "fallas": fallas, "respaldo": respaldo}
    corridas = (anterior.get("corridas", []) + [corrida])[-MAX_CORRIDAS:]
    avisos = avisos_nuevos(anterior, revisados, respaldo)
    if extremos:
        avisos.append({"det": AHORA, "tipo": "shock", "texto": f"Movimientos extremos en {len(extremos)} series a la vez; se verificaron y se muestran."})

    texto_alerta = alerta(corridas)
    if os.environ.get("ALERTA_ARCHIVO"):
        with open(os.environ["ALERTA_ARCHIVO"], "w", encoding="utf-8") as f:
            f.write(texto_alerta)

    sin_cambios = (anterior.get("series") == json.loads(json.dumps(data)) and anterior.get("calendario") == calendario
                   and anterior.get("curva") == curva and anterior.get("respaldo", {}) == respaldo
                   and anterior.get("fallas", {}) == fallas and "vistos" in anterior and os.path.exists(HISTORIA))
    if sin_cambios:
        print("Sin datos nuevos.")
        return

    paquete = {"version": 4, "generado": AHORA, "faltan": sorted(set(fallas) | set(respaldo)), "fallas": fallas,
               "respaldo": respaldo, "series": data, "calendario": calendario, "curva": curva,
               "releases": {str(k): v for k, v in releases.items()} or anterior.get("releases", {}),
               "vistos": vistos, "primeras": primeras, "gdpnow_hist": gdpnow_hist, "novedades": novedades, "corridas": corridas, "avisos": avisos}
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(paquete, f, ensure_ascii=False, separators=(",", ":"))
    with open(HISTORIA, "w", encoding="utf-8") as f:
        json.dump({"generado": AHORA, "series": {k: v["d"] for k, v in completa.items()}}, f, ensure_ascii=False, separators=(",", ":"))

    n_cat = sum(1 for k in data if k.startswith("cat:"))
    print(f"Historia completa: {os.path.getsize(HISTORIA) / 1024:,.0f} KB")
    print(f"\nListo: {len(data)} series ({n_cat} rubros del core) · {len(calendario)} fechas de calendario · "
          f"{len(nuevos)} datos nuevos · {len(revisados)} revisados · {os.path.getsize(SALIDA) / 1024:,.0f} KB")
    print("Fallas:", fallas or "ninguna")
    print("Respaldo:", respaldo or "ninguno")


if __name__ == "__main__":
    main()
