'use strict';

const SUPABASE_URL = 'https://vvnsludqdidnqpbzzgeb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bnNsdWRxZGlkbnFwYnp6Z2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg3MjIsImV4cCI6MjA3MDcyNDcyMn0.aFtPK2qhVJw3z324PjuM-q7e5_4J55mgm7A2fqkLO3c';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true
  }
});

const ROLE_ROUTES = {
  car_company: '/car-company/',
  'car-company': '/car-company/',
  'car company': '/car-company/',
  insurance_company: '/insurance-company/',
  'insurance-company': '/insurance-company/',
  'insurance company': '/insurance-company/',
  admin: '/admin-signup/',
  administrator: '/admin-signup/'
};

let isRedirecting = false;

function qs(id) {
  return document.getElementById(id);
}

function showMessage(message, variant = 'info') {
  const messageEl = qs('loginMessage');
  if (!messageEl) return;
  messageEl.textContent = message || '';
  messageEl.className = `status-message${variant ? ` ${variant}` : ''}`;
}

function setLoading(isLoading) {
  const button = qs('loginSubmit');
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle('loading', isLoading);
}

function togglePasswordVisibility(button) {
  const input = qs('password');
  if (!input) return;
  const currentlyHidden = input.type === 'password';
  input.type = currentlyHidden ? 'text' : 'password';
  button.setAttribute('aria-label', currentlyHidden ? 'Hide password' : 'Show password');
  const icon = button.querySelector('i');
  if (icon) {
    icon.classList.toggle('fa-eye', !currentlyHidden);
    icon.classList.toggle('fa-eye-slash', currentlyHidden);
  }
}

function normalizeRole(role) {
  if (!role) return null;
  const normalized = `${role}`.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('car') && normalized.includes('company')) {
    return 'car_company';
  }
  if (normalized.includes('insurance') && normalized.includes('company')) {
    return 'insurance_company';
  }
  if (normalized.includes('admin')) {
    return 'admin';
  }
  return ROLE_ROUTES[normalized] ? normalized : null;
}

function extractRoleFromMetadata(user) {
  if (!user) return null;
  const { app_metadata: appMeta = {}, user_metadata: userMeta = {} } = user;
  const candidates = [];
  if (appMeta.role) candidates.push(appMeta.role);
  if (appMeta.portal_role) candidates.push(appMeta.portal_role);
  if (appMeta.portalRole) candidates.push(appMeta.portalRole);
  if (Array.isArray(appMeta.roles) && appMeta.roles.length > 0) candidates.push(appMeta.roles[0]);
  if (userMeta.role) candidates.push(userMeta.role);
  if (userMeta.portal_role) candidates.push(userMeta.portal_role);
  if (userMeta.portalRole) candidates.push(userMeta.portalRole);
  if (Array.isArray(userMeta.roles) && userMeta.roles.length > 0) candidates.push(userMeta.roles[0]);
  for (const candidate of candidates) {
    const normalized = normalizeRole(candidate);
    if (normalized) return normalized;
  }
  return null;
}

async function attemptRoleLookup(user, table, column) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return normalizeRole(data[column]);
  } catch (err) {
    // Table might not exist – ignore and continue.
    console.debug(`Role lookup skipped for ${table}.${column}:`, err.message || err);
    return null;
  }
}

async function resolveUserRole(user) {
  if (!user) return null;
  const metaRole = extractRoleFromMetadata(user);
  if (metaRole) return metaRole;

  const fallbackSources = [
    { table: 'profiles', column: 'role' },
    { table: 'portal_profiles', column: 'role' },
    { table: 'user_profiles', column: 'role' }
  ];

  for (const source of fallbackSources) {
    const role = await attemptRoleLookup(user, source.table, source.column);
    if (role) return role;
  }

  return null;
}

function redirectTo(path) {
  if (!path || isRedirecting) return;
  isRedirecting = true;
  window.location.replace(path);
}

async function redirectForUser(user, { silent = false } = {}) {
  const normalizedRole = await resolveUserRole(user);
  if (!normalizedRole) {
    if (!silent) {
      showMessage(
        'Your account does not have a portal role assigned. Please contact the InsureVis support team to request access.',
        'error'
      );
      setLoading(false);
    }
    return;
  }

  const destination = ROLE_ROUTES[normalizedRole];
  if (!destination) {
    if (!silent) {
      showMessage('Unsupported role detected for this portal.', 'error');
      setLoading(false);
    }
    return;
  }

  redirectTo(destination);
}

async function checkExistingSession() {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (session?.user) {
      await redirectForUser(session.user, { silent: true });
    }
  } catch (error) {
    console.error('Failed to restore session:', error);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = qs('email')?.value.trim();
  const password = qs('password')?.value;
  const remember = qs('remember')?.checked ?? true;

  if (!email || !password) {
    showMessage('Enter your email address and password to continue.', 'error');
    return;
  }

  setLoading(true);
  showMessage('Signing you in…');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    const user = data?.user || (await supabase.auth.getUser()).data?.user;
    if (!user) {
      throw new Error('Authentication succeeded but no user data was returned.');
    }

    await redirectForUser(user);
  } catch (error) {
    const message =
      error.message === 'Invalid login credentials'
        ? 'The email or password you entered is incorrect.'
        : error.message || 'Unable to sign you in right now. Please try again.';
    console.error('Login error:', error);
    showMessage(message, 'error');
    setLoading(false);
  }
}

async function handlePasswordReset(event) {
  event.preventDefault();
  const email = qs('email')?.value.trim();
  if (!email) {
    showMessage('Enter your email first so we can send reset instructions.', 'error');
    return;
  }

  setLoading(true);
  showMessage('Sending password reset instructions…');

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    });
    if (error) throw error;
    showMessage('Check your inbox for a password reset email.', 'success');
  } catch (error) {
    console.error('Password reset error:', error);
    showMessage(error.message || 'Unable to send reset instructions right now.', 'error');
  } finally {
    setLoading(false);
  }
}

function wireEvents() {
  const form = qs('loginForm');
  const toggleButton = document.querySelector('.toggle-password');
  const forgotLink = qs('forgotPasswordLink');

  form?.addEventListener('submit', handleLogin, { passive: false });
  toggleButton?.addEventListener('click', () => togglePasswordVisibility(toggleButton));
  forgotLink?.addEventListener('click', handlePasswordReset);
}

async function bootstrap() {
  wireEvents();
  await checkExistingSession();
}

bootstrap();

supabase.auth.onAuthStateChange((event, session) => {
  // Don't redirect on SIGNED_OUT events to avoid redirect loops
  if (event === 'SIGNED_OUT') {
    return;
  }
  if (session?.user) {
    redirectForUser(session.user, { silent: true });
  }
});
