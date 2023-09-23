/// <reference path="account.ts" />
/// <reference path="application.ts" />
/// <reference path="mention.ts" />
/// <reference path="tag.ts" />
/// <reference path="attachment.ts" />
/// <reference path="emoji.ts" />
/// <reference path="card.ts" />
/// <reference path="poll.ts" />
/// <reference path="reaction.ts" />

namespace Entity {
	export type StatusEdit = {
		account: Account;
		content: string;
		plain_content: string | null;
		created_at: string;
		emojis: Emoji[];
		sensitive: boolean;
		spoiler_text: string;
		media_attachments: Array<Attachment>;
		poll: Poll | null;
	};
}
