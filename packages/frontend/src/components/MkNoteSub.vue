<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="!muted" :class="[$style.root, { [$style.children]: depth > 1 }]">
	<div :class="$style.main">
		<div v-if="note.channel" :class="$style.colorBar" :style="{ background: note.channel.color }"></div>
		<MkAvatar :class="$style.avatar" :user="note.user" link preview/>
		<div :class="$style.body">
			<MkNoteHeader :class="$style.header" :note="note" :mini="true"/>
			<div>
				<p v-if="note.cw != null" :class="$style.cw">
					<Mfm v-if="note.cw != ''" style="margin-right: 8px;" :text="note.cw" :author="note.user" :i="$i"/>
					<MkCwButton v-model="showContent" :note="note"/>
				</p>
				<div v-show="note.cw == null || showContent">
					<MkSubNoteContent :class="$style.text" :note="note"/>
				</div>
			</div>
			<footer>
				<MkReactionsViewer ref="reactionsViewer" :note="note"/>
				<button class="_button" :class="$style.noteFooterButton" @click="reply()">
					<i class="ph-arrow-u-up-left ph-bold pg-lg"></i>
					<p v-if="note.repliesCount > 0" :class="$style.noteFooterButtonCount">{{ note.repliesCount }}</p>
				</button>
				<button
				v-if="canRenote"
				ref="renoteButton"
				class="_button"
				:class="$style.noteFooterButton"
				@mousedown="renote()"
				>
					<i class="ph-repeat ph-bold ph-lg"></i>
					<p v-if="note.renoteCount > 0" :class="$style.noteFooterButtonCount">{{ note.renoteCount }}</p>
				</button>
				<button v-else class="_button" :class="$style.noteFooterButton" disabled>
					<i class="ph-prohibit ph-bold ph-lg"></i>
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
		<MkNoteSub v-for="reply in replies" :key="reply.id" :note="reply" :class="$style.reply" :detail="true" :depth="depth + 1"/>
	</template>
	<div v-else :class="$style.more">
		<MkA class="_link" :to="notePage(note)">{{ i18n.ts.continueThread }} <i class="ti ti-chevron-double-right"></i></MkA>
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
import { computed, ref, shallowRef } from 'vue';
import * as Misskey from 'misskey-js';
import MkNoteHeader from '@/components/MkNoteHeader.vue';
import MkReactionsViewer from '@/components/MkReactionsViewer.vue';
import MkSubNoteContent from '@/components/MkSubNoteContent.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import { notePage } from '@/filters/note.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';
import { userPage } from "@/filters/user";
import { checkWordMute } from "@/scripts/check-word-mute";
import { defaultStore } from "@/store";
import { pleaseLogin } from '@/scripts/please-login.js';
import { showMovedDialog } from '@/scripts/show-moved-dialog.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import { reactionPicker } from '@/scripts/reaction-picker.js';
import { claimAchievement } from '@/scripts/achievements.js';
import type { MenuItem } from '@/types/menu.js';
import { getNoteMenu } from '@/scripts/get-note-menu.js';
const canRenote = computed(() => ['public', 'home'].includes(props.note.visibility) || props.note.userId === $i.id);

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	detail?: boolean;

	// how many notes are in between this one and the note being viewed in detail
	depth?: number;
}>(), {
	depth: 1,
});

function focus() {
	el.value.focus();
}

const muted = ref(checkWordMute(props.note, $i, defaultStore.state.mutedWords));
const translation = ref(null);
const translating = ref(false);
const isDeleted = ref(false);
const reactButton = shallowRef<HTMLElement>();
const renoteButton = shallowRef<HTMLElement>();
const menuButton = shallowRef<HTMLElement>();

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

function undoReact(note): void {
	const oldReaction = note.myReaction;
	if (!oldReaction) return;
	os.api('notes/reactions/delete', {
		noteId: note.id,
	});
}

let showContent = $ref(false);
let replies: Misskey.entities.Note[] = $ref([]);

function renote(viaKeyboard = false) {
	pleaseLogin();
	showMovedDialog();

	let items = [] as MenuItem[];

	if (props.note.channel) {
		items = items.concat([{
			text: i18n.ts.inChannelRenote,
			icon: 'ph-repeat ph-bold ph-lg',
			action: () => {
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
				});
			},
		}, {
			text: i18n.ts.inChannelQuote,
			icon: 'ph-quotes ph-bold ph-lg',
			action: () => {
				os.post({
					renote: props.note,
					channel: props.note.channel,
				});
			},
		}, null]);
	}

	items = items.concat([{
		text: i18n.ts.renote,
		icon: 'ph-repeat ph-bold ph-lg',
		action: () => {
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
			});
		},
	}, {
		text: i18n.ts.quote,
		icon: 'ph-quotes ph-bold ph-lg',
		action: () => {
			os.post({
				renote: props.note,
			});
		},
	}]);

	os.popupMenu(items, renoteButton.value, {
		viaKeyboard,
	});
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

.main {
	display: flex;
}

.colorBar {
	position: absolute;
	top: 8px;
	left: 8px;
	width: 5px;
	height: calc(100% - 8px);
	border-radius: 999px;
	pointer-events: none;
}

.avatar {
	flex-shrink: 0;
	display: block;
	margin: 0 8px 0 0;
	width: 38px;
	height: 38px;
	border-radius: 8px;
}

.body {
	flex: 1;
	min-width: 0;
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
		margin-right: 14px;
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

.cw {
	cursor: default;
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
	border-radius: 8px;
}
</style>
