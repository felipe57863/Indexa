# AGENTS.md — Indexa | Docker e CI/CD

Este arquivo define as **regras permanentes de trabalho do Codex** no projeto acadêmico Indexa.

**Objetivo:** preparar a aplicação existente para execução em containers e, em etapas autorizadas, automatizar a publicação de imagens no GitHub Container Registry (GHCR) e a implantação pelo Coolify.

**Princípio:** autonomia técnica dentro do escopo aprovado, preservação da aplicação e validação real dos resultados. Este arquivo não é um cronograma nem autoriza implementar fases futuras.

## 1. Contexto e stack existente

A estrutura observada no pacote inicial é:

```text
indexa_entrega/
├── package.json            # Angular na raiz
├── angular.json
├── src/
└── backend-spring/
    ├── pom.xml
    ├── mvnw
    ├── .mvn/
    └── src/
```

Tecnologias identificadas:

- **Frontend:** Angular 17, TypeScript e npm.
- **Backend:** Java 17, Spring Boot e Maven Wrapper.
- **Banco de dados:** H2 em arquivo, integrado ao backend.
- **Infraestrutura pretendida:** Docker, Docker Compose, nginx, GitHub Actions, GHCR e Coolify.

Configurações encontradas no projeto inicial:

- Backend: `server.port=3000`.
- Banco: `spring.datasource.url=jdbc:h2:file:./contatosdb`.
- Frontend: requisições para o hostname do navegador, na porta `3000`, rota `/contatos`.

**O repositório é a fonte de verdade.** Antes de implementar, conferir os arquivos atuais; valores, versões, nomes e caminhos acima podem mudar. Não assumir que uma proposta de arquitetura já esteja implementada.

Não trocar framework, gerenciador de pacotes, banco ou plataforma de deploy por preferência pessoal. Se uma mudança estrutural for realmente necessária, apresentar justificativa e impacto para decisão do usuário.

## 2. Escopo e níveis de autonomia

O pedido atual define o **objetivo, o limite e as ações autorizadas**. O Codex pode tomar decisões técnicas e modificar os arquivos necessários para concluir uma tarefa claramente autorizada, sem pedir confirmação para cada arquivo.

**Nível 1 — Livre para investigar e validar, com segurança:**

- Ler código, configurações e documentação; consultar referências técnicas.
- Verificar estado do Git, inspecionar diffs, analisar logs e diagnosticar problemas.
- Executar builds e testes locais não destrutivos, usando dados sintéticos quando houver banco.
- Recomendar melhorias ou riscos sem implementá-los fora do escopo.

**Nível 2 — Autonomia dentro da tarefa autorizada:**

- Criar ou editar os arquivos necessários ao objetivo aprovado, mesmo que sejam vários arquivos relacionados.
- Configurar Dockerfiles, nginx, Compose, scripts ou workflows **quando fizerem parte da tarefa**.
- Corrigir problemas diretamente causados ou bloqueadores da implementação autorizada, desde que a correção seja pequena e não altere regras de negócio.
- Construir imagens e iniciar containers locais de teste; encerrar apenas os recursos temporários criados pela própria tarefa.
- Escolher imagens base, estágios, cache e organização técnica compatíveis com o projeto; explicar decisões relevantes.

**Nível 3 — Requer autorização específica:**

- Alterar regra de negócio, contratos de API, modelo de dados ou tecnologia principal.
- Apagar ou substituir bancos, volumes, recursos persistentes ou ambientes existentes.
- Criar ou alterar recursos reais no servidor/Coolify; ativar deploy automático; publicar imagens externamente.
- Configurar ou modificar secrets e permissões de serviços externos.
- Fazer `git commit`, `git push`, criar/alterar branches ou publicar releases.
- Executar comandos destrutivos, sobrescrever trabalho existente ou modificar recursos fora do workspace.

**Autorização por objetivo:** se o usuário autorizar explicitamente uma tarefa completa, não solicitar novas confirmações para pequenas decisões internas ao seu escopo. Se a implementação exigir uma ação de Nível 3 que não tenha sido autorizada, interromper somente essa ação, explicar o motivo e apresentar o caminho para continuar.

Não iniciar uma fase seguinte apenas porque ela está descrita como objetivo futuro.

## 3. Preservação da aplicação e do banco

Este trabalho tem foco em **containerização e CI/CD**, não em refatorar o sistema.

- Preservar telas, endpoints, validações, regras de negócio e comportamento existente.
- Preferir mudanças de configuração isoladas e compatíveis; não reformatar arquivos inteiros sem necessidade.
- Não atualizar dependências ou corrigir bugs antigos sem ligação com a tarefa, salvo autorização.
- Se uma mudança funcional for indispensável ao deploy, demonstrar causa, alteração mínima, impactos e testes.
- Não transformar o H2 em PostgreSQL/MySQL nem adicionar um banco separado sem decisão explícita.

O H2 atual usa `jdbc:h2:file:./contatosdb`: **não é um banco em memória**. Dados podem existir em arquivos `contatosdb*`.

- Nunca tratar os arquivos reais do banco como descartáveis.
- Para teste, preferir banco ou volume temporário com dados sintéticos.
- Planejar um diretório/volume persistente para o container do backend, validando o caminho JDBC real.
- Testar persistência com recriação controlada do container **sem excluir o volume**.
- Não apagar, migrar ou sobrescrever dados reais sem aprovação e plano de recuperação.

Comandos como `docker compose down -v`, `docker volume prune`, `docker system prune --volumes`, `rm -rf`, `git reset --hard` e `git clean -fdx` exigem autorização específica. Nunca usá-los por conveniência para resolver um erro.

## 4. Diretrizes de Docker e execução

A implementação deve ser reproduzível a partir de **clone limpo**, sem exigir artefatos previamente compilados no host.

- Preferir build dentro do Docker; usar multi-stage build quando trouxer benefício.
- Utilizar Java compatível com o `pom.xml`, Maven Wrapper do backend e Node compatível com o Angular.
- No frontend, respeitar o lockfile e preferir `npm ci` quando aplicável.
- Na imagem final do frontend, preferir servidor estático como nginx em vez de `ng serve`.
- Verificar o caminho real da saída Angular antes de escrever `COPY`.
- Criar `.dockerignore` coerente com cada contexto de build.
- Não embutir credenciais ou arquivos locais do banco na imagem.
- Usar portas e nomes consistentes com os serviços existentes, evitando exposição pública desnecessária.

**Comunicação prevista para produção:** navegador → nginx/HTTPS → rota relativa `/api/...` → backend interno na porta 3000. É uma **direção de arquitetura**, não instrução para alterar a aplicação antecipadamente. Conferir rotas e reescrita de caminhos ao implementar o proxy.

O Compose local deverá, quando solicitado, reunir frontend, backend, rede e persistência do H2. O `depends_on` define ordem de início, mas não substitui healthcheck ou teste de prontidão quando isso for necessário.

Pode optar por outra solução técnica compatível se justificar e validar o resultado, sem ampliar desnecessariamente o escopo.

## 5. GitHub Actions, GHCR e Coolify

Fluxo-alvo aprovado para o trabalho:

```text
GitHub (push autorizado)
    → GitHub Actions (build e verificações)
    → GHCR (imagens frontend e backend)
    → Coolify (atualização do deploy)
    → servidor (containers e volume H2)
```

Diretrizes para quando essa etapa for autorizada:

- Construir e publicar **duas imagens** se frontend e backend permanecerem separados.
- Usar tags rastreáveis por commit (por exemplo SHA), podendo manter tag móvel adicional.
- Só acionar deploy após conclusão bem-sucedida dos builds e pushes necessários.
- Configurar Coolify para consumir as imagens publicadas, evitando rebuild redundante na estratégia escolhida.
- Garantir que novas imagens realmente sejam usadas no deploy; não presumir que reutilizar `latest` atualize o container.
- Conferir visibilidade/autenticação de imagens GHCR, portas, domínio, HTTPS, variáveis e volume antes do deploy.
- Não usar o sucesso do workflow como prova isolada de sucesso da aplicação no servidor.

**Criar um workflow não implica autorização para ativar uma implantação real.** Distinguir preparar arquivos, publicar no registry e alterar produção. Ações externas devem estar claramente incluídas na autorização atual.

## 6. Segurança e credenciais

- Nunca incluir tokens, senhas, chaves privadas ou credenciais em código, Dockerfiles, Compose versionado, relatórios ou logs.
- Usar os mecanismos de secrets do GitHub e de variáveis protegidas do Coolify quando aplicável.
- Não imprimir valores sensíveis nem copiar URLs de webhook contendo segredos.
- Não publicar por engano arquivos `.env` locais, bancos H2, backups ou material privado.
- Não executar `docker login` com credenciais literais em comandos versionados; utilizar entrada segura.
- Conferir o que será adicionado ao Git antes de qualquer commit autorizado.

Se identificar segredo já exposto, informar o risco, evitar reproduzi-lo e propor revogação/rotação; não publicar novamente.

## 7. Fluxo de trabalho, testes e validação

Antes de alterar arquivos, verificar quando disponível:

```bash
git status --short
git branch --show-current
git rev-parse --short HEAD
```

Se houver modificações pré-existentes, preservá-las e distinguir alterações do usuário daquelas feitas pelo Codex.

Trabalhar por **blocos lógicos**, não obrigatoriamente um arquivo por vez:

1. Entender objetivo e estado real.
2. Implementar o conjunto mínimo coerente de mudanças.
3. Executar verificações adequadas ao bloco.
4. Examinar diff e resultados.
5. Entregar conclusão e aguardar a próxima tarefa.

Após mudanças, usar quando disponível:

```bash
git diff --check
git diff
git status --short
```

Validações conforme a alteração:

- **Backend:** Maven Wrapper, build, inicialização real, porta 3000 e endpoint existente.
- **Frontend:** instalação/build Angular, nginx, carregamento, rotas internas e comunicação com API.
- **Compose:** `docker compose config`, build, `up`, status, logs e operação funcional com dados sintéticos.
- **H2:** demonstrar leitura/gravação e persistência após recriação controlada sem exclusão do volume.
- **CI:** execução do workflow, publicação efetiva das imagens no GHCR e tags corretas.
- **CD:** confirmar no Coolify e na aplicação publicada a versão realmente implantada, após alteração controlada.

Não confundir **container iniciado**, **build concluído** e **aplicação funcional**. São validações diferentes.

Se testes não puderem ser executados por indisponibilidade de Docker, rede, credenciais ou servidor, registrar como **não testado**, com motivo. Não afirmar sucesso sem evidência.

## 8. Git e histórico

Usar Conventional Commits, por exemplo:

```text
build: dockeriza backend
build: dockeriza frontend
build: configura compose local
ci: publica imagens no ghcr
ci: integra deploy com coolify
docs: documenta execucao e deploy
```

Não fazer commit, push, rebase, reset, force-push nem criar branches sem autorização explícita. Quando autorizado, conferir o diff e incluir somente arquivos relacionados à tarefa.

Não alterar diretamente arquivos internos de `.git/`.

## 9. Relatórios externos ao repositório

Para **implementações, auditorias, diagnósticos significativos, testes de infraestrutura e operações de CI/CD**, produzir um relatório Markdown completo. Consultas simples podem ser respondidas diretamente, salvo pedido de relatório.

Pasta padrão: `../relatorios-codex`, resolvida em caminho absoluto a partir da **raiz real do projeto**. Criá-la somente se permitido pelo ambiente. Os relatórios devem permanecer **fora do repositório** e não podem entrar em commits.

Nome de arquivo:

```text
AAAA-MM-DD_HH-mm-ss__PASSO__ACAO.md
```

Usar identificador do passo, se informado; caso contrário, uma categoria como `auditoria`, `docker`, `ci` ou `deploy`. Não sobrescrever relatórios existentes.

O relatório deve incluir, conforme aplicável:

- Objetivo, escopo, data/hora e estado inicial do Git.
- Arquivos lidos, criados, alterados ou removidos.
- Decisões técnicas, comandos executados e resumo do diff.
- Builds/testes realizados e respectivas evidências ou erros.
- Imagens, containers e volumes envolvidos, sem expor segredos ou dados reais.
- Estado final do Git, commits/pushes realizados ou não, riscos e pendências.
- Situação final: **IMPLEMENTADO / TESTADO / PENDENTE / BLOQUEADO**.

Se não conseguir salvar o relatório, informar o impedimento sem declarar essa obrigação cumprida. Não alterar `.gitignore` só para acomodar relatórios externos.

## 10. Comunicação e encerramento

Comunicar-se em **português brasileiro**, com linguagem objetiva e explicando decisões importantes.

Quando o pedido já autorizar claramente a execução, trabalhar diretamente sem exigir uma segunda confirmação. Quando houver ambiguidade relevante, risco destrutivo ou mudança de escopo, explicar a decisão necessária antes de executar a ação afetada.

Ao terminar, fornecer um resumo curto:

```text
Objetivo:
Arquivos alterados/criados:
Implementado:
Build:
Testes realizados:
Não testado / bloqueios:
Estado do Git:
Commit/push (realizado ou não):
Relatório externo (caminho absoluto, se aplicável):
Próximo passo recomendado:
```

Não prometer testes, deploys ou resultados que ainda não ocorreram. Não avançar automaticamente para a próxima fase.

**Prioridade:** preservar dados e comportamento → entregar solução correta → validar → manter simples e rastreável.
