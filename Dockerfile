FROM node:20-slim

# git zaroori hai: Baileys ki ek dependency (libsignal) GitHub se aati hai
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ssh ki jagah https se GitHub dependencies download ho
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
 && git config --global --add url."https://github.com/".insteadOf git@github.com: \
 && git config --global --add url."https://github.com/".insteadOf git://github.com/

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
CMD ["node", "index.js"]
