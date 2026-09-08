#!/usr/bin/env python3
"""Espelha `sprint-status.yaml` em issues do GitHub. Mão única: a yaml manda.

O GitHub nunca é lido como fonte de verdade sobre o estado de uma story. Quem
escreve esse estado é o `bmad-build`, na yaml — se alguém mexer no rótulo à mão,
a próxima execução desfaz, de propósito.

A exceção é o fechamento: `fixes #42` numa mensagem de commit fecha a issue
nativamente, e isso é bom. A yaml continua sendo quem diz `done`, e o script
reconcilia — issue fechada cujo story ainda não é `done` na yaml volta a abrir.

Escopo necessário: `repo`. O quadro (Projects v2) precisa de `project` e mora
noutro script.

Uso:
  python3 scripts/github/sincronizar_sprint.py            # ensaio
  python3 scripts/github/sincronizar_sprint.py --aplicar
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importar_acervo import REPO, GitHub, token  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
YAML_SPRINT = RAIZ / "_bmad-output" / "implementation-artifacts" / "sprint-status.yaml"
EPICOS_MD = RAIZ / "_bmad-output" / "planning-artifacts" / "epics.md"
MAPA = Path(__file__).resolve().parent / "saida" / "mapa-revista.json"

TITULO_EPICO = re.compile(r"^##\s+Epic\s+(\d+)\s*:\s*(.+?)\s*$")
CHAVE_EPICO = re.compile(r"^epic-(\d+)$")
CHAVE_RETRO = re.compile(r"^epic-(\d+)-retrospective$")
CHAVE_STORY = re.compile(r"^(\d+)-(\d+)-(.+)$")

# Sem o campo Status do Projects, o estado vive em rótulo. Um rótulo por vez.
ROTULO_ESTADO = {
    "backlog": "status:backlog",
    "ready-for-dev": "status:pronta-p-dev",
    "in-progress": "status:em-andamento",
    "review": "status:aguardando-veredito",
    "done": "status:feita",
}
TODOS_ESTADOS = set(ROTULO_ESTADO.values())


def titulos_epicos() -> dict[str, str]:
    """`## Epic 1: A edição` → {"1": "A edição"}."""
    if not EPICOS_MD.exists():
        return {}
    return {
        m.group(1): m.group(2)
        for linha in EPICOS_MD.read_text(encoding="utf-8").splitlines()
        if (m := TITULO_EPICO.match(linha))
    }


def humanizar(chave: str) -> str:
    m = CHAVE_STORY.match(chave)
    return f"{m.group(1)}.{m.group(2)} — " + m.group(3).replace("-", " ") if m else chave


class Sprint(GitHub):
    def marcos(self) -> dict[str, int]:
        saida, pagina = {}, 1
        while lote := self._pedir("GET", f"/repos/{REPO}/milestones?state=all&per_page=100&page={pagina}"):
            saida.update({m["title"]: m["number"] for m in lote})
            pagina += 1
        return saida

    def criar_issue(self, titulo, corpo, rotulos, marco) -> int | None:
        if not self.aplicar:
            return None
        d = {"title": titulo[:250], "body": corpo, "labels": rotulos}
        if marco:
            d["milestone"] = marco
        return self._pedir("POST", f"/repos/{REPO}/issues", d)["number"]

    def issue(self, numero: int) -> dict:
        return self._pedir("GET", f"/repos/{REPO}/issues/{numero}")

    def ajustar(self, numero: int, estado_yaml: str) -> str:
        """Reconcilia rótulo de estado e aberto/fechado com o que a yaml diz."""
        alvo = ROTULO_ESTADO.get(estado_yaml, "status:backlog")
        fechada_alvo = estado_yaml == "done"
        if not self.aplicar:
            return f"→ {alvo}{' + fechar' if fechada_alvo else ''} (ensaio)"

        atual = self.issue(numero)
        rotulos = {l["name"] for l in atual["labels"]}
        mudou = []

        if alvo not in rotulos:
            novos = sorted((rotulos - TODOS_ESTADOS) | {alvo})
            self._pedir("PATCH", f"/repos/{REPO}/issues/{numero}", {"labels": novos})
            mudou.append(alvo)

        fechada = atual["state"] == "closed"
        if fechada != fechada_alvo:
            self._pedir("PATCH", f"/repos/{REPO}/issues/{numero}",
                        {"state": "closed" if fechada_alvo else "open"})
            mudou.append("fechada" if fechada_alvo else "reaberta")

        return " + ".join(mudou) if mudou else "="


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="escreve no GitHub (padrão: ensaio)")
    args = ap.parse_args()

    gh = Sprint(token(), args.aplicar)
    if not args.aplicar:
        print("MODO ENSAIO — nada será escrito.\n")

    estado = yaml.safe_load(YAML_SPRINT.read_text(encoding="utf-8")).get("development_status", {})
    titulos = titulos_epicos()
    mapa = json.loads(MAPA.read_text()) if MAPA.exists() else {}
    marcos = gh.marcos() if args.aplicar else {}
    criados = mexidos = 0

    for chave, valor in estado.items():
        if CHAVE_RETRO.match(chave) or CHAVE_EPICO.match(chave):
            continue
        m = CHAVE_STORY.match(chave)
        if not m:
            continue
        n_ep = m.group(1)
        # O épico é o milestone; ele nasce junto com a primeira story dele.
        marco_nome = f"revista-{n_ep}-{titulos.get(n_ep, 'epico').lower().replace(' ', '-')}"[:60]
        if args.aplicar and marco_nome not in marcos:
            marcos[marco_nome] = gh._pedir(
                "POST", f"/repos/{REPO}/milestones",
                {"title": marco_nome, "description": f"Revista — épico {n_ep}: {titulos.get(n_ep, '')}"},
            )["number"]
            print(f"+ milestone {marco_nome}")

        if chave not in mapa:
            n = gh.criar_issue(
                humanizar(chave),
                f"Story `{chave}` da Revista.\n\n"
                f"Fonte de verdade: `{YAML_SPRINT.relative_to(RAIZ)}`\n"
                f"Este issue é espelho — não edite o estado aqui.",
                ["orbe", "revista", f"epico-{n_ep}"],
                marcos.get(marco_nome),
            )
            if n:
                mapa[chave] = n
            criados += 1
            print(f"+ story {chave[:44]:46} #{n}")

        if chave in mapa:
            r = gh.ajustar(mapa[chave], valor)
            if r != "=":
                mexidos += 1
                print(f"  {chave[:44]:46} #{mapa[chave]:<5} {r}")

    if args.aplicar:
        MAPA.parent.mkdir(parents=True, exist_ok=True)
        MAPA.write_text(json.dumps(mapa, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\n{criados} criadas, {mexidos} ajustadas"
          + ("" if args.aplicar else "  (ensaio — nada gravado)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
