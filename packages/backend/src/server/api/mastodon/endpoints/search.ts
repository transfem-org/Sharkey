import { Converter } from 'megalodon';
import { convertAccount, convertStatus } from '../converters.js';
import { convertTimelinesArgsId, limitToInt } from './timeline.js';
import type { MegalodonInterface } from 'megalodon';
import type { FastifyRequest } from 'fastify';

async function getHighlight(
	BASE_URL: string,
	domain: string,
	accessTokens: string | undefined,
) {
	const accessTokenArr = accessTokens?.split(' ') ?? [null];
	const accessToken = accessTokenArr[accessTokenArr.length - 1];
	try {
		const apicall = await fetch(`${BASE_URL}/api/notes/featured`,
			{
				method: 'POST',
				headers: {
					'Accept': 'application/json, text/plain, */*',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ i: accessToken }),
			});
		const api = await apicall.json();
		const data: MisskeyEntity.Note[] = api;
		return data.map((note) => Converter.note(note, domain));
	} catch (e: any) {
		console.log(e);
		console.log(e.response.data);
		return [];
	}
}

async function getFeaturedUser( BASE_URL: string, host: string, accessTokens: string | undefined, limit: number ) {
	const accessTokenArr = accessTokens?.split(' ') ?? [null];
	const accessToken = accessTokenArr[accessTokenArr.length - 1];
	try {
		const apicall = await fetch(`${BASE_URL}/api/users`,
			{
				method: 'POST',
				headers: {
					'Accept': 'application/json, text/plain, */*',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ i: accessToken, limit, origin: 'local', sort: '+follower', state: 'alive' }),
			});
		const api = await apicall.json();
		const data: MisskeyEntity.UserDetail[] = api;
		return data.map((u) => {
			return {
				source: 'past_interactions',
				account: Converter.userDetail(u),
			};
		});
	} catch (e: any) {
		console.log(e);
		console.log(e.response.data);
		return [];
	}
}
export class ApiSearchMastodon {
	private request: FastifyRequest;
	private client: MegalodonInterface;
	private BASE_URL: string;

	constructor(request: FastifyRequest, client: MegalodonInterface, BASE_URL: string) {
		this.request = request;
		this.client = client;
		this.BASE_URL = BASE_URL;
	}

	public async SearchV1() {
		try {
			const query: any = convertTimelinesArgsId(limitToInt(this.request.query as any));
			const type = query.type || '';
			const data = await this.client.search(query.q, { type: type, ...query });
			return data.data;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async SearchV2() {
		try {
			const query: any = convertTimelinesArgsId(limitToInt(this.request.query as any));
			const type = query.type;
			const acct = !type || type === 'accounts' ? await this.client.search(query.q, { type: 'accounts', ...query }) : null;
			const stat = !type || type === 'statuses' ? await this.client.search(query.q, { type: 'statuses', ...query }) : null;
			const tags = !type || type === 'hashtags' ? await this.client.search(query.q, { type: 'hashtags', ...query }) : null;
			const data = {
				accounts: acct?.data.accounts.map((account) => convertAccount(account)) ?? [],
				statuses: stat?.data.statuses.map((status) => convertStatus(status)) ?? [],
				hashtags: tags?.data.hashtags ?? [],
			};
			return data;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async getStatusTrends() {
		try {
			const data = await getHighlight(
				this.BASE_URL,
				this.request.hostname,
				this.request.headers.authorization,
			);
			return data.map((status) => convertStatus(status));
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async getSuggestions() {
		try {
			const data = await getFeaturedUser(
				this.BASE_URL,
				this.request.hostname,
				this.request.headers.authorization,
				(this.request.query as any).limit || 20,
			);
			return data.map((suggestion) => { suggestion.account = convertAccount(suggestion.account); return suggestion; });
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}
}
