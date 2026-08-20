/**
 * Config dinâmica: só existe para injetar o que vem do ambiente (`extra`).
 * Todo o resto — plugins, ios, splash, updates — mora em `app.json`, que é
 * espalhado aqui pelo `require` da primeira linha.
 *
 * O `expo-doctor` reclama desta coexistência ("You have an app.json file... the
 * dynamic config may ignore it"). **É falso positivo**, e é a única checagem que
 * ele ainda reprova neste projeto: o aviso existe para quem tem os dois arquivos
 * independentes, caso em que o estático seria de fato ignorado. Aqui o dinâmico
 * lê o estático. Verificado ao alinhar as versões do SDK 54.
 *
 * Antes de "consertar" isso, note que mover tudo para cá quebraria os config
 * plugins e o prebuild, que leem o app config já resolvido.
 */
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
