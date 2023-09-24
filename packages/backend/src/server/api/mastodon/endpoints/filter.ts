import { IdConvertType as IdType, convertId, convertFilter } from '../converters.js';
import type { MegalodonInterface } from 'megalodon';
import type { FastifyRequest } from 'fastify';

export class ApiFilterMastodon {
	private request: FastifyRequest;
	private client: MegalodonInterface;

	constructor(request: FastifyRequest, client: MegalodonInterface) {
		this.request = request;
		this.client = client;
	}

	public async getFilters() {
		try {
			const data = await this.client.getFilters();
			return data.data.map((filter) => convertFilter(filter));
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async getFilter() {
		try {
			const data = await this.client.getFilter( convertId((this.request.params as any).id, IdType.SharkeyId) );
			return convertFilter(data.data);
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async createFilter() {
		try {
			const body: any = this.request.body;
			const data = await this.client.createFilter(body.pharse, body.context, body);
			return convertFilter(data.data);
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async updateFilter() {
		try {
			const body: any = this.request.body;
			const data = await this.client.updateFilter(convertId((this.request.params as any).id, IdType.SharkeyId), body.pharse, body.context);
			return convertFilter(data.data);
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async rmFilter() {
		try {
			const data = await this.client.deleteFilter( convertId((this.request.params as any).id, IdType.SharkeyId) );
			return data.data;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}
}
