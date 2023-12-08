# syntax = docker/dockerfile:1.4

ARG NODE_VERSION=21.4.0-alpine3.18

FROM node:${NODE_VERSION} as build

RUN corepack enable

WORKDIR /sharkey

RUN apk add git linux-headers build-base

ENV PYTHONUNBUFFERED=1
RUN apk add --update python3 && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools

COPY . ./

RUN git submodule update --init --recursive
RUN pnpm config set fetch-retries 5
RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i
RUN pnpm build
RUN node scripts/trim-deps.mjs
RUN mv packages/frontend/assets sharkey-assets
RUN rm -r node_modules packages/frontend packages/sw
RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i --prod
RUN rm -rf .git

FROM node:${NODE_VERSION}

WORKDIR /sharkey

RUN apk add ffmpeg tini

COPY --from=build /sharkey/built ./built
COPY --from=build /sharkey/node_modules ./node_modules
COPY --from=build /sharkey/packages/backend/built ./packages/backend/built
COPY --from=build /sharkey/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=build /sharkey/packages/megalodon/lib ./packages/megalodon/lib
COPY --from=build /sharkey/packages/megalodon/node_modules ./packages/megalodon/node_modules
COPY --from=build /sharkey/packages/misskey-js/built ./packages/misskey-js/built
COPY --from=build /sharkey/packages/misskey-js/node_modules ./packages/misskey-js/node_modules
COPY --from=build /sharkey/fluent-emojis ./fluent-emojis
COPY --from=build /sharkey/sharkey-assets ./packages/frontend/assets

COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/backend/check_connect.js ./packages/backend/check_connect.js
COPY packages/backend/ormconfig.js ./packages/backend/ormconfig.js
COPY packages/backend/migration ./packages/backend/migration
COPY packages/backend/assets ./packages/backend/assets
COPY packages/megalodon/package.json ./packages/megalodon/package.json
COPY packages/misskey-js/package.json ./packages/misskey-js/package.json

ENV NODE_ENV=production
RUN corepack enable
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "run", "migrateandstart"]
