import { convertId, IdConvertType as IdType, convertAccount, convertAttachment, convertPoll, convertStatus } from '../converters.js';
import querystring from 'querystring';
import type { Entity, MegalodonInterface } from 'megalodon';
import type { FastifyInstance } from 'fastify';
import { getClient } from '../MastodonApiServerService.js';
import { convertTimelinesArgsId, limitToInt } from './timeline.js';
import { emojiRegexAtStartToEnd } from "@/misc/emoji-regex.js";
import { MetaService } from '@/core/MetaService.js';

function normalizeQuery(data: any) {
	const str = querystring.stringify(data);
	return querystring.parse(str);
}

export class apiStatusMastodon {
    private fastify: FastifyInstance;
    private metaService: MetaService;

    constructor(fastify: FastifyInstance) {
        this.fastify = fastify;
    }

    public async getStatus() {
        this.fastify.get<{ Params: { id: string } }>("/v1/statuses/:id", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.getStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(_request.is404 ? 404 : 401).send(e.response.data);
            }
        });
    }

    public async getContext() {
        this.fastify.get<{ Params: { id: string } }>("/v1/statuses/:id/context", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            const query: any = _request.query;
            try {
                const data = await client.getStatusContext(
                    convertId(_request.params.id, IdType.SharkeyId),
                    convertTimelinesArgsId(limitToInt(query))
                );
                data.data.ancestors = data.data.ancestors.map((status: Entity.Status) => convertStatus(status));
                data.data.descendants = data.data.descendants.map((status: Entity.Status) => convertStatus(status));
                reply.send(data.data);
            } catch (e: any) {
                console.error(e);
                reply.code(_request.is404 ? 404 : 401).send(e.response.data);
            }
        });
    }

    public async getHistory() {
        this.fastify.get<{ Params: { id: string } }>("/v1/statuses/:id/history", async (_request, reply) => {
            try {
                reply.code(401).send({ message: 'Not Implemented' });
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async getReblogged() {
        this.fastify.get<{ Params: { id: string } }>("/v1/statuses/:id/reblogged_by", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.getStatusRebloggedBy(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(data.data.map((account: Entity.Account) => convertAccount(account)));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async getFavourites() {
        this.fastify.get<{ Params: { id: string } }>("/v1/statuses/:id/favourited_by", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.getStatusFavouritedBy(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(data.data.map((account: Entity.Account) => convertAccount(account)));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async getMedia() {
        this.fastify.get<{ Params: { id: string } }>("/v1/media/:id", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.getMedia(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertAttachment(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async getPoll() {
        this.fastify.get<{ Params: { id: string } }>("/v1/polls/:id", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.getPoll(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertPoll(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async votePoll() {
        this.fastify.post<{ Params: { id: string } }>("/v1/polls/:id/votes", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            const body: any = _request.body;
            try {
                const data = await client.votePoll(convertId(_request.params.id, IdType.SharkeyId), body.choices);
                reply.send(convertPoll(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async postStatus() {
        this.fastify.post("/v1/statuses", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            let body: any = _request.body;
            try {
                if (body.in_reply_to_id)
                    body.in_reply_to_id = convertId(body.in_reply_to_id, IdType.SharkeyId);
                if (body.quote_id)
                    body.quote_id = convertId(body.quote_id, IdType.SharkeyId);
                if (
                    (!body.poll && body["poll[options][]"]) ||
                    (!body.media_ids && body["media_ids[]"])
                ) {
                    body = normalizeQuery(body);
                }
                const text = body.status;
                const removed = text.replace(/@\S+/g, "").replace(/\s|​/g, "");
                const isDefaultEmoji = emojiRegexAtStartToEnd.test(removed);
                const isCustomEmoji = /^:[a-zA-Z0-9@_]+:$/.test(removed);
                if ((body.in_reply_to_id && isDefaultEmoji) || isCustomEmoji) {
                    const a = await client.createEmojiReaction(
                        body.in_reply_to_id,
                        removed,
                    );
                    reply.send(a.data);
                }
                if (body.in_reply_to_id && removed === "/unreact") {
                    try {
                        const id = body.in_reply_to_id;
                        const post = await client.getStatus(id);
                        const react = post.data.emoji_reactions.filter((e: any) => e.me)[0].name;
                        const data = await client.deleteEmojiReaction(id, react);
                        reply.send(data.data);
                    } catch (e: any) {
                        console.error(e);
                        reply.code(401).send(e.response.data);
                    }
                }
                if (!body.media_ids) body.media_ids = undefined;
                if (body.media_ids && !body.media_ids.length) body.media_ids = undefined;
                if (body.media_ids) {
                    body.media_ids = (body.media_ids as string[]).map((p) =>convertId(p, IdType.SharkeyId));
                }

                const { sensitive } = body;
                body.sensitive = typeof sensitive === "string" ? sensitive === "true" : sensitive;

                if (body.poll) {
                    if (
                        body.poll.expires_in != null &&
                        typeof body.poll.expires_in === "string"
                    )
                        body.poll.expires_in = parseInt(body.poll.expires_in);
                    if (
                        body.poll.multiple != null &&
                        typeof body.poll.multiple === "string"
                    )
                        body.poll.multiple = body.poll.multiple == "true";
                    if (
                        body.poll.hide_totals != null &&
                        typeof body.poll.hide_totals === "string"
                    )
                        body.poll.hide_totals = body.poll.hide_totals == "true";
                }

                const data = await client.postStatus(text, body);
                reply.send(convertStatus(data.data as Entity.Status));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async addFavourite() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/favourite", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = (await client.createEmojiReaction(
					convertId(_request.params.id, IdType.SharkeyId),
					'⭐'
				)) as any;
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async rmFavourite() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/unfavourite", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.deleteEmojiReaction(
					convertId(_request.params.id, IdType.SharkeyId),
					'⭐'
				);
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async reblogStatus() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/reblog", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.reblogStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async unreblogStatus() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/unreblog", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.unreblogStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async bookmarkStatus() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/bookmark", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.bookmarkStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async unbookmarkStatus() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/unbookmark", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.unbookmarkStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async pinStatus() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/pin", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.pinStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async unpinStatus() {
        this.fastify.post<{ Params: { id: string } }>("/v1/statuses/:id/unpin", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.unpinStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async reactStatus() {
        this.fastify.post<{ Params: { id: string, name: string } }>("/v1/statuses/:id/react/:name", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.createEmojiReaction(convertId(_request.params.id, IdType.SharkeyId), _request.params.name);
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async unreactStatus() {
        this.fastify.post<{ Params: { id: string, name: string } }>("/v1/statuses/:id/unreact/:name", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.deleteEmojiReaction(convertId(_request.params.id, IdType.SharkeyId), _request.params.name);
                reply.send(convertStatus(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async updateMedia() {
        this.fastify.put<{ Params: { id: string } }>("/v1/media/:id", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.updateMedia(convertId(_request.params.id, IdType.SharkeyId), _request.body as any);
                reply.send(convertAttachment(data.data));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }

    public async deleteStatus() {
        this.fastify.delete<{ Params: { id: string } }>("/v1/statuses/:id", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.deleteStatus(convertId(_request.params.id, IdType.SharkeyId));
                reply.send(data.data);
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    }
}