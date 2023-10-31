<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.inline]: inline }]">
	<a v-if="external" :class="$style.main" class="_button" :href="to" target="_blank">
		<span :class="$style.icon"><slot name="icon"></slot></span>
		<span :class="$style.text"><slot></slot></span>
		<span :class="$style.suffix">
			<span :class="$style.suffixText"><slot name="suffix"></slot></span>
			<i class="ph-arrow-square-out ph-bold ph-lg"></i>
		</span>
	</a>
	<MkA v-else :class="[$style.main, { [$style.active]: active }]" class="_button" :to="to" :behavior="behavior">
		<span :class="$style.icon"><slot name="icon"></slot></span>
		<span :class="$style.text"><slot></slot></span>
		<span :class="$style.suffix">
			<span :class="$style.suffixText"><slot name="suffix"></slot></span>
			<i class="ph-caret-right ph-bold ph-lg"></i>
		</span>
	</MkA>
</div>
</template>

<script lang="ts" setup>
import { } from 'vue';

const props = defineProps<{
	to: string;
	active?: boolean;
	external?: boolean;
	behavior?: null | 'window' | 'browser';
	inline?: boolean;
}>();
</script>

<style lang="scss" module>
.root {
	display: block;

	&.inline {
		display: inline-block;
	}
}

.main {
	display: flex;
	align-items: center;
	width: 100%;
	box-sizing: border-box;
	padding: 10px 14px;
	background: var(--buttonBg);
	border-radius: var(--radius-sm);
	font-size: 0.9em;

	&:hover {
		text-decoration: none;
		background: var(--buttonHoverBg);
	}

	&.active {
		color: var(--accent);
		background: var(--buttonHoverBg);
	}
}

.icon {
	margin-right: 0.75em;
	flex-shrink: 0;
	text-align: center;
	color: var(--fgTransparentWeak);

	&:empty {
		display: none;

		& + .text {
			padding-left: 4px;
		}
	}
}

.text {
	flex-shrink: 1;
	white-space: normal;
	padding-right: 12px;
	text-align: center;
}

.suffix {
	margin-left: auto;
	opacity: 0.7;
	white-space: nowrap;

	> .suffixText:not(:empty) {
		margin-right: 0.75em;
	}
}
</style>
