#!/usr/bin/env python3
"""Cria o campo de iteração (a sprint) e as sete views do quadro do Orbe.

Duas dimensões independentes, e é de propósito:
    milestone = o QUÊ  (a feature/épico)
    iteração  = o QUANDO (a sprint)
Usar milestone como sprint custaria a dimensão de feature, que já está povoada
com 22 marcos. Nos filtros, `iteration:@current` diz "a sprint de agora" sem
precisar reescrever o filtro toda semana.

LIMITE DA API: view aceita layout e filtro por mutation, mas **agrupamento e
ordenação não** — `ProjectV2ViewConfigurationInput` só expõe `visibleFieldIds`.
As duas views que pedem agrupamento ficam criadas e filtradas; o "Group by" é
um clique no navegador. O script diz quais.

Uso:
  python3 scripts/github/views.py            # ensaio
  python3 scripts/github/views.py --aplicar
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quadro import GQL, TITULO, token  # noqa: E402

SEMANAS = 8
DURACAO = 7

# (nome, layout, filtro, agrupar-por-no-navegador)
VIEWS = [
    ("Hoje", "BOARD_LAYOUT", "is:open", None),
    ("Aguardando veredito", "TABLE_LAYOUT", 'is:open status:"Aguardando veredito"', None),
    ("Sprint atual", "BOARD_LAYOUT", "is:open iteration:@current", None),
    ("Entrada", "TABLE_LAYOUT", "is:open -label:revista -label:historico", None),
    ("Por feature", "TABLE_LAYOUT", "is:open", "Milestone"),
    ("Linha do tempo", "ROADMAP_LAYOUT", "is:open", None),
    ("Acervo", "TABLE_LAYOUT", "is:closed label:historico", "Milestone"),
]


def segunda_desta_semana() -> dt.date:
    h = dt.date.today()
    return h - dt.timedelta(days=h.weekday())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="escreve (padrão: ensaio)")
    args = ap.parse_args()
    g = GQL(token())
    if not args.aplicar:
        print("MODO ENSAIO — nada será escrito.\n")

    eu = g("query{viewer{login projectsV2(first:20){nodes{id number title}}}}")["viewer"]
    quadro = next((p for p in eu["projectsV2"]["nodes"] if p["title"] == TITULO), None)
    if not quadro:
        raise SystemExit(f"quadro '{TITULO}' não existe — rode antes o quadro.py --aplicar")

    estado = g(
        "query($p:ID!){node(id:$p){... on ProjectV2{"
        "fields(first:30){nodes{... on ProjectV2FieldCommon{id name}}} "
        "views(first:30){nodes{id name}} }}}",
        p=quadro["id"],
    )["node"]
    campos = {c["name"]: c["id"] for c in estado["fields"]["nodes"] if c.get("name")}
    views = {v["name"]: v["id"] for v in estado["views"]["nodes"]}

    # ── o campo de iteração ────────────────────────────────────────────────
    if "Sprint" in campos:
        print("campo 'Sprint' já existe")
    else:
        inicio = segunda_desta_semana()
        lista = [
            {
                "startDate": (inicio + dt.timedelta(days=DURACAO * i)).isoformat(),
                "duration": DURACAO,
                "title": f"Semana de {(inicio + dt.timedelta(days=DURACAO * i)):%d/%m}",
            }
            for i in range(SEMANAS)
        ]
        print(f"criaria campo 'Sprint': {SEMANAS} iterações de {DURACAO} dias, "
              f"a partir de {inicio:%d/%m/%Y} (segunda)")
        if args.aplicar:
            g(
                "mutation($p:ID!,$c:ProjectV2IterationFieldConfigurationInput!){"
                "createProjectV2Field(input:{projectId:$p,dataType:ITERATION,name:\"Sprint\","
                "iterationConfiguration:$c}){projectV2Field{... on ProjectV2FieldCommon{id name}}}}",
                p=quadro["id"],
                c={"startDate": inicio.isoformat(), "duration": DURACAO, "iterations": lista},
            )
            print(f"+ campo 'Sprint' criado — a de agora é '{lista[0]['title']}'")

    # ── as views ───────────────────────────────────────────────────────────
    cliques = []
    for nome, layout, filtro, agrupar in VIEWS:
        if nome in views:
            vid = views[nome]
            acao = "="
        elif args.aplicar:
            vid = g(
                "mutation($p:ID!,$n:String!,$l:ProjectV2ViewLayout!){"
                "createProjectV2View(input:{projectId:$p,name:$n,layout:$l}){projectV2View{id name}}}",
                p=quadro["id"], n=nome, l=layout,
            )["createProjectV2View"]["projectV2View"]["id"]
            acao = "criada"
        else:
            print(f"  criaria {nome:22} {layout:15} filtro: {filtro}")
            if agrupar:
                cliques.append((nome, agrupar))
            continue

        if args.aplicar:
            g(
                "mutation($v:ID!,$f:String!){updateProjectV2View(input:{viewId:$v,filter:$f})"
                "{projectV2View{id}}}",
                v=vid, f=filtro,
            )
            print(f"  {acao:8} {nome:22} {layout:15} {filtro}")
        if agrupar:
            cliques.append((nome, agrupar))

    if cliques:
        print("\nFaltam dois cliques seus (a API não configura agrupamento):")
        for nome, por in cliques:
            print(f"  view '{nome}' → ⋯ → Group by → {por}")

    if args.aplicar:
        print(f"\nhttps://github.com/users/{eu['login']}/projects/{quadro['number']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
