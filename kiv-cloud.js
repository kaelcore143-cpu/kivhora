/* ============================================================
   KIVHORA · Capa de datos
   ------------------------------------------------------------
   Dos modos, misma interfaz:

   - Nube: Supabase Auth + RPC (cuando supabase-config.js tiene
     `enabled: true`, URL y clave).
   - Local: almacenamiento del navegador, para desarrollo y para
     usar la app sin backend. Las reglas son las mismas que las
     RPC de supabase/migrations, pero viven en el cliente.

   Requiere cargar antes:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="supabase-config.js"></script>

   En modo nube la clave pública (publishable/anon) va aquí; la
   seguridad real la aplican RLS y las RPC. Nunca uses la
   service_role key.
   ============================================================ */
var KIVCloud = (function () {
  'use strict';

  var client = null;

  /* ==========================================================
     CONFIGURACIÓN Y MODO
     ========================================================== */
  function config() {
    return window.KIV_SUPABASE || {};
  }

  function cloudEnabled() {
    var cfg = config();
    return cfg.enabled !== false && !!(
      window.supabase &&
      typeof window.supabase.createClient === 'function' &&
      cfg.url &&
      cfg.anonKey
    );
  }

  /* Se mantiene el nombre por compatibilidad con app.js. */
  function isConfigured() {
    return cloudEnabled() || localAvailable();
  }

  function getClient() {
    if (!cloudEnabled()) {
      throw new Error('supabase_not_configured');
    }
    if (!client) {
      var authOptions = {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      };
      /* app.js define este adaptador para respetar "mantener sesión". */
      if (window.KIV_AUTH_STORAGE) {
        authOptions.storage = window.KIV_AUTH_STORAGE;
      }
      client = window.supabase.createClient(config().url, config().anonKey, {
        auth: authOptions
      });
    }
    return client;
  }

  function errorMessage(error) {
    if (!error) return 'Ocurrió un error inesperado.';

    var code = String(error.code || '');
    var msg = String(error.message || error || '');

    var byCode = {
      invalid_credentials: 'Correo o contraseña incorrectos.',
      email_not_confirmed: 'Confirma tu correo antes de iniciar sesión.',
      user_already_exists: 'Ya existe una cuenta con ese correo.',
      email_exists: 'Ya existe una cuenta con ese correo.',
      weak_password: 'La contraseña es demasiado débil.',
      over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos.',
      not_authenticated: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      lesson_locked: 'Completa la lección anterior para continuar.',
      quiz_required: 'Necesitas responder correctamente el quiz para completar esta lección.',
      exam_required: 'Primero debes aprobar el examen de velocidad.',
      invalid_lesson: 'La lección no es válida.',
      invalid_ppm: 'La velocidad registrada no es válida.',
      invalid_score: 'El puntaje del examen no es válido.',
      invalid_seconds: 'El tiempo registrado no es válido.',
      invalid_multiplier: 'La velocidad de práctica no es válida.',
      invalid_name: 'El nombre debe tener entre 2 y 60 caracteres.',
      invalid_avatar: 'El avatar seleccionado no es válido.',
      hearts_depleted: 'No tienes corazones. Practica para recuperar.',
      invalid_email: 'Escribe un correo válido.',
      weak_password_local: 'La contraseña debe tener al menos 6 caracteres.',
      storage_unavailable: 'Tu navegador no permite guardar datos. Revisa la configuración de privacidad.'
    };

    if (byCode[code]) return byCode[code];
    if (byCode[msg]) return byCode[msg];

    if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de iniciar sesión.';
    if (/already registered|already exists/i.test(msg)) return 'Ya existe una cuenta con ese correo.';
    if (/password should be at least/i.test(msg)) return 'La contraseña es demasiado corta.';
    if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera unos minutos.';

    return msg || 'No se pudo completar la operación.';
  }

  function failure(error) {
    return {
      ok: false,
      error: errorMessage(error),
      code: error && (error.code || error.message) || 'unknown'
    };
  }

  function normalizeState(data, session) {
    data = data || {};
    var profile = data.profile || {};
    var progress = data.progress || {};
    var user = session && session.user ? session.user : {};

    return {
      profile: {
        id: profile.id || user.id || null,
        email: user.email || null,
        name: profile.name || 'Lector',
        profileType: profile.profile_type || 'adolescente',
        avatar: profile.avatar || '🦦'
      },
      progress: {
        examDone: !!progress.exam_done,
        lessonsDone: (data.lessons || []).map(Number),
        xp: progress.xp || 0,
        streak: progress.streak || 0,
        lastPPM: progress.last_ppm || 0,
        bestPPM: progress.best_ppm || 0,
        minutes: progress.minutes || 0,
        lastActive: progress.last_active || null,
        daily: {
          date: progress.daily_date || null,
          xp: progress.daily_xp || 0
        },
        history: data.history || []
      }
    };
  }

  /* ==========================================================
     MODO LOCAL
     ----------------------------------------------------------
     Solo para desarrollo/demo sin backend. No es seguridad
     real: cualquiera con acceso al navegador puede editar estos
     datos. Con Supabase activo, este bloque no se usa.
     ========================================================== */
  var DB_KEY = 'kiv_local_db';
  var SESSION_KEY = 'kiv_local_session';
  var LESSON_MAX = 8;
  var LESSON_XP = { 1: 10, 3: 20, 4: 30, 5: 50, 6: 30, 7: 30, 8: 20 };
  var PRACTICE_DAILY_CAP = 2;

  function localAvailable() {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  function emptyDb() {
    return { users: [], states: {} };
  }

  function readDb() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (!raw) return emptyDb();
      var parsed = JSON.parse(raw) || {};
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        states: parsed.states && typeof parsed.states === 'object' ? parsed.states : {}
      };
    } catch (e) {
      return emptyDb();
    }
  }

  function writeDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

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

  /* Usa el mismo adaptador que Supabase para respetar "mantener sesión". */
  function sessionStorageAdapter() {
    if (window.KIV_AUTH_STORAGE) return window.KIV_AUTH_STORAGE;
    return {
      getItem: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      setItem: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorar */ } },
      removeItem: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignorar */ } }
    };
  }

  function readSession() {
    try {
      var raw = sessionStorageAdapter().getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.userId ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeSession(session) {
    sessionStorageAdapter().setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorageAdapter().removeItem(SESSION_KEY);
  }

  function blankState(user) {
    return {
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileType: user.profileType,
        avatar: '🦦',
        hearts: 5,
        max_hearts: 5,
        gems: 0,
        streak_freezes: 0
      },
      progress: {
        examDone: false,
        lessonsDone: [],
        xp: 0,
        streak: 0,
        lastPPM: 0,
        bestPPM: 0,
        minutes: 0,
        lastActive: null,
        daily: { date: null, xp: 0 }
      },
      history: []
    };
  }

  function migrateProfile(state) {
    var prof = state.profile || {};
    if (prof.hearts == null) prof.hearts = 5;
    if (prof.max_hearts == null) prof.max_hearts = 5;
    if (prof.gems == null) prof.gems = 0;
    if (prof.streak_freezes == null) prof.streak_freezes = 0;
  }

  function migrateLessons(state) {
    if (!Array.isArray(state.progress.lessonsDone)) return;
    state.progress.lessonsDone = state.progress.lessonsDone.map(function (item) {
      if (typeof item === 'number') {
        return { lesson: item, crowns: 1, last_completed: null };
      }
      if (item && typeof item === 'object') {
        if (item.crowns == null) item.crowns = 1;
        if (item.last_completed == null) item.last_completed = null;
        return item;
      }
      return null;
    }).filter(Boolean);
  }

  function migrateState(state) {
    if (!state) return;
    migrateProfile(state);
    migrateLessons(state);
  }

  function localFail(code) {
    return { ok: false, code: code, error: errorMessage({ code: code }) };
  }

  function currentLocalUser(db) {
    var session = readSession();
    if (!session) return null;
    var user = db.users.filter(function (u) { return u.id === session.userId; })[0];
    return user || null;
  }

  function snapshot(user, state) {
    return {
      profile: {
        id: user.id,
        email: user.email,
        name: state.profile.name,
        profileType: state.profile.profileType,
        avatar: state.profile.avatar,
        hearts: state.profile.hearts,
        max_hearts: state.profile.max_hearts,
        gems: state.profile.gems,
        streak_freezes: state.profile.streak_freezes
      },
      progress: {
        examDone: !!state.progress.examDone,
        lessonsDone: state.progress.lessonsDone.slice(),
        xp: state.progress.xp,
        streak: state.progress.streak,
        lastPPM: state.progress.lastPPM,
        bestPPM: state.progress.bestPPM,
        minutes: state.progress.minutes,
        lastActive: state.progress.lastActive,
        daily: { date: state.progress.daily.date, xp: state.progress.daily.xp },
        history: state.history.slice(0, 50)
      }
    };
  }

  /* Aplica XP, racha, meta diaria, PPM y minutos (equivalente a apply_activity). */
  function applyActivity(state, xp, ppm, seconds) {
    var p = state.progress;
    var today = todayISO();
    xp = Math.max(xp || 0, 0);
    ppm = ppm || 0;
    seconds = Math.max(seconds || 0, 0);

    p.xp += xp;

    if (p.daily.date === today) p.daily.xp += xp;
    else p.daily = { date: today, xp: xp };

    if (!p.lastActive) p.streak = 1;
    else if (p.lastActive === today) p.streak = p.streak || 1;
    else if (dayDiff(p.lastActive, today) === 1) p.streak = (p.streak || 0) + 1;
    else {
      if (p.streak_freezes > 0) {
        p.streak_freezes -= 1;
      } else {
        p.streak = 1;
      }
    }
    p.lastActive = today;

    if (ppm > 0) p.lastPPM = ppm;
    p.bestPPM = Math.max(p.bestPPM || 0, ppm);
    p.minutes += Math.round(seconds / 60);
  }

  function localGetState() {
    var db = readDb();
    var user = currentLocalUser(db);
    if (!user) return localFail('not_authenticated');

    var state = db.states[user.id];
    if (!state) {
      state = blankState(user);
      db.states[user.id] = state;
      writeDb(db);
    } else {
      migrateState(state);
    }
    return { ok: true, state: snapshot(user, state) };
  }

  function localSignUp(name, profileType, email, password) {
    if (!localAvailable()) return localFail('storage_unavailable');

    name = String(name || '').trim();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');

    var validTypes = ['niño', 'adolescente', 'universitario', 'profesor'];
    if (validTypes.indexOf(profileType) === -1) profileType = 'adolescente';
    if (name.length < 2 || name.length > 60) return localFail('invalid_name');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return localFail('invalid_email');
    if (password.length < 6) return localFail('weak_password_local');

    var db = readDb();
    var exists = db.users.some(function (u) { return u.email === email; });
    if (exists) return localFail('user_already_exists');

    var user = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      email: email,
      name: name,
      profileType: profileType,
      pass: hash(password),
      createdAt: todayISO()
    };
    db.users.push(user);
    db.states[user.id] = blankState(user);
    writeDb(db);
    writeSession({ userId: user.id });

    return { ok: true, needsConfirmation: false, user: { id: user.id, email: user.email } };
  }

  function localSignIn(email, password) {
    email = String(email || '').trim().toLowerCase();
    var db = readDb();
    var user = db.users.filter(function (u) { return u.email === email; })[0];
    if (!user || user.pass !== hash(String(password || ''))) return localFail('invalid_credentials');

    writeSession({ userId: user.id });
    return { ok: true, user: { id: user.id, email: user.email } };
  }

  function localSignOut() {
    clearSession();
    return { ok: true };
  }

  function localCompleteLesson(lesson, ppm, quizOk, seconds) {
    var db = readDb();
    var user = currentLocalUser(db);
    if (!user) return localFail('not_authenticated');

    var n = Number(lesson);
    if (!n || n < 1 || n > LESSON_MAX || Math.floor(n) !== n) return localFail('invalid_lesson');
    if (ppm == null || isNaN(ppm) || ppm < 0) return localFail('invalid_ppm');
    if (seconds == null || isNaN(seconds) || seconds < 0) return localFail('invalid_seconds');

    var state = db.states[user.id] || blankState(user);
    var p = state.progress;

    if (n === 1) {
      if (!p.examDone) return localFail('lesson_locked');
    } else {
      var prev = p.lessonsDone.find(function (l) { return l.lesson === n - 1; });
      if (!prev || prev.crowns < 1) return localFail('lesson_locked');
    }

    if ((n === 4 || n === 6 || n === 7) && !quizOk) return localFail('quiz_required');

    if (p.hearts <= 0) return localFail('hearts_depleted');

    var xp = 0;
    var lessonEntry = p.lessonsDone.find(function (l) { return l.lesson === n; });

    if (!lessonEntry) {
      xp = n === 2 ? (quizOk ? 20 : 10) : LESSON_XP[n];
      p.lessonsDone.push({ lesson: n, crowns: 1, last_completed: todayISO() });
      p.lessonsDone.sort(function (a, b) { return a.lesson - b.lesson; });
    } else {
      lessonEntry.last_completed = todayISO();
      if (quizOk && lessonEntry.crowns < 3) {
        lessonEntry.crowns += 1;
      }
    }

    if (!quizOk && p.hearts > 0) {
      p.hearts -= 1;
    }

    state.history.unshift({ type: 'lesson', lesson: n, xp: xp, date: todayISO() });
    applyActivity(state, xp, Number(ppm), Number(seconds));
    db.states[user.id] = state;
    writeDb(db);

    return { ok: true, state: snapshot(user, state) };
  }

  function localCompleteExam(ppm, score, seconds) {
    var db = readDb();
    var user = currentLocalUser(db);
    if (!user) return localFail('not_authenticated');

    ppm = Number(ppm);
    score = Number(score);
    seconds = Number(seconds);
    if (!ppm || ppm <= 0 || isNaN(ppm)) return localFail('invalid_ppm');
    if (isNaN(score) || score < 0 || score > 10) return localFail('invalid_score');
    if (isNaN(seconds) || seconds < 0) return localFail('invalid_seconds');

    var state = db.states[user.id] || blankState(user);
    var p = state.progress;
    var passed = ppm >= 100 && score >= 8;
    var xp = 0;

    if (passed && !p.examDone) {
      xp = 60 + (ppm >= 300 ? 40 : ppm >= 200 ? 25 : 10) + (score * 5);
      p.examDone = true;
    }

    if (!passed && p.hearts > 0) {
      p.hearts -= 1;
    }

    state.history.unshift({ type: 'exam', ppm: ppm, score: score, passed: passed, xp: xp, date: todayISO() });
    applyActivity(state, xp, ppm, seconds);
    db.states[user.id] = state;
    writeDb(db);

    return { ok: true, state: snapshot(user, state) };
  }

  function localSavePractice(ppm, multiplier) {
    var db = readDb();
    var user = currentLocalUser(db);
    if (!user) return localFail('not_authenticated');

    ppm = Number(ppm);
    multiplier = Number(multiplier);
    if (!ppm || ppm <= 0 || isNaN(ppm)) return localFail('invalid_ppm');
    if ([1, 1.5, 2, 3].indexOf(multiplier) === -1) return localFail('invalid_multiplier');

    var state = db.states[user.id] || blankState(user);
    if (!state.progress.examDone) return localFail('exam_required');

    var today = todayISO();
    var rewardedToday = state.history.filter(function (h) {
      return h.type === 'practice' && h.xp > 0 && h.date === today;
    }).length;

    var xp = 0;
    if (rewardedToday < PRACTICE_DAILY_CAP) {
      xp = 30 + (multiplier > 1 ? 10 : 0) + (multiplier > 2 ? 20 : 0);
      if (p.hearts < p.max_hearts) {
        p.hearts += 1;
      }
    }

    state.history.unshift({ type: 'practice', ppm: ppm, multiplier: multiplier, xp: xp, date: today });
    applyActivity(state, xp, 0, 0);
    db.states[user.id] = state;
    writeDb(db);

    return { ok: true, state: snapshot(user, state) };
  }

  function localUpdateProfile(name, avatar) {
    var db = readDb();
    var user = currentLocalUser(db);
    if (!user) return localFail('not_authenticated');

    name = String(name || '').trim();
    avatar = String(avatar || '🦦');
    if (name.length < 2 || name.length > 60) return localFail('invalid_name');
    if (avatar.length < 1 || avatar.length > 16) return localFail('invalid_avatar');

    var state = db.states[user.id] || blankState(user);
    state.profile.name = name;
    state.profile.avatar = avatar;
    user.name = name;
    db.states[user.id] = state;
    writeDb(db);

    return { ok: true, state: snapshot(user, state) };
  }

  /* ==========================================================
     MODO NUBE
     ========================================================== */
  function cloudGetSession() {
    if (!cloudEnabled()) return Promise.resolve(null);
    return getClient().auth.getSession().then(function (result) {
      if (result.error) return null;
      return result.data.session || null;
    });
  }

  function cloudGetState() {
    return cloudGetSession().then(function (session) {
      if (!session) {
        return { ok: false, error: errorMessage({ code: 'not_authenticated' }), code: 'not_authenticated' };
      }
      return getClient().rpc('get_my_state').then(function (result) {
        if (result.error) return failure(result.error);
        return { ok: true, state: normalizeState(result.data, session) };
      });
    }).catch(function (error) {
      return failure(error);
    });
  }

  function cloudSignUp(name, profileType, email, password) {
    /* Las confirmaciones por correo vuelven a login.html, que ya sabe leer el token. */
    var redirectTo;
    try { redirectTo = new URL('login.html', window.location.href).href; } catch (e) { redirectTo = undefined; }

    return getClient().auth.signUp({
      email: String(email || '').trim().toLowerCase(),
      password: password,
      options: {
        data: {
          name: String(name || '').trim(),
          profile_type: profileType
        },
        emailRedirectTo: redirectTo
      }
    }).then(function (result) {
      if (result.error) return failure(result.error);
      return {
        ok: true,
        needsConfirmation: !result.data.session,
        user: result.data.user || null
      };
    }).catch(function (error) {
      return failure(error);
    });
  }

  function cloudSignIn(email, password) {
    return getClient().auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password: password
    }).then(function (result) {
      if (result.error) return failure(result.error);
      return { ok: true, user: result.data.user, session: result.data.session };
    }).catch(function (error) {
      return failure(error);
    });
  }

  function cloudSignOut() {
    return getClient().auth.signOut().then(function (result) {
      if (result.error) return failure(result.error);
      return { ok: true };
    }).catch(function (error) {
      return failure(error);
    });
  }

  function cloudCallRpc(name, args) {
    return getClient().rpc(name, args).then(function (result) {
      if (result.error) return failure(result.error);
      return cloudGetSession().then(function (session) {
        return { ok: true, state: normalizeState(result.data, session) };
      });
    }).catch(function (error) {
      return failure(error);
    });
  }

  function cloudCompleteLesson(lessonNumber, ppm, quizOk, seconds) {
    return cloudCallRpc('complete_lesson', {
      p_lesson: lessonNumber,
      p_ppm: ppm,
      p_quiz_ok: !!quizOk,
      p_seconds: seconds
    });
  }

  function cloudCompleteExam(ppm, score, seconds) {
    return cloudCallRpc('complete_exam', {
      p_ppm: ppm,
      p_score: score,
      p_seconds: seconds
    });
  }

  function cloudSavePractice(ppm, multiplier) {
    return cloudCallRpc('save_practice', {
      p_ppm: ppm,
      p_multiplier: multiplier
    });
  }

  function cloudUpdateProfile(name, avatar) {
    return cloudCallRpc('update_profile', {
      p_name: name,
      p_avatar: avatar
    });
  }

  /* ==========================================================
     API PÚBLICA
     ========================================================== */
  function localCall(result) {
    return Promise.resolve(result);
  }

  return {
    isConfigured: isConfigured,
    isLocalMode: function () { return !cloudEnabled(); },
    errorMessage: errorMessage,
    getSession: function () { return cloudEnabled() ? cloudGetSession() : Promise.resolve(readSession()); },
    getState: function () { return cloudEnabled() ? cloudGetState() : localCall(localGetState()); },
    signUp: function (name, profileType, email, password) {
      return cloudEnabled() ? cloudSignUp(name, profileType, email, password) : localCall(localSignUp(name, profileType, email, password));
    },
    signIn: function (email, password) {
      return cloudEnabled() ? cloudSignIn(email, password) : localCall(localSignIn(email, password));
    },
    signOut: function () {
      return cloudEnabled() ? cloudSignOut() : localCall(localSignOut());
    },
    completeLesson: function (lessonNumber, ppm, quizOk, seconds) {
      return cloudEnabled() ? cloudCompleteLesson(lessonNumber, ppm, quizOk, seconds) : localCall(localCompleteLesson(lessonNumber, ppm, quizOk, seconds));
    },
    completeExam: function (ppm, score, seconds) {
      return cloudEnabled() ? cloudCompleteExam(ppm, score, seconds) : localCall(localCompleteExam(ppm, score, seconds));
    },
    savePractice: function (ppm, multiplier) {
      return cloudEnabled() ? cloudSavePractice(ppm, multiplier) : localCall(localSavePractice(ppm, multiplier));
    },
    updateProfile: function (name, avatar) {
      return cloudEnabled() ? cloudUpdateProfile(name, avatar) : localCall(localUpdateProfile(name, avatar));
    }
  };
})();
