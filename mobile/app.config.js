/**
 * Config dinâmica: só existe para injetar o que vem do ambiente (`extra`).
 * Todo o resto — plugins, ios, updates — mora em `app.base.json`, que é
 * espalhado aqui pelo `require` da primeira linha.
 *
 * **O nome do arquivo base é deliberado.** Enquanto ele se chamava `app.json`, o
 * `expo-doctor` reprovava a checagem "Check Expo config for common issues" com
 * "your app.config.js is not using the values from it" — falso positivo, porque
 * o dinâmico lê o estático logo abaixo. Só que um aviso permanentemente vermelho
 * treina todo mundo a ignorar o doctor, e impede usá-lo como portão no CI
 * (AD-17). Renomear elimina a condição que dispara o aviso: não há mais um
 * `app.json` coexistindo com um config dinâmico — há um config dinâmico e a base
 * que ele importa. A config resolvida é idêntica; foi conferida com
 * `expo config --json` antes e depois.
 *
 * Antes de "consertar" isso movendo tudo para cá: os config plugins e o prebuild
 * leem o app config já resolvido, então a separação não os afeta — mas ela
 * mantém o JSON legível por ferramenta, que é o motivo de existir.
 */
const base = require('./app.base.json');

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
