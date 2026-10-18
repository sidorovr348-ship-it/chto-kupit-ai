FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV HOST=0.0.0.0
ENV PORT=8080
ENV AUTONOMY_STATE_DIR=/tmp/my-ai-unified-autonomy
ENV MY_AI_MEMORY_DIR=/tmp/my-ai-unified-data

EXPOSE 8080
CMD ["node", "local-gateway.js"]
