#!/usr/bin/env python3
"""Importa a história do Orbe como issues do GitHub, com as datas reais.

O que o Jira só aceitava por assistente web, o GitHub aceita por API: a rota
`import/issues` (golden-comet) grava `created_at` e `closed_at`. Medido em
09/09/2026 — uma issue nasceu carimbada 19/05/2026.

Desenho:
  milestone = épico   (18, com barra de progresso nativa)
  issue     = tarefa  (452, com data de nascimento e de conclusão reais)
  rótulos   = orbe · <feature> · historico · fase-N · verificacao · em-andamento

O token sai do keychain que o `git push` já usa — não há segredo novo a guardar.
Escopo `repo` basta; `project` só é preciso para o quadro, não para as issues.

Uso:
  python3 scripts/github/importar_acervo.py                  # ensaio
  python3 scripts/github/importar_acervo.py --aplicar --limite 3
  python3 scripts/github/importar_acervo.py --aplicar        # tudo
  python3 scripts/github/importar_acervo.py --aplicar --adrs # + as 46 ADRs
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import historico as H  # noqa: E402

REPO = os.environ.get("ORBE_REPO", "sydtpt/vitale")
ESTADO = Path(__file__).resolve().parent / "saida" / "importado.json"
GOLDEN = "application/vnd.github.golden-comet-preview+json"


def contexto_ssl() -> ssl.SSLContext:
    """O Python do python.org no macOS não usa o chaveiro do sistema."""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def token() -> str:
    """O mesmo token que o `git push` usa. Nada novo para guardar nem vazar."""
    if t := os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN"):
        return t
    r = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
    )
    for linha in r.stdout.splitlines():
        if linha.startswith("password="):
            return linha.split("=", 1)[1]
    raise SystemExit("token do GitHub não encontrado (nem GITHUB_TOKEN nem no keychain do git)")


class GitHub:
    def __init__(self, tok: str, aplicar: bool):
        self.tok, self.aplicar, self.ssl = tok, aplicar, contexto_ssl()

    def _pedir(self, metodo: str, caminho: str, corpo=None, accept="application/vnd.github+json"):
        req = urllib.request.Request(
            f"https://api.github.com{caminho}",
            data=json.dumps(corpo).encode() if corpo is not None else None,
            headers={
                "Authorization": f"Bearer {self.tok}",
                "Accept": accept,
                "Content-Type": "application/json",
                "User-Agent": "orbe-acervo",
            },
            method=metodo,
        )
        for tentativa in range(5):
            try:
                with urllib.request.urlopen(req, timeout=45, context=self.ssl) as r:
                    bruto = r.read().decode()
                    return json.loads(bruto) if bruto.strip() else {}
            except urllib.error.HTTPError as e:
                corpo_erro = e.read().decode()[:300]
                # 403/429 aqui é limite secundário de criação de conteúdo, não falta
                # de permissão: o GitHub pede que a gente desacelere, e a espera
                # dobra a cada tentativa.
                if e.code in (403, 429) and tentativa < 4:
                    espera = 20 * (tentativa + 1)
                    print(f"    limite atingido; esperando {espera}s…", flush=True)
                    time.sleep(espera)
                    continue
                raise SystemExit(f"GitHub {e.code} em {metodo} {caminho}\n{corpo_erro}") from e
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if tentativa < 4:
                    time.sleep(5 * (tentativa + 1))
                    continue
                raise SystemExit(f"rede indisponível ({getattr(e, 'reason', e)})") from e
        raise SystemExit("esgotadas as tentativas")

    def milestones(self) -> dict[str, int]:
        saida, pagina = {}, 1
        while True:
            lote = self._pedir("GET", f"/repos/{REPO}/milestones?state=all&per_page=100&page={pagina}")
            if not lote:
                break
            saida.update({m["title"]: m["number"] for m in lote})
            pagina += 1
        return saida

    def criar_milestone(self, titulo: str, descricao: str) -> int | None:
        if not self.aplicar:
            return None
        m = self._pedir("POST", f"/repos/{REPO}/milestones",
                        {"title": titulo, "description": descricao[:255]})
        return m["number"]

    def importar(self, issue: dict) -> str | None:
        if not self.aplicar:
            return None
        r = self._pedir("POST", f"/repos/{REPO}/import/issues", {"issue": issue}, accept=GOLDEN)
        return r.get("url")

    def estado_import(self, url: str) -> dict:
        caminho = url.replace("https://api.github.com", "")
        return self._pedir("GET", caminho, accept=GOLDEN)


def iso(d: str | None) -> str | None:
    return d if not d else d.replace("+00:00", "Z")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="escreve no GitHub (padrão: ensaio)")
    ap.add_argument("--limite", type=int, help="importa só as N primeiras (prova antes do lote)")
    ap.add_argument("--adrs", action="store_true", help="importa também as 46 ADRs")
    args = ap.parse_args()

    gh = GitHub(token(), args.aplicar)
    feito = json.loads(ESTADO.read_text()) if ESTADO.exists() else {}
    if not args.aplicar:
        print("MODO ENSAIO — nada será escrito.\n")

    eps = H.epicos()
    marcos = gh.milestones() if args.aplicar else {}
    pendentes: list[tuple[str, dict]] = []

    for ep in eps:
        titulo = ep.slug
        if args.aplicar and titulo not in marcos:
            n = gh.criar_milestone(titulo, f"{ep.feitas}/{len(ep.tarefas)} tarefas · {ep.caminho.relative_to(H.RAIZ)}")
            marcos[titulo] = n
            print(f"+ milestone {titulo} (#{n})")
        numero = marcos.get(titulo)

        for t in sorted(ep.tarefas.values(), key=lambda x: x.ordem):
            chave = f"{ep.slug}:{t.tid}"
            if chave in feito:
                continue
            corpo = (t.titulo + ("\n\n" + t.corpo if t.corpo else ""))
            corpo += f"\n\n---\n`{ep.caminho.relative_to(H.RAIZ).as_posix()}`"
            issue = {
                "title": t.titulo_issue[:250],
                "body": corpo[:60000],
                "created_at": iso(t.criada),
                "labels": t.rotulos(ep.slug),
                "closed": t.estado == "x",
            }
            if t.estado == "x" and t.resolvida:
                issue["closed_at"] = iso(t.resolvida)
            if numero:
                issue["milestone"] = numero
            pendentes.append((chave, issue))

    if args.adrs:
        for a in H.adrs():
            chave = f"adr:{a['titulo'][:40]}"
            if chave in feito:
                continue
            pendentes.append((chave, {
                "title": a["titulo"][:250],
                "body": a["corpo"][:60000],
                "created_at": a["data"] + "T12:00:00Z",
                "closed_at": a["data"] + "T12:00:00Z",
                "closed": True,
                "labels": a["rotulos"],
            }))

    if args.limite:
        pendentes = pendentes[: args.limite]

    print(f"{len(pendentes)} issues a importar ({len(feito)} já feitas)")
    if not args.aplicar:
        for chave, i in pendentes[:5]:
            print(f"  {i['created_at'][:10]}  {'✓' if i['closed'] else '·'}  {i['title'][:70]}")
        print("  …" if len(pendentes) > 5 else "")
        return 0

    enviados: list[tuple[str, str]] = []
    for n, (chave, issue) in enumerate(pendentes, 1):
        url = gh.importar(issue)
        enviados.append((chave, url))
        if n % 25 == 0 or n == len(pendentes):
            print(f"  enviadas {n}/{len(pendentes)}", flush=True)
        # O GitHub pede no máximo ~80 criações de conteúdo por minuto. 0,75 s dá 80
        # cravados; ir mais rápido só troca envio por espera de backoff.
        time.sleep(0.75)

    print("aguardando o GitHub processar…")
    time.sleep(5)
    ok = falhou = 0
    for chave, url in enviados:
        try:
            st = gh.estado_import(url)
        except SystemExit:
            falhou += 1
            continue
        if st.get("status") == "imported" and st.get("issue_url"):
            feito[chave] = int(st["issue_url"].rsplit("/", 1)[1])
            ok += 1
        elif st.get("status") == "failed":
            falhou += 1
            print(f"  ✗ {chave}: {str(st.get('errors'))[:160]}")
        else:
            # ainda 'pending': fica de fora do estado e entra na próxima execução
            falhou += 1

    ESTADO.parent.mkdir(parents=True, exist_ok=True)
    ESTADO.write_text(json.dumps(feito, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{ok} importadas, {falhou} pendentes/falhas. Rode de novo para as que faltarem.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
