/* ============================================================
   utils.js — Utilidades, cálculos financieros y helpers
   ============================================================ */

// ── Formato moneda argentina ──────────────────────────────
function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "$0";
  const a = Math.abs(Math.round(n));
  return (n < 0 ? "-$" : "$") + a.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ── Parse numérico seguro ─────────────────────────────────
function pn(v) { return parseFloat(v) || 0; }

// ── Helpers de período ────────────────────────────────────
function mesIdx()      { return S.mes === "Todos" ? -1 : S.months.indexOf(S.mes); }
function mesesRange()  { return S.mes === "Todos" ? S.months : [S.mes]; }

// ── Colores para cheques según días restantes ─────────────
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

// ── Calcular fecha de acreditación en días hábiles ────────
function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;   // saltar sábado y domingo
  }
  return d.toISOString().split("T")[0];
}

// ── Descuentos Brunella por mes (precio * 0.8 * cantidad) ─
function brunellaDesc() {
  const t = {};
  S.brunella.forEach(b => {
    if (!t[b.mes]) t[b.mes] = 0;
    t[b.mes] += pn(b.precio) * 0.8 * pn(b.cantidad);
  });
  return t;
}

// ── Proyección de cupones (todos, ordenados por acreditación)
function cuponesProjection() {
  const hoy = new Date().toISOString().split("T")[0];
  const all = [];
  S.terminales.forEach(t => {
    t.cupones.forEach(c => {
      all.push({ ...c, terminal: t.nombre, acreditado: c.fechaAcred <= hoy });
    });
  });
  return all.sort((a, b) => a.fechaAcred.localeCompare(b.fechaAcred));
}

// ── Suma de cupones pendientes de acreditar ───────────────
function cuponesPendientes() {
  const hoy = new Date().toISOString().split("T")[0];
  return S.terminales.reduce((s, t) =>
    s + t.cupones
      .filter(c => c.fechaAcred > hoy)
      .reduce((ss, c) => ss + c.monto, 0), 0);
}

// ── Cálculos financieros del dashboard ───────────────────
function calcTotals() {
  const mr = mesesRange();
  const bd = brunellaDesc();
  const sum = (arr, fn) => arr.reduce((s, r) => mr.reduce((ss, m) => ss + fn(r, m), s), 0);

  const totalIng = sum(S.ing, (r, m) => r.vals[S.months.indexOf(m)] || 0);

  const totalGP  = sum(S.gp,  (r, m) => r.vals[S.months.indexOf(m)] || 0);

  const totalGL  = sum(S.gl,  (r, m) => {
    const i = S.months.indexOf(m);
    let v = r.vals[i] || 0;
    if (r.cat === "Sueldo Brunella") v = Math.max(0, v - (bd[m] || 0));
    return v;
  });

  const pagadoGP = sum(S.gp, (r, m) => {
    const v = r.vals[S.months.indexOf(m)] || 0;
    return (S.spGP[r.cat]?.[m] === "PAGADO") ? v : 0;
  });

  const pagadoGL = sum(S.gl, (r, m) => {
    const i = S.months.indexOf(m);
    let v = r.vals[i] || 0;
    if (r.cat === "Sueldo Brunella") v = Math.max(0, v - (bd[m] || 0));
    return (S.spGL[r.cat]?.[m] === "PAGADO") ? v : 0;
  });

  const totalPagado = pagadoGP + pagadoGL;
  const totalPend   = (totalGP + totalGL) - totalPagado;

  return {
    totalIng, totalGP, totalGL,
    neto:        totalIng - totalGP - totalGL,
    liquido:     totalIng - totalPagado,
    totalPagado, totalPend
  };
}

// ── eCheques próximos a vencer (≤15 días) ─────────────────
function chequesUrgentes() {
  const now = new Date();
  return S.echeques
    .map(e => ({ ...e, dias: Math.ceil((new Date(e.fechaPago) - now) / 864e5) }))
    .filter(e => e.dias <= 15)
    .sort((a, b) => a.dias - b.dias);
}

// ── Alertas de vencimiento de tarjetas (≤3 días) ──────────
function alertasVcto() {
  const today  = new Date();
  const alerts = [];

  S.gp.forEach(r => {
    if (!r.vcto) return;
    const day = parseInt(r.vcto);
    if (!day) return;

    const vctoDate = new Date(today.getFullYear(), today.getMonth(), day);
    if (vctoDate < today) vctoDate.setMonth(vctoDate.getMonth() + 1);

    const diff = Math.ceil((vctoDate - today) / 864e5);
    if (diff <= 3) alerts.push({ cat: r.cat, dia: day, diff });
  });

  return alerts;
}
