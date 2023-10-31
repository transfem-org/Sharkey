import querystring from 'querystring';
import { emojiRegexAtStartToEnd } from '@/misc/emoji-regex.js';
import { convertAttachment, convertPoll, convertStatusSource, MastoConverters } from '../converters.js';
import { getClient } from '../MastodonApiServerService.js';
import { limitToInt } from './timeline.js';
import type { Entity } from 'megalodon';
import type { FastifyInstance } from 'fastify';
import type { Config } from '@/config.js';
import { NoteEditRepository, NotesRepository, UsersRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';

function normalizeQuery(data: any) {
	const str = querystring.stringify(data);
	return querystring.parse(str);
}

export class ApiStatusMastodon {
	private fastify: FastifyInstance;
	private mastoconverter: MastoConverters;

	constructor(fastify: FastifyInstance, mastoconverter: MastoConverters) {
		this.fastify = fastify;
		this.mastoconverter = mastoconverter;
	}

	public async getStatus() {
		this.fastify.get<{ Params: { id: string } }>('/v1/statuses/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getStatus(_request.params.id);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(_request.is404 ? 404 : 401).send(e.response.data);
			}
		});
	}

	public async getStatusSource() {
		this.fastify.get<{ Params: { id: string } }>('/v1/statuses/:id/source', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getStatusSource(_request.params.id);
				reply.send(data.data);
			} catch (e: any) {
				console.error(e);
				reply.code(_request.is404 ? 404 : 401).send(e.response.data);
			}
		});
	}

	public async getContext() {
		this.fastify.get<{ Params: { id: string } }>('/v1/statuses/:id/context', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			const query: any = _request.query;
			try {
				const data = await client.getStatusContext(_request.params.id, limitToInt(query));
				data.data.ancestors = await Promise.all(data.data.ancestors.map(async (status: Entity.Status) => await this.mastoconverter.convertStatus(status)));
				data.data.descendants = await Promise.all(data.data.descendants.map(async (status: Entity.Status) => await this.mastoconverter.convertStatus(status)));
				reply.send(data.data);
			} catch (e: any) {
				console.error(e);
				reply.code(_request.is404 ? 404 : 401).send(e.response.data);
			}
		});
	}

	public async getHistory() {
		this.fastify.get<{ Params: { id: string } }>('/v1/statuses/:id/history', async (_request, reply) => {
			try {
				const edits = await this.mastoconverter.getEdits(_request.params.id);
				reply.send(edits);
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getReblogged() {
		this.fastify.get<{ Params: { id: string } }>('/v1/statuses/:id/reblogged_by', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getStatusRebloggedBy(_request.params.id);
				reply.send(await Promise.all(data.data.map(async (account: Entity.Account) => await this.mastoconverter.convertAccount(account))));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getFavourites() {
		this.fastify.get<{ Params: { id: string } }>('/v1/statuses/:id/favourited_by', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getStatusFavouritedBy(_request.params.id);
				reply.send(await Promise.all(data.data.map(async (account: Entity.Account) => await this.mastoconverter.convertAccount(account))));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getMedia() {
		this.fastify.get<{ Params: { id: string } }>('/v1/media/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getMedia(_request.params.id);
				reply.send(convertAttachment(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async getPoll() {
		this.fastify.get<{ Params: { id: string } }>('/v1/polls/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getPoll(_request.params.id);
				reply.send(convertPoll(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async votePoll() {
		this.fastify.post<{ Params: { id: string } }>('/v1/polls/:id/votes', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			const body: any = _request.body;
			try {
				const data = await client.votePoll(_request.params.id, body.choices);
				reply.send(convertPoll(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async postStatus() {
		this.fastify.post('/v1/statuses', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			let body: any = _request.body;
			try {
				if (
					(!body.poll && body['poll[options][]']) ||
                    (!body.media_ids && body['media_ids[]'])
				) {
					body = normalizeQuery(body);
				}
				const text = body.status ? body.status : ' ';
				const removed = text.replace(/@\S+/g, '').replace(/\s|/g, '');
				const isDefaultEmoji = emojiRegexAtStartToEnd.test(removed);
				const isCustomEmoji = /^:[a-zA-Z0-9@_]+:$/.test(removed);
				if ((body.in_reply_to_id && isDefaultEmoji) || (body.in_reply_to_id && isCustomEmoji)) {
					const a = await client.createEmojiReaction(
						body.in_reply_to_id,
						removed,
					);
					reply.send(a.data);
				}
				if (body.in_reply_to_id && removed === '/unreact') {
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

				const { sensitive } = body;
				body.sensitive = typeof sensitive === 'string' ? sensitive === 'true' : sensitive;

				if (body.poll) {
					if (
						body.poll.expires_in != null &&
                        typeof body.poll.expires_in === 'string'
					) body.poll.expires_in = parseInt(body.poll.expires_in);
					if (
						body.poll.multiple != null &&
                        typeof body.poll.multiple === 'string'
					) body.poll.multiple = body.poll.multiple === 'true';
					if (
						body.poll.hide_totals != null &&
                        typeof body.poll.hide_totals === 'string'
					) body.poll.hide_totals = body.poll.hide_totals === 'true';
				}

				const data = await client.postStatus(text, body);
				reply.send(await this.mastoconverter.convertStatus(data.data as Entity.Status));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async updateStatus() {
		this.fastify.put<{ Params: { id: string } }>('/v1/statuses/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			const body: any = _request.body;
			try {
				if (!body.media_ids) body.media_ids = undefined;
				if (body.media_ids && !body.media_ids.length) body.media_ids = undefined;
				const data = await client.editStatus(_request.params.id, body);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(_request.is404 ? 404 : 401).send(e.response.data);
			}
		});
	}

	public async addFavourite() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/favourite', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = (await client.createEmojiReaction(_request.params.id, '❤')) as any;
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async rmFavourite() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/unfavourite', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.deleteEmojiReaction(_request.params.id, '❤');
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async reblogStatus() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/reblog', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.reblogStatus(_request.params.id);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async unreblogStatus() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/unreblog', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unreblogStatus(_request.params.id);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async bookmarkStatus() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/bookmark', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.bookmarkStatus(_request.params.id);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async unbookmarkStatus() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/unbookmark', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unbookmarkStatus(_request.params.id);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async pinStatus() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/pin', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.pinStatus(_request.params.id);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async unpinStatus() {
		this.fastify.post<{ Params: { id: string } }>('/v1/statuses/:id/unpin', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unpinStatus(_request.params.id);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async reactStatus() {
		this.fastify.post<{ Params: { id: string, name: string } }>('/v1/statuses/:id/react/:name', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.createEmojiReaction(_request.params.id, _request.params.name);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async unreactStatus() {
		this.fastify.post<{ Params: { id: string, name: string } }>('/v1/statuses/:id/unreact/:name', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.deleteEmojiReaction(_request.params.id, _request.params.name);
				reply.send(await this.mastoconverter.convertStatus(data.data));
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}

	public async deleteStatus() {
		this.fastify.delete<{ Params: { id: string } }>('/v1/statuses/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.deleteStatus(_request.params.id);
				reply.send(data.data);
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
	}
}
