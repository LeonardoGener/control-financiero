/* ============================================================
   state.js — Estado global, datos históricos y mutaciones
   ============================================================ */

// ── Constantes de tiempo ──────────────────────────────────
const BASE_MONTHS = [
  "Sep-24","Oct-24","Nov-24","Dic-24",
  "Ene-25","Feb-25","Mar-25",
  "Ene-26","Feb-26","Mar-26","Abr-26","May-26"
];
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Datos históricos iniciales ────────────────────────────
const INIT_GP = [
  {cat:"HSBC/Tarjetas",  vcto:"", vals:[435350,666628,981000,540617,540617,1009000,1009000,0,115200,2508000,2765200,2865200]},
  {cat:"Alquiler",       vcto:"", vals:[270000,300000,300000,300000,300000,300000,300000,300000,300000,300000,300000,300000]},
  {cat:"Edersa",         vcto:"", vals:[24770,24770,24770,22000,22000,22000,29000,50000,50000,50000,50000,50000]},
  {cat:"AguasRN",        vcto:"", vals:[10744,11700,11700,11700,11700,16000,16000,16000,16000,20000,20000,20000]},
  {cat:"Seguro Auto",    vcto:"", vals:[42000,42000,44000,44000,44000,51000,51000,60000,60000,60000,60000,60000]},
  {cat:"Monotributo",    vcto:"", vals:[37500,37500,37500,37500,37500,56000,56000,0,0,0,0,0]},
  {cat:"Telefonía",      vcto:"", vals:[9800,7500,9000,9000,9000,9800,9800,30000,30000,30000,30000,40000]},
  {cat:"Depilación",     vcto:"", vals:[24000,26000,26000,26000,26000,26000,27000,35000,35000,40000,40000,40000]},
  {cat:"Gimnasio",       vcto:"", vals:[60000,75000,40500,75000,75000,95000,95000,70000,70000,0,0,80000]},
  {cat:"Verdulería",     vcto:"", vals:[60000,100000,100000,100000,100000,100000,100000,100000,100000,100000,100000,100000]},
  {cat:"Agua Bidón",     vcto:"", vals:[22000,22000,22000,22000,22000,22000,22000,35000,35000,35000,40000,50000]},
  {cat:"Psicóloga",      vcto:"", vals:[28000,35000,40000,40000,40000,50000,50000,50000,50000,110000,120000,120000]},
  {cat:"Combustible",    vcto:"", vals:[40000,40000,40000,40000,40000,40000,40000,60000,60000,60000,60000,60000]},
  {cat:"Ocio",           vcto:"", vals:[0,0,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000]},
  {cat:"Piculería",      vcto:"", vals:[0,50000,20000,20000,20000,20000,20000,40000,40000,40000,40000,40000]},
  {cat:"Epen",           vcto:"", vals:[0,0,0,49205,49205,223650,227022,149000,149000,149000,326000,150000]},
  {cat:"Hidenesa",       vcto:"", vals:[0,0,0,37394,37394,60000,26000,49000,80000,80000,80000,80000]},
  {cat:"IGA",            vcto:"", vals:[0,0,0,0,0,0,0,255000,0,255000,255000,255000]},
  {cat:"Contadora",      vcto:"", vals:[0,0,0,0,0,0,0,0,0,35000,35000,35000]},
  {cat:"Otros Pers.",    vcto:"", vals:[0,175000,50000,95000,0,1370000,1376320,0,0,914700,914700,914700]},
];

const INIT_GL = [
  {cat:"Alquiler Local",    tipo:"Fijo",      vals:[0,0,0,0,0,0,0,900000,900000,1000000,1000000,1000000]},
  {cat:"Luz",               tipo:"Variable",  vals:[0,0,0,0,0,0,0,0,330000,250000,368000,250000]},
  {cat:"Gas",               tipo:"Variable",  vals:[0,0,0,0,0,0,0,0,200000,100000,100000,100000]},
  {cat:"Monotributo Local", tipo:"Fijo",      vals:[0,0,0,0,0,0,0,70000,70000,70000,70000,80000]},
  {cat:"ADT",               tipo:"Fijo",      vals:[0,0,0,0,0,0,0,45000,45000,43330,43330,43330]},
  {cat:"Software",          tipo:"Fijo",      vals:[0,0,0,0,0,0,0,38000,38000,38000,38000,38000]},
  {cat:"Sueldo Brunella",   tipo:"Fijo",      vals:[0,0,0,0,0,0,0,700000,700000,700000,700000,700000]},
  {cat:"Yazuka",            tipo:"Proveedor", vals:[0,0,0,0,0,0,0,0,0,997450,1496175,1844725]},
  {cat:"Sonder",            tipo:"Proveedor", vals:[0,0,0,0,0,0,0,0,1000000,0,1500000,1198000]},
  {cat:"Otros Local",       tipo:"Variable",  vals:[0,0,0,0,0,0,0,0,535000,24780,24780,228450]},
];

const INIT_ING = [
  {canal:"Ventas Mostrador",  vals:[116540,2862800,1079812,290980,418321,480015,423270,1315382,2677930,0,0,0]},
  {canal:"Ventas Tarjeta/QR", vals:[1223080,2196750,1933962,2548050,2575630,1650010,1158200,2732965,2218461,0,0,0]},
  {canal:"Otros Ingresos",    vals:[0,0,0,0,0,0,0,0,0,0,0,0]},
  {canal:"Sueldo YPF",        vals:[0,0,0,0,0,0,0,0,0,0,0,0]},
];

// ── Helpers de inicialización ─────────────────────────────
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

// Asegurar que todos los arrays de valores tengan la longitud correcta
function ensureVals(arr, len) {
  arr.forEach(r => { while (r.vals.length < len) r.vals.push(0); });
}

// Parche para agregar campo vcto si viene de datos viejos
function patchGP(arr) {
  return arr.map(r => ({ vcto: r.vcto || "", ...r }));
}

// ── Constructor de estado inicial ─────────────────────────
function buildInitialState() {
  const months = [...BASE_MONTHS];
  return {
    tab:    "dashboard",
    mes:    "May-26",
    months,
    gp:     JSON.parse(JSON.stringify(INIT_GP)),
    gl:     JSON.parse(JSON.stringify(INIT_GL)),
    ing:    JSON.parse(JSON.stringify(INIT_ING)),
    spGP:   initSPGP(JSON.parse(JSON.stringify(INIT_GP)), months),
    spGL:   initSPGL(JSON.parse(JSON.stringify(INIT_GL)), months),
    terminales: [
      { id: 1, nombre: "BPN Pagos",      diasHab: 2, cupones: [] },
      { id: 2, nombre: "BBVA Open Pay",  diasHab: 5, cupones: [] },
    ],
    echeques: [],
    brunella: [],
  };
}

// ── Estado global ─────────────────────────────────────────
let S = buildInitialState();

// ── Aplicar datos recibidos de Firebase ───────────────────
function applyData(data) {
  if (!data) return;
  const months = data.months || S.months;

  S.tab       = data.tab  || "dashboard";
  S.mes       = data.mes  || months[months.length - 1];
  S.months    = months;
  S.gp        = data.gp        ? patchGP(data.gp) : S.gp;
  S.gl        = data.gl        || S.gl;
  S.ing       = data.ing       || S.ing;
  S.spGP      = data.spGP      || initSPGP(S.gp, months);
  S.spGL      = data.spGL      || initSPGL(S.gl, months);
  S.terminales= data.terminales|| S.terminales;
  S.echeques  = data.echeques  || [];
  S.brunella  = data.brunella  || [];

  // Asegurar longitudes consistentes
  ensureVals(S.gp,  S.months.length);
  ensureVals(S.gl,  S.months.length);
  ensureVals(S.ing, S.months.length);
}

// ── Agregar un mes nuevo ──────────────────────────────────
function addMonth() {
  const last  = S.months[S.months.length - 1];
  const parts = last.split("-");
  const yr    = parseInt("20" + parts[1]);
  const mIdx  = MONTH_NAMES.indexOf(parts[0]);

  let nm, ny;
  if (mIdx === 11) { nm = 0; ny = yr + 1; }
  else             { nm = mIdx + 1; ny = yr; }

  const newMes = MONTH_NAMES[nm] + "-" + String(ny).slice(2);
  if (S.months.includes(newMes)) return;

  S.months.push(newMes);
  S.gp.forEach(r  => r.vals.push(0));
  S.gl.forEach(r  => r.vals.push(0));
  S.ing.forEach(r => r.vals.push(0));
  S.mes = newMes;

  save();
  render();
}
