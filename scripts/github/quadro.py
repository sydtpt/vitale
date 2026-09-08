#!/usr/bin/env python3
"""Cria e mantém o quadro do Orbe (Projects v2), com a raia de veredito.

Por que a raia existe: o gargalo medido deste projeto não é planejamento, é
**veredito**. Das 55 tarefas abertas no acervo, 30 são "conferir no aparelho", e
o `CLAUDE.md` e o índice de memórias somam mais 10 pendências do mesmo tipo. O
trabalho fica pronto e empilha esperando alguém olhar — e esse estado não tinha
lugar nenhum onde aparecer.

O que entra no quadro: trabalho **aberto**. As 27 stories da Revista e as 55
tarefas abertas do acervo. As 397 fechadas continuam existindo como issue,
buscáveis, mas fora do quadro — arquivo não é fila.

Escopo necessário: `project` (além de `repo`). Guardado no keychain como
'GitHub Orbe'.

Uso:
  python3 scripts/github/quadro.py            # ensaio
  python3 scripts/github/quadro.py --aplicar
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_DONO, REPO_NOME = os.environ.get("ORBE_REPO", "sydtpt/vitale").split("/")
TITULO = os.environ.get("ORBE_QUADRO", "Orbe")

# A ordem aqui é a ordem das colunas no quadro.
ESTADOS = [
    ("Entrada", "Pedido novo: bug, ideia ou pergunta. Ainda não virou trabalho.", "GRAY"),
    ("Backlog", "Aceito, esperando a vez.", "BLUE"),
    ("Em andamento", "Sendo construído agora.", "YELLOW"),
    ("Aguardando veredito", "Pronto e não conferido. A fila que trava este projeto.", "ORANGE"),
    ("Feita", "Conferida e aceita.", "GREEN"),
]

# Rótulo da issue → coluna. O que o sync da sprint escreve, o quadro lê.
DE_ROTULO = {
    "status:backlog": "Backlog",
    "status:pronta-p-dev": "Backlog",
    "status:em-andamento": "Em andamento",
    "status:aguardando-veredito": "Aguardando veredito",
    "status:feita": "Feita",
    "em-andamento": "Em andamento",
    "verificacao": "Aguardando veredito",
}


def contexto_ssl() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def token() -> str:
    """O token do quadro precisa de `project`, que o do `git push` não tem."""
    if t := os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN"):
        return t
    r = subprocess.run(
        ["security", "find-generic-password", "-s", "GitHub Orbe", "-w"],
        capture_output=True,
        text=True,
    )
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip()
    raise SystemExit(
        "token com escopo `project` não encontrado.\n"
        "  security add-generic-password -s 'GitHub Orbe' -a <email> -w '<token>' -U"
    )


class GQL:
    def __init__(self, tok: str):
        self.tok, self.ssl = tok, contexto_ssl()

    def __call__(self, consulta: str, **variaveis):
        corpo = {"query": consulta, "variables": variaveis}
        req = urllib.request.Request(
            "https://api.github.com/graphql",
            data=json.dumps(corpo).encode(),
            headers={
                "Authorization": f"Bearer {self.tok}",
                "Content-Type": "application/json",
                "User-Agent": "orbe-quadro",
            },
            method="POST",
        )
        for tentativa in range(4):
            try:
                with urllib.request.urlopen(req, timeout=45, context=self.ssl) as r:
                    d = json.loads(r.read().decode())
                break
            except urllib.error.HTTPError as e:
                if e.code in (403, 429) and tentativa < 3:
                    time.sleep(15 * (tentativa + 1))
                    continue
                raise SystemExit(f"GitHub {e.code}: {e.read().decode()[:300]}") from e
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if tentativa < 3:
                    time.sleep(5)
                    continue
                raise SystemExit(f"rede indisponível ({getattr(e, 'reason', e)})") from e
        else:
            raise SystemExit("esgotadas as tentativas")
        if "errors" in d:
            raise SystemExit("GraphQL: " + json.dumps(d["errors"])[:500])
        return d["data"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="escreve (padrão: ensaio)")
    args = ap.parse_args()
    g = GQL(token())
    if not args.aplicar:
        print("MODO ENSAIO — nada será escrito.\n")

    eu = g("query{viewer{id login projectsV2(first:20){nodes{id number title}}}}")["viewer"]
    quadro = next((p for p in eu["projectsV2"]["nodes"] if p["title"] == TITULO), None)

    if not quadro:
        if not args.aplicar:
            print(f"criaria o quadro '{TITULO}'")
            return 0
        quadro = g(
            "mutation($o:ID!,$t:String!){createProjectV2(input:{ownerId:$o,title:$t})"
            "{projectV2{id number title}}}",
            o=eu["id"], t=TITULO,
        )["createProjectV2"]["projectV2"]
        print(f"+ quadro '{TITULO}' criado (#{quadro['number']})")
    else:
        print(f"quadro '{TITULO}' já existe (#{quadro['number']})")

    campos = g(
        "query($p:ID!){node(id:$p){... on ProjectV2{fields(first:30){nodes{"
        "... on ProjectV2FieldCommon{id name}"
        "... on ProjectV2SingleSelectField{id name options{id name}}}}}}}",
        p=quadro["id"],
    )["node"]["fields"]["nodes"]
    status = next((c for c in campos if c.get("name") == "Status"), None)
    if not status:
        raise SystemExit("campo Status não encontrado no quadro")

    tem = [o["name"] for o in status.get("options", [])]
    quer = [n for n, _, _ in ESTADOS]
    if tem != quer:
        print(f"  colunas hoje: {tem}")
        if args.aplicar:
            g(
                "mutation($f:ID!,$o:[ProjectV2SingleSelectFieldOptionInput!]!){"
                "updateProjectV2Field(input:{fieldId:$f,singleSelectOptions:$o})"
                "{projectV2Field{... on ProjectV2SingleSelectField{options{id name}}}}}",
                f=status["id"],
                o=[{"name": n, "description": d, "color": c} for n, d, c in ESTADOS],
            )
            print(f"  colunas ajustadas para: {quer}")
            campos = g(
                "query($p:ID!){node(id:$p){... on ProjectV2{fields(first:30){nodes{"
                "... on ProjectV2SingleSelectField{id name options{id name}}}}}}}",
                p=quadro["id"],
            )["node"]["fields"]["nodes"]
            status = next(c for c in campos if c.get("name") == "Status")
        else:
            print(f"  ajustaria para: {quer}")

    opcao = {o["name"]: o["id"] for o in status.get("options", [])}

    # As issues abertas do repo: a Revista e o que sobrou do acervo. As 397
    # fechadas ficam de fora — arquivo não é fila.
    abertas, cursor = [], None
    while True:
        d = g(
            "query($o:String!,$n:String!,$c:String){repository(owner:$o,name:$n){"
            "issues(first:100,states:OPEN,after:$c){pageInfo{hasNextPage endCursor}"
            "nodes{id number title labels(first:20){nodes{name}}}}}}",
            o=REPO_DONO, n=REPO_NOME, c=cursor,
        )["repository"]["issues"]
        abertas += d["nodes"]
        if not d["pageInfo"]["hasNextPage"]:
            break
        cursor = d["pageInfo"]["endCursor"]

    print(f"\n{len(abertas)} issues abertas no repo")

    # {número da issue: (id do item, coluna em que ele está)} — a coluna atual é o
    # que deixa pular quem já está no lugar. Sem isso o hook de pós-commit gastaria
    # 82 chamadas por commit para não mudar nada.
    ja, cursor = {}, None
    if args.aplicar:
        while True:
            d = g(
                "query($p:ID!,$c:String){node(id:$p){... on ProjectV2{"
                "items(first:100,after:$c){pageInfo{hasNextPage endCursor} "
                "nodes{ id content{... on Issue{number}} "
                "fieldValues(first:20){nodes{... on ProjectV2ItemFieldSingleSelectValue{name}}} }}}}}",
                p=quadro["id"], c=cursor,
            )["node"]["items"]
            for it in d["nodes"]:
                if it["content"]:
                    atual = next((v["name"] for v in it["fieldValues"]["nodes"] if v.get("name")), None)
                    ja[it["content"]["number"]] = (it["id"], atual)
            if not d["pageInfo"]["hasNextPage"]:
                break
            cursor = d["pageInfo"]["endCursor"]

    add = movidos = 0
    for issue in abertas:
        rotulos = [l["name"] for l in issue["labels"]["nodes"]]
        coluna = next((DE_ROTULO[r] for r in rotulos if r in DE_ROTULO), "Backlog")
        if not args.aplicar:
            add += 1
            continue
        item, onde = ja.get(issue["number"], (None, None))
        if not item:
            item = g(
                "mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c})"
                "{item{id}}}",
                p=quadro["id"], c=issue["id"],
            )["addProjectV2ItemById"]["item"]["id"]
            add += 1
        if onde == coluna:
            continue
        g(
            "mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue("
            "input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}})"
            "{projectV2Item{id}}}",
            p=quadro["id"], i=item, f=status["id"], o=opcao[coluna],
        )
        movidos += 1
        if movidos % 25 == 0:
            print(f"  {movidos}…", flush=True)

    print(f"\n{add} adicionadas, {movidos} movidas de coluna"
          + ("" if args.aplicar else "  (ensaio)"))
    if args.aplicar:
        print(f"\nhttps://github.com/users/{eu['login']}/projects/{quadro['number']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
