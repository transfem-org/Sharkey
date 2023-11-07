/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { defineAsyncComponent } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import * as os from '@/os.js';
import { instance } from '@/instance.js';
import { host } from '@/config.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';

function toolsMenuItems(): MenuItem[] {
	return [{
		type: 'link',
		to: '/scratchpad',
		text: i18n.ts.scratchpad,
		icon: 'ph-terminal-window ph-bold ph-lg-2',
	}, {
		type: 'link',
		to: '/api-console',
		text: 'API Console',
		icon: 'ph-terminal-window ph-bold ph-lg-2',
	}, {
		type: 'link',
		to: '/clicker',
		text: '🍪👈',
		icon: 'ph-cookie ph-bold ph-lg',
	}, ($i && ($i.isAdmin || $i.policies.canManageCustomEmojis)) ? {
		type: 'link',
		to: '/custom-emojis-manager',
		text: i18n.ts.manageCustomEmojis,
		icon: 'ph-smiley ph-bold ph-lg',
	} : undefined, ($i && ($i.isAdmin || $i.policies.canManageAvatarDecorations)) ? {
		type: 'link',
		to: '/admin/avatar-decorations',
		text: i18n.ts.manageAvatarDecorations,
		icon: 'ph-sparkle ph-bold ph-lg',
	} : undefined];
}

export function openInstanceMenu(ev: MouseEvent) {
	os.popupMenu([{
		text: instance.name ?? host,
		type: 'label',
	}, {
		type: 'link',
		text: i18n.ts.instanceInfo,
		icon: 'ph-info ph-bold ph-lg',
		to: '/about',
	}, {
		type: 'link',
		text: i18n.ts.customEmojis,
		icon: 'ph-smiley ph-bold ph-lg',
		to: '/about#emojis',
	}, {
		type: 'link',
		text: i18n.ts.federation,
		icon: 'ph-globe-hemisphere-west ph-bold ph-lg',
		to: '/about#federation',
	}, {
		type: 'link',
		text: i18n.ts.charts,
		icon: 'ph-chart-line ph-bold ph-lg',
		to: '/about#charts',
	}, null, {
		type: 'link',
		text: i18n.ts.ads,
		icon: 'ph-flag ph-bold ph-lg',
		to: '/ads',
	}, ($i && ($i.isAdmin || $i.policies.canInvite) && instance.disableRegistration) ? {
		type: 'link',
		to: '/invite',
		text: i18n.ts.invite,
		icon: 'ph-user-plus ph-bold ph-lg',
	} : undefined, {
		type: 'parent',
		text: i18n.ts.tools,
		icon: 'ph-toolbox ph-bold ph-lg',
		children: toolsMenuItems(),
	}, null, (instance.impressumUrl) ? {
		text: i18n.ts.impressum,
		icon: 'ph-newspaper-clipping ph-bold ph-lg',
		action: () => {
			window.open(instance.impressumUrl, '_blank');
		},
	} : undefined, (instance.tosUrl) ? {
		text: i18n.ts.termsOfService,
		icon: 'ph-notebook ph-bold ph-lg',
		action: () => {
			window.open(instance.tosUrl, '_blank');
		},
	} : undefined, (instance.privacyPolicyUrl) ? {
		text: i18n.ts.privacyPolicy,
		icon: 'ph-shield ph-bold ph-lg',
		action: () => {
			window.open(instance.privacyPolicyUrl, '_blank');
		},
	} : undefined, (!instance.impressumUrl && !instance.tosUrl && !instance.privacyPolicyUrl) ? undefined : null, {
		text: i18n.ts.help,
		icon: 'ph-question ph-bold ph-lg',
		action: () => {
			window.open('https://misskey-hub.net/help.html', '_blank');
		},
	}, ($i) ? {
		text: i18n.ts._initialTutorial.launchTutorial,
		icon: 'ph-presentation ph-bold ph-lg',
		action: () => {
			os.popup(defineAsyncComponent(() => import('@/components/MkTutorialDialog.vue')), {}, {}, 'closed');
		},
	} : undefined, {
		type: 'link',
		text: i18n.ts.aboutMisskey,
		to: '/about-sharkey',
	}], ev.currentTarget ?? ev.target, {
		align: 'left',
	});
}

export function openToolsMenu(ev: MouseEvent) {
	os.popupMenu(toolsMenuItems(), ev.currentTarget ?? ev.target, {
		align: 'left',
	});
}
