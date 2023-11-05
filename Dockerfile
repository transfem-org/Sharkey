# syntax = docker/dockerfile:1.4

ARG NODE_VERSION=20.5.1-bullseye

# build assets & compile TypeScript

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION} AS native-builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	rm -f /etc/apt/apt.conf.d/docker-clean \
	; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
	&& apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential curl ca-certificates

ARG TARGETARCH

RUN curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-$TARGETARCH-static.tar.xz -o /ffmpeg.tar.xz \
	&& tar xvf /ffmpeg.tar.xz -C / --strip-components 1 --wildcards 'ffmpeg-*-static/ffmpeg' 'ffmpeg-*-static/ffprobe'

RUN corepack enable

WORKDIR /sharkey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["packages/megalodon/package.json", "./packages/megalodon/"]
COPY --link ["packages/backend/package.json", "./packages/backend/"]
COPY --link ["packages/frontend/package.json", "./packages/frontend/"]
COPY --link ["packages/sw/package.json", "./packages/sw/"]
COPY --link ["packages/misskey-js/package.json", "./packages/misskey-js/"]

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i --frozen-lockfile --aggregate-output

COPY --link . ./

ARG NODE_ENV=production

RUN git submodule update --init
RUN pnpm build
RUN rm -rf .git/

# build native dependencies for target platform

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION} AS target-builder

RUN apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

RUN corepack enable

WORKDIR /sharkey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["packages/megalodon/package.json", "./packages/megalodon/"]
COPY --link ["packages/backend/package.json", "./packages/backend/"]

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i --frozen-lockfile --aggregate-output

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-slim AS runner

ARG UID="991"
ARG GID="991"

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
	tini curl libjemalloc-dev libjemalloc2 \
	&& ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so \
	&& corepack enable \
	&& groupadd -g "${GID}" sharkey \
	&& useradd -l -u "${UID}" -g "${GID}" -m -d /sharkey sharkey \
	&& find / -type d -path /proc -prune -o -type f -perm /u+s -ignore_readdir_race -exec chmod u-s {} \; \
	&& find / -type d -path /proc -prune -o -type f -perm /g+s -ignore_readdir_race -exec chmod g-s {} \; \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists

USER sharkey
WORKDIR /sharkey

COPY --chown=sharkey:sharkey --from=target-builder /sharkey/node_modules ./node_modules
COPY --chown=sharkey:sharkey --from=target-builder /sharkey/packages/megalodon/node_modules ./packages/megalodon/node_modules
COPY --chown=sharkey:sharkey --from=target-builder /sharkey/packages/backend/node_modules ./packages/backend/node_modules
COPY --chown=sharkey:sharkey --from=native-builder /ffmpeg /usr/local/bin/
COPY --chown=sharkey:sharkey --from=native-builder /ffprobe /usr/local/bin/
COPY --chown=sharkey:sharkey --from=native-builder /sharkey/built ./built
COPY --chown=sharkey:sharkey --from=native-builder /sharkey/packages/megalodon/lib ./packages/megalodon/lib
COPY --chown=sharkey:sharkey --from=native-builder /sharkey/packages/backend/built ./packages/backend/built
COPY --chown=sharkey:sharkey --from=native-builder /sharkey/fluent-emojis /sharkey/fluent-emojis
COPY --chown=sharkey:sharkey . ./

ENV LD_PRELOAD=/usr/local/lib/libjemalloc.so
ENV NODE_ENV=production
VOLUME "/sharkey/files"
HEALTHCHECK --interval=5s --retries=20 CMD ["/bin/bash", "/sharkey/healthcheck.sh"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["pnpm", "run", "migrateandstart"]
