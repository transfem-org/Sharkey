<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :style="bg">
	<img v-if="faviconUrl" :class="$style.icon" :src="faviconUrl"/>
	<div :class="$style.name">{{ instance.name }}</div>
</div>
</template>

<script lang="ts" setup>
import { } from 'vue';
import { instanceName } from '@/config.js';
import { instance as Instance } from '@/instance.js';
import { getProxiedImageUrlNullable } from '@/scripts/media-proxy.js';

const props = defineProps<{
	instance?: {
		faviconUrl?: string
		name: string
		themeColor?: string
	}
}>();

// if no instance data is given, this is for the local instance
const instance = props.instance ?? {
	name: instanceName,
	themeColor: (document.querySelector('meta[name="theme-color-orig"]') as HTMLMetaElement).content,
};

const faviconUrl = $computed(() => props.instance ? getProxiedImageUrlNullable(props.instance.faviconUrl, 'preview') : getProxiedImageUrlNullable(Instance.iconUrl, 'preview') ?? getProxiedImageUrlNullable(Instance.faviconUrl, 'preview') ?? '/favicon.ico');

const themeColor = instance.themeColor ?? '#777777';

const bg = {
	//background: `linear-gradient(90deg, ${themeColor}, ${themeColor}00)`,
	background: `${themeColor}`,
};
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	height: 1.5ex;
	border-radius: var(--radius-xl);
	margin-top: 5px;
	padding: 4px;
	overflow: clip;
	color: #fff;
	text-shadow: -1px -1px 0 var(--bg),1px -1px 0 var(--bg),-1px 1px 0 var(--bg),1px 1px 0 var(--bg)
}

.icon {
	height: 2ex;
	flex-shrink: 0;
}

.name {
	margin-left: 4px;
	line-height: 1;
	font-size: 0.8em;
	font-weight: bold;
	white-space: nowrap;
	overflow: hidden;
	overflow-wrap: anywhere;
	max-width: 300px;
	text-overflow: ellipsis;

	&::-webkit-scrollbar {
		display: none;
	}
}

@container (max-width: 400px) {
	.name {
		max-width: 50px;
	}
}
</style>
