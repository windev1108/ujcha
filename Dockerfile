FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.33.0

WORKDIR /usr/src/app

COPY apps/api/package.json ./package.json
COPY apps/api/prisma ./prisma/

RUN pnpm install --no-frozen-lockfile

COPY apps/api/src ./src
COPY apps/api/nest-cli.json ./
COPY apps/api/tsconfig.json ./
COPY apps/api/tsconfig.build.json ./

RUN node_modules/.bin/prisma generate

RUN node_modules/.bin/nest build

RUN test -f dist/main.js || (echo "BUILD FAILED: dist/main.js missing" && ls -la && exit 1)

EXPOSE 3000

CMD ["node", "dist/main.js"]
