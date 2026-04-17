FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set fetch-retries 6 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm ci --no-audit --no-fund

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN if [ -d src/generated/prisma-v2 ]; then \
      echo "Using committed generated Prisma client from src/generated/prisma-v2"; \
    elif [ -f prisma/schema.v2.prisma ]; then \
      npx prisma generate --schema prisma/schema.v2.prisma; \
    elif [ -f prisma/schema.prisma ]; then \
      npx prisma generate --schema prisma/schema.prisma; \
    elif [ -f schema.prisma ]; then \
      npx prisma generate --schema schema.prisma; \
    else \
      echo "Skipping prisma generate: schema file not found and no generated client directory exists"; \
    fi && npm run build

EXPOSE 3000

CMD ["sh", "-c", "if [ -d src/generated/prisma-v2 ]; then echo 'Using committed generated Prisma client; skipping prisma db push'; elif [ -f prisma/schema.v2.prisma ]; then npx prisma db push --schema prisma/schema.v2.prisma; elif [ -f prisma/schema.prisma ]; then npx prisma db push --schema prisma/schema.prisma; elif [ -f schema.prisma ]; then npx prisma db push --schema schema.prisma; else echo 'Skipping prisma db push: schema file not found and no generated client directory exists'; fi && npm run start -- -H 0.0.0.0 -p 3000"]
