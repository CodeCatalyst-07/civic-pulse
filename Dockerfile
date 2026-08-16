FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci --omit=optional

COPY packages/shared packages/shared
COPY services/api services/api

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--import", "tsx", "services/api/src/server.ts"]
