import { FindOptionsWhere, IsNull } from "typeorm";
import type { MegalodonInterface } from "megalodon";
import type { FastifyRequest } from 'fastify';
import { argsToBools, convertTimelinesArgsId, limitToInt } from "./timeline.js";
import { convertId, IdConvertType as IdType, convertAccount, convertFeaturedTag, convertList, convertRelationship, convertStatus } from '../converters.js';

const relationshipModel = {
	id: "",
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
	note: "",
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
			acct.note = acct.note || "";
			acct.avatar_static = acct.avatar;
			acct.header = acct.header || "/static-assets/transparent.png";
			acct.header_static = acct.header || "/static-assets/transparent.png";
			acct.source = {
				note: acct.note,
				fields: acct.fields,
				privacy: "",
				sensitive: false,
				language: "",
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
            const data = await this.client.search((this.request.query as any).acct, { type: "accounts" });
            return convertAccount(data.data.accounts[0]);
        } catch (e: any) {
            console.error(e);
			console.error(e.response.data);
            return e.response.data;
        }
    }

    public async getRelationships(users: [string]) {
        try {
            relationshipModel.id = users?.toString() || "1";

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
}