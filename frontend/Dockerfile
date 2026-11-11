FROM node:alpine AS build
WORKDIR /app

COPY ./package*.json ./
RUN npm ci

COPY ./ ./
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine

RUN echo 'access_log off;' > /etc/nginx/conf.d/disable-access-log.conf

# Copy custom Nginx SPA configuration
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
