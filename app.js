/* ============================================================
   KIVHORA · Núcleo de la aplicación
   ------------------------------------------------------------
   La autenticación, el XP y el progreso viven en Supabase.
   Este archivo solo mantiene una copia en memoria del estado
   del usuario para poder pintar la interfaz. Ninguna escritura
   se hace desde el navegador: las RPC del servidor validan y
   calculan todo.

   Requiere cargar antes:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="supabase-config.js"></script>
     <script src="kiv-cloud.js"></script>
   ============================================================ */
var KIV = (function () {
  'use strict';

  var LEGACY_KEYS = ['leomas_session', 'leomas_progress', 'leomas_users', 'leomas_profiles'];
  var REMEMBER_KEY = 'kiv_remember';

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return new Intl.NumberFormat('es-CO').format(n || 0); }

  /* ----------------------------------------------------------
     Preferencia "mantener sesión iniciada".

     Supabase guarda el token con el adaptador de almacenamiento
     que le pasamos. Si el usuario no marca la casilla, el token
     debe morir al cerrar la pestaña: usamos sessionStorage.
     ---------------------------------------------------------- */
  function rememberPreference() {
    try { return sessionStorage.getItem(REMEMBER_KEY) !== '0'; }
    catch (e) { return true; }
  }
  function setRememberPreference(remember) {
    try { sessionStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'); }
    catch (e) { /* almacenamiento no disponible */ }
  }

  var authStorage = {
    getItem: function (key) {
      try {
        var tab = sessionStorage.getItem(key);
        if (tab !== null) return tab;
      } catch (e) { /* sin sessionStorage */ }
      try { return localStorage.getItem(key); }
      catch (e) { return null; }
    },
    setItem: function (key, value) {
      try {
        if (rememberPreference()) {
          localStorage.setItem(key, value);
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, value);
          localStorage.removeItem(key);
        }
      } catch (e) { /* almacenamiento no disponible */ }
    },
    removeItem: function (key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignorar */ }
      try { sessionStorage.removeItem(key); } catch (e) { /* ignorar */ }
    }
  };
  window.KIV_AUTH_STORAGE = authStorage;

  /* ----------------------------------------------------------
     Estado en memoria
     ---------------------------------------------------------- */
  var state = null;       // { user, progress }
  var bootPromise = null;

  function blankProgress() {
    return {
      examDone: false, lessonsDone: [], xp: 0, streak: 0, lastPPM: 0, bestPPM: 0,
      minutes: 0, history: [], lastActive: null,
      daily: { date: null, xp: 0 }, badges: []
    };
  }

  function applyState(payload) {
    var profile = (payload && payload.profile) || {};
    var progress = (payload && payload.progress) || {};

    /* El email viene de la sesión de Supabase (normalizado en kiv-cloud.js). */
    state = {
      user: {
        id: profile.id || null,
        email: profile.email || null,
        name: profile.name || 'Lector',
        profileType: profile.profileType || 'adolescente',
        avatar: profile.avatar || '🦦'
      },
      progress: {
        examDone: !!progress.examDone,
        lessonsDone: (progress.lessonsDone || []).map(Number),
        xp: progress.xp || 0,
        streak: progress.streak || 0,
        lastPPM: progress.lastPPM || 0,
        bestPPM: progress.bestPPM || 0,
        minutes: progress.minutes || 0,
        lastActive: progress.lastActive || null,
        daily: progress.daily || { date: null, xp: 0 },
        history: progress.history || [],
        badges: []
      }
    };
    return state;
  }

  function purgeLegacyData() {
    LEGACY_KEYS.forEach(function (key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignorar */ }
      try { sessionStorage.removeItem(key); } catch (e) { /* ignorar */ }
    });
  }

  function boot() {
    if (bootPromise) return bootPromise;
    purgeLegacyData();

    if (!window.KIVCloud || !KIVCloud.isConfigured()) {
      bootPromise = Promise.resolve({
        ok: false,
        code: 'supabase_not_configured',
        error: 'La conexión con el servidor no está configurada.'
      });
      return bootPromise;
    }

    bootPromise = KIVCloud.getState().then(function (res) {
      if (!res.ok) {
        state = null;
        return { ok: false, error: res.error, code: res.code };
      }
      applyState(res.state);
      return { ok: true };
    }).catch(function () {
      state = null;
      return { ok: false, code: 'network', error: 'No se pudo conectar con el servidor.' };
    });

    return bootPromise;
  }

  /**
   * Punto de entrada de las páginas protegidas.
   * Espera la sesión, redirige a login si no hay y entrega
   * (usuario, progreso) ya cargados desde el servidor.
   */
  function ready(callback) {
    return boot().then(function (res) {
      if (!res.ok) {
        if (res.code === 'not_authenticated') {
          window.location.replace('login.html');
          return;
        }
        toast(res.error || 'No se pudo cargar tu progreso.');
        return;
      }
      callback(state.user, state.progress);
    });
  }

  function getUser() { return state ? state.user : null; }
  function getProgress() { return state ? state.progress : blankProgress(); }

  function logout() {
    var done = function () { window.location.href = 'index.html'; };
    if (!window.KIVCloud || !KIVCloud.isConfigured()) { done(); return; }
    KIVCloud.signOut().then(done, done);
  }

  /* ----------------------------------------------------------
     Escrituras: todas pasan por RPC del servidor.
     ---------------------------------------------------------- */
  function mutate(promise) {
    var beforeXP = state ? state.progress.xp : 0;
    return promise.then(function (res) {
      if (!res.ok) return res;
      applyState(res.state);
      res.xpGained = state.progress.xp - beforeXP;
      return res;
    });
  }

  function completeLesson(n, options) {
    options = options || {};
    return mutate(KIVCloud.completeLesson(
      n,
      options.ppm || 0,
      !!options.quizOk,
      options.seconds || 0
    ));
  }
  function completeExam(ppm, seconds, score) {
    return mutate(KIVCloud.completeExam(ppm, score, seconds));
  }
  function savePractice(ppm, multiplier) {
    return mutate(KIVCloud.savePractice(ppm, multiplier));
  }
  function updateProfile(name, avatar) {
    return mutate(KIVCloud.updateProfile(name, avatar));
  }

  /* ----------------------------------------------------------
     Autenticación
     ---------------------------------------------------------- */
  function login(email, pass, remember) {
    if (!window.KIVCloud || !KIVCloud.isConfigured()) {
      return Promise.resolve({ ok: false, error: 'La conexión con el servidor no está configurada.' });
    }
    setRememberPreference(remember !== false);
    return KIVCloud.signIn(email, pass).then(function (res) {
      if (!res.ok) return res;
      bootPromise = null;
      return boot().then(function () { return { ok: true }; });
    });
  }

  function register(name, profileType, email, pass) {
    if (!window.KIVCloud || !KIVCloud.isConfigured()) {
      return Promise.resolve({ ok: false, error: 'La conexión con el servidor no está configurada.' });
    }
    setRememberPreference(true);
    return KIVCloud.signUp(name, profileType, email, pass).then(function (res) {
      if (!res.ok) return res;
      if (res.needsConfirmation) return { ok: true, needsConfirmation: true };
      bootPromise = null;
      return boot().then(function () { return { ok: true }; });
    });
  }

  /* ----------------------------------------------------------
     Cálculos de presentación (no otorgan nada)
     ---------------------------------------------------------- */
  function overall(p) {
    var done = (p.examDone ? 1 : 0) + (p.lessonsDone ? p.lessonsDone.length : 0);
    return Math.min(100, Math.round((done / 9) * 100));
  }
  function levelInfo(xp) {
    var levels = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
    var names = ['Curioso', 'Explorador', 'Lector ágil', 'Cazapárrafos', 'Velocista', 'Maestro', 'Leyenda'];
    var i = 0;
    while (i < levels.length - 1 && xp >= levels[i + 1]) i++;
    var current = levels[i];
    var next = levels[i + 1] || levels[levels.length - 1];
    var pct = next === current ? 100 : Math.round(((xp - current) / (next - current)) * 100);
    return { level: i + 1, name: names[Math.min(i, names.length - 1)], current: current, next: next, pct: Math.max(0, Math.min(100, pct)) };
  }
  function category(ppm) {
    if (ppm < 100) return { icon: '🐢', name: 'Lector muy lento', desc: 'Tu velocidad está por debajo del promedio. Con práctica diaria mejorarás rápido.' };
    if (ppm < 200) return { icon: '🐌', name: 'Lector lento', desc: 'Estás desarrollando tu ritmo. Unos minutos al día marcan la diferencia.' };
    if (ppm < 300) return { icon: '📚', name: 'Lector promedio', desc: 'Lees al ritmo de la mayoría. Con Kivhora puedes superar este nivel.' };
    if (ppm < 400) return { icon: '🌟', name: 'Buen lector', desc: 'Estás por encima del promedio. Tu velocidad es sólida.' };
    if (ppm < 600) return { icon: '⚡', name: 'Lector rápido', desc: 'Excelente rendimiento: lees mucho más rápido que la mayoría.' };
    return { icon: '🏆', name: 'Lector experto', desc: '¡Extraordinario! Tu velocidad es de nivel élite.' };
  }
  function isLessonUnlocked(n, p) {
    if (n === 1) return !!p.examDone;
    return p.lessonsDone.indexOf(n - 1) !== -1;
  }

  /* ----------------------------------------------------------
     Interfaz
     ---------------------------------------------------------- */
  function toast(message) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }
  function avatarHTML(user) {
    if (!user) return '🐾';
    if (user.avatar && /^data:image\//.test(user.avatar)) {
      return '<img src="' + esc(user.avatar) + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover">';
    }
    if (user.avatar) return esc(user.avatar);
    return esc((user.name || '?').trim().charAt(0).toUpperCase());
  }
  function initChrome() {
    var u = getUser();
    document.querySelectorAll('[data-user-name]').forEach(function (el) { el.textContent = u ? u.name : 'Invitado'; });
    document.querySelectorAll('[data-user-avatar]').forEach(function (el) { el.innerHTML = avatarHTML(u); });
    document.querySelectorAll('[data-logout]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); logout(); });
    });
    var p = u ? getProgress() : null;
    document.querySelectorAll('[data-streak]').forEach(function (el) { el.textContent = p ? p.streak : 0; });
    document.querySelectorAll('[data-xp]').forEach(function (el) { el.textContent = p ? fmt(p.xp) : 0; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    boot().then(initChrome);
  });

  return {
    boot: boot,
    ready: ready,
    getUser: getUser,
    getProgress: getProgress,
    login: login,
    register: register,
    logout: logout,
    completeLesson: completeLesson,
    completeExam: completeExam,
    savePractice: savePractice,
    updateProfile: updateProfile,
    overall: overall,
    levelInfo: levelInfo,
    category: category,
    isLessonUnlocked: isLessonUnlocked,
    toast: toast,
    avatarHTML: avatarHTML,
    initChrome: initChrome,
    fmt: fmt,
    esc: esc,
    todayISO: todayISO
  };
})();
