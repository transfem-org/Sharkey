import axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import dayjs from "dayjs";
import FormData from "form-data";

import { DEFAULT_UA } from "../default";
import proxyAgent, { ProxyConfig } from "../proxy_config";
import Response from "../response";
import MisskeyEntity from "./entity";
import MegalodonEntity from "../entity";
import WebSocket from "./web_socket";
import MisskeyNotificationType from "./notification";
import NotificationType from "../notification";

namespace MisskeyAPI {
	export namespace Entity {
		export type App = MisskeyEntity.App;
		export type Announcement = MisskeyEntity.Announcement;
		export type Blocking = MisskeyEntity.Blocking;
		export type Choice = MisskeyEntity.Choice;
		export type CreatedNote = MisskeyEntity.CreatedNote;
		export type Emoji = MisskeyEntity.Emoji;
		export type Favorite = MisskeyEntity.Favorite;
		export type Field = MisskeyEntity.Field;
		export type File = MisskeyEntity.File;
		export type Follower = MisskeyEntity.Follower;
		export type Following = MisskeyEntity.Following;
		export type FollowRequest = MisskeyEntity.FollowRequest;
		export type Hashtag = MisskeyEntity.Hashtag;
		export type List = MisskeyEntity.List;
		export type Meta = MisskeyEntity.Meta;
		export type Mute = MisskeyEntity.Mute;
		export type Note = MisskeyEntity.Note;
		export type Notification = MisskeyEntity.Notification;
		export type Poll = MisskeyEntity.Poll;
		export type Reaction = MisskeyEntity.Reaction;
		export type Relation = MisskeyEntity.Relation;
		export type User = MisskeyEntity.User;
		export type UserDetail = MisskeyEntity.UserDetail;
		export type UserDetailMe = MisskeyEntity.UserDetailMe;
		export type GetAll = MisskeyEntity.GetAll;
		export type UserKey = MisskeyEntity.UserKey;
		export type Session = MisskeyEntity.Session;
		export type Stats = MisskeyEntity.Stats;
		export type State = MisskeyEntity.State;
		export type APIEmoji = { emojis: Emoji[] };
	}

	export class Converter {
		private baseUrl: string;
		private instanceHost: string;
		private plcUrl: string;
		private modelOfAcct = {
			id: "1",
			username: "none",
			acct: "none",
			display_name: "none",
			locked: true,
			bot: true,
			discoverable: false,
			group: false,
			created_at: "1971-01-01T00:00:00.000Z",
			note: "",
			url: "plc",
			avatar: "plc",
			avatar_static: "plc",
			header: "plc",
			header_static: "plc",
			followers_count: -1,
			following_count: 0,
			statuses_count: 0,
			last_status_at: "1971-01-01T00:00:00.000Z",
			noindex: true,
			emojis: [],
			fields: [],
			moved: null,
		};

		constructor(baseUrl: string) {
			this.baseUrl = baseUrl;
			this.instanceHost = baseUrl.substring(baseUrl.indexOf("//") + 2);
			this.plcUrl = `${baseUrl}/static-assets/transparent.png`;
			this.modelOfAcct.url = this.plcUrl;
			this.modelOfAcct.avatar = this.plcUrl;
			this.modelOfAcct.avatar_static = this.plcUrl;
			this.modelOfAcct.header = this.plcUrl;
			this.modelOfAcct.header_static = this.plcUrl;
		}

		// FIXME: Properly render MFM instead of just escaping HTML characters.
		escapeMFM = (text: string): string =>
			text
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;")
				.replace(/`/g, "&#x60;")
				.replace(/\r?\n/g, "<br>");

		emoji = (e: Entity.Emoji): MegalodonEntity.Emoji => {
			return {
				shortcode: e.name,
				static_url: e.url,
				url: e.url,
				visible_in_picker: true,
				category: e.category,
			};
		};

		field = (f: Entity.Field): MegalodonEntity.Field => ({
			name: f.name,
			value: this.escapeMFM(f.value),
			verified_at: null,
		});

		user = (u: Entity.User): MegalodonEntity.Account => {
			let acct = u.username;
			let acctUrl = `https://${u.host || this.instanceHost}/@${u.username}`;
			if (u.host) {
				acct = `${u.username}@${u.host}`;
				acctUrl = `https://${u.host}/@${u.username}`;
			}
			return {
				id: u.id,
				username: u.username,
				acct: acct,
				display_name: u.name || u.username,
				locked: false,
				created_at: new Date().toISOString(),
				followers_count: 0,
				following_count: 0,
				statuses_count: 0,
				note: "",
				url: acctUrl,
				avatar: u.avatarUrl,
				avatar_static: u.avatarUrl,
				header: this.plcUrl,
				header_static: this.plcUrl,
				emojis: u.emojis.map((e) => this.emoji(e)),
				moved: null,
				fields: [],
				bot: false,
			};
		};

		userDetail = (
			u: Entity.UserDetail,
			host: string,
		): MegalodonEntity.Account => {
			let acct = u.username;
			host = host.replace("https://", "");
			let acctUrl = `https://${host || u.host || this.instanceHost}/@${
				u.username
			}`;
			if (u.host) {
				acct = `${u.username}@${u.host}`;
				acctUrl = `https://${u.host}/@${u.username}`;
			}
			return {
				id: u.id,
				username: u.username,
				acct: acct,
				display_name: u.name || u.username,
				locked: u.isLocked,
				created_at: u.createdAt,
				followers_count: u.followersCount,
				following_count: u.followingCount,
				statuses_count: u.notesCount,
				note: u.description?.replace(/\n|\\n/g, "<br>") ?? "",
				url: acctUrl,
				avatar: u.avatarUrl,
				avatar_static: u.avatarUrl,
				header: u.bannerUrl ?? this.plcUrl,
				header_static: u.bannerUrl ?? this.plcUrl,
				emojis: u.emojis && u.emojis.length > 0 ? u.emojis.map((e) => this.emoji(e)) : [],
				moved: null,
				fields: u.fields.map((f) => this.field(f)),
				bot: u.isBot,
			};
		};

		userPreferences = (
			u: MisskeyAPI.Entity.UserDetailMe,
			v: "public" | "unlisted" | "private" | "direct",
		): MegalodonEntity.Preferences => {
			return {
				"reading:expand:media": "default",
				"reading:expand:spoilers": false,
				"posting:default:language": u.lang,
				"posting:default:sensitive": u.alwaysMarkNsfw,
				"posting:default:visibility": v,
			};
		};

		visibility = (
			v: "public" | "home" | "followers" | "specified",
		): "public" | "unlisted" | "private" | "direct" => {
			switch (v) {
				case "public":
					return v;
				case "home":
					return "unlisted";
				case "followers":
					return "private";
				case "specified":
					return "direct";
			}
		};

		encodeVisibility = (
			v: "public" | "unlisted" | "private" | "direct",
		): "public" | "home" | "followers" | "specified" => {
			switch (v) {
				case "public":
					return v;
				case "unlisted":
					return "home";
				case "private":
					return "followers";
				case "direct":
					return "specified";
			}
		};

		fileType = (
			s: string,
		): "unknown" | "image" | "gifv" | "video" | "audio" => {
			if (s === "image/gif") {
				return "gifv";
			}
			if (s.includes("image")) {
				return "image";
			}
			if (s.includes("video")) {
				return "video";
			}
			if (s.includes("audio")) {
				return "audio";
			}
			return "unknown";
		};

		file = (f: Entity.File): MegalodonEntity.Attachment => {
			return {
				id: f.id,
				type: this.fileType(f.type),
				url: f.url,
				remote_url: f.url,
				preview_url: f.thumbnailUrl,
				text_url: f.url,
				meta: {
					width: f.properties.width,
					height: f.properties.height,
				},
				description: f.comment,
				blurhash: f.blurhash,
			};
		};

		follower = (f: Entity.Follower): MegalodonEntity.Account => {
			return this.user(f.follower);
		};

		following = (f: Entity.Following): MegalodonEntity.Account => {
			return this.user(f.followee);
		};

		relation = (r: Entity.Relation): MegalodonEntity.Relationship => {
			return {
				id: r.id,
				following: r.isFollowing,
				followed_by: r.isFollowed,
				blocking: r.isBlocking,
				blocked_by: r.isBlocked,
				muting: r.isMuted,
				muting_notifications: false,
				requested: r.hasPendingFollowRequestFromYou,
				domain_blocking: false,
				showing_reblogs: true,
				endorsed: false,
				notifying: false,
			};
		};

		choice = (c: Entity.Choice): MegalodonEntity.PollOption => {
			return {
				title: c.text,
				votes_count: c.votes,
			};
		};

		poll = (p: Entity.Poll, id: string): MegalodonEntity.Poll => {
			const now = dayjs();
			const expire = dayjs(p.expiresAt);
			const count = p.choices.reduce((sum, choice) => sum + choice.votes, 0);
			return {
				id: id,
				expires_at: p.expiresAt,
				expired: now.isAfter(expire),
				multiple: p.multiple,
				votes_count: count,
				options: p.choices.map((c) => this.choice(c)),
				voted: p.choices.some((c) => c.isVoted),
				own_votes: p.choices
					.filter((c) => c.isVoted)
					.map((c) => p.choices.indexOf(c)),
			};
		};

		note = (n: Entity.Note, host: string): MegalodonEntity.Status => {
			host = host.replace("https://", "");

			return {
				id: n.id,
				uri: n.uri ? n.uri : `https://${host}/notes/${n.id}`,
				url: n.uri ? n.uri : `https://${host}/notes/${n.id}`,
				account: this.user(n.user),
				in_reply_to_id: n.replyId,
				in_reply_to_account_id: n.reply?.userId ?? null,
				reblog: n.renote ? this.note(n.renote, host) : null,
				content: n.text ? this.escapeMFM(n.text) : "",
				plain_content: n.text ? n.text : null,
				created_at: n.createdAt,
				// Remove reaction emojis with names containing @ from the emojis list.
				emojis: n.emojis
					.filter((e) => e.name.indexOf("@") === -1)
					.map((e) => this.emoji(e)),
				replies_count: n.repliesCount,
				reblogs_count: n.renoteCount,
				favourites_count: this.getTotalReactions(n.reactions),
				reblogged: false,
				favourited: !!n.myReaction,
				muted: false,
				sensitive: n.files ? n.files.some((f) => f.isSensitive) : false,
				spoiler_text: n.cw ? n.cw : "",
				visibility: this.visibility(n.visibility),
				media_attachments: n.files ? n.files.map((f) => this.file(f)) : [],
				mentions: [],
				tags: [],
				card: null,
				poll: n.poll ? this.poll(n.poll, n.id) : null,
				application: null,
				language: null,
				pinned: null,
				// Use emojis list to provide URLs for emoji reactions.
				reactions: this.mapReactions(n.emojis, n.reactions, n.myReaction),
				bookmarked: false,
				quote: n.renote && n.text ? this.note(n.renote, host) : null,
			};
		};

		mapReactions = (
			emojis: Array<MisskeyEntity.Emoji>,
			r: { [key: string]: number },
			myReaction?: string,
		): Array<MegalodonEntity.Reaction> => {
			// Map of emoji shortcodes to image URLs.
			const emojiUrls = new Map<string, string>(
				emojis.map((e) => [e.name, e.url]),
			);
			return Object.keys(r).map((key) => {
				// Strip colons from custom emoji reaction names to match emoji shortcodes.
				const shortcode = key.replaceAll(":", "");
				// If this is a custom emoji (vs. a Unicode emoji), find its image URL.
				const url = emojiUrls.get(shortcode);
				// Finally, remove trailing @. from local custom emoji reaction names.
				const name = shortcode.replace("@.", "");
				return {
					count: r[key],
					me: key === myReaction,
					name,
					url,
					// We don't actually have a static version of the asset, but clients expect one anyway.
					static_url: url,
				};
			});
		};

		getTotalReactions = (r: { [key: string]: number }): number => {
			return Object.values(r).length > 0
				? Object.values(r).reduce(
						(previousValue, currentValue) => previousValue + currentValue,
				  )
				: 0;
		};

		reactions = (
			r: Array<Entity.Reaction>,
		): Array<MegalodonEntity.Reaction> => {
			const result: Array<MegalodonEntity.Reaction> = [];
			for (const e of r) {
				const i = result.findIndex((res) => res.name === e.type);
				if (i >= 0) {
					result[i].count++;
				} else {
					result.push({
						count: 1,
						me: false,
						name: e.type,
					});
				}
			}
			return result;
		};

		noteToConversation = (
			n: Entity.Note,
			host: string,
		): MegalodonEntity.Conversation => {
			const accounts: Array<MegalodonEntity.Account> = [this.user(n.user)];
			if (n.reply) {
				accounts.push(this.user(n.reply.user));
			}
			return {
				id: n.id,
				accounts: accounts,
				last_status: this.note(n, host),
				unread: false,
			};
		};

		list = (l: Entity.List): MegalodonEntity.List => ({
			id: l.id,
			title: l.name,
		});

		encodeNotificationType = (
			e: MegalodonEntity.NotificationType,
		): MisskeyEntity.NotificationType => {
			switch (e) {
				case NotificationType.Follow:
					return MisskeyNotificationType.Follow;
				case NotificationType.Mention:
					return MisskeyNotificationType.Reply;
				case NotificationType.Favourite:
				case NotificationType.Reaction:
					return MisskeyNotificationType.Reaction;
				case NotificationType.Reblog:
					return MisskeyNotificationType.Renote;
				case NotificationType.Poll:
					return MisskeyNotificationType.PollEnded;
				case NotificationType.FollowRequest:
					return MisskeyNotificationType.ReceiveFollowRequest;
				default:
					return e;
			}
		};

		decodeNotificationType = (
			e: MisskeyEntity.NotificationType,
		): MegalodonEntity.NotificationType => {
			switch (e) {
				case MisskeyNotificationType.Follow:
					return NotificationType.Follow;
				case MisskeyNotificationType.Mention:
				case MisskeyNotificationType.Reply:
					return NotificationType.Mention;
				case MisskeyNotificationType.Renote:
				case MisskeyNotificationType.Quote:
					return NotificationType.Reblog;
				case MisskeyNotificationType.Reaction:
					return NotificationType.Reaction;
				case MisskeyNotificationType.PollEnded:
					return NotificationType.Poll;
				case MisskeyNotificationType.ReceiveFollowRequest:
					return NotificationType.FollowRequest;
				case MisskeyNotificationType.FollowRequestAccepted:
					return NotificationType.Follow;
				default:
					return e;
			}
		};

		announcement = (a: Entity.Announcement): MegalodonEntity.Announcement => ({
			id: a.id,
			content: `<h1>${this.escapeMFM(a.title)}</h1>${this.escapeMFM(a.text)}`,
			starts_at: null,
			ends_at: null,
			published: true,
			all_day: false,
			published_at: a.createdAt,
			updated_at: a.updatedAt,
			read: a.isRead,
			mentions: [],
			statuses: [],
			tags: [],
			emojis: [],
			reactions: [],
		});

		notification = (
			n: Entity.Notification,
			host: string,
		): MegalodonEntity.Notification => {
			let notification = {
				id: n.id,
				account: n.user ? this.user(n.user) : this.modelOfAcct,
				created_at: n.createdAt,
				type: this.decodeNotificationType(n.type),
			};
			if (n.note) {
				notification = Object.assign(notification, {
					status: this.note(n.note, host),
				});
				if (notification.type === NotificationType.Poll) {
					notification = Object.assign(notification, {
						account: this.note(n.note, host).account,
					});
				}
				if (n.reaction) {
					notification = Object.assign(notification, {
						reaction: this.mapReactions(n.note.emojis, { [n.reaction]: 1 })[0],
					});
				}
			}
			return notification;
		};

		stats = (s: Entity.Stats): MegalodonEntity.Stats => {
			return {
				user_count: s.usersCount,
				status_count: s.notesCount,
				domain_count: s.instances,
			};
		};

		meta = (m: Entity.Meta, s: Entity.Stats): MegalodonEntity.Instance => {
			const wss = m.uri.replace(/^https:\/\//, "wss://");
			return {
				uri: m.uri,
				title: m.name,
				description: m.description,
				email: m.maintainerEmail,
				version: m.version,
				thumbnail: m.bannerUrl,
				urls: {
					streaming_api: `${wss}/streaming`,
				},
				stats: this.stats(s),
				languages: m.langs,
				contact_account: null,
				max_toot_chars: m.maxNoteTextLength,
				registrations: !m.disableRegistration,
			};
		};

		hashtag = (h: Entity.Hashtag): MegalodonEntity.Tag => {
			return {
				name: h.tag,
				url: h.tag,
				history: null,
				following: false,
			};
		};
	}

	export const DEFAULT_SCOPE = [
		"read:account",
		"write:account",
		"read:blocks",
		"write:blocks",
		"read:drive",
		"write:drive",
		"read:favorites",
		"write:favorites",
		"read:following",
		"write:following",
		"read:mutes",
		"write:mutes",
		"write:notes",
		"read:notifications",
		"write:notifications",
		"read:reactions",
		"write:reactions",
		"write:votes",
	];

	/**
	 * Interface
	 */
	export interface Interface {
		post<T = any>(
			path: string,
			params?: any,
			headers?: { [key: string]: string },
		): Promise<Response<T>>;
		cancel(): void;
		socket(
			channel:
				| "user"
				| "localTimeline"
				| "hybridTimeline"
				| "globalTimeline"
				| "conversation"
				| "list",
			listId?: string,
		): WebSocket;
	}

	/**
	 * Misskey API client.
	 *
	 * Usign axios for request, you will handle promises.
	 */
	export class Client implements Interface {
		private accessToken: string | null;
		private baseUrl: string;
		private userAgent: string;
		private abortController: AbortController;
		private proxyConfig: ProxyConfig | false = false;
		private converter: Converter;

		/**
		 * @param baseUrl hostname or base URL
		 * @param accessToken access token from OAuth2 authorization
		 * @param userAgent UserAgent is specified in header on request.
		 * @param proxyConfig Proxy setting, or set false if don't use proxy.
		 * @param converter Converter instance.
		 */
		constructor(
			baseUrl: string,
			accessToken: string | null,
			userAgent: string = DEFAULT_UA,
			proxyConfig: ProxyConfig | false = false,
			converter: Converter,
		) {
			this.accessToken = accessToken;
			this.baseUrl = baseUrl;
			this.userAgent = userAgent;
			this.proxyConfig = proxyConfig;
			this.abortController = new AbortController();
			this.converter = converter;
			axios.defaults.signal = this.abortController.signal;
		}

		/**
		 * POST request to mastodon REST API.
		 * @param path relative path from baseUrl
		 * @param params Form data
		 * @param headers Request header object
		 */
		public async post<T>(
			path: string,
			params: any = {},
			headers: { [key: string]: string } = {},
		): Promise<Response<T>> {
			let options: AxiosRequestConfig = {
				headers: headers,
				maxContentLength: Infinity,
				maxBodyLength: Infinity,
			};
			if (this.proxyConfig) {
				options = Object.assign(options, {
					httpAgent: proxyAgent(this.proxyConfig),
					httpsAgent: proxyAgent(this.proxyConfig),
				});
			}
			let bodyParams = params;
			if (this.accessToken) {
				if (params instanceof FormData) {
					bodyParams.append("i", this.accessToken);
				} else {
					bodyParams = Object.assign(params, {
						i: this.accessToken,
					});
				}
			}

			return axios
				.post<T>(this.baseUrl + path, bodyParams, options)
				.then((resp: AxiosResponse<T>) => {
					const res: Response<T> = {
						data: resp.data,
						status: resp.status,
						statusText: resp.statusText,
						headers: resp.headers,
					};
					return res;
				});
		}

		/**
		 * Cancel all requests in this instance.
		 * @returns void
		 */
		public cancel(): void {
			return this.abortController.abort();
		}

		/**
		 * Get connection and receive websocket connection for Misskey API.
		 *
		 * @param channel Channel name is user, localTimeline, hybridTimeline, globalTimeline, conversation or list.
		 * @param listId This parameter is required only list channel.
		 */
		public socket(
			channel:
				| "user"
				| "localTimeline"
				| "hybridTimeline"
				| "globalTimeline"
				| "conversation"
				| "list",
			listId?: string,
		): WebSocket {
			if (!this.accessToken) {
				throw new Error("accessToken is required");
			}
			const url = `${this.baseUrl}/streaming`;
			const streaming = new WebSocket(
				url,
				channel,
				this.accessToken,
				listId,
				this.userAgent,
				this.proxyConfig,
				this.converter,
			);
			process.nextTick(() => {
				streaming.start();
			});
			return streaming;
		}
	}
}

export default MisskeyAPI;
