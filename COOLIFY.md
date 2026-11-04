# Preparação do Indexa para Coolify — Fase 5A

Esta entrega prepara a configuração; não executa deploy nem altera o servidor.
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

## Plano para acionar o Coolify após o CI — não implementado

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

## Referências oficiais consultadas

- [Docker Compose no Coolify](https://coolify.io/docs/applications/builds/docker-compose).
- [Registry e login por servidor](https://coolify.io/docs/applications/builds/docker-registries).
- [Redes e proxy](https://coolify.io/docs/core/networking-in-coolify).
- [Armazenamento persistente](https://coolify.io/docs/applications/configuration/persistent-storage).
- [GitHub Actions com imagens existentes](https://coolify.io/docs/applications/sources/github/actions).
- [Deploy Webhooks](https://coolify.io/docs/core/automation/deploy-webhooks).
- [Autenticação do GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
- [Spring Boot atrás de proxy](https://docs.spring.io/spring-boot/4.0/how-to/webserver.html).
