<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><MkPageHeader v-model:tab="tab" :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="700">
		<div v-if="tab === 'featured'">
			<MkPagination v-slot="{items}" :pagination="featuredPagesPagination">
				<div class="_gaps">
					<MkPagePreview v-for="page in items" :key="page.id" :page="page"/>
				</div>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'my'" class="_gaps">
			<MkButton class="new" @click="create()"><i class="ph-plus ph-bold ph-lg"></i></MkButton>
			<MkPagination v-slot="{items}" :pagination="myPagesPagination">
				<div class="_gaps">
					<MkPagePreview v-for="page in items" :key="page.id" :page="page"/>
				</div>
			</MkPagination>
		</div>

		<div v-else-if="tab === 'liked'">
			<MkPagination v-slot="{items}" :pagination="likedPagesPagination">
				<div class="_gaps">
					<MkPagePreview v-for="like in items" :key="like.page.id" :page="like.page"/>
				</div>
			</MkPagination>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MkPagePreview from '@/components/MkPagePreview.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkButton from '@/components/MkButton.vue';
import { useRouter } from '@/router.js';
import { i18n } from '@/i18n.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';

const router = useRouter();

let tab = $ref('featured');

const featuredPagesPagination = {
	endpoint: 'pages/featured' as const,
	noPaging: true,
};
const myPagesPagination = {
	endpoint: 'i/pages' as const,
	limit: 5,
};
const likedPagesPagination = {
	endpoint: 'i/page-likes' as const,
	limit: 5,
};

function create() {
	router.push('/pages/new');
}

const headerActions = $computed(() => [{
	icon: 'ph-plus ph-bold ph-lg',
	text: i18n.ts.create,
	handler: create,
}]);

const headerTabs = $computed(() => [{
	key: 'featured',
	title: i18n.ts._pages.featured,
	icon: 'ph-fire ph-bold ph-lg',
}, {
	key: 'my',
	title: i18n.ts._pages.my,
	icon: 'ph-pencil-line ph-bold ph-lg',
}, {
	key: 'liked',
	title: i18n.ts._pages.liked,
	icon: 'ph-heart ph-bold ph-lg',
}]);

definePageMetadata(computed(() => ({
	title: i18n.ts.pages,
	icon: 'ph-note ph-bold ph-lg',
})));
</script>
