FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /usr/src/app

# Install deps first (layer cache — only re-runs when package.json changes)
COPY package.json ./
COPY prisma ./prisma/

RUN pnpm install --no-frozen-lockfile

# Copy source after install
COPY . .

# prebuild runs prisma generate automatically before nest build
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]
