# Spec: Mobile — Tab Mais

## Objetivo

Ponto de entrada para módulos secundários e configurações do app. Não é um dashboard — é navegação.

## Status: 🔧 Estrutura criada

## Layout

```
┌─────────────────────────────┐
│  Mais                       │
├─────────────────────────────┤
│  🎯 Metas                   │  ─┐
│  3 metas em progresso  >    │   │ Links para módulos
├─────────────────────────────┤   │ secundários
│  💰 Finanças                │   │
│  R$ 3.2k gastos este mês >  │  ─┘
├─────────────────────────────┤
│  📊 Relatórios              │  ← Acesso a views analíticas (futuro)
├─────────────────────────────┤
│  ⚙️  Configurações          │
│     Perfil e preferências > │
├─────────────────────────────┤
│  Versão 0.1.0               │
└─────────────────────────────┘
```

## Seções

### Links de módulos
- **Metas:** card com N metas em progresso, % de conclusão
- **Finanças:** card com gasto do mês atual

### Configurações
- Perfil: nome, foto, metas de macros, metas de treino
- Preferências: notificações, tema (claro/escuro — futuro)
- Dados: exportar dados, limpar dados

### Sobre
- Versão do app
- Link para feedback

## Próximos passos
- [ ] Tela de Metas (mobile) — lista de metas com progresso
- [ ] Tela de Finanças (mobile) — resumo do mês
- [ ] Tela de Configurações com edição de metas de macros/treino
- [ ] Autenticação → foto de perfil, nome do usuário
