import { fileURLToPath } from 'node:url';
import { Inject, Injectable } from '@nestjs/common';
import type { UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import megalodon, { MegalodonInterface } from "megalodon";
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { convertId, IdConvertType as IdType, convertAccount, convertAnnouncement, convertFilter, convertAttachment, convertFeaturedTag } from './converters.js';
import { IsNull } from 'typeorm';
import type { Config } from '@/config.js';
import { getInstance } from './endpoints/meta.js';
import { MetaService } from '@/core/MetaService.js';
import multer from 'fastify-multer';
import { apiAuthMastodon } from './endpoints/auth.js';
import { apiAccountMastodon } from './endpoints/account.js';

const staticAssets = fileURLToPath(new URL('../../../../assets/', import.meta.url));

export function getClient(BASE_URL: string, authorization: string | undefined): MegalodonInterface {
	const accessTokenArr = authorization?.split(" ") ?? [null];
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
        @Inject(DI.config)
        private config: Config,
        private metaService: MetaService,
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

        fastify.register(multer.contentParser);

        fastify.get("/v1/custom_emojis", async (_request, reply) => {
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
    
        fastify.get("/v1/instance", async (_request, reply) => {
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
                    order: { id: "ASC" },
                });
                const contact = admin == null ? null : convertAccount((await client.getAccount(admin.id)).data);
                reply.send(await getInstance(data.data, contact, this.config, await this.metaService.fetch()));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    
        fastify.get("/v1/announcements", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.getInstanceAnnouncements();
                reply.send(data.data.map((announcement) => convertAnnouncement(announcement)));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    
        fastify.post<{ Body: { id: string } }>("/v1/announcements/:id/dismiss", async (_request, reply) => {
                const BASE_URL = `${_request.protocol}://${_request.hostname}`;
                const accessTokens = _request.headers.authorization;
                const client = getClient(BASE_URL, accessTokens);
                try {
                    const data = await client.dismissInstanceAnnouncement(
                        convertId(_request.body['id'], IdType.SharkeyId)
                    );
                    reply.send(data.data);
                } catch (e: any) {
                    console.error(e);
                    reply.code(401).send(e.response.data);
                }
            },
        );

        fastify.post("/v1/media", { preHandler: upload.single('file') }, async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const multipartData = await _request.file;
                if (!multipartData) {
                    reply.code(401).send({ error: "No image" });
                    return;
                }
                const data = await client.uploadMedia(multipartData);
                reply.send(convertAttachment(data.data as Entity.Attachment));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.post("/v2/media", { preHandler: upload.single('file') }, async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const multipartData = await _request.file;
                if (!multipartData) {
                    reply.code(401).send({ error: "No image" });
                    return;
                }
                const data = await client.uploadMedia(multipartData, _request.body!);
                reply.send(convertAttachment(data.data as Entity.Attachment));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });        
    
        fastify.get("/v1/filters", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            try {
                const data = await client.getFilters();
                reply.send(data.data.map((filter) => convertFilter(filter)));
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    
        fastify.get("/v1/trends", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            try {
                const data = await client.getInstanceTrends();
                reply.send(data.data);
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.post("/v1/apps", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const client = getClient(BASE_URL, ""); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            try {
                const data = await apiAuthMastodon(_request, client);
                reply.send(data);
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });
    
        fastify.get("/v1/preferences", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            try {
                const data = await client.getPreferences();
                reply.send(data.data);
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });

        //#region Accounts
        fastify.get("/v1/accounts/verify_credentials", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            try {
                const account = new apiAccountMastodon(_request, client, BASE_URL);
                reply.send(await account.verifyCredentials());
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.patch("/v1/accounts/update_credentials", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            try {
                const account = new apiAccountMastodon(_request, client, BASE_URL);
                reply.send(await account.updateCredentials());
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.get("/v1/accounts/lookup", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            try {
                const account = new apiAccountMastodon(_request, client, BASE_URL);
                reply.send(await account.lookup());
            } catch (e: any) {
                console.error(e);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.get("/v1/accounts/relationships", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens); // we are using this here, because in private mode some info isnt
            // displayed without being logged in
            let users;
            try {
                let ids = _request.query ? (_request.query as any)["id[]"] : null;
                if (typeof ids === "string") {
                    ids = [ids];
                }
                users = ids;
                const account = new apiAccountMastodon(_request, client, BASE_URL);
                reply.send(await account.getRelationships(users));
            } catch (e: any) {
                console.error(e);
                let data = e.response.data;
                data.users = users;
                console.error(data);
                reply.code(401).send(data);
            }
        });

        fastify.get<{ Params: { id: string } }>("/v1/accounts/:id", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const sharkId = convertId(_request.params.id, IdType.SharkeyId);
                const data = await client.getAccount(sharkId);
                reply.send(convertAccount(data.data));
            } catch (e: any) {
                console.error(e);
                console.error(e.response.data);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.get<{ Params: { id: string } }>("/v1/accounts/:id/statuses", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const account = new apiAccountMastodon(_request, client, BASE_URL);
                reply.send(await account.getStatuses());
            } catch (e: any) {
                console.error(e);
                console.error(e.response.data);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.get<{ Params: { id: string } }>("/v1/accounts/:id/featured_tags", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const data = await client.getFeaturedTags();
                reply.send(data.data.map((tag) => convertFeaturedTag(tag)));
            } catch (e: any) {
                console.error(e);
                console.error(e.response.data);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.get<{ Params: { id: string } }>("/v1/accounts/:id/followers", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const account = new apiAccountMastodon(_request, client, BASE_URL);
                reply.send(await account.getFollowers());
            } catch (e: any) {
                console.error(e);
                console.error(e.response.data);
                reply.code(401).send(e.response.data);
            }
        });

        fastify.get<{ Params: { id: string } }>("/v1/accounts/:id/following", async (_request, reply) => {
            const BASE_URL = `${_request.protocol}://${_request.hostname}`;
            const accessTokens = _request.headers.authorization;
            const client = getClient(BASE_URL, accessTokens);
            try {
                const account = new apiAccountMastodon(_request, client, BASE_URL);
                reply.send(await account.getFollowing());
            } catch (e: any) {
                console.error(e);
                console.error(e.response.data);
                reply.code(401).send(e.response.data);
            }
        });
        //#endregion
		done();
	}
}