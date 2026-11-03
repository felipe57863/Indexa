# Backend em Docker — Fase 1

Execute na raiz do projeto, com Docker Desktop em modo Linux iniciado:

```sh
docker build --progress=plain -t indexa-backend:fase1 ./backend-spring
docker volume create indexa-backend-h2
docker run -d --name indexa-backend -p 127.0.0.1:3000:3000 --mount type=volume,src=indexa-backend-h2,dst=/data indexa-backend:fase1
docker logs indexa-backend
curl http://localhost:3000/contatos
```

O build usa Java 17 JDK e Maven Wrapper, compila o código e executa os
testes existentes com H2 em memória. A imagem final contém JRE 17 e o JAR,
executados como usuário sem privilégios (UID/GID 10001).
Não exige Maven instalado nem JAR previamente compilado no host.
As bases Temurin Java 17/Ubuntu Jammy estão fixadas por digest para evitar
mudanças silenciosas. Atualizações de segurança exigem revisão desses digests.
O Maven e as dependências continuam definidos pelo wrapper e pelo POM existente.

A variável da imagem `SPRING_DATASOURCE_URL=jdbc:h2:file:/data/contatosdb`
faz o H2 gravar `/data/contatosdb.mv.db`. Sempre monte um volume nomeado em
`/data`: sem essa montagem, os dados ficam na camada descartável do container.
Um volume novo recebe as permissões do diretório da imagem; bind mounts ou
volumes preexistentes precisam permitir escrita pelo UID 10001.
Use somente uma instância do backend por volume H2.

O `application.properties` não foi alterado: fora do Docker o banco continua
em `jdbc:h2:file:./contatosdb`. O banco original não é enviado ao build nem
importado para o volume. Não monte o diretório do banco original para testes.
A porta é publicada somente no loopback local. Esta fase não configura
autenticação, HTTPS nem exposição externa.

## Teste de persistência com dados sintéticos

Use nomes exclusivos para não interferir com outros recursos:

```sh
docker volume create indexa-fase1-h2-teste
docker run -d --name indexa-fase1-teste-a -p 127.0.0.1:3000:3000 --mount type=volume,src=indexa-fase1-h2-teste,dst=/data indexa-backend:fase1
docker logs indexa-fase1-teste-a
```

Aguarde a mensagem `Started BackendSpringApplication` e confirme `GET /contatos`
antes de cadastrar um contato fictício. No PowerShell:

```powershell
$contato = @{ nome = 'Teste Docker'; email = 'docker@example.invalid'; telefone = '000000000' } | ConvertTo-Json
$criado = Invoke-RestMethod http://localhost:3000/contatos -Method Post -ContentType 'application/json' -Body $contato
$criado.id
```

Pare a primeira instância e crie outro container usando o mesmo volume:

```sh
docker stop indexa-fase1-teste-a
docker run -d --name indexa-fase1-teste-b -p 127.0.0.1:3000:3000 --mount type=volume,src=indexa-fase1-h2-teste,dst=/data indexa-backend:fase1
docker logs indexa-fase1-teste-b
```

Após a inicialização, consulte `GET /contatos/{id}` com o ID retornado e
confira os mesmos dados. O container anterior pode permanecer parado para
inspeção. Ao terminar, pare somente o container de teste criado nesta sessão;
preserve o volume. Não execute remoção de volumes nem comandos de prune.

As instruções acima são um roteiro de execução. As evidências e o resultado
real da validação desta entrega constam no relatório externo da Fase 1.
