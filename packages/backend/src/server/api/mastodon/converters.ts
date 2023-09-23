import { Entity } from "megalodon";

const CHAR_COLLECTION: string = "0123456789abcdefghijklmnopqrstuvwxyz";

export enum IdConvertType {
    MastodonId,
    SharkeyId,
}

export function convertId(in_id: string, id_convert_type: IdConvertType): string {
    switch (id_convert_type) {
        case IdConvertType.MastodonId:
          let out: bigint = BigInt(0);
          const lowerCaseId = in_id.toLowerCase();
          for (let i = 0; i < lowerCaseId.length; i++) {
            const charValue = numFromChar(lowerCaseId.charAt(i));
            out += BigInt(charValue) * BigInt(36) ** BigInt(i);
          }
          return out.toString();
    
        case IdConvertType.SharkeyId:
          let input: bigint = BigInt(in_id);
          let outStr = '';
          while (input > BigInt(0)) {
            const remainder = Number(input % BigInt(36));
            outStr = charFromNum(remainder) + outStr;
            input /= BigInt(36);
          }
		  let ReversedoutStr = outStr.split("").reduce((acc, char) => char + acc, "");
          return ReversedoutStr;
    
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
	if (notification.status)
		notification.status = convertStatus(notification.status);
	if (notification.reaction)
		notification.reaction = convertReaction(notification.reaction);
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
	if (status.in_reply_to_account_id)
		status.in_reply_to_account_id = convertId(
			status.in_reply_to_account_id,
			IdConvertType.MastodonId,
		);
	if (status.in_reply_to_id)
		status.in_reply_to_id = convertId(status.in_reply_to_id, IdConvertType.MastodonId);
	status.media_attachments = status.media_attachments.map((attachment) =>
		convertAttachment(attachment),
	);
	status.mentions = status.mentions.map((mention) => ({
		...mention,
		id: convertId(mention.id, IdConvertType.MastodonId),
	}));
	if (status.poll) status.poll = convertPoll(status.poll);
	if (status.reblog) status.reblog = convertStatus(status.reblog);
	if (status.quote) status.quote = convertStatus(status.quote);
	status.reactions = status.reactions.map(convertReaction);

	return status;
}

export function convertConversation(conversation: Entity.Conversation) {
	conversation.id = convertId(conversation.id, IdConvertType.MastodonId);
	conversation.accounts = conversation.accounts.map(convertAccount);
	if (conversation.last_status) {
		conversation.last_status = convertStatus(conversation.last_status);
	}

	return conversation;
}
