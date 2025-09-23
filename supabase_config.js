const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - matches your Flutter app
const supabaseUrl = 'https://vvnsludqdidnqpbzzgeb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bnNsdWRxZGlkbnFwYnp6Z2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg3MjIsImV4cCI6MjA3MDcyNDcyMn0.aFtPK2qhVJw3z324PjuM-q7e5_4J55mgm7A2fqkLO3c';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase };
