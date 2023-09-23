/// <reference path="emoji.ts" />

namespace MisskeyEntity {
	export type Meta = {
		maintainerName: string;
		maintainerEmail: string;
		name: string;
		version: string;
		uri: string;
		description: string;
		langs: Array<string>;
		disableRegistration: boolean;
		disableLocalTimeline: boolean;
		bannerUrl: string;
		maxNoteTextLength: 3000;
		emojis: Array<Emoji>;
	};
}
