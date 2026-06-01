/* ============================================================
   state.js — Estado global, datos históricos y mutaciones
   v4 — Importación Junio 2026
   
   CAMBIOS vs v3:
   - Jun-26 agregado como mes 13
   - HSBC/Tarjetas → separado en Galicia, BBVA Master, BBVA Visa
   - Ocio → separado en Ocio Nano, Ocio Nani
   - Pollería → renombrada a Proteína
   - Monotributo GP → $0 en todos los meses (movido a GL)
   - Monotributo Local en GL → completo Sep-24 a Jun-26
   - Agua Bidón Local agregada en GL
   - Total Mensual y Pasivo cargados como filas separadas
   - Tarjeta USD Galicia y Tarjeta USD BBVA agregadas en GP
   - eCheques de Junio 2026 precargados
   ============================================================ */
"use strict";

// ── Meses — ahora 13 (Sep-24 → Jun-26) ───────────────────
const BASE_MONTHS = [
  "Sep-24","Oct-24","Nov-24","Dic-24",
  "Ene-25","Feb-25","Mar-25",
  "Ene-26","Feb-26","Mar-26","Abr-26","May-26","Jun-26"
];
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ================================================================
//  GASTOS PERSONALES — 13 meses
//  Índices: 0=Sep24 1=Oct24 2=Nov24 3=Dic24 4=Ene25 5=Feb25
//           6=Mar25 7=Ene26 8=Feb26 9=Mar26 10=Abr26 11=May26 12=Jun26
//
//  NOTA: Galicia, BBVA Master, BBVA Visa reemplazan HSBC/Tarjetas
//  Los valores históricos de HSBC/Tarjetas se distribuyeron así:
//    - Galicia: 60% del histórico (estimado, no había desglose previo)
//    - BBVA Master: 30%
//    - BBVA Visa: 10%
//  Jun-26 usa los valores exactos del CSV.
//  Total Mensual y Pasivo van como dos filas por categoría.
// ================================================================
const INIT_GP = [

  // ── Galicia (Total Mensual) ───────────────────────────────
  // Histórico estimado de HSBC/Tarjetas × 60%
  // Jun-26 exacto: $1.908.000 (Total Mensual), Pasivo: $1.908.000 → PENDIENTE
  {cat:"Galicia — Total Mensual", vcto:"5", vals:[
    261210, 399977, 588600, 324370, 324370, 605400, 605400,
    0, 69120, 1504800, 1659120, 1719120, 1908000
  ]},
  {cat:"Galicia — Pasivo", vcto:"5", vals:[
    261210, 399977, 588600, 324370, 324370, 605400, 605400,
    0, 69120, 1504800, 1659120, 1719120, 1908000
  ]},

  // ── BBVA Master (Total Mensual) ───────────────────────────
  // Jun-26 exacto: $630.000 (Total Mensual), Pasivo: $960.000
  {cat:"BBVA Master — Total Mensual", vcto:"5", vals:[
    130605, 199988, 294300, 162185, 162185, 302700, 302700,
    0, 34560, 752400, 829560, 859560, 630000
  ]},
  {cat:"BBVA Master — Pasivo", vcto:"5", vals:[
    130605, 199988, 294300, 162185, 162185, 302700, 302700,
    0, 34560, 752400, 829560, 859560, 960000
  ]},

  // ── BBVA Visa (Total Mensual) ─────────────────────────────
  // Jun-26 exacto: $115.200 (Total Mensual), Pasivo: $200.000
  {cat:"BBVA Visa — Total Mensual", vcto:"5", vals:[
    43535, 66663, 98100, 54062, 54062, 100900, 100900,
    0, 11520, 250800, 276520, 286520, 115200
  ]},
  {cat:"BBVA Visa — Pasivo", vcto:"5", vals:[
    43535, 66663, 98100, 54062, 54062, 100900, 100900,
    0, 11520, 250800, 276520, 286520, 200000
  ]},

  // ── Alquiler ──────────────────────────────────────────────
  {cat:"Alquiler", vcto:"", vals:[
    270000,300000,300000,300000,300000,300000,300000,
    300000,300000,300000,300000,300000, 0
  ]},

  // ── Edersa ────────────────────────────────────────────────
  {cat:"Edersa", vcto:"", vals:[
    24770,24770,24770,22000,22000,22000,29000,
    50000,50000,50000,50000,50000, 50000
  ]},

  // ── AguasRN ───────────────────────────────────────────────
  {cat:"AguasRN", vcto:"", vals:[
    10744,11700,11700,11700,11700,16000,16000,
    16000,16000,20000,20000,20000, 20000
  ]},

  // ── Seguro Auto ───────────────────────────────────────────
  {cat:"Seguro Auto", vcto:"", vals:[
    42000,42000,44000,44000,44000,51000,51000,
    60000,60000,60000,60000,60000, 60000
  ]},

  // ── Monotributo PERSONAL → $0 en todos los meses ─────────
  // (movido a Gastos Local desde inicio)
  {cat:"Monotributo", vcto:"", vals:[
    0,0,0,0,0,0,0,
    0,0,0,0,0, 0
  ]},

  // ── Telefonía ─────────────────────────────────────────────
  // Jun-26: $30.000 Total Mensual / Pasivo $0 → PAGADO
  {cat:"Telefonía", vcto:"", vals:[
    9800,7500,9000,9000,9000,9800,9800,
    30000,30000,30000,30000,40000, 30000
  ]},

  // ── Depilación ────────────────────────────────────────────
  {cat:"Depilación", vcto:"", vals:[
    24000,26000,26000,26000,26000,26000,27000,
    35000,35000,40000,40000,40000, 40000
  ]},

  // ── Gimnasio ──────────────────────────────────────────────
  {cat:"Gimnasio", vcto:"", vals:[
    60000,75000,40500,75000,75000,95000,95000,
    70000,70000,0,0,80000, 0
  ]},

  // ── Verdulería ────────────────────────────────────────────
  {cat:"Verdulería", vcto:"", vals:[
    60000,100000,100000,100000,100000,100000,100000,
    100000,100000,100000,100000,100000, 100000
  ]},

  // ── Agua Bidón (personal) ─────────────────────────────────
  // Jun-26: $35.000 Total / $40.000 Pasivo
  {cat:"Agua Bidón — Total Mensual", vcto:"", vals:[
    22000,22000,22000,22000,22000,22000,22000,
    35000,35000,35000,40000,50000, 35000
  ]},
  {cat:"Agua Bidón — Pasivo", vcto:"", vals:[
    22000,22000,22000,22000,22000,22000,22000,
    35000,35000,35000,40000,50000, 40000
  ]},

  // ── Psicóloga ─────────────────────────────────────────────
  // Jun-26: $110.000 Total / $120.000 Pasivo
  {cat:"Psicóloga — Total Mensual", vcto:"", vals:[
    28000,35000,40000,40000,40000,50000,50000,
    50000,50000,110000,120000,120000, 110000
  ]},
  {cat:"Psicóloga — Pasivo", vcto:"", vals:[
    28000,35000,40000,40000,40000,50000,50000,
    50000,50000,110000,120000,120000, 120000
  ]},

  // ── Combustible ───────────────────────────────────────────
  {cat:"Combustible", vcto:"", vals:[
    40000,40000,40000,40000,40000,40000,40000,
    60000,60000,60000,60000,60000, 60000
  ]},

  // ── Proteína (ex Pollería) ────────────────────────────────
  // Jun-26: $50.000 Total / $50.000 Pasivo
  {cat:"Proteína", vcto:"", vals:[
    0,0,0,0,0,0,0,
    0,0,0,0,0, 50000
  ]},

  // ── Piculería ─────────────────────────────────────────────
  {cat:"Piculería", vcto:"", vals:[
    0,50000,20000,20000,20000,20000,20000,
    40000,40000,40000,40000,40000, 40000
  ]},

  // ── Epen ──────────────────────────────────────────────────
  // Jun-26: $149.000 Total / $326.000 Pasivo
  {cat:"Epen — Total Mensual", vcto:"", vals:[
    0,0,0,49205,49205,223650,227022,
    149000,149000,149000,326000,150000, 149000
  ]},
  {cat:"Epen — Pasivo", vcto:"", vals:[
    0,0,0,49205,49205,223650,227022,
    149000,149000,149000,326000,150000, 326000
  ]},

  // ── Hidenesa ──────────────────────────────────────────────
  {cat:"Hidenesa", vcto:"", vals:[
    0,0,0,37394,37394,60000,26000,
    49000,80000,80000,80000,80000, 80000
  ]},

  // ── Ocio Nano (ex mitad de Ocio) ─────────────────────────
  {cat:"Ocio Nano", vcto:"", vals:[
    0,0,100000,100000,100000,100000,100000,
    100000,100000,100000,100000,100000, 100000
  ]},

  // ── Ocio Nani ────────────────────────────────────────────
  {cat:"Ocio Nani", vcto:"", vals:[
    0,0,100000,100000,100000,100000,100000,
    100000,100000,100000,100000,100000, 100000
  ]},

  // ── IGA ───────────────────────────────────────────────────
  {cat:"IGA", vcto:"", vals:[
    0,0,0,0,0,0,0,
    255000,0,255000,255000,255000, 255000
  ]},

  // ── Contadora ─────────────────────────────────────────────
  {cat:"Contadora", vcto:"", vals:[
    0,0,0,0,0,0,0,
    0,0,35000,35000,35000, 35000
  ]},

  // ── Otros Personales ──────────────────────────────────────
  {cat:"Otros Pers.", vcto:"", vals:[
    0,175000,50000,95000,0,1370000,1376320,
    0,0,914700,914700,914700, 0
  ]},

  // ── Tarjeta USD — Galicia (USD 34 cotizar a pesos) ────────
  // Duda 9: nueva categoría para gastos en dólares
  // Monto en USD guardado, convertir manualmente cuando corresponda
  {cat:"Tarjeta USD — Galicia", vcto:"6", vals:[
    0,0,0,0,0,0,0,
    0,0,0,0,0, 34
  ]},

  // ── Tarjeta USD — BBVA (USD 200) ─────────────────────────
  {cat:"Tarjeta USD — BBVA", vcto:"6", vals:[
    0,0,0,0,0,0,0,
    0,0,0,0,0, 200
  ]},
];

// ================================================================
//  GASTOS LOCAL — 13 meses
//  Monotributo Local completo desde Sep-24
//  Agua Bidón Local agregada
// ================================================================
const INIT_GL = [

  // ── Alquiler Local ────────────────────────────────────────
  {cat:"Alquiler Local", tipo:"Fijo", vals:[
    0,0,0,0,0,0,0,
    900000,900000,1000000,1000000,1000000, 1000000
  ]},

  // ── Luz ───────────────────────────────────────────────────
  // Jun-26: $376.000
  {cat:"Luz", tipo:"Variable", vals:[
    0,0,0,0,0,0,0,
    0,330000,250000,368000,250000, 376000
  ]},

  // ── Gas ───────────────────────────────────────────────────
  // Jun-26: $100.000 Total / $50.000 Pasivo → usamos Total Mensual
  {cat:"Gas", tipo:"Variable", vals:[
    0,0,0,0,0,0,0,
    0,200000,100000,100000,100000, 100000
  ]},

  // ── Monotributo Local — completo desde Sep-24 ─────────────
  // Duda 11: mover Monotributo de Personal a Local en todos los meses
  // Valores tomados del histórico de Monotributo GP
  {cat:"Monotributo Local", tipo:"Fijo", vals:[
    37500,37500,37500,37500,37500,56000,56000,
    70000,70000,70000,70000,80000, 80000
  ]},

  // ── ADT ───────────────────────────────────────────────────
  // Jun-26: $43.330 Total / $70.000 Pasivo
  {cat:"ADT — Total Mensual", tipo:"Fijo", vals:[
    0,0,0,0,0,0,0,
    45000,45000,43330,43330,43330, 43330
  ]},
  {cat:"ADT — Pasivo", tipo:"Fijo", vals:[
    0,0,0,0,0,0,0,
    45000,45000,43330,43330,43330, 70000
  ]},

  // ── Software ──────────────────────────────────────────────
  {cat:"Software", tipo:"Fijo", vals:[
    0,0,0,0,0,0,0,
    38000,38000,38000,38000,38000, 38000
  ]},

  // ── Sueldo Brunella ───────────────────────────────────────
  // Jun-26: $700.000 Total / $770.000 Pasivo
  {cat:"Sueldo Brunella — Total Mensual", tipo:"Fijo", vals:[
    0,0,0,0,0,0,0,
    700000,700000,700000,700000,700000, 700000
  ]},
  {cat:"Sueldo Brunella — Pasivo", tipo:"Fijo", vals:[
    0,0,0,0,0,0,0,
    700000,700000,700000,700000,700000, 770000
  ]},

  // ── Yazuka ────────────────────────────────────────────────
  {cat:"Yazuka", tipo:"Proveedor", vals:[
    0,0,0,0,0,0,0,
    0,0,997450,1496175,1844725, 0
  ]},

  // ── Sonder ────────────────────────────────────────────────
  {cat:"Sonder", tipo:"Proveedor", vals:[
    0,0,0,0,0,0,0,
    0,1000000,0,1500000,1198000, 0
  ]},

  // ── Agua Bidón Local (distinto del personal) ──────────────
  // Jun-26: $25.000 Total / $20.000 Pasivo
  {cat:"Agua Bidón Local — Total Mensual", tipo:"Variable", vals:[
    0,0,0,0,0,0,0,
    0,0,0,0,0, 25000
  ]},
  {cat:"Agua Bidón Local — Pasivo", tipo:"Variable", vals:[
    0,0,0,0,0,0,0,
    0,0,0,0,0, 20000
  ]},

  // ── Otros Local ───────────────────────────────────────────
  {cat:"Otros Local", tipo:"Variable", vals:[
    0,0,0,0,0,0,0,
    0,535000,24780,24780,228450, 0
  ]},
];

// ================================================================
//  INGRESOS — 13 meses (Jun-26 en $0, para cargar)
// ================================================================
const INIT_ING = [
  {canal:"Ventas Mostrador",  vals:[116540,2862800,1079812,290980,418321,480015,423270,1315382,2677930,0,0,0, 0]},
  {canal:"Ventas Tarjeta/QR", vals:[1223080,2196750,1933962,2548050,2575630,1650010,1158200,2732965,2218461,0,0,0, 0]},
  {canal:"Otros Ingresos",    vals:[0,0,0,0,0,0,0,0,0,0,0,0, 0]},
  {canal:"Sueldo YPF",        vals:[0,0,0,0,0,0,0,0,0,0,0,0, 0]},
];

// ================================================================
//  ECHEQUES PRECARGADOS — Junio 2026
//  Fechas extraídas del nombre de cada cheque en el CSV
//  Terminal según columna del CSV
// ================================================================
const INIT_ECHEQUES = [
  {
    id: 1001, proveedor:"Yazuka",
    fechaEmision:"2026-06-01", fechaPago:"2026-06-05",
    monto: 400000, notas:"Echeq YZK 05/06 — OPENPAY $379.721"
  },
  {
    id: 1002, proveedor:"Sonder",
    fechaEmision:"2026-06-01", fechaPago:"2026-06-08",
    monto: 750000, notas:"Echeq Sonder 08/06 — BPNPAGOS $160.572"
  },
  {
    id: 1003, proveedor:"Yazuka",
    fechaEmision:"2026-06-01", fechaPago:"2026-06-08",
    monto: 498725, notas:"Echeq YZK 08/06"
  },
  {
    id: 1004, proveedor:"Yazuka",
    fechaEmision:"2026-06-01", fechaPago:"2026-06-17",
    monto: 400000, notas:"Echeq YZK 17/06 — BBVA"
  },
  {
    id: 1005, proveedor:"Sonder",
    fechaEmision:"2026-06-01", fechaPago:"2026-06-18",
    monto: 672000, notas:"Echeq Sonder 18/06"
  },
  {
    id: 1006, proveedor:"Yazuka",
    fechaEmision:"2026-06-01", fechaPago:"2026-06-26",
    monto: 400000, notas:"Echeq YZK 26/06 — $540.293 acreditado"
  },
];

// ================================================================
//  HELPERS
// ================================================================
function initSPGP(gp, months) {
  const s = {};
  gp.forEach(r => {
    s[r.cat] = {};
    months.forEach((m, i) => { if ((r.vals[i] || 0) > 0) s[r.cat][m] = "PAGADO"; });
  });
  return s;
}

function initSPGL(gl, months) {
  const s = {};
  gl.forEach(r => {
    s[r.cat] = {};
    months.forEach((m, i) => { if ((r.vals[i] || 0) > 0) s[r.cat][m] = "PAGADO"; });
  });
  return s;
}

function ensureVals(arr, len) {
  if (!Array.isArray(arr)) return;
  arr.forEach(r => {
    if (!Array.isArray(r.vals)) r.vals = [];
    while (r.vals.length < len) r.vals.push(0);
  });
}

function patchGP(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(r => {
    const patched = { ...r };
    if (patched.vcto === undefined || patched.vcto === null) patched.vcto = "";
    if (!Array.isArray(patched.vals)) patched.vals = [];
    return patched;
  });
}

function patchGL(arr) {
  if (!Array.isArray(arr)) return [];
  const TIPOS_VALIDOS = ["Fijo","Variable","Proveedor"];
  return arr.map(r => {
    const patched = { ...r };
    if (!TIPOS_VALIDOS.includes(patched.tipo)) patched.tipo = "Variable";
    if (!Array.isArray(patched.vals)) patched.vals = [];
    return patched;
  });
}

function buildInitialState() {
  const months = [...BASE_MONTHS];
  return {
    tab:    "dashboard",
    mes:    "Jun-26",
    months,
    gp:     JSON.parse(JSON.stringify(INIT_GP)),
    gl:     JSON.parse(JSON.stringify(INIT_GL)),
    ing:    JSON.parse(JSON.stringify(INIT_ING)),
    spGP:   initSPGP(JSON.parse(JSON.stringify(INIT_GP)), months),
    spGL:   initSPGL(JSON.parse(JSON.stringify(INIT_GL)), months),
    terminales: [
      { id: 1, nombre: "BPN Pagos",     diasHab: 2, cupones: [] },
      { id: 2, nombre: "BBVA Open Pay", diasHab: 5, cupones: [] },
    ],
    echeques: JSON.parse(JSON.stringify(INIT_ECHEQUES)),
    brunella: [],
  };
}

// ── Estado global ─────────────────────────────────────────
let S = buildInitialState();

// ── Aplicar datos de Firebase / localStorage ──────────────
function applyData(data) {
  if (!data || typeof data !== "object") return;

  const months = Array.isArray(data.months) && data.months.length > 0
    ? data.months : S.months;

  if (typeof data.tab === "string") S.tab = data.tab;

  const newMes = data.mes || months[months.length - 1];
  S.mes = months.includes(newMes) ? newMes : months[months.length - 1];

  S.months     = months;
  S.gp         = data.gp         ? patchGP(data.gp)  : S.gp;
  S.gl         = data.gl         ? patchGL(data.gl)   : S.gl;
  S.ing        = Array.isArray(data.ing) ? data.ing   : S.ing;
  S.spGP       = (data.spGP && typeof data.spGP === "object") ? data.spGP : initSPGP(S.gp, months);
  S.spGL       = (data.spGL && typeof data.spGL === "object") ? data.spGL : initSPGL(S.gl, months);

  if (Array.isArray(data.terminales)) {
    S.terminales = data.terminales.map(t => ({
      id:      typeof t.id      === "number" ? t.id      : Date.now(),
      nombre:  typeof t.nombre  === "string" ? t.nombre  : "Terminal",
      diasHab: typeof t.diasHab === "number" ? t.diasHab : 2,
      cupones: Array.isArray(t.cupones)       ? t.cupones : [],
    }));
  }

  S.echeques = Array.isArray(data.echeques) ? data.echeques : [];
  S.brunella = Array.isArray(data.brunella) ? data.brunella : [];

  ensureVals(S.gp,  S.months.length);
  ensureVals(S.gl,  S.months.length);
  ensureVals(S.ing, S.months.length);
}

// ── Agregar mes nuevo ─────────────────────────────────────
function addMonth() {
  const last  = S.months[S.months.length - 1];
  const parts = last.split("-");
  if (parts.length !== 2) return;

  const yr   = parseInt("20" + parts[1], 10);
  const mIdx = MONTH_NAMES.indexOf(parts[0]);
  if (mIdx === -1) return;

  let nm, ny;
  if (mIdx === 11) { nm = 0; ny = yr + 1; }
  else             { nm = mIdx + 1; ny = yr; }

  const newMes = MONTH_NAMES[nm] + "-" + String(ny).slice(2);
  if (S.months.includes(newMes)) { console.warn("CF: mes", newMes, "ya existe"); return; }

  S.months.push(newMes);
  S.gp.forEach(r  => r.vals.push(0));
  S.gl.forEach(r  => r.vals.push(0));
  S.ing.forEach(r => r.vals.push(0));
  S.mes = newMes;

  save();
  render();
}
