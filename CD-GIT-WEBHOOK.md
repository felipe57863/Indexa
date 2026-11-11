# Indexa — Fase 5D: CD por branch deploy (INATIVO)

Preparação local de 10/11/2026. Este documento orienta a alternativa à Fase 5C;
as instruções de API em `CI.md`, `COOLIFY.md` e `scripts/coolify/` ficam como
histórico preservado e não devem ser ativadas junto com esta estratégia.

Contexto informado: repositório `felipe57863/Indexa`, código/imagens em `main`,
branch remota `deploy` criada a partir de `main`, Coolify FEMA **v4.7.3**, aplicação
`luis_felipe_bueno:indexa`, UUID `cw2jnlz4m7qvaljcc6bhmdyj`. O recurso acompanha
`main` em modo manual, a API REST permanece desativada e o Manual Git Webhook
do GitHub está cadastrado e inativo. O estado remoto foi informado pelo usuário;
esta fase não acessou a FEMA nem consultou/alterou configurações remotas.

## O que foi preparado

```text
push main → testes → build frontend/backend → push das duas tags SHA
          → push das duas latest → job promover-deploy (BLOQUEADO nesta fase)
          → verificar novamente as duas imagens remotas
          → commit somente de compose.coolify.yaml na branch deploy
          → push deploy → GitHub entrega evento push ao Coolify futuramente
```

O workflow `.github/workflows/publicar-imagens.yaml` mantém `push.branches: [main]`.
O job novo tem `needs: publicar`, sem `always()` ou tolerância a erro. Qualquer
falha de teste, build ou dos quatro pushes impede a promoção. Não existe
transação entre imagens no GHCR: uma publicação parcial pode existir, mas não
autoriza avançar `deploy`. As tags `latest` continuam no fluxo anterior; o CD
usa exclusivamente `sha-<40 caracteres do commit da main>`.

O job está travado por **`false &&` literal** e pela futura variável de repositório
`INDEXA_GIT_CD_ENABLED == 'true'`. Nenhuma variável ou permissão remota foi criada
ou alterada. Mesmo que a variável já fosse verdadeira, o `false` impediria o job.
O script exige também `--execute`, a variável verdadeira e contexto de push da
`main` do Indexa. Sem habilitação, inclusive com `--help`, termina sem rede ou Git.

`scripts/git-cd/promover-deploy.mjs` usa Node.js 20+ sem instalar dependências.
O runner Ubuntu 24.04 deve disponibilizar Node, Git, Docker CLI e Compose v2+;
conferir isso no primeiro CI remoto. Os scripts não chamam endpoints do Coolify.
Somente na futura execução autorizada o script:

1. Confere dois checkouts separados: fonte exata `github.sha` e branch `deploy`
   já existente. Recusa alterações locais no destino e origin diferente do Indexa.
2. Usa `git ls-remote` autenticado para conferir a ponta da `main` e de `deploy`.
   Execução antiga, branch ausente ou atualização concorrente interrompem o fluxo.
3. Executa `docker manifest inspect` nas duas referências `sha-${GITHUB_SHA}`.
   Ausência, erro de autenticação, timeout ou manifesto inválido bloqueiam o commit.
4. Lê o Compose da fonte e troca apenas suas duas linhas `image` por literais:

   ```yaml
   image: ghcr.io/felipe57863/indexa-backend:sha-<SHA completo>
   image: ghcr.io/felipe57863/indexa-frontend:sha-<o mesmo SHA completo>
   ```

5. Preserva todo o restante do modelo byte a byte: serviços, healthchecks,
   `depends_on`, política de pull, ambiente, rede padrão implícita e `h2-data:/data`.
   O `compose.coolify.yaml` da `main` continua intacto, inclusive seu fallback
   inicial. Na branch `deploy`, `INDEXA_IMAGE_TAG` não interpola mais as imagens.
6. Se o destino já tiver conteúdo idêntico, termina sem commit/push. Caso contrário,
   valida com `docker compose config --quiet`, revalida as refs e inclui somente
   `compose.coolify.yaml`. Recusa outro arquivo no índice. Não mescla `main` e não
   copia código, workflows, scripts ou documentação para `deploy`.
7. Cria um commit filho da ponta de `deploy`, com mensagem
   `ci: promove imagens sha-<SHA> para deploy`, e faz **um** push normal
   `HEAD:refs/heads/deploy`. Não usa force, retry, reset ou exclusão de branch.

O SHA desse commit de promoção é diferente do SHA do código nas tags: registrar
ambos. A árvore da branch `deploy` passa a ser um manifesto de implantação;
seu código antigo não deve ser usado para build nem mesclado de volta à `main`.

## Token, permissões e evento externo

A publicação conserva `contents: read` e `packages: write`. Somente o job de
promoção declara `contents: write` e `packages: read`. O `GITHUB_TOKEN` é o token
automático do job: não é necessário cadastrar PAT para a proposta inicial.
O workflow não altera as configurações do repositório nem contorna proteção de
branch. Rulesets/proteções e políticas institucionais podem impedir o push mesmo
com `contents: write`; tratar isso como bloqueio, sem ampliar acesso automaticamente.

Os checkouts usam `persist-credentials: false`. O script fornece o header de
autenticação ao Git por variável de ambiente com `--config-env`; não grava token
no origin/config, não coloca credencial nos argumentos e não imprime stderr dos
subprocessos. O login do GHCR usa a ação já fixada por SHA, com limpeza ao final
do job. O secret do webhook fica apenas no GitHub/Coolify e não entra no Actions.

O GitHub documenta que pushes com `GITHUB_TOKEN` **não iniciam novos workflows
de Actions**. Isso é diferente de entrega de um webhook de repositório: a
documentação do evento `push` o associa a atualizações de branches. A estratégia
adota o push Git com token automático como origem do evento externo; essa é a
interpretação conjunta dessas referências, não evidência de entrega na FEMA.
Não inferir que bloquear Actions implica bloquear webhooks externos, nem afirmar
que uma entrega específica já ocorreu. Além disso, o filtro `[main]` impede rebuild
em `deploy` mesmo se outro método autorizado de autenticação for necessário.

**Verificação real pendente:** conferir uma entrega assinada com
`ref=refs/heads/deploy`, `after=<commit da promoção>`, resposta HTTP bem-sucedida
e processamento no recurso correto. O teste assistido abaixo verifica isso com
Auto deploy ainda manual. Se o push passar e nenhuma entrega existir, manter
manual e investigar assinatura, eventos, configuração e comportamento do token.
Somente após diagnóstico e nova autorização avaliar GitHub App ou PAT restrito
ao Indexa, com `Contents: write`; não criar credencial agora nem trocar a origem
de autenticação silenciosamente. Um PAT/App pode disparar outros workflows e
exige revisão dos filtros de todos eles.

## Validação local segura

Na raiz do projeto:

```sh
node --check scripts/git-cd/promover-deploy.mjs
node --check scripts/git-cd/test-promover-deploy.mjs
node --test scripts/git-cd/test-promover-deploy.mjs
node --test scripts/coolify/test-deploy-indexa.mjs
node scripts/git-cd/promover-deploy.mjs
node scripts/git-cd/promover-deploy.mjs --help
docker compose -f compose.coolify.yaml config --quiet
git diff --check
```

Os testes de CD Git substituem todos os comandos, escrita e resolução dos
checkouts. Não fazem commits/pushes nem em repositórios temporários. Cobrem
as duas travas, contexto inválido, SHA, preservação do Compose com LF/CRLF,
idempotência, publicação incompleta, falha de autenticação/timeout, manifesto
inválido, branch ausente, concorrência, índice contaminado, Compose inválido,
falha de commit/push sem retry e sanitização de erros.

Na Fase 5D passaram **13 grupos novos** e **59 testes anteriores**. O workflow
passou no `actionlint 1.7.12`, com shellcheck desabilitado (ferramenta não instalada).
O executável veio do release oficial com SHA256 conferido. Também foi renderizado
um Compose com SHA sintético no temporário e validado pelo Docker Compose v5.3.0:
comparação completa da configuração normalizada comprovou que apenas as duas
imagens mudam, mesmo com `INDEXA_IMAGE_TAG` conflitante no ambiente.

Não houve build da aplicação, pull, publicação, execução do workflow remoto,
acesso à FEMA, teste de entrega de webhook ou teste de CRUD/persistência remoto.
A aprovação local valida a preparação; não comprova implantação funcional.
Hashes dos oito arquivos pré-existentes acompanhados confirmaram sua preservação,
incluindo `CI.md`, `COOLIFY.md`, `.gitattributes`, Compose e os quatro scripts 5C.

## Ativação posterior — somente em tarefa autorizada

Nenhuma ação desta seção foi executada. Os nomes dos campos podem variar na
instalação FEMA v4.7.3; conferir a interface real. Não é necessário habilitar API
REST global nem usar Deploy Webhook `/api/v1/deploy`.

1. **Preparar a recuperação.** No recurso UUID `cw2jnlz4m7qvaljcc6bhmdyj`, registrar
   as duas imagens/digests realmente em execução, a tag conhecida funcional,
   nomes físicos do volume e rede, montagem `/data`, servidor/destino, domínio,
   portas e configuração atual de origem. Definir backup consistente do H2 e
   janela de manutenção com responsável. Não renomear/recriar recurso ou volume.
   Garantir uma instância do backend por banco e ausência de deploy em andamento.
2. **Publicar a preparação ainda bloqueada.** Revisar diff e arquivos a incluir
   (não adicionar indiscriminadamente `scripts/`, que contém trabalho anterior).
   Autorizar separadamente o commit/push em `main`. Manter `false &&` e variável
   ausente/falsa. Confirmar CI de publicação bem-sucedido e `promover-deploy`
   como skipped. Conferir `deploy` existente e seu Compose. Não criar nova branch.
3. **Preparar somente o recurso Indexa.** Com webhook ainda inativo e Auto deploy
   manual, trocar a branch acompanhada de `main` para `deploy`, mantendo estratégia
   Docker Compose, diretório base `/` e `/compose.coolify.yaml` como único arquivo.
   Recarregar/conferir o Compose no painel se necessário, sem selecionar Deploy.
   Confirmar acesso Git, leitura GHCR das duas imagens e ausência de builds.
   Não combinar com `compose.yaml`. Comparar montagem e nome físico do H2 antes
   e depois da mudança; qualquer diferença exige parar e investigar.
4. **Preparar o receptor sem implantar.** Conferir o Manual Git Webhook GitHub
   do próprio Indexa e o secret existente nos dois lados, sem exibir valores.
   No webhook já cadastrado do repositório selecionar somente push, JSON e TLS
   verificado; então ativar `Active`, mantendo Auto deploy **manual** no Coolify.
   Não cadastrar duplicata se houver integração Git App atendendo o mesmo recurso.
   Se a instalação não garantir que modo manual ignora o push para deploy,
   interromper este teste e definir um receptor isolado autorizado antes de seguir.
5. **Liberar promoção Git para teste assistido, ainda sem deploy.** Após autorização,
   retirar somente o `false &&` da condição do job, resultando em:

   ```yaml
   if: ${{ github.ref == 'refs/heads/main' && vars.INDEXA_GIT_CD_ENABLED == 'true' }}
   ```

   Manter `needs`, permissões por job, filtros e grupo de concorrência. Reexecutar
   testes/actionlint, publicar essa mudança autorizada com variável ainda falsa
   e confirmar skipped. Em Settings → Secrets and variables → Actions → Variables,
   criar/definir `INDEXA_GIT_CD_ENABLED=true` somente para o teste. Fazer um novo
   push autorizado em `main` para que o workflow com a nova condição seja usado.
   Não reexecutar uma execução antiga contendo `false &&`.
6. **Comprovar a promoção e a entrega.** Aguardar publicação e promoção. Conferir
   que o único arquivo do commit de `deploy` é o Compose, com as duas tags do SHA
   da execução, sem `${INDEXA_IMAGE_TAG}` ou `latest`. Conferir manifests/digests
   das duas tags. Em Settings → Webhooks → Recent deliveries, localizar o push
   com `ref=refs/heads/deploy`, `after` igual ao commit de promoção e resposta 2xx.
   Conferir processamento no Coolify e que **nenhum deploy** iniciou em modo manual.
   O push original em `main` também pode chegar ao receptor: confirmar que é
   ignorado, pois o recurso agora acompanha `deploy`. Ping/2xx sozinho não basta.
7. **Encerrar o ensaio ou ativar CD.** Se o objetivo for só validar transporte,
   voltar a variável para `false` e webhook inativo. Para ativação completa
   autorizada, conferir novamente a versão literal interpretada pelo Coolify,
   volume físico, fila vazia e ausência de previews/rolling replicas sobre H2.
   Manter webhook ativo, habilitar Auto deploy por push **somente no Indexa** e
   manter a variável verdadeira. Não mudar infraestrutura compartilhada.
   `INDEXA_IMAGE_TAG` antiga pode permanecer: não controla o Compose gerado.
8. **Primeiro deploy assistido.** Fazer outro push autorizado em `main` e acompanhar
   CI → commit `deploy` → entrega → logs do Coolify. Confirmar nos containers as
   duas tags/digests, healthchecks, frontend e `/api/contatos`, operações com dados
   sintéticos e preservação do H2 após recriação autorizada sem excluir volume.
   Confirmar término da instância antiga antes de abrir o mesmo banco na nova.
   Aceitar janela de indisponibilidade; este fluxo não promete zero downtime.

## Falhas, suspensão e recuperação

| Situação | Resultado e procedimento autorizado |
| --- | --- |
| Teste/build/push falhou | Job de promoção não executa; `deploy` não avança. Investigar CI e conferir as duas imagens antes de nova execução. |
| Uma tag SHA não existe/manifesto falha | Script interrompe antes da escrita/commit. Corrigir publicação; não usar `latest` como substituto. |
| Main avançou ou deploy mudou | Script bloqueia a execução antiga. Usar a execução da ponta atual e revisar alterações manuais de deploy; não forçar push. |
| Política/token impede escrita | Falha sem bypass. Revisar rulesets e permissões com administrador, com acesso limitado ao repositório/branch. |
| Config/commit falhou no runner | Não há push; alterações locais descartáveis pertencem somente ao runner. Não alterar o checkout do usuário para remediar. |
| Push falhou ou teve timeout | Sem retry automático. Conferir a ponta remota e seu Compose: o servidor pode ter aceitado antes da perda de resposta. |
| Sem diff em deploy | Nenhum novo push/evento. Reexecutar CI não é forma de pedir redeploy; reconciliar a entrega anterior ou usar deploy manual autorizado. |
| Push passou mas webhook não chegou | Actions comprova somente promoção. Verificar Recent deliveries, assinatura, ref, TLS e modo/branch do recurso. Não chamar API como fallback. |
| Webhook 2xx mas aplicação falhou | Conferir fila/logs do Indexa e imagens efetivamente iniciadas. 2xx é recebimento, não prontidão. Suspender novas promoções antes de recuperar. |

Para suspender após ativação: definir `INDEXA_GIT_CD_ENABLED=false`, desativar o
webhook e voltar Auto deploy a manual no Indexa. A variável não interrompe um
job já iniciado; se houver, cancelá-lo e reconciliar o push, a entrega e a fila.
Reintroduzir `false &&` em mudança autorizada para bloqueio versionado. Cancelar
Actions não cancela trabalho já aceito pelo Coolify; um webhook entregue pode
ter enfileirado deploy. Não redeliver eventos indiscriminadamente.

Para voltar à versão anterior, primeiro suspender e aguardar/reconciliar a fila.
Conferir as duas imagens SHA conhecidas e seus digests. Em checkout separado da
`deploy` atual, preparar um commit que altere **somente as duas linhas de imagem**
para aquele mesmo SHA, sem interpolação, preservando todo o restante. Um revert
do último commit de promoção só é adequado se seu diff restaurar exatamente
essas duas referências literais; na primeira promoção o pai pode conter o
fallback antigo, então não fazer revert cego. Validar o Compose e revisar diff.
Após autorização de commit/push, publicar esse commit sem force, com webhook
inativo; conferir o Compose interpretado e realizar **um** deploy manual assistido
no recurso existente. Validar imagens, saúde e dados antes de reativar CD.

Não apagar volumes ou recriar o recurso. Não iniciar dois backends sobre o H2.
Rollback de imagem não reverte dados/esquema: `ddl-auto=update` pode impedir a
compatibilidade com versão antiga. Restaurar backup exige plano e autorização
próprios; esta automação nunca restaura banco automaticamente.

Riscos restantes: tags SHA podem ser regravadas (não são digests imutáveis),
registry pode perder imagens entre verificação e pull, e um operador pode agir
depois da última releitura das refs. O push normal evita sobrescrever avanço de
`deploy`, mas a conferência de `main` e o push não são transação entre branches.
O grupo de concorrência do Actions serializa o workflow até a promoção; não
acompanha o término do Coolify. Pushes futuros podem se acumular na fila ou ser
consolidados pelo servidor. Validar o comportamento da fila no primeiro ensaio,
manter um responsável pela ativação e não combinar com a automação REST 5C.

## Fontes oficiais

- [GITHUB_TOKEN e novas execuções de Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- [Permissões do GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token).
- [Evento push e seus campos](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push).
- [Manual Git Webhooks do Coolify](https://coolify.io/docs/applications/deployments/manual-webhooks).
- [Deploy automático por branch](https://coolify.io/docs/applications/deployments/automatic-deployments).
- [Consulta de manifestos remotos](https://docs.docker.com/reference/cli/docker/manifest/inspect/).
- [actionlint 1.7.12](https://github.com/rhysd/actionlint/releases/tag/v1.7.12).

Situação: **IMPLEMENTADO e TESTADO LOCALMENTE / ATIVAÇÃO E VALIDAÇÃO REMOTA PENDENTES**.
Sem commit/push/deploy nesta fase. Nenhum container, rede, volume H2 ou recurso
da FEMA foi modificado. A preparação de CD permanece inativa.
