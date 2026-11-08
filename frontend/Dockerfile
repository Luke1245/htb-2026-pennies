FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE=
ARG VITE_API_URL=

ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE \
    VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache certbot wget

COPY nginx-locations.conf /etc/nginx/app-locations.conf
COPY docker-entrypoint.sh /docker-entrypoint-pennies.sh
RUN chmod +x /docker-entrypoint-pennies.sh

COPY --from=build /app/dist /usr/share/nginx/html

ENTRYPOINT ["/docker-entrypoint-pennies.sh"]
EXPOSE 80 443
