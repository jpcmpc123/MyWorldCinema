# Conta de teste (somente desenvolvimento local)

Esta conta existe só para você não precisar fazer login toda vez ao testar no
computador. **Não vai para o APK nem para o GitHub.**

## Dados da conta

- E-mail: `teste.dev.myworld@example.com`
- ID no Supabase: `34a15833-20a6-4c77-9d89-1bccbb4a0339`
- Senha: guardada em `.env.development.local` (arquivo ignorado pelo git)

## Como funciona

- `src/context/AuthContext.tsx` tem um autologin que só roda quando
  `import.meta.env.DEV` é verdadeiro (somente `pnpm dev`).
- Ele lê `VITE_DEV_AUTOLOGIN`, `VITE_DEV_EMAIL` e `VITE_DEV_PASSWORD` do
  `.env.development.local`.
- No build de produção (GitHub Pages) e no APK, esse código é descartado.
  Verificado: o bundle `dist/` não contém o e-mail nem a senha de teste.

## Como ativar / desativar

- Ativar: `VITE_DEV_AUTOLOGIN=1` em `.env.development.local`.
- Desativar: troque para `VITE_DEV_AUTOLOGIN=0` ou apague o arquivo.

## Como remover a conta de vez

1. Painel do Supabase → **Authentication → Users**, encontre
   `teste.dev.myworld@example.com` e clique em **Delete user**.
   (Ou pelo SQL: `delete from auth.users where email = 'teste.dev.myworld@example.com';`)
2. Apague o arquivo `.env.development.local`.
3. Remova o bloco de autologin em `src/context/AuthContext.tsx`
   (função `devAutoLogin`) e este arquivo `CONTA_DE_TESTE.md`.

## O que NÃO foi feito

- Nenhuma credencial foi colocada no código-fonte, no `.env` versionado,
  no APK ou no GitHub Pages.
- A senha não está neste arquivo.
