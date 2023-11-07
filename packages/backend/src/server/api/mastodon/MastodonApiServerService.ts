import { Inject, Injectable } from '@nestjs/common';
import megalodon, { Entity, MegalodonInterface } from 'megalodon';
import querystring from 'querystring';
import { IsNull } from 'typeorm';
import multer from 'fastify-multer';
import type { AccessTokensRepository, NoteEditRepository, NotesRepository, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { Config } from '@/config.js';
import { MetaService } from '@/core/MetaService.js';
import { convertAnnouncement, convertFilter, convertAttachment, convertFeaturedTag, convertList, MastoConverters } from './converters.js';
import { getInstance } from './endpoints/meta.js';
import { ApiAuthMastodon, ApiAccountMastodon, ApiFilterMastodon, ApiNotifyMastodon, ApiSearchMastodon, ApiTimelineMastodon, ApiStatusMastodon } from './endpoints.js';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveService } from '@/core/DriveService.js';

export function getClient(BASE_URL: string, authorization: string | undefined): MegalodonInterface {
	const accessTokenArr = authorization?.split(' ') ?? [null];
	const accessToken = accessTokenArr[accessTokenArr.length - 1];
	const generator = (megalodon as any).default;
	const client = generator('misskey', BASE_URL, accessToken) as MegalodonInterface;
	return client;
}

@Injectable()
export class MastodonApiServerService {
	constructor(
        @Inject(DI.usersRepository)
        private usersRepository: UsersRepository,
		@Inject(DI.notesRepository)
        private notesRepository: NotesRepository,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		@Inject(DI.noteEditRepository)
		private noteEditRepository: NoteEditRepository,
		@Inject(DI.accessTokensRepository)
		private accessTokensRepository: AccessTokensRepository,
        @Inject(DI.config)
        private config: Config,
        private metaService: MetaService,
		private userEntityService: UserEntityService,
		private driveService: DriveService,
		private mastoConverter: MastoConverters,
	) { }

	@bindThis
	public createServer(fastify: FastifyInstance, _options: FastifyPluginOptions, done: (err?: Error) => void) {
		const upload = multer({
			storage: multer.diskStorage({}),
			limits: {
				fileSize: this.config.maxFileSize || 262144000,
				files: 1,
			},
		});

		fastify.addHook('onRequest', (request, reply, done) => {
			reply.header('Access-Control-Allow-Origin', '*');
			done();
		});

		fastify.addContentTypeParser('application/x-www-form-urlencoded', (request, payload, done) => {
			let body = '';
			payload.on('data', (data) => {
				body += data;
			});
			payload.on('end', () => {
				try {
					const parsed = querystring.parse(body);
					done(null, parsed);
				} catch (e: any) {
					done(e);
				}
			});
			payload.on('error', done);
		});

		fastify.register(multer.contentParser);

		fastify.get('/v1/custom_emojis', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getInstanceCustomEmojis();
				reply.send(data.data);
			} catch (e: any) {
				console.error(e);
				reply.code(401).send(e.response.data);
			}
		});
    
		fastify.get('/v1/instance', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const data = await client.getInstance();
				const admin = await this.usersRepository.findOne({
					where: {
						host: IsNull(),
						isRoot: true,
						isDeleted: false,
						isSuspended: false,
					},
					order: { id: 'ASC' },
				});
				const contact = admin == null ? null : await this.mastoConverter.convertAccount((await client.getAccount(admin.id)).data);
				reply.send(await getInstance(data.data, contact as Entity.Account, this.config, await this.metaService.fetch()));
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});
    
		fastify.get('/v1/announcements', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getInstanceAnnouncements();
				reply.send(data.data.map((announcement) => convertAnnouncement(announcement)));
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});
    
		fastify.post<{ Body: { id: string } }>('/v1/announcements/:id/dismiss', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.dismissInstanceAnnouncement(
					_request.body['id'],
				);
				reply.send(data.data);
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		},
		);

		fastify.post('/v1/media', { preHandler: upload.single('file') }, async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const multipartData = await _request.file;
				if (!multipartData) {
					reply.code(401).send({ error: 'No image' });
					return;
				}
				const data = await client.uploadMedia(multipartData);
				reply.send(convertAttachment(data.data as Entity.Attachment));
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post('/v2/media', { preHandler: upload.single('file') }, async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const multipartData = await _request.file;
				if (!multipartData) {
					reply.code(401).send({ error: 'No image' });
					return;
				}
				const data = await client.uploadMedia(multipartData, _request.body!);
				reply.send(convertAttachment(data.data as Entity.Attachment));
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});        
    
		fastify.get('/v1/filters', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const data = await client.getFilters();
				reply.send(data.data.map((filter) => convertFilter(filter)));
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});
    
		fastify.get('/v1/trends', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const data = await client.getInstanceTrends();
				reply.send(data.data);
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/trends/tags', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const data = await client.getInstanceTrends();
				reply.send(data.data);
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/trends/links', async (_request, reply) => {
			// As we do not have any system for news/links this will just return empty
			reply.send([]);
		});

		fastify.post('/v1/apps', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const client = getClient(BASE_URL, ''); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const data = await ApiAuthMastodon(_request, client);
				reply.send(data);
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});
    
		fastify.get('/v1/preferences', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const data = await client.getPreferences();
				reply.send(data.data);
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});

		//#region Accounts
		fastify.get('/v1/accounts/verify_credentials', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.verifyCredentials());
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.patch('/v1/accounts/update_credentials', { preHandler: upload.any() }, async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				// Check if there is an Header or Avatar being uploaded, if there is proceed to upload it to the drive of the user and then set it.
				if (_request.files.length > 0 && accessTokens) {
					const tokeninfo = await this.accessTokensRepository.findOneBy({ token: accessTokens.replace('Bearer ', '') });
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const avatar = (_request.files as any).find((obj: any) => {
						return obj.fieldname === 'avatar';
					});
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const header = (_request.files as any).find((obj: any) => {
						return obj.fieldname === 'header';
					});

					if (tokeninfo && avatar) {
						const upload = await this.driveService.addFile({
							user: { id: tokeninfo.userId, host: null },
							path: avatar.path,
							name: avatar.originalname !== null && avatar.originalname !== 'file' ? avatar.originalname : undefined,
							sensitive: false,				
						});
						if (upload.type.startsWith('image/')) {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(_request.body as any).avatar = upload.id;
						}
					} else if (tokeninfo && header) {			
						const upload = await this.driveService.addFile({
							user: { id: tokeninfo.userId, host: null },
							path: header.path,
							name: header.originalname !== null && header.originalname !== 'file' ? header.originalname : undefined,
							sensitive: false,				
						});
						if (upload.type.startsWith('image/')) {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(_request.body as any).header = upload.id;
						}
					}
				}

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if ((_request.body as any).fields_attributes) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const fields = (_request.body as any).fields_attributes.map((field: any) => {
						if (!(field.name.trim() === '' && field.value.trim() === '')) {
							if (field.name.trim() === '') return reply.code(400).send('Field name can not be empty');
							if (field.value.trim() === '') return reply.code(400).send('Field value can not be empty');
						}
						return {
							...field,
						};
					});
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(_request.body as any).fields_attributes = fields.filter((field: any) => field.name.trim().length > 0 && field.value.length > 0);		
				}

				const data = await client.updateCredentials(_request.body!);
				reply.send(await this.mastoConverter.convertAccount(data.data));
			} catch (e: any) {
				//console.error(e);
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/accounts/lookup', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			try {
				const data = await client.search((_request.query as any).acct, { type: 'accounts' });
				const profile = await this.userProfilesRepository.findOneBy({ userId: data.data.accounts[0].id });
				data.data.accounts[0].fields = profile?.fields.map(f => ({ ...f, verified_at: null })) || [];
				reply.send(await this.mastoConverter.convertAccount(data.data.accounts[0]));
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/accounts/relationships', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
			// displayed without being logged in
			let users;
			try {
				let ids = _request.query ? (_request.query as any)['id[]'] ?? (_request.query as any)['id'] : null;
				if (typeof ids === 'string') {
					ids = [ids];
				}
				users = ids;
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getRelationships(users));
			} catch (e: any) {
				/* console.error(e); */
				const data = e.response.data;
				data.users = users;
				console.error(data);
				reply.code(401).send(data);
			}
		});

		fastify.get<{ Params: { id: string } }>('/v1/accounts/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const sharkId = _request.params.id;
				const data = await client.getAccount(sharkId);
				const account = await this.mastoConverter.convertAccount(data.data);
				reply.send(account);
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get<{ Params: { id: string } }>('/v1/accounts/:id/statuses', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getStatuses());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get<{ Params: { id: string } }>('/v1/accounts/:id/featured_tags', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getFeaturedTags();
				reply.send(data.data.map((tag) => convertFeaturedTag(tag)));
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get<{ Params: { id: string } }>('/v1/accounts/:id/followers', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getFollowers());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get<{ Params: { id: string } }>('/v1/accounts/:id/following', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getFollowing());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get<{ Params: { id: string } }>('/v1/accounts/:id/lists', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getAccountLists(_request.params.id);
				reply.send(data.data.map((list) => convertList(list)));
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/accounts/:id/follow', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.addFollow());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/accounts/:id/unfollow', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.rmFollow());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/accounts/:id/block', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.addBlock());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/accounts/:id/unblock', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.rmBlock());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/accounts/:id/mute', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.addMute());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/accounts/:id/unmute', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.rmMute());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/followed_tags', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getFollowedTags();
				reply.send(data.data);
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/bookmarks', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getBookmarks());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/favourites', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getFavourites());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/mutes', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getMutes());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/blocks', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.getBlocks());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/follow_requests', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getFollowRequests( ((_request.query as any) || { limit: 20 }).limit );
				reply.send(await Promise.all(data.data.map(async (account) => await this.mastoConverter.convertAccount(account as Entity.Account))));
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/follow_requests/:id/authorize', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.acceptFollow());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/follow_requests/:id/reject', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const account = new ApiAccountMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await account.rejectFollow());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});
		//#endregion

		//#region Search
		fastify.get('/v1/search', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const search = new ApiSearchMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await search.SearchV1());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v2/search', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const search = new ApiSearchMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await search.SearchV2());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v1/trends/statuses', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const search = new ApiSearchMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await search.getStatusTrends());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get('/v2/suggestions', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const search = new ApiSearchMastodon(_request, client, BASE_URL, this.mastoConverter);
				reply.send(await search.getSuggestions());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});
		//#endregion

		//#region Notifications
		fastify.get('/v1/notifications', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const notify = new ApiNotifyMastodon(_request, client);
				reply.send(await notify.getNotifications());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.get<{ Params: { id: string } }>('/v1/notification/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const notify = new ApiNotifyMastodon(_request, client);
				reply.send(await notify.getNotification());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/notification/:id/dismiss', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const notify = new ApiNotifyMastodon(_request, client);
				reply.send(await notify.rmNotification());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post('/v1/notifications/clear', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const notify = new ApiNotifyMastodon(_request, client);
				reply.send(await notify.rmNotifications());
			} catch (e: any) {
				/* console.error(e);
				console.error(e.response.data); */
				reply.code(401).send(e.response.data);
			}
		});
		//#endregion

		//#region Filters
		fastify.get<{ Params: { id: string } }>('/v1/filters/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const filter = new ApiFilterMastodon(_request, client);
				!_request.params.id ? reply.send(await filter.getFilters()) : reply.send(await filter.getFilter());
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post('/v1/filters', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const filter = new ApiFilterMastodon(_request, client);
				reply.send(await filter.createFilter());
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});

		fastify.post<{ Params: { id: string } }>('/v1/filters/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const filter = new ApiFilterMastodon(_request, client);
				reply.send(await filter.updateFilter());
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});

		fastify.delete<{ Params: { id: string } }>('/v1/filters/:id', async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const filter = new ApiFilterMastodon(_request, client);
				reply.send(await filter.rmFilter());
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				reply.code(401).send(e.response.data);
			}
		});
		//#endregion

		//#region Timelines
		const TLEndpoint = new ApiTimelineMastodon(fastify, this.config, this.mastoConverter);

		// GET Endpoints
		TLEndpoint.getTL();
		TLEndpoint.getHomeTl();
		TLEndpoint.getListTL();
		TLEndpoint.getTagTl();
		TLEndpoint.getConversations();
		TLEndpoint.getList();
		TLEndpoint.getLists();
		TLEndpoint.getListAccounts();

		// POST Endpoints
		TLEndpoint.createList();
		TLEndpoint.addListAccount();

		// PUT Endpoint
		TLEndpoint.updateList();

		// DELETE Endpoints
		TLEndpoint.deleteList();
		TLEndpoint.rmListAccount();
		//#endregion

		//#region Status
		const NoteEndpoint = new ApiStatusMastodon(fastify, this.mastoConverter);

		// GET Endpoints
		NoteEndpoint.getStatus();
		NoteEndpoint.getStatusSource();
		NoteEndpoint.getContext();
		NoteEndpoint.getHistory();
		NoteEndpoint.getReblogged();
		NoteEndpoint.getFavourites();
		NoteEndpoint.getMedia();
		NoteEndpoint.getPoll();

		//POST Endpoints
		NoteEndpoint.postStatus();
		NoteEndpoint.addFavourite();
		NoteEndpoint.rmFavourite();
		NoteEndpoint.reblogStatus();
		NoteEndpoint.unreblogStatus();
		NoteEndpoint.bookmarkStatus();
		NoteEndpoint.unbookmarkStatus();
		NoteEndpoint.pinStatus();
		NoteEndpoint.unpinStatus();
		NoteEndpoint.reactStatus();
		NoteEndpoint.unreactStatus();
		NoteEndpoint.votePoll();

		// PUT Endpoint
		fastify.put<{ Params: { id: string } }>('/v1/media/:id', { preHandler: upload.none() }, async (_request, reply) => {
			const BASE_URL = `${_request.protocol}://${_request.hostname}`;
			const accessTokens = _request.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.updateMedia(_request.params.id, _request.body!);
				reply.send(convertAttachment(data.data));
			} catch (e: any) {
				/* console.error(e); */
				reply.code(401).send(e.response.data);
			}
		});
		NoteEndpoint.updateStatus();

		// DELETE Endpoint
		NoteEndpoint.deleteStatus();
		//#endregion
		done();
	}
}
