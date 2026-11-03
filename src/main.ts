import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/*
==========================================================
COMANDOS PARA INICIAR O PROJETO INDEXA
==========================================================

Pré-requisitos:
- Node.js e npm compatíveis com Angular 17.
- Java 17 ou superior instalado.
- Computador e celular conectados à mesma rede,
  caso queira acessar a aplicação pelo celular.

Pode usar o terminal PowerShell do VS Code.

----------------------------------------------------------
PRIMEIRA EXECUÇÃO
----------------------------------------------------------

Abrir dois terminais na pasta principal do projeto.

Terminal 1 - Backend Spring Boot:

cd backend-spring
.\mvnw.cmd spring-boot:run

Backend:
http://localhost:3000

API de contatos:
http://localhost:3000/contatos


Terminal 2 - Frontend Angular:

npm ci
npm start -- --host 0.0.0.0

Frontend no computador:
http://localhost:4200


----------------------------------------------------------
ACESSO PELO CELULAR OU PELA REDE LOCAL
----------------------------------------------------------

1. Manter Angular e Spring Boot executando.

2. Descobrir o IP do computador pelo comando:

ipconfig

3. Procurar o endereço IPv4 da conexão utilizada.

4. No celular, conectado à mesma rede,
   abrir o endereço:

http://IP-DO-COMPUTADOR:4200

Exemplo:
http://192.168.3.48:4200

API correspondente:
http://192.168.3.48:3000/contatos

O IP apresentado é apenas um exemplo.
Cada computador pode ter um endereço diferente.

O Angular identifica automaticamente o hostname
utilizado para acessar a aplicação e direciona
as requisições para a API na porta 3000.

Também é possível utilizar o endereço Tailscale,
desde que os dispositivos tenham acesso à mesma
rede Tailscale.

----------------------------------------------------------
PRÓXIMAS EXECUÇÕES
----------------------------------------------------------

Depois que as dependências já estiverem instaladas:

Terminal 1 - Backend Spring Boot:

cd backend-spring
.\mvnw.cmd spring-boot:run


Terminal 2 - Frontend Angular:

npm start -- --host 0.0.0.0


----------------------------------------------------------
BANCO DE DADOS H2
----------------------------------------------------------

O banco H2 é criado automaticamente na primeira
execução do Spring Boot.

Os contatos ficam armazenados no arquivo:

backend-spring/contatosdb.mv.db

Os dados permanecem salvos após reiniciar o servidor.

O Spring Boot deve ser iniciado dentro da pasta
backend-spring para utilizar o banco correto.

----------------------------------------------------------
OBSERVAÇÕES
----------------------------------------------------------

- Manter os dois terminais abertos durante o uso.
- O Angular utiliza a porta 4200.
- O Spring Boot utiliza a porta 3000.
- Não é necessário iniciar o JSON Server antigo.
- Se o acesso pelo celular falhar, verificar o
  Firewall do Windows e a conexão de rede.
- O acesso pela rede é destinado ao ambiente
  de desenvolvimento e demonstração.

==========================================================
*/

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

