require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - loaded from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase, supabaseUrl, supabaseAnonKey };
