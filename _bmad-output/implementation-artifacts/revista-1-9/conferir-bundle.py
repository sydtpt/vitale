"""Confere se o bundle Hermes de um .app contém as marcas da Story 1.9.

O Hermes guarda string ASCII na tabela ASCII e string com acento em UTF-16 —
por isso `grep` acha `metrica_lider` e não acha "A impressão está parada".
Aqui as duas formas são procuradas.
"""
import sys

caminho = sys.argv[1]
dados = open(caminho, "rb").read()

print(f"bundle: {caminho}")
print(f"hermes: {dados[:4].hex() == 'c61fbc03'}  ({len(dados)/1e6:.1f} MB)\n")

marcas = [
    ("metrica_lider", "coluna nova da 1.9"),
    ("edicoes_capa", "tabela nova da 1.9"),
    ("A impressão está parada", "a frase provisória (lugar do botão)"),
    ("Este período fechou e ainda não foi escrito", "o vazio do período fechado"),
    ("user_id,tipo_periodo,inicio,fim,caderno", "a chave nova do upsert"),
    ("ordenarCadernos", "PROIBIDO na tela (barreira da 1.9)"),
]

for texto, nota in marcas:
    ascii_n = dados.count(texto.encode()) if texto.isascii() else 0
    utf16_n = dados.count(texto.encode("utf-16-le"))
    total = ascii_n + utf16_n
    marca = "✓" if total else "·"
    print(f"  {marca} {total:<3} {texto[:44]:<46} {nota}")
