<template>
<MkWindow ref="window" :initialWidth="600" :initialHeight="450" :canResize="true" @closed="emit('closed')">
	<template #header>
		<i class="ph-magnifying-glass ph-bold ph-lg" style="margin-right: 0.5em;"></i>
		<b>Result</b>
	</template>
	<MkNotes :key="props.noteKey" :pagination="props.notePagination"/>
</MkWindow>
</template>

<script lang="ts" setup>
import { } from 'vue';
import type { Paging } from '@/components/MkPagination.vue';
import MkNotes from '@/components/MkNotes.vue';
import MkWindow from '@/components/MkWindow.vue';

const props = defineProps<{
	noteKey: string | number | symbol | undefined;
	notePagination: Paging;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

</script>

<style lang="scss" module>

</style>
