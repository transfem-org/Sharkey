import type { MegalodonInterface } from 'megalodon';
import type { FastifyRequest } from 'fastify';
import { argsToBools, convertTimelinesArgsId, limitToInt } from './timeline.js';
import { convertId, IdConvertType as IdType, convertAccount, convertRelationship, convertStatus } from '../converters.js';

const relationshipModel = {
	id: '',
	following: false,
	followed_by: false,
	delivery_following: false,
	blocking: false,
	blocked_by: false,
	muting: false,
	muting_notifications: false,
	requested: false,
	domain_blocking: false,
	showing_reblogs: false,
	endorsed: false,
	notifying: false,
	note: '',
};

export class apiAccountMastodon {
    private request: FastifyRequest;
    private client: MegalodonInterface;
    private BASE_URL: string;

    constructor(request: FastifyRequest, client: MegalodonInterface, BASE_URL: string) {
        this.request = request;
        this.client = client;
        this.BASE_URL = BASE_URL;
    }

    public async verifyCredentials() {
        try {
			const data = await this.client.verifyAccountCredentials();
			let acct = data.data;
			acct.id = convertId(acct.id, IdType.MastodonId);
			acct.display_name = acct.display_name || acct.username;
			acct.url = `${this.BASE_URL}/@${acct.url}`;
			acct.note = acct.note || '';
			acct.avatar_static = acct.avatar;
			acct.header = acct.header || '/static-assets/transparent.png';
			acct.header_static = acct.header || '/static-assets/transparent.png';
			acct.source = {
				note: acct.note,
				fields: acct.fields,
				privacy: '',
				sensitive: false,
				language: '',
			};
			console.log(acct);
			return acct;
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
    }

    public async updateCredentials() {
        try {
            const data = await this.client.updateCredentials(this.request.body as any);
            return convertAccount(data.data);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async lookup() {
        try {
            const data = await this.client.search((this.request.query as any).acct, { type: 'accounts' });
            return convertAccount(data.data.accounts[0]);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getRelationships(users: [string]) {
        try {
            relationshipModel.id = users?.toString() || '1';

			if (!users) {
				return [relationshipModel];
			}

			let reqIds = [];
			for (let i = 0; i < users.length; i++) {
				reqIds.push(convertId(users[i], IdType.SharkeyId));
			}

			const data = await this.client.getRelationships(reqIds);
			return data.data.map((relationship) => convertRelationship(relationship));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getStatuses() {
        try {
            const data = await this.client.getAccountStatuses(
                convertId((this.request.params as any).id, IdType.SharkeyId), 
                convertTimelinesArgsId(argsToBools(limitToInt(this.request.query as any)))
            );
			return data.data.map((status) => convertStatus(status));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getFollowers() {
        try {
            const data = await this.client.getAccountFollowers(
                convertId((this.request.params as any).id, IdType.SharkeyId), 
                convertTimelinesArgsId(limitToInt(this.request.query as any))
            );
			return data.data.map((account) => convertAccount(account));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getFollowing() {
        try {
            const data = await this.client.getAccountFollowing(
                convertId((this.request.params as any).id, IdType.SharkeyId), 
                convertTimelinesArgsId(limitToInt(this.request.query as any))
            );
			return data.data.map((account) => convertAccount(account));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async addFollow() {
        try {
            const data = await this.client.followAccount( convertId((this.request.params as any).id, IdType.SharkeyId) );
            let acct = convertRelationship(data.data);
            acct.following = true;
			return acct;
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async rmFollow() {
        try {
            const data = await this.client.unfollowAccount( convertId((this.request.params as any).id, IdType.SharkeyId) );
            let acct = convertRelationship(data.data);
            acct.following = false;
			return acct;
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async addBlock() {
        try {
            const data = await this.client.blockAccount( convertId((this.request.params as any).id, IdType.SharkeyId) );
			return convertRelationship(data.data);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async rmBlock() {
        try {
            const data = await this.client.unblockAccount( convertId((this.request.params as any).id, IdType.SharkeyId) );
			return convertRelationship(data.data);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async addMute() {
        try {
            const data = await this.client.muteAccount(
                convertId((this.request.params as any).id, IdType.SharkeyId),
                this.request.body as any
            );
			return convertRelationship(data.data);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async rmMute() {
        try {
            const data = await this.client.unmuteAccount( convertId((this.request.params as any).id, IdType.SharkeyId) );
			return convertRelationship(data.data);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getBookmarks() {
        try {
            const data = await this.client.getBookmarks( convertTimelinesArgsId(limitToInt(this.request.query as any)) );
			return data.data.map((status) => convertStatus(status));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getFavourites() {
        try {
            const data = await this.client.getFavourites( convertTimelinesArgsId(limitToInt(this.request.query as any)) );
			return data.data.map((status) => convertStatus(status));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getMutes() {
        try {
            const data = await this.client.getMutes( convertTimelinesArgsId(limitToInt(this.request.query as any)) );
			return data.data.map((account) => convertAccount(account));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getBlocks() {
        try {
            const data = await this.client.getBlocks( convertTimelinesArgsId(limitToInt(this.request.query as any)) );
			return data.data.map((account) => convertAccount(account));
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async acceptFollow() {
        try {
            const data = await this.client.acceptFollowRequest( convertId((this.request.params as any).id, IdType.SharkeyId) );
			return convertRelationship(data.data);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async rejectFollow() {
        try {
            const data = await this.client.rejectFollowRequest( convertId((this.request.params as any).id, IdType.SharkeyId) );
			return convertRelationship(data.data);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }
}