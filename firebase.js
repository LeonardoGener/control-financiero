/* ============================================================
   firebase.js v6 — Auth + Persistencia 3 capas + Sync real-time
   
   FIXES v6:
   - Listener en tiempo real (onValue) reemplaza once() → 
     los cambios desde celular llegan a PC automáticamente
   - FIREBASE_OK se activa apenas hay usuario, no espera al load
   - save() reintenta subir si el primer intento falló
   - sanitizeKey() cubre todos los caracteres inválidos de Firebase
   - Mobile: persiste sesión entre recargas con setPersistence
   ============================================================ */
"use strict";

const LS_KEY  = "CF_DATA_V2";
const LS_BAK  = "CF_DATA_V2_BAK";
const LS_META = "CF_META_V2";

const firebaseConfig = {
  apiKey:            "AIzaSyC-eLP28-62ODX1L-TdTtryH-4nKk68_Ek",
  authDomain:        "controlfinanciero-25850.firebaseapp.com",
  databaseURL:       "https://controlfinanciero-25850-default-rtdb.firebaseio.com",
  projectId:         "controlfinanciero-25850",
  storageBucket:     "controlfinanciero-25850.appspot.com",
  messagingSenderId: "129646287870",
  appId:             "1:129646287870:web:a3ecea47779fcd8f7ebeaf"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// Persistir sesión en el dispositivo (crucial para mobile)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

let usuarioActual = null;
let SYNC_STATUS   = "local";
let SAVE_TIMER    = null;
let FIREBASE_OK   = false;
let DB_LISTENER   = null;   // referencia al listener en tiempo real
let PENDING_SAVE  = false;  // hay datos locales pendientes de subir

// Rate limiting login
const LOGIN_MAX_ATTEMPTS = 3;
const LOGIN_LOCKOUT_MS   = 60000;
let loginAttempts = 0;
let loginLockedAt = null;

// ================================================================
//  SANITIZACIÓN para Firebase (keys no pueden tener . # $ / [ ])
// ================================================================
function sanitizeKey(k) {
  return String(k).replace(/[.#$/\[\]]/g, "_");
}

function sanitizeForFirebase(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object")           return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirebase);
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || k === "" || k.startsWith("_")) continue;
    clean[sanitizeKey(k)] = sanitizeForFirebase(v);
  }
  return clean;
}

// ================================================================
//  CAPA 1: localStorage
// ================================================================
function saveLocal(data) {
  try {
    const prev = localStorage.getItem(LS_KEY);
    if (prev) localStorage.setItem(LS_BAK, prev);
    localStorage.setItem(LS_KEY, JSON.stringify({
      version: 4, timestamp: Date.now(), data
    }));
    localStorage.setItem(LS_META, JSON.stringify({ lastSave: Date.now() }));
    return true;
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      try { localStorage.removeItem(LS_BAK); } catch(_) {}
      try { localStorage.setItem(LS_KEY, JSON.stringify({ version:4, timestamp:Date.now(), data })); return true; }
      catch(_) { return false; }
    }
    return false;
  }
}

function loadLocal() {
  const tryParse = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return (p && typeof p.data === "object") ? p.data : null;
    } catch (e) {
      try { localStorage.removeItem(key); } catch(_) {}
      return null;
    }
  };
  return tryParse(LS_KEY) || tryParse(LS_BAK);
}

// ================================================================
//  CAPA 2: Firebase — guardar
// ================================================================
async function saveToCloud(data) {
  if (!usuarioActual) { PENDING_SAVE = true; return; }
  SYNC_STATUS = "syncing";
  updateSyncDot();
  try {
    const safe = sanitizeForFirebase(data);
    safe._savedAt = Date.now();
    await db.ref("users/" + usuarioActual.uid + "/data").set(safe);
    SYNC_STATUS  = "ok";
    PENDING_SAVE = false;
    FIREBASE_OK  = true;
  } catch (e) {
    console.error("CF Firebase save:", e.code || e.message);
    SYNC_STATUS  = "err";
    PENDING_SAVE = true;
    // Reintentar en 5 segundos
    setTimeout(() => {
      if (usuarioActual) saveToCloud(S);
    }, 5000);
  }
  updateSyncDot();
}

// ================================================================
//  CAPA 2: Firebase — escuchar en tiempo real (FIX PRINCIPAL)
//  onValue() en lugar de once() → cualquier cambio desde otro
//  dispositivo llega automáticamente sin recargar
// ================================================================
function startRealtimeListener() {
  if (!usuarioActual) return;

  // Cancelar listener anterior si existe
  if (DB_LISTENER) {
    db.ref("users/" + usuarioActual.uid + "/data").off("value", DB_LISTENER);
    DB_LISTENER = null;
  }

  const ref = db.ref("users/" + usuarioActual.uid + "/data");

  DB_LISTENER = ref.on("value", (snap) => {
    const cloudData = snap.val();
    FIREBASE_OK = true;

    if (!cloudData) {
      // Sin datos en Firebase → subir estado local
      saveToCloud(S);
      return;
    }

    const localMeta = (() => {
      try { return JSON.parse(localStorage.getItem(LS_META) || "{}"); }
      catch(_) { return {}; }
    })();

    const localTs = localMeta.lastSave || 0;
    const cloudTs = cloudData._savedAt || 0;

    if (localTs > cloudTs + 2000) {
      // Local es más de 2s más reciente → subir (evita loops)
      saveToCloud(S);
    } else if (cloudTs > localTs) {
      // Cloud es más reciente → aplicar sin triggear otro save
      applyData(cloudData);
      migrateState();   // asegura campos nuevos sin perder datos
      saveLocal(S);
      render();
    }
    // Si son iguales → no hacer nada
  }, (error) => {
    console.error("CF listener error:", error);
    FIREBASE_OK = false;
    SYNC_STATUS  = "err";
    updateSyncDot();
  });
}

function stopRealtimeListener() {
  if (DB_LISTENER && usuarioActual) {
    db.ref("users/" + usuarioActual.uid + "/data").off("value", DB_LISTENER);
    DB_LISTENER = null;
  }
}

// ================================================================
//  save() — guarda local siempre + sube a Firebase si hay sesión
// ================================================================
function save() {
  saveLocal(S);
  updateSyncDot();

  if (usuarioActual) {
    // Cancelar debounce anterior
    if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
    // Subir después de 1.5s de inactividad
    SAVE_TIMER = setTimeout(() => saveToCloud(S), 1500);
  } else {
    // Sin sesión → marcar como pendiente para subir cuando conecte
    PENDING_SAVE = true;
  }
}

// ================================================================
//  INDICADOR VISUAL
// ================================================================
function updateSyncDot() {
  const dot = document.getElementById("sync-dot");
  const lbl = document.getElementById("sync-lbl");
  if (!dot || !lbl) return;
  const cfg = {
    local:   { cls: "",         txt: "Local ✓",    color: "var(--pos)"  },
    syncing: { cls: " syncing", txt: "Guardando…", color: "var(--warn)" },
    ok:      { cls: "",         txt: "Guardado ✓",  color: "var(--pos)"  },
    err:     { cls: " err",     txt: "Solo local",  color: "var(--warn)" },
  };
  const c = cfg[SYNC_STATUS] || cfg.local;
  dot.className   = "sync-dot" + c.cls;
  lbl.textContent = c.txt;
  lbl.style.color = c.color;
}

// ================================================================
//  OBSERVER DE AUTENTICACIÓN
// ================================================================
auth.onAuthStateChanged(async (user) => {
  const sub = document.getElementById("loading-sub");
  if (sub) sub.textContent = user ? "Sincronizando…" : "Cargando datos locales…";

  document.getElementById("loading").style.display = "none";

  if (user) {
    usuarioActual = user;
    loginAttempts = 0;
    FIREBASE_OK   = true;

    document.getElementById("loginForm").style.display = "none";
    document.getElementById("app").style.display       = "block";

    // Iniciar listener en tiempo real
    startRealtimeListener();

    // Si había datos pendientes de subir (ej: guardados sin sesión)
    if (PENDING_SAVE) {
      await saveToCloud(S);
    }

    render();

  } else {
    // Detener listener
    stopRealtimeListener();

    usuarioActual = null;
    FIREBASE_OK   = false;
    SYNC_STATUS   = "local";

    const localData = loadLocal();
    if (localData) {
      document.getElementById("loginForm").style.display = "none";
      document.getElementById("app").style.display       = "block";
      applyData(localData);
      migrateState();   // asegura campos nuevos sin perder datos
      render();
      updateSyncDot();
    } else {
      document.getElementById("loginForm").style.display = "block";
      document.getElementById("app").style.display       = "none";
    }
  }
});

// ================================================================
//  LOGIN con rate limiting
// ================================================================
function login() {
  const errEl = document.getElementById("loginError");

  if (loginLockedAt) {
    const elapsed = Date.now() - loginLockedAt;
    if (elapsed < LOGIN_LOCKOUT_MS) {
      errEl.textContent = "Demasiados intentos. Esperá " + Math.ceil((LOGIN_LOCKOUT_MS - elapsed) / 1000) + "s.";
      return;
    }
    loginLockedAt = null; loginAttempts = 0;
  }

  const emailEl = document.getElementById("email");
  const passEl  = document.getElementById("password");
  if (!emailEl || !passEl) return;

  const email = emailEl.value.trim();
  const pass  = passEl.value;

  if (!email || !pass)                              { errEl.textContent = "Completá todos los campos"; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   { errEl.textContent = "Ingresá un email válido"; return; }

  errEl.textContent = "Ingresando…";
  errEl.style.color = "var(--warn)";

  const btn = document.getElementById("btnLogin");
  if (btn) { btn.disabled = true; btn.textContent = "Ingresando…"; }

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      errEl.textContent = "";
      loginAttempts = 0;
      if (btn) { btn.disabled = false; btn.textContent = "Ingresar"; }
      if (passEl) passEl.value = "";
    })
    .catch(() => {
      loginAttempts++;
      if (btn) { btn.disabled = false; btn.textContent = "Ingresar"; }
      if (loginAttempts >= LOGIN_MAX_ATTEMPTS) {
        loginLockedAt = Date.now();
        errEl.textContent = "Demasiados intentos. Esperá 60 segundos.";
      } else {
        errEl.textContent = "Credenciales incorrectas";
      }
      errEl.style.color = "var(--neg)";
    });
}

// ================================================================
//  LOGOUT
// ================================================================
function logout() {
  if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
  saveLocal(S);
  stopRealtimeListener();
  usuarioActual = null;
  FIREBASE_OK   = false;
  auth.signOut();
}

// ── Eventos de teclado y DOM ──────────────────────────────
document.addEventListener("keydown", (e) => {
  const loginEl = document.getElementById("loginForm");
  if (e.key === "Enter" && loginEl && loginEl.style.display !== "none") login();
});
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnLogin");
  if (btn) btn.addEventListener("click", login);
});

// ── Guardar al cerrar/ocultar ─────────────────────────────
function flushAndSave() {
  if (document.activeElement && document.activeElement !== document.body) {
    try { document.activeElement.blur(); } catch(_) {}
  }
  if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
  saveLocal(S);
  // Intentar subir sincrónicamente si hay sesión
  if (usuarioActual && FIREBASE_OK) saveToCloud(S);
}
window.addEventListener("beforeunload",    flushAndSave);
window.addEventListener("pagehide",        flushAndSave);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushAndSave();
});

// ── Autosave cada 60s ────────────────────────────────────
setInterval(() => {
  saveLocal(S);
  if (usuarioActual && FIREBASE_OK) saveToCloud(S);
}, 60000);


// ================================================================
//  MIGRACIÓN DE ESTADO — agrega campos nuevos sin borrar datos
// ================================================================
function migrateState() {
  let changed = false;

  // Asignar tipo "venta" a canales sin tipo
  S.ing.forEach(r => { if (!r.tipo) { r.tipo = "venta"; changed = true; } });

  // Agregar cuentas si no existen
  const CUENTAS = ["MP Leo","MP Carla","BBVA Carla","BPN Carla"];
  CUENTAS.forEach(nombre => {
    if (!S.ing.find(r => r.canal === nombre)) {
      S.ing.push({ canal:nombre, tipo:"cuenta", vals:Array(S.months.length).fill(0) });
      changed = true;
    }
  });

  // Si hubo cambios, guardar para que Firebase se actualice
  if (changed) saveLocal(S);
}

// ================================================================
//  BOOT — carga local antes de que Firebase responda
// ================================================================
(function boot() {
  const sub = document.getElementById("loading-sub");
  if (sub) sub.textContent = "Cargando datos…";
  const localData = loadLocal();
  if (localData) applyData(localData);
})();
