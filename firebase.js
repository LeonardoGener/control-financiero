/* ============================================================
   firebase.js — Firebase Auth + Sync + Persistencia Local Robusta
   
   ARQUITECTURA DE GUARDADO (3 capas):
   
   1. localStorage PRIMARIO  → guarda SIEMPRE, sin login, sin internet
   2. localStorage BACKUP    → copia rotativa del guardado anterior
   3. Firebase Realtime DB   → sync en la nube (solo si hay login)
   
   La app funciona completamente sin Firebase/internet.
   Firebase es sync adicional, no un requisito.
   ============================================================ */

// ── Claves de localStorage ────────────────────────────────
const LS_KEY  = "CF_DATA_V1";      // datos principales
const LS_BAK  = "CF_DATA_V1_BAK";  // backup rotativo
const LS_META = "CF_META_V1";      // metadatos (timestamp)

// ── Config Firebase ───────────────────────────────────────
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
let SYNC_STATUS   = "local";  // "local" | "syncing" | "ok" | "err"
let SAVE_TIMER    = null;
let FIREBASE_OK   = false;

// ================================================================
//  CAPA 1: localStorage — sin condiciones, siempre activo
// ================================================================

function saveLocal(data) {
  try {
    const payload = JSON.stringify({
      version:   3,
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
    console.error("CF localStorage error:", e);
    return false;
  }
}

function loadLocal() {
  const tryParse = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;
      console.log("CF: datos cargados desde " + key + " — guardado el", new Date(parsed.timestamp).toLocaleString("es-AR"));
      return parsed.data;
    } catch (e) {
      console.warn("CF: datos corruptos en " + key + ", descartando", e);
      return null;
    }
  };
  // Primario → backup
  return tryParse(LS_KEY) || tryParse(LS_BAK);
}

// ================================================================
//  CAPA 2: Firebase — solo si hay login
// ================================================================

async function saveToCloud(data) {
  if (!usuarioActual || !FIREBASE_OK) return;
  SYNC_STATUS = "syncing";
  updateSyncDot();
  try {
    await db.ref("users/" + usuarioActual.uid + "/data").set(data);
    SYNC_STATUS = "ok";
  } catch (e) {
    console.error("CF Firebase save error:", e);
    SYNC_STATUS = "err";
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
      // Comparar timestamps para usar el más reciente
      const localMeta = JSON.parse(localStorage.getItem(LS_META) || "{}");
      const localTs   = localMeta.lastSave || 0;
      const cloudTs   = cloudData._savedAt || 0;

      if (localTs > cloudTs) {
        // Local es más reciente → subir a Firebase
        console.log("CF: local más reciente, subiendo a Firebase...");
        await saveToCloud({ ...S, _savedAt: Date.now() });
      } else {
        // Firebase es más reciente → aplicar y sincronizar local
        console.log("CF: Firebase más reciente, aplicando...");
        applyData(cloudData);
        saveLocal(S);
        render();
      }
    } else {
      // Primera vez → subir estado actual a Firebase
      await saveToCloud({ ...S, _savedAt: Date.now() });
    }
    SYNC_STATUS = "ok";
  } catch (e) {
    console.error("CF Firebase load error:", e);
    FIREBASE_OK = false;
    SYNC_STATUS  = "local";
  }
  updateSyncDot();
}

// ================================================================
//  save() — SIN if(!usuarioActual). Guarda SIEMPRE.
// ================================================================

function save() {
  // CAPA 1: localStorage inmediato, sin condiciones
  saveLocal(S);
  updateSyncDot();

  // CAPA 2: Firebase con debounce (solo si hay sesión activa)
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
    local:   { cls: "",         txt: "Local ✓",        color: "var(--pos)"  },
    syncing: { cls: " syncing", txt: "Guardando…",     color: "var(--warn)" },
    ok:      { cls: "",         txt: "Guardado ✓",      color: "var(--pos)"  },
    err:     { cls: " err",     txt: "Solo local",      color: "var(--warn)" },
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
  document.getElementById("loading").style.display = "none";

  if (user) {
    // ── Con login ─────────────────────────────────────────
    usuarioActual = user;
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("app").style.display       = "block";

    // Datos locales ya están aplicados desde boot().
    // Ahora sincronizar con Firebase.
    await loadFromCloud();
    render();

  } else {
    // ── Sin login — MODO LOCAL COMPLETO ───────────────────
    usuarioActual = null;
    FIREBASE_OK   = false;
    SYNC_STATUS   = "local";

    // NO limpiar S ni datos.
    // Mostrar app directamente si hay datos locales.
    const localData = loadLocal();

    if (localData) {
      // Hay datos locales → mostrar app, no pedir login
      document.getElementById("loginForm").style.display = "none";
      document.getElementById("app").style.display       = "block";
      applyData(localData);
      render();
      updateSyncDot();
    } else {
      // Sin datos locales → pedir login para bajar de Firebase
      document.getElementById("loginForm").style.display = "block";
      document.getElementById("app").style.display       = "none";
    }
  }
});

// ================================================================
//  LOGIN / LOGOUT
// ================================================================

function login() {
  const email = document.getElementById("email").value.trim();
  const pass  = document.getElementById("password").value;
  const errEl = document.getElementById("loginError");
  if (!email || !pass) { errEl.textContent = "Completá todos los campos"; return; }
  errEl.textContent = "Ingresando…";
  auth.signInWithEmailAndPassword(email, pass)
    .then(() => { errEl.textContent = ""; })
    .catch(() => { errEl.textContent = "Email o contraseña incorrectos"; });
}

function logout() {
  saveLocal(S);  // guardar antes de salir
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

// ── Guardar al cerrar/recargar ────────────────────────────
function flushPendingInput() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
  save();
}
window.addEventListener("beforeunload", flushPendingInput);
window.addEventListener("pagehide", flushPendingInput);

// ── Autosave cada 60 segundos ─────────────────────────────
setInterval(() => {
  saveLocal(S);
  console.log("CF autosave:", new Date().toLocaleTimeString("es-AR"));
}, 60000);

// ================================================================
//  BOOT — carga datos locales ANTES de que Firebase responda
// ================================================================
function boot() {
  const localData = loadLocal();
  if (localData) {
    applyData(localData);
    console.log("CF: estado local restaurado");
  }
  // onAuthStateChanged maneja el resto
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
