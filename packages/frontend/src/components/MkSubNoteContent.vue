<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.collapsed]: collapsed }]">
	<div :class="{ [$style.clickToOpen]: defaultStore.state.clickToOpen }" @click="defaultStore.state.clickToOpen ? noteclick(note.id) : undefined">
		<span v-if="note.isHidden" style="opacity: 0.5">({{ i18n.ts.private }})</span>
		<span v-if="note.deletedAt" style="opacity: 0.5">({{ i18n.ts.deleted }})</span>
		<MkA v-if="note.replyId" :class="$style.reply" :to="`/notes/${note.replyId}`" v-on:click.stop><i class="ph-arrow-bend-left-up ph-bold ph-lg"></i></MkA>
		<Mfm v-if="note.text" :text="note.text" :author="note.user" :nyaize="'account'" :isAnim="allowAnim" :emojiUrls="note.emojis"/>
		<MkButton v-if="!allowAnim && animated && !hideFiles" :class="$style.playMFMButton" :small="true" @click="animatedMFM()" v-on:click.stop><i class="ph-play ph-bold ph-lg "></i> {{ i18n.ts._animatedMFM.play }}</MkButton>
		<MkButton v-else-if="!defaultStore.state.animatedMfm && allowAnim && animated && !hideFiles" :class="$style.playMFMButton" :small="true" @click="animatedMFM()" v-on:click.stop><i class="ph-stop ph-bold ph-lg "></i> {{ i18n.ts._animatedMFM.stop }}</MkButton>
		<div v-if="note.text && translating || note.text && translation" :class="$style.translation">
			<MkLoading v-if="translating" mini/>
			<div v-else>
				<b>{{ i18n.t('translatedFrom', { x: translation.sourceLang }) }}: </b>
				<Mfm :text="translation.text" :author="note.user" :nyaize="'account'" :emojiUrls="note.emojis"/>
			</div>
		</div>
		<MkA v-if="note.renoteId" :class="$style.rp" :to="`/notes/${note.renoteId}`" v-on:click.stop>RN: ...</MkA>
	</div>
	<details v-if="note.files.length > 0" :open="!defaultStore.state.collapseFiles && !hideFiles">
		<summary>({{ i18n.t('withNFiles', { n: note.files.length }) }})</summary>
		<MkMediaList :mediaList="note.files"/>
	</details>
	<details v-if="note.poll">
		<summary>{{ i18n.ts.poll }}</summary>
		<MkPoll :note="note"/>
	</details>
	<button v-if="isLong && collapsed" :class="$style.fade" class="_button" @click="collapsed = false">
		<span :class="$style.fadeLabel">{{ i18n.ts.showMore }}</span>
	</button>
	<button v-else-if="isLong && !collapsed" :class="$style.showLess" class="_button" @click="collapsed = true">
		<span :class="$style.showLessLabel">{{ i18n.ts.showLess }}</span>
	</button>
</div>
</template>

<script lang="ts" setup>
import { } from 'vue';
import * as Misskey from 'misskey-js';
import * as mfm from 'mfm-js';
import MkMediaList from '@/components/MkMediaList.vue';
import MkPoll from '@/components/MkPoll.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';
import { shouldCollapsed } from '@/scripts/collapsed.js';
import { defaultStore } from '@/store.js';
import { useRouter } from '@/router.js';
import * as os from '@/os.js';
import { checkAnimationFromMfm } from '@/scripts/check-animated-mfm.js';

const props = defineProps<{
	note: Misskey.entities.Note;
	translating?: boolean;
	translation?: any;
	hideFiles?: boolean;
}>();

const router = useRouter();

function noteclick(id: string) {
	router.push(`/notes/${id}`);
}

const parsed = $computed(() => props.note.text ? mfm.parse(props.note.text) : null);
const animated = $computed(() => parsed ? checkAnimationFromMfm(parsed) : null);
let allowAnim = $ref(defaultStore.state.advancedMfm && defaultStore.state.animatedMfm ? true : false);

const isLong = shouldCollapsed(props.note, []);

function animatedMFM() {
	if (allowAnim) {
		allowAnim = false;
	} else {
		os.confirm({
			type: 'warning',
			text: i18n.ts._animatedMFM._alert.text,
			okText: i18n.ts._animatedMFM._alert.confirm,
		}).then((res) => { if (!res.canceled) allowAnim = true; });
	}
}

const collapsed = $ref(isLong);
</script>

<style lang="scss" module>
.root {
	overflow-wrap: break-word;

	&.collapsed {
		position: relative;
		max-height: 9em;
		overflow: clip;

		> .fade {
			display: block;
			position: absolute;
			bottom: 0;
			left: 0;
			width: 100%;
			height: 64px;
			//background: linear-gradient(0deg, var(--panel), var(--X15));

			> .fadeLabel {
				display: inline-block;
				background: var(--panel);
				padding: 6px 10px;
				font-size: 0.8em;
				border-radius: var(--radius-ellipse);
				box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
			}

			&:hover {
				> .fadeLabel {
					background: var(--panelHighlight);
				}
			}
		}
	}
}

.reply {
	margin-right: 6px;
	color: var(--accent);
}

.rp {
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

.showLess {
	width: 100%;
	margin-top: 14px;
	position: sticky;
	bottom: calc(var(--stickyBottom, 0px) + 14px);
}

.playMFMButton {
	margin-top: 5px;
}

.showLessLabel {
	display: inline-block;
	background: var(--popup);
	padding: 6px 10px;
	font-size: 0.8em;
	border-radius: var(--radius-ellipse);
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}

.clickToOpen {
	cursor: pointer;
}
</style>
