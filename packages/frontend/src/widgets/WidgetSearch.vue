<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :showHeader="widgetProps.showHeader" class="skw-search">
	<MkInput v-model="searchQuery" :large="true" :autofocus="true" type="search" @keydown="onInputKeydown">
		<template #suffix>
			<button style="border: none; background: none; margin-right: 0.5em; z-index: 2; pointer-events: auto; position: relative; margin-top: 0 auto;" @click="options"><i class="ph-funnel ph-bold ph-lg"></i></button>
			<button style="border: none; background: none; z-index: 2; pointer-events: auto; position: relative; margin: 0 auto;" @click="search"><i class="ph-magnifying-glass ph-bold ph-lg"></i></button>
		</template>
	</MkInput>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { useWidgetPropsManager, Widget, WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import MkInput from '@/components/MkInput.vue';
import MkContainer from '@/components/MkContainer.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { useRouter } from '@/router.js';
import { GetFormResultType } from '@/scripts/form.js';

const name = 'search';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean' as const,
		default: false,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

function onInputKeydown(evt: KeyboardEvent) {
	if (evt.key === 'Enter') {
		evt.preventDefault();
		evt.stopPropagation();
		search();
	}
}

const router = useRouter();

let key = $ref(0);
let searchQuery = $ref('');
let notePagination = $ref();
let searchOrigin = $ref('combined');
let user = $ref(null);
let isLocalOnly = $ref(false);
let order = $ref(true);
let filetype = $ref(null);

function options(ev) {
	os.popupMenu([{
		type: 'parent',
		text: 'With File',
		icon: 'ph-file ph-bold ph-lg',
		children: [
			{
				type: 'button',
				icon: 'ph-image ph-bold ph-lg',
				text: 'With Images',
				action: () => {
					filetype = 'image';
				},
			},
			{
				type: 'button',
				icon: 'ph-music-notes-simple ph-bold ph-lg',
				text: 'With Audios',
				action: () => {
					filetype = 'audio';
				},
			},
			{
				type: 'button',
				icon: 'ph-video ph-bold ph-lg',
				text: 'With Videos',
				action: () => {
					filetype = 'video';
				},
			}],
	}], ev.currentTarget ?? ev.target);
}

function selectUser() {
	os.selectUser().then(_user => {
		user = _user;
	});
}

async function search() {
	const query = searchQuery.toString().trim();

	if (query == null || query === '') return;

	if (query.startsWith('https://')) {
		const promise = os.api('ap/show', {
			uri: query,
		});

		os.promiseDialog(promise, null, null, i18n.ts.fetchingAsApObject);

		const res = await promise;

		if (res.type === 'User') {
			router.push(`/@${res.object.username}@${res.object.host}`);
		} else if (res.type === 'Note') {
			router.push(`/notes/${res.object.id}`);
		}

		return;
	}

	notePagination = {
		endpoint: 'notes/search',
		limit: 10,
		params: {
			query: searchQuery,
			userId: user ? user.id : null,
			order: order ? 'desc' : 'asc',
			filetype: filetype,
		},
	};

	if (isLocalOnly) notePagination.params.host = '.';

	key++;

	os.popup(defineAsyncComponent(() => import('@/components/SkSearchResultWindow.vue')), {
		noteKey: key,
		notePagination: notePagination,
	}, {
	}, 'closed');
}

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>
