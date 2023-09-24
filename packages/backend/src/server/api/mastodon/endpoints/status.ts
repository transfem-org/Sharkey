import { convertId, IdConvertType as IdType, convertAccount, convertAttachment, convertPoll, convertStatus } from '../converters.js';
import querystring from 'querystring';
import type { Entity, MegalodonInterface } from 'megalodon';
import type { FastifyInstance } from 'fastify';
import { getClient } from '../MastodonApiServerService.js';
import { convertTimelinesArgsId, limitToInt } from './timeline.js';

function normalizeQuery(data: any) {
	const str = querystring.stringify(data);
	return querystring.parse(str);
}

export class apiStatusMastodon {
    private fastify: FastifyInstance;

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
}