<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs"/></template>
	<div>
		<div v-if="user">
			<XHome v-if="tab === 'home'" :user="user"/>
			<XTimeline v-else-if="tab === 'notes'" :user="user"/>
			<XActivity v-else-if="tab === 'activity'" :user="user"/>
			<XAchievements v-else-if="tab === 'achievements'" :user="user"/>
			<XReactions v-else-if="tab === 'reactions'" :user="user"/>
			<XClips v-else-if="tab === 'clips'" :user="user"/>
			<XLists v-else-if="tab === 'lists'" :user="user"/>
			<XPages v-else-if="tab === 'pages'" :user="user"/>
			<XFlashs v-else-if="tab === 'flashs'" :user="user"/>
			<XGallery v-else-if="tab === 'gallery'" :user="user"/>
		</div>
		<MkError v-else-if="error" @retry="fetchUser()"/>
		<MkLoading v-else/>
	</div>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, watch } from 'vue';
import * as Misskey from 'misskey-js';
import { acct as getAcct } from '@/filters/user.js';
import * as os from '@/os.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';

const XHome = defineAsyncComponent(() => import('./home.vue'));
const XTimeline = defineAsyncComponent(() => import('./index.timeline.vue'));
const XActivity = defineAsyncComponent(() => import('./activity.vue'));
const XAchievements = defineAsyncComponent(() => import('./achievements.vue'));
const XReactions = defineAsyncComponent(() => import('./reactions.vue'));
const XClips = defineAsyncComponent(() => import('./clips.vue'));
const XLists = defineAsyncComponent(() => import('./lists.vue'));
const XPages = defineAsyncComponent(() => import('./pages.vue'));
const XFlashs = defineAsyncComponent(() => import('./flashs.vue'));
const XGallery = defineAsyncComponent(() => import('./gallery.vue'));

const props = withDefaults(defineProps<{
	acct: string;
	page?: string;
}>(), {
	page: 'home',
});

let tab = $ref(props.page);
let user = $ref<null | Misskey.entities.UserDetailed>(null);
let error = $ref(null);

function fetchUser(): void {
	if (props.acct == null) return;
	user = null;
	os.api('users/show', Misskey.acct.parse(props.acct)).then(u => {
		user = u;
	}).catch(err => {
		error = err;
	});
}

watch(() => props.acct, fetchUser, {
	immediate: true,
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => user ? [{
	key: 'home',
	title: i18n.ts.overview,
	icon: 'ph-house ph-bold ph-lg',
}, {
	key: 'notes',
	title: i18n.ts.notes,
	icon: 'ph-pencil ph-bold ph-lg',
}, {
	key: 'activity',
	title: i18n.ts.activity,
	icon: 'ph-chart-line ph-bold ph-lg',
}, ...(user.host == null ? [{
	key: 'achievements',
	title: i18n.ts.achievements,
	icon: 'ph-trophy ph-bold ph-lg',
}] : []), ...($i && ($i.id === user.id)) || user.publicReactions ? [{
	key: 'reactions',
	title: i18n.ts.reaction,
	icon: 'ph-smiley ph-bold ph-lg',
}] : [], {
	key: 'clips',
	title: i18n.ts.clips,
	icon: 'ph-paperclip ph-bold ph-lg',
}, {
	key: 'lists',
	title: i18n.ts.lists,
	icon: 'ph-list ph-bold ph-lg',
}, {
	key: 'pages',
	title: i18n.ts.pages,
	icon: 'ph-newspaper ph-bold ph-lg',
}, {
	key: 'flashs',
	title: 'Play',
	icon: 'ph-play ph-bold ph-lg',
}, {
	key: 'gallery',
	title: i18n.ts.gallery,
	icon: 'ph-images-square ph-bold ph-lg',
}] : []);

definePageMetadata(computed(() => user ? {
	icon: 'ph-user ph-bold ph-lg',
	title: user.name ? `${user.name} (@${user.username})` : `@${user.username}`,
	subtitle: `@${getAcct(user)}`,
	userName: user,
	avatar: user,
	path: `/@${user.username}`,
	share: {
		title: user.name,
	},
} : null));
</script>
