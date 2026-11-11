# Indexa no Coolify — preparação e automação inativa

**Estado atual:** a implantação manual já funciona no Coolify FEMA 4.6.0.
As imagens frontend e backend estão públicas no GHCR. A API REST da FEMA está
**desativada globalmente**: a automação descrita na Fase 5C não pode ser ativada agora.
O acesso público informado é HTTP na porta externa 8081; confirmar a URL completa
da aplicação, pois o endereço do painel Coolify não define essa URL.

As seções de preparação abaixo preservam o registro da Fase 5A; não são instruções
para reconfigurar o servidor que já funciona. As hipóteses sobre imagens privadas
e HTTPS pertencem àquele planejamento inicial. O código local de CD é descrito
em [Automação local da Fase 5C](#automação-local-da-fase-5c--inativa).

Na Fase 5A foi preparada a configuração, sem executar deploy ou alterar o servidor.
O arquivo [compose.coolify.yaml](compose.coolify.yaml) é independente do
`compose.yaml` local e utiliza as duas imagens publicadas no GHCR, sem rebuild.
O workflow de publicação permanece como está, sem chamada ao Coolify.

## Configuração preparada

| Item | Valor |
| --- | --- |
| Frontend | `ghcr.io/felipe57863/indexa-frontend` |
| Backend | `ghcr.io/felipe57863/indexa-backend` |
| Versão inicial das duas imagens | `sha-e9cbcaef66e96190487eef7f65bccfc19fdf3d15` |
| Variável opcional de versão | `INDEXA_IMAGE_TAG`, mesma tag nos dois serviços |
| Entrada do proxy Coolify | Serviço `frontend`, porta interna `80` |
| API dentro da stack | `frontend` → `backend:3000`, via `/api/contatos` |
| Persistência | Volume nomeado `h2-data` em `/data` do backend |

A tag inicial identifica o commit publicado com sucesso na Fase 4.
As referências já incluem uma versão conhecida; `INDEXA_IMAGE_TAG` permite
escolher outra versão depois de verificar sua publicação nas duas imagens.
Uma tag ainda pode ser regravada no registry; registre os digests de cada release.

`pull_policy: always` solicita consultar o registry ao iniciar/recriar os
serviços; não depende de uma imagem antiga em cache. `restart: unless-stopped`
permite retomar containers após reinício do Docker, salvo parada explícita.
O healthcheck não substitui backup nem reinicia sozinho um container unhealthy.

Os healthchecks são os mesmos da integração local: backend responde `/contatos`
e frontend consulta `/api/contatos` pelo nginx. A rede padrão da stack mantém o
nome `backend` usado pela imagem nginx. Não há `ports:` em nenhum serviço;
`expose: 80` documenta a porta interna e não publica uma porta no servidor.

Somente neste Compose, `SERVER_FORWARD_HEADERS_STRATEGY=framework` orienta o
Spring a reconhecer os headers do proxy, como `X-Forwarded-Proto: https`.
Sem isso, a terminação HTTPS pode chegar ao Spring como HTTP e causar rejeição
de origem nas operações de escrita. O nginx atual encaminha os headers recebidos;
confirmar no servidor que o proxy Coolify define os headers de origem corretamente
e sobrescreve valores enviados por clientes. O backend não deve aceitar tráfego
direto de origem não confiável. Código, CORS e Compose local permanecem intactos.
Esse fluxo HTTPS ainda precisa de teste real na etapa de implantação.

## O que configurar manualmente no Coolify, em etapa autorizada

1. Selecionar projeto, ambiente, servidor e destino corretos. Conferir a versão
   instalada do Coolify; os nomes dos menus podem variar.
2. Preferir uma Application com origem Git e estratégia **Docker Compose**,
   apontando para este repositório, branch `main`, diretório base `/` e arquivo
   `/compose.coolify.yaml` (ajustar a forma do caminho ao campo da versão instalada).
   O arquivo deverá estar disponível no Git antes disso. Usar somente esse Compose,
   sem mesclar com `compose.yaml`, para não herdar builds nem portas locais.
3. Disponibilizar acesso de leitura ao repositório privado por uma origem Git
   autorizada. Esse acesso é separado da autenticação do GHCR.
4. Revisar o Compose interpretado pelo Coolify: duas imagens, nenhuma seção
   `build`, nenhuma porta do host e volume em `/data`. Não escolher Nixpacks,
   Railpack ou Dockerfile como estratégia desse recurso.
5. Manter **Auto deploy** em modo manual, inclusive se uma GitHub App habilitar
   deploy por push por padrão. O futuro deploy deve aguardar a publicação no CI.
6. Conferir `INDEXA_IMAGE_TAG` no painel: manter a versão inicial ou usar uma tag
   já publicada nas duas imagens. Não criar uma variável de versão por serviço.
7. Associar somente o domínio HTTPS do aplicativo ao serviço `frontend`, destino
   interno `80`, caminho `/`. Deixar o backend sem domínio e sem porta publicada.
   O nginx existente continua tratando `/api/`; não criar uma segunda rota pública
   diretamente para o backend.
8. Conferir DNS, certificado e conectividade do proxy com a rede da stack.
   Manter o gerenciamento normal de rede/labels do Coolify; não fixar uma rede
   externa ou labels Traefik/Caddy sem conhecer o ambiente.
9. Conferir o volume de backend na configuração renderizada e em Persistent
   Storage. A definição do Compose é a fonte do volume; não acrescentar outra
   montagem concorrente em `/data` no painel.

Nenhuma dessas operações foi executada nesta fase. Não selecionar Deploy até
que servidor, autenticação, domínio e persistência sejam revisados e autorizados.

## Autenticação para imagens privadas do GHCR

O `GITHUB_TOKEN` do Actions publica as imagens, mas não é uma credencial
permanente para o servidor. Para pull privado, planejar uma conta GitHub com
acesso aos dois pacotes e um PAT **classic** com `read:packages`; autorizar SSO
se a organização exigir. Não é necessário conceder escrita ou exclusão de pacotes
para baixar essas imagens. Não tornar os pacotes públicos como atalho.

Na versão atual documentada do Coolify, o responsável poderá usar **Registries**
ou **Servers → servidor → Registries**, selecionar GHCR (`ghcr.io`) e autenticar
o usuário do registry. O login deve existir no servidor de implantação, para o
mesmo usuário SSH que o Coolify utiliza para operar o Docker. Se essa interface
não existir na instalação, a alternativa documentada é login Docker por SSH
nesse usuário, com entrada segura de token.

O Docker guarda o login desse usuário no servidor. Não colocar o token no
Compose, nas variáveis da aplicação ou no repositório. A chave de leitura Git
não autentica o registry. Nesta fase não foi criado, solicitado, copiado ou
validado nenhum valor de token, nem feito login no servidor ou no GHCR.

## Persistência e exposição

O backend já usa `jdbc:h2:file:/data/contatosdb` e UID/GID `10001:10001`.
Um volume novo deve permitir escrita por esse usuário. Registrar o nome físico
gerado pelo recurso Coolify e mantê-lo nos próximos deploys; recriar o recurso
ou mudar de servidor pode selecionar um volume vazio. Não renomear nem reutilizar
um volume existente sem analisar seu conteúdo e ter plano de recuperação.

Manter uma única instância do backend por volume H2 e evitar previews que
compartilhem o banco. O arquivo local `backend-spring/contatosdb.mv.db` não é
importado. Não há migração de dados nesta preparação. Definir backup e restauração
com o backend parado ou por mecanismo consistente com H2 antes de usar dados reais.

O fluxo planejado é navegador HTTPS → proxy Coolify → nginx:80 → backend:3000.
Somente o proxy recebe tráfego público nas portas 80/443. A aplicação mantém
o comportamento atual, inclusive a ausência de login de usuários. Antes de
autorizar exposição pública, confirmar quem poderá acessar a agenda e onde
serão armazenados os dados; nenhum controle novo foi acrescentado nesta fase.

## Plano inicial para acionar o Coolify após o CI — histórico da Fase 5A

O job atual já constrói e publica as duas imagens antes de concluir. Na etapa
futura de automação, manter a sequência:

1. Concluir os dois builds e os quatro pushes do workflow existente.
2. Selecionar no recurso Coolify `INDEXA_IMAGE_TAG=sha-<SHA completo dessa execução>`.
   A primeira seleção pode ser manual. Automatizar a atualização dessa variável
   exige confirmar a API e as permissões da versão instalada; não confundir isso
   com a permissão de apenas disparar deploy.
3. Só então chamar o **Deploy Webhook autenticado** do recurso, em passo após a
   publicação ou em job dependente com `needs` e condição normal de sucesso.
   Não usar `always()` nem um webhook Git que dispare antes dos pushes.
4. Aguardar a implantação e conferir as duas referências/digests, healthchecks,
   HTTPS, CRUD sintético e persistência. Resposta de webhook que entrou na fila
   não comprova que a aplicação ficou funcional.

Planejar um token Coolify com permissão `deploy` para o webhook, expiração e
escopo de equipe adequados. Guardar URL do webhook e token em secrets do GitHub,
somente quando essa etapa for autorizada. O token de deploy não concede por si
só a alteração de `INDEXA_IMAGE_TAG`: essa parte do plano precisa de acesso
compatível ou seleção manual. Nenhum desses secrets foi criado agora.

`force=true` no webhook é documentado como controle de cache de build; não é
uma garantia genérica de atualizar `latest`. Aqui a versão por SHA e a política
de pull tornam a escolha explícita. Usar `latest` no futuro exige decisão e
validação próprias: a tag pode mudar entre o fim do CI e o processamento da fila.

## Validação local sem implantação

Usar somente o arquivo específico:

```sh
docker compose -f compose.coolify.yaml config --quiet
docker compose -f compose.coolify.yaml config --images
docker compose -f compose.coolify.yaml config --volumes
```

Esses comandos não fazem pull, build ou deploy e não iniciam containers.
A validação local verifica sintaxe e interpolação; não comprova autenticação,
labels/redes geradas pelo Coolify, HTTPS, permissões do disco ou prontidão no servidor.

## Informações pendentes do servidor

Lista histórica da Fase 5A. Versão, recurso, implantação manual e visibilidade
das imagens foram confirmados posteriormente; consultar os requisitos atuais da Fase 5C.

- Versão/URL da instância Coolify, equipe, projeto, ambiente e UUID do recurso.
- Servidor/destino, usuário SSH, arquitetura e capacidade de CPU/RAM/disco.
  As imagens da Fase 4 foram construídas em runner Linux AMD64; confirmar servidor
  compatível antes do pull. Build multi-arquitetura não faz parte desta etapa.
- Método de leitura do Git privado e autorização de leitura dos dois pacotes GHCR.
- Domínio, DNS, proxy escolhido e disponibilidade de HTTPS/portas 80 e 443.
- Nome e localização do volume remoto, permissões, política de backup e restauração.
- Política de acesso à agenda e autorização específica para exposição e deploy.
- Forma de atualizar a tag de release antes do webhook e método de acompanhar
  a conclusão do deploy. Nenhum valor de credencial deve ser enviado nesta preparação.

## Automação local da Fase 5C — INATIVA

Nenhum workflow de CD foi criado ou habilitado. O workflow
`.github/workflows/publicar-imagens.yaml` continua apenas construindo e publicando
imagens. Não há chamada automática ao Coolify. Não cadastrar credenciais nem
executar o modo real enquanto a FEMA não autorizar e habilitar a API.

### Arquivos e requisitos

- `scripts/coolify/deploy-indexa.sh`: lançador Bash do comando de CD.
- `scripts/coolify/deploy-indexa.mjs`: lógica em Node.js, usando somente módulos
  nativos e `fetch`, sem instalar dependências npm, jq ou Docker no cliente de CD.
- `scripts/coolify/test-deploy-indexa.sh`: lançador dos testes locais.
- `scripts/coolify/test-deploy-indexa.mjs`: respostas simuladas e bloqueio do
  `fetch` real; nenhum servidor de teste ou socket é aberto.

Usar Bash e Node.js 20 ou superior. No Windows, usar Git Bash. A lógica Node pode
ser executada diretamente com `node`, mantendo exatamente as mesmas travas.
O `.gitattributes` preserva LF somente nesses lançadores Bash, inclusive quando
o checkout Windows utiliza `core.autocrlf=true`.

Comandos seguros para esta etapa, na raiz:

```sh
bash -n scripts/coolify/deploy-indexa.sh
bash -n scripts/coolify/test-deploy-indexa.sh
node --check scripts/coolify/deploy-indexa.mjs
node --check scripts/coolify/test-deploy-indexa.mjs
bash scripts/coolify/test-deploy-indexa.sh
bash scripts/coolify/deploy-indexa.sh
```

O último comando informa **INATIVO** e termina sem fazer qualquer requisição,
inclusive de leitura. `--help` também não usa rede. São necessárias **as duas**
condições `--execute` e `INDEXA_CD_ENABLED=true` para entrar no fluxo real.
Sem ambas, o comando retorna código 0 com a mensagem INATIVO; isso não significa
deploy aprovado. Uma opção inválida retorna erro. Os testes não leem tokens reais.

### Funcionamento previsto para execução real futura

1. Validar configuração, URLs sem credenciais, SHA completo, branch main e UUID
   exclusivo `cw2jnlz4m7qvaljcc6bhmdyj`. Uma tag fornecida deve coincidir com
   `sha-${GITHUB_SHA}`; `latest` não seleciona a versão implantada.
2. Adquirir uma trava local por recurso no diretório temporário do sistema.
3. Conferir a ponta atual da main pela API GitHub e a existência das duas imagens
   SHA no GHCR, registrando seus digests. O pull público usa autorização anônima
   temporária do registry, sem PAT ou login Docker.
4. Confirmar a Application Compose e consultar o histórico paginado do Indexa.
   Qualquer implantação ativa ou estado desconhecido impede a promoção.
5. Ler exatamente `INDEXA_IMAGE_TAG` de produção, legível, única e habilitada para
   runtime. Preservar os flags e registrar a tag anteriormente configurada.
6. Revalidar main e fila, fazer PATCH da chave com a nova tag, exigir HTTP 201 e
   conferir a resposta e o valor relido. Ausência ou valor oculto interrompe o fluxo;
   o script não cria variáveis nem amplia permissões.
7. Revalidar main, fila e tag; enviar um único POST `/api/v1/deploy`, com o UUID
   do Indexa e `force: false`. Exigir HTTP 200 e um `deployment_uuid` do recurso.
   No Coolify 4.6.0, não usar GET para disparar deploy, mesmo que exemplos gerais
   de webhook ainda o mostrem. Não usar `tag` para selecionar imagens: esse
   parâmetro do Coolify agrupa recursos e poderia atingir outras aplicações.
8. Consultar o UUID retornado a cada 10 segundos, por até 10 minutos. Somente
   `finished` permite prosseguir; `failed`, `cancelled-by-user`, estado desconhecido,
   erro HTTP ou timeout reprovam a execução. `queued` não comprova conclusão.
9. Verificar HTTP 200 no frontend com o marcador Angular `app-root` e em
   `/api/contatos`, que deve retornar um array JSON. Repetir somente essas leituras
   por até 90 segundos para aguardar prontidão. Não imprimir contatos ou respostas.

Cada requisição tem timeout de 15 segundos e recusa redirecionamentos. As mensagens
de erro são controladas: não exibem token, header de autorização, corpo de erro ou
lista de variáveis. Os únicos dados de versão registrados são SHA, digests e UUID
do deploy. O POST nunca recebe retry automático; não há rollback automático.

### Configuração futura no GitHub

| Tipo | Nome | Uso |
| --- | --- | --- |
| Variable | `INDEXA_CD_ENABLED` | Ausente ou `false` agora; `true` somente após autorização de ativação. |
| Variable | `COOLIFY_BASE_URL` | `https://computacao.fema.edu.br`, sem `/api/v1`. |
| Variable | `COOLIFY_APP_UUID` | `cw2jnlz4m7qvaljcc6bhmdyj`. |
| Variable | `INDEXA_PUBLIC_URL` | URL completa funcional da aplicação HTTP externa 8081, sem query/credenciais. |
| Secret | `COOLIFY_API_TOKEN` | Token dedicado, criado somente em etapa autorizada. |
| Token automático | `GITHUB_TOKEN` | Mapear explicitamente ao ambiente do passo de CD; a publicação atual continua usando o token automático. |
| Contexto do Actions | `GITHUB_SHA`, `GITHUB_REF`, `GITHUB_REPOSITORY` | Commit completo, `refs/heads/main` e `felipe57863/Indexa`. |

`INDEXA_IMAGE_TAG` no Coolify já existe. No cliente, a tag é derivada do SHA;
fornecê-la no ambiente é opcional e, se fornecida, precisa coincidir. Não são
necessários novos secrets do GHCR para imagens públicas. Não incluir nenhum
token no Compose, no código ou em comandos literais; não executar com `bash -x`.

Na versão 4.6.0, as rotas usadas exigem abilities explícitas `read`, `write` e
`deploy`. Este script também exige `read:sensitive` para recuperar a tag anterior
e confirmar o valor salvo; o retorno sensível exige proprietário admin/owner da
equipe. Sem isso, falha antes do deploy. Não solicitar `root`, `delete` ou
`write:sensitive` como atalho. Se a FEMA não autorizar esses direitos, manter o
deploy manual e revisar a estratégia, em vez de contornar a limitação.

O token deve pertencer à equipe proprietária, com acesso selecionado somente ao
recurso Indexa, sem selecionar todo BCC ou production. Definir expiração/rotação.
As permissões dependem também do proprietário e não se limitam a uma única chave:
`write` permite outras mudanças no próprio recurso. Proteger o workflow e o secret.

### Integração e ativação — somente com nova autorização

1. Obter autorização da FEMA para a API e sua conectividade a partir do runner,
   incluindo eventual política de IPs. Não mudar a configuração global por conta própria.
2. Confirmar URL da aplicação, tag/digests atuais, nome físico do volume H2,
   backup consistente e procedimento de retorno. Verificar a parada da instância
   antiga antes da nova na atualização Compose; aceitar uma janela de indisponibilidade.
3. Autorizar o cadastro do token e das variáveis. Manter a habilitação falsa até
   o teste assistido, sem enviar valores de credenciais por mensagens ou logs.
4. Em outra tarefa autorizada, acrescentar um passo ao job existente, **depois
   dos quatro pushes bem-sucedidos**, sem `always()` ou `continue-on-error`.
   Mapear os campos da tabela apenas nesse passo, sem expor o token Coolify aos builds.
   Aplicar condição de sucesso e habilitação; somente então chamar o lançador com
   `--execute`. Este documento não altera nem habilita o workflow.
5. Preservar `concurrency: publicar-ghcr-main` e `cancel-in-progress: false`
   durante publicação, atualização, deploy e espera. Rever o timeout total do job
   para comportar os builds e a espera; não criar outro workflow concorrente.
6. Autorizar commit/push e o primeiro deploy assistido. Confirmar as duas imagens
   em execução, healthchecks, operações sintéticas, instância única e persistência.

### Concorrência, interrupção e recuperação

A trava local impede duas execuções nesse cliente; a concorrência do Actions é
necessária entre runners. A trava é removida ao terminar normalmente, inclusive
em erro tratado. Se o processo for morto, pode ficar um diretório de trava vazio
no temporário: reconciliar o deploy antes de removê-lo manualmente. Nunca remover
trava de outra execução em andamento. A consulta ao histórico limita a leitura a
10 mil registros; se exceder esse limite, a promoção falha para revisão.

PATCH e POST não são atômicos. As releituras reduzem corridas, mas não bloqueiam
outro operador no painel. Manter um único responsável pela tag e não iniciar
deploy manual enquanto o CI estiver implantando. Execuções pendentes do Actions
podem ser substituídas; não há garantia de que cada commit será implantado.
Reexecuções antigas são bloqueadas pela checagem da main. Tags SHA também podem
ser regravadas: os digests registrados precisam ser conferidos na primeira operação.

Para impedir novas promoções depois de uma futura ativação, definir a habilitação
como `false` e retirar/desabilitar o passo de CD em mudança autorizada. Isso não
desfaz um deploy já aceito, e cancelar o Actions não cancela o trabalho no Coolify.
Em erro, usar o UUID e o histórico do **Indexa** para reconciliar a situação antes
de repetir qualquer chamada. Não provocar falhas deliberadas na produção.

Se o PATCH passou e algo falhou depois, a variável pode já ter mudado. Não supor
que a tag anterior configurada era necessariamente a versão efetivamente em execução.
Confirmar os digests e a fila. Um POST sem resposta ou sem UUID tem resultado incerto;
não repeti-lo automaticamente. A volta a uma tag conhecida, se necessária, exige
operação autorizada e acompanhamento de um único deploy.

O script não cria containers, redes, volumes, réplicas ou previews. O Compose
aprovado permanece intacto. O H2 exige uma instância de backend por volume; o
fluxo Compose não promete zero downtime nem comprova sozinho o fim do processo
antigo. No primeiro teste assistido, verificar essa transição e os dados sintéticos.
Não contornar locks, não compartilhar o volume com outra instância, não apagar
volumes e não restaurar backups automaticamente. A imagem antiga não reverte
dados/esquema alterados por `ddl-auto=update`.

Os testes locais validam o cliente com respostas simuladas. Eles não comprovam
acesso real à API, digests implantados, CRUD ou persistência remota. Esses itens
permanecem pendentes de autorização. A API desativada é o bloqueio atual de ativação.

## Referências oficiais consultadas

- [Docker Compose no Coolify](https://coolify.io/docs/applications/builds/docker-compose).
- [Registry e login por servidor](https://coolify.io/docs/applications/builds/docker-registries).
- [Redes e proxy](https://coolify.io/docs/core/networking-in-coolify).
- [Armazenamento persistente](https://coolify.io/docs/applications/configuration/persistent-storage).
- [GitHub Actions com imagens existentes](https://coolify.io/docs/applications/sources/github/actions).
- [Deploy Webhooks](https://coolify.io/docs/core/automation/deploy-webhooks).
- [Autenticação do GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
- [Spring Boot atrás de proxy](https://docs.spring.io/spring-boot/4.0/how-to/webserver.html).
- [Rotas do Coolify 4.6.0](https://github.com/coollabsio/coolify/blob/v4.6.0/routes/api.php).
- [Atualização de variável](https://coolify.io/docs/api/endpoints/applications/update-env-by-application-uuid).
- [Consulta de implantação](https://coolify.io/docs/api/endpoints/deployments/get-deployment-by-uuid).
