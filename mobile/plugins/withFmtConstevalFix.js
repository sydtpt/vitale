/**
 * Workaround só de MÁQUINA LOCAL, não afeta a EAS: `fmt` 11.0.2 (dependência
 * transitiva do React Native 0.81.5, usada por Folly/Hermes) usa
 * `consteval` em `FMT_STRING(...)` quando `FMT_USE_CONSTEVAL` resolve para 1.
 * Apple clang 21 (Xcode 26+) ficou mais estrito sobre `consteval` exigir uma
 * constant expression — os call sites de `FMT_STRING` em `format-inl.h` não
 * são, e o build quebra com "call to consteval function ... is not a
 * constant expression".
 *
 * A correção (documentada em vários lugares para esse mesmo erro em
 * RN < 0.83.9 — ver expo-fmt-consteval-fix) é forçar `FMT_USE_CONSTEVAL 0`
 * depois do `pod install`: `fmt` cai para validação em runtime, que já
 * funcionava antes do C++20 existir — o binário final não muda.
 *
 * Remover este plugin quando o mobile subir pra RN ≥ 0.83.9 / Expo SDK 56
 * (que já traz `fmt` 12.1.0, compila limpo no Xcode 26+ sem isso).
 */
const { withPodfile } = require('@expo/config-plugins');

const withFmtConstevalFix = (config) =>
  withPodfile(config, (mod) => {
    let { contents } = mod.modResults;

    if (!contents.includes('FMT_USE_CONSTEVAL')) {
      const anchor = 'post_install do |installer|\n';
      const idx = contents.indexOf(anchor);
      if (idx !== -1) {
        const insertAt = idx + anchor.length;
        const snippet =
          "    fmt_base_header = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')\n" +
          "    if File.exist?(fmt_base_header)\n" +
          "      header_contents = File.read(fmt_base_header)\n" +
          // Indentado dentro de uma cadeia de #elif — o header tem "#  define" (dois
          // espaços), não "#define". Casa só a parte depois do "#" pra não depender
          // de indentação exata.
          "      patched = header_contents.gsub('define FMT_USE_CONSTEVAL 1', 'define FMT_USE_CONSTEVAL 0')\n" +
          "      File.write(fmt_base_header, patched) if patched != header_contents\n" +
          "    end\n";
        contents = contents.slice(0, insertAt) + snippet + contents.slice(insertAt);
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });

module.exports = withFmtConstevalFix;
