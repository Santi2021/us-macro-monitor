"""US Macro Monitor: baja FRED, BEA y BLS y escribe docs/data.json.

Lo corre GitHub Actions todos los días (.github/workflows/update.yml).
Keys como secretos del repo: FRED_API_KEY (obligatoria), BEA_API_KEY, BLS_API_KEY.
Para correrlo local: export FRED_API_KEY=... && python scripts/fetch_data.py
"""
import os, sys, json, time, datetime as dt
import requests, pandas as pd

DESDE = 2000


def key(nombres, etiqueta, obligatoria=False):
    for n in nombres:
        if os.environ.get(n):
            return os.environ[n].strip()
    if obligatoria:
        sys.exit(f"Falta la key de {etiqueta} (secreto {nombres[0]} del repo).")
    print(f"[info] Sin key de {etiqueta}.")
    return ""


FRED_KEY = key(["FRED_API_KEY", "FRED_KEY", "FRED"], "FRED", obligatoria=True)
BEA_KEY = key(["BEA_API_KEY", "BEA_KEY", "BEA"], "BEA")
BLS_KEY = key(["BLS_API_KEY", "BLS_KEY", "BLS"], "BLS")

# -----------------------------------------------------------------------------
# Catálogo: clave -> (fuente, id, nombre, unidad, frecuencia)
#   frecuencia: M mensual, Q trimestral. Diarias/semanales se promedian a mensual.
# -----------------------------------------------------------------------------
FRED = {
    # Actividad
    "gdp_real":        ("GDPC1", "PBI real", "US$ miles de M de 2017", "Q"),
    "gdp_growth":      ("A191RL1Q225SBEA", "PBI real, % t/t anualizado", "%", "Q"),
    "gdi_real":        ("A261RX1Q020SBEA", "GDI real", "US$ miles de M de 2017", "Q"),
    "gdp_nom":         ("GDP", "PBI nominal", "US$ miles de M", "Q"),
    "gdp_defl":        ("GDPDEF", "Deflactor del PBI", "índice", "Q"),
    "c_consumo":       ("DPCERY2Q224SBEA", "Contribución: consumo", "pp", "Q"),
    "c_inversion":     ("A006RY2Q224SBEA", "Contribución: inversión", "pp", "Q"),
    "c_gobierno":      ("A822RY2Q224SBEA", "Contribución: gobierno", "pp", "Q"),
    "c_externo":       ("A019RY2Q224SBEA", "Contribución: exportaciones netas", "pp", "Q"),
    "profits":         ("A053RC1Q027SBEA", "Ganancias corporativas", "US$ miles de M", "Q"),
    "inv_info":        ("A679RC1Q027SBEA", "Inversión en equipos de información", "US$ miles de M", "Q"),
    "inv_software":    ("B985RC1Q027SBEA", "Inversión en software", "US$ miles de M", "Q"),
    "indpro":          ("INDPRO", "Producción industrial", "índice 2017=100", "M"),
    "retail":          ("RSAFS", "Ventas minoristas", "US$ millones", "M"),
    # Consumidor
    "dpi_real":        ("DSPIC96", "Ingreso disponible real", "US$ miles de M de 2017", "M"),
    "dpi_nom":         ("DSPI", "Ingreso disponible nominal", "US$ miles de M", "M"),
    "pce_real":        ("PCEC96", "Consumo real", "US$ miles de M de 2017", "M"),
    "saving_rate":     ("PSAVERT", "Tasa de ahorro", "%", "M"),
    "pce_dur":         ("PCEDGC96", "Consumo real: durables", "US$ miles de M de 2017", "M"),
    "pce_ndur":        ("PCENDC96", "Consumo real: no durables", "US$ miles de M de 2017", "M"),
    "pce_serv":        ("PCESC96", "Consumo real: servicios", "US$ miles de M de 2017", "M"),
    "comp":            ("W209RC1", "Remuneración a asalariados", "US$ miles de M", "M"),
    "transfers":       ("PCTR", "Transferencias del gobierno", "US$ miles de M", "M"),
    "sentiment":       ("UMCSENT", "Confianza del consumidor (Michigan)", "índice", "M"),
    # Precios PCE
    "pce_p":           ("PCEPI", "PCE general", "índice", "M"),
    "pce_core":        ("PCEPILFE", "PCE core", "índice", "M"),
    "pce_energy":      ("DNRGRG3M086SBEA", "PCE energía", "índice", "M"),
    "pce_food":        ("DFXARG3M086SBEA", "PCE alimentos", "índice", "M"),
    "pce_goods":       ("DGDSRG3M086SBEA", "PCE bienes", "índice", "M"),
    "pce_services":    ("DSERRG3M086SBEA", "PCE servicios", "índice", "M"),
    "pce_supercore":   ("IA001260M", "PCE servicios sin energía ni vivienda", "índice", "M"),
    # Empleo (sólo FRED)
    "claims":          ("ICSA", "Pedidos iniciales de desempleo (prom. mensual)", "personas", "M"),
    # Tasas y mercados (promedio mensual)
    "fed_funds":       ("DFF", "Tasa de fondos federales", "%", "M"),
    "ust2":            ("DGS2", "Treasury 2 años", "%", "M"),
    "ust10":           ("DGS10", "Treasury 10 años", "%", "M"),
    "ust30":           ("DGS30", "Treasury 30 años", "%", "M"),
    "tips10":          ("DFII10", "TIPS 10 años (tasa real)", "%", "M"),
    "breakeven10":     ("T10YIE", "Breakeven 10 años", "%", "M"),
    "dollar":          ("DTWEXBGS", "Dólar amplio (Fed)", "índice", "M"),
    # Externo
    "trade_balance":   ("BOPGSTB", "Balanza comercial de bienes y servicios", "US$ millones", "M"),
    "imp_capital":     ("IEAMGCN", "Importaciones de bienes de capital", "US$ millones", "M"),
}

# Organismo que produce cada serie de FRED (para citar la fuente en la web)
ORG = {"indpro": "Fed", "retail": "Census", "sentiment": "U. de Michigan", "claims": "Dpto. de Trabajo",
       "fed_funds": "Fed", "ust2": "Tesoro", "ust10": "Tesoro", "ust30": "Tesoro", "tips10": "Tesoro",
       "breakeven10": "Fed de St. Louis", "dollar": "Fed", "imp_capital": "Census", "trade_balance": "BEA y Census"}

# BLS: clave -> (id BLS, id equivalente en FRED, nombre, unidad)
BLS = {
    "payrolls":     ("CES0000000001", "PAYEMS", "Nóminas no agrícolas", "miles de puestos"),
    "unemployment": ("LNS14000000", "UNRATE", "Tasa de desempleo", "%"),
    "ahe":          ("CES0500000003", "CES0500000003", "Salario horario promedio (privado)", "US$"),
    "epop_prime":   ("LNS12300060", "LNS12300060", "Tasa de empleo 25-54 años", "%"),
    "participation":("LNS11300000", "CIVPART", "Tasa de participación", "%"),
    "openings":     ("JTS000000000000000JOL", "JTSJOL", "Vacantes (JOLTS)", "miles"),
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
def fred(sid, freq):
    p = dict(series_id=sid, api_key=FRED_KEY, file_type="json",
             observation_start=f"{DESDE - 1}-01-01")
    if freq == "M":
        p.update(frequency="m", aggregation_method="avg")
    r = requests.get("https://api.stlouisfed.org/fred/series/observations", params=p, timeout=60)
    r.raise_for_status()
    obs = r.json()["observations"]
    return pd.Series({pd.Timestamp(o["date"]): float(o["value"])
                      for o in obs if o["value"] not in (".", "")}).sort_index()


def bls(ids):
    """Varias series BLS en una llamada por ventana de 20 años."""
    out = {i: {} for i in ids}
    hoy = dt.date.today().year
    ventanas = [(a, min(a + 19, hoy)) for a in range(DESDE - 1, hoy + 1, 20)]
    for a0, a1 in ventanas:
        body = {"seriesid": ids, "startyear": str(a0), "endyear": str(a1),
                "registrationkey": BLS_KEY}
        r = requests.post("https://api.bls.gov/publicAPI/v2/timeseries/data/",
                          json=body, timeout=90)
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
    anios = ",".join(str(a) for a in range(DESDE - 1, dt.date.today().year + 1))
    p = dict(UserID=BEA_KEY, method="GetData", datasetname="NIPA", TableName="T20804",
             Frequency="M", Year=anios, ResultFormat="JSON")
    r = requests.get("https://apps.bea.gov/api/data", params=p, timeout=120)
    r.raise_for_status()
    res = r.json()["BEAAPI"]["Results"]
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


def empaquetar(s, nombre, unidad, freq, fuente, codigo, grupo=None, org=None):
    s = s.dropna()
    return {"n": nombre, "u": unidad, "f": freq, "src": fuente, "id": codigo, "g": grupo, "org": org,
            "d": [[d.strftime("%Y-%m-%d"), round(float(v), 4)] for d, v in s.items()]}


# -----------------------------------------------------------------------------
data, faltan = {}, []
print("FRED…")
for k, (sid, nombre, unidad, freq) in FRED.items():
    try:
        data[k] = empaquetar(fred(sid, freq), nombre, unidad, freq, "FRED", sid, org=ORG.get(k, "BEA"))
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
    try:
        if bid in series_bls:
            data[k] = empaquetar(series_bls[bid], nombre, unidad, "M", "BLS", bid, org="BLS")
        else:
            data[k] = empaquetar(fred(fid, "M"), nombre, unidad, "M", "FRED", fid, org="BLS")
    except Exception as e:
        faltan.append(k); print(f"  [aviso] {k}: {e}")

print("BEA…")
if BEA_KEY:
    try:
        for lab, s in bea_t20804().items():
            data["cat:" + lab] = empaquetar(s, lab, "índice", "M", "BEA", "T20804", "pce_rubros", org="BEA")
    except Exception as e:
        print(f"  [aviso] BEA T20804: {e}")

paquete = {"generado": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
           "series": data}
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "data.json")
if len(faltan) > (len(FRED) + len(BLS)) / 4:
    sys.exit(f"Demasiadas series fallaron ({len(faltan)}): {faltan}. No se actualiza.")
# Si ninguna serie cambió, no se reescribe el archivo (evita commits vacíos).
try:
    with open(SALIDA, encoding="utf-8") as f:
        if json.load(f).get("series") == json.loads(json.dumps(data)):
            print("Sin datos nuevos.")
            sys.exit(0)
except (FileNotFoundError, json.JSONDecodeError):
    pass
with open(SALIDA, "w", encoding="utf-8") as f:
    json.dump(paquete, f, ensure_ascii=False, separators=(",", ":"))

n_cat = sum(1 for k in data if k.startswith("cat:"))
tam = os.path.getsize(SALIDA) / 1024
print(f"\nListo: {len(data)} series ({n_cat} rubros del core) · {tam:,.0f} KB")
print("Faltan:", faltan or "ninguna")

