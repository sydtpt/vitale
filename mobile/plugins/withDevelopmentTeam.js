/**
 * Fixa o Development Team da assinatura no projeto gerado.
 *
 * Desde a ADR 0012, `mobile/ios/` é saída de `expo prebuild` e não é
 * versionado — então qualquer coisa configurada à mão no Xcode desaparece no
 * próximo prebuild. O time de assinatura é uma dessas coisas, e sem ele o
 * build local para device falha com:
 *
 *   error: Signing for "Orbe" requires a development team. Select a
 *   development team in the Signing & Capabilities editor.
 *
 * Isso não aparecia enquanto os builds eram feitos na EAS, que injeta as
 * credenciais por fora. Com a cota esgotada, o build local por cabo (o
 * fallback que a ADR 0009 já documentava) passa a ser o caminho normal — e
 * precisa funcionar sem ninguém lembrar de passar `DEVELOPMENT_TEAM=` na
 * linha de comando toda vez.
 *
 * O valor vem de `APPLE_TEAM_ID` quando definido, senão do time da conta de
 * desenvolvimento usada aqui (o campo OU do certificado de assinatura). Ele
 * não é segredo — aparece em qualquer .ipa assinado — mas o override por
 * ambiente mantém o repositório utilizável por outra conta.
 */
const { withXcodeProject } = require('expo/config-plugins');

const TEAM_PADRAO = 'W768FLT59N';

module.exports = function withDevelopmentTeam(config) {
  return withXcodeProject(config, (mod) => {
    const team = process.env.APPLE_TEAM_ID || TEAM_PADRAO;
    const project = mod.modResults;
    const configuracoes = project.pbxXCBuildConfigurationSection();

    for (const chave of Object.keys(configuracoes)) {
      const bloco = configuracoes[chave];
      // A seção mistura objetos de configuração com comentários (`chave_comment`).
      if (!bloco || typeof bloco !== 'object' || !bloco.buildSettings) continue;
      // Só o target do app; os pods não assinam.
      if (bloco.buildSettings.PRODUCT_NAME === undefined) continue;
      bloco.buildSettings.DEVELOPMENT_TEAM = `"${team}"`;
    }

    return mod;
  });
};
