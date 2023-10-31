import { MastoConverters, convertRelationship } from '../converters.js';
import { argsToBools, limitToInt } from './timeline.js';
import type { MegalodonInterface } from 'megalodon';
import type { FastifyRequest } from 'fastify';
import { NoteEditRepository, NotesRepository, UsersRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import type { Config } from '@/config.js';
import { Injectable } from '@nestjs/common';

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

@Injectable()
export class ApiAccountMastodon {
	private request: FastifyRequest;
	private client: MegalodonInterface;
	private BASE_URL: string;

	constructor(request: FastifyRequest, client: MegalodonInterface, BASE_URL: string, private mastoconverter: MastoConverters) {
		this.request = request;
		this.client = client;
		this.BASE_URL = BASE_URL;
	}

	public async verifyCredentials() {
		try {
			const data = await this.client.verifyAccountCredentials();
			const acct = await this.mastoconverter.convertAccount(data.data);
			const newAcct = Object.assign({}, acct, {
				source: {
					note: acct.note,
					fields: acct.fields,
					privacy: '',
					sensitive: false,
					language: '',
				},
			});
			return newAcct;
		} catch (e: any) {
			/* console.error(e);
			console.error(e.response.data); */
			return e.response;
		}
	}

	public async lookup() {
		try {
			const data = await this.client.search((this.request.query as any).acct, { type: 'accounts' });
			return this.mastoconverter.convertAccount(data.data.accounts[0]);
		} catch (e: any) {
			/* console.error(e)
			console.error(e.response.data); */
			return e.response;
		}
	}

	public async getRelationships(users: [string]) {
		try {
			relationshipModel.id = users.toString() || '1';

			if (!(users.length > 0)) {
				return [relationshipModel];
			}

			const reqIds = [];
			for (let i = 0; i < users.length; i++) {
				reqIds.push(users[i]);
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
			const data = await this.client.getAccountStatuses((this.request.params as any).id, argsToBools(limitToInt(this.request.query as any)));
			return await Promise.all(data.data.map(async (status) => await this.mastoconverter.convertStatus(status)));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async getFollowers() {
		try {
			const data = await this.client.getAccountFollowers(
				(this.request.params as any).id, 
				limitToInt(this.request.query as any),
			);
			return await Promise.all(data.data.map(async (account) => await this.mastoconverter.convertAccount(account)));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async getFollowing() {
		try {
			const data = await this.client.getAccountFollowing(
				(this.request.params as any).id, 
				limitToInt(this.request.query as any),
			);
			return await Promise.all(data.data.map(async (account) => await this.mastoconverter.convertAccount(account)));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async addFollow() {
		try {
			const data = await this.client.followAccount( (this.request.params as any).id );
			const acct = convertRelationship(data.data);
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
			const data = await this.client.unfollowAccount( (this.request.params as any).id );
			const acct = convertRelationship(data.data);
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
			const data = await this.client.blockAccount( (this.request.params as any).id );
			return convertRelationship(data.data);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async rmBlock() {
		try {
			const data = await this.client.unblockAccount( (this.request.params as any).id );
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
				(this.request.params as any).id,
                this.request.body as any,
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
			const data = await this.client.unmuteAccount( (this.request.params as any).id );
			return convertRelationship(data.data);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async getBookmarks() {
		try {
			const data = await this.client.getBookmarks( limitToInt(this.request.query as any) );
			return data.data.map((status) => this.mastoconverter.convertStatus(status));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async getFavourites() {
		try {
			const data = await this.client.getFavourites( limitToInt(this.request.query as any) );
			return data.data.map((status) => this.mastoconverter.convertStatus(status));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async getMutes() {
		try {
			const data = await this.client.getMutes( limitToInt(this.request.query as any) );
			return data.data.map((account) => this.mastoconverter.convertAccount(account));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async getBlocks() {
		try {
			const data = await this.client.getBlocks( limitToInt(this.request.query as any) );
			return data.data.map((account) => this.mastoconverter.convertAccount(account));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async acceptFollow() {
		try {
			const data = await this.client.acceptFollowRequest( (this.request.params as any).id );
			return convertRelationship(data.data);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}

	public async rejectFollow() {
		try {
			const data = await this.client.rejectFollowRequest( (this.request.params as any).id );
			return convertRelationship(data.data);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			return e.response.data;
		}
	}
}
