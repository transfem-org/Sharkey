<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkA v-user-preview="canonical" :class="[$style.root, { [$style.isMe]: isMe }]" :to="url" :style="{ background: bgCss }">
	<img :class="$style.icon" :src="avatarUrl" alt="">
	<span>
		<span>@{{ username }}</span>
		<span v-if="(host != localHost) || defaultStore.state.showFullAcct" :class="$style.host">@{{ toUnicode(host) }}</span>
	</span>
</MkA>
</template>

<script lang="ts" setup>
import { toUnicode } from 'punycode';
import { computed } from 'vue';
import tinycolor from 'tinycolor2';
import { host as localHost } from '@/config.js';
import { $i } from '@/account.js';
import { defaultStore } from '@/store.js';
import { getStaticImageUrl } from '@/scripts/media-proxy.js';

const props = defineProps<{
	username: string;
	host: string;
}>();

const canonical = props.host === localHost ? `@${props.username}` : `@${props.username}@${toUnicode(props.host)}`;

const url = `/${canonical}`;

const isMe = $i && (
	`@${props.username}@${toUnicode(props.host)}` === `@${$i.username}@${toUnicode(localHost)}`.toLowerCase()
);

const bg = tinycolor(getComputedStyle(document.documentElement).getPropertyValue(isMe ? '--mentionMe' : '--mention'));
bg.setAlpha(0.1);
const bgCss = bg.toRgbString();

const avatarUrl = computed(() => defaultStore.state.disableShowingAnimatedImages
	? getStaticImageUrl(`/avatar/@${props.username}@${props.host}`)
	: `/avatar/@${props.username}@${props.host}`,
);
</script>

<style lang="scss" module>
.root {
	display: inline-block;
	padding: 4px 8px 4px 4px;
	border-radius: var(--radius-ellipse);
	color: var(--mention);

	&.isMe {
		color: var(--mentionMe);
	}
}

.root + .root {
  position: relative;
  margin-inline: -20px 0;
  box-shadow: -4px 0 0 var(--panel), -15px 0 15px var(--panel);
  overflow: clip;
  isolation: isolate;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--panel);
    z-index: -1;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--panel);
    z-index: -1;
    background: inherit;
  }

  span {
    display: inline-block;
    white-space: nowrap;
    max-width: 3em;
    mask: linear-gradient(to right, #000 20%, rgba(0, 0, 0, 0.4));
  }

  + .root {
    margin-inline: -10px 0;
    padding-inline-end: 0;
    box-shadow: -4px 0 0 var(--panel);

    span {
      display: none;
    }
  }
}

.icon {
	width: 1.5em;
	height: 1.5em;
	object-fit: cover;
	margin: 0 0.2em 0 0;
	vertical-align: bottom;
	border-radius: var(--radius-full);
}

.host {
	opacity: 0.5;
}
</style>
