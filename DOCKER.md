# Indexa com Docker Compose — Fase 3

Na raiz do projeto, com Docker em modo Linux:

```sh
docker compose config
docker compose build
docker compose up -d --wait
docker compose ps
docker compose logs frontend backend
docker compose exec frontend nginx -t
```

Abra `http://localhost:8081` ou diretamente `/formulario` e `/lista-contatos`.
Antes de iniciar, confira se a porta está livre. Para escolher outra no PowerShell:

```powershell
$env:FRONTEND_PORT = '18081'
docker compose up -d --wait
```

Somente o frontend é publicado, no loopback; o backend fica na rede padrão do
Compose, acessível pelo nome `backend:3000`. Para parar este projeto sem remover
dados, use `docker compose stop`. Não encerre serviços de outros projetos.

O fluxo é navegador → `/api/contatos` no nginx → `/contatos` no Spring Boot.
O proxy remove somente o prefixo `/api/` e preserva o Host com sua porta, evitando
alterações de origem. Não é necessário mudar o CORS do backend para esse fluxo.
O resolver do Docker no nginx acompanha mudanças de IP ao recriar o backend.
O limite de corpo padrão do nginx foi removido para preservar uploads de avatar
Base64 já aceitos pelo backend. Este ambiente é local e não configura HTTPS.

O frontend aguarda o healthcheck HTTP do backend. Seu próprio healthcheck
consulta a API pelo nginx: `docker compose up --wait` aguarda ambos ficarem prontos.

## H2 e teste de persistência

O volume nomeado `h2-data` é montado em `/data`; a imagem backend já usa
`jdbc:h2:file:/data/contatosdb`. O Compose prefixa o nome do volume com o projeto.
Não há importação, montagem ou alteração do `backend-spring/contatosdb.mv.db` local.
Não execute `down -v` nem remova o volume. Use apenas uma instância por volume H2.

Para testar sem usar um volume existente, escolha um nome de projeto exclusivo:

```sh
docker compose -p indexa-teste-20261103-01 up -d --build --wait
```

Escolha um nome novo, em minúsculas, para cada teste isolado; o nome acima é um exemplo.
Use esse mesmo `-p` em todos os comandos do teste. Pelo navegador, cadastre um
contato fictício, confira o perfil, edite e valide a alteração na lista.
Anote o ID exibido na URL do perfil. Recrie somente o backend, preservando o volume:

```sh
docker compose -p indexa-teste-20261103-01 up -d --no-deps --force-recreate --wait backend
```

Recarregue `/perfil-contato/ID` e confirme os dados. O nginx pode levar alguns
segundos para atualizar o DNS. Depois exclua somente o contato sintético pela
interface e confirme que desapareceu. Finalize com `docker compose -p indexa-teste-20261103-01 stop`.
Nunca use dados reais nesse roteiro. `GET /api/contatos` também permite conferir
a comunicação; um ID inexistente deve retornar 404 JSON da API, não o index.html.

O estágio de build usa Node 20, compatível com Angular 17.3, e `npm ci` com o
lockfile existente. As bases Node e nginx estão fixadas por digest; atualizações
exigem revisão explícita. Node e dependências de compilação não entram na
imagem final. O build requer acesso ao registry npm e às fontes Google já
referenciadas na aplicação. Nenhuma dependência foi atualizada nesta fase.

Angular 17 e Node 20 já estão fora de suporte. Node 20 foi mantido somente no
build por compatibilidade com a versão existente; atualizar essa stack requer
uma tarefa separada. Referências: [compatibilidade Angular](https://angular.dev/reference/versions)
e [ciclo do Node](https://nodejs.org/en/about/previous-releases).

O builder `@angular-devkit/build-angular:application` gera o site em
`dist/indexa/browser/`, caminho confirmado por execução real. nginx recebe
somente esse conteúdo e o arquivo de licenças de terceiros. O contexto Docker
exclui Git, backend, bancos H2, builds locais, dependências locais e `.env`.

nginx usa `try_files` com fallback para `index.html` para acesso direto e reload
das rotas Angular, inclusive `/formulario/1` e `/perfil-contato/1`. Assets ausentes
retornam 404 para evitar servir HTML como JavaScript, CSS ou imagem.

## Desenvolvimento sem Docker

A API Angular usa a rota relativa `/api/contatos`. Para preservar `npm start`,
`angular.json` carrega `proxy.conf.json` no `ng serve`: o proxy local encaminha
`/api/` para `http://127.0.0.1:3000`, removendo o prefixo. Inicie o Spring Boot
separadamente no diretório backend-spring, como antes. Reinicie o `ng serve`
ao alterar a configuração do proxy. Nenhuma variável de ambiente é necessária.

Para execução isolada do backend, consulte [backend-spring/DOCKER.md](backend-spring/DOCKER.md).

## Organização do Dockerfile

O frontend utiliza dois estágios: Node instala as dependências e compila o
Angular; nginx recebe os arquivos gerados e serve a aplicação. As principais
decisões são:

- Node 20 atende ao Angular 17 do Indexa e usa uma base Debian no build.
- O trecho `@sha256:...` fixa o conteúdo da imagem base, além do nome da versão.
- `npm run build` chama o `ng build` definido no `package.json` do projeto.
- `--no-audit --no-fund` omitem a auditoria automática e as mensagens de
  financiamento durante a instalação; `NG_CLI_ANALYTICS=false` desativa a
  telemetria do Angular CLI. São opções auxiliares, não etapas adicionais.
- Os `COPY` selecionam configurações e fontes necessárias; o `.dockerignore`
  mantém backend, bancos e arquivos privados fora do contexto do frontend.
- O resultado está em `dist/indexa/browser/`; a cópia adicional de
  `3rdpartylicenses.txt` preserva os avisos de licença gerados pelo Angular.
- `nginx/default.conf` atende às rotas da SPA e retorna 404 para assets ausentes.
- O `CMD ["nginx", "-g", "daemon off;"]` já é herdado da imagem nginx;
  repeti-lo no Dockerfile não muda o funcionamento.

A separação dos estágios mantém as ferramentas de compilação fora da imagem
final e permite explicar cada etapa do processo de construção.
