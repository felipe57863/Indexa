# Publicação de imagens com GitHub Actions e GHCR

**Fase 5C:** o código de CD foi preparado somente em `scripts/coolify/`, sem
alterar o workflow de publicação. A API REST da FEMA está desativada globalmente.
Não há deploy automático ativo, novo workflow de CD ou credencial criada.

O workflow [publicar-imagens.yaml](.github/workflows/publicar-imagens.yaml)
está preparado para executar após cada `push` na branch `main`.
Ele publica duas imagens no GitHub Container Registry:

| Imagem | Dockerfile | Contexto de build |
| --- | --- | --- |
| `ghcr.io/felipe57863/indexa-frontend` | `Dockerfile` | Raiz do projeto |
| `ghcr.io/felipe57863/indexa-backend` | `backend-spring/Dockerfile` | `backend-spring/` |

## Etapas do workflow

1. Obter o código do commit que disparou a execução.
2. Construir o frontend com Angular e nginx.
3. Construir o backend com Java e Maven Wrapper, incluindo os testes já definidos no Dockerfile.
4. Autenticar no GHCR com o `GITHUB_TOKEN` automático do GitHub Actions.
5. Publicar as duas imagens com a tag `sha-<SHA completo do commit>`.
6. Atualizar a tag `latest` das duas imagens.

Não são necessários secrets personalizados ou token pessoal para esse workflow.
As permissões declaradas são somente `contents: read` (ler o repositório) e
`packages: write` (publicar pacotes). Checkout e login usam ações fixadas por SHA;
o comentário ao lado identifica a versão principal usada. Atualizar essas ações
exige revisar e trocar o SHA correspondente.

Os comandos de build e push executam em sequência, no mesmo job. Se um build
falhar, nenhuma imagem dessa execução será enviada ao GHCR. Se um push falhar,
o job falha e os passos seguintes não executam. `latest` só começa a ser
atualizada depois que as duas tags do commit forem enviadas.

O GHCR não oferece uma transação entre as duas imagens: uma falha durante os
pushes pode deixar publicação parcial, inclusive entre as tags `latest`.
Por isso, considere a publicação concluída somente quando o job inteiro passar
e as duas imagens tiverem a tag do mesmo commit. A configuração `concurrency`
evita duas execuções publicando simultaneamente.

As tags com SHA permitem localizar a versão do código. `latest` é móvel e
representa a última atualização concluída dessa tag; para identificar uma imagem
com precisão, confira também seu digest. Os builds recebem a label
`org.opencontainers.image.source` com o endereço deste repositório.

## Como verificar no GitHub

Depois que o workflow for versionado e enviado para `main`:

1. Abra a aba **Actions** do repositório `felipe57863/Indexa`.
2. Selecione **Publicar imagens no GHCR** e a execução do commit enviado.
3. Confira os dois passos de build, o login e os passos de publicação.
4. Confirme que o job terminou com sucesso e anote o SHA da execução.
5. Na seção **Packages** do repositório ou do perfil, abra `indexa-frontend`
   e `indexa-backend`. Confira `latest` e `sha-<SHA da execução>` nas duas imagens.
6. Confira os digests publicados. Em uma execução sem concorrência posterior,
   `latest` e a tag do commit devem apontar para o mesmo conteúdo em cada imagem.

Os pacotes são privados por padrão na primeira publicação. O workflow não altera
sua visibilidade. Se já existir um pacote com esses nomes sem vínculo com o
repositório, poderá ser necessário conceder acesso ao repositório nas configurações
desse pacote. Isso deve ser verificado somente se a primeira execução apresentar
erro de permissão; nenhum acesso externo foi modificado nesta etapa.

Quando houver acesso de leitura ao pacote, é possível conferir as tags com:

```sh
docker buildx imagetools inspect ghcr.io/felipe57863/indexa-frontend:sha-SHA_DO_COMMIT
docker buildx imagetools inspect ghcr.io/felipe57863/indexa-backend:sha-SHA_DO_COMMIT
```

Substitua `SHA_DO_COMMIT` pelo SHA completo. Esses comandos podem exigir
autenticação local para pacotes privados; não coloque credenciais em arquivos do
projeto nem as envie em mensagens ou logs.

## Registro de validação da Fase 4

A sintaxe e a estrutura foram validadas localmente na entrega inicial. A execução
remota e a publicação, que dependiam do primeiro push autorizado, foram concluídas
na Fase 4. Atualmente as duas imagens são públicas. Aprovação de testes locais de
CD não comprova uma nova execução remota nem uma implantação no servidor.

O Compose local continua construindo as imagens com os Dockerfiles existentes.
Este workflow não altera sua execução e não realiza implantação em servidor.

## CD local preparado, sem ativação

O lançador `scripts/coolify/deploy-indexa.sh` chama a lógica Node.js sem dependências
adicionais. O comando padrão e `--help` não fazem requisições. O modo real exige
simultaneamente `--execute` e `INDEXA_CD_ENABLED=true`; essa habilitação deve
permanecer ausente ou falsa agora.

Para executar somente testes com respostas simuladas:

```sh
bash scripts/coolify/test-deploy-indexa.sh
```

Os testes bloqueiam `fetch` real e usam somente credenciais sintéticas. Cobrem
configuração, SHA, imagens, disponibilidade/permissões, variável e PATCH, resposta
do POST, estados e timeout, concorrência e validação HTTP. Não fazem deploy nem
acessam a FEMA. Bash e Node.js 20+ são suficientes; no Windows, usar Git Bash.

No futuro, a integração deverá ser um passo após **todos os pushes aprovados** do
job existente, com condição normal de sucesso e habilitação explícita. Não usar
`always()`. Preservar o grupo de concorrência até o fim do acompanhamento, revisar
o timeout do job e expor o token Coolify somente ao passo de CD. O script bloqueia
SHA diferente da ponta da main, exige as duas tags SHA no GHCR, confirma a variável,
faz um único POST e acompanha `deployment_uuid`. `latest` não define a versão de CD.

Secrets/variáveis futuros, permissões por recurso, ativação, recuperação e riscos
do H2 estão em [Automação local da Fase 5C](COOLIFY.md#automação-local-da-fase-5c--inativa).
O `GITHUB_TOKEN` precisa ser mapeado explicitamente ao ambiente desse futuro passo.
O script exige leitura do valor da variável; sem `read:sensitive` e perfil permitido
no Coolify, interrompe a execução. Não ampliar para `root` para contornar essa falha.

`finished` e HTTP válido são verificações do cliente; referências/digests dos dois
containers, instância única e persistência devem ser confirmados no teste assistido.
Falha ou timeout não gera retry automático do POST nem rollback. Desabilitar o
futuro passo impede novas promoções, mas não cancela deploy já aceito no servidor.

**Pendente de autorização:** API e acesso institucional, credenciais, configuração
do passo de workflow, commit/push e primeiro teste real assistido. Nenhuma dessas
operações é executada pelos testes locais ou por esta documentação.

Referências oficiais: [publicar imagens Docker no Actions](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images),
[Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
e [autenticação com GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token).
