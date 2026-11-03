FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS build
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY src/ src/
RUN npm run build -- --configuration production

FROM nginx:stable-alpine@sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949 AS runtime
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# Caminho conferido no artefato gerado pelo builder application do Angular 17.
COPY --from=build /app/dist/indexa/browser/ /usr/share/nginx/html/
COPY --from=build /app/dist/indexa/3rdpartylicenses.txt /usr/share/nginx/html/3rdpartylicenses.txt
EXPOSE 80
