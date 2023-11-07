<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="!muted" ref="el" :class="[$style.root, { [$style.children]: depth > 1 }]">
	<div :class="$style.main">
		<div v-if="note.channel" :class="$style.colorBar" :style="{ background: note.channel.color }"></div>
		<MkAvatar :class="$style.avatar" :user="note.user" link preview/>
		<div :class="$style.body">
			<MkNoteHeader :class="$style.header" :note="note" :mini="true"/>
			<div :class="$style.content">
				<p v-if="note.cw != null" :class="$style.cw">
					<Mfm v-if="note.cw != ''" style="margin-right: 8px;" :text="note.cw" :author="note.user" :nyaize="'account'"/>
					<MkCwButton v-model="showContent" :note="note"/>
				</p>
				<div v-show="note.cw == null || showContent">
					<MkSubNoteContent :class="$style.text" :note="note" :translating="translating" :translation="translation"/>
				</div>
			</div>
			<footer :class="$style.footer">
				<MkReactionsViewer ref="reactionsViewer" :note="note"/>
				<button class="_button" :class="$style.noteFooterButton" @click="reply()">
					<i class="ph-arrow-u-up-left ph-bold ph-lg"></i>
					<p v-if="note.repliesCount > 0" :class="$style.noteFooterButtonCount">{{ note.repliesCount }}</p>
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
					<p v-if="note.renoteCount > 0" :class="$style.noteFooterButtonCount">{{ note.renoteCount }}</p>
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
				<button v-else class="_button" :class="$style.noteFooterButton" disabled>
					<i class="ph-prohibit ph-bold ph-lg"></i>
				</button>
				<button v-if="note.myReaction == null && note.reactionAcceptance !== 'likeOnly'" ref="likeButton" :class="$style.noteFooterButton" class="_button" @mousedown="like()">
					<i class="ph-heart ph-bold ph-lg"></i>
				</button>
				<button v-if="note.myReaction == null" ref="reactButton" :class="$style.noteFooterButton" class="_button" @mousedown="react()">
					<i v-if="note.reactionAcceptance === 'likeOnly'" class="ph-heart ph-bold ph-lg"></i>
					<i v-else class="ph-smiley ph-bold ph-lg"></i>
				</button>
				<button v-if="note.myReaction != null" ref="reactButton" class="_button" :class="[$style.noteFooterButton, $style.reacted]" @click="undoReact(note)">
					<i class="ph-minus ph-bold ph-lg"></i>
				</button>
				<button ref="menuButton" class="_button" :class="$style.noteFooterButton" @mousedown="menu()">
					<i class="ph-dots-three ph-bold ph-lg"></i>
				</button>
			</footer>
		</div>
	</div>
	<template v-if="depth < 5">
		<MkNoteSub v-for="reply in replies" :key="reply.id" :note="reply" :class="$style.reply" :detail="true" :depth="depth + 1" :expandAllCws="props.expandAllCws"/>
	</template>
	<div v-else :class="$style.more">
		<MkA class="_link" :to="notePage(note)">{{ i18n.ts.continueThread }} <i class="ph-caret-double-right ph-bold ph-lg"></i></MkA>
	</div>
</div>
<div v-else :class="$style.muted" @click="muted = false">
	<I18n :src="i18n.ts.userSaysSomething" tag="small">
		<template #name>
			<MkA v-user-preview="note.userId" :to="userPage(note.user)">
				<MkUserName :user="note.user"/>
			</MkA>
		</template>
	</I18n>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, shallowRef, watch } from 'vue';
import * as Misskey from 'misskey-js';
import MkNoteHeader from '@/components/MkNoteHeader.vue';
import MkReactionsViewer from '@/components/MkReactionsViewer.vue';
import MkSubNoteContent from '@/components/MkSubNoteContent.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import { notePage } from '@/filters/note.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';
import { userPage } from "@/filters/user.js";
import { checkWordMute } from "@/scripts/check-word-mute.js";
import { defaultStore } from "@/store.js";
import { pleaseLogin } from '@/scripts/please-login.js';
import { showMovedDialog } from '@/scripts/show-moved-dialog.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import { reactionPicker } from '@/scripts/reaction-picker.js';
import { claimAchievement } from '@/scripts/achievements.js';
import type { MenuItem } from '@/types/menu.js';
import { getNoteMenu } from '@/scripts/get-note-menu.js';
import { useNoteCapture } from '@/scripts/use-note-capture.js';

const canRenote = computed(() => ['public', 'home'].includes(props.note.visibility) || props.note.userId === $i.id);

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	detail?: boolean;
	expandAllCws?: boolean;

	// how many notes are in between this one and the note being viewed in detail
	depth?: number;
}>(), {
	depth: 1,
});

const el = shallowRef<HTMLElement>();
const muted = ref($i ? checkWordMute(props.note, $i, $i.mutedWords) : false);
const translation = ref<any>(null);
const translating = ref(false);
const isDeleted = ref(false);
const renoted = ref(false);
const quoted = ref(false);
const reactButton = shallowRef<HTMLElement>();
const renoteButton = shallowRef<HTMLElement>();
const quoteButton = shallowRef<HTMLElement>();
const menuButton = shallowRef<HTMLElement>();
const likeButton = shallowRef<HTMLElement>();

let appearNote = $computed(() => isRenote ? props.note.renote as Misskey.entities.Note : props.note);

const isRenote = (
	props.note.renote != null &&
	props.note.text == null &&
	props.note.fileIds.length === 0 &&
	props.note.poll == null
);

useNoteCapture({
	rootEl: el,
	note: $$(appearNote),
	isDeletedRef: isDeleted,
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

function focus() {
	el.value.focus();
}

function reply(viaKeyboard = false): void {
	pleaseLogin();
	showMovedDialog();
	os.post({
		reply: props.note,
		channel: props.note.channel,
		animation: !viaKeyboard,
	}, () => {
		focus();
	});
}

function react(viaKeyboard = false): void {
	pleaseLogin();
	showMovedDialog();
	if (props.note.reactionAcceptance === 'likeOnly') {
		os.api('notes/reactions/create', {
			noteId: props.note.id,
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
				noteId: props.note.id,
				reaction: reaction,
			});
			if (props.note.text && props.note.text.length > 100 && (Date.now() - new Date(props.note.createdAt).getTime() < 1000 * 3)) {
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
		noteId: props.note.id,
		reaction: '❤️',
	});
	const el = reactButton.value as HTMLElement | null | undefined;
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

let showContent = $ref(false);

watch(() => props.expandAllCws, (expandAllCws) => {
	if (expandAllCws !== showContent) showContent = expandAllCws;
});

let replies: Misskey.entities.Note[] = $ref([]);

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
			renoteId: props.note.id,
			channelId: props.note.channelId,
		}).then(() => {
			os.toast(i18n.ts.renoted);
			renoted.value = true;
		});
	} else {
		const el = renoteButton.value as HTMLElement | null | undefined;
		if (el) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			os.popup(MkRippleEffect, { x, y }, {}, 'end');
		}

		os.api('notes/create', {
			renoteId: props.note.id,
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
				noteId: props.note.id,
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
				noteId: props.note.id,
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

function menu(viaKeyboard = false): void {
	const { menu, cleanup } = getNoteMenu({ note: props.note, translating, translation, menuButton, isDeleted });
	os.popupMenu(menu, menuButton.value, {
		viaKeyboard,
	}).then(focus).finally(cleanup);
}

if (props.detail) {
	os.api('notes/children', {
		noteId: props.note.id,
		limit: 5,
	}).then(res => {
		replies = res;
	});
}
</script>

<style lang="scss" module>
.root {
	padding: 16px 32px;
	font-size: 0.9em;
	position: relative;

	&.children {
		padding: 10px 0 0 16px;
		font-size: 1em;
	}
}

.footer {
		position: relative;
		z-index: 1;
		margin-top: 0.4em;
		width: max-content;
		min-width: max-content;
}

.main {
	display: flex;
}

.colorBar {
	position: absolute;
	top: 8px;
	left: 8px;
	width: 5px;
	height: calc(100% - 8px);
	border-radius: var(--radius-ellipse);
	pointer-events: none;
}

.avatar {
	flex-shrink: 0;
	display: block;
	margin: 0 8px 0 0;
	width: 38px;
	height: 38px;
	border-radius: var(--radius-sm);
}

.body {
	flex: 1;
	min-width: 0;
}

.content {
	overflow: hidden;
}

.header {
	margin-bottom: 2px;
}

.noteFooterButton {
	margin: 0;
	padding: 8px;
	padding-top: 10px;
	opacity: 0.7;

	&:not(:last-child) {
		margin-right: 1.5em;
	}

	&:hover {
		color: var(--fgHighlighted);
	}
}

@container (max-width: 400px) {
	.noteFooterButton {
		&:not(:last-child) {
			margin-right: 0.7em;
		}
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

.cw {
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.text {
	margin: 0;
	padding: 0;
}

.reply, .more {
	border-left: solid 0.5px var(--divider);
	margin-top: 10px;
}

.more {
	padding: 10px 0 0 16px;
}

@container (max-width: 450px) {
	.root {
		padding: 14px 16px;

		&.children {
			padding: 10px 0 0 8px;
		}
	}
}

.muted {
	text-align: center;
	padding: 8px !important;
	border: 1px solid var(--divider);
	margin: 8px 8px 0 8px;
	border-radius: var(--radius-sm);
}
</style>
