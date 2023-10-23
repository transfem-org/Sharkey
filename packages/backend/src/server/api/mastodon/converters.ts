import type { Config } from '@/config.js';
import { MfmService } from '@/core/MfmService.js';
import { DI } from '@/di-symbols.js';
import { Inject } from '@nestjs/common';
import { Entity } from 'megalodon';
import { parse } from 'mfm-js';
import { GetterService } from '../GetterService.js';
import type { IMentionedRemoteUsers } from '@/models/Note.js';
import type { MiUser } from '@/models/User.js';
import type { NoteEditRepository, NotesRepository, UsersRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';

const CHAR_COLLECTION = '0123456789abcdefghijklmnopqrstuvwxyz';

export enum IdConvertType {
    MastodonId,
    SharkeyId,
}

export const escapeMFM = (text: string): string => text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#x60;")
    .replace(/\r?\n/g, "<br>");

export class MastoConverters {
	private MfmService: MfmService;
	private GetterService: GetterService;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.noteEditRepository)
		private noteEditRepository: NoteEditRepository,
		
		private userEntityService: UserEntityService
	) {
		this.MfmService = new MfmService(this.config);
		this.GetterService = new GetterService(this.usersRepository, this.notesRepository, this.noteEditRepository, this.userEntityService);
	}

	private encode(u: MiUser, m: IMentionedRemoteUsers): MastodonEntity.Mention {
		let acct = u.username;
		let acctUrl = `https://${u.host || this.config.host}/@${u.username}`;
		let url: string | null = null;
		if (u.host) {
			const info = m.find(r => r.username === u.username && r.host === u.host);
			acct = `${u.username}@${u.host}`;
			acctUrl = `https://${u.host}/@${u.username}`;
			if (info) url = info.url ?? info.uri;
		}
		return {
			id: u.id,
			username: u.username,
			acct: acct,
			url: url ?? acctUrl,
		};
	}

	public async getUser(id: string): Promise<MiUser> {
		return this.GetterService.getUser(id).then(p => {
			return p;
		});
	}

	public async convertStatus(status: Entity.Status) {
		status.account = convertAccount(status.account);
		const note = await this.GetterService.getNote(status.id);
		status.id = convertId(status.id, IdConvertType.MastodonId);
		if (status.in_reply_to_account_id) status.in_reply_to_account_id = convertId(
			status.in_reply_to_account_id,
			IdConvertType.MastodonId,
		);
		if (status.in_reply_to_id) status.in_reply_to_id = convertId(status.in_reply_to_id, IdConvertType.MastodonId);
		status.media_attachments = status.media_attachments.map((attachment) =>
			convertAttachment(attachment),
		);
		// This will eventually be improved with a rewrite of this file
		const mentions = Promise.all(note.mentions.map(p =>
			this.getUser(p)
				.then(u => this.encode(u, JSON.parse(note.mentionedRemoteUsers)))
				.catch(() => null)))
			.then(p => p.filter(m => m)) as Promise<MastodonEntity.Mention[]>;
		status.mentions = await mentions;
		status.mentions = status.mentions.map((mention) => ({
			...mention,
			id: convertId(mention.id, IdConvertType.MastodonId),
		}));
		const convertedMFM = this.MfmService.toHtml(parse(status.content), JSON.parse(note.mentionedRemoteUsers));
		status.content = status.content ? convertedMFM?.replace(/&amp;/g, "&").replaceAll(`<span>&</span><a href="${this.config.url}/tags/39;" rel="tag">#39;</a>`, "<span>\'</span>") as string : status.content;
		if (status.poll) status.poll = convertPoll(status.poll);
		if (status.reblog) status.reblog = convertStatus(status.reblog);
	
		return status;
	}
}

export function convertId(in_id: string, id_convert_type: IdConvertType): string {
	switch (id_convert_type) {
		case IdConvertType.MastodonId: {
			let out = BigInt(0);
			const lowerCaseId = in_id.toLowerCase();
			for (let i = 0; i < lowerCaseId.length; i++) {
				const charValue = numFromChar(lowerCaseId.charAt(i));
				out += BigInt(charValue) * BigInt(36) ** BigInt(i);
			}
			return out.toString();
		}
    
		case IdConvertType.SharkeyId: {
			let input = BigInt(in_id);
			let outStr = '';
			while (input > BigInt(0)) {
				const remainder = Number(input % BigInt(36));
				outStr = charFromNum(remainder) + outStr;
				input /= BigInt(36);
			}
			const ReversedoutStr = outStr.split('').reduce((acc, char) => char + acc, '');
			return ReversedoutStr;
		}
    
		default:
			throw new Error('Invalid ID conversion type');
	}
}

function numFromChar(character: string): number {
	for (let i = 0; i < CHAR_COLLECTION.length; i++) {
		if (CHAR_COLLECTION.charAt(i) === character) {
			return i;
		}
	}

	throw new Error('Invalid character in parsed base36 id');
}

function charFromNum(number: number): string {
	if (number >= 0 && number < CHAR_COLLECTION.length) {
		return CHAR_COLLECTION.charAt(number);
	} else {
		throw new Error('Invalid number for base-36 encoding');
	}
}

function simpleConvert(data: any) {
	// copy the object to bypass weird pass by reference bugs
	const result = Object.assign({}, data);
	result.id = convertId(data.id, IdConvertType.MastodonId);
	return result;
}

export function convertAccount(account: Entity.Account) {
	return simpleConvert(account);
}
export function convertAnnouncement(announcement: Entity.Announcement) {
	return simpleConvert(announcement);
}
export function convertAttachment(attachment: Entity.Attachment) {
	return simpleConvert(attachment);
}
export function convertFilter(filter: Entity.Filter) {
	return simpleConvert(filter);
}
export function convertList(list: Entity.List) {
	return simpleConvert(list);
}
export function convertFeaturedTag(tag: Entity.FeaturedTag) {
	return simpleConvert(tag);
}

export function convertNotification(notification: Entity.Notification) {
	notification.account = convertAccount(notification.account);
	notification.id = convertId(notification.id, IdConvertType.MastodonId);
	if (notification.status) notification.status = convertStatus(notification.status);
	return notification;
}

export function convertPoll(poll: Entity.Poll) {
	return simpleConvert(poll);
}
export function convertReaction(reaction: Entity.Reaction) {
	if (reaction.accounts) {
		reaction.accounts = reaction.accounts.map(convertAccount);
	}
	return reaction;
}
export function convertRelationship(relationship: Entity.Relationship) {
	return simpleConvert(relationship);
}

export function convertStatus(status: Entity.Status) {
	status.account = convertAccount(status.account);
	status.id = convertId(status.id, IdConvertType.MastodonId);
	if (status.in_reply_to_account_id) status.in_reply_to_account_id = convertId(
		status.in_reply_to_account_id,
		IdConvertType.MastodonId,
	);
	if (status.in_reply_to_id) status.in_reply_to_id = convertId(status.in_reply_to_id, IdConvertType.MastodonId);
	status.media_attachments = status.media_attachments.map((attachment) =>
		convertAttachment(attachment),
	);
	status.mentions = status.mentions.map((mention) => ({
		...mention,
		id: convertId(mention.id, IdConvertType.MastodonId),
	}));
	if (status.poll) status.poll = convertPoll(status.poll);
	if (status.reblog) status.reblog = convertStatus(status.reblog);

	return status;
}

export function convertStatusSource(status: Entity.StatusSource) {
	return simpleConvert(status);
}

export function convertConversation(conversation: Entity.Conversation) {
	conversation.id = convertId(conversation.id, IdConvertType.MastodonId);
	conversation.accounts = conversation.accounts.map(convertAccount);
	if (conversation.last_status) {
		conversation.last_status = convertStatus(conversation.last_status);
	}

	return conversation;
}
