module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@vitale/shared': '../packages/shared/src',
          },
        },
      ],
      // Sem `react-native-reanimated/plugin`: a ADR 0010 tirou o Reanimated do
      // projeto e nada em `src/` tem worklet para o plugin transformar. Ele só
      // resolvia por causa da cópia 4.1.7 hoisted por acidente na raiz, que
      // saiu da árvore no SDK 55 (o peer dela para com a RN 0.82).
    ],
  };
};
