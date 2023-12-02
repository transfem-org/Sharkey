<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkPagination ref="pagingComponent" :pagination="pagination" :disableAutoLoad="disableAutoLoad">
	<template #empty>
		<div class="_fullinfo">
			<img :src="infoImageUrl" class="_ghost"/>
			<div>{{ i18n.ts.noNotes }}</div>
		</div>
	</template>

	<template #default="{ items: notes }">
		<div :class="[$style.root, { [$style.noGap]: noGap }]">
			<MkDateSeparatedList
				v-if="defaultStore.state.noteDesign === 'misskey'"
				ref="notes"
				v-slot="{ item: note }"
				:items="notes"
				:direction="pagination.reversed ? 'up' : 'down'"
				:reversed="pagination.reversed"
				:noGap="noGap"
				:ad="true"
				:class="$style.notes"
			>
				<MkNote :key="note._featuredId_ || note._prId_ || note.id" :class="$style.note" :note="note"/>
			</MkDateSeparatedList>
			<MkDateSeparatedList
				v-else-if="defaultStore.state.noteDesign === 'sharkey'"
				ref="notes" 
				v-slot="{ item: note }"
				:items="notes"
				:direction="pagination.reversed ? 'up' : 'down'"
				:reversed="pagination.reversed"
				:noGap="noGap"
				:ad="true"
				:class="$style.notes"
			>
				<SkNote :key="note._featuredId_ || note._prId_ || note.id" :class="$style.note" :note="note"/>
			</MkDateSeparatedList>
		</div>
	</template>
</MkPagination>
</template>

<script lang="ts" setup>
import { shallowRef, ref } from 'vue';
import MkNote from '@/components/MkNote.vue';
import SkNote from '@/components/SkNote.vue';
import MkDateSeparatedList from '@/components/MkDateSeparatedList.vue';
import MkPagination, { Paging } from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { infoImageUrl } from '@/instance.js';
import { defaultStore } from '@/store.js';

console.log(defaultStore.state.noteDesign, defaultStore.state.noteDesign === 'sharkey');

const props = defineProps<{
	pagination: Paging;
	noGap?: boolean;
	disableAutoLoad?: boolean;
}>();

const pagingComponent = shallowRef<InstanceType<typeof MkPagination>>();

defineExpose({
	pagingComponent,
});
</script>

<style lang="scss" module>
.root {
	&.noGap {
		border-radius: var(--radius);

		> .notes {
			background: color-mix(in srgb, var(--panel) 65%, transparent);
		}
	}

	&:not(.noGap) {
		> .notes {
			background: var(--bg);

			.note {
				background: color-mix(in srgb, var(--panel) 65%, transparent);
				border-radius: var(--radius);
			}
		}
	}
}
</style>
