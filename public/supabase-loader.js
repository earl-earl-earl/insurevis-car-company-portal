// Supabase Configuration Loader
// This module fetches Supabase configuration from the backend
// to avoid hardcoding credentials in frontend code

let supabaseConfig = null;
let supabaseClient = null;

async function loadSupabaseConfig() {
  if (supabaseConfig) {
    return supabaseConfig;
  }

  try {
    const response = await fetch('/api/config/supabase');
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Failed to load Supabase configuration');
    }
    
    supabaseConfig = {
      url: result.data.url,
      anonKey: result.data.anonKey
    };
    
    return supabaseConfig;
  } catch (error) {
    console.error('Error loading Supabase config:', error);
    throw error;
  }
}

async function getSupabaseClient(options = {}) {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = await loadSupabaseConfig();
  
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Supabase client library not loaded');
  }
  
  supabaseClient = window.supabase.createClient(config.url, config.anonKey, options);
  return supabaseClient;
}

// Export for use in other modules
window.getSupabaseClient = getSupabaseClient;
window.loadSupabaseConfig = loadSupabaseConfig;
