'use strict';

const SUPABASE_URL = 'https://vvnsludqdidnqpbzzgeb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bnNsdWRxZGlkbnFwYnp6Z2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg3MjIsImV4cCI6MjA3MDcyNDcyMn0.aFtPK2qhVJw3z324PjuM-q7e5_4J55mgm7A2fqkLO3c';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    detectSessionInUrl: true
  }
});

const ROLE_LABELS = {
  admin: 'Platform administrator',
  'car-company': 'Car company partner',
  'insurance-company': 'Insurance company partner'
};

function normalizeSelection(role) {
  if (!role) return { dbRole: 'user', metadataRole: 'user' };

  const metadataRole = `${role}`
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');

  if (metadataRole.includes('car') && metadataRole.includes('company')) {
    return { dbRole: 'car_company', metadataRole: 'car-company' };
  }

  if (metadataRole.includes('insurance') && metadataRole.includes('company')) {
    return { dbRole: 'insurance_company', metadataRole: 'insurance-company' };
  }

  if (metadataRole.includes('admin')) {
    return { dbRole: 'admin', metadataRole: 'admin' };
  }

  return { dbRole: 'user', metadataRole: metadataRole || 'user' };
}

function qs(id) {
  return document.getElementById(id);
}

function showMessage(message, variant = 'info') {
  const banner = qs('signupMessage');
  if (!banner) return;
  banner.textContent = message || '';
  banner.className = `status-message${variant ? ` ${variant}` : ''}`;
}

function setLoading(isLoading) {
  const button = qs('signupSubmit');
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle('loading', isLoading);
}

function validatePayload(email, password, confirmPassword, role) {
  if (!email) {
    showMessage('Enter an email address to continue.', 'error');
    return false;
  }

  if (!password || password.length < 8) {
    showMessage('Choose a password with at least 8 characters.', 'error');
    return false;
  }

  if (password !== confirmPassword) {
    showMessage('Passwords do not match. Please re-enter and try again.', 'error');
    return false;
  }

  if (!role) {
    showMessage('Select the portal role that should be assigned to this account.', 'error');
    return false;
  }

  return true;
}

async function handleSignup(event) {
  event.preventDefault();
  const email = qs('adminEmail')?.value.trim();
  const password = qs('adminPassword')?.value;
  const confirmPassword = qs('confirmPassword')?.value;
  const selectedRole = qs('portalRole')?.value;
  const { dbRole, metadataRole } = normalizeSelection(selectedRole);

  if (!validatePayload(email, password, confirmPassword, dbRole)) {
    return;
  }

  setLoading(true);
  showMessage('Creating account…');

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: dbRole,
          portal_role: metadataRole,
          portalRole: metadataRole
        },
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      throw error;
    }

    const createdUser = data?.user;
    if (createdUser) {
      await supabase.auth
        .updateUser({
          data: {
            role: dbRole,
            portal_role: metadataRole,
            portalRole: metadataRole
          }
        })
        .catch(() => null);
    }

    const roleName = ROLE_LABELS[metadataRole] || 'new user';
    if (createdUser?.email_confirmed_at) {
      showMessage(`Account created successfully. The ${roleName} can now sign in.`, 'success');
    } else {
      showMessage(
        `Account request sent. Ask the ${roleName} to check ${email} for the confirmation email.`,
        'success'
      );
    }

    await supabase.auth.signOut({ scope: 'local' }).catch(() => null);
    event.target.reset();
  } catch (signupError) {
    console.error('Signup error:', signupError);
    const code = signupError?.code;
    const message =
      code === 'user_already_exists'
        ? 'An account with this email already exists.'
        : signupError.message || 'Unable to create the account right now. Please try again later.';
    showMessage(message, 'error');
  } finally {
    setLoading(false);
  }
}

function wireEvents() {
  const form = qs('signupForm');
  form?.addEventListener('submit', handleSignup, { passive: false });
  
  const logoutButton = qs('logoutButton');
  logoutButton?.addEventListener('click', async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut({ scope: 'global' });
      // Clear all local storage related to Supabase
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      // Force navigation to login with href (not replace) to ensure fresh page load
      window.location.href = '/';
    }
  });
}

function init() {
  wireEvents();
  showMessage('Enter the administrator details to provision a new account.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
