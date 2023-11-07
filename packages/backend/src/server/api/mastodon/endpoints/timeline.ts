import { ParsedUrlQuery } from 'querystring';
import { convertConversation, convertList, MastoConverters } from '../converters.js';
import { getClient } from '../MastodonApiServerService.js';
import type { Entity } from 'megalodon';
import type { FastifyInstance } from 'fastify';
import type { Config } from '@/config.js';
import { NoteEditRepository, NotesRepository, UsersRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';

export function limitToInt(q: ParsedUrlQuery) {
	const object: any = q;
	if (q.limit) if (typeof q.limit === 'string') object.limit = parseInt(q.limit, 10);
	if (q.offset) if (typeof q.offset === 'string') object.offset = parseInt(q.offset, 10);
	return object;
}

export function argsToBools(q: ParsedUrlQuery) {
	// Values taken from https://docs.joinmastodon.org/client/intro/#boolean
	const toBoolean = (value: string) =>
		!['0', 'f', 'F', 'false', 'FALSE', 'off', 'OFF'].includes(value);

	// Keys taken from:
	// - https://docs.joinmastodon.org/methods/accounts/#statuses
	// - https://docs.joinmastodon.org/methods/timelines/#public
	// - https://docs.joinmastodon.org/methods/timelines/#tag
	const object: any = q;
	if (q.only_media) if (typeof q.only_media === 'string') object.only_media = toBoolean(q.only_media);
	if (q.exclude_replies) if (typeof q.exclude_replies === 'string') object.exclude_replies = toBoolean(q.exclude_replies);
	if (q.exclude_reblogs) if (typeof q.exclude_reblogs === 'string') object.exclude_reblogs = toBoolean(q.exclude_reblogs);
	if (q.pinned) if (typeof q.pinned === 'string') object.pinned = toBoolean(q.pinned);
	if (q.local) if (typeof q.local === 'string') object.local = toBoolean(q.local);
	return q;
}

export class ApiTimelineMastodon {
	private fastify: FastifyInstance;

	constructor(fastify: FastifyInstance, config: Config, private mastoconverter: MastoConverters) {
		this.fastify = fastify;
	}

	public async getTL() {
		this.fastify.get('/v1/timelines/public', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const query: any = _request.query;
				const data = query.local === 'true'
					? await client.getLocalTimeline(argsToBools(limitToInt(query)))
					: await client.getPublicTimeline(argsToBools(limitToInt(query)));
				reply.send(await Promise.all(data.data.map(async (status: Entity.Status) => await this.mastoconverter.convertStatus(status))));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getHomeTl() {
		this.fastify.get('/v1/timelines/home', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const query: any = _request.query;
				const data = await client.getHomeTimeline(limitToInt(query));
				reply.send(await Promise.all(data.data.map(async (status: Entity.Status) => await this.mastoconverter.convertStatus(status))));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getTagTl() {
		this.fastify.get<{ Params: { hashtag: string } }>('/v1/timelines/tag/:hashtag', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const query: any = _request.query;
				const params: any = _request.params;
				const data = await client.getTagTimeline(params.hashtag, limitToInt(query));
				reply.send(await Promise.all(data.data.map(async (status: Entity.Status) => await this.mastoconverter.convertStatus(status))));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getListTL() {
		this.fastify.get<{ Params: { id: string } }>('/v1/timelines/list/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const query: any = _request.query;
				const params: any = _request.params;
				const data = await client.getListTimeline(params.id, limitToInt(query));
				reply.send(await Promise.all(data.data.map(async (status: Entity.Status) => await this.mastoconverter.convertStatus(status))));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getConversations() {
		this.fastify.get('/v1/conversations', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const query: any = _request.query;
				const data = await client.getConversationTimeline(limitToInt(query));
				reply.send(data.data.map((conversation: Entity.Conversation) => convertConversation(conversation)));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getList() {
		this.fastify.get<{ Params: { id: string } }>('/v1/lists/:id', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const params: any = _request.params;
				const data = await client.getList(params.id);
				reply.send(convertList(data.data));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getLists() {
		this.fastify.get('/v1/lists', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const data = await client.getLists();
				reply.send(data.data.map((list: Entity.List) => convertList(list)));
			} catch (e: any) {
				console.error(e);
				return e.response.data;
			}
		});
	}

	public async getListAccounts() {
		this.fastify.get<{ Params: { id: string } }>('/v1/lists/:id/accounts', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const params: any = _request.params;
				const query: any = _request.query;
				const data = await client.getAccountsInList(params.id, query);
				reply.send(data.data.map((account: Entity.Account) => this.mastoconverter.convertAccount(account)));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async addListAccount() {
		this.fastify.post<{ Params: { id: string } }>('/v1/lists/:id/accounts', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const params: any = _request.params;
				const query: any = _request.query;
				const data = await client.addAccountsToList(params.id, query.accounts_id);
				reply.send(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async rmListAccount() {
		this.fastify.delete<{ Params: { id: string } }>('/v1/lists/:id/accounts', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const params: any = _request.params;
				const query: any = _request.query;
				const data = await client.deleteAccountsFromList(params.id, query.accounts_id);
				reply.send(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async createList() {
		this.fastify.post('/v1/lists', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const body: any = _request.body;
				const data = await client.createList(body.title);
				reply.send(convertList(data.data));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async updateList() {
		this.fastify.put<{ Params: { id: string } }>('/v1/lists/:id', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const body: any = _request.body;
				const params: any = _request.params;
				const data = await client.updateList(params.id, body.title);
				reply.send(convertList(data.data));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async deleteList() {
		this.fastify.delete<{ Params: { id: string } }>('/v1/lists/:id', async (_request, reply) => {
			try {
				const BASE_URL = `${_request.protocol}://${_request.hostname}`;
				const accessTokens = _request.headers.authorization;
				const client = getClient(BASE_URL, accessTokens);
				const params: any = _request.params;
				const data = await client.deleteList(params.id);
				reply.send({});
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
	}
}
