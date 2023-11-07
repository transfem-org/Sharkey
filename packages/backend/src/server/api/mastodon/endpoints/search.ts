import { MastoConverters } from '../converters.js';
import { limitToInt } from './timeline.js';
import type { MegalodonInterface } from 'megalodon';
import type { FastifyRequest } from 'fastify';

export class ApiSearchMastodon {
	private request: FastifyRequest;
	private client: MegalodonInterface;
	private BASE_URL: string;

	constructor(request: FastifyRequest, client: MegalodonInterface, BASE_URL: string, private mastoConverter: MastoConverters) {
		this.request = request;
		this.client = client;
		this.BASE_URL = BASE_URL;
	}

	public async SearchV1() {
		try {
			const query: any = limitToInt(this.request.query as any);
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
			const query: any = limitToInt(this.request.query as any);
			const type = query.type;
			const acct = !type || type === 'accounts' ? await this.client.search(query.q, { type: 'accounts', ...query }) : null;
			const stat = !type || type === 'statuses' ? await this.client.search(query.q, { type: 'statuses', ...query }) : null;
			const tags = !type || type === 'hashtags' ? await this.client.search(query.q, { type: 'hashtags', ...query }) : null;
			const data = {
				accounts: await Promise.all(acct?.data.accounts.map(async (account: any) => await this.mastoConverter.convertAccount(account)) ?? []),
				statuses: await Promise.all(stat?.data.statuses.map(async (status: any) => await this.mastoConverter.convertStatus(status)) ?? []),
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
			const data = await fetch(`${this.BASE_URL}/api/notes/featured`,
				{
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({}),
				})
				.then(res => res.json())
				.then(data => data.map((status: any) => this.mastoConverter.convertStatus(status)));
			return data;
		} catch (e: any) {
			console.error(e);
			return [];
		}
	}

	public async getSuggestions() {
		try {
			const data = await fetch(`${this.BASE_URL}/api/users`,
				{
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ i: this.request.headers.authorization?.replace('Bearer ', ''), limit: parseInt((this.request.query as any).limit) || 20, origin: 'local', sort: '+follower', state: 'alive' }),
				}).then((res) => res.json()).then(data => data.map(((entry: any) => { return { source: 'global', account: entry }; })));
			return Promise.all(data.map(async (suggestion: any) => { suggestion.account = await this.mastoConverter.convertAccount(suggestion.account); return suggestion; }));
		} catch (e: any) {
			console.error(e);
			return [];
		}
	}
}
