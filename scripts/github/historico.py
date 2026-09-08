#!/usr/bin/env python3
"""Reconstrói a história do Orbe a partir do git. Só leitura — não fala com ninguém.

As datas NÃO saem do texto dos `tasks.md`: percorre-se cada versão commitada de
cada arquivo e registra-se, por tarefa, o primeiro commit em que ela aparece
(nascimento) e o primeiro em que virou `[x]` (conclusão). É a única reconstrução
honesta — e, ao contrário do Jira, o GitHub aceita essas duas datas por API.

Rodar direto imprime o relatório:
    python3 scripts/github/historico.py
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ARTEFATOS = RAIZ / "_bmad-output" / "implementation-artifacts"
DECISOES = RAIZ / "docs" / "decisions"

LINHA_TAREFA = re.compile(r"^\s*-\s*\[([ xX~])\]\s*(.*)$")
ID_TAREFA = re.compile(r"^\*{0,2}(T[0-9][0-9A-Za-z.]*)\*{0,2}\s*[—–:-]?\s*(.*)$")
CABECALHO_FASE = re.compile(r"^#{2,3}\s*(.+?)\s*$")
DATA_ADR = re.compile(r"^\*\*Data:\*\*\s*(\d{4}-\d{2}-\d{2})")

# Metade das tarefas em aberto não é trabalho — é conferência que aconteceu na
# prática e nunca voltou para marcar o checkbox ("Verificar SC-002", "rodar o
# percurso no iOS"). Ganham rótulo próprio para dar para fechar em lote.
VERIFICACAO = re.compile(r"verificar|conferir|validar|validação|npm run|pnpm ", re.IGNORECASE)


def git(*args: str) -> str:
    r = subprocess.run(
        ["git", "-C", str(RAIZ), *args], capture_output=True, text=True, check=False
    )
    return r.stdout if r.returncode == 0 else ""


def rotulo(texto: str) -> str:
    t = re.sub(r"[^\w-]+", "-", texto.lower().strip())
    return re.sub(r"-{2,}", "-", t).strip("-")[:45]


def rotulo_fase(cabecalho: str) -> str:
    """`## Fase 2 — Banco (feita em 06/09…)` → `fase-2`."""
    m = re.match(r"^Fase\s+([\w.]+)", cabecalho.strip(), re.IGNORECASE)
    return f"fase-{rotulo(m.group(1))}" if m else rotulo(cabecalho)[:22].strip("-")


def chave_texto(titulo: str) -> str:
    """Chave estável para tarefa sem ID explícito (`tarefas/` não numera nada)."""
    return "#" + re.sub(r"[^a-z0-9]+", "", titulo.lower())[:48]


def resumo(texto: str, limite: int = 200) -> str:
    t = re.sub(r"\*\*|`|\[|\]\([^)]*\)", "", texto).replace("\n", " ")
    t = re.sub(r"\s{2,}", " ", t).strip()
    corte = re.split(r"(?<=[.;])\s", t)
    s = corte[0] if corte and len(corte[0]) > 15 else t
    return (s[: limite - 1] + "…") if len(s) > limite else s


@dataclass
class Tarefa:
    tid: str
    titulo: str = ""
    corpo: str = ""
    estado: str = " "
    fase: str = ""
    ordem: int = 0
    criada: str | None = None
    resolvida: str | None = None

    @property
    def titulo_issue(self) -> str:
        prefixo = f"{self.tid} — " if not self.tid.startswith("#") else ""
        return prefixo + resumo((self.titulo + " " + self.corpo).strip(), 200 - len(prefixo))

    def rotulos(self, slug: str) -> list[str]:
        ls = ["orbe", rotulo(slug), "historico"]
        if self.fase:
            ls.append(rotulo_fase(self.fase))
        if self.estado != "x" and VERIFICACAO.search(self.titulo):
            ls.append("verificacao")
        if self.estado == "~":
            ls.append("em-andamento")
        return ls


@dataclass
class Epico:
    slug: str
    caminho: Path
    intro: str = ""
    criada: str | None = None
    ultima: str | None = None
    tarefas: dict[str, Tarefa] = field(default_factory=dict)
    descartadas: int = 0

    @property
    def feitas(self) -> int:
        return sum(1 for t in self.tarefas.values() if t.estado == "x")

    @property
    def concluido(self) -> bool:
        return self.feitas == len(self.tarefas)


def analisar(texto: str) -> tuple[dict[str, Tarefa], str]:
    """Uma versão de tasks.md → {id: Tarefa} + o blockquote de abertura."""
    tarefas: dict[str, Tarefa] = {}
    intro: list[str] = []
    fase = ""
    atual: Tarefa | None = None
    viu_tarefa = False

    for linha in texto.splitlines():
        m = LINHA_TAREFA.match(linha)
        if m:
            viu_tarefa = True
            estado, resto = m.group(1).lower(), m.group(2).strip()
            i = ID_TAREFA.match(resto)
            if i:
                tid, titulo = i.group(1), i.group(2).strip() or resto
            else:
                titulo = re.sub(r"^\*{0,2}", "", resto).strip()
                tid = chave_texto(titulo)
            atual = Tarefa(tid=tid, titulo=titulo, estado=estado, fase=fase, ordem=len(tarefas))
            tarefas[tid] = atual
            continue

        if not viu_tarefa and linha.startswith(">"):
            intro.append(linha.lstrip("> ").rstrip())
            continue

        if linha.startswith("#") and (h := CABECALHO_FASE.match(linha)):
            fase = h.group(1)
            atual = None
            continue

        if atual is not None:
            if linha.startswith(("  ", "\t")):
                atual.corpo += ("\n" if atual.corpo else "") + linha.strip()
            elif linha.strip():
                atual = None

    return tarefas, "\n".join(intro).strip()


def percorrer(caminho: Path) -> Epico:
    rel = caminho.relative_to(RAIZ).as_posix()
    ep = Epico(slug=caminho.parent.name, caminho=caminho)
    commits = [l.split(" ", 1) for l in git("log", "--reverse", "--format=%H %aI", "--", rel).splitlines() if l.strip()]
    vivas: set[str] = set()

    for sha, iso in commits:
        texto = git("show", f"{sha}:{rel}")
        if not texto:
            continue
        instantaneo, intro = analisar(texto)
        vivas = set(instantaneo)
        if ep.criada is None:
            ep.criada = iso
        ep.ultima = iso
        if intro:
            ep.intro = intro

        for tid, t in instantaneo.items():
            anterior = ep.tarefas.get(tid)
            if anterior is None:
                t.criada = iso
                ep.tarefas[tid] = t
                anterior = t
            else:
                anterior.titulo, anterior.corpo = t.titulo, t.corpo
                anterior.fase, anterior.estado, anterior.ordem = t.fase, t.estado, t.ordem
            if t.estado == "x" and anterior.resolvida is None:
                anterior.resolvida = iso

    # Só o que está na última versão vira issue. Uma linha que sumiu quase sempre
    # foi REESCRITA, não feita ("Opção A (recomendada)" → "Opção A escolhida em
    # 06/09"), e importar as duas encheria o board de pendência já decidida.
    ep.descartadas = len(set(ep.tarefas) - vivas)
    ep.tarefas = {k: v for k, v in ep.tarefas.items() if k in vivas}
    return ep


def epicos() -> list[Epico]:
    return [percorrer(p) for p in sorted(ARTEFATOS.glob("*/tasks.md"))]


def adrs() -> list[dict]:
    saida = []
    for md in sorted(DECISOES.glob("[0-9]*.md")):
        texto = md.read_text(encoding="utf-8")
        data, status = None, "aceita"
        for linha in texto.splitlines()[:12]:
            if m := DATA_ADR.match(linha):
                data = m.group(1)
            if "**Status:**" in linha:
                cauda = linha.split("**Status:**", 1)[1].strip().lower()
                status = re.split(r"[\s·|]+", cauda)[0] or "aceita"
        if not data:
            data = (git("log", "--reverse", "--format=%aI", "--", md.relative_to(RAIZ).as_posix()).splitlines() or [""])[0][:10]
        if not data:
            continue
        saida.append({
            "titulo": resumo(texto.splitlines()[0].lstrip("# ").strip(), 240),
            "corpo": f"`{md.relative_to(RAIZ).as_posix()}`\n\n" + "\n".join(texto.splitlines()[:60]),
            "data": data,
            "rotulos": ["orbe", "adr", "historico", "superada" if "supera" in status else "aceita"],
        })
    return saida


if __name__ == "__main__":
    eps = epicos()
    print(f"{len(eps)} épicos, {sum(len(e.tarefas) for e in eps)} tarefas, {len(adrs())} ADRs")
    for e in eps:
        andando = sum(1 for t in e.tarefas.values() if t.estado == "~")
        print(f"  {e.slug:28} {len(e.tarefas):3}  {e.feitas:3} done  {andando} wip  "
              f"{(e.criada or '?')[:10]} → {(e.ultima or '?')[:10]}"
              + (f"  (−{e.descartadas} reescritas)" if e.descartadas else ""))
