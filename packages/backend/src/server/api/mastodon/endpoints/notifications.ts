import type { MegalodonInterface } from 'megalodon';
import type { FastifyRequest } from 'fastify';
import { convertTimelinesArgsId } from './timeline.js';
import { IdConvertType as IdType, convertId, convertNotification } from '../converters.js';

function toLimitToInt(q: any) {
    if (q.limit) if (typeof q.limit === 'string') q.limit = parseInt(q.limit, 10);
    return q;
}

export class apiNotifyMastodon {
    private request: FastifyRequest;
    private client: MegalodonInterface;

    constructor(request: FastifyRequest, client: MegalodonInterface) {
        this.request = request;
        this.client = client;
    }

    public async getNotifications() {
        try {
			const data = await this.client.getNotifications( convertTimelinesArgsId(toLimitToInt(this.request.query)) );
            const notifs = data.data;
            const processed = notifs.map((n) => {
                n = convertNotification(n);
                if (n.type !== 'follow' && n.type !== 'follow_request') {
                    if (n.type === 'reaction') n.type = 'favourite';
                    return n;
                } else {
                    return n;
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
			const data = await this.client.getNotification( convertId((this.request.params as any).id, IdType.SharkeyId) );
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
			const data = await this.client.dismissNotification( convertId((this.request.params as any).id, IdType.SharkeyId) );
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