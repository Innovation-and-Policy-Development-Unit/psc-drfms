FROM node:20-alpine AS builder

WORKDIR /app

# Use relative /api so nginx can proxy to the backend container
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx fills in ${ONLYOFFICE_ORIGIN} from the environment when the container starts.
ENV ONLYOFFICE_ORIGIN=http://localhost:8082
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
