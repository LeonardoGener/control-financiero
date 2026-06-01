/* ============================================================
   utils.js — Utilidades y cálculos financieros
   BUGS CORREGIDOS:
   - fmt maneja NaN, Infinity y valores extremos
   - addBusinessDays con límite máximo para evitar loop infinito
   - calcTotals con guard contra arrays vacíos
   ============================================================ */
"use strict";

// BUG FIX: manejo de Infinity y valores extremos
function fmt(n) {
  if (n === undefined || n === null || isNaN(n) || !isFinite(n)) return "$0";
  const a = Math.abs(Math.round(n));
  return (n < 0 ? "-$" : "$") + a.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function pn(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function mesIdx()     { return S.mes === "Todos" ? -1 : S.months.indexOf(S.mes); }
function mesesRange() { return S.mes === "Todos" ? S.months : [S.mes]; }

function chequeClass(d) {
  if (d < 0)   return "c-rojo";
  if (d <= 7)  return "c-naranja";
  if (d <= 15) return "c-amarillo";
  return "c-verde";
}
function diasColor(d) {
  if (d < 0)   return "var(--neg)";
  if (d <= 7)  return "var(--ora)";
  if (d <= 15) return "var(--warn)";
  return "var(--pos)";
}

// BUG FIX: límite de 60 iteraciones para evitar loop infinito
function addBusinessDays(dateStr, days) {
  if (!dateStr || typeof days !== "number" || days < 0) return dateStr;
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  let added = 0;
  let safety = 0;
  while (added < days && safety < 60) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
    safety++;
  }
  return d.toISOString().split("T")[0];
}

function brunellaDesc() {
  const t = {};
  S.brunella.forEach(b => {
    if (!b.mes) return;
    if (!t[b.mes]) t[b.mes] = 0;
    t[b.mes] += pn(b.precio) * 0.8 * pn(b.cantidad);
  });
  return t;
}

function cuponesProjection() {
  const hoy = new Date().toISOString().split("T")[0];
  const all = [];
  S.terminales.forEach(t => {
    if (!Array.isArray(t.cupones)) return;
    t.cupones.forEach(c => {
      all.push({ ...c, terminal: t.nombre, acreditado: c.fechaAcred <= hoy });
    });
  });
  return all.sort((a, b) => a.fechaAcred.localeCompare(b.fechaAcred));
}

function cuponesPendientes() {
  const hoy = new Date().toISOString().split("T")[0];
  return S.terminales.reduce((s, t) => {
    if (!Array.isArray(t.cupones)) return s;
    return s + t.cupones
      .filter(c => c.fechaAcred > hoy)
      .reduce((ss, c) => ss + pn(c.monto), 0);
  }, 0);
}

// BUG FIX: guard contra S vacío o mal formado
function calcTotals() {
  const mr = mesesRange();
  const bd = brunellaDesc();

  const safeIdx = (m) => {
    const i = S.months.indexOf(m);
    return i >= 0 ? i : -1;
  };

  const sum = (arr, fn) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((s, r) => mr.reduce((ss, m) => {
      const i = safeIdx(m);
      return ss + (i >= 0 ? fn(r, m, i) : 0);
    }, s), 0);
  };

  // Ventas: canales tipo "venta" (o sin tipo, para compatibilidad con datos viejos)
  const totalIng = sum(S.ing, (r, m, i) =>
    (!r.tipo || r.tipo === "venta") ? pn(r.vals?.[i]) : 0
  );

  // Estado de cuentas: canales tipo "cuenta"
  const totalCuentas = sum(S.ing, (r, m, i) =>
    r.tipo === "cuenta" ? pn(r.vals?.[i]) : 0
  );

  const totalGP = sum(S.gp, (r, m, i) => pn(r.vals?.[i]));
  const totalGL = sum(S.gl, (r, m, i) => {
    let v = pn(r.vals?.[i]);
    if (r.cat === "Sueldo Brunella" || r.cat === "Sueldo Brunella — Total Mensual")
      v = Math.max(0, v - pn(bd[m]));
    return v;
  });

  const pagadoGP = sum(S.gp, (r, m, i) => {
    const v = pn(r.vals?.[i]);
    return (S.spGP[r.cat]?.[m] === "PAGADO") ? v : 0;
  });
  const pagadoGL = sum(S.gl, (r, m, i) => {
    let v = pn(r.vals?.[i]);
    if (r.cat === "Sueldo Brunella" || r.cat === "Sueldo Brunella — Total Mensual")
      v = Math.max(0, v - pn(bd[m]));
    return (S.spGL[r.cat]?.[m] === "PAGADO") ? v : 0;
  });

  const totalPagado = pagadoGP + pagadoGL;
  const totalPend   = (totalGP + totalGL) - totalPagado;

  return {
    totalIng,
    totalCuentas,
    totalGP,
    totalGL,
    neto:        totalIng - totalGP - totalGL,
    // Dinero líquido = ingresos - pagado + saldo disponible en cuentas
    liquido:     totalIng - totalPagado + totalCuentas,
    totalPagado,
    totalPend,
  };
}

function chequesUrgentes() {
  const now = new Date();
  return S.echeques
    .filter(e => e.fechaPago)
    .map(e => ({ ...e, dias: Math.ceil((new Date(e.fechaPago) - now) / 864e5) }))
    .filter(e => e.dias <= 15)
    .sort((a, b) => a.dias - b.dias);
}

function alertasVcto() {
  const today  = new Date();
  const alerts = [];
  S.gp.forEach(r => {
    if (!r.vcto) return;
    const day = parseInt(r.vcto, 10);
    if (!day || day < 1 || day > 31) return;
    const vctoDate = new Date(today.getFullYear(), today.getMonth(), day);
    if (vctoDate < today) vctoDate.setMonth(vctoDate.getMonth() + 1);
    const diff = Math.ceil((vctoDate - today) / 864e5);
    if (diff <= 3) alerts.push({ cat: r.cat, dia: day, diff });
  });
  return alerts;
}

// ── Exportación CSV segura ────────────────────────────────
function escapeCsv(value) {
  const str = value == null ? "" : String(value);
  if (/[",\r\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function downloadTextFile(filename, content) {
  // Sanitizar nombre de archivo
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const type = safeName.endsWith(".csv") ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportStateAsJson() {
  save();
  // BUG FIX: no serializar _savedAt ni campos internos de Firebase
  const clean = JSON.parse(JSON.stringify(S));
  delete clean._savedAt;
  downloadTextFile("control-financiero-" + new Date().toISOString().split("T")[0] + ".json",
    JSON.stringify(clean, null, 2));
}

function exportStateAsCsv() {
  save();
  const rows = [];
  rows.push(["SECCION","ITEM","TIPO","VCTO",...S.months]);
  S.gp.forEach(r  => rows.push(["GP",  r.cat,    "",       r.vcto || "", ...r.vals.map(v => v || 0)]));
  S.gl.forEach(r  => rows.push(["GL",  r.cat,    r.tipo || "", "",        ...r.vals.map(v => v || 0)]));
  S.ing.forEach(r => rows.push(["ING", r.canal,  "",       "",            ...r.vals.map(v => v || 0)]));
  rows.push([]);
  rows.push(["TERMINAL","NOMBRE","DIAS_HABILES"]);
  S.terminales.forEach(t => rows.push(["TERMINAL", t.nombre, t.diasHab]));
  rows.push([]);
  rows.push(["ECHEQUE","MONTO","FECHA_PAGO","PROVEEDOR"]);
  S.echeques.forEach(e => rows.push(["ECHEQUE", e.monto, e.fechaPago, e.proveedor || ""]));
  rows.push([]);
  rows.push(["BRUNELLA","MES","PRECIO","CANTIDAD","ARTICULO"]);
  S.brunella.forEach(b => rows.push(["BRUNELLA", b.mes, b.precio, b.cantidad, b.articulo || ""]));
  const csv = rows.map(row => row.map(escapeCsv).join(",")).join("\r\n");
  downloadTextFile("control-financiero-" + new Date().toISOString().split("T")[0] + ".csv", csv);
}
