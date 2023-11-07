<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	v-if="!muted"
	v-show="!isDeleted"
	ref="el"
	v-hotkey="keymap"
	:class="$style.root"
>
	<div v-if="appearNote.reply && appearNote.reply.replyId">
		<div v-if="!conversationLoaded" style="padding: 16px">
			<MkButton style="margin: 0 auto;" primary rounded @click="loadConversation">{{ i18n.ts.loadConversation }}</MkButton>
		</div>
		<MkNoteSub v-for="note in conversation" :key="note.id" :class="$style.replyToMore" :note="note" :expandAllCws="props.expandAllCws"/>
	</div>
	<MkNoteSub v-if="appearNote.reply" :note="appearNote.reply" :class="$style.replyTo" :expandAllCws="props.expandAllCws"/>
	<div v-if="isRenote" :class="$style.renote">
		<MkAvatar :class="$style.renoteAvatar" :user="note.user" link preview/>
		<i class="ph-rocket-launch ph-bold ph-lg" style="margin-right: 4px;"></i>
		<span :class="$style.renoteText">
			<I18n :src="i18n.ts.renotedBy" tag="span">
				<template #user>
					<MkA v-user-preview="note.userId" :class="$style.renoteName" :to="userPage(note.user)">
						<MkUserName :user="note.user"/>
					</MkA>
				</template>
			</I18n>
		</span>
		<div :class="$style.renoteInfo">
			<button ref="renoteTime" class="_button" :class="$style.renoteTime" @click="showRenoteMenu()">
				<i v-if="isMyRenote" class="ph-dots-three ph-bold ph-lg" style="margin-right: 4px;"></i>
				<MkTime :time="note.createdAt"/>
			</button>
			<span v-if="note.visibility !== 'public'" style="margin-left: 0.5em;" :title="i18n.ts._visibility[note.visibility]">
				<i v-if="note.visibility === 'home'" class="ph-house ph-bold ph-lg"></i>
				<i v-else-if="note.visibility === 'followers'" class="ph-lock ph-bold ph-lg"></i>
				<i v-else-if="note.visibility === 'specified'" ref="specified" class="ph-envelope ph-bold ph-lg"></i>
			</span>
			<span v-if="note.localOnly" style="margin-left: 0.5em;" :title="i18n.ts._visibility['disableFederation']"><i class="ph-rocket ph-bold ph-lg"></i></span>
		</div>
	</div>
	<article :class="$style.note" @contextmenu.stop="onContextmenu">
		<header :class="$style.noteHeader">
			<MkAvatar :class="$style.noteHeaderAvatar" :user="appearNote.user" indicator link preview/>
			<div :class="$style.noteHeaderBody">
				<div>
					<MkA v-user-preview="appearNote.user.id" :class="$style.noteHeaderName" :to="userPage(appearNote.user)">
						<MkUserName :nowrap="false" :user="appearNote.user"/>
					</MkA>
					<span v-if="appearNote.user.isBot" :class="$style.isBot">bot</span>
					<div :class="$style.noteHeaderInfo">
						<span v-if="appearNote.visibility !== 'public'" style="margin-left: 0.5em;" :title="i18n.ts._visibility[appearNote.visibility]">
							<i v-if="appearNote.visibility === 'home'" class="ph-house ph-bold ph-lg"></i>
							<i v-else-if="appearNote.visibility === 'followers'" class="ph-lock ph-bold ph-lg"></i>
							<i v-else-if="appearNote.visibility === 'specified'" ref="specified" class="ph-envelope ph-bold ph-lg"></i>
						</span>
						<span v-if="appearNote.updatedAt" ref="menuVersionsButton" style="margin-left: 0.5em;" title="Edited" @mousedown="menuVersions()"><i class="ph-pencil ph-bold ph-lg"></i></span>
						<span v-if="appearNote.localOnly" style="margin-left: 0.5em;" :title="i18n.ts._visibility['disableFederation']"><i class="ph-rocket ph-bold ph-lg"></i></span>
					</div>
				</div>
				<div :class="$style.noteHeaderUsername"><MkAcct :user="appearNote.user"/></div>
				<MkInstanceTicker v-if="showTicker" :instance="appearNote.user.instance"/>
			</div>
		</header>
		<div :class="$style.noteContent">
			<p v-if="appearNote.cw != null" :class="$style.cw">
				<Mfm v-if="appearNote.cw != ''" style="margin-right: 8px;" :text="appearNote.cw" :author="appearNote.user" :nyaize="'account'"/>
				<MkCwButton v-model="showContent" :note="appearNote"/>
			</p>
			<div v-show="appearNote.cw == null || showContent">
				<span v-if="appearNote.isHidden" style="opacity: 0.5">({{ i18n.ts.private }})</span>
				<MkA v-if="appearNote.replyId" :class="$style.noteReplyTarget" :to="`/notes/${appearNote.replyId}`"><i class="ph-arrow-bend-left-up ph-bold ph-lg"></i></MkA>
				<Mfm
					v-if="appearNote.text"
					:parsedNodes="parsed"
					:text="appearNote.text"
					:author="appearNote.user"
					:nyaize="'account'"
					:emojiUrls="appearNote.emojis"
					:enableEmojiMenu="true"
					:enableEmojiMenuReaction="true"
					:isAnim="allowAnim"
				/>
				<a v-if="appearNote.renote != null" :class="$style.rn">RN:</a>
				<div v-if="translating || translation" :class="$style.translation">
					<MkLoading v-if="translating" mini/>
					<div v-else>
						<b>{{ i18n.t('translatedFrom', { x: translation.sourceLang }) }}: </b>
						<Mfm :text="translation.text" :author="appearNote.user" :nyaize="'account'" :emojiUrls="appearNote.emojis"/>
					</div>
				</div>
				<MkButton v-if="!allowAnim && animated" :class="$style.playMFMButton" :small="true" @click="animatedMFM()" v-on:click.stop><i class="ph-play ph-bold ph-lg "></i> {{ i18n.ts._animatedMFM.play }}</MkButton>
				<MkButton v-else-if="!defaultStore.state.animatedMfm && allowAnim && animated" :class="$style.playMFMButton" :small="true" @click="animatedMFM()" v-on:click.stop><i class="ph-stop ph-bold ph-lg "></i> {{ i18n.ts._animatedMFM.stop }}</MkButton>
				<div v-if="appearNote.files.length > 0">
					<MkMediaList :mediaList="appearNote.files"/>
				</div>
				<MkPoll v-if="appearNote.poll" ref="pollViewer" :note="appearNote" :class="$style.poll"/>
				<MkUrlPreview v-for="url in urls" :key="url" :url="url" :compact="true" :detail="true" style="margin-top: 6px;"/>
				<div v-if="appearNote.renote" :class="$style.quote"><MkNoteSimple :note="appearNote.renote" :class="$style.quoteNote" :expandAllCws="props.expandAllCws"/></div>
			</div>
			<MkA v-if="appearNote.channel && !inChannel" :class="$style.channel" :to="`/channels/${appearNote.channel.id}`"><i class="ph-television ph-bold ph-lg"></i> {{ appearNote.channel.name }}</MkA>
		</div>
		<footer :class="$style.footer">
			<div :class="$style.noteFooterInfo">
				<div v-if="appearNote.updatedAt">
					{{ i18n.ts.edited }}: <MkTime :time="appearNote.updatedAt" mode="detail"/>
				</div>
				<MkA :to="notePage(appearNote)">
					<MkTime :time="appearNote.createdAt" mode="detail" colored/>
				</MkA>
			</div>
			<MkReactionsViewer ref="reactionsViewer" :note="appearNote"/>
			<button class="_button" :class="$style.noteFooterButton" @click="reply()">
				<i class="ph-arrow-u-up-left ph-bold ph-lg"></i>
				<p v-if="appearNote.repliesCount > 0" :class="$style.noteFooterButtonCount">{{ appearNote.repliesCount }}</p>
			</button>
			<button
				v-if="canRenote"
				ref="renoteButton"
				class="_button"
				:class="$style.noteFooterButton"
				:style="renoted ? 'color: var(--accent) !important;' : ''"
				@mousedown="renoted ? undoRenote() : renote()"
			>
				<i class="ph-rocket-launch ph-bold ph-lg"></i>
				<p v-if="appearNote.renoteCount > 0" :class="$style.noteFooterButtonCount">{{ appearNote.renoteCount }}</p>
			</button>
			<button v-else class="_button" :class="$style.noteFooterButton" disabled>
				<i class="ph-prohibit ph-bold ph-lg"></i>
			</button>
			<button
				v-if="canRenote"
				ref="quoteButton"
				class="_button"
				:class="$style.noteFooterButton"
				:style="quoted ? 'color: var(--accent) !important;' : ''"
				@mousedown="quoted ? undoQuote() : quote()"
			>
				<i class="ph-quotes ph-bold ph-lg"></i>
			</button>
			<button v-if="appearNote.myReaction == null && appearNote.reactionAcceptance !== 'likeOnly'" ref="likeButton" :class="$style.noteFooterButton" class="_button" @mousedown="like()">
				<i class="ph-heart ph-bold ph-lg"></i>
			</button>
			<button v-if="appearNote.myReaction == null" ref="reactButton" :class="$style.noteFooterButton" class="_button" @mousedown="react()">
				<i v-if="appearNote.reactionAcceptance === 'likeOnly'" class="ph-heart ph-bold ph-lg"></i>
				<i v-else class="ph-smiley ph-bold ph-lg"></i>
			</button>
			<button v-if="appearNote.myReaction != null" ref="reactButton" class="_button" :class="[$style.noteFooterButton, $style.reacted]" @click="undoReact(appearNote)">
				<i class="ph-minus ph-bold ph-lg"></i>
			</button>
			<button v-if="defaultStore.state.showClipButtonInNoteFooter" ref="clipButton" class="_button" :class="$style.noteFooterButton" @mousedown="clip()">
				<i class="ph-paperclip ph-bold ph-lg"></i>
			</button>
			<button ref="menuButton" class="_button" :class="$style.noteFooterButton" @mousedown="menu()">
				<i class="ph-dots-three ph-bold ph-lg"></i>
			</button>
		</footer>
	</article>
	<div :class="$style.tabs">
		<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'replies' }]" @click="tab = 'replies'"><i class="ph-arrow-u-up-left ph-bold ph-lg"></i> {{ i18n.ts.replies }}</button>
		<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'renotes' }]" @click="tab = 'renotes'"><i class="ph-rocket-launch ph-bold ph-lg"></i> {{ i18n.ts.renotes }}</button>
		<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'quotes' }]" @click="tab = 'quotes'"><i class="ph-quotes ph-bold ph-lg"></i> {{ i18n.ts._notification._types.quote }}</button>
		<button class="_button" :class="[$style.tab, { [$style.tabActive]: tab === 'reactions' }]" @click="tab = 'reactions'"><i class="ph-smiley ph-bold ph-lg"></i> {{ i18n.ts.reactions }}</button>
	</div>
	<div>
		<div v-if="tab === 'replies'" :class="$style.tab_replies">
			<div v-if="!repliesLoaded" style="padding: 16px">
				<MkButton style="margin: 0 auto;" primary rounded @click="loadReplies">{{ i18n.ts.loadReplies }}</MkButton>
			</div>
			<MkNoteSub v-for="note in replies" :key="note.id" :note="note" :class="$style.reply" :detail="true" :expandAllCws="props.expandAllCws"/>
		</div>
		<div v-else-if="tab === 'renotes'" :class="$style.tab_renotes">
			<MkPagination :pagination="renotesPagination" :disableAutoLoad="true">
				<template #default="{ items }">
					<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); grid-gap: 12px;">
						<MkA v-for="item in items" :key="item.id" :to="userPage(item.user)">
							<MkUserCardMini :user="item.user" :withChart="false"/>
						</MkA>
					</div>
				</template>
			</MkPagination>
		</div>
		<div v-if="tab === 'quotes'" :class="$style.tab_replies">
			<div v-if="!quotesLoaded" style="padding: 16px">
				<MkButton style="margin: 0 auto;" primary rounded @click="loadQuotes">{{ i18n.ts.loadReplies }}</MkButton>
			</div>
			<MkNoteSub v-for="note in quotes" :key="note.id" :note="note" :class="$style.reply" :detail="true" :expandAllCws="props.expandAllCws"/>
		</div>
		<div v-else-if="tab === 'reactions'" :class="$style.tab_reactions">
			<div :class="$style.reactionTabs">
				<button v-for="reaction in Object.keys(appearNote.reactions)" :key="reaction" :class="[$style.reactionTab, { [$style.reactionTabActive]: reactionTabType === reaction }]" class="_button" @click="reactionTabType = reaction">
					<MkReactionIcon :reaction="reaction"/>
					<span style="margin-left: 4px;">{{ appearNote.reactions[reaction] }}</span>
				</button>
			</div>
			<MkPagination v-if="reactionTabType" :key="reactionTabType" :pagination="reactionsPagination" :disableAutoLoad="true">
				<template #default="{ items }">
					<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); grid-gap: 12px;">
						<MkA v-for="item in items" :key="item.id" :to="userPage(item.user)">
							<MkUserCardMini :user="item.user" :withChart="false"/>
						</MkA>
					</div>
				</template>
			</MkPagination>
		</div>
	</div>
</div>
<div v-else class="_panel" :class="$style.muted" @click="muted = false">
	<I18n :src="i18n.ts.userSaysSomething" tag="small">
		<template #name>
			<MkA v-user-preview="appearNote.userId" :to="userPage(appearNote.user)">
				<MkUserName :user="appearNote.user"/>
			</MkA>
		</template>
	</I18n>
</div>
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, provide, ref, shallowRef, watch } from 'vue';
import * as mfm from 'mfm-js';
import * as Misskey from 'misskey-js';
import MkNoteSub from '@/components/MkNoteSub.vue';
import MkNoteSimple from '@/components/MkNoteSimple.vue';
import MkReactionsViewer from '@/components/MkReactionsViewer.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import MkPoll from '@/components/MkPoll.vue';
import MkUsersTooltip from '@/components/MkUsersTooltip.vue';
import MkUrlPreview from '@/components/MkUrlPreview.vue';
import MkInstanceTicker from '@/components/MkInstanceTicker.vue';
import { pleaseLogin } from '@/scripts/please-login.js';
import { checkWordMute } from '@/scripts/check-word-mute.js';
import { userPage } from '@/filters/user.js';
import { notePage } from '@/filters/note.js';
import * as os from '@/os.js';
import { defaultStore, noteViewInterruptors } from '@/store.js';
import { reactionPicker } from '@/scripts/reaction-picker.js';
import { extractUrlFromMfm } from '@/scripts/extract-url-from-mfm.js';
import { $i } from '@/account.js';
import { i18n } from '@/i18n.js';
import { getNoteClipMenu, getNoteMenu } from '@/scripts/get-note-menu.js';
import { getNoteVersionsMenu } from '@/scripts/get-note-versions-menu.js';
import { useNoteCapture } from '@/scripts/use-note-capture.js';
import { deepClone } from '@/scripts/clone.js';
import { useTooltip } from '@/scripts/use-tooltip.js';
import { claimAchievement } from '@/scripts/achievements.js';
import { MenuItem } from '@/types/menu.js';
import { checkAnimationFromMfm } from '@/scripts/check-animated-mfm.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import { showMovedDialog } from '@/scripts/show-moved-dialog.js';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import MkPagination, { Paging } from '@/components/MkPagination.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkButton from '@/components/MkButton.vue';

const props = defineProps<{
	note: Misskey.entities.Note;
	expandAllCws?: boolean;
}>();

const inChannel = inject('inChannel', null);

let note = $ref(deepClone(props.note));

// plugin
if (noteViewInterruptors.length > 0) {
	onMounted(async () => {
		let result:Misskey.entities.Note | null = deepClone(note);
		for (const interruptor of noteViewInterruptors) {
			result = await interruptor.handler(result);

			if (result === null) return isDeleted.value = true;
		}
		note = result;
	});
}

const isRenote = (
	note.renote != null &&
	note.text == null &&
	note.fileIds.length === 0 &&
	note.poll == null
);

const el = shallowRef<HTMLElement>();
const menuButton = shallowRef<HTMLElement>();
const menuVersionsButton = shallowRef<HTMLElement>();
const renoteButton = shallowRef<HTMLElement>();
const renoteTime = shallowRef<HTMLElement>();
const reactButton = shallowRef<HTMLElement>();
const quoteButton = shallowRef<HTMLElement>();
const clipButton = shallowRef<HTMLElement>();
const likeButton = shallowRef<HTMLElement>();
let appearNote = $computed(() => isRenote ? note.renote as Misskey.entities.Note : note);
const renoteUrl = appearNote.renote ? appearNote.renote.url : null;
const renoteUri = appearNote.renote ? appearNote.renote.uri : null;

const isMyRenote = $i && ($i.id === note.userId);
const showContent = ref(false);
const isDeleted = ref(false);
const renoted = ref(false);
const quoted = ref(false);
const muted = ref($i ? checkWordMute(appearNote, $i, $i.mutedWords) : false);
const translation = ref(null);
const translating = ref(false);
const parsed = $computed(() => appearNote.text ? mfm.parse(appearNote.text) : null);
const urls = parsed ? extractUrlFromMfm(parsed) : null;
const animated = $computed(() => parsed ? checkAnimationFromMfm(parsed) : null);
const allowAnim = ref(defaultStore.state.advancedMfm && defaultStore.state.animatedMfm ? true : false);
const showTicker = (defaultStore.state.instanceTicker === 'always') || (defaultStore.state.instanceTicker === 'remote' && appearNote.user.instance);
const conversation = ref<Misskey.entities.Note[]>([]);
const replies = ref<Misskey.entities.Note[]>([]);
const quotes = ref<Misskey.entities.Note[]>([]);
const canRenote = computed(() => ['public', 'home'].includes(appearNote.visibility) || appearNote.userId === $i.id);

watch(() => props.expandAllCws, (expandAllCws) => {
	if (expandAllCws !== showContent.value) showContent.value = expandAllCws;
});

if ($i) {
	os.api("notes/renotes", {
		noteId: appearNote.id,
		userId: $i.id,
		limit: 1,
	}).then((res) => {
		renoted.value = res.length > 0;
	});

	os.api("notes/renotes", {
		noteId: appearNote.id,
		userId: $i.id,
		limit: 1,
		quote: true,
	}).then((res) => {
		quoted.value = res.length > 0;
	});
}

const keymap = {
	'r': () => reply(true),
	'e|a|plus': () => react(true),
	'q': () => renoteButton.value.renote(true),
	'esc': blur,
	'm|o': () => menu(true),
	's': () => showContent.value !== showContent.value,
};

provide('react', (reaction: string) => {
	os.api('notes/reactions/create', {
		noteId: appearNote.id,
		reaction: reaction,
	});
});

let tab = $ref('replies');
let reactionTabType = $ref(null);

const renotesPagination = $computed(() => ({
	endpoint: 'notes/renotes',
	limit: 10,
	params: {
		noteId: appearNote.id,
	},
}));

const reactionsPagination = $computed(() => ({
	endpoint: 'notes/reactions',
	limit: 10,
	params: {
		noteId: appearNote.id,
		type: reactionTabType,
	},
}));

useNoteCapture({
	rootEl: el,
	note: $$(appearNote),
	pureNote: $$(note),
	isDeletedRef: isDeleted,
});

useTooltip(renoteButton, async (showing) => {
	const renotes = await os.api('notes/renotes', {
		noteId: appearNote.id,
		limit: 11,
	});

	const users = renotes.map(x => x.user);

	if (users.length < 1) return;

	os.popup(MkUsersTooltip, {
		showing,
		users,
		count: appearNote.renoteCount,
		targetElement: renoteButton.value,
	}, {}, 'closed');
});

useTooltip(quoteButton, async (showing) => {
	const renotes = await os.api('notes/renotes', {
		noteId: appearNote.id,
		limit: 11,
		quote: true,
	});

	const users = renotes.map(x => x.user);

	if (users.length < 1) return;

	os.popup(MkUsersTooltip, {
		showing,
		users,
		count: appearNote.renoteCount,
		targetElement: quoteButton.value,
	}, {}, 'closed');
});

type Visibility = 'public' | 'home' | 'followers' | 'specified';

function smallerVisibility(a: Visibility | string, b: Visibility | string): Visibility {
	if (a === 'specified' || b === 'specified') return 'specified';
	if (a === 'followers' || b === 'followers') return 'followers';
	if (a === 'home' || b === 'home') return 'home';
	// if (a === 'public' || b === 'public')
	return 'public';
}

function renote() {
	pleaseLogin();
	showMovedDialog();

	if (appearNote.channel) {
		const el = renoteButton.value as HTMLElement | null | undefined;
		if (el) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			os.popup(MkRippleEffect, { x, y }, {}, 'end');
		}

		os.api('notes/create', {
			renoteId: appearNote.id,
			channelId: appearNote.channelId,
		}).then(() => {
			os.toast(i18n.ts.renoted);
			renoted.value = true;
		});
	} else if (!appearNote.channel || appearNote.channel?.allowRenoteToExternal) {
		const el = renoteButton.value as HTMLElement | null | undefined;
		if (el) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			os.popup(MkRippleEffect, { x, y }, {}, 'end');
		}

		const configuredVisibility = defaultStore.state.rememberNoteVisibility ? defaultStore.state.visibility : defaultStore.state.defaultNoteVisibility;
		const localOnly = defaultStore.state.rememberNoteVisibility ? defaultStore.state.localOnly : defaultStore.state.defaultNoteLocalOnly;

		let visibility = appearNote.visibility;
		visibility = smallerVisibility(visibility, configuredVisibility);
		if (appearNote.channel?.isSensitive) {
			visibility = smallerVisibility(visibility, 'home');
		}
		
		os.api('notes/create', {
			localOnly,
			visibility,
			renoteId: appearNote.id,
		}).then(() => {
			os.toast(i18n.ts.renoted);
			renoted.value = true;
		});
	}
}

function quote() {
	pleaseLogin();
	showMovedDialog();

	if (appearNote.channel) {
		os.post({
			renote: appearNote,
			channel: appearNote.channel,
		}).then(() => {
			os.api("notes/renotes", {
				noteId: appearNote.id,
				userId: $i.id,
				limit: 1,
				quote: true,
			}).then((res) => {
				if (!(res.length > 0)) return;
				const el = quoteButton.value as HTMLElement | null | undefined;
				if (el && res.length > 0) {
					const rect = el.getBoundingClientRect();
					const x = rect.left + (el.offsetWidth / 2);
					const y = rect.top + (el.offsetHeight / 2);
					os.popup(MkRippleEffect, { x, y }, {}, 'end');
				}

				quoted.value = res.length > 0;
				os.toast(i18n.ts.quoted);
			});
		});
	} else {
		os.post({
			renote: appearNote,
		}).then(() => {
			os.api("notes/renotes", {
				noteId: appearNote.id,
				userId: $i.id,
				limit: 1,
				quote: true,
			}).then((res) => {
				if (!(res.length > 0)) return;
				const el = quoteButton.value as HTMLElement | null | undefined;
				if (el && res.length > 0) {
					const rect = el.getBoundingClientRect();
					const x = rect.left + (el.offsetWidth / 2);
					const y = rect.top + (el.offsetHeight / 2);
					os.popup(MkRippleEffect, { x, y }, {}, 'end');
				}

				quoted.value = res.length > 0;
				os.toast(i18n.ts.quoted);
			});
		});
	}
}

function reply(viaKeyboard = false): void {
	pleaseLogin();
	showMovedDialog();
	os.post({
		reply: appearNote,
		channel: appearNote.channel,
		animation: !viaKeyboard,
	}, () => {
		focus();
	});
}

function react(viaKeyboard = false): void {
	pleaseLogin();
	showMovedDialog();
	if (appearNote.reactionAcceptance === 'likeOnly') {
		os.api('notes/reactions/create', {
			noteId: appearNote.id,
			reaction: '❤️',
		});
		const el = reactButton.value as HTMLElement | null | undefined;
		if (el) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			os.popup(MkRippleEffect, { x, y }, {}, 'end');
		}
	} else {
		blur();
		reactionPicker.show(reactButton.value, reaction => {
			os.api('notes/reactions/create', {
				noteId: appearNote.id,
				reaction: reaction,
			});
			if (appearNote.text && appearNote.text.length > 100 && (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 3)) {
				claimAchievement('reactWithoutRead');
			}
		}, () => {
			focus();
		});
	}
}

function like(): void {
	pleaseLogin();
	showMovedDialog();
	os.api('notes/reactions/create', {
		noteId: appearNote.id,
		reaction: '❤️',
	});
	const el = likeButton.value as HTMLElement | null | undefined;
	if (el) {
		const rect = el.getBoundingClientRect();
		const x = rect.left + (el.offsetWidth / 2);
		const y = rect.top + (el.offsetHeight / 2);
		os.popup(MkRippleEffect, { x, y }, {}, 'end');
	}
}

function undoReact(note): void {
	const oldReaction = note.myReaction;
	if (!oldReaction) return;
	os.api('notes/reactions/delete', {
		noteId: note.id,
	});
}

function undoRenote() : void {
	if (!renoted.value) return;
	os.api("notes/unrenote", {
		noteId: appearNote.id,
	});
	os.toast(i18n.ts.rmboost);
	renoted.value = false;

	const el = renoteButton.value as HTMLElement | null | undefined;
	if (el) {
		const rect = el.getBoundingClientRect();
		const x = rect.left + (el.offsetWidth / 2);
		const y = rect.top + (el.offsetHeight / 2);
		os.popup(MkRippleEffect, { x, y }, {}, 'end');
	}
}

function undoQuote() : void {
	os.api("notes/unrenote", {
		noteId: appearNote.id,
		quote: true
	});
	os.toast(i18n.ts.rmquote);
	quoted.value = false;

	const el = quoteButton.value as HTMLElement | null | undefined;
	if (el) {
		const rect = el.getBoundingClientRect();
		const x = rect.left + (el.offsetWidth / 2);
		const y = rect.top + (el.offsetHeight / 2);
		os.popup(MkRippleEffect, { x, y }, {}, 'end');
	}
}

function onContextmenu(ev: MouseEvent): void {
	const isLink = (el: HTMLElement) => {
		if (el.tagName === 'A') return true;
		if (el.parentElement) {
			return isLink(el.parentElement);
		}
	};
	if (isLink(ev.target)) return;
	if (window.getSelection().toString() !== '') return;

	if (defaultStore.state.useReactionPickerForContextMenu) {
		ev.preventDefault();
		react();
	} else {
		const { menu, cleanup } = getNoteMenu({ note: note, translating, translation, menuButton, isDeleted });
		os.contextMenu(menu, ev).then(focus).finally(cleanup);
	}
}

function menu(viaKeyboard = false): void {
	const { menu, cleanup } = getNoteMenu({ note: note, translating, translation, menuButton, isDeleted });
	os.popupMenu(menu, menuButton.value, {
		viaKeyboard,
	}).then(focus).finally(cleanup);
}

async function menuVersions(viaKeyboard = false): Promise<void> {
	const { menu, cleanup } = await getNoteVersionsMenu({ note: note, menuVersionsButton });
	os.popupMenu(menu, menuVersionsButton.value, {
		viaKeyboard,
	}).then(focus).finally(cleanup);
}

async function clip() {
	os.popupMenu(await getNoteClipMenu({ note: note, isDeleted }), clipButton.value).then(focus);
}

function showRenoteMenu(viaKeyboard = false): void {
	if (!isMyRenote) return;
	pleaseLogin();
	os.popupMenu([{
		text: i18n.ts.unrenote,
		icon: 'ph-trash ph-bold ph-lg',
		danger: true,
		action: () => {
			os.api('notes/delete', {
				noteId: note.id,
			});
			isDeleted.value = true;
		},
	}], renoteTime.value, {
		viaKeyboard: viaKeyboard,
	});
}

function focus() {
	el.value.focus();
}

function blur() {
	el.value.blur();
}

const repliesLoaded = ref(false);

function loadReplies() {
	repliesLoaded.value = true;
	os.api('notes/children', {
		noteId: appearNote.id,
		limit: 30,
		showQuotes: false,
	}).then(res => {
		replies.value = res;
	});
}

loadReplies();

const quotesLoaded = ref(false);

function loadQuotes() {
	quotesLoaded.value = true;
	os.api('notes/renotes', {
		noteId: appearNote.id,
		limit: 30,
		quote: true,
	}).then(res => {
		quotes.value = res;
	});
}

loadQuotes();

const conversationLoaded = ref(false);

function loadConversation() {
	conversationLoaded.value = true;
	os.api('notes/conversation', {
		noteId: appearNote.replyId,
	}).then(res => {
		conversation.value = res.reverse();
	});
}

if (appearNote.reply && appearNote.reply.replyId && defaultStore.state.autoloadConversation) loadConversation();

function animatedMFM() {
	if (allowAnim.value) {
		allowAnim.value = false;
	} else {
		os.confirm({
			type: 'warning',
			text: i18n.ts._animatedMFM._alert.text,
			okText: i18n.ts._animatedMFM._alert.confirm,
		}).then((res) => { if (!res.canceled) allowAnim.value = true; });
	}
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	transition: box-shadow 0.1s ease;
	overflow: clip;
	contain: content;
}

.footer {
		position: relative;
		z-index: 1;
		margin-top: 0.4em;
		width: max-content;
		min-width: max-content;
}

.replyTo {
	opacity: 0.7;
	padding-bottom: 0;
}

.replyToMore {
	opacity: 0.7;
}

.renote {
	display: flex;
	align-items: center;
	padding: 16px 32px 8px 32px;
	line-height: 28px;
	white-space: pre;
	color: var(--renote);
}

.renoteAvatar {
	flex-shrink: 0;
	display: inline-block;
	width: 28px;
	height: 28px;
	margin: 0 8px 0 0;
	border-radius: var(--radius-sm);
}

.renoteText {
	overflow: hidden;
	flex-shrink: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.renoteName {
	font-weight: bold;
}

.renoteInfo {
	margin-left: auto;
	font-size: 0.9em;
}

.renoteTime {
	flex-shrink: 0;
	color: inherit;
}

.renote + .note {
	padding-top: 8px;
}

.note {
	padding: 32px;
	font-size: 1.2em;
	overflow: hidden;

	&:hover > .main > .footer > .button {
		opacity: 1;
	}
}

.noteHeader {
	display: flex;
	position: relative;
	margin-bottom: 16px;
	align-items: center;
	z-index: 2;
}

.noteHeaderAvatar {
	display: block;
	flex-shrink: 0;
	width: 58px;
	height: 58px;
}

.noteHeaderBody {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding-left: 16px;
	font-size: 0.95em;
}

.noteHeaderName {
	font-weight: bold;
	line-height: 1.3;
}

.isBot {
	display: inline-block;
	margin: 0 0.5em;
	padding: 4px 6px;
	font-size: 80%;
	line-height: 1;
	border: solid 0.5px var(--divider);
	border-radius: var(--radius-xs);
}

.noteHeaderInfo {
	float: right;
}

.noteHeaderUsername {
	margin-bottom: 2px;
	line-height: 1.3;
	word-wrap: anywhere;
}

.playMFMButton {
	margin-top: 5px;
}

.noteContent {
	container-type: inline-size;
	overflow-wrap: break-word;
	z-index: 1;
}

.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.noteReplyTarget {
	color: var(--accent);
	margin-right: 0.5em;
}

.rn {
	margin-left: 4px;
	font-style: oblique;
	color: var(--renote);
}

.translation {
	border: solid 0.5px var(--divider);
	border-radius: var(--radius);
	padding: 12px;
	margin-top: 8px;
}

.poll {
	font-size: 80%;
}

.quote {
	padding: 8px 0;
}

.quoteNote {
	padding: 16px;
	border: dashed 1px var(--renote);
	border-radius: var(--radius-sm);
	overflow: clip;
}

.channel {
	opacity: 0.7;
	font-size: 80%;
}

.noteFooterInfo {
	margin: 16px 0;
	opacity: 0.7;
	font-size: 0.9em;
}

.noteFooterButton {
	margin: 0;
	padding: 8px;
	opacity: 0.7;

	&:not(:last-child) {
		margin-right: 1.5em;
	}

	&:hover {
		color: var(--fgHighlighted);
	}
}

.noteFooterButtonCount {
	display: inline;
	margin: 0 0 0 8px;
	opacity: 0.7;

	&.reacted {
		color: var(--accent);
	}
}

.reply:not(:first-child) {
	border-top: solid 0.5px var(--divider);
}

.tabs {
	border-top: solid 0.5px var(--divider);
	border-bottom: solid 0.5px var(--divider);
	display: flex;
}

.tab {
	flex: 1;
	padding: 12px 8px;
	border-top: solid 2px transparent;
	border-bottom: solid 2px transparent;
}

.tabActive {
	border-bottom: solid 2px var(--accent);
}

.tab_renotes {
	padding: 16px;
}

.tab_reactions {
	padding: 16px;
}

.reactionTabs {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	margin-bottom: 8px;
}

.reactionTab {
	padding: 4px 6px;
	border: solid 1px var(--divider);
	border-radius: var(--radius-sm);
}

.reactionTabActive {
	border-color: var(--accent);
}

@container (max-width: 500px) {
	.root {
		font-size: 0.9em;
	}
}

@container (max-width: 450px) {
	.renote {
		padding: 8px 16px 0 16px;
	}

	.note {
		padding: 16px;
	}

	.noteHeaderAvatar {
		width: 50px;
		height: 50px;
	}
}

@container (max-width: 350px) {
	.noteFooterButton {
		&:not(:last-child) {
			margin-right: 0.1em;
		}
	}
}

@container (max-width: 300px) {
	.root {
		font-size: 0.825em;
	}

	.noteHeaderAvatar {
		width: 50px;
		height: 50px;
	}

	.noteFooterButton {
		&:not(:last-child) {
			margin-right: 0.1em;
		}
	}
}

.muted {
	padding: 8px;
	text-align: center;
	opacity: 0.7;
}
</style>
