# Spec: Backend / API

## Status: ⏳ Planejamento futuro

## Objetivo

API que persiste os dados da plataforma Rotina, autentica o usuário e sincroniza entre web e mobile em tempo real.

## Opções de stack (a decidir)

| Opção | Stack | Prós | Contras |
|-------|-------|------|---------|
| **A** | Node.js + Fastify + PostgreSQL | Controle total, TypeScript, performático | Mais código a manter |
| **B** | Supabase (BaaS) | Rápido para começar, auth incluso, real-time | Dependência de plataforma externa |
| **C** | Firebase | Auth fácil, Firestore real-time, push notifications | NoSQL (schema flexível demais), custo |

**Recomendação:** Opção B (Supabase) para MVP — auth, banco PostgreSQL gerenciado, real-time e storage em uma plataforma.

## Endpoints necessários (REST)

### Auth
```
POST /auth/register
POST /auth/login
POST /auth/refresh
DELETE /auth/logout
```

### Alimentação
```
GET    /meals?date=YYYY-MM-DD
POST   /meals
PATCH  /meals/:id
DELETE /meals/:id
GET    /water?date=YYYY-MM-DD
PATCH  /water/:date
```

### Treinos
```
GET    /treinos?week=YYYY-WW
POST   /treinos
PATCH  /treinos/:id
GET    /lifts
PATCH  /lifts/:name
```

### Hábitos
```
GET    /habits
POST   /habits
PATCH  /habits/:id
GET    /habits/checkins?week=YYYY-WW
POST   /habits/checkins
```

### Compras
```
GET    /shopping
POST   /shopping
PATCH  /shopping/:id
DELETE /shopping/:id
GET    /shopping/recurring
```

### Casa
```
GET    /chores
POST   /chores
PATCH  /chores/:id/complete
```

### Finanças
```
GET    /transactions?month=YYYY-MM
POST   /transactions
PATCH  /transactions/:id
DELETE /transactions/:id
GET    /budgets
PATCH  /budgets
```

### Metas
```
GET    /goals
POST   /goals
PATCH  /goals/:id
POST   /goals/:id/progress
```

## Autenticação
- JWT com refresh token
- Email + senha (fase 1)
- Google OAuth (fase 2)
- Token armazenado em HttpOnly cookie (web) e SecureStore (mobile)

## Modelos de banco (PostgreSQL)

```sql
-- Tabelas principais
users (id, email, name, created_at)
meals (id, user_id, date, name, time, kcal, protein, carbs, fat, done)
habits (id, user_id, name, icon, active)
habit_checkins (id, habit_id, date, done)
treinos (id, user_id, date, type, duration, volume, done, notes)
lifts (id, user_id, name, current_weight, history jsonb)
chores (id, user_id, name, frequency_days, last_done)
shop_items (id, user_id, name, qty, category, done)
transactions (id, user_id, date, name, category, amount)
goals (id, user_id, name, category, target_value, current_value, target_date)
goal_progress (id, goal_id, date, value)
```

## Sincronização offline (mobile)
- Zustand store persiste no AsyncStorage
- Ao reconectar: sync local → remoto (merge por timestamp)
- Conflito: servidor ganha (mais simples para MVP)

## Push Notifications
- Expo Push Notifications
- Casos de uso:
  - Lembrete de treino (1h antes)
  - Tarefa de casa vencendo hoje (8h)
  - Meta próxima de ser atingida (90%+)
  - Lembrete de logar refeições (19h se não logou jantar)

## Próximos passos concretos
- [ ] Decidir stack (Supabase vs custom)
- [ ] Criar projeto Supabase e schema inicial
- [ ] Implementar auth no web (Angular guards)
- [ ] Implementar auth no mobile (Expo SecureStore)
- [ ] Migrar dados mockados para chamadas de API
- [ ] Implementar sincronização offline no mobile
