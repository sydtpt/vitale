# Spec: Autenticação

## Status: 🔧 Em andamento

## Objetivo

Proteger a plataforma Vitale com autenticação por email + senha usando Supabase Auth. Web e mobile compartilham o mesmo usuário/sessão via JWT.

## Decisões técnicas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Provider | Supabase Auth | Auth, banco e real-time em um só lugar — sem servidor próprio para MVP |
| Token (web) | HttpOnly cookie via `@supabase/ssr` | Proteção contra XSS |
| Token (mobile) | `expo-secure-store` | Keychain/Keystore nativo, mais seguro que AsyncStorage |
| Fase 1 | Email + senha | Simples, rápido de implementar |
| Fase 2 | Google OAuth | Após MVP estável |

## Fluxos

### Web (Angular)

```
/login → AuthService.signIn() → Supabase → salva sessão (cookie)
       → redireciona para /semana

/register → AuthService.signUp() → Supabase → email de confirmação
          → redireciona para /login com mensagem

Rota protegida → AuthGuard → verifica sessão → OK ou /login

Logout → AuthService.signOut() → limpa cookie → /login
```

### Mobile (Expo)

```
(auth)/login → signIn() → Supabase → salva token no SecureStore
             → redireciona para /(tabs)/

(auth)/register → signUp() → Supabase → confirmação por email

App abre → _layout.tsx → verifica sessão → (tabs)/ ou (auth)/login

Logout → signOut() → limpa SecureStore → (auth)/login
```

## Estrutura de arquivos

### Web
```
web/src/app/
├── core/
│   ├── auth/
│   │   ├── auth.service.ts          # Supabase signIn/signUp/signOut/getSession
│   │   ├── auth.guard.ts            # CanActivateFn — redireciona para /login
│   │   └── auth.interceptor.ts      # Adiciona token nas requests futuras
│   └── supabase/
│       └── supabase.client.ts       # createBrowserClient (@supabase/ssr)
├── features/
│   └── auth/
│       ├── login/
│       │   ├── login.component.ts
│       │   └── login.component.scss
│       ├── register/
│       │   ├── register.component.ts
│       │   └── register.component.scss
│       └── auth.routes.ts
└── app.routes.ts                    # adiciona guard nas rotas existentes
```

### Mobile
```
mobile/src/
├── lib/
│   └── supabase.ts                  # createClient com SecureStore adapter
├── store/
│   └── auth.store.ts                # Zustand: session, user, loading, signIn, signOut
└── app/
    ├── _layout.tsx                  # verifica sessão, redireciona
    ├── (auth)/
    │   ├── _layout.tsx
    │   ├── login.tsx
    │   └── register.tsx
    └── (tabs)/                      # rotas existentes (protegidas)
        └── _layout.tsx
```

## Modelos

```typescript
// packages/shared/src/models/auth.ts
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
}
```

## Variáveis de ambiente

```
# .env (raiz do monorepo)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>

# web/src/environments/environment.ts
# mobile — expo-constants via app.config.js
```

## UI / Design

### Tela de Login
- Logo "Vitale" centralizado (Instrument Serif, primary `#F25C2B`)
- Fundo `bgWeb` (web) / `bg` (mobile)
- Card branco (`surface`) com campos email e senha
- Botão CTA primário (`#F25C2B`)
- Link "Criar conta"
- Link "Esqueci a senha" (fase 2)

### Tela de Registro
- Campos: nome, email, senha, confirmar senha
- Feedback de erro inline (não toast)
- Após registro: mensagem "Verifique seu email" + link para login

## Comportamentos esperados

- Sessão persiste após fechar o app/browser
- Erro de credenciais inválidas: mensagem inline, não genérica
- Loading state no botão durante requisição
- Guard não bloqueia `/login` e `/register`
- Ao abrir app com sessão válida: vai direto para home, sem piscar tela de login

## Fora do escopo (fase 1)

- Google OAuth
- Recuperação de senha
- Atualização de perfil
- Multi-device sync / conflito de sessão

## Próximos passos

- [ ] Criar projeto no Supabase e obter URL + anon key
- [ ] Instalar dependências: `@supabase/supabase-js`, `@supabase/ssr` (web), `expo-secure-store` (mobile)
- [ ] Implementar `supabase.client.ts` no web
- [ ] Implementar `AuthService` + `AuthGuard` no web
- [ ] Criar telas de login/registro no web
- [ ] Adicionar guard nas rotas existentes do web
- [ ] Implementar `supabase.ts` + `auth.store.ts` no mobile
- [ ] Criar telas de login/registro no mobile
- [ ] Configurar redirect no `_layout.tsx` raiz do mobile
- [ ] Adicionar modelo `AuthUser` ao shared
