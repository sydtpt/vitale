# Registros de decisão arquitetural (ADR)

Cada decisão de peso do Orbe mora aqui, uma por arquivo, numerada em ordem de criação: `0001-titulo-em-kebab-case.md`.

## A regra que faz isso não apodrecer

**ADR é append-only e imutável.** Mudar de ideia não edita o arquivo existente — escreve-se um novo que supersede o anterior, citando-o. Um ADR registra o que foi decidido *naquele momento*, com o que se sabia *naquele momento*; reescrever isso destrói o registro.

Por isso não existe ADR "desatualizada". Existe ADR superada.

## Forma

```markdown
# NNNN — Título da decisão

**Status:** aceita · superada por [NNNN](NNNN-outra.md)
**Data:** AAAA-MM-DD

## Contexto
O que era verdade quando a decisão foi tomada.

## Decisão
O que foi decidido.

## Alternativas rejeitadas
O que mais estava na mesa e por que perdeu.

## Consequências
O que isso custa, e o que custa reverter.
```

A seção de alternativas rejeitadas é a que mais paga com o tempo: sem ela, alguém — humano ou agente — refaz a análise do zero e às vezes chega a uma resposta pior.

Ver AD-11 na [espinha arquitetural](../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md).
