# Campeonato Escolar de Free Fire

Plataforma web para acompanhar campeonatos escolares de Free Fire de várias escolas da cidade.

- **Área pública** (sem login): lista de escolas, classificação, resultados por queda e chaveamento mata-mata, atualizados em tempo real.
- **Área administrativa** (login): escolas, equipes, campeonatos, quedas/resultados, mata-mata e regras de pontuação totalmente configuráveis.

Stack: React 18 + TypeScript + Vite + React Router + Firebase Authentication e Cloud Firestore.

---

## 1. Pré-requisitos

- Node.js 18 ou superior e npm.
- Uma conta Google para o [Console do Firebase](https://console.firebase.google.com).
- Firebase CLI: `npm install -g firebase-tools` (para publicar regras e hospedagem).
- Java 11+ (apenas para rodar os testes das regras de segurança com emuladores).

## 2. Instalar dependências

```bash
npm install
```

## 3. Criar e configurar o projeto Firebase

1. No Console, **Adicionar projeto** (o Google Analytics é opcional).
2. Em **Configurações do projeto → Seus aplicativos**, clique em **Web (`</>`)**, registre o app e copie o objeto `firebaseConfig`.
3. Faça login no CLI e vincule o projeto:
   ```bash
   firebase login
   cp .firebaserc.example .firebaserc     # edite e coloque o ID do seu projeto
   ```

## 4. Habilitar o Authentication

Console → **Authentication → Começar → Método de login → E-mail/senha → Ativar**.
Depois, em **Usuários → Adicionar usuário**, crie a conta de cada administrador (e-mail e senha). **Criar a conta não dá acesso ao painel**: veja a seção 9.

Recomendado: em *Configurações → Ações do usuário*, **desative a criação de contas por conta própria** (o app não tem tela de cadastro).

## 5. Criar o Firestore

Console → **Firestore Database → Criar banco de dados** → escolha a região mais próxima → modo **produção** (as regras deste projeto substituem o padrão).

## 6. Logos sem Firebase Storage

Os logos são redimensionados no navegador para no máximo 256 × 256 px, convertidos para JPEG e comprimidos até 150 KB. A Data URL é gravada no campo `logoUrl` do próprio documento da escola ou equipe no Firestore; não é necessário ativar Storage, Blaze, cartão ou hospedagem externa. O arquivo original deve ter até 10 MB e ser uma imagem PNG, JPG ou WebP válida.

O campo `logoPath` permanece para compatibilidade com documentos antigos. Logos já existentes como URLs do Storage continuam sendo exibidos; ao substituir ou remover um logo, a aplicação grava somente os dados do Firestore e não apaga arquivos remotos.

## 7. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com os valores do `firebaseConfig`:

| Variável | Origem |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

> **Estes valores são públicos.** Eles identificam seu projeto para o navegador e vão dentro do JavaScript publicado. Não são credenciais de administrador. A segurança vem das **regras do Firestore** e do **Authentication**. Já a *chave de conta de serviço* (JSON privado) **nunca** deve entrar no repositório nem no front-end.

Se faltar alguma variável, o app mostra uma tela explicando quais.

## 8. Instalar as regras de segurança

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Arquivos: `firestore.rules`, `firestore.indexes.json` (não há índices compostos; todas as consultas usam um único filtro e a ordenação é feita no cliente). O arquivo `storage.rules` legado não é carregado pelo app nem pelo Firebase CLI neste projeto.

## 9. Criar o primeiro administrador com segurança

A autorização usa uma **Custom Claim `admin: true`** no token do usuário. Ela só pode ser atribuída por código com credencial de servidor: **não existe nenhuma rota, tela ou documento no app que permita se promover**, e as regras negam escrita a quem não tem a claim.

1. Crie o usuário no Authentication (seção 4).
2. Console → **Configurações do projeto → Contas de serviço → Gerar nova chave privada**. Guarde o JSON **fora** da pasta do projeto (o `.gitignore` já bloqueia `serviceAccount*.json` por precaução).
3. Na sua máquina:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/caminho/seguro/serviceAccount.json \
   GCLOUD_PROJECT=SEU-PROJECT-ID \
   npm run set-admin -- admin@suaescola.com
   ```
   Para revogar: acrescente `--revoke`.
4. A pessoa deve sair e entrar de novo (ou clicar em **Verificar novamente** na tela de acesso negado).
5. Apague a chave do computador se não for mais usá-la.

## 10. Executar localmente

```bash
npm run dev
```

Abra `http://localhost:5173/campeonato/visualizacao` (público) e `http://localhost:5173/campeonato/admin` (painel).

Para desenvolver sem tocar no projeto real, use os emuladores de Auth e Firestore: `VITE_USE_EMULATORS=true` no `.env`, `npm run emulators` em outro terminal (o `set-admin` aceita `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`).

## 11. Testes

```bash
npm test             # testes unitários e de componentes (Vitest)
npm run typecheck    # TypeScript
npm run test:rules   # regras do Firestore no emulador (requer firebase-tools + Java)
```

Cobertura de `npm test`: pontos por colocação e por abates, soma por queda, acúmulo entre quedas, desempates (ordem configurável, empate preservado, ranking 1-1-3), validação de resultados incompletos/inválidos, máximo teórico, encerramento/campeão, regras inválidas, resultado de confronto (melhor de 1/3, empate, BYE), validação de estrutura, avanço de fase, troca de vencedor após a próxima fase preenchida, reabertura, proteção das rotas administrativas e renderização das telas públicas.

`npm run test:rules` verifica: visitante lê só o publicado; quedas ocultas não vazam; visitante e usuário sem claim não escrevem; ninguém se promove a admin; dados inválidos são rejeitados.

### Teste manual de logos e persistência

1. Entre como administrador e crie uma escola selecionando um PNG/JPG/WebP; confirme que o logo aparece na lista administrativa.
2. Edite a escola, substitua o logo e salve; reabra o formulário, remova o logo e salve para conferir o fallback de iniciais. Cadastre novamente um logo para os próximos passos.
3. Selecione a escola no painel, crie uma equipe com logo, edite e substitua esse logo; confira que a equipe continua com o mesmo ID e vínculo escolar.
4. Atualize o navegador; confira os logos no painel e, se a escola estiver publicada, na área pública. Abra a mesma rota em outro navegador/dispositivo após autenticar/publicar: os dados vêm do Firestore, não de armazenamento local do navegador.
5. Pare e reinicie o Vite e confirme que os logos continuam. Para testar outro dispositivo usando o Firebase real, mantenha `VITE_USE_EMULATORS=false`.
6. Teste arquivo GIF, imagem acima de 10 MB e imagem inválida: devem ser rejeitados sem travar o formulário. Para validar persistência entre dispositivos, confirme no Console do Firestore que `logoUrl` começa com `data:image/jpeg;base64,`.

## 12. Gerar a versão de produção

```bash
npm run build      # valida tipos e gera a pasta dist/
npm run preview    # serve o build localmente
```

## 13. Publicar

Com Firebase Hosting (já configurado em `firebase.json`):

```bash
npm run build
firebase deploy --only hosting
```

Também funciona em qualquer hospedagem estática (Netlify, Vercel, Cloudflare Pages, Nginx…): publique o conteúdo de `dist/`.

## 14. Rotas e fallback de SPA na hospedagem

A aplicação usa rotas do navegador (`/campeonato/...`); ao abrir uma URL direta ou atualizar a página, o servidor precisa devolver `index.html`.

- **Firebase Hosting:** já configurado (`rewrites` em `firebase.json`).
- **Netlify:** arquivo `public/_redirects` com `/*  /index.html  200`.
- **Vercel:** `vercel.json` com `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`.
- **Nginx:** `location / { try_files $uri /index.html; }`.

## 15. Alterar os prefixos das rotas

Edite **somente** `src/config/routes.ts`, objeto `ROUTE_PREFIXES`:

```ts
export const ROUTE_PREFIXES = {
  public: '/campeonato/visualizacao',
  admin: '/campeonato/admin',
} as const;
```

Todas as telas, redirecionamentos e links usam `ROUTES`. Se mudar os prefixos, atualize também o teste `src/config/routes.test.ts`. Lembre: `/campeonato/admin` é só um caminho; **a proteção real é o Authentication + regras**.

## 16. Erros comuns

| Sintoma | Causa / solução |
|---|---|
| Tela "Firebase não configurado" | Falta `.env`. Copie `.env.example` e reinicie `npm run dev`. |
| "Sem permissão" ao salvar | Regras não publicadas, ou o usuário não tem a claim. Rode `firebase deploy --only firestore:rules` e `npm run set-admin`; depois saia e entre. |
| "Conta sem permissão de administrador" | A claim ainda não foi atribuída ou o token está antigo: use **Verificar novamente**. |
| Escola não aparece no site | Está **Oculta**. Clique em **Publicar** em *Escolas*. |
| Queda não aparece no site | Quedas nascem ocultas. Use **Publicar** na queda. |
| Dados somem ao reiniciar | Confira `VITE_FIREBASE_PROJECT_ID` e deixe `VITE_USE_EMULATORS=false` no `.env`; emuladores guardam dados localmente e podem ser limpos ao reiniciar. Reinicie o Vite após mudar o `.env`. |
| Logo não salva | Use PNG/JPG/WebP válido até 10 MB; o navegador comprime para até 150 KB antes da gravação. Verifique a conexão e as regras do Firestore. |
| 404 ao atualizar a página | Falta o fallback de SPA (seção 14). |
| `auth/invalid-credential` | E-mail/senha incorretos, ou usuário não criado no Authentication. |
| `npm run test:rules` falha ao iniciar | Instale Java e `firebase-tools`; o emulador baixa um JAR na primeira execução. |

---

## Arquitetura e decisões técnicas

### Estrutura do Firestore

```
schools/{schoolId}                      nome, descrição, logo, published, datas
  teams/{teamId}                        nome, logo (pertence à escola)
  championship/main                     formato, status, regras de pontuação, campeão manual
  rounds/{roundId}                      nome, ordem, status (open/finished), published
    results/{teamId}                    posição, abates, extras, status (complete/incomplete)
  stages/{stageId}                      fases do mata-mata (nome, ordem)
  matches/{matchId}                     confronto: times, origens, partidas, status, vencedor
```

Subcoleções evitam documentos gigantes (limite de 1 MiB) e permitem ouvir só o necessário. Um campeonato por escola (`championship/main`).

### Decisões importantes

- **Pontos nunca são armazenados.** Cada resultado guarda apenas posição, abates e extras; totais e classificação são calculados por `src/features/scoring/engine.ts` (funções puras, testadas). Isso elimina totais desatualizados e pontos em duplicidade.
- **Mudar regras recalcula tudo**, inclusive o que já está publicado; o painel pede confirmação antes quando existem resultados.
- **Só resultados completos e válidos contam** nos totais. Quedas não finalizadas aparecem como "Em andamento" e a classificação pública fica marcada como **Parcial** até o campeonato ser finalizado.
- **Empates são preservados** (posições iguais, ex.: 1º, 1º, 3º). A ordem alfabética só define a exibição.
- **Pontuação-alvo não coroa ninguém**: só sinaliza. O campeão sai da regra configurada (líder da classificação final ou escolha manual) e só aparece com o campeonato **finalizado**.
- **Máximo teórico** só é exibido quando todos os limites são conhecidos (abates e extras com teto); senão o painel explica por que não dá para calcular.
- **Mata-mata:** empate nunca define vencedor sozinho; BYE é um campo explícito; um time não entra duas vezes na mesma fase; cada confronto só alimenta um próximo; finalizar ou reabrir grava o confronto e os avanços em uma transação. Se o vencedor mudar depois da fase seguinte preenchida, o painel lista os confrontos afetados e exige confirmação para reiniciá-los de forma consistente.
- **Exclusões:** escola = cascata, com resumo do impacto e confirmação (o documento da escola é apagado por último, então uma falha no meio pode ser repetida). Equipe com resultados ou confrontos **não** pode ser excluída (evita vínculos quebrados). Troca de formato com dados exige confirmação e apaga os dados do formato antigo.
- **Duplicação por clique duplo:** IDs são gerados ao abrir o formulário e o botão fica bloqueado durante a gravação (`useAction`). Sucesso só é mostrado após a confirmação do Firestore.
- **Tempo real:** `onSnapshot` via hook `useSubscription`, que cancela os listeners ao desmontar/trocar de escola; há um listener por queda publicada.

### Segurança

- Admin = Custom Claim `admin: true` (atribuída por `scripts/set-admin.mjs`, com credencial local).
- Firestore: leitura pública só de escolas `published == true` (e dos dados dessas escolas); quedas só se `published == true`; escrita só admin, com validação de formato dos campos; qualquer outro caminho é negado.
- Logos novos são Data URLs no campo `logoUrl` do documento de escola/equipe. A leitura segue as mesmas regras Firestore do documento; nenhuma regra pública adicional é necessária.
- Dados de demonstração: **não há**. Todo conteúdo vem do Firestore.

### Estrutura de pastas

```
src/
  app/            roteamento
  components/     ui/ (botões, modais, toasts), public/, admin/
  config/         routes.ts
  features/       auth/, scoring/ (motor), matches/ (chaveamento)
  hooks/          useSubscription, useChampionshipData, useAction
  layouts/        PublicLayout, AdminLayout
  pages/          public/, admin/
  services/       firebase/, schools/, teams/, championships/, rounds/, matches/
  styles/         tokens, base, components, public, admin
  types/          modelos TypeScript
  utils/          formatação, erros, arquivos
scripts/set-admin.mjs
tests/rules/      testes das regras (emuladores)
```
