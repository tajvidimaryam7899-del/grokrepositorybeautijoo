FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1
ARG NEXT_PUBLIC_APP_URL=https://beautijoo.ir
ARG NEXT_PUBLIC_APP_NAME=Beautijoo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

COPY package.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm install --include=dev

COPY frontend ./frontend

RUN npm run build

# Fail the image build early if Next.js did not produce a standalone server.
RUN test -n "$(find /app/frontend/.next/standalone -type f -name server.js -print -quit)"

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

# Keep the standalone directory structure exactly as Next.js generated it.
COPY --from=builder /app/frontend/.next/standalone ./standalone

# Keep static assets separately, then place them beside the actual standalone
# server at runtime. This handles the workspace layout created by
# outputFileTracingRoot without changing application code.
COPY --from=builder /app/frontend/.next/static ./next-static
COPY --from=builder /app/frontend/public ./next-public

EXPOSE 3000

# Next.js standalone can place server.js below the standalone root when the
# application lives inside a workspace. Locate it, put public/.next/static
# beside that server, then start it from its own directory.
CMD ["sh", "-c", "SERVER=$(find /app/standalone -type f -name server.js -print -quit); test -n \"$SERVER\"; SERVER_DIR=$(dirname \"$SERVER\"); mkdir -p \"$SERVER_DIR/.next\"; cp -a /app/next-static \"$SERVER_DIR/.next/static\"; cp -a /app/next-public \"$SERVER_DIR/public\"; cd \"$SERVER_DIR\"; exec node \"$(basename \"$SERVER\")\""]
