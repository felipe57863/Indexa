# Referência de Dockerfiles — atividade AGRUPA

## Finalidade

Este documento registra os **Dockerfiles usados no projeto acadêmico AGRUPA**, apresentados pelo responsável pelo projeto como referência de um trabalho anterior aprovado pelo professor.

O objetivo é orientar a **simplicidade, a organização e a facilidade de explicação** da containerização do projeto Indexa. Estes exemplos são referências de estilo e estrutura, **não especificações para copiar literalmente**.

## 1. Frontend AGRUPA — Angular + nginx

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/AGRUPA/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**O que preservar como estilo:**

- Dois estágios claros: Node.js para compilar e nginx para servir o resultado.
- `WORKDIR`, `COPY`, `RUN`, `EXPOSE` e `CMD` dispostos em sequência fácil de acompanhar.
- Instalação reproduzível das dependências com `npm ci`.
- Poucas configurações, somente as necessárias.

**O que adaptar no Indexa:**

- A versão de Node.js deve ser compatível com o Angular e o lockfile do Indexa (não assumir que Node 22 é a melhor opção).
- O caminho `dist/AGRUPA/browser` pertence ao AGRUPA; usar o caminho real produzido pelo build do Indexa.
- O `nginx.conf` deve atender às rotas da aplicação. A integração da API via proxy reverso será tratada na etapa autorizada para isso.

## 2. Backend AGRUPA — Spring Boot + Java

```dockerfile
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw && ./mvnw clean package -DskipTests

FROM eclipse-temurin:25-jdk
WORKDIR /app
COPY --from=build /app/target/tat-3ds-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**O que preservar como estilo:**

- Separação evidente entre a etapa de build Maven e a execução do JAR.
- Comandos conhecidos e fáceis de demonstrar.
- Sem scripts ou camadas extras quando não forem necessários.

**O que adaptar no Indexa:**

- O AGRUPA usa Java 25, mas o Indexa usa **Java 17**.
- O nome `tat-3ds-0.0.1-SNAPSHOT.jar` e a porta `8080` são específicos do AGRUPA; o backend do Indexa utiliza a porta **3000**.
- O exemplo AGRUPA pula testes com `-DskipTests`; isso **não é uma exigência de estilo**. No Indexa, manter a execução dos testes existentes durante o build quando viável.
- O Indexa utiliza banco H2 em arquivo e precisa de persistência externa ao container; esse requisito não aparece no exemplo AGRUPA.
- Imagens de build e runtime podem ter especificações diferentes para manter a imagem final adequada, desde que a solução continue clara.

## 3. Regra para o Codex no Indexa

Ao criar ou revisar Dockerfiles e configurações relacionadas:

1. **Consultar primeiro o código e as configurações reais do Indexa**, além deste documento.
2. Usar os exemplos AGRUPA como **referência de simplicidade e organização**, não como modelo obrigatório linha por linha.
3. Priorizar uma solução que um estudante de ADS consiga entender e explicar: comandos diretos, nomes claros e comentários objetivos.
4. Manter build reproduzível, funcionamento da aplicação, testes relevantes, isolamento de dados e cuidados básicos de segurança.
5. Não adicionar complexidade só por preferência técnica. Quando houver alguma configuração adicional necessária, explicar em uma frase para que serve.
6. Não simplificar nem modificar partes já testadas apenas por estética; propor mudanças somente se houver benefício concreto e dentro do escopo autorizado.
7. Respeitar o `AGENTS.md` e o pedido atual. Este documento **não autoriza** avançar fases, alterar funcionalidades, fazer commit, push ou deploy.

## 4. Escopo deste registro

Os blocos acima reproduzem os exemplos de Dockerfile compartilhados anteriormente na conversa sobre o AGRUPA. A aprovação mencionada é a informação fornecida pelo responsável pelo trabalho; este documento não é uma transcrição nem uma certificação independente do professor.

A configuração de Docker Compose do AGRUPA poderá ser documentada separadamente quando for pertinente à fase de integração do Indexa.
