FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

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
COPY --from=builder /app/frontend/.next/static ./standalone/.next/static
COPY --from=builder /app/frontend/public ./standalone/public

EXPOSE 3000

# Next.js standalone can place server.js below the standalone root when the
# application lives inside a workspace. Locate it instead of assuming /app/server.js.
CMD ["sh", "-c", "SERVER=$(find /app/standalone -type f -name server.js -print -quit); test -n \"$SERVER\"; cd \"$(dirname \"$SERVER\")\"; exec node \"$(basename \"$SERVER\")\""]
