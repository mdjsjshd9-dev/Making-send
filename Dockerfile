# Node 22 = abhi ka LTS (Node 20 ki support khatam ho chuki hai)
FROM node:22-slim

# git: Baileys ki dependency (libsignal) GitHub se aati hai | ffmpeg: voice note / sticker / image thumbnail ke liye
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# ssh ki jagah https se GitHub dependencies download ho
RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \
 && git config --global --add url."https://github.com/".insteadOf git@github.com: \
 && git config --global --add url."https://github.com/".insteadOf git://github.com/

WORKDIR /app

# package-lock.json repo me ho to npm ci (exact same versions), warna npm install (package.json me versions pinned hain)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi

COPY . .

ENV NODE_ENV=production
CMD ["node", "index.js"]
