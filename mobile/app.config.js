const base = require('./app.json');

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    // Mantido coerente com lib/supabase.ts, que lê process.env.EXPO_PUBLIC_*.
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
};
