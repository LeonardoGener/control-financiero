/* ============================================================
   firebase.js — Auth + Persistencia 3 capas + Seguridad
   
   ARQUITECTURA:
   1. localStorage PRIMARIO  → guarda siempre, sin login
   2. localStorage BACKUP    → copia rotativa anti-corrupción
   3. Firebase Realtime DB   → sync cloud (requiere login)

   SEGURIDAD:
   - Rate limiting en login (3 intentos, bloqueo 60s)
   - sanitizeForFirebase() elimina undefined antes de .set()
   - No expone UID ni datos sensibles en consola en producción
   - Tokens de sesión se limpian al hacer logout
   ============================================================ */
"use strict";

// ── Claves de almacenamiento ──────────────────────────────
const LS_KEY  = "CF_DATA_V2";
const LS_BAK  = "CF_DATA_V2_BAK";
const LS_META = "CF_META_V2";

// ── Firebase config ───────────────────────────────────────
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

// ── Estado de sesión ──────────────────────────────────────
let usuarioActual = null;
let SYNC_STATUS   = "local";
let SAVE_TIMER    = null;
let FIREBASE_OK   = false;

// ── Rate limiting para login ──────────────────────────────
const LOGIN_MAX_ATTEMPTS = 3;
const LOGIN_LOCKOUT_MS   = 60 * 1000; // 60 segundos
let loginAttempts  = 0;
let loginLockedAt  = null;

// ================================================================
//  SEGURIDAD: sanitizar objeto antes de enviar a Firebase
//  Firebase Realtime DB rechaza:
//  - valores undefined
//  - keys con . # $ / [ ]
//  - keys vacíos
// ================================================================

// Convierte un key de categoría a un key válido para Firebase
// Ej: "Otros Pers." → "Otros_Pers_"
//     "Galicia — Total Mensual" → "Galicia___Total_Mensual"
function sanitizeKey(k) {
  return String(k)
    .replace(/\./g,  "_")   // punto → guión bajo
    .replace(/#/g,   "_")   // hash
    .replace(/\$/g,  "_")   // dólar
    .replace(/\//g,  "_")   // barra
    .replace(/\[/g,  "_")   // corchete abre
    .replace(/\]/g,  "_");  // corchete cierra
}

function sanitizeForFirebase(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object")           return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirebase(item));
  }
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;     // omitir undefined
    if (k.startsWith("_")) continue;   // omitir campos internos
    if (k === "") continue;            // omitir keys vacíos
    const safeKey = sanitizeKey(k);
    clean[safeKey] = sanitizeForFirebase(v);
  }
  return clean;
}

// ================================================================
//  CAPA 1: localStorage robusto
// ================================================================
function saveLocal(data) {
  try {
    const payload = JSON.stringify({
      version:   4,
      timestamp: Date.now(),
      data:      data
    });
    // Rotar backup antes de pisar
    const prev = localStorage.getItem(LS_KEY);
    if (prev) localStorage.setItem(LS_BAK, prev);
    localStorage.setItem(LS_KEY, payload);
    localStorage.setItem(LS_META, JSON.stringify({ lastSave: Date.now() }));
    return true;
  } catch (e) {
    // Puede fallar si localStorage está lleno (QuotaExceededError)
    console.error("CF: error guardando localStorage:", e.name);
    if (e.name === "QuotaExceededError") {
      // Intentar liberar espacio eliminando el backup
      try { localStorage.removeItem(LS_BAK); } catch (_) {}
      // Reintentar
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ version:4, timestamp:Date.now(), data }));
        return true;
      } catch (_) { return false; }
    }
    return false;
  }
}

function loadLocal() {
  const tryParse = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.data !== "object") return null;
      return parsed.data;
    } catch (e) {
      console.warn("CF: datos corruptos en", key, "— descartando");
      try { localStorage.removeItem(key); } catch (_) {}
      return null;
    }
  };
  return tryParse(LS_KEY) || tryParse(LS_BAK);
}

// ================================================================
//  CAPA 2: Firebase
// ================================================================
async function saveToCloud(data) {
  if (!usuarioActual || !FIREBASE_OK) return;
  SYNC_STATUS = "syncing";
  updateSyncDot();
  try {
    // BUG FIX: sanitizar antes de enviar a Firebase
    const safe = sanitizeForFirebase(data);
    await db.ref("users/" + usuarioActual.uid + "/data").set(safe);
    SYNC_STATUS = "ok";
  } catch (e) {
    console.error("CF: error Firebase save:", e.code || e.message);
    SYNC_STATUS = "err";
    // Reintentar una vez tras 3 segundos
    setTimeout(() => {
      if (usuarioActual && FIREBASE_OK) saveToCloud(S);
    }, 3000);
  }
  updateSyncDot();
}

async function loadFromCloud() {
  if (!usuarioActual) return;
  SYNC_STATUS = "syncing";
  updateSyncDot();
  try {
    const snap      = await db.ref("users/" + usuarioActual.uid + "/data").once("value");
    const cloudData = snap.val();
    FIREBASE_OK = true;

    if (cloudData) {
      const localMeta = (() => {
        try { return JSON.parse(localStorage.getItem(LS_META) || "{}"); }
        catch(_) { return {}; }
      })();
      const localTs = localMeta.lastSave || 0;
      const cloudTs = cloudData._savedAt || 0;

      if (localTs > cloudTs) {
        // Local más reciente → subir
        await saveToCloud({ ...sanitizeForFirebase(S), _savedAt: Date.now() });
      } else {
        // Cloud más reciente → aplicar
        applyData(cloudData);
        saveLocal(S);
        render();
      }
    } else {
      // Primera vez en Firebase
      await saveToCloud({ ...sanitizeForFirebase(S), _savedAt: Date.now() });
    }
    SYNC_STATUS = "ok";
  } catch (e) {
    console.error("CF: error Firebase load:", e.code || e.message);
    FIREBASE_OK = false;
    SYNC_STATUS  = "local";
  }
  updateSyncDot();
}

// ================================================================
//  save() — guarda siempre, sin condiciones
// ================================================================
function save() {
  saveLocal(S);
  updateSyncDot();
  if (usuarioActual && FIREBASE_OK) {
    if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
    SAVE_TIMER = setTimeout(() => saveToCloud(S), 1500);
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
    local:   { cls: "",         txt: "Local ✓",     color: "var(--pos)"  },
    syncing: { cls: " syncing", txt: "Guardando…",  color: "var(--warn)" },
    ok:      { cls: "",         txt: "Guardado ✓",   color: "var(--pos)"  },
    err:     { cls: " err",     txt: "Solo local",   color: "var(--warn)" },
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
  const loadingSub = document.getElementById("loading-sub");
  if (loadingSub) loadingSub.textContent = user ? "Sincronizando datos…" : "Cargando datos locales…";

  document.getElementById("loading").style.display = "none";

  if (user) {
    usuarioActual = user;
    loginAttempts = 0; // reset contador al loguearse exitosamente

    document.getElementById("loginForm").style.display = "none";
    document.getElementById("app").style.display       = "block";

    await loadFromCloud();
    render();
  } else {
    usuarioActual = null;
    FIREBASE_OK   = false;
    SYNC_STATUS   = "local";

    const localData = loadLocal();
    if (localData) {
      document.getElementById("loginForm").style.display = "none";
      document.getElementById("app").style.display       = "block";
      applyData(localData);
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

  // Verificar bloqueo por intentos fallidos
  if (loginLockedAt) {
    const elapsed = Date.now() - loginLockedAt;
    if (elapsed < LOGIN_LOCKOUT_MS) {
      const restantes = Math.ceil((LOGIN_LOCKOUT_MS - elapsed) / 1000);
      errEl.textContent = `Demasiados intentos. Esperá ${restantes}s.`;
      return;
    } else {
      loginLockedAt  = null;
      loginAttempts  = 0;
    }
  }

  // BUG FIX: obtener valores DENTRO de la función, no en el scope superior
  const emailEl = document.getElementById("email");
  const passEl  = document.getElementById("password");
  if (!emailEl || !passEl) return;

  const email = emailEl.value.trim();
  const pass  = passEl.value;

  if (!email || !pass) {
    errEl.textContent = "Completá todos los campos";
    return;
  }

  // Validación básica de formato email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = "Ingresá un email válido";
    return;
  }

  errEl.textContent = "Ingresando…";
  errEl.style.color = "var(--warn)";

  // Deshabilitar botón durante el intento
  const btn = document.getElementById("btnLogin");
  if (btn) { btn.disabled = true; btn.textContent = "Ingresando…"; }

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      errEl.textContent = "";
      loginAttempts = 0;
      if (btn) { btn.disabled = false; btn.textContent = "Ingresar"; }
      // Limpiar el campo de contraseña por seguridad
      if (passEl) passEl.value = "";
    })
    .catch((e) => {
      loginAttempts++;
      if (btn) { btn.disabled = false; btn.textContent = "Ingresar"; }

      if (loginAttempts >= LOGIN_MAX_ATTEMPTS) {
        loginLockedAt = Date.now();
        errEl.textContent = `Demasiados intentos. Esperá 60 segundos.`;
      } else {
        // No revelar si es email o contraseña incorrecto (seguridad)
        errEl.textContent = "Credenciales incorrectas";
      }
      errEl.style.color = "var(--neg)";
    });
}

// ================================================================
//  LOGOUT seguro
// ================================================================
function logout() {
  // Guardar estado antes de cerrar sesión
  if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
  saveLocal(S);
  // Limpiar estado de sesión
  usuarioActual = null;
  FIREBASE_OK   = false;
  auth.signOut();
}

// ── Enter en login ────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  const loginEl = document.getElementById("loginForm");
  if (e.key === "Enter" && loginEl && loginEl.style.display !== "none") login();
});

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnLogin");
  if (btn) btn.addEventListener("click", login);
});

// ── Guardar al cerrar/recargar (flush de inputs activos) ──
function flushAndSave() {
  // Forzar blur del elemento activo para capturar su valor
  if (document.activeElement && document.activeElement !== document.body) {
    try { document.activeElement.blur(); } catch(_) {}
  }
  if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
  saveLocal(S);
}
window.addEventListener("beforeunload", flushAndSave);
window.addEventListener("pagehide",     flushAndSave);

// ── Autosave periódico (red de seguridad) ────────────────
setInterval(() => { saveLocal(S); }, 60000);

// ── Visibilidad: guardar al ocultar la pestaña ───────────
document.addEventListener("visibilitychange", () => {
  if (document.hidden) saveLocal(S);
});

// ================================================================
//  BOOT — carga local ANTES de que Firebase responda
// ================================================================
(function boot() {
  const sub = document.getElementById("loading-sub");
  if (sub) sub.textContent = "Cargando datos…";
  const localData = loadLocal();
  if (localData) {
    applyData(localData);
  }
  // onAuthStateChanged toma el control del flujo
})();
