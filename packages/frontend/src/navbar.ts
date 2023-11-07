/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, reactive } from 'vue';
import { $i } from '@/account.js';
import { miLocalStorage } from '@/local-storage.js';
import { openInstanceMenu } from '@/ui/_common_/common.js';
import { lookup } from '@/scripts/lookup.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { ui } from '@/config.js';
import { unisonReload } from '@/scripts/unison-reload.js';
import { instance } from './instance.js';

export const navbarItemDef = reactive({
	notifications: {
		title: i18n.ts.notifications,
		icon: 'ph-bell ph-bold ph-lg',
		show: computed(() => $i != null),
		indicated: computed(() => $i != null && $i.hasUnreadNotification),
		indicateValue: computed(() => {
			if (!$i || $i.unreadNotificationsCount === 0) return '';

			if ($i.unreadNotificationsCount > 99) {
				return '99+';
			} else {
				return $i.unreadNotificationsCount.toString();
			}
		}),
		to: '/my/notifications',
	},
	drive: {
		title: i18n.ts.drive,
		icon: 'ph-cloud ph-bold ph-lg',
		show: computed(() => $i != null),
		to: '/my/drive',
	},
	followRequests: {
		title: i18n.ts.followRequests,
		icon: 'ph-user-plus ph-bold ph-lg',
		show: computed(() => $i != null && $i.isLocked),
		indicated: computed(() => $i != null && $i.hasPendingReceivedFollowRequest),
		to: '/my/follow-requests',
	},
	explore: {
		title: i18n.ts.explore,
		icon: 'ph-hash ph-bold ph-lg',
		to: '/explore',
	},
	announcements: {
		title: i18n.ts.announcements,
		icon: 'ph-megaphone ph-bold ph-lg',
		indicated: computed(() => $i != null && $i.hasUnreadAnnouncement),
		to: '/announcements',
	},
	search: {
		title: i18n.ts.search,
		icon: 'ph-magnifying-glass ph-bold ph-lg',
		to: '/search',
	},
	lookup: {
		title: i18n.ts.lookup,
		icon: 'ph-binoculars ph-bold ph-lg',
		action: (ev) => {
			lookup();
		},
	},
	lists: {
		title: i18n.ts.lists,
		icon: 'ph-list ph-bold ph-lg',
		show: computed(() => $i != null),
		to: '/my/lists',
	},
	antennas: {
		title: i18n.ts.antennas,
		icon: 'ph-flying-saucer ph-bold ph-lg',
		show: computed(() => $i != null),
		to: '/my/antennas',
	},
	favorites: {
		title: i18n.ts.favorites,
		icon: 'ph-star ph-bold ph-lg',
		show: computed(() => $i != null),
		to: '/my/favorites',
	},
	pages: {
		title: i18n.ts.pages,
		icon: 'ph-newspaper ph-bold ph-lg',
		to: '/pages',
	},
	play: {
		title: 'Play',
		icon: 'ph-play ph-bold ph-lg',
		to: '/play',
	},
	gallery: {
		title: i18n.ts.gallery,
		icon: 'ph-images ph-bold ph-lg',
		to: '/gallery',
	},
	clips: {
		title: i18n.ts.clip,
		icon: 'ph-paperclip ph-bold ph-lg',
		show: computed(() => $i != null),
		to: '/my/clips',
	},
	channels: {
		title: i18n.ts.channel,
		icon: 'ph-television ph-bold ph-lg',
		to: '/channels',
	},
	achievements: {
		title: i18n.ts.achievements,
		icon: 'ph-trophy ph-bold ph-lg',
		show: computed(() => $i != null && instance.enableAchievements),
		to: '/my/achievements',
	},
	ui: {
		title: i18n.ts.switchUi,
		icon: 'ph-devices ph-bold ph-lg',
		action: (ev) => {
			os.popupMenu([{
				text: i18n.ts.default,
				active: ui === 'default' || ui === null,
				action: () => {
					miLocalStorage.setItem('ui', 'default');
					unisonReload();
				},
			}, {
				text: i18n.ts.deck,
				active: ui === 'deck',
				action: () => {
					miLocalStorage.setItem('ui', 'deck');
					unisonReload();
				},
			}, {
				text: i18n.ts.classic,
				active: ui === 'classic',
				action: () => {
					miLocalStorage.setItem('ui', 'classic');
					unisonReload();
				},
			}], ev.currentTarget ?? ev.target);
		},
	},
	about: {
		title: i18n.ts.about,
		icon: 'ph-info ph-bold ph-lg',
		action: (ev) => {
			openInstanceMenu(ev);
		},
	},
	reload: {
		title: i18n.ts.reload,
		icon: 'ph-arrows-clockwise ph-bold ph-lg',
		action: (ev) => {
			location.reload();
		},
	},
	profile: {
		title: i18n.ts.profile,
		icon: 'ph-user ph-bold ph-lg',
		show: computed(() => $i != null),
		to: `/@${$i?.username}`,
	},
});
