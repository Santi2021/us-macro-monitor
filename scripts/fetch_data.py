"""US Macro Monitor: baja FRED, BEA y BLS y escribe docs/data.json.

Lo corre GitHub Actions de lunes a viernes (.github/workflows/update.yml).
Keys como secretos del repo: FRED_API_KEY (obligatoria), BEA_API_KEY, BLS_API_KEY.
Correrlo local: FRED_API_KEY=... BEA_API_KEY=... python scripts/fetch_data.py

Además de las series, arma:
  - calendario: próximos releases de las series del monitor (fuente: calendario de FRED)
  - novedades:  qué serie sumó un dato nuevo y cuándo se detectó (comparando con el archivo anterior)
"""
import os, sys, json, time, datetime as dt
import requests, pandas as pd

DESDE = 2000
HOY = dt.date.today()
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "data.json")


def key(nombres, etiqueta, obligatoria=False):
    for n in nombres:
        if os.environ.get(n):
            return os.environ[n].strip()
    if obligatoria:
        sys.exit(f"Falta la key de {etiqueta} (secreto {nombres[0]} del repo).")
    print(f"[info] Sin key de {etiqueta}.")
    return ""


FRED_KEY = key(["FRED_API_KEY"], "FRED", obligatoria=True)
BEA_KEY = key(["BEA_API_KEY"], "BEA")
BLS_KEY = key(["BLS_API_KEY"], "BLS")

# -----------------------------------------------------------------------------
# Catálogo FRED: clave -> (id, nombre, unidad, frecuencia, organismo que produce el dato)
#   Frecuencia M: diarias y semanales se promedian a mensual; la deuda y el déficit mensual se usan tal cual.
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
    # Precios
    "pce_p":           ("PCEPI", "PCE general", "índice", "M", "BEA"),
    "pce_core":        ("PCEPILFE", "PCE core", "índice", "M", "BEA"),
    "pce_energy":      ("DNRGRG3M086SBEA", "PCE energía", "índice", "M", "BEA"),
    "pce_food":        ("DFXARG3M086SBEA", "PCE alimentos", "índice", "M", "BEA"),
    "pce_goods":       ("DGDSRG3M086SBEA", "PCE bienes", "índice", "M", "BEA"),
    "pce_services":    ("DSERRG3M086SBEA", "PCE servicios", "índice", "M", "BEA"),
    "pce_supercore":   ("IA001260M", "PCE servicios sin energía ni vivienda", "índice", "M", "BEA"),
    "infl_exp_1y":     ("MICH", "Inflación esperada a 1 año (encuesta)", "%", "M", "U. de Michigan"),
    "infl_exp_5y5y":   ("T5YIFR", "Inflación esperada 5 años dentro de 5 (mercado)", "%", "M", "Fed de St. Louis"),
    # Empleo (sólo FRED)
    "claims":          ("ICSA", "Pedidos iniciales de desempleo", "personas", "M", "Dpto. de Trabajo"),
    "cont_claims":     ("CCSA", "Pedidos continuos de desempleo", "personas", "M", "Dpto. de Trabajo"),
    "sahm":            ("SAHMREALTIME", "Indicador de Sahm en tiempo real", "pp", "M", "Fed de St. Louis"),
    "unemployed":      ("UNEMPLOY", "Desocupados", "miles", "M", "BLS"),
    # Tasas y mercados (promedio mensual)
    "fed_funds":       ("DFF", "Tasa de fondos federales", "%", "M", "Fed"),
    "ust2":            ("DGS2", "Treasury 2 años", "%", "M", "Tesoro"),
    "ust10":           ("DGS10", "Treasury 10 años", "%", "M", "Tesoro"),
    "ust30":           ("DGS30", "Treasury 30 años", "%", "M", "Tesoro"),
    "tips10":          ("DFII10", "TIPS 10 años (tasa real)", "%", "M", "Tesoro"),
    "breakeven10":     ("T10YIE", "Breakeven 10 años", "%", "M", "Fed de St. Louis"),
    "term_premium":    ("THREEFYTP10", "Prima por plazo 10 años (Kim-Wright)", "%", "M", "Fed"),
    "spread_10y3m":    ("T10Y3M", "Treasury 10 años menos letra 3 meses", "%", "M", "Fed de St. Louis"),
    "mortgage30":      ("MORTGAGE30US", "Tasa hipotecaria 30 años", "%", "M", "Freddie Mac"),
    "dollar":          ("DTWEXBGS", "Dólar amplio", "índice", "M", "Fed"),
    # Externo
    "trade_balance":   ("BOPGSTB", "Balanza comercial de bienes y servicios", "US$ millones", "M", "BEA y Census"),
    "imp_capital":     ("A650RC1Q027SBEA", "Importaciones de bienes de capital (sin autos)", "US$ miles de M", "Q", "BEA"),
    # Fiscal
    "deficit":         ("MTSDS133FMS", "Resultado fiscal federal mensual", "US$ millones", "M", "Tesoro"),
    "interest_fed":    ("A091RC1Q027SBEA", "Intereses pagados por el gobierno federal", "US$ miles de M", "Q", "BEA"),
    "debt_gdp":        ("GFDEGDQ188S", "Deuda pública federal / PBI", "%", "Q", "Tesoro y Fed de St. Louis"),
}
# Series cuyo promedio mensual no tiene sentido (flujos o niveles puntuales ya mensuales)
SIN_PROMEDIO = {"deficit"}
# Series de mercado o semanales: cambian todos los días, no cuentan como "novedad" de un release
ALTA_FRECUENCIA = {"fed_funds", "ust2", "ust10", "ust30", "tips10", "breakeven10", "term_premium",
                   "mortgage30", "dollar", "infl_exp_5y5y", "claims", "cont_claims", "spread_10y3m", "gdpnow"}

# Curva del Tesoro completa, diaria (últimos 13 meses), para comparar la forma de la curva en el tiempo
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
def get(url, **params):
    for intento in range(3):
        try:
            r = requests.get(url, params=params, timeout=60)
            if r.status_code == 429:
                time.sleep(5 * (intento + 1)); continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            if intento == 2:
                raise
            time.sleep(3)


def fred(sid, freq, promedio=True):
    p = dict(series_id=sid, api_key=FRED_KEY, file_type="json", observation_start=f"{DESDE - 1}-01-01")
    if freq == "M" and promedio:
        p.update(frequency="m", aggregation_method="avg")
    obs = get("https://api.stlouisfed.org/fred/series/observations", **p)["observations"]
    return pd.Series({pd.Timestamp(o["date"]): float(o["value"])
                      for o in obs if o["value"] not in (".", "")}).sort_index()


def fred_release(sid):
    """Release (id, nombre) de FRED al que pertenece una serie, para armar el calendario."""
    try:
        j = get("https://api.stlouisfed.org/fred/series/release", series_id=sid, api_key=FRED_KEY, file_type="json")
        r = j.get("releases", [])
        return (r[0]["id"], r[0]["name"]) if r else None
    except Exception:
        return None


def bls(ids):
    out = {i: {} for i in ids}
    ventanas = [(a, min(a + 19, HOY.year)) for a in range(DESDE - 1, HOY.year + 1, 20)]
    for a0, a1 in ventanas:
        body = {"seriesid": ids, "startyear": str(a0), "endyear": str(a1), "registrationkey": BLS_KEY}
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
    return {i: pd.Series(d).sort_index() for i, d in out.items() if d}


def bea_t20804():
    anios = ",".join(str(a) for a in range(DESDE - 1, HOY.year + 1))
    j = get("https://apps.bea.gov/api/data", UserID=BEA_KEY, method="GetData", datasetname="NIPA",
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
        if col is None:
            print(f"  [aviso] rubro no encontrado en T20804: {eng}")
            continue
        out[lab] = ancho[col].dropna()
    return out


def empaquetar(s, nombre, unidad, freq, fuente, codigo, org, grupo=None, release=None):
    s = s.dropna()
    return {"n": nombre, "u": unidad, "f": freq, "src": fuente, "id": codigo, "org": org, "g": grupo,
            "rel": release, "d": [[d.strftime("%Y-%m-%d"), round(float(v), 4)] for d, v in s.items()]}


# -----------------------------------------------------------------------------
data, faltan, releases = {}, [], {}

print("FRED…")
for k, (sid, nombre, unidad, freq, org) in FRED.items():
    try:
        rel = fred_release(sid)
        data[k] = empaquetar(fred(sid, freq, k not in SIN_PROMEDIO), nombre, unidad, freq, "FRED", sid, org,
                             release=rel[0] if rel else None)
        if rel:
            releases[rel[0]] = rel[1]
    except Exception as e:
        faltan.append(k); print(f"  [aviso] {k} ({sid}): {e}")

print("BLS…")
series_bls = {}
if BLS_KEY:
    try:
        series_bls = bls([v[0] for v in BLS.values()])
    except Exception as e:
        print(f"  [aviso] BLS: {e} → uso FRED")
for k, (bid, fid, nombre, unidad) in BLS.items():
    rel = fred_release(fid)
    if rel:
        releases[rel[0]] = rel[1]
    try:
        if bid in series_bls:
            data[k] = empaquetar(series_bls[bid], nombre, unidad, "M", "BLS", bid, "BLS", release=rel[0] if rel else None)
        else:
            data[k] = empaquetar(fred(fid, "M"), nombre, unidad, "M", "FRED", fid, "BLS", release=rel[0] if rel else None)
    except Exception as e:
        faltan.append(k); print(f"  [aviso] {k}: {e}")

print("BEA…")
if BEA_KEY:
    rel_pio = data.get("pce_core", {}).get("rel")
    try:
        for lab, s in bea_t20804().items():
            data["cat:" + lab] = empaquetar(s, lab, "índice", "M", "BEA", "T20804", "BEA", "pce_rubros", rel_pio)
    except Exception as e:
        print(f"  [aviso] BEA T20804: {e}")

print("Curva del Tesoro…")
curva = {}
for plazo, sid in CURVA:
    try:
        obs = get("https://api.stlouisfed.org/fred/series/observations", series_id=sid, api_key=FRED_KEY,
                  file_type="json", observation_start=(HOY - dt.timedelta(days=400)).isoformat())["observations"]
        curva[plazo] = [[o["date"], float(o["value"])] for o in obs if o["value"] not in (".", "")]
    except Exception as e:
        print(f"  [aviso] curva {plazo} ({sid}): {e}")

print("Calendario…")
# Fechas de publicación de cada release (pasadas recientes y próximas), consultadas release por release
calendario = []
for rid, nombre in sorted(releases.items()):
    try:
        j = get("https://api.stlouisfed.org/fred/release/dates", release_id=rid, api_key=FRED_KEY, file_type="json",
                realtime_start=(HOY - dt.timedelta(days=45)).isoformat(),
                realtime_end=(HOY + dt.timedelta(days=90)).isoformat(),
                include_release_dates_with_no_data="true", limit=200, sort_order="asc")
    except Exception as e:
        print(f"  [aviso] calendario {rid} {nombre}: {e}")
        continue
    series = sorted(k for k, v in data.items() if v.get("rel") == rid and not k.startswith("cat:"))
    for f in sorted({r["date"] for r in j.get("release_dates", [])}):
        calendario.append({"fecha": f, "rid": rid, "nombre": nombre, "series": series})
    time.sleep(0.15)
calendario.sort(key=lambda c: (c["fecha"], c["nombre"]))

# -----------------------------------------------------------------------------
if len(faltan) > (len(FRED) + len(BLS)) / 4:
    sys.exit(f"Demasiadas series fallaron ({len(faltan)}): {faltan}. No se actualiza.")

anterior = {}
try:
    with open(SALIDA, encoding="utf-8") as f:
        anterior = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass

# Novedades: series con una observación nueva (o revisada) respecto del archivo anterior
ahora = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
novedades = list(anterior.get("novedades", []))
viejas = anterior.get("series", {})
for k, v in data.items():
    if not v["d"] or k in ALTA_FRECUENCIA:
        continue
    ult = v["d"][-1]
    prev = viejas.get(k, {}).get("d")
    if not prev:
        continue  # primera vez que aparece: no es una novedad del dato
    if prev[-1][0] != ult[0]:
        novedades.append({"k": k, "obs": ult[0], "det": ahora, "tipo": "nuevo"})
    elif prev[:-1] != v["d"][:len(prev) - 1]:
        # cambió la historia (revisión); si sólo cambia el último punto es el promedio del mes en curso
        novedades.append({"k": k, "obs": ult[0], "det": ahora, "tipo": "revisión"})
novedades = novedades[-150:]

if (anterior.get("series") == json.loads(json.dumps(data)) and anterior.get("calendario") == calendario
        and anterior.get("curva") == curva and anterior.get("faltan") == faltan):
    print("Sin datos nuevos.")
    sys.exit(0)

paquete = {"generado": ahora, "faltan": faltan, "series": data, "calendario": calendario, "novedades": novedades, "curva": curva,
           "releases": {str(k): v for k, v in releases.items()}}
with open(SALIDA, "w", encoding="utf-8") as f:
    json.dump(paquete, f, ensure_ascii=False, separators=(",", ":"))

n_cat = sum(1 for k in data if k.startswith("cat:"))
tam = os.path.getsize(SALIDA) / 1024
print(f"\nListo: {len(data)} series ({n_cat} rubros del core) · {len(calendario)} releases en calendario · "
      f"{sum(1 for n in novedades if n['det'] == ahora)} novedades · {tam:,.0f} KB")
print("Faltan:", faltan or "ninguna")
