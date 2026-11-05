# Self-hosting for a browser: the built app plus the HTTP relay that `vite preview` installs
# (scripts/http-relay.mjs), so http:// streams play from a page served over http. The relay only
# forwards bytes, so CPU and memory stay low, but every stream watched passes through it.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]
