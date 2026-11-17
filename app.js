/* ============================================================
   KIVHORA · Núcleo de la aplicación
   ============================================================ */
var KIV = (function () {
  'use strict';

  var SESSION = 'leomas_session';
  var PROGRESS = 'leomas_progress';
  var USERS = 'leomas_users';
  var PROFILES = 'leomas_profiles';

  function getLS(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function setLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  function hash(str) {
    var h = 5381, i;
    for (i = 0; i < str.length; i++) { h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; }
    return 'k' + h.toString(36);
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayDiff(a, b) {
    var da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return new Intl.NumberFormat('es-CO').format(n); }

  function getUser() {
    try {
      var raw = sessionStorage.getItem(SESSION);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* sesión de pestaña inválida */ }
    return getLS(SESSION, null);
  }
  function setUser(user, remember) {
    if (remember) {
      setLS(SESSION, user);
      sessionStorage.removeItem(SESSION);
    } else {
      sessionStorage.setItem(SESSION, JSON.stringify(user));
      localStorage.removeItem(SESSION);
    }
  }
  function requireAuth() {
    var u = getUser();
    if (!u) { window.location.href = 'login.html'; return null; }
    return u;
  }
  function logout() {
    localStorage.removeItem(SESSION);
    sessionStorage.removeItem(SESSION);
    window.location.href = 'index.html';
  }

  function seed() {
    var users = getLS(USERS, null);
    if (users && users.length) return;
    users = [{
      name: 'Demo Kivhora',
      profileType: 'adolescente',
      email: 'demo@kivhora.com',
      pass: hash('kivhora123'),
      createdAt: todayISO()
    }];
    setLS(USERS, users);
    var all = getLS(PROGRESS, {});
    all['demo@kivhora.com'] = {
      examDone: true, lessonsDone: [1, 2], xp: 260, streak: 4, lastPPM: 238, bestPPM: 238,
      minutes: 6, history: [], lastActive: todayISO(), daily: { date: todayISO(), xp: 40 }, badges: []
    };
    setLS(PROGRESS, all);
  }
  function register(name, profileType, email, pass) {
    email = String(email).trim().toLowerCase();
    var users = getLS(USERS, []);
    if (users.some(function (u) { return u.email === email; })) {
      return { ok: false, error: 'Ya existe una cuenta con ese correo.' };
    }
    users.push({ 
      name: String(name).trim(), 
      profileType: profileType,
      email: email, 
      pass: hash(pass), 
      createdAt: todayISO() 
    });
    setLS(USERS, users);
    return { ok: true, user: { name: String(name).trim(), profileType: profileType, email: email } };
  }
  function login(email, pass) {
    email = String(email).trim().toLowerCase();
    var users = getLS(USERS, []);
    var user = users.find(function (u) { return u.email === email; });
    if (!user) return { ok: false, error: 'Correo o contraseña incorrectos.' };
    if (user.pass !== hash(pass)) return { ok: false, error: 'Correo o contraseña incorrectos.' };
    return { ok: true, user: { name: user.name, profileType: user.profileType, email: user.email } };
  }

  function updateProfile(name, avatarValue) {
    var u = getUser(); if (!u) return;
    var users = getLS(USERS, []);
    var idx = users.findIndex(function(x) { return x.email === u.email; });
    if (idx !== -1) {
      users[idx].name = name;
      setLS(USERS, users);
    }
    u.name = name;
    setUser(u, localStorage.getItem(SESSION) ? true : false);
    var profiles = getLS(PROFILES, {});
    profiles[u.email] = { avatar: { type: 'emoji', value: avatarValue } };
    setLS(PROFILES, profiles);
  }

  function blankProgress() {
    return {
      examDone: false, lessonsDone: [], xp: 0, streak: 1, lastPPM: 0, bestPPM: 0,
      minutes: 0, history: [], lastActive: todayISO(),
      daily: { date: todayISO(), xp: 0 }, badges: []
    };
  }
  function getProgress(email) {
    var all = getLS(PROGRESS, {});
    var p = all[email] || blankProgress();
    p.lessonsDone = p.lessonsDone || [];
    p.history = p.history || [];
    p.daily = p.daily || { date: todayISO(), xp: 0 };
    if (!p.lastActive) p.lastActive = todayISO();
    return p;
  }
  function saveProgress(email, p) {
    var all = getLS(PROGRESS, {});
    all[email] = p;
    setLS(PROGRESS, all);
  }
  function touchStreak(p) {
    var t = todayISO();
    if (p.daily.date !== t) p.daily = { date: t, xp: 0 };
    if (p.lastActive === t) return p;
    var diff = dayDiff(p.lastActive, t);
    p.streak = diff === 1 ? (p.streak || 0) + 1 : 1;
    p.lastActive = t;
    return p;
  }
  function addXP(p, amount) {
    p.xp = (p.xp || 0) + amount;
    if (p.daily.date !== todayISO()) p.daily = { date: todayISO(), xp: 0 };
    p.daily.xp = (p.daily.xp || 0) + amount;
    return p;
  }
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

  function completeExam(ppm, seconds, score) {
    var u = getUser(); if (!u) return null;
    var p = getProgress(u.email);
    touchStreak(p);
    
    // REQUISITO ESTRICTO: 100 PPM y 8/10 (El examen.html ya bloquea la vista, pero blindamos aquí también)
    if (ppm >= 100 && score >= 8) {
      p.examDone = true;
    }
    
    p.lastPPM = ppm;
    p.bestPPM = Math.max(p.bestPPM || 0, ppm);
    p.minutes = Math.round((p.minutes || 0) + seconds / 60);
    p.history.push({ type: 'exam', ppm: ppm, score: score, date: todayISO() });
    
    var bonusVelocidad = ppm >= 300 ? 40 : ppm >= 200 ? 25 : 10;
    var bonusQuiz = (score || 0) * 5; 
    
    addXP(p, 60 + bonusVelocidad + bonusQuiz);
    saveProgress(u.email, p);
    return p;
  }
  
  function completeLesson(n, ppm, seconds, quizOk) {
    var u = getUser(); if (!u) return null;
    var p = getProgress(u.email);
    touchStreak(p);
    if (p.lessonsDone.indexOf(n) === -1) p.lessonsDone.push(n);
    p.lastPPM = ppm;
    p.bestPPM = Math.max(p.bestPPM || 0, ppm);
    p.minutes = Math.round((p.minutes || 0) + seconds / 60);
    p.history.push({ type: 'lesson', lesson: n, ppm: ppm, date: todayISO() });
    var xp = 45 + (quizOk ? 25 : 0) + (ppm >= 300 ? 20 : 0);
    addXP(p, xp);
    saveProgress(u.email, p);
    return p;
  }
  
  function isLessonUnlocked(n, p) {
    if (n === 1) return !!p.examDone;
    return p.lessonsDone.indexOf(n - 1) !== -1;
  }

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
    var profiles = getLS(PROFILES, {});
    var prof = profiles[user.email];
    if (prof && prof.avatar) {
      if (prof.avatar.type === 'image') {
        return '<img src="' + esc(prof.avatar.value) + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover">';
      }
      return esc(prof.avatar.value);
    }
    return esc((user.name || '?').trim().charAt(0).toUpperCase());
  }
  function initChrome() {
    var u = getUser();
    document.querySelectorAll('[data-user-name]').forEach(function (el) { el.textContent = u ? u.name : 'Invitado'; });
    document.querySelectorAll('[data-user-avatar]').forEach(function (el) { el.innerHTML = avatarHTML(u); });
    document.querySelectorAll('[data-logout]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); logout(); });
    });
    var p = u ? getProgress(u.email) : null;
    document.querySelectorAll('[data-streak]').forEach(function (el) { el.textContent = p ? p.streak : 0; });
    document.querySelectorAll('[data-xp]').forEach(function (el) { el.textContent = p ? fmt(p.xp) : 0; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    seed();
    initChrome();
  });

  return {
    getUser: getUser, setUser: setUser, requireAuth: requireAuth, logout: logout,
    register: register, login: login, getProgress: getProgress, saveProgress: saveProgress,
    touchStreak: touchStreak, addXP: addXP, overall: overall, levelInfo: levelInfo,
    category: category, completeExam: completeExam, completeLesson: completeLesson,
    isLessonUnlocked: isLessonUnlocked, toast: toast, avatarHTML: avatarHTML,
    initChrome: initChrome, fmt: fmt, esc: esc, todayISO: todayISO, updateProfile: updateProfile
  };
})();