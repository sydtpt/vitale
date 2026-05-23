const base = require('./app.json');

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    // Mantido coerente com lib/supabase.ts, que lê process.env.EXPO_PUBLIC_*.
    extra: {
      ...(base.expo.extra ?? {}),
      eas: {
        projectId: '127be066-b0bb-4469-bd58-d7e5c6c9cd22',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
};
