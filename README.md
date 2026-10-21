# MyWorld — My World Cinema

**MyWorld** é uma rede social original de descoberta de filmes: registre o que você assistiu, avalie com estrelas, escreva críticas, monte listas, organize seu diário de cinema e descubra o próximo filme da sua vida. Construído com **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4** e dados em tempo real da **API do TMDb**.

> MyWorld é um projeto independente, sem afiliação a nenhuma outra plataforma de cinema.

---

## Principais Recursos

1. **Design cinematográfico**: tema escuro imersivo, acentos verde/azul/laranja, pôsteres 2:3, avaliação por meia-estrela (0.5 a 5.0) e histograma em 10 barras.
2. **Busca typeahead em tempo real** com prévia de pôster, título e ano; botão rápido **+ LOG**.
3. **Log rápido**: data, rewatch, estrelas, curtir, resenha com spoiler tag, tags e confetes.
4. **Página do filme**: backdrop panorâmico, ações, histograma da comunidade, onde assistir (TMDb), elenco, equipe, críticas e recomendações.
5. **Catálogo**: filtros por gênero e década, ordenação e paginação.
6. **Perfil**: Top 4 filmes favoritos editáveis, estatísticas reais e abas (Films, Diary, Reviews, Watchlist, Lists, Likes).
7. **Diário**: tabela cronológica com filtro por ano.
8. **Watchlist com roleta**: o botão **Pick For Me** sorteia o filme da noite.
9. **Listas ranqueadas** com notas por filme.
10. **Comunidade & Journal**.

## Rodar local

```bash
pnpm install
pnpm dev
```

Acesse `http://localhost:5173`.

## Backend

Autenticação e banco via **Supabase** (migrations em `supabase/`).
