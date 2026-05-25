/* ============================================================
   firebase.js — Inicialización Firebase + Auth + Sync
   ============================================================ */

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

// ── Variables globales de sesión ──────────────────────────
let usuarioActual = null;
let SYNC_STATUS   = "ok";   // "ok" | "syncing" | "err"
let SAVE_TIMER    = null;

// ── Guardar con debounce 1.5s ─────────────────────────────
function save() {
  if (!usuarioActual) return;

  // Backup local inmediato
  try { localStorage.setItem("fin_cf_bak", JSON.stringify(S)); } catch (e) {}

  // Debounce → espera que el usuario deje de tipear
  if (SAVE_TIMER) clearTimeout(SAVE_TIMER);
  SAVE_TIMER = setTimeout(() => saveToCloud(S), 1500);
}

// ── Guardar en Firebase Realtime Database ─────────────────
async function saveToCloud(data) {
  if (!usuarioActual) return;
  SYNC_STATUS = "syncing";
  updateSyncDot();
  try {
    await db.ref("users/" + usuarioActual.uid + "/data").set(data);
    SYNC_STATUS = "ok";
  } catch (e) {
    console.error("Error guardando en Firebase:", e);
    SYNC_STATUS = "err";
  }
  updateSyncDot();
}

// ── Cargar desde Firebase Realtime Database ───────────────
async function loadFromCloud() {
  if (!usuarioActual) return;
  SYNC_STATUS = "syncing";
  updateSyncDot();
  try {
    const snap      = await db.ref("users/" + usuarioActual.uid + "/data").once("value");
    const cloudData = snap.val();

    if (cloudData) {
      // Datos existentes en Firebase → aplicarlos
      applyData(cloudData);
    } else {
      // Primera vez: subir el estado inicial con el historial
      await saveToCloud(S);
    }
    SYNC_STATUS = "ok";
  } catch (e) {
    console.error("Error cargando desde Firebase:", e);
    // Fallback: usar backup de localStorage
    try {
      const bak = localStorage.getItem("fin_cf_bak");
      if (bak) applyData(JSON.parse(bak));
    } catch (e2) { /* sin backup disponible */ }
    SYNC_STATUS = "err";
  }
  updateSyncDot();
}

// ── Actualizar indicador visual de sincronización ─────────
function updateSyncDot() {
  const dot = document.getElementById("sync-dot");
  const lbl = document.getElementById("sync-lbl");
  if (!dot || !lbl) return;

  dot.className = "sync-dot" +
    (SYNC_STATUS === "syncing" ? " syncing" :
     SYNC_STATUS === "err"     ? " err" : "");

  lbl.textContent = SYNC_STATUS === "syncing" ? "Guardando..."  :
                    SYNC_STATUS === "err"     ? "Error al guardar" :
                                                "Guardado ✓";

  lbl.style.color = SYNC_STATUS === "ok"      ? "var(--pos)"  :
                    SYNC_STATUS === "err"      ? "var(--neg)"  :
                                                 "var(--warn)";
}

// ── Observer de autenticación ─────────────────────────────
auth.onAuthStateChanged(async (user) => {
  document.getElementById("loading").style.display = "none";

  if (user) {
    usuarioActual = user;

    document.getElementById("loginForm").style.display = "none";
    document.getElementById("app").style.display       = "block";

    await loadFromCloud();
    render();

  } else {
    usuarioActual = null;
    S = buildInitialState();   // limpiar estado al cerrar sesión

    document.getElementById("loginForm").style.display = "block";
    document.getElementById("app").style.display       = "none";
  }
});

// ── Login ─────────────────────────────────────────────────
function login() {
  const email = document.getElementById("email").value.trim();
  const pass  = document.getElementById("password").value;
  const errEl = document.getElementById("loginError");

  if (!email || !pass) {
    errEl.textContent = "Completá todos los campos";
    return;
  }
  errEl.textContent = "Ingresando...";

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => { errEl.textContent = ""; })
    .catch(() => { errEl.textContent = "Usuario o contraseña incorrectos"; });
}

// ── Logout ────────────────────────────────────────────────
function logout() { auth.signOut(); }

// ── Enter en el formulario de login ──────────────────────
document.addEventListener("keydown", (e) => {
  const loginVisible = document.getElementById("loginForm").style.display !== "none";
  if (e.key === "Enter" && loginVisible) login();
});

// ── Conectar botón de login al DOM ────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnLogin");
  if (btn) btn.addEventListener("click", login);
});
