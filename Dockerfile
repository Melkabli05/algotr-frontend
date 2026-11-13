# algotr terminal: build the React app, then serve it with nginx.
# This image only serves the static terminal and proxies API calls to the
# backend (API_UPSTREAM, default api:8000). It is the `frontend` service in
# the backend repo's docker-compose.yml, which builds it from this repo:
#   build: https://github.com/Melkabli05/algotr-frontend.git#main
FROM node:22-slim AS build
WORKDIR /build
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
ENV API_UPSTREAM=api:8000
# The official nginx image renders *.template files from
# /etc/nginx/templates into /etc/nginx/conf.d on start (envsubst).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Vite builds with base "/ui/", so the terminal lives under /ui/.
COPY --from=build /build/dist /usr/share/nginx/html/ui
EXPOSE 80
