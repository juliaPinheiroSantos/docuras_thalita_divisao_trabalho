# Doçuras da Thalita — Divisão de trabalho

Sistema interno de tarefas da equipe, com acesso por telefone e senha, painel
restrito ao proprietário e armazenamento em Cloudflare D1.

## Desenvolvimento local

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Publicação pelo Cloudflare Workers Builds

O projeto gera um Worker com Vinext. Não use o comando padrão
`npx wrangler deploy`, pois ele tenta reconfigurar o projeto como uma SPA.

Configure o projeto conectado ao GitHub com:

- Branch de produção: `main`
- Comando de build: deixe vazio
- Comando de deploy: `pnpm run deploy`

Crie um banco D1 chamado `docuras-thalita-db` e adicione o UUID dele como
variável de build:

```text
CLOUDFLARE_D1_DATABASE_ID=<UUID do banco D1>
```

O nome pode ser personalizado com a variável opcional
`CLOUDFLARE_D1_DATABASE_NAME`.

O token selecionado em **Settings > Builds > API token** precisa das permissões
**Workers Scripts: Edit** e **D1: Edit**. O deploy executa as migrações no D1
antes de publicar o Worker. Nunca salve o token no repositório.

O banco D1 criado na conta Cloudflare é independente do banco usado pela versão
publicada anteriormente no Sites; os dados não são copiados automaticamente.
