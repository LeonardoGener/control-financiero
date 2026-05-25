/* ============================================================
   app.js — Motor de render + módulos UI (Design System v2)
   ============================================================ */

// ── Motor de creación de elementos DOM ───────────────────
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if      (k === "class")                         el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else                                             el.setAttribute(k, v);
    });
  }
  children.flat(Infinity).forEach(c => {
    if (c == null || c === false || c === undefined) return;
    el.appendChild(
      typeof c === "string" || typeof c === "number"
        ? document.createTextNode(String(c))
        : c
    );
  });
  return el;
}
function on(el, ev, fn) { el.addEventListener(ev, fn); return el; }

// ── Render principal ──────────────────────────────────────
function render() {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  appEl.innerHTML = "";
  appEl.appendChild(buildApp());
}

// ════════════════════════════════════════════════════════════
//  APP SHELL
// ════════════════════════════════════════════════════════════
function buildApp() {
  const t = calcTotals();

  const TABS = [
    { id:"dashboard", lbl:"Dashboard",    icon:"📊" },
    { id:"gp",        lbl:"G. Personal",  icon:"👤" },
    { id:"gl",        lbl:"G. Local",     icon:"🏪" },
    { id:"ing",       lbl:"Ingresos",     icon:"💰" },
    { id:"term",      lbl:"Terminales",   icon:"💳" },
    { id:"echeq",     lbl:"eCheques",     icon:"📄" },
    { id:"brun",      lbl:"Brunella",     icon:"👗" },
  ];

  const wrap = h("div", { class:"app" });

  // ── Header ──────────────────────────────────────────────
  const hdr = h("div", { class:"app-header" },

    // Brand
    h("div", { class:"app-brand" },
      h("div", { class:"app-brand-icon" },
        (() => {
          const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
          svg.setAttribute("width","18"); svg.setAttribute("height","18");
          svg.setAttribute("viewBox","0 0 36 36"); svg.setAttribute("fill","none");
          const path = document.createElementNS("http://www.w3.org/2000/svg","path");
          path.setAttribute("d","M10 25l7-9 4.5 6 3.5-5 7 8");
          path.setAttribute("stroke","white"); path.setAttribute("stroke-width","2.8");
          path.setAttribute("stroke-linecap","round"); path.setAttribute("stroke-linejoin","round");
          svg.appendChild(path);
          return svg;
        })()
      ),
      h("span", { class:"app-title" }, "Control Financiero")
    ),

    // Controls
    h("div", { class:"header-controls" },

      h("span", { class:"period-label" }, "Período"),

      // Selector de mes
      (() => {
        const sel = h("select", null,
          h("option", { value:"Todos" }, "Todos los meses"),
          ...S.months.map(m => h("option", { value:m }, m))
        );
        sel.value = S.mes;
        on(sel, "change", e => { S.mes = e.target.value; save(); render(); });
        return sel;
      })(),

      // + Mes
      (() => {
        const btn = h("button", { class:"btn btn-sec" }, "+ Mes");
        on(btn, "click", addMonth);
        return btn;
      })(),

      // Sync
      (() => {
        const btn = h("button", { class:"btn btn-sec" }, "↻ Sync");
        on(btn, "click", async () => {
          btn.textContent = "…";
          btn.disabled = true;
          await loadFromCloud();
          render();
        });
        return btn;
      })(),

      // Estado sincronización
      h("div", { class:"sync-bar" },
        h("span", { id:"sync-dot", class:"sync-dot" }),
        h("span", { id:"sync-lbl", style:{ color:"var(--pos)" } }, "Guardado ✓")
      ),

      // Email
      h("div", { class:"user-chip" }, usuarioActual ? usuarioActual.email : ""),

      // Salir
      (() => {
        const btn = h("button", { class:"btn btn-sec" }, "Salir");
        on(btn, "click", logout);
        return btn;
      })()
    )
  );
  wrap.appendChild(hdr);

  // ── Tabs ────────────────────────────────────────────────
  const tabBar = h("div", { class:"tabs", role:"tablist" },
    ...TABS.map(tb => {
      const btn = h("button", {
        class: "tab" + (S.tab === tb.id ? " active" : ""),
        role: "tab",
        "aria-selected": S.tab === tb.id ? "true" : "false"
      }, tb.icon + " " + tb.lbl);
      on(btn, "click", () => { S.tab = tb.id; save(); render(); });
      return btn;
    })
  );
  wrap.appendChild(tabBar);

  // ── Contenido ───────────────────────────────────────────
  let content;
  if      (S.tab === "dashboard") content = buildDashboard(t);
  else if (S.tab === "gp")        content = buildGP();
  else if (S.tab === "gl")        content = buildGL();
  else if (S.tab === "ing")       content = buildIng();
  else if (S.tab === "term")      content = buildTerm();
  else if (S.tab === "echeq")     content = buildEcheques();
  else if (S.tab === "brun")      content = buildBrunella();

  wrap.appendChild(content);
  return wrap;
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════
function buildDashboard(t) {
  const d           = h("div", null);
  const pendTarjeta = cuponesPendientes();

  // KPIs
  const kpis = [
    { lbl:"Ingresos Totales",  val:t.totalIng,    cls:"pos", variant:"kpi-pos" },
    { lbl:"Gastos Personales", val:t.totalGP,     cls:"neg", variant:"kpi-neg" },
    { lbl:"Gastos Local",      val:t.totalGL,     cls:"neg", variant:"kpi-neg" },
    { lbl:"Resultado Neto",    val:t.neto,        cls: t.neto >= 0 ? "pos":"neg", variant: t.neto >= 0 ? "kpi-pos":"kpi-neg" },
    { lbl:"Dinero Líquido",    val:t.liquido,     cls:"neu", variant:"kpi-neu" },
    { lbl:"Total Pagado",      val:t.totalPagado, cls:"yel", variant:"kpi-warn" },
    { lbl:"Pendiente Gastos",  val:t.totalPend,   cls:"neg", variant:"kpi-neg" },
    { lbl:"Por Acreditar",     val:pendTarjeta,   cls:"pur", variant:"kpi-pur" },
  ];

  d.appendChild(h("div", { class:"kpi-grid" },
    ...kpis.map(k => h("div", { class:`kpi ${k.variant}` },
      h("div", { class:"kpi-lbl" }, k.lbl),
      h("div", { class:`kpi-val ${k.cls}` }, fmt(k.val))
    ))
  ));

  // Alerta vencimientos tarjeta
  const vctoAlerts = alertasVcto();
  if (vctoAlerts.length > 0) {
    d.appendChild(h("div", { class:"alert-critical" },
      h("div", { class:"alert-critical-title" }, "🔴 Vencimiento de tarjetas en los próximos 3 días"),
      ...vctoAlerts.map(a => h("div", { class:"alert-row c-rojo" },
        h("span", { style:{ flex:"1", fontWeight:"600" } }, a.cat),
        h("span", { style:{ color:"var(--neg)", fontWeight:"700" } },
          a.diff === 0 ? "HOY" : a.diff === 1 ? "Mañana" : "En " + a.diff + " días"),
        h("span", { style:{ color:"var(--txt-2)", fontSize:"11px" } }, "· día " + a.dia)
      ))
    ));
  }

  const mr       = mesesRange();
  const topGP    = [...S.gp].map(r => ({ cat:r.cat, v:mr.reduce((s,m) => s+(r.vals[S.months.indexOf(m)]||0),0) })).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,6);
  const topGL    = [...S.gl].map(r => ({ cat:r.cat, v:mr.reduce((s,m) => s+(r.vals[S.months.indexOf(m)]||0),0) })).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,6);
  const ingRows  = S.ing.map(r => ({ canal:r.canal, v:mr.reduce((s,m) => s+(r.vals[S.months.indexOf(m)]||0),0) })).filter(x=>x.v>0);
  const urgentes = chequesUrgentes();
  const proj     = cuponesProjection().filter(c => !c.acreditado).slice(0, 8);

  const grid = h("div", { class:"dash-grid" });

  // Top Gastos Personales
  grid.appendChild(h("div", { class:"card" },
    h("div", { class:"sec-title" }, "📈 Top Gastos Personales"),
    ...topGP.map(r => h("div", { class:"mini-row" },
      h("span", { class:"mini-row-label" }, r.cat),
      h("span", { class:"mini-row-val neg" }, fmt(r.v))
    ))
  ));

  // Top Gastos Local
  grid.appendChild(h("div", { class:"card" },
    h("div", { class:"sec-title" }, "🏪 Top Gastos Local"),
    ...topGL.map(r => h("div", { class:"mini-row" },
      h("span", { class:"mini-row-label" }, r.cat),
      h("span", { class:"mini-row-val neg" }, fmt(r.v))
    ))
  ));

  // Ingresos por canal
  grid.appendChild(h("div", { class:"card" },
    h("div", { class:"sec-title" }, "💰 Ingresos por Canal"),
    ...ingRows.map(r => h("div", { class:"mini-row" },
      h("span", { class:"mini-row-label" }, r.canal),
      h("span", { class:"mini-row-val pos" }, fmt(r.v))
    ))
  ));

  // eCheques resumen
  const allCheques   = S.echeques.map(e => ({ ...e, dias: Math.ceil((new Date(e.fechaPago) - new Date()) / 864e5) }));
  const totalCheques = allCheques.reduce((s,e) => s + pn(e.monto), 0);
  const grupos = [
    { lbl:">15 días", color:"var(--pos)",  items: allCheques.filter(e=>e.dias>15) },
    { lbl:"8–15 días",color:"var(--warn)", items: allCheques.filter(e=>e.dias>=8&&e.dias<=15) },
    { lbl:"1–7 días", color:"var(--ora)",  items: allCheques.filter(e=>e.dias>=1&&e.dias<=7) },
    { lbl:"Vencidos", color:"var(--neg)",  items: allCheques.filter(e=>e.dias<=0) },
  ];
  grid.appendChild(h("div", { class:"card" },
    h("div", { class:"sec-title" }, "📄 eCheques"),
    h("div", { class:"cheque-resumen-grid" },
      ...grupos.map(g => {
        const tot = g.items.reduce((s,e)=>s+pn(e.monto),0);
        const item = h("div", { class:"cheque-resumen-item" });
        item.style.borderLeftColor = g.color;
        item.appendChild(h("div", { class:"cheque-resumen-lbl" }, g.lbl));
        const montoEl = h("div", { class:"cheque-resumen-monto" }, fmt(tot));
        montoEl.style.color = g.color;
        item.appendChild(montoEl);
        item.appendChild(h("div", { class:"cheque-resumen-count" }, g.items.length + " cheque" + (g.items.length !== 1 ? "s" : "")));
        return item;
      })
    ),
    h("div", { class:"mini-row" },
      h("span", { class:"mini-row-label" }, "Total pendiente"),
      h("span", { class:"mini-row-val yel" }, fmt(totalCheques))
    )
  ));

  // eCheques urgentes
  if (urgentes.length > 0) {
    grid.appendChild(h("div", { class:"card" },
      h("div", { class:"sec-title" }, "⚠️ eCheques por Vencer"),
      ...urgentes.map(e => {
        const lbl = e.dias < 0 ? "VENCIDO" : e.dias === 0 ? "HOY" : e.dias + " días";
        return h("div", { class:`alert-row ${chequeClass(e.dias)}` },
          h("span", { style:{ flex:"1", fontWeight:"500" } }, e.proveedor),
          h("span", { style:{ fontWeight:"700", marginLeft:"auto" } }, fmt(e.monto)),
          h("span", { style:{ color:diasColor(e.dias), fontWeight:"700", fontSize:"11px", minWidth:"64px", textAlign:"right" } }, lbl)
        );
      })
    ));
  }

  // Proyección acreditaciones
  if (proj.length > 0) {
    const pendTotal = cuponesPendientes();
    grid.appendChild(h("div", { class:"card" },
      h("div", { class:"sec-header" },
        h("div", { class:"sec-header-text" },
          h("div", { class:"sec-header-title" }, "💳 Proyección Acreditaciones"),
          h("div", { class:"sec-header-sub" }, "Montos pendientes de cobro por tarjeta")
        )
      ),
      ...proj.map(c => h("div", { class:"proj-row" },
        h("span", { class:"proj-date" }, c.fechaAcred),
        h("span", { class:"proj-term" }, c.terminal),
        h("span", { class:"proj-monto" }, fmt(c.monto)),
        h("span", { class:"pend-badge" }, "Pendiente")
      )),
      h("div", { class:"divider" }),
      h("div", { style:{ display:"flex", justifyContent:"space-between", fontSize:"12px", fontWeight:"600" } },
        h("span", { style:{ color:"var(--txt-2)" } }, "Total a acreditar"),
        h("span", { class:"pur" }, fmt(pendTotal))
      )
    ));
  }

  d.appendChild(grid);
  return d;
}

// ════════════════════════════════════════════════════════════
//  GASTOS PERSONALES
// ════════════════════════════════════════════════════════════
function buildGP() {
  const mr = mesesRange();
  const d  = h("div", null);

  // Formulario agregar
  const addCard = h("div", { class:"card" });
  addCard.appendChild(h("div", { class:"sec-title" }, "➕ Nueva Categoría Personal"));
  let newCat = "";
  const frow   = h("div", { class:"form-row" });
  const inpCat = h("input", { type:"text", placeholder:"Nombre de la categoría" });
  on(inpCat, "input", e => newCat = e.target.value);
  const btnAC = h("button", { class:"btn btn-pri" }, "Agregar");
  on(btnAC, "click", () => {
    if (!newCat.trim()) return;
    S.gp.push({ cat:newCat.trim(), vcto:"", vals:Array(S.months.length).fill(0) });
    if (!S.spGP[newCat.trim()]) S.spGP[newCat.trim()] = {};
    save(); render();
  });
  frow.appendChild(h("div", { class:"f" }, h("label", null, "Categoría"), inpCat));
  frow.appendChild(h("div", { class:"f", style:{ justifyContent:"flex-end" } }, h("label", null, " "), btnAC));
  addCard.appendChild(frow);
  d.appendChild(addCard);

  // Tabla
  const mainCard = h("div", { class:"card" });
  mainCard.appendChild(h("div", { class:"sec-header" },
    h("div", { class:"sec-header-text" },
      h("div", { class:"sec-header-title" }, "👤 Gastos Personales — " + S.mes),
      h("div", { class:"sec-header-sub" }, "Hacé click en el nombre para editarlo · Vcto = día vencimiento tarjeta")
    )
  ));

  const wrap   = h("div", { class:"tbl-wrap" });
  const tbl    = h("table", null);
  const headTr = h("tr", null,
    h("th", { style:{ minWidth:"150px" } }, "Categoría"),
    h("th", { style:{ minWidth:"70px", textAlign:"center" } }, "Vcto")
  );
  mr.forEach(m => headTr.appendChild(h("th", { class:"ta-right", style:{ minWidth:"120px" } }, m)));
  headTr.appendChild(h("th", { class:"ta-right", style:{ minWidth:"110px" } }, "Total"));
  headTr.appendChild(h("th", { style:{ width:"40px" } }, ""));
  tbl.appendChild(h("thead", null, headTr));

  const tbody = h("tbody", null);
  S.gp.forEach((r, ri) => {
    const catInp = h("input", { type:"text", class:"catname", value:r.cat });
    on(catInp, "change", e => {
      const o = S.gp[ri].cat, n = e.target.value.trim() || o;
      if (S.spGP[o]) { S.spGP[n] = S.spGP[o]; delete S.spGP[o]; }
      S.gp[ri].cat = n; save();
    });

    const vctoInp = h("input", { type:"number", class:"cell", placeholder:"—", min:"1", max:"31",
      value:r.vcto||"", style:{ width:"52px", textAlign:"center" } });
    on(vctoInp, "input", e => { S.gp[ri].vcto = e.target.value; save(); });

    const tr = h("tr", null,
      h("td", null, catInp),
      h("td", { style:{ textAlign:"center" } }, vctoInp)
    );
    let rowTotal = 0;

    mr.forEach(m => {
      const i  = S.months.indexOf(m);
      const v  = r.vals[i] || 0;
      rowTotal += v;
      const st = S.spGP[r.cat]?.[m] || "PENDIENTE";

      const inp = h("input", { type:"number", class:"cell", value:v||"", placeholder:"0" });
      on(inp, "input", e => {
        S.gp[ri].vals[i] = pn(e.target.value);
        if (!S.spGP[r.cat]) S.spGP[r.cat] = {};
        if (pn(e.target.value) > 0 && !S.spGP[r.cat][m]) S.spGP[r.cat][m] = "PENDIENTE";
        save();
      });

      const sbtn = h("button", {
        class: `badge ${v > 0 ? st.toLowerCase() : "pendiente"}`,
        style: { marginLeft:"6px", display: v > 0 ? "inline-flex":"none" }
      }, st === "PAGADO" ? "✓ Pagado" : "⏳ Pend.");
      on(sbtn, "click", () => {
        if (!S.spGP[r.cat]) S.spGP[r.cat] = {};
        S.spGP[r.cat][m] = S.spGP[r.cat]?.[m] === "PAGADO" ? "PENDIENTE" : "PAGADO";
        save(); render();
      });

      tr.appendChild(h("td", { style:{ textAlign:"right" } },
        h("div", { style:{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:"4px" } }, inp, sbtn)
      ));
    });

    tr.appendChild(h("td", { class:"ta-right", style:{ fontWeight:"700", color:"var(--neg)" } }, fmt(rowTotal)));

    const delBtn = h("button", { class:"btn btn-del btn-xs" }, "✕");
    on(delBtn, "click", () => {
      if (!confirm("¿Eliminar " + r.cat + "?")) return;
      S.gp.splice(ri, 1); delete S.spGP[r.cat]; save(); render();
    });
    tr.appendChild(h("td", { style:{ textAlign:"center" } }, delBtn));
    tbody.appendChild(tr);
  });

  // Total
  const totalTr = h("tr", { class:"total-row" }, h("td", { colspan:"2" }, "TOTAL"));
  mr.forEach(m => {
    const i = S.months.indexOf(m);
    totalTr.appendChild(h("td", { class:"ta-right" }, fmt(S.gp.reduce((s,r) => s+(r.vals[i]||0), 0))));
  });
  totalTr.appendChild(h("td", { class:"ta-right" }, fmt(S.gp.reduce((s,r) => s+mr.reduce((ss,m) => ss+(r.vals[S.months.indexOf(m)]||0),0), 0))));
  totalTr.appendChild(h("td", null, ""));
  tbody.appendChild(totalTr);

  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  mainCard.appendChild(wrap);
  d.appendChild(mainCard);
  return d;
}

// ════════════════════════════════════════════════════════════
//  GASTOS LOCAL
// ════════════════════════════════════════════════════════════
function buildGL() {
  const mr = mesesRange();
  const bd = brunellaDesc();
  const d  = h("div", null);

  // Agregar categoría
  const addCard = h("div", { class:"card" });
  addCard.appendChild(h("div", { class:"sec-title" }, "➕ Nueva Categoría Local"));
  let nCat = "", nTipo = "Fijo";
  const frow = h("div", { class:"form-row" });
  const inpC = h("input", { type:"text", placeholder:"Nombre" });
  on(inpC, "input", e => nCat = e.target.value);
  const selT2 = h("select", null, ...["Fijo","Variable","Proveedor"].map(t => h("option", { value:t }, t)));
  on(selT2, "change", e => nTipo = e.target.value);
  const btnA = h("button", { class:"btn btn-pri" }, "Agregar");
  on(btnA, "click", () => {
    if (!nCat.trim()) return;
    S.gl.push({ cat:nCat.trim(), tipo:nTipo, vals:Array(S.months.length).fill(0) });
    if (!S.spGL[nCat.trim()]) S.spGL[nCat.trim()] = {};
    save(); render();
  });
  frow.appendChild(h("div", { class:"f" }, h("label", null, "Categoría"), inpC));
  frow.appendChild(h("div", { class:"f" }, h("label", null, "Tipo"), selT2));
  frow.appendChild(h("div", { class:"f", style:{ justifyContent:"flex-end" } }, h("label", null, " "), btnA));
  addCard.appendChild(frow);
  d.appendChild(addCard);

  const mainCard = h("div", { class:"card" });

  if (Object.keys(bd).length > 0) {
    mainCard.appendChild(h("div", { style:{ marginBottom:"var(--sp-4)" } },
      h("div", { style:{ fontSize:"11px", color:"var(--pur)", fontWeight:"600", marginBottom:"var(--sp-1)" } }, "Descuentos Brunella aplicados (20%)"),
      h("div", null, ...Object.entries(bd).map(([m,v]) => h("span", { class:"chip" }, `${m}: ${fmt(v)}`)))
    ));
  }

  mainCard.appendChild(h("div", { class:"sec-header" },
    h("div", { class:"sec-header-text" },
      h("div", { class:"sec-header-title" }, "🏪 Gastos Local — " + S.mes),
      h("div", { class:"sec-header-sub" }, "★ Sueldo Brunella descuenta automáticamente el 20% empleado")
    )
  ));

  const wrap   = h("div", { class:"tbl-wrap" });
  const tbl    = h("table", null);
  const headTr = h("tr", null,
    h("th", { style:{ minWidth:"150px" } }, "Categoría"),
    h("th", { style:{ minWidth:"90px" } }, "Tipo")
  );
  mr.forEach(m => headTr.appendChild(h("th", { class:"ta-right", style:{ minWidth:"120px" } }, m)));
  headTr.appendChild(h("th", { class:"ta-right", style:{ minWidth:"110px" } }, "Total"));
  headTr.appendChild(h("th", { style:{ width:"40px" } }, ""));
  tbl.appendChild(h("thead", null, headTr));

  const tbody = h("tbody", null);
  S.gl.forEach((r, ri) => {
    const esBrun = r.cat === "Sueldo Brunella";
    const catInp = h("input", { type:"text", class:"catname", value:r.cat });
    on(catInp, "change", e => {
      const o = S.gl[ri].cat, n = e.target.value.trim() || o;
      if (S.spGL[o]) { S.spGL[n] = S.spGL[o]; delete S.spGL[o]; }
      S.gl[ri].cat = n; save();
    });

    const tr = h("tr", null,
      h("td", null, catInp, esBrun ? h("span", { style:{ color:"var(--pur)", fontSize:"10px", marginLeft:"4px" } }, "★") : ""),
      h("td", null, h("span", { class:`badge ${r.tipo.toLowerCase()}` }, r.tipo))
    );

    let rowTotal = 0;
    mr.forEach(m => {
      const i    = S.months.indexOf(m);
      const v    = r.vals[i] || 0;
      const desc = esBrun ? (bd[m] || 0) : 0;
      const neto = Math.max(0, v - desc);
      rowTotal  += neto;
      const st   = S.spGL[r.cat]?.[m] || "PENDIENTE";

      const inp = h("input", { type:"number", class:"cell", value:v||"", placeholder:"0" });
      on(inp, "input", e => {
        S.gl[ri].vals[i] = pn(e.target.value);
        if (!S.spGL[r.cat]) S.spGL[r.cat] = {};
        if (pn(e.target.value) > 0 && !S.spGL[r.cat][m]) S.spGL[r.cat][m] = "PENDIENTE";
        save();
      });

      const sbtn = h("button", {
        class: `badge ${v > 0 ? st.toLowerCase() : "pendiente"}`,
        style: { marginLeft:"6px", display: v > 0 ? "inline-flex":"none" }
      }, st === "PAGADO" ? "✓ Pagado" : "⏳ Pend.");
      on(sbtn, "click", () => {
        if (!S.spGL[r.cat]) S.spGL[r.cat] = {};
        S.spGL[r.cat][m] = S.spGL[r.cat]?.[m] === "PAGADO" ? "PENDIENTE" : "PAGADO";
        save(); render();
      });

      const cell = h("td", { style:{ textAlign:"right" } },
        h("div", { style:{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:"4px" } }, inp, sbtn)
      );
      if (esBrun && desc > 0) {
        cell.appendChild(h("div", { style:{ fontSize:"10px", color:"var(--pur)", marginTop:"2px" } },
          `−${fmt(desc)} = ${fmt(neto)}`));
      }
      tr.appendChild(cell);
    });

    tr.appendChild(h("td", { class:"ta-right", style:{ fontWeight:"700", color:"var(--neg)" } }, fmt(rowTotal)));
    const delBtn = h("button", { class:"btn btn-del btn-xs" }, "✕");
    on(delBtn, "click", () => {
      if (!confirm("¿Eliminar " + r.cat + "?")) return;
      S.gl.splice(ri, 1); delete S.spGL[r.cat]; save(); render();
    });
    tr.appendChild(h("td", { style:{ textAlign:"center" } }, delBtn));
    tbody.appendChild(tr);
  });

  const totalTr = h("tr", { class:"total-row" }, h("td", { colspan:"2" }, "TOTAL"));
  mr.forEach(m => {
    const i = S.months.indexOf(m);
    totalTr.appendChild(h("td", { class:"ta-right" }, fmt(S.gl.reduce((s,r) => {
      let v = r.vals[i] || 0;
      if (r.cat === "Sueldo Brunella") v = Math.max(0, v - (bd[m]||0));
      return s + v;
    }, 0))));
  });
  totalTr.appendChild(h("td", { class:"ta-right" }, fmt(S.gl.reduce((s,r) => s + mr.reduce((ss,m) => {
    let v = r.vals[S.months.indexOf(m)] || 0;
    if (r.cat === "Sueldo Brunella") v = Math.max(0, v - (bd[m]||0));
    return ss + v;
  }, 0), 0))));
  totalTr.appendChild(h("td", null, ""));
  tbody.appendChild(totalTr);

  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  mainCard.appendChild(wrap);
  d.appendChild(mainCard);
  return d;
}

// ════════════════════════════════════════════════════════════
//  INGRESOS
// ════════════════════════════════════════════════════════════
function buildIng() {
  const mr = mesesRange();
  const d  = h("div", { class:"card" });
  d.appendChild(h("div", { class:"sec-header" },
    h("div", { class:"sec-header-text" },
      h("div", { class:"sec-header-title" }, "💰 Ingresos — " + S.mes),
      h("div", { class:"sec-header-sub" }, "Los cupones acreditados se suman a Ventas Tarjeta/QR")
    )
  ));

  const wrap   = h("div", { class:"tbl-wrap" });
  const tbl    = h("table", null);
  const headTr = h("tr", null, h("th", { style:{ minWidth:"180px" } }, "Canal"));
  mr.forEach(m => headTr.appendChild(h("th", { class:"ta-right", style:{ minWidth:"120px" } }, m)));
  headTr.appendChild(h("th", { class:"ta-right", style:{ minWidth:"110px" } }, "Total"));
  tbl.appendChild(h("thead", null, headTr));

  const tbody = h("tbody", null);
  S.ing.forEach((r, ri) => {
    const isSueldo = r.canal === "Sueldo YPF";
    const tr = h("tr", null, h("td", { style:{ fontWeight:"500", color: isSueldo ? "var(--warn)":"var(--txt)" } }, r.canal));
    let rowTotal = 0;
    mr.forEach(m => {
      const i = S.months.indexOf(m);
      const v = r.vals[i] || 0;
      rowTotal += v;
      const inp = h("input", { type:"number", class:"cell", value:v||"", placeholder:"0" });
      on(inp, "input", e => { S.ing[ri].vals[i] = pn(e.target.value); save(); });
      tr.appendChild(h("td", { class:"ta-right" }, inp));
    });
    tr.appendChild(h("td", { class:"ta-right", style:{ fontWeight:"700", color:"var(--pos)" } }, fmt(rowTotal)));
    tbody.appendChild(tr);
  });

  const totalTr = h("tr", { class:"total-row" }, h("td", null, "TOTAL"));
  mr.forEach(m => {
    const i = S.months.indexOf(m);
    totalTr.appendChild(h("td", { class:"ta-right" }, fmt(S.ing.reduce((s,r) => s+(r.vals[i]||0), 0))));
  });
  totalTr.appendChild(h("td", { class:"ta-right" }, fmt(S.ing.reduce((s,r) => s+mr.reduce((ss,m) => ss+(r.vals[S.months.indexOf(m)]||0),0), 0))));
  tbody.appendChild(totalTr);
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  d.appendChild(wrap);
  return d;
}

// ════════════════════════════════════════════════════════════
//  TERMINALES
// ════════════════════════════════════════════════════════════
function buildTerm() {
  const d = h("div", null);

  // Config terminales
  const cfg = h("div", { class:"card" });
  cfg.appendChild(h("div", { class:"sec-title" }, "⚙️ Configuración de Terminales"));
  const cfgGrid = h("div", { class:"terminal-config-grid" });
  S.terminales.forEach((t, ti) => {
    const box = h("div", { class:"terminal-config-item" });
    box.appendChild(h("div", { class:"terminal-config-name" }, t.nombre));
    const inp1 = h("input", { type:"number", value:t.diasHab });
    on(inp1, "input", e => { S.terminales[ti].diasHab = pn(e.target.value); save(); });
    box.appendChild(h("div", { class:"form-row", style:{ padding:"0", background:"transparent", border:"none", margin:"0" } },
      h("div", { class:"f" },
        h("label", null, "Días hábiles hasta acreditación"),
        inp1
      )
    ));
    cfgGrid.appendChild(box);
  });
  cfg.appendChild(cfgGrid);
  d.appendChild(cfg);

  // Registrar cupón
  let nc = { termId:"", fecha:"", monto:"" };
  const frm  = h("div", { class:"card" });
  frm.appendChild(h("div", { class:"sec-title" }, "➕ Registrar Cupón"));
  const frow = h("div", { class:"form-row" });

  const selT = h("select", null, h("option", { value:"" }, "Seleccioná terminal…"),
    ...S.terminales.map(t => h("option", { value:t.id }, t.nombre)));
  on(selT, "change", e => nc.termId = e.target.value);

  const inpF = h("input", { type:"date" });
  on(inpF, "change", e => nc.fecha = e.target.value);

  const inpM = h("input", { type:"number", placeholder:"0" });
  on(inpM, "change", e => nc.monto = e.target.value);

  const btnAdd = h("button", { class:"btn btn-pri" }, "Agregar cupón");
  on(btnAdd, "click", () => {
    if (!nc.termId || !nc.fecha || !nc.monto) return;
    const ti = S.terminales.findIndex(t => t.id === parseInt(nc.termId));
    if (ti < 0) return;
    S.terminales[ti].cupones.push({
      id:Date.now(), fecha:nc.fecha, monto:pn(nc.monto),
      fechaAcred: addBusinessDays(nc.fecha, S.terminales[ti].diasHab),
      contabilizado: false
    });
    save(); render();
  });

  frow.appendChild(h("div", { class:"f" }, h("label", null, "Terminal"), selT));
  frow.appendChild(h("div", { class:"f" }, h("label", null, "Fecha del cupón"), inpF));
  frow.appendChild(h("div", { class:"f" }, h("label", null, "Monto neto (comisión ya descontada)"), inpM));
  frow.appendChild(h("div", { class:"f", style:{ justifyContent:"flex-end" } }, h("label", null, " "), btnAdd));
  frm.appendChild(frow);
  d.appendChild(frm);

  // Cupones por terminal
  S.terminales.forEach((t, ti) => {
    const c = h("div", { class:"card" });
    c.appendChild(h("div", { class:"sec-header" },
      h("div", { class:"sec-header-text" },
        h("div", { class:"sec-header-title" }, "💳 " + t.nombre),
        h("div", { class:"sec-header-sub" }, t.diasHab + " días hábiles para acreditación")
      )
    ));

    if (t.cupones.length === 0) {
      c.appendChild(h("div", { class:"empty-state" },
        h("div", { class:"empty-state-icon" }, "📋"),
        h("div", { class:"empty-state-text" }, "Sin cupones registrados para esta terminal")
      ));
    } else {
      const hoy  = new Date().toISOString().split("T")[0];
      const wrap = h("div", { class:"tbl-wrap" });
      const tbl  = h("table", null, h("thead", null, h("tr", null,
        h("th", null, "Fecha cupón"),
        h("th", null, "Monto"),
        h("th", null, "Acreditación"),
        h("th", null, "Estado"),
        h("th", null, "Acción"),
        h("th", { style:{ width:"40px" } }, "")
      )));
      const tbody2 = h("tbody", null);

      t.cupones.forEach((cup, ci) => {
        const acred       = cup.fechaAcred <= hoy;
        const estadoLbl   = cup.contabilizado ? "Contabilizado" : acred ? "Acreditado" : "Pendiente";
        const estadoColor = cup.contabilizado ? "var(--txt-2)" : acred ? "var(--pos)" : "var(--warn)";

        const tr = h("tr", null,
          h("td", null, cup.fecha),
          h("td", { style:{ fontWeight:"700" } }, fmt(cup.monto)),
          h("td", { style:{ color: acred ? "var(--pos)":"var(--txt-2)" } }, cup.fechaAcred),
          h("td", null, h("span", { style:{ color:estadoColor, fontWeight:"600", fontSize:"12px" } }, estadoLbl)),
          h("td", null, (() => {
            if (!acred) return h("span", { style:{ color:"var(--txt-4)", fontSize:"11px" } }, "—");
            if (cup.contabilizado) return h("span", { class:"acred-badge" }, "✓ En ingresos");
            const btn = h("button", { class:"btn btn-warn btn-sm" }, "Sumar a Ingresos");
            on(btn, "click", () => {
              const mesAcred = S.months.find(m => {
                const d2 = new Date(cup.fechaAcred + "T12:00:00");
                return m === MONTH_NAMES[d2.getMonth()] + "-" + String(d2.getFullYear()).slice(2);
              }) || S.mes;
              const ingIdx = S.ing.findIndex(r => r.canal === "Ventas Tarjeta/QR");
              if (ingIdx >= 0) {
                const mi = S.months.indexOf(mesAcred);
                if (mi >= 0) S.ing[ingIdx].vals[mi] = (S.ing[ingIdx].vals[mi] || 0) + cup.monto;
              }
              S.terminales[ti].cupones[ci].contabilizado = true;
              save(); render();
            });
            return btn;
          })()),
          h("td", { style:{ textAlign:"center" } }, (() => {
            const btn = h("button", { class:"btn btn-del btn-xs" }, "✕");
            on(btn, "click", () => { S.terminales[ti].cupones.splice(ci, 1); save(); render(); });
            return btn;
          })())
        );
        tbody2.appendChild(tr);
      });

      const totM = t.cupones.reduce((s,c) => s+c.monto, 0);
      const totP = t.cupones.filter(c => c.fechaAcred > hoy).reduce((s,c) => s+c.monto, 0);
      tbody2.appendChild(h("tr", { class:"total-row" },
        h("td", null, "TOTAL"),
        h("td", null, fmt(totM)),
        h("td", null, ""),
        h("td", null, ""),
        h("td", null, h("span", { class:"pur", style:{ fontSize:"11px", fontWeight:"600" } }, "Pend: " + fmt(totP))),
        h("td", null, "")
      ));
      tbl.appendChild(tbody2);
      wrap.appendChild(tbl);
      c.appendChild(wrap);
    }
    d.appendChild(c);
  });
  return d;
}

// ════════════════════════════════════════════════════════════
//  ECHEQUES
// ════════════════════════════════════════════════════════════
function buildEcheques() {
  const now      = new Date();
  const withDias = S.echeques
    .map(e => ({ ...e, dias: Math.ceil((new Date(e.fechaPago) - now) / 864e5) }))
    .sort((a,b) => a.dias - b.dias);

  let ne = { fechaEmision:"", fechaPago:"", monto:"", proveedor:"" };
  const d = h("div", { class:"card" });

  d.appendChild(h("div", { class:"sec-header" },
    h("div", { class:"sec-header-text" },
      h("div", { class:"sec-header-title" }, "📄 eCheques"),
      h("div", { class:"sec-header-sub" }, "Todos los campos son editables directamente en la tabla")
    )
  ));

  // Formulario
  const frow = h("div", { class:"form-row" });
  const mkF  = (lbl, type, ph, key) => {
    const inp = h("input", { type, placeholder:ph||"" });
    on(inp, "input", e => ne[key] = e.target.value);
    return h("div", { class:"f" }, h("label", null, lbl), inp);
  };
  frow.appendChild(mkF("Fecha emisión", "date", "", "fechaEmision"));
  frow.appendChild(mkF("Fecha de pago", "date", "", "fechaPago"));
  frow.appendChild(mkF("Monto", "number", "0", "monto"));
  frow.appendChild(mkF("Proveedor", "text", "Nombre del proveedor", "proveedor"));
  const btnAdd = h("button", { class:"btn btn-pri" }, "Agregar eCheque");
  on(btnAdd, "click", () => {
    if (!ne.fechaPago || !ne.monto || !ne.proveedor) return;
    S.echeques.push({ ...ne, id:Date.now(), monto:pn(ne.monto) });
    save(); render();
  });
  frow.appendChild(h("div", { class:"f", style:{ justifyContent:"flex-end" } }, h("label", null, " "), btnAdd));
  d.appendChild(frow);

  // Leyenda semáforo
  d.appendChild(h("div", { style:{ display:"flex", gap:"16px", fontSize:"11px", flexWrap:"wrap", marginBottom:"var(--sp-4)", color:"var(--txt-2)" } },
    h("span", null, h("span", { style:{ color:"var(--pos)" } }, "● "), ">15 días"),
    h("span", null, h("span", { style:{ color:"var(--warn)"} }, "● "), "8–15 días"),
    h("span", null, h("span", { style:{ color:"var(--ora)" } }, "● "), "1–7 días"),
    h("span", null, h("span", { style:{ color:"var(--neg)" } }, "● "), "Vencido")
  ));

  if (withDias.length === 0) {
    d.appendChild(h("div", { class:"empty-state" },
      h("div", { class:"empty-state-icon" }, "📄"),
      h("div", { class:"empty-state-text" }, "No hay eCheques registrados")
    ));
  } else {
    const wrap = h("div", { class:"tbl-wrap" });
    const tbl  = h("table", null, h("thead", null, h("tr", null,
      h("th", null, "Proveedor"),
      h("th", null, "F. Emisión"),
      h("th", null, "F. Pago"),
      h("th", null, "Monto"),
      h("th", null, "Estado"),
      h("th", { style:{ width:"40px" } }, "")
    )));
    const tbody = h("tbody", null);

    withDias.forEach(e => {
      const lbl     = e.dias < 0 ? "VENCIDO" : e.dias === 0 ? "HOY" : e.dias + " días";
      const origIdx = S.echeques.findIndex(x => x.id === e.id);

      const mkEdit = (type, val, key, w, fw) => {
        const inp = h("input", { type, value:val||"", style:{
          background:"transparent", border:"1px solid transparent",
          color:"var(--txt)", fontWeight:fw||"400",
          padding:"3px 6px", width:w||"110px",
          borderRadius:"var(--rad-sm)", fontSize:"12px", fontFamily:"inherit"
        }});
        on(inp, "focus", ei => { ei.target.style.background = "var(--bg-raised)"; ei.target.style.borderColor = "var(--brd-focus)"; });
        on(inp, "blur",  ei => {
          ei.target.style.background   = "transparent";
          ei.target.style.borderColor  = "transparent";
          S.echeques[origIdx][key] = type === "number" ? pn(ei.target.value) : ei.target.value;
          save();
          if (key === "fechaPago") render();
        });
        return inp;
      };

      const tr = h("tr", { class: chequeClass(e.dias) },
        h("td", null, mkEdit("text",   e.proveedor,    "proveedor",    "140px","600")),
        h("td", null, mkEdit("date",   e.fechaEmision, "fechaEmision", "130px")),
        h("td", null, mkEdit("date",   e.fechaPago,    "fechaPago",    "130px")),
        h("td", null, mkEdit("number", e.monto,        "monto",        "100px","700")),
        h("td", null, h("span", { style:{ color:diasColor(e.dias), fontWeight:"700", fontSize:"12px" } }, lbl)),
        h("td", { style:{ textAlign:"center" } }, (() => {
          const btn = h("button", { class:"btn btn-del btn-xs" }, "✕");
          on(btn, "click", () => { S.echeques = S.echeques.filter(x => x.id !== e.id); save(); render(); });
          return btn;
        })())
      );
      tbody.appendChild(tr);
    });

    const tot = S.echeques.reduce((s,e) => s + pn(e.monto), 0);
    tbody.appendChild(h("tr", { class:"total-row" },
      h("td", { colspan:"3" }, "TOTAL"),
      h("td", null, fmt(tot)),
      h("td", null, ""),
      h("td", null, "")
    ));
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    d.appendChild(wrap);
  }
  return d;
}

// ════════════════════════════════════════════════════════════
//  BRUNELLA
// ════════════════════════════════════════════════════════════
function buildBrunella() {
  const bd        = brunellaDesc();
  const totalDesc = S.brunella.reduce((s,b) => s + pn(b.precio)*0.8*pn(b.cantidad), 0);
  const totalReal = S.brunella.reduce((s,b) => s + pn(b.precio)*pn(b.cantidad), 0);

  let nb = { fecha:"", mes:"", articulo:"", cantidad:"", precio:"" };
  const d = h("div", { class:"card" });

  d.appendChild(h("div", { class:"sec-header" },
    h("div", { class:"sec-header-text" },
      h("div", { class:"sec-header-title" }, "👗 Descuentos Brunella"),
      h("div", { class:"sec-header-sub" }, "20% de descuento empleado · Se descuenta automáticamente del Sueldo Brunella en Gastos Local")
    )
  ));

  // Info box
  d.appendChild(h("div", { class:"info-box" },
    h("div", { class:"info-box-title" }, "Resumen de descuentos"),
    h("div", { class:"info-stats" },
      h("div", null,
        h("div", { class:"info-stat-lbl" }, "Precio real total"),
        h("div", { class:"info-stat-val", style:{ color:"var(--txt)" } }, fmt(totalReal))
      ),
      h("div", null,
        h("div", { class:"info-stat-lbl" }, "Descuento 20%"),
        h("div", { class:"info-stat-val neg" }, "−" + fmt(totalReal - totalDesc))
      ),
      h("div", null,
        h("div", { class:"info-stat-lbl" }, "A descontar del sueldo"),
        h("div", { class:"info-stat-val pur" }, fmt(totalDesc))
      )
    )
  ));

  // Formulario
  const frow = h("div", { class:"form-row" });
  const mkF  = (lbl, type, ph, key) => {
    const inp = h("input", { type, placeholder:ph||"" });
    on(inp, "input", e => nb[key] = e.target.value);
    return h("div", { class:"f" }, h("label", null, lbl), inp);
  };
  frow.appendChild(mkF("Fecha", "date", "", "fecha"));

  const selMes2 = h("select", null, h("option", { value:"" }, "Mes…"),
    ...S.months.map(m => h("option", { value:m }, m)));
  on(selMes2, "change", e => nb.mes = e.target.value);
  frow.appendChild(h("div", { class:"f" }, h("label", null, "Mes"), selMes2));

  frow.appendChild(mkF("Artículo",    "text",   "Descripción del artículo", "articulo"));
  frow.appendChild(mkF("Cantidad",    "number", "1",  "cantidad"));
  frow.appendChild(mkF("Precio real", "number", "0",  "precio"));

  const btnAdd = h("button", { class:"btn btn-pri" }, "Agregar artículo");
  on(btnAdd, "click", () => {
    if (!nb.articulo || !nb.mes || !nb.cantidad || !nb.precio) return;
    S.brunella.push({ ...nb, id:Date.now() });
    save(); render();
  });
  frow.appendChild(h("div", { class:"f", style:{ justifyContent:"flex-end" } }, h("label", null, " "), btnAdd));
  d.appendChild(frow);

  // Chips por mes
  if (Object.keys(bd).length > 0) {
    d.appendChild(h("div", { style:{ marginBottom:"var(--sp-4)" } },
      h("span", { style:{ fontSize:"11px", color:"var(--txt-2)", marginRight:"var(--sp-2)" } }, "Descuento neto por mes:"),
      ...Object.entries(bd).map(([m,v]) => h("span", { class:"chip" }, `${m}: ${fmt(v)}`))
    ));
  }

  if (S.brunella.length === 0) {
    d.appendChild(h("div", { class:"empty-state" },
      h("div", { class:"empty-state-icon" }, "👗"),
      h("div", { class:"empty-state-text" }, "Sin artículos registrados")
    ));
  } else {
    const wrap = h("div", { class:"tbl-wrap" });
    const tbl  = h("table", null, h("thead", null, h("tr", null,
      h("th", null, "Fecha"),
      h("th", null, "Mes"),
      h("th", null, "Artículo"),
      h("th", null, "Cant."),
      h("th", { class:"ta-right" }, "Precio real"),
      h("th", { class:"ta-right" }, "Precio c/20%"),
      h("th", { class:"ta-right" }, "Subtotal desc."),
      h("th", { style:{ width:"40px" } }, "")
    )));
    const tbody = h("tbody", null);

    S.brunella.forEach(b => {
      const precioReal = pn(b.precio);
      const precioDesc = precioReal * 0.8;
      const sub        = precioDesc * pn(b.cantidad);

      const tr = h("tr", null,
        h("td", { style:{ color:"var(--txt-2)", fontSize:"12px" } }, b.fecha || "—"),
        h("td", null, h("span", { class:"chip" }, b.mes)),
        h("td", { style:{ fontWeight:"500" } }, b.articulo),
        h("td", { style:{ color:"var(--txt-2)" } }, b.cantidad),
        h("td", { class:"ta-right", style:{ color:"var(--txt-2)" } }, fmt(precioReal)),
        h("td", { class:"ta-right pos" }, fmt(precioDesc)),
        h("td", { class:"ta-right", style:{ fontWeight:"700", color:"var(--pur)" } }, fmt(sub)),
        h("td", { style:{ textAlign:"center" } }, (() => {
          const btn = h("button", { class:"btn btn-del btn-xs" }, "✕");
          on(btn, "click", () => { S.brunella = S.brunella.filter(x => x.id !== b.id); save(); render(); });
          return btn;
        })())
      );
      tbody.appendChild(tr);
    });

    tbody.appendChild(h("tr", { class:"total-row" },
      h("td", { colspan:"4" }, "TOTAL"),
      h("td", { class:"ta-right" }, fmt(totalReal)),
      h("td", { class:"ta-right" }, fmt(totalReal * 0.8)),
      h("td", { class:"ta-right" }, fmt(totalDesc)),
      h("td", null, "")
    ));
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    d.appendChild(wrap);
  }
  return d;
}
