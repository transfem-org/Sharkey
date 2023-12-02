<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<header v-if="!classic" :class="$style.root">
	<div :class="$style.section">
		<div style="display: flex;">
			<div v-if="mock" :class="$style.name">
				<MkUserName :user="note.user"/>
			</div>
			<MkA v-else v-user-preview="note.user.id" :class="$style.name" :to="userPage(note.user)">
				<MkUserName :user="note.user"/>
			</MkA>
			<div v-if="note.user.isBot" :class="$style.isBot">bot</div>
			<div v-if="note.user.badgeRoles" :class="$style.badgeRoles">
				<img v-for="role in note.user.badgeRoles" :key="role.id" v-tooltip="role.name" :class="$style.badgeRole" :src="role.iconUrl"/>
			</div>
		</div>
		<div :class="$style.username"><MkAcct :user="note.user"/></div>
	</div>
	<div :class="$style.section">
		<div :class="$style.info">
			<div v-if="mock">
				<MkTime :time="note.createdAt" colored/>
			</div>
			<MkA v-else :class="$style.time" :to="notePage(note)">
				<MkTime :time="note.createdAt" colored/>
			</MkA>
			<span v-if="note.visibility !== 'public'" style="margin-left: 0.5em;" :title="i18n.ts._visibility[note.visibility]">
				<i v-if="note.visibility === 'home'" class="ph-house ph-bold ph-lg"></i>
				<i v-else-if="note.visibility === 'followers'" class="ph-lock ph-bold ph-lg"></i>
				<i v-else-if="note.visibility === 'specified'" ref="specified" class="ph-envelope ph-bold ph-lg"></i>
			</span>
			<span v-if="note.updatedAt" ref="menuVersionsButton" style="margin-left: 0.5em; cursor: pointer;" title="Edited" @mousedown="menuVersions()"><i class="ph-pencil ph-bold ph-lg"></i></span>
			<span v-if="note.localOnly" style="margin-left: 0.5em;" :title="i18n.ts._visibility['disableFederation']"><i class="ph-rocket ph-bold ph-lg"></i></span>
			<span v-if="note.channel" style="margin-left: 0.5em;" :title="note.channel.name"><i class="ph-television ph-bold ph-lg"></i></span>
		</div>
		<div :class="$style.info"><SkInstanceTicker v-if="showTicker" style="cursor: pointer;" :instance="note.user.instance" @click.stop="showOnRemote()"/></div>
	</div>
</header>
<header v-else :class="$style.classicRoot">
	<div v-if="mock" :class="$style.name">
		<MkUserName :user="note.user"/>
	</div>
	<MkA v-else v-user-preview="note.user.id" :class="$style.classicName" :to="userPage(note.user)">
		<MkUserName :user="note.user"/>
	</MkA>
	<div v-if="note.user.isBot" :class="$style.isBot">bot</div>
	<div :class="$style.classicUsername"><MkAcct :user="note.user"/></div>
	<div v-if="note.user.badgeRoles" :class="$style.badgeRoles">
		<img v-for="role in note.user.badgeRoles" :key="role.id" v-tooltip="role.name" :class="$style.badgeRole" :src="role.iconUrl"/>
	</div>
	<SkInstanceTicker v-if="showTicker && !isMobile && defaultStore.state.showTickerOnReplies" style="cursor: pointer; max-height: 5px; top: 3px; position: relative; margin-top: 0px !important;" :instance="note.user.instance" @click.stop="showOnRemote()"/>
	<div :class="$style.classicInfo">
		<div v-if="mock">
			<MkTime :time="note.createdAt" colored/>
		</div>
		<MkA v-else :to="notePage(note)">
			<MkTime :time="note.createdAt" colored/>
		</MkA>
		<span v-if="note.visibility !== 'public'" style="margin-left: 0.5em;" :title="i18n.ts._visibility[note.visibility]">
			<i v-if="note.visibility === 'home'" class="ph-house ph-bold ph-lg"></i>
			<i v-else-if="note.visibility === 'followers'" class="ph-lock ph-bold ph-lg"></i>
			<i v-else-if="note.visibility === 'specified'" ref="specified" class="ph-envelope ph-bold ph-lg"></i>
		</span>
		<span v-if="note.updatedAt" ref="menuVersionsButton" style="margin-left: 0.5em; cursor: pointer;" title="Edited" @mousedown="menuVersions()"><i class="ph-pencil ph-bold ph-lg"></i></span>
		<span v-if="note.localOnly" style="margin-left: 0.5em;" :title="i18n.ts._visibility['disableFederation']"><i class="ph-rocket ph-bold ph-lg"></i></span>
		<span v-if="note.channel" style="margin-left: 0.5em;" :title="note.channel.name"><i class="ph-television ph-bold ph-lg"></i></span>
	</div>
</header>
</template>

<script lang="ts" setup>
import { inject, shallowRef, ref } from 'vue';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import { notePage } from '@/filters/note.js';
import { userPage } from '@/filters/user.js';
import { getNoteVersionsMenu } from '@/scripts/get-note-versions-menu.js';
import SkInstanceTicker from '@/components/SkInstanceTicker.vue';
import { popupMenu } from '@/os.js';
import { defaultStore } from '@/store.js';
import { useRouter } from '@/router.js';
import { deviceKind } from '@/scripts/device-kind.js';

const props = defineProps<{
	note: Misskey.entities.Note;
	classic?: boolean;
}>();

const menuVersionsButton = shallowRef<HTMLElement>();
const router = useRouter();
const showTicker = (defaultStore.state.instanceTicker === 'always') || (defaultStore.state.instanceTicker === 'remote' && props.note.user.instance);

const MOBILE_THRESHOLD = 500;
const isMobile = ref(deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD);

async function menuVersions(viaKeyboard = false): Promise<void> {
	const { menu, cleanup } = await getNoteVersionsMenu({ note: props.note, menuVersionsButton });
	popupMenu(menu, menuVersionsButton.value, {
		viaKeyboard,
	}).then(focus).finally(cleanup);
}

function showOnRemote() {
	if (props.note.url ?? props.note.uri === undefined) router.push(notePage(props.note));
	else window.open(props.note.url ?? props.note.uri);
}

const mock = inject<boolean>('mock', false);
</script>

<style lang="scss" module>
.root {
	display: flex;
	cursor: auto; /* not clickToOpen-able */
}

.classicRoot {
	display: flex;
	align-items: baseline;
	white-space: nowrap;
	cursor: auto; /* not clickToOpen-able */
}

.section {
		align-items: flex-start;
		white-space: nowrap;
		flex-direction: column;
		overflow: hidden;

		&:last-child {
			display: flex;
			align-items: flex-end;
			margin-left: auto;
			padding-left: 10px;
			overflow: clip;
		}
}

.name {
	flex-shrink: 1;
	display: block;
	// note, these margin top values were done by hand may need futher checking if it actualy aligns pixel perfect
	margin: 3px .5em 0 0;
	padding: 0;
	overflow: scroll;
	overflow-wrap: anywhere;
	font-size: 1em;
	font-weight: bold;
	text-decoration: none;
	text-overflow: ellipsis;
	max-width: 300px;

		&::-webkit-scrollbar {
			display: none;
		}

		&:hover {
			color: var(--nameHover);
			text-decoration: none;
		}
}

.classicName {
	flex-shrink: 1;
	display: block;
	margin: 0 .5em 0 0;
	padding: 0;
	overflow: hidden;
	font-size: 1em;
	font-weight: bold;
	text-decoration: none;
	text-overflow: ellipsis;

	&:hover {
		text-decoration: underline;
	}
}

.isBot {
	flex-shrink: 0;
	align-self: center;
	margin: 0 .5em 0 0;
	padding: 1px 6px;
	font-size: 80%;
	border: solid 0.5px var(--divider);
	border-radius: var(--radius-xs);
}

.username {
	flex-shrink: 9999999;
	// note these top margins were made to align with the instance ticker
	margin: 4px .5em 0 0;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: .95em;
	max-width: 300px;

	&::-webkit-scrollbar {
		display: none;
	}
}

.classicUsername {
	flex-shrink: 9999999;
	margin: 0 .5em 0 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.info {
	&:first-child {
		margin-top: 4px;
		flex-shrink: 0;
		margin-left: auto;
		font-size: 0.9em;
	}

	&:not(:first-child) {
		flex-shrink: 0;
		margin-left: auto;
		font-size: 0.9em;
	}
}

.classicInfo {
	flex-shrink: 0;
	margin-left: auto;
	font-size: 0.9em;
}

.time {
	text-decoration: none;

	&:hover {
		text-decoration: none;
	}
}

.badgeRoles {
	margin: 0 .5em 0 0;
}

.badgeRole {
	height: 1.3em;
	vertical-align: -20%;

	& + .badgeRole {
		margin-left: 0.2em;
	}
}

.danger {
		color: var(--accent);
	}

	@container (max-width: 500px) {
		.name, .username {
			max-width: 200px;
		}
	}
</style>
