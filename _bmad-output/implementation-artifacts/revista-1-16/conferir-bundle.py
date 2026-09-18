"""Confere se o bundle Hermes de um .app contém as marcas da Story 1.16.

No molde do `revista-1-9/conferir-bundle.py`, e pela mesma razão (janela da 1.9, §6.1–6.2):
o `.app` tem de sair de uma árvore que contenha a story, e o nome da branch não prova isso.
O Hermes guarda string ASCII na tabela ASCII e string com acento em UTF-16 — por isso `grep`
acha `foto_activity_id` e não acha "Impressa antes de o app guardar o porquê". Aqui as duas
formas são procuradas.

    python3 conferir-bundle.py <caminho>/Orbe.app/main.jsbundle

Sai com código 1 se o arquivo não for bundle Hermes, ou se faltar alguma marca obrigatória:
o veredito não depende de ler a tabela. As marcas da 1.14 (o sumário) estão aqui de
propósito — elas separam um build da `main` de um build da branch da 1.16 feito sem a main.
"""
import sys

if len(sys.argv) != 2:
    print(__doc__)
    sys.exit(2)

caminho = sys.argv[1]
dados = open(caminho, "rb").read()

# O magic do Hermes. Sem ele, o arquivo é JS cru (build Debug, ou o caminho errado) e a
# busca abaixo mediria outra coisa: a string acentuada estaria em UTF-8, não em UTF-16, e o
# veredito sairia falso nos dois sentidos.
HERMES = "c61fbc03"
eh_hermes = dados[:4].hex() == HERMES
print(f"bundle: {caminho}")
print(f"hermes: {eh_hermes}  ({len(dados)/1e6:.1f} MB)\n")
if not eh_hermes:
    print(f"✗ não é bundle Hermes (magic {dados[:4].hex()}, esperado {HERMES}). Confira o caminho —")
    print("  é o main.jsbundle de dentro do Orbe.app de um build Release?")
    sys.exit(1)

# (texto, nota, obrigatória)
marcas = [
    ("foto_activity_id", "coluna nova da 1.16", True),
    ("carimbada_em,motivo,foto_activity_id", "o fim de CAPA_COLUMNS — a leitura pede as duas", True),
    ("Por que esta foto", "o rótulo da ficha", True),
    ("Trocar a capa", "o ato da ficha", True),
    ("Impressa antes de o app guardar o porquê.", "a ficha das capas anteriores à 1.16", True),
    ("Você escolheu esta.", "o porquê da troca", True),
    ("Ver a foto da capa", "o disco, para o VoiceOver", True),
    # Da 1.9 em diante: sem elas o build é de antes da forma que a 1.16 estende.
    ("metrica_lider", "coluna da 1.9 (a base desta)", True),
    # Da 1.14 (o sumário), que está na main: um build da branch sem a main não as tem.
    ("Nesta edição", "o versalete do sumário (1.14)", True),
    ("Rola até este caderno, na mesma página.", "a dica da linha do sumário (1.14)", True),
]

faltam = []
for texto, nota, obrigatoria in marcas:
    ascii_n = dados.count(texto.encode()) if texto.isascii() else 0
    utf16_n = dados.count(texto.encode("utf-16-le"))
    total = ascii_n + utf16_n
    marca = "✓" if total else "·"
    print(f"  {marca} {total:<3} {texto[:44]:<46} {nota}")
    if obrigatoria and not total:
        faltam.append(texto)

if faltam:
    print(f"\n✗ faltam {len(faltam)} marca(s) — este bundle NÃO é da 1.16. Não instale.")
    sys.exit(1)
print("\n✓ o bundle tem a 1.16.")
