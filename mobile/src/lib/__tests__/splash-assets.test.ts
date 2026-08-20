import { describe, it, expect } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const mobileRoot = resolve(__dirname, '../../..');

// app.config.js é a config que o Expo resolve — app.json é só a base que ela espalha.
const expoConfig = (require('../../../app.config.js') as {
  expo: { icon: string; splash?: { image?: string } };
}).expo;

const imagesetDir = join(
  mobileRoot,
  'ios/Orbe/Images.xcassets/SplashScreenLegacy.imageset',
);

/**
 * Hash da arte que gerou o imageset nativo em `mobile/ios/`. Trocar a arte sem
 * rodar `expo prebuild` de novo deixa o app exibindo o asset antigo no cold
 * start — foi assim que o placeholder do template sobreviveu três meses aqui.
 * Desde a ADR 0012, `mobile/ios/` é gerado (não versionado): basta trocar a
 * arte e rodar `expo prebuild` direto em `mobile/` — sem sandbox nem
 * transplante manual, que era o contorno da ADR 0009 (superada).
 *
 * Esta é a asserção que vale em qualquer máquina: a arte de origem é a que se
 * pretende. A conferência do imageset gerado vive separada, mais abaixo.
 */
const ARTE_TRANSPLANTADA_SHA256 =
  '7419a6baa3af84eb96f053a0bf129660c989ae749f665321353d830ffdb7e570';

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Lê largura/altura do IHDR — não vale puxar uma lib de imagem só para isso. */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`não é um PNG: ${path}`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** O Contents.json é o manifesto do imageset — derivar dele pega renomeio e variante dark. */
function pngsDoImageset(): string[] {
  const contents = JSON.parse(
    readFileSync(join(imagesetDir, 'Contents.json'), 'utf8'),
  ) as { images: { filename?: string }[] };

  return contents.images.map((i) => i.filename).filter((f): f is string => !!f);
}

describe('assets da splash', () => {
  it('declara uma splash com arte', () => {
    expect(expoConfig.splash?.image).toBeDefined();
  });

  // Decisão reversível, não invariante técnico: hoje splash e ícone compartilham a arte.
  // Se a splash ganhar arte própria, é este teste que se ajusta — não um bug.
  it('aponta a splash para a mesma arte do ícone', () => {
    expect(expoConfig.splash?.image).toBe(expoConfig.icon);
  });

  it('referencia um arquivo que existe', () => {
    expect(existsSync(join(mobileRoot, expoConfig.splash!.image!))).toBe(true);
  });

  it('mantém a arte de origem igual à que foi transplantada para o imageset nativo', () => {
    expect(sha256(join(mobileRoot, expoConfig.splash!.image!))).toBe(
      ARTE_TRANSPLANTADA_SHA256,
    );
  });

});

/**
 * O imageset é saída do `expo prebuild` e, desde a ADR 0012, não é versionado —
 * num clone limpo `mobile/ios/` simplesmente não existe, e exigi-lo faria a
 * suíte falhar por ausência de artefato gerado, não por defeito.
 *
 * Onde ele existe, ainda vale conferir: um prebuild velho no diretório de
 * trabalho é justamente o que faz o device mostrar a arte antiga enquanto o
 * repositório já tem a nova.
 */
const prebuildFeito = existsSync(imagesetDir);

(prebuildFeito ? describe : describe.skip)('imageset nativo da splash (requer prebuild)', () => {
  it('mantém o imageset nativo na dimensão da arte de origem', () => {
    const origem = pngSize(join(mobileRoot, expoConfig.splash!.image!));
    const pngs = pngsDoImageset();
    expect(pngs.length).toBeGreaterThan(0);

    for (const png of pngs) {
      const alvo = join(imagesetDir, png);
      expect(existsSync(alvo)).toBe(true);
      expect(pngSize(alvo)).toEqual(origem);
    }
  });
});
