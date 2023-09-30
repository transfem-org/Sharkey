/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as os from '@/os.js';
import { instance } from '@/instance.js';
import { host } from '@/config.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/account.js';

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
		icon: 'ph-smiley ph-bold pg-lg',
		to: '/about#emojis',
	}, {
		type: 'link',
		text: i18n.ts.federation,
		icon: 'ph-globe-hemisphere-west ph-bold ph-lg',
		to: '/about#federation',
	}, {
		type: 'link',
		text: i18n.ts.charts,
		icon: 'ph-chart-line ph-bold pg-lg',
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
		icon: 'ph-wrench ph-bold ph-lg',
		children: [{
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
			icon: 'ph-cookie ph-bold pg-lg',
		}, ($i && ($i.isAdmin || $i.policies.canManageCustomEmojis)) ? {
			type: 'link',
			to: '/custom-emojis-manager',
			text: i18n.ts.manageCustomEmojis,
			icon: 'ph-smiley ph-bold pg-lg',
		} : undefined],
	}, null, {
		text: i18n.ts.help,
		icon: 'ph-question ph-bold ph-lg',
		action: () => {
			window.open('https://misskey-hub.net/help.html', '_blank');
		},
	}, {
		type: 'link',
		text: i18n.ts.aboutMisskey,
		to: '/about-sharkey',
	}], ev.currentTarget ?? ev.target, {
		align: 'left',
	});
}
