import FormData from "form-data";
import AsyncLock from "async-lock";

import MisskeyAPI from "./misskey/api_client";
import { DEFAULT_UA } from "./default";
import { ProxyConfig } from "./proxy_config";
import OAuth from "./oauth";
import Response from "./response";
import Entity from "./entity";
import {
	MegalodonInterface,
	WebSocketInterface,
	NoImplementedError,
	ArgumentError,
	UnexpectedError,
} from "./megalodon";
import MegalodonEntity from "@/entity";
import fs from "node:fs";
import MisskeyNotificationType from "./misskey/notification";

type AccountCache = {
	locks: AsyncLock;
	accounts: Entity.Account[];
};

export default class Misskey implements MegalodonInterface {
	public client: MisskeyAPI.Interface;
	public converter: MisskeyAPI.Converter;
	public baseUrl: string;
	public proxyConfig: ProxyConfig | false;

	/**
	 * @param baseUrl hostname or base URL
	 * @param accessToken access token from OAuth2 authorization
	 * @param userAgent UserAgent is specified in header on request.
	 * @param proxyConfig Proxy setting, or set false if don't use proxy.
	 */
	constructor(
		baseUrl: string,
		accessToken: string | null = null,
		userAgent: string | null = DEFAULT_UA,
		proxyConfig: ProxyConfig | false = false,
	) {
		let token = "";
		if (accessToken) {
			token = accessToken;
		}
		let agent: string = DEFAULT_UA;
		if (userAgent) {
			agent = userAgent;
		}
		this.converter = new MisskeyAPI.Converter(baseUrl);
		this.client = new MisskeyAPI.Client(
			baseUrl,
			token,
			agent,
			proxyConfig,
			this.converter,
		);
		this.baseUrl = baseUrl;
		this.proxyConfig = proxyConfig;
	}

	private baseUrlToHost(baseUrl: string): string {
		return baseUrl.replace("https://", "");
	}

	public cancel(): void {
		return this.client.cancel();
	}

	public async registerApp(
		client_name: string,
		options: Partial<{
			scopes: Array<string>;
			redirect_uris: string;
			website: string;
		}> = {
			scopes: MisskeyAPI.DEFAULT_SCOPE,
			redirect_uris: this.baseUrl,
		},
	): Promise<OAuth.AppData> {
		return this.createApp(client_name, options).then(async (appData) => {
			return this.generateAuthUrlAndToken(appData.client_secret).then(
				(session) => {
					appData.url = session.url;
					appData.session_token = session.token;
					return appData;
				},
			);
		});
	}

	/**
	 * POST /api/app/create
	 *
	 * Create an application.
	 * @param client_name Your application's name.
	 * @param options Form data.
	 */
	public async createApp(
		client_name: string,
		options: Partial<{
			scopes: Array<string>;
			redirect_uris: string;
			website: string;
		}> = {
			scopes: MisskeyAPI.DEFAULT_SCOPE,
			redirect_uris: this.baseUrl,
		},
	): Promise<OAuth.AppData> {
		const redirect_uris = options.redirect_uris || this.baseUrl;
		const scopes = options.scopes || MisskeyAPI.DEFAULT_SCOPE;

		const params: {
			name: string;
			description: string;
			permission: Array<string>;
			callbackUrl: string;
		} = {
			name: client_name,
			description: "",
			permission: scopes,
			callbackUrl: redirect_uris,
		};

		/**
     * The response is:
     {
       "id": "xxxxxxxxxx",
       "name": "string",
       "callbackUrl": "string",
       "permission": [
         "string"
       ],
       "secret": "string"
     }
    */
		return this.client
			.post<MisskeyAPI.Entity.App>("/api/app/create", params)
			.then((res: Response<MisskeyAPI.Entity.App>) => {
				const appData: OAuth.AppDataFromServer = {
					id: res.data.id,
					name: res.data.name,
					website: null,
					redirect_uri: res.data.callbackUrl,
					client_id: "",
					client_secret: res.data.secret,
				};
				return OAuth.AppData.from(appData);
			});
	}

	/**
	 * POST /api/auth/session/generate
	 */
	public async generateAuthUrlAndToken(
		clientSecret: string,
	): Promise<MisskeyAPI.Entity.Session> {
		return this.client
			.post<MisskeyAPI.Entity.Session>("/api/auth/session/generate", {
				appSecret: clientSecret,
			})
			.then((res: Response<MisskeyAPI.Entity.Session>) => res.data);
	}

	// ======================================
	// apps
	// ======================================
	public async verifyAppCredentials(): Promise<Response<Entity.Application>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// apps/oauth
	// ======================================
	/**
	 * POST /api/auth/session/userkey
	 *
	 * @param _client_id This parameter is not used in this method.
	 * @param client_secret Application secret key which will be provided in createApp.
	 * @param session_token Session token string which will be provided in generateAuthUrlAndToken.
	 * @param _redirect_uri This parameter is not used in this method.
	 */
	public async fetchAccessToken(
		_client_id: string | null,
		client_secret: string,
		session_token: string,
		_redirect_uri?: string,
	): Promise<OAuth.TokenData> {
		return this.client
			.post<MisskeyAPI.Entity.UserKey>("/api/auth/session/userkey", {
				appSecret: client_secret,
				token: session_token,
			})
			.then((res) => {
				const token = new OAuth.TokenData(
					res.data.accessToken,
					"misskey",
					"",
					0,
					null,
					null,
				);
				return token;
			});
	}

	public async refreshToken(
		_client_id: string,
		_client_secret: string,
		_refresh_token: string,
	): Promise<OAuth.TokenData> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async revokeToken(
		_client_id: string,
		_client_secret: string,
		_token: string,
	): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// accounts
	// ======================================
	public async registerAccount(
		_username: string,
		_email: string,
		_password: string,
		_agreement: boolean,
		_locale: string,
		_reason?: string | null,
	): Promise<Response<Entity.Token>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * POST /api/i
	 */
	public async verifyAccountCredentials(): Promise<Response<Entity.Account>> {
		return this.client
			.post<MisskeyAPI.Entity.UserDetail>("/api/i")
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.userDetail(
						res.data,
						this.baseUrlToHost(this.baseUrl),
					),
				});
			});
	}

	/**
	 * POST /api/i/update
	 */
	public async updateCredentials(options?: {
		discoverable?: boolean;
		bot?: boolean;
		display_name?: string;
		note?: string;
		avatar?: string;
		header?: string;
		locked?: boolean;
		source?: {
			privacy?: string;
			sensitive?: boolean;
			language?: string;
		} | null;
		fields_attributes?: Array<{ name: string; value: string }>;
	}): Promise<Response<Entity.Account>> {
		let params = {};
		if (options) {
			if (options.bot !== undefined) {
				params = Object.assign(params, {
					isBot: options.bot,
				});
			}
			if (options.display_name) {
				params = Object.assign(params, {
					name: options.display_name,
				});
			}
			if (options.note) {
				params = Object.assign(params, {
					description: options.note,
				});
			}
			if (options.locked !== undefined) {
				params = Object.assign(params, {
					isLocked: options.locked,
				});
			}
			if (options.source) {
				if (options.source.language) {
					params = Object.assign(params, {
						lang: options.source.language,
					});
				}
				if (options.source.sensitive) {
					params = Object.assign(params, {
						alwaysMarkNsfw: options.source.sensitive,
					});
				}
			}
		}
		return this.client
			.post<MisskeyAPI.Entity.UserDetail>("/api/i", params)
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.userDetail(
						res.data,
						this.baseUrlToHost(this.baseUrl),
					),
				});
			});
	}

	/**
	 * POST /api/users/show
	 */
	public async getAccount(id: string): Promise<Response<Entity.Account>> {
		return this.client
			.post<MisskeyAPI.Entity.UserDetail>("/api/users/show", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.userDetail(
						res.data,
						this.baseUrlToHost(this.baseUrl),
					),
				});
			});
	}

	public async getAccountByName(
		user: string,
		host: string | null,
	): Promise<Response<Entity.Account>> {
		return this.client
			.post<MisskeyAPI.Entity.UserDetail>("/api/users/show", {
				username: user,
				host: host ?? null,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.userDetail(
						res.data,
						this.baseUrlToHost(this.baseUrl),
					),
				});
			});
	}

	/**
	 * POST /api/users/notes
	 */
	public async getAccountStatuses(
		id: string,
		options?: {
			limit?: number;
			max_id?: string;
			since_id?: string;
			pinned?: boolean;
			exclude_replies: boolean;
			exclude_reblogs: boolean;
			only_media?: boolean;
		},
	): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		if (options?.pinned) {
			return this.client
				.post<MisskeyAPI.Entity.UserDetail>("/api/users/show", {
					userId: id,
				})
				.then(async (res) => {
					if (res.data.pinnedNotes) {
						return {
							...res,
							data: await Promise.all(
								res.data.pinnedNotes.map((n) =>
									this.noteWithDetails(
										n,
										this.baseUrlToHost(this.baseUrl),
										accountCache,
									),
								),
							),
						};
					}
					return { ...res, data: [] };
				});
		}

		let params = {
			userId: id,
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.exclude_replies) {
				params = Object.assign(params, {
					includeReplies: false,
				});
			}
			if (options.exclude_reblogs) {
				params = Object.assign(params, {
					includeMyRenotes: false,
				});
			}
			if (options.only_media) {
				params = Object.assign(params, {
					withFiles: options.only_media,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/users/notes", params)
			.then(async (res) => {
				const statuses: Array<Entity.Status> = await Promise.all(
					res.data.map((note) =>
						this.noteWithDetails(
							note,
							this.baseUrlToHost(this.baseUrl),
							accountCache,
						),
					),
				);
				return Object.assign(res, {
					data: statuses,
				});
			});
	}

	public async getAccountFavourites(
		id: string,
		options?: {
			limit?: number;
			max_id?: string;
			since_id?: string;
		},
	): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		let params = {
			userId: id,
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit <= 100 ? options.limit : 100,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Favorite>>("/api/users/reactions", params)
			.then(async (res) => {
				return Object.assign(res, {
					data: await Promise.all(
						res.data.map((fav) =>
							this.noteWithDetails(
								fav.note,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							),
						),
					),
				});
			});
	}

	public async subscribeAccount(
		_id: string,
	): Promise<Response<Entity.Relationship>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async unsubscribeAccount(
		_id: string,
	): Promise<Response<Entity.Relationship>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * POST /api/users/followers
	 */
	public async getAccountFollowers(
		id: string,
		options?: {
			limit?: number;
			max_id?: string;
			since_id?: string;
		},
	): Promise<Response<Array<Entity.Account>>> {
		let params = {
			userId: id,
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit <= 100 ? options.limit : 100,
				});
			} else {
				params = Object.assign(params, {
					limit: 40,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 40,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Follower>>("/api/users/followers", params)
			.then(async (res) => {
				return Object.assign(res, {
					data: await Promise.all(
						res.data.map(async (f) =>
							this.getAccount(f.followerId).then((p) => p.data),
						),
					),
				});
			});
	}

	/**
	 * POST /api/users/following
	 */
	public async getAccountFollowing(
		id: string,
		options?: {
			limit?: number;
			max_id?: string;
			since_id?: string;
		},
	): Promise<Response<Array<Entity.Account>>> {
		let params = {
			userId: id,
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit <= 100 ? options.limit : 100,
				});
			}
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Following>>("/api/users/following", params)
			.then(async (res) => {
				return Object.assign(res, {
					data: await Promise.all(
						res.data.map(async (f) =>
							this.getAccount(f.followeeId).then((p) => p.data),
						),
					),
				});
			});
	}

	public async getAccountLists(
		_id: string,
	): Promise<Response<Array<Entity.List>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async getIdentityProof(
		_id: string,
	): Promise<Response<Array<Entity.IdentityProof>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * POST /api/following/create
	 */
	public async followAccount(
		id: string,
		_options?: { reblog?: boolean },
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/following/create", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	/**
	 * POST /api/following/delete
	 */
	public async unfollowAccount(
		id: string,
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/following/delete", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	/**
	 * POST /api/blocking/create
	 */
	public async blockAccount(
		id: string,
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/blocking/create", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	/**
	 * POST /api/blocking/delete
	 */
	public async unblockAccount(
		id: string,
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/blocking/delete", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	/**
	 * POST /api/mute/create
	 */
	public async muteAccount(
		id: string,
		_notifications: boolean,
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/mute/create", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	/**
	 * POST /api/mute/delete
	 */
	public async unmuteAccount(
		id: string,
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/mute/delete", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	public async pinAccount(_id: string): Promise<Response<Entity.Relationship>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async unpinAccount(
		_id: string,
	): Promise<Response<Entity.Relationship>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * POST /api/users/relation
	 *
	 * @param id The accountID, for example `'1sdfag'`
	 */
	public async getRelationship(
		id: string,
	): Promise<Response<Entity.Relationship>> {
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	/**
	 * POST /api/users/relation
	 *
	 * @param id Array of account ID, for example `['1sdfag', 'ds12aa']`.
	 */
	public async getRelationships(
		ids: Array<string>,
	): Promise<Response<Array<Entity.Relationship>>> {
		return Promise.all(ids.map((id) => this.getRelationship(id))).then(
			(results) => ({
				...results[0],
				data: results.map((r) => r.data),
			}),
		);
	}

	/**
	 * POST /api/users/search
	 */
	public async searchAccount(
		q: string,
		options?: {
			following?: boolean;
			resolve?: boolean;
			limit?: number;
			max_id?: string;
			since_id?: string;
		},
	): Promise<Response<Array<Entity.Account>>> {
		let params = {
			query: q,
			detail: true,
		};
		if (options) {
			if (options.resolve !== undefined) {
				params = Object.assign(params, {
					localOnly: options.resolve,
				});
			}
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 40,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 40,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.UserDetail>>("/api/users/search", params)
			.then((res) => {
				return Object.assign(res, {
					data: res.data.map((u) =>
						this.converter.userDetail(u, this.baseUrlToHost(this.baseUrl)),
					),
				});
			});
	}

	// ======================================
	// accounts/bookmarks
	// ======================================
	/**
	 * POST /api/i/favorites
	 */
	public async getBookmarks(options?: {
		limit?: number;
		max_id?: string;
		since_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		let params = {};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit <= 100 ? options.limit : 100,
				});
			} else {
				params = Object.assign(params, {
					limit: 40,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 40,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Favorite>>("/api/i/favorites", params)
			.then(async (res) => {
				return Object.assign(res, {
					data: await Promise.all(
						res.data.map((s) =>
							this.noteWithDetails(
								s.note,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							),
						),
					),
				});
			});
	}

	// ======================================
	//  accounts/favourites
	// ======================================
	public async getFavourites(options?: {
		limit?: number;
		max_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Status>>> {
		const userId = await this.client
			.post<MisskeyAPI.Entity.UserDetail>("/api/i")
			.then((res) => res.data.id);
		return this.getAccountFavourites(userId, options);
	}

	// ======================================
	// accounts/mutes
	// ======================================
	/**
	 * POST /api/mute/list
	 */
	public async getMutes(options?: {
		limit?: number;
		max_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Account>>> {
		let params = {};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 40,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 40,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Mute>>("/api/mute/list", params)
			.then((res) => {
				return Object.assign(res, {
					data: res.data.map((mute) =>
						this.converter.userDetail(
							mute.mutee,
							this.baseUrlToHost(this.baseUrl),
						),
					),
				});
			});
	}

	// ======================================
	// accounts/blocks
	// ======================================
	/**
	 * POST /api/blocking/list
	 */
	public async getBlocks(options?: {
		limit?: number;
		max_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Account>>> {
		let params = {};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 40,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 40,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Blocking>>("/api/blocking/list", params)
			.then((res) => {
				return Object.assign(res, {
					data: res.data.map((blocking) =>
						this.converter.userDetail(
							blocking.blockee,
							this.baseUrlToHost(this.baseUrl),
						),
					),
				});
			});
	}

	// ======================================
	// accounts/domain_blocks
	// ======================================
	public async getDomainBlocks(_options?: {
		limit?: number;
		max_id?: string;
		min_id?: string;
	}): Promise<Response<Array<string>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async blockDomain(_domain: string): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async unblockDomain(_domain: string): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// accounts/filters
	// ======================================
	public async getFilters(): Promise<Response<Array<Entity.Filter>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async getFilter(_id: string): Promise<Response<Entity.Filter>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async createFilter(
		_phrase: string,
		_context: Array<string>,
		_options?: {
			irreversible?: boolean;
			whole_word?: boolean;
			expires_in?: string;
		},
	): Promise<Response<Entity.Filter>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async updateFilter(
		_id: string,
		_phrase: string,
		_context: Array<string>,
		_options?: {
			irreversible?: boolean;
			whole_word?: boolean;
			expires_in?: string;
		},
	): Promise<Response<Entity.Filter>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async deleteFilter(_id: string): Promise<Response<Entity.Filter>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// accounts/reports
	// ======================================
	/**
	 * POST /api/users/report-abuse
	 */
	public async report(
		account_id: string,
		comment: string,
		_options?: {
			status_ids?: Array<string>;
			forward?: boolean;
		},
	): Promise<Response<Entity.Report>> {
		return this.client
			.post<{}>("/api/users/report-abuse", {
				userId: account_id,
				comment: comment,
			})
			.then((res) => {
				return Object.assign(res, {
					data: {
						id: "",
						action_taken: "",
						comment: comment,
						account_id: account_id,
						status_ids: [],
					},
				});
			});
	}

	// ======================================
	// accounts/follow_requests
	// ======================================
	/**
	 * POST /api/following/requests/list
	 */
	public async getFollowRequests(
		_limit?: number,
	): Promise<Response<Array<Entity.Account>>> {
		return this.client
			.post<Array<MisskeyAPI.Entity.FollowRequest>>(
				"/api/following/requests/list",
			)
			.then((res) => {
				return Object.assign(res, {
					data: res.data.map((r) => this.converter.user(r.follower)),
				});
			});
	}

	/**
	 * POST /api/following/requests/accept
	 */
	public async acceptFollowRequest(
		id: string,
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/following/requests/accept", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	/**
	 * POST /api/following/requests/reject
	 */
	public async rejectFollowRequest(
		id: string,
	): Promise<Response<Entity.Relationship>> {
		await this.client.post<{}>("/api/following/requests/reject", {
			userId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Relation>("/api/users/relation", {
				userId: id,
			})
			.then((res) => {
				return Object.assign(res, {
					data: this.converter.relation(res.data),
				});
			});
	}

	// ======================================
	// accounts/endorsements
	// ======================================
	public async getEndorsements(_options?: {
		limit?: number;
		max_id?: string;
		since_id?: string;
	}): Promise<Response<Array<Entity.Account>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// accounts/featured_tags
	// ======================================
	public async getFeaturedTags(): Promise<Response<Array<Entity.FeaturedTag>>> {
		return this.getAccountFeaturedTags();
	}

	public async getAccountFeaturedTags(): Promise<
		Response<Array<Entity.FeaturedTag>>
	> {
		const tags: Entity.FeaturedTag[] = [];
		const res: Response = {
			headers: undefined,
			statusText: "",
			status: 200,
			data: tags,
		};
		return new Promise((resolve) => resolve(res));
	}

	public async createFeaturedTag(
		_name: string,
	): Promise<Response<Entity.FeaturedTag>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async deleteFeaturedTag(_id: string): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async getSuggestedTags(): Promise<Response<Array<Entity.Tag>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// accounts/preferences
	// ======================================
	public async getPreferences(): Promise<Response<Entity.Preferences>> {
		return this.client
			.post<MisskeyAPI.Entity.UserDetailMe>("/api/i")
			.then(async (res) => {
				return Object.assign(res, {
					data: this.converter.userPreferences(
						res.data,
						await this.getDefaultPostPrivacy(),
					),
				});
			});
	}

	// ======================================
	// accounts/suggestions
	// ======================================
	/**
	 * POST /api/users/recommendation
	 */
	public async getSuggestions(
		limit?: number,
	): Promise<Response<Array<Entity.Account>>> {
		let params = {};
		if (limit) {
			params = Object.assign(params, {
				limit: limit,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.UserDetail>>(
				"/api/users/recommendation",
				params,
			)
			.then((res) => ({
				...res,
				data: res.data.map((u) =>
					this.converter.userDetail(u, this.baseUrlToHost(this.baseUrl)),
				),
			}));
	}

	// ======================================
	// accounts/tags
	// ======================================
	public async getFollowedTags(): Promise<Response<Array<Entity.Tag>>> {
		const tags: Entity.Tag[] = [];
		const res: Response = {
			headers: undefined,
			statusText: "",
			status: 200,
			data: tags,
		};
		return new Promise((resolve) => resolve(res));
	}

	public async getTag(_id: string): Promise<Response<Entity.Tag>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async followTag(_id: string): Promise<Response<Entity.Tag>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async unfollowTag(_id: string): Promise<Response<Entity.Tag>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// statuses
	// ======================================
	public async postStatus(
		status: string,
		options?: {
			media_ids?: Array<string>;
			poll?: {
				options: Array<string>;
				expires_in: number;
				multiple?: boolean;
				hide_totals?: boolean;
			};
			in_reply_to_id?: string;
			sensitive?: boolean;
			spoiler_text?: string;
			visibility?: "public" | "unlisted" | "private" | "direct";
			scheduled_at?: string;
			language?: string;
			quote_id?: string;
		},
	): Promise<Response<Entity.Status>> {
		let params = {
			text: status,
		};
		if (options) {
			if (options.media_ids) {
				params = Object.assign(params, {
					fileIds: options.media_ids,
				});
			}
			if (options.poll) {
				let pollParam = {
					choices: options.poll.options,
					expiresAt: null,
					expiredAfter: options.poll.expires_in * 1000,
				};
				if (options.poll.multiple !== undefined) {
					pollParam = Object.assign(pollParam, {
						multiple: options.poll.multiple,
					});
				}
				params = Object.assign(params, {
					poll: pollParam,
				});
			}
			if (options.in_reply_to_id) {
				params = Object.assign(params, {
					replyId: options.in_reply_to_id,
				});
			}
			if (options.sensitive) {
				params = Object.assign(params, {
					cw: "",
				});
			}
			if (options.spoiler_text) {
				params = Object.assign(params, {
					cw: options.spoiler_text,
				});
			}
			if (options.visibility) {
				params = Object.assign(params, {
					visibility: this.converter.encodeVisibility(options.visibility),
				});
			}
			if (options.quote_id) {
				params = Object.assign(params, {
					renoteId: options.quote_id,
				});
			}
		}
		return this.client
			.post<MisskeyAPI.Entity.CreatedNote>("/api/notes/create", params)
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data.createdNote,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * POST /api/notes/show
	 */
	public async getStatus(id: string): Promise<Response<Entity.Status>> {
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	private getFreshAccountCache(): AccountCache {
		return {
			locks: new AsyncLock(),
			accounts: [],
		};
	}

	public async notificationWithDetails(
		n: MisskeyAPI.Entity.Notification,
		host: string,
		cache: AccountCache,
	): Promise<MegalodonEntity.Notification> {
		const notification = this.converter.notification(n, host);
		if (n.note)
			notification.status = await this.noteWithDetails(n.note, host, cache);
		if (notification.account)
			notification.account = (
				await this.getAccount(notification.account.id)
			).data;
		return notification;
	}

	public async noteWithDetails(
		n: MisskeyAPI.Entity.Note,
		host: string,
		cache: AccountCache,
	): Promise<MegalodonEntity.Status> {
		const status = await this.addUserDetailsToStatus(
			this.converter.note(n, host),
			cache,
		);
		status.bookmarked = await this.isStatusBookmarked(n.id);
		return this.addMentionsToStatus(status, cache);
	}

	public async isStatusBookmarked(id: string): Promise<boolean> {
		return this.client
			.post<MisskeyAPI.Entity.State>("/api/notes/state", {
				noteId: id,
			})
			.then((p) => p.data.isFavorited ?? false);
	}

	public async addUserDetailsToStatus(
		status: Entity.Status,
		cache: AccountCache,
	): Promise<Entity.Status> {
		if (
			status.account.followers_count === 0 &&
			status.account.followers_count === 0 &&
			status.account.statuses_count === 0
		)
			status.account =
				(await this.getAccountCached(
					status.account.id,
					status.account.acct,
					cache,
				)) ?? status.account;

		if (status.reblog != null)
			status.reblog = await this.addUserDetailsToStatus(status.reblog, cache);

		if (status.quote != null)
			status.quote = await this.addUserDetailsToStatus(status.quote, cache);

		return status;
	}

	public async addMentionsToStatus(
		status: Entity.Status,
		cache: AccountCache,
	): Promise<Entity.Status> {
		if (status.mentions.length > 0) return status;

		if (status.reblog != null)
			status.reblog = await this.addMentionsToStatus(status.reblog, cache);

		if (status.quote != null)
			status.quote = await this.addMentionsToStatus(status.quote, cache);

		const idx = status.account.acct.indexOf("@");
		const origin = idx < 0 ? null : status.account.acct.substring(idx + 1);

		status.mentions = (
			await this.getMentions(status.plain_content!, origin, cache)
		).filter((p) => p != null);
		for (const m of status.mentions.filter(
			(value, index, array) => array.indexOf(value) === index,
		)) {
			const regexFull = new RegExp(
				`(?<=^|\\s|>)@${m.acct}(?=[^a-zA-Z0-9]|$)`,
				"gi",
			);
			const regexLocalUser = new RegExp(
				`(?<=^|\\s|>)@${m.acct}@${this.baseUrlToHost(
					this.baseUrl,
				)}(?=[^a-zA-Z0-9]|$)`,
				"gi",
			);
			const regexRemoteUser = new RegExp(
				`(?<=^|\\s|>)@${m.username}(?=[^a-zA-Z0-9@]|$)`,
				"gi",
			);

			if (m.acct == m.username) {
				status.content = status.content.replace(regexLocalUser, `@${m.acct}`);
			} else if (!status.content.match(regexFull)) {
				status.content = status.content.replace(regexRemoteUser, `@${m.acct}`);
			}

			status.content = status.content.replace(
				regexFull,
				`<a href="${m.url}" class="u-url mention" rel="nofollow noopener noreferrer" target="_blank">@${m.acct}</a>`,
			);
		}
		return status;
	}

	public async getMentions(
		text: string,
		origin: string | null,
		cache: AccountCache,
	): Promise<Entity.Mention[]> {
		const mentions: Entity.Mention[] = [];

		if (text == undefined) return mentions;

		const mentionMatch = text.matchAll(
			/(?<=^|\s)@(?<user>[a-zA-Z0-9_]+)(?:@(?<host>[a-zA-Z0-9-.]+\.[a-zA-Z0-9-]+)|)(?=[^a-zA-Z0-9]|$)/g,
		);

		for (const m of mentionMatch) {
			try {
				if (m.groups == null) continue;

				const account = await this.getAccountByNameCached(
					m.groups.user,
					m.groups.host ?? origin,
					cache,
				);

				if (account == null) continue;

				mentions.push({
					id: account.id,
					url: account.url,
					username: account.username,
					acct: account.acct,
				});
			} catch {}
		}

		return mentions;
	}

	public async getAccountByNameCached(
		user: string,
		host: string | null,
		cache: AccountCache,
	): Promise<Entity.Account | undefined | null> {
		const acctToFind = host == null ? user : `${user}@${host}`;

		return await cache.locks.acquire(acctToFind, async () => {
			const cacheHit = cache.accounts.find((p) => p.acct === acctToFind);
			const account =
				cacheHit ?? (await this.getAccountByName(user, host ?? null)).data;

			if (!account) {
				return null;
			}

			if (cacheHit == null) {
				cache.accounts.push(account);
			}

			return account;
		});
	}

	public async getAccountCached(
		id: string,
		acct: string,
		cache: AccountCache,
	): Promise<Entity.Account | undefined | null> {
		return await cache.locks.acquire(acct, async () => {
			const cacheHit = cache.accounts.find((p) => p.id === id);
			const account = cacheHit ?? (await this.getAccount(id)).data;

			if (!account) {
				return null;
			}

			if (cacheHit == null) {
				cache.accounts.push(account);
			}

			return account;
		});
	}

	public async editStatus(
		_id: string,
		_options: {
			status?: string;
			spoiler_text?: string;
			sensitive?: boolean;
			media_ids?: Array<string>;
			poll?: {
				options?: Array<string>;
				expires_in?: number;
				multiple?: boolean;
				hide_totals?: boolean;
			};
		},
	): Promise<Response<Entity.Status>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * POST /api/notes/delete
	 */
	public async deleteStatus(id: string): Promise<Response<{}>> {
		return this.client.post<{}>("/api/notes/delete", {
			noteId: id,
		});
	}

	/**
	 * POST /api/notes/children
	 */
	public async getStatusContext(
		id: string,
		options?: { limit?: number; max_id?: string; since_id?: string },
	): Promise<Response<Entity.Context>> {
		let params = {
			noteId: id,
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
					depth: 12,
				});
			} else {
				params = Object.assign(params, {
					limit: 30,
					depth: 12,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 30,
				depth: 12,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/children", params)
			.then(async (res) => {
				const accountCache = this.getFreshAccountCache();
				const conversation = await this.client.post<
					Array<MisskeyAPI.Entity.Note>
				>("/api/notes/conversation", params);
				const parents = await Promise.all(
					conversation.data.map((n) =>
						this.noteWithDetails(
							n,
							this.baseUrlToHost(this.baseUrl),
							accountCache,
						),
					),
				);

				const context: Entity.Context = {
					ancestors: parents.reverse(),
					descendants: this.dfs(
						await Promise.all(
							res.data.map((n) =>
								this.noteWithDetails(
									n,
									this.baseUrlToHost(this.baseUrl),
									accountCache,
								),
							),
						),
					),
				};
				return {
					...res,
					data: context,
				};
			});
	}

	private dfs(graph: Entity.Status[]) {
		// we don't need to run dfs if we have zero or one elements
		if (graph.length <= 1) {
			return graph;
		}

		// sort the graph first, so we can grab the correct starting point
		graph = graph.sort((a, b) => {
			if (a.id < b.id) return -1;
			if (a.id > b.id) return 1;
			return 0;
		});

		const initialPostId = graph[0].in_reply_to_id;

		// populate stack with all top level replies
		const stack = graph
			.filter((reply) => reply.in_reply_to_id === initialPostId)
			.reverse();
		const visited = new Set();
		const result = [];

		while (stack.length) {
			const currentPost = stack.pop();

			if (currentPost === undefined) return result;

			if (!visited.has(currentPost)) {
				visited.add(currentPost);
				result.push(currentPost);

				for (const reply of graph
					.filter((reply) => reply.in_reply_to_id === currentPost.id)
					.reverse()) {
					stack.push(reply);
				}
			}
		}

		return result;
	}

	public async getStatusHistory(): Promise<Response<Array<Entity.StatusEdit>>> {
		// FIXME: stub, implement once we have note edit history in the database
		const history: Entity.StatusEdit[] = [];
		const res: Response = {
			headers: undefined,
			statusText: "",
			status: 200,
			data: history,
		};
		return new Promise((resolve) => resolve(res));
	}

	/**
	 * POST /api/notes/renotes
	 */
	public async getStatusRebloggedBy(
		id: string,
	): Promise<Response<Array<Entity.Account>>> {
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/renotes", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: (
					await Promise.all(res.data.map((n) => this.getAccount(n.user.id)))
				).map((p) => p.data),
			}));
	}

	public async getStatusFavouritedBy(
		id: string,
	): Promise<Response<Array<Entity.Account>>> {
		return this.client
			.post<Array<MisskeyAPI.Entity.Reaction>>("/api/notes/reactions", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: (
					await Promise.all(res.data.map((n) => this.getAccount(n.user.id)))
				).map((p) => p.data),
			}));
	}

	public async favouriteStatus(id: string): Promise<Response<Entity.Status>> {
		return this.createEmojiReaction(id, await this.getDefaultFavoriteEmoji());
	}

	private async getDefaultFavoriteEmoji(): Promise<string> {
		// NOTE: get-unsecure is calckey's extension.
		//       Misskey doesn't have this endpoint and regular `/i/registry/get` won't work
		//       unless you have a 'nativeToken', which is reserved for the frontend webapp.

		return await this.client
			.post<Array<string>>("/api/i/registry/get-unsecure", {
				key: "reactions",
				scope: ["client", "base"],
			})
			.then((res) => res.data[0] ?? "⭐");
	}

	private async getDefaultPostPrivacy(): Promise<
		"public" | "unlisted" | "private" | "direct"
	> {
		// NOTE: get-unsecure is calckey's extension.
		//       Misskey doesn't have this endpoint and regular `/i/registry/get` won't work
		//       unless you have a 'nativeToken', which is reserved for the frontend webapp.

		return this.client
			.post<string>("/api/i/registry/get-unsecure", {
				key: "defaultNoteVisibility",
				scope: ["client", "base"],
			})
			.then((res) => {
				if (
					!res.data ||
					(res.data != "public" &&
						res.data != "home" &&
						res.data != "followers" &&
						res.data != "specified")
				)
					return "public";
				return this.converter.visibility(res.data);
			})
			.catch((_) => "public");
	}

	public async unfavouriteStatus(id: string): Promise<Response<Entity.Status>> {
		// NOTE: Misskey allows only one reaction per status, so we don't need to care what that emoji was.
		return this.deleteEmojiReaction(id, "");
	}

	/**
	 * POST /api/notes/create
	 */
	public async reblogStatus(id: string): Promise<Response<Entity.Status>> {
		return this.client
			.post<MisskeyAPI.Entity.CreatedNote>("/api/notes/create", {
				renoteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data.createdNote,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * POST /api/notes/unrenote
	 */
	public async unreblogStatus(id: string): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/notes/unrenote", {
			noteId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * POST /api/notes/favorites/create
	 */
	public async bookmarkStatus(id: string): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/notes/favorites/create", {
			noteId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * POST /api/notes/favorites/delete
	 */
	public async unbookmarkStatus(id: string): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/notes/favorites/delete", {
			noteId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	public async muteStatus(_id: string): Promise<Response<Entity.Status>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async unmuteStatus(_id: string): Promise<Response<Entity.Status>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * POST /api/i/pin
	 */
	public async pinStatus(id: string): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/i/pin", {
			noteId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * POST /api/i/unpin
	 */
	public async unpinStatus(id: string): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/i/unpin", {
			noteId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * Convert a Unicode emoji or custom emoji name to a Misskey reaction.
	 * @see Misskey's reaction-lib.ts
	 */
	private reactionName(name: string): string {
		// See: https://github.com/tc39/proposal-regexp-unicode-property-escapes#matching-emoji
		const isUnicodeEmoji =
			/\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu.test(
				name,
			);
		if (isUnicodeEmoji) {
			return name;
		}
		return `:${name}:`;
	}

	/**
	 * POST /api/notes/reactions/create
	 */
	public async reactStatus(
		id: string,
		name: string,
	): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/notes/reactions/create", {
			noteId: id,
			reaction: this.reactionName(name),
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * POST /api/notes/reactions/delete
	 */
	public async unreactStatus(
		id: string,
		name: string,
	): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/notes/reactions/delete", {
			noteId: id,
			reaction: this.reactionName(name),
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	// ======================================
	// statuses/media
	// ======================================
	/**
	 * POST /api/drive/files/create
	 */
	public async uploadMedia(
		file: any,
		options?: { description?: string; focus?: string },
	): Promise<Response<Entity.Attachment>> {
		const formData = new FormData();
		formData.append("file", fs.createReadStream(file.path), {
			contentType: file.mimetype,
		});

		if (file.originalname != null && file.originalname !== "file")
			formData.append("name", file.originalname);

		if (options?.description != null)
			formData.append("comment", options.description);

		let headers: { [key: string]: string } = {};
		if (typeof formData.getHeaders === "function") {
			headers = formData.getHeaders();
		}
		return this.client
			.post<MisskeyAPI.Entity.File>(
				"/api/drive/files/create",
				formData,
				headers,
			)
			.then((res) => ({ ...res, data: this.converter.file(res.data) }));
	}

	public async getMedia(id: string): Promise<Response<Entity.Attachment>> {
		const res = await this.client.post<MisskeyAPI.Entity.File>(
			"/api/drive/files/show",
			{ fileId: id },
		);
		return { ...res, data: this.converter.file(res.data) };
	}

	/**
	 * POST /api/drive/files/update
	 */
	public async updateMedia(
		id: string,
		options?: {
			file?: any;
			description?: string;
			focus?: string;
			is_sensitive?: boolean;
		},
	): Promise<Response<Entity.Attachment>> {
		let params = {
			fileId: id,
		};
		if (options) {
			if (options.is_sensitive !== undefined) {
				params = Object.assign(params, {
					isSensitive: options.is_sensitive,
				});
			}

			if (options.description !== undefined) {
				params = Object.assign(params, {
					comment: options.description,
				});
			}
		}
		return this.client
			.post<MisskeyAPI.Entity.File>("/api/drive/files/update", params)
			.then((res) => ({ ...res, data: this.converter.file(res.data) }));
	}

	// ======================================
	// statuses/polls
	// ======================================
	public async getPoll(id: string): Promise<Response<Entity.Poll>> {
		const res = await this.getStatus(id);
		if (res.data.poll == null) throw new Error("poll not found");
		return { ...res, data: res.data.poll };
	}

	/**
	 * POST /api/notes/polls/vote
	 */
	public async votePoll(
		id: string,
		choices: Array<number>,
	): Promise<Response<Entity.Poll>> {
		if (!id) {
			return new Promise((_, reject) => {
				const err = new ArgumentError("id is required");
				reject(err);
			});
		}

		for (const c of choices) {
			const params = {
				noteId: id,
				choice: +c,
			};
			await this.client.post<{}>("/api/notes/polls/vote", params);
		}

		const res = await this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => {
				const note = await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				);
				return { ...res, data: note.poll };
			});
		if (!res.data) {
			return new Promise((_, reject) => {
				const err = new UnexpectedError("poll does not exist");
				reject(err);
			});
		}
		return { ...res, data: res.data };
	}

	// ======================================
	// statuses/scheduled_statuses
	// ======================================
	public async getScheduledStatuses(_options?: {
		limit?: number;
		max_id?: string;
		since_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.ScheduledStatus>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async getScheduledStatus(
		_id: string,
	): Promise<Response<Entity.ScheduledStatus>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async scheduleStatus(
		_id: string,
		_scheduled_at?: string | null,
	): Promise<Response<Entity.ScheduledStatus>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async cancelScheduledStatus(_id: string): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// timelines
	// ======================================
	/**
	 * POST /api/notes/global-timeline
	 */
	public async getPublicTimeline(options?: {
		only_media?: boolean;
		limit?: number;
		max_id?: string;
		since_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		let params = {};
		if (options) {
			if (options.only_media !== undefined) {
				params = Object.assign(params, {
					withFiles: options.only_media,
				});
			}
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/global-timeline", params)
			.then(async (res) => ({
				...res,
				data: (
					await Promise.all(
						res.data.map((n) =>
							this.noteWithDetails(
								n,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							),
						),
					)
				).sort(this.sortByIdDesc),
			}));
	}

	/**
	 * POST /api/notes/local-timeline
	 */
	public async getLocalTimeline(options?: {
		only_media?: boolean;
		limit?: number;
		max_id?: string;
		since_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		let params = {};
		if (options) {
			if (options.only_media !== undefined) {
				params = Object.assign(params, {
					withFiles: options.only_media,
				});
			}
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/local-timeline", params)
			.then(async (res) => ({
				...res,
				data: (
					await Promise.all(
						res.data.map((n) =>
							this.noteWithDetails(
								n,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							),
						),
					)
				).sort(this.sortByIdDesc),
			}));
	}

	/**
	 * POST /api/notes/search-by-tag
	 */
	public async getTagTimeline(
		hashtag: string,
		options?: {
			local?: boolean;
			only_media?: boolean;
			limit?: number;
			max_id?: string;
			since_id?: string;
			min_id?: string;
		},
	): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		let params = {
			tag: hashtag,
		};
		if (options) {
			if (options.only_media !== undefined) {
				params = Object.assign(params, {
					withFiles: options.only_media,
				});
			}
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/search-by-tag", params)
			.then(async (res) => ({
				...res,
				data: (
					await Promise.all(
						res.data.map((n) =>
							this.noteWithDetails(
								n,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							),
						),
					)
				).sort(this.sortByIdDesc),
			}));
	}

	/**
	 * POST /api/notes/timeline
	 */
	public async getHomeTimeline(options?: {
		local?: boolean;
		limit?: number;
		max_id?: string;
		since_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		let params = {
			withFiles: false,
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/timeline", params)
			.then(async (res) => ({
				...res,
				data: (
					await Promise.all(
						res.data.map((n) =>
							this.noteWithDetails(
								n,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							),
						),
					)
				).sort(this.sortByIdDesc),
			}));
	}

	/**
	 * POST /api/notes/user-list-timeline
	 */
	public async getListTimeline(
		list_id: string,
		options?: {
			limit?: number;
			max_id?: string;
			since_id?: string;
			min_id?: string;
		},
	): Promise<Response<Array<Entity.Status>>> {
		const accountCache = this.getFreshAccountCache();

		let params = {
			listId: list_id,
			withFiles: false,
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>(
				"/api/notes/user-list-timeline",
				params,
			)
			.then(async (res) => ({
				...res,
				data: (
					await Promise.all(
						res.data.map((n) =>
							this.noteWithDetails(
								n,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							),
						),
					)
				).sort(this.sortByIdDesc),
			}));
	}

	// ======================================
	// timelines/conversations
	// ======================================
	/**
	 * POST /api/notes/mentions
	 */
	public async getConversationTimeline(options?: {
		limit?: number;
		max_id?: string;
		since_id?: string;
		min_id?: string;
	}): Promise<Response<Array<Entity.Conversation>>> {
		let params = {
			visibility: "specified",
		};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/mentions", params)
			.then((res) => ({
				...res,
				data: res.data.map((n) =>
					this.converter.noteToConversation(
						n,
						this.baseUrlToHost(this.baseUrl),
					),
				),
			}));
		// FIXME: ^ this should also parse mentions
	}

	public async deleteConversation(_id: string): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async readConversation(
		_id: string,
	): Promise<Response<Entity.Conversation>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	private sortByIdDesc(a: Entity.Status, b: Entity.Status): number {
		if (a.id < b.id) return 1;
		if (a.id > b.id) return -1;

		return 0;
	}

	// ======================================
	// timelines/lists
	// ======================================
	/**
	 * POST /api/users/lists/list
	 */
	public async getLists(id: string): Promise<Response<Array<Entity.List>>> {
		return this.client
			.post<Array<MisskeyAPI.Entity.List>>("/api/users/lists/list", { userId: id })
			.then((res) => ({
				...res,
				data: res.data.map((l) => this.converter.list(l)),
			}));
	}

	/**
	 * POST /api/users/lists/show
	 */
	public async getList(id: string): Promise<Response<Entity.List>> {
		return this.client
			.post<MisskeyAPI.Entity.List>("/api/users/lists/show", {
				listId: id,
			})
			.then((res) => ({ ...res, data: this.converter.list(res.data) }));
	}

	/**
	 * POST /api/users/lists/create
	 */
	public async createList(title: string): Promise<Response<Entity.List>> {
		return this.client
			.post<MisskeyAPI.Entity.List>("/api/users/lists/create", {
				name: title,
			})
			.then((res) => ({ ...res, data: this.converter.list(res.data) }));
	}

	/**
	 * POST /api/users/lists/update
	 */
	public async updateList(
		id: string,
		title: string,
	): Promise<Response<Entity.List>> {
		return this.client
			.post<MisskeyAPI.Entity.List>("/api/users/lists/update", {
				listId: id,
				name: title,
			})
			.then((res) => ({ ...res, data: this.converter.list(res.data) }));
	}

	/**
	 * POST /api/users/lists/delete
	 */
	public async deleteList(id: string): Promise<Response<{}>> {
		return this.client.post<{}>("/api/users/lists/delete", {
			listId: id,
		});
	}

	/**
	 * POST /api/users/lists/show
	 */
	public async getAccountsInList(
		id: string,
		_options?: {
			limit?: number;
			max_id?: string;
			since_id?: string;
		},
	): Promise<Response<Array<Entity.Account>>> {
		const res = await this.client.post<MisskeyAPI.Entity.List>(
			"/api/users/lists/show",
			{
				listId: id,
			},
		);
		const promise = res.data.userIds.map((userId) => this.getAccount(userId));
		const accounts = await Promise.all(promise);
		return { ...res, data: accounts.map((r) => r.data) };
	}

	/**
	 * POST /api/users/lists/push
	 */
	public async addAccountsToList(
		id: string,
		account_ids: Array<string>,
	): Promise<Response<{}>> {
		return this.client.post<{}>("/api/users/lists/push", {
			listId: id,
			userId: account_ids[0],
		});
	}

	/**
	 * POST /api/users/lists/pull
	 */
	public async deleteAccountsFromList(
		id: string,
		account_ids: Array<string>,
	): Promise<Response<{}>> {
		return this.client.post<{}>("/api/users/lists/pull", {
			listId: id,
			userId: account_ids[0],
		});
	}

	// ======================================
	// timelines/markers
	// ======================================
	public async getMarkers(
		_timeline: Array<string>,
	): Promise<Response<Entity.Marker | {}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async saveMarkers(_options?: {
		home?: { last_read_id: string };
		notifications?: { last_read_id: string };
	}): Promise<Response<Entity.Marker>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// notifications
	// ======================================
	/**
	 * POST /api/i/notifications
	 */
	public async getNotifications(options?: {
		limit?: number;
		max_id?: string;
		since_id?: string;
		min_id?: string;
		exclude_type?: Array<Entity.NotificationType>;
		account_id?: string;
	}): Promise<Response<Array<Entity.Notification>>> {
		let params = {};
		if (options) {
			if (options.limit) {
				params = Object.assign(params, {
					limit: options.limit <= 100 ? options.limit : 100,
				});
			} else {
				params = Object.assign(params, {
					limit: 20,
				});
			}
			if (options.max_id) {
				params = Object.assign(params, {
					untilId: options.max_id,
				});
			}
			if (options.since_id) {
				params = Object.assign(params, {
					sinceId: options.since_id,
				});
			}
			if (options.min_id) {
				params = Object.assign(params, {
					sinceId: options.min_id,
				});
			}
			if (options.exclude_type) {
				params = Object.assign(params, {
					excludeType: options.exclude_type.map((e) =>
						this.converter.encodeNotificationType(e),
					),
				});
			}
		} else {
			params = Object.assign(params, {
				limit: 20,
			});
		}
		const cache = this.getFreshAccountCache();
		return this.client
			.post<Array<MisskeyAPI.Entity.Notification>>(
				"/api/i/notifications",
				params,
			)
			.then(async (res) => ({
				...res,
				data: await Promise.all(
					res.data
						.filter(
							(p) => p.type != MisskeyNotificationType.FollowRequestAccepted,
						) // these aren't supported on mastodon
						.map((n) =>
							this.notificationWithDetails(
								n,
								this.baseUrlToHost(this.baseUrl),
								cache,
							),
						),
				),
			}));
	}

	public async getNotification(
		_id: string,
	): Promise<Response<Entity.Notification>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * POST /api/notifications/mark-all-as-read
	 */
	public async dismissNotifications(): Promise<Response<{}>> {
		return this.client.post<{}>("/api/notifications/mark-all-as-read");
	}

	public async dismissNotification(_id: string): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async readNotifications(_options: {
		id?: string;
		max_id?: string;
	}): Promise<Response<Entity.Notification | Array<Entity.Notification>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("mastodon does not support");
			reject(err);
		});
	}

	// ======================================
	// notifications/push
	// ======================================
	public async subscribePushNotification(
		_subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
		_data?: {
			alerts: {
				follow?: boolean;
				favourite?: boolean;
				reblog?: boolean;
				mention?: boolean;
				poll?: boolean;
			};
		} | null,
	): Promise<Response<Entity.PushSubscription>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async getPushSubscription(): Promise<
		Response<Entity.PushSubscription>
	> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async updatePushSubscription(
		_data?: {
			alerts: {
				follow?: boolean;
				favourite?: boolean;
				reblog?: boolean;
				mention?: boolean;
				poll?: boolean;
			};
		} | null,
	): Promise<Response<Entity.PushSubscription>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	/**
	 * DELETE /api/v1/push/subscription
	 */
	public async deletePushSubscription(): Promise<Response<{}>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// search
	// ======================================
	public async search(
		q: string,
		type: "accounts" | "hashtags" | "statuses",
		options?: {
			limit?: number;
			max_id?: string;
			min_id?: string;
			resolve?: boolean;
			offset?: number;
			following?: boolean;
			account_id?: string;
			exclude_unreviewed?: boolean;
		},
	): Promise<Response<Entity.Results>> {
		const accountCache = this.getFreshAccountCache();

		switch (type) {
			case "accounts": {
				if (q.startsWith("http://") || q.startsWith("https://")) {
					return this.client
						.post("/api/ap/show", { uri: q })
						.then(async (res) => {
							if (res.status != 200 || res.data.type != "User") {
								res.status = 200;
								res.statusText = "OK";
								res.data = {
									accounts: [],
									statuses: [],
									hashtags: [],
								};

								return res;
							}

							const account = await this.converter.userDetail(
								res.data.object as MisskeyAPI.Entity.UserDetail,
								this.baseUrlToHost(this.baseUrl),
							);

							return {
								...res,
								data: {
									accounts:
										options?.max_id && options?.max_id >= account.id
											? []
											: [account],
									statuses: [],
									hashtags: [],
								},
							};
						});
				}
				let params = {
					query: q,
				};
				if (options) {
					if (options.limit) {
						params = Object.assign(params, {
							limit: options.limit,
						});
					} else {
						params = Object.assign(params, {
							limit: 20,
						});
					}
					if (options.offset) {
						params = Object.assign(params, {
							offset: options.offset,
						});
					}
					if (options.resolve) {
						params = Object.assign(params, {
							localOnly: options.resolve,
						});
					}
				} else {
					params = Object.assign(params, {
						limit: 20,
					});
				}

				try {
					const match = q.match(
						/^@(?<user>[a-zA-Z0-9_]+)(?:@(?<host>[a-zA-Z0-9-.]+\.[a-zA-Z0-9-]+)|)$/,
					);
					if (match) {
						const lookupQuery = {
							username: match.groups?.user,
							host: match.groups?.host,
						};

						const result = await this.client
							.post<MisskeyAPI.Entity.UserDetail>(
								"/api/users/show",
								lookupQuery,
							)
							.then((res) => ({
								...res,
								data: {
									accounts: [
										this.converter.userDetail(
											res.data,
											this.baseUrlToHost(this.baseUrl),
										),
									],
									statuses: [],
									hashtags: [],
								},
							}));

						if (result.status !== 200) {
							result.status = 200;
							result.statusText = "OK";
							result.data = {
								accounts: [],
								statuses: [],
								hashtags: [],
							};
						}

						return result;
					}
				} catch {}

				return this.client
					.post<Array<MisskeyAPI.Entity.UserDetail>>(
						"/api/users/search",
						params,
					)
					.then((res) => ({
						...res,
						data: {
							accounts: res.data.map((u) =>
								this.converter.userDetail(u, this.baseUrlToHost(this.baseUrl)),
							),
							statuses: [],
							hashtags: [],
						},
					}));
			}
			case "statuses": {
				if (q.startsWith("http://") || q.startsWith("https://")) {
					return this.client
						.post("/api/ap/show", { uri: q })
						.then(async (res) => {
							if (res.status != 200 || res.data.type != "Note") {
								res.status = 200;
								res.statusText = "OK";
								res.data = {
									accounts: [],
									statuses: [],
									hashtags: [],
								};

								return res;
							}

							const post = await this.noteWithDetails(
								res.data.object as MisskeyAPI.Entity.Note,
								this.baseUrlToHost(this.baseUrl),
								accountCache,
							);

							return {
								...res,
								data: {
									accounts: [],
									statuses:
										options?.max_id && options.max_id >= post.id ? [] : [post],
									hashtags: [],
								},
							};
						});
				}
				let params = {
					query: q,
				};
				if (options) {
					if (options.limit) {
						params = Object.assign(params, {
							limit: options.limit,
						});
					}
					if (options.offset) {
						params = Object.assign(params, {
							offset: options.offset,
						});
					}
					if (options.max_id) {
						params = Object.assign(params, {
							untilId: options.max_id,
						});
					}
					if (options.min_id) {
						params = Object.assign(params, {
							sinceId: options.min_id,
						});
					}
					if (options.account_id) {
						params = Object.assign(params, {
							userId: options.account_id,
						});
					}
				}
				return this.client
					.post<Array<MisskeyAPI.Entity.Note>>("/api/notes/search", params)
					.then(async (res) => ({
						...res,
						data: {
							accounts: [],
							statuses: await Promise.all(
								res.data.map((n) =>
									this.noteWithDetails(
										n,
										this.baseUrlToHost(this.baseUrl),
										accountCache,
									),
								),
							),
							hashtags: [],
						},
					}));
			}
			case "hashtags": {
				let params = {
					query: q,
				};
				if (options) {
					if (options.limit) {
						params = Object.assign(params, {
							limit: options.limit,
						});
					}
					if (options.offset) {
						params = Object.assign(params, {
							offset: options.offset,
						});
					}
				}
				return this.client
					.post<Array<string>>("/api/hashtags/search", params)
					.then((res) => ({
						...res,
						data: {
							accounts: [],
							statuses: [],
							hashtags: res.data.map((h) => ({
								name: h,
								url: h,
								history: null,
								following: false,
							})),
						},
					}));
			}
		}
	}

	// ======================================
	// instance
	// ======================================
	/**
	 * POST /api/meta
	 * POST /api/stats
	 */
	public async getInstance(): Promise<Response<Entity.Instance>> {
		const meta = await this.client
			.post<MisskeyAPI.Entity.Meta>("/api/meta", { "detail": true })
			.then((res) => res.data);
		return this.client
			.post<MisskeyAPI.Entity.Stats>("/api/stats", { "detail": true })
			.then((res) => ({ ...res, data: this.converter.meta(meta, res.data) }));
	}

	public async getInstancePeers(): Promise<Response<Array<string>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public async getInstanceActivity(): Promise<
		Response<Array<Entity.Activity>>
	> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// instance/trends
	// ======================================
	/**
	 * POST /api/hashtags/trend
	 */
	public async getInstanceTrends(
		_limit?: number | null,
	): Promise<Response<Array<Entity.Tag>>> {
		return this.client
			.post<Array<MisskeyAPI.Entity.Hashtag>>("/api/hashtags/trend")
			.then((res) => ({
				...res,
				data: res.data.map((h) => this.converter.hashtag(h)),
			}));
	}

	// ======================================
	// instance/directory
	// ======================================
	public async getInstanceDirectory(_options?: {
		limit?: number;
		offset?: number;
		order?: "active" | "new";
		local?: boolean;
	}): Promise<Response<Array<Entity.Account>>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	// ======================================
	// instance/custom_emojis
	// ======================================
	/**
	 * POST /api/meta
	 */
	public async getInstanceCustomEmojis(): Promise<
		Response<Array<Entity.Emoji>>
	> {
		return this.client
			.post<any>("/api/emojis")
			.then((res) => ({
				...res,
				data: res.data.emojis.map((e: any) => this.converter.emoji(e)),
			}));
	}

	// ======================================
	// instance/announcements
	// ======================================
	public async getInstanceAnnouncements(
		with_dismissed?: boolean | null,
	): Promise<Response<Array<Entity.Announcement>>> {
		let params = {};
		if (with_dismissed) {
			params = Object.assign(params, {
				withUnreads: with_dismissed,
			});
		}
		return this.client
			.post<Array<MisskeyAPI.Entity.Announcement>>("/api/announcements", params)
			.then((res) => ({
				...res,
				data: res.data.map((t) => this.converter.announcement(t)),
			}));
	}

	public async dismissInstanceAnnouncement(id: string): Promise<Response<{}>> {
		return this.client.post<{}>("/api/i/read-announcement", {
			announcementId: id,
		});
	}

	// ======================================
	// Emoji reactions
	// ======================================
	/**
	 * POST /api/notes/reactions/create
	 *
	 * @param {string} id Target note ID.
	 * @param {string} emoji Reaction emoji string. This string is raw unicode emoji.
	 */
	public async createEmojiReaction(
		id: string,
		emoji: string,
	): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/notes/reactions/create", {
			noteId: id,
			reaction: emoji,
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	/**
	 * POST /api/notes/reactions/delete
	 */
	public async deleteEmojiReaction(
		id: string,
		_emoji: string,
	): Promise<Response<Entity.Status>> {
		await this.client.post<{}>("/api/notes/reactions/delete", {
			noteId: id,
		});
		return this.client
			.post<MisskeyAPI.Entity.Note>("/api/notes/show", {
				noteId: id,
			})
			.then(async (res) => ({
				...res,
				data: await this.noteWithDetails(
					res.data,
					this.baseUrlToHost(this.baseUrl),
					this.getFreshAccountCache(),
				),
			}));
	}

	public async getEmojiReactions(
		id: string,
	): Promise<Response<Array<Entity.Reaction>>> {
		return this.client
			.post<Array<MisskeyAPI.Entity.Reaction>>("/api/notes/reactions", {
				noteId: id,
			})
			.then((res) => ({
				...res,
				data: this.converter.reactions(res.data),
			}));
	}

	public async getEmojiReaction(
		_id: string,
		_emoji: string,
	): Promise<Response<Entity.Reaction>> {
		return new Promise((_, reject) => {
			const err = new NoImplementedError("misskey does not support");
			reject(err);
		});
	}

	public userSocket(): WebSocketInterface {
		return this.client.socket("user");
	}

	public publicSocket(): WebSocketInterface {
		return this.client.socket("globalTimeline");
	}

	public localSocket(): WebSocketInterface {
		return this.client.socket("localTimeline");
	}

	public tagSocket(_tag: string): WebSocketInterface {
		throw new NoImplementedError("TODO: implement");
	}

	public listSocket(list_id: string): WebSocketInterface {
		return this.client.socket("list", list_id);
	}

	public directSocket(): WebSocketInterface {
		return this.client.socket("conversation");
	}
}
