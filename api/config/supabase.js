const { supabaseUrl, supabaseAnonKey } = require('../../supabase_config');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({
    success: true,
    data: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    }
  });
};
