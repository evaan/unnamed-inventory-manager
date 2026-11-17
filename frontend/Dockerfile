FROM oven/bun:1-alpine AS build
RUN apk upgrade --no-cache
WORKDIR /app

COPY ./package.json ./package-lock.json ./
RUN bun install --frozen-lockfile

COPY ./ ./
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN bun run --bun build

FROM nginxinc/nginx-unprivileged:alpine

USER root
RUN apk upgrade --no-cache
USER nginx

RUN echo 'access_log off;' > /etc/nginx/conf.d/disable-access-log.conf

# Copy custom Nginx SPA configuration
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
