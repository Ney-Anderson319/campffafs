# Resultado dos testes (executados no ambiente de desenvolvimento)

- `npx tsc --noEmit`: sem erros.
- `npx vitest run`: 5 arquivos, 61 testes aprovados.
- `npm run build`: build de produção gerado com sucesso.
- `npm run test:rules`: NÃO executado (o ambiente não conseguiu baixar o emulador do Firestore). Os testes existem em `tests/rules/security.test.ts` e devem ser executados antes de publicar.
