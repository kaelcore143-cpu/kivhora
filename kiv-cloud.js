/* ============================================================
   KIVHORA · Cliente de Supabase
   ------------------------------------------------------------
   Requiere cargar antes:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="supabase-config.js"></script>
     <script src="kiv-cloud.js"></script>

   La anon key es pública; la seguridad real está en las políticas RLS
   y en las RPC del servidor. Nunca uses aquí la service_role key.
   ============================================================ */
var KIVCloud = (function () {
  'use strict';

  var client = null;

  function config() {
    return window.KIV_SUPABASE || {};
  }

  function isConfigured() {
    var cfg = config();
    return !!(
      window.supabase &&
      typeof window.supabase.createClient === 'function' &&
      cfg.url &&
      cfg.anonKey
    );
  }

  function getClient() {
    if (!isConfigured()) {
      throw new Error('supabase_not_configured');
    }
    if (!client) {
      client = window.supabase.createClient(config().url, config().anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return client;
  }

  function errorMessage(error) {
    if (!error) return 'Ocurrió un error inesperado.';

    var code = String(error.code || '');
    var msg = String(error.message || '');

    var byCode = {
      invalid_credentials: 'Correo o contraseña incorrectos.',
      email_not_confirmed: 'Confirma tu correo antes de iniciar sesión.',
      user_already_exists: 'Ya existe una cuenta con ese correo.',
      weak_password: 'La contraseña es demasiado débil.',
      email_exists: 'Ya existe una cuenta con ese correo.',
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
      invalid_avatar: 'El avatar seleccionado no es válido.'
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

  function getSession() {
    if (!isConfigured()) return Promise.resolve(null);
    return getClient().auth.getSession().then(function (result) {
      if (result.error) return null;
      return result.data.session || null;
    });
  }

  function getState() {
    return getSession().then(function (session) {
      if (!session) {
        return { ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.', code: 'not_authenticated' };
      }
      return getClient().rpc('get_my_state').then(function (result) {
        if (result.error) return failure(result.error);
        return { ok: true, state: normalizeState(result.data, session) };
      });
    }).catch(function (error) {
      return failure(error);
    });
  }

  function signUp(name, profileType, email, password) {
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, error: 'Supabase no está configurado.', code: 'supabase_not_configured' });
    }
    return getClient().auth.signUp({
      email: String(email || '').trim().toLowerCase(),
      password: password,
      options: {
        data: {
          name: String(name || '').trim(),
          profile_type: profileType
        }
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

  function signIn(email, password) {
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, error: 'Supabase no está configurado.', code: 'supabase_not_configured' });
    }
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

  function signOut() {
    if (!isConfigured()) return Promise.resolve({ ok: true });
    return getClient().auth.signOut().then(function (result) {
      if (result.error) return failure(result.error);
      return { ok: true };
    }).catch(function (error) {
      return failure(error);
    });
  }

  function completeLesson(lessonNumber, ppm, quizOk, seconds) {
    return callRpc('complete_lesson', {
      p_lesson: lessonNumber,
      p_ppm: ppm,
      p_quiz_ok: !!quizOk,
      p_seconds: seconds
    });
  }

  function completeExam(ppm, score, seconds) {
    return callRpc('complete_exam', {
      p_ppm: ppm,
      p_score: score,
      p_seconds: seconds
    });
  }

  function savePractice(ppm, multiplier) {
    return callRpc('save_practice', {
      p_ppm: ppm,
      p_multiplier: multiplier
    });
  }

  function updateProfile(name, avatar) {
    return callRpc('update_profile', {
      p_name: name,
      p_avatar: avatar
    });
  }

  function callRpc(name, args) {
    if (!isConfigured()) {
      return Promise.resolve({ ok: false, error: 'Supabase no está configurado.', code: 'supabase_not_configured' });
    }
    return getClient().rpc(name, args).then(function (result) {
      if (result.error) return failure(result.error);
      return getSession().then(function (session) {
        return { ok: true, state: normalizeState(result.data, session) };
      });
    }).catch(function (error) {
      return failure(error);
    });
  }

  return {
    isConfigured: isConfigured,
    errorMessage: errorMessage,
    getSession: getSession,
    getState: getState,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    completeLesson: completeLesson,
    completeExam: completeExam,
    savePractice: savePractice,
    updateProfile: updateProfile
  };
})();
