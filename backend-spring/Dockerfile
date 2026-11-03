FROM eclipse-temurin:17-jdk-jammy@sha256:81336a07f69ac361c7f278183b195e32037ebdb532684996806265a3b47ef516 AS build
WORKDIR /build

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# Aceita também cópias do workspace com CRLF, sem alterar o wrapper original.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
COPY src/ src/
# O teste de contexto nunca deve abrir um banco de arquivo durante o build.
RUN ./mvnw --batch-mode --no-transfer-progress \
    "-Dspring.datasource.url=jdbc:h2:mem:docker-build;DB_CLOSE_DELAY=-1" package

FROM eclipse-temurin:17-jre-jammy@sha256:c35794d1348777e6bc310b9b7f420098ef8f37e988199549b545fded79a895a2 AS runtime
WORKDIR /app
RUN groupadd --gid 10001 indexa \
    && useradd --uid 10001 --gid indexa --no-create-home indexa \
    && mkdir /data && chown indexa:indexa /data
COPY --from=build /build/target/*.jar /app/app.jar

# Sobrescreve apenas na imagem; a configuração local permanece inalterada.
ENV SPRING_DATASOURCE_URL=jdbc:h2:file:/data/contatosdb
USER 10001:10001
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
