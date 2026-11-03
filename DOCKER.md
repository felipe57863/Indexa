# Frontend Angular em Docker — Fase 2

Na raiz do projeto, com Docker em modo Linux:

```sh
docker build --progress=plain -t indexa-frontend:fase2 .
docker run -d --name indexa-frontend -p 127.0.0.1:8080:80 indexa-frontend:fase2
docker exec indexa-frontend nginx -t
docker logs indexa-frontend
```

Abra `http://localhost:8080` ou diretamente `/formulario` e `/lista-contatos`.
Escolha outra porta livre se 8080 estiver ocupada. O container serve na porta 80;
o exemplo publica somente no loopback. Ao encerrar o teste, use
`docker stop indexa-frontend` somente no container criado por você.

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

## Limite da validação nesta fase

A URL da API permanece `http://<hostname-do-navegador>:3000/contatos`.
Não há proxy `/api`, Compose ou configuração de backend nesta entrega.
O backend existente permite CORS para a porta 4200: usar o frontend em 8080
não valida integração, mesmo com o backend disponível. A integração completa,
incluindo chamadas de contatos, será tratada na Fase 3 mediante autorização.

O fallback HTTP comprova a entrega da SPA; telas que consultam um contato por
ID também precisam da API para exibir os dados. O teste de renderização do
formulário sem ID não exige cadastrar nem alterar contatos.

Evidências de build, nginx, arquivos estáticos e rotas desta execução estão no
relatório externo da Fase 2. Para a Dockerização do backend já concluída,
consulte `backend-spring/DOCKER.md`.

## Comparação com o exemplo acadêmico AGRUPA

A referência está em [docs/padrao-docker-professor.md](docs/padrao-docker-professor.md).
O fluxo é o mesmo: instalar dependências, compilar com Node e copiar o resultado
para nginx. As diferenças têm estas finalidades:

- Node 20 atende ao Angular 17 do Indexa; Node 22 pertence ao exemplo AGRUPA.
  A base Debian já testada foi mantida; trocar para Alpine não é necessário.
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

A revisão acadêmica manteve a implementação testada: não foram identificadas
etapas extras cuja remoção trouxesse benefício concreto nesta atividade.
