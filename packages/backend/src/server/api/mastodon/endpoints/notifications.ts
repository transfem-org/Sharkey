import { convertNotification } from '../converters.js';
import type { MegalodonInterface, Entity } from 'megalodon';
import type { FastifyRequest } from 'fastify';

function toLimitToInt(q: any) {
	if (q.limit) if (typeof q.limit === 'string') q.limit = parseInt(q.limit, 10);
	return q;
}

export class ApiNotifyMastodon {
	private request: FastifyRequest;
	private client: MegalodonInterface;

	constructor(request: FastifyRequest, client: MegalodonInterface) {
		this.request = request;
		this.client = client;
	}

	public async getNotifications() {
		try {
			const data = await this.client.getNotifications( toLimitToInt(this.request.query) );
			const notifs = data.data;
			const processed = notifs.map((n: Entity.Notification) => {
				const convertedn = convertNotification(n);
				if (convertedn.type !== 'follow' && convertedn.type !== 'follow_request') {
					if (convertedn.type === 'reaction') convertedn.type = 'favourite';
					return convertedn;
				} else {
					return convertedn;
				}
			});
			return processed;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async getNotification() {
		try {
			const data = await this.client.getNotification( (this.request.params as any).id );
			const notif = convertNotification(data.data);
			if (notif.type !== 'follow' && notif.type !== 'follow_request' && notif.type === 'reaction') notif.type = 'favourite';
			return notif;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async rmNotification() {
		try {
			const data = await this.client.dismissNotification( (this.request.params as any).id );
			return data.data;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}

	public async rmNotifications() {
		try {
			const data = await this.client.dismissNotifications();
			return data.data;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
	}
}
