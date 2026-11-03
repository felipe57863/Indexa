# Indexa

O Indexa é uma aplicação de agenda de contatos desenvolvida como trabalho
acadêmico do curso de Análise e Desenvolvimento de Sistemas (ADS).
O projeto reúne uma interface Angular, uma API Spring Boot e um banco H2
salvo em arquivo.

## Funcionalidades

- Cadastrar, listar, consultar, editar e excluir contatos com confirmação.
- Buscar contatos pelo nome e organizar a lista pela letra inicial.
- Registrar nome, telefone, e-mail, aniversário, redes sociais e observações.
- Adicionar uma imagem ao contato.
- Validar os campos obrigatórios do formulário e o formato do e-mail.

## Tecnologias

| Parte | Tecnologias |
| --- | --- |
| Interface | Angular 17, TypeScript, HTML, CSS e Angular Material |
| API | Java 17, Spring Boot e Spring Data JPA |
| Banco de dados | H2 em arquivo |
| Build | npm com `package-lock.json` e Maven Wrapper |
| Execução em containers | Docker, Docker Compose e nginx |

## Estrutura do projeto

```text
Indexa/
├── src/                   # Interface Angular
├── backend-spring/        # API Spring Boot e Dockerfile do backend
├── nginx/
│   └── default.conf       # Arquivos estáticos, rotas Angular e proxy da API
├── Dockerfile             # Build Angular e execução com nginx
├── compose.yaml           # Integração dos serviços e volume do H2
├── proxy.conf.json        # Proxy da API para o ng serve
├── package.json
├── package-lock.json
└── DOCKER.md              # Instruções técnicas de execução e testes
```

## Como executar com Docker Compose

É necessário ter o Docker com suporte a containers Linux e o Docker Compose
instalados e em execução. No Windows, pode ser utilizado o Docker Desktop.
Não é necessário instalar Node.js, Java ou Maven no computador para essa forma
de execução: os builds são feitos dentro dos containers.

Clone o repositório e entre na pasta do projeto:

```sh
git clone https://github.com/felipe57863/Indexa.git
cd Indexa
```

Confira se a porta **8081** está livre. Na raiz do projeto, execute:

```sh
docker compose config
docker compose build
docker compose up -d --wait
```

O primeiro build precisa de acesso à internet para baixar imagens,
dependências e as fontes utilizadas pela interface.

Abra **http://localhost:8081** no navegador. O Compose aguarda os testes de
prontidão dos serviços antes de concluir o comando com `--wait`.

O navegador acessa a interface e a API pelo mesmo endereço. nginx encaminha
`/api/contatos` para `/contatos` no backend, pela rede interna do Docker.
A porta 3000 do backend não é publicada no computador; somente o frontend
é disponibilizado no endereço local.

Se a porta 8081 estiver ocupada, escolha outra livre. Exemplo no PowerShell:

```powershell
$env:FRONTEND_PORT = '18081'
docker compose up -d --wait
```

Nesse caso, acesse `http://localhost:18081`.

## Comandos básicos

Execute os comandos na raiz do projeto:

| Comando | Finalidade |
| --- | --- |
| `docker compose ps` | Consultar o estado dos serviços |
| `docker compose logs -f frontend backend` | Acompanhar os logs; `Ctrl+C` encerra apenas o acompanhamento |
| `docker compose exec frontend nginx -t` | Verificar a configuração do nginx |
| `docker compose stop` | Parar os serviços, preservando os dados |
| `docker compose up -d --wait` | Iniciar novamente e aguardar os serviços |
| `docker compose up -d --build --wait` | Reconstruir as imagens e iniciar após alterações no projeto |

## Persistência do H2

O H2 é um banco salvo em arquivo, não um banco em memória. No ambiente Compose,
o arquivo fica em `/data/contatosdb.mv.db`, dentro do volume nomeado `h2-data`
montado no backend. O Docker Compose acrescenta o nome do projeto ao nome
físico do volume.

Os contatos permanecem disponíveis ao parar ou recriar o container do backend,
desde que o mesmo volume seja mantido. Use o mesmo nome de projeto Compose nas
próximas execuções: outro nome cria um ambiente e um volume separados.
Não remova o volume se quiser preservar os contatos.

O arquivo de banco usado na execução local, em `backend-spring/`, é separado do
volume Docker e não é importado automaticamente. Bancos, dependências e saídas
de build ficam fora do versionamento.

Para detalhes de desenvolvimento sem Docker, escolha de portas e testes com
dados fictícios, consulte [DOCKER.md](DOCKER.md). As instruções do backend
isolado estão em [backend-spring/DOCKER.md](backend-spring/DOCKER.md).

## Publicação de imagens

O workflow do GitHub Actions está configurado para construir frontend e backend
após `push` em `main` e publicá-los no GHCR com tags `latest` e uma tag com o SHA
do commit. O funcionamento e a conferência da primeira execução estão em [CI.md](CI.md).
