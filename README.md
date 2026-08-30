# Colinha Digital 2026

Aplicacao de campanha para buscar candidatos, salvar uma colinha de voto em PDF
e compartilhar pelo menu nativo do celular. Teresinha Neves (3088) fica fixa no
cargo de Deputada Federal; os demais cargos consultam os dados importados do TSE.

## Desenvolvimento

1. Copie `.env.example` para `.env.local` e informe `DATABASE_URL` e `CRON_SECRET`.
2. Aplique `sql/001_initial.sql` em um Postgres/Neon vazio com `npm run db:migrate`.
3. Instale e execute:

```bash
npm install
npm run dev
```

## Dados

- A escolha do eleitor fica somente no `localStorage`.
- A API recebe apenas o termo de busca.
- O importador tenta, nesta ordem: ZIP/CSV de Dados Abertos do TSE,
  DivulgaCand e um snapshot espelhado dos CSVs originais do TSE.
- O snapshot de contingência está fixado em um commit auditável. Ele nunca
  substitui uma fotografia do TSE mais recente já armazenada no Neon.
- Links sociais são exibidos como declarados à Justiça Eleitoral.
- Se o TSE alterar as URLs, configure as variáveis `TSE_*_URL` na Vercel.

## Vercel

O `vercel.json` agenda uma sincronizacao diária, compatível com o plano Hobby.
Em produção comercial/campanha, use um plano compatível com os termos da Vercel
e ajuste o cron para uma frequência maior se necessário.
