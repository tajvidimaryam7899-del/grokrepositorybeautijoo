# Beautijoo Backend — reliable build for Liara (GitHub or ZIP)
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma \
  && npx nest build \
  && test -f dist/main.js \
  && mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_LOCAL_PATH=/app/uploads
EXPOSE 3000

CMD ["sh", "-c", "mkdir -p \"${STORAGE_LOCAL_PATH:-/app/uploads}\" && npx prisma migrate deploy --schema=./prisma/schema.prisma && node prisma/seed-roles.cjs && (node prisma/seed-catalog.cjs || true) && node dist/main.js"]
