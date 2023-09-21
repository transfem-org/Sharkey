/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

//import bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		currentPassword: { type: 'string' },
		newPassword: { type: 'string', minLength: 1 },
	},
	required: ['currentPassword', 'newPassword'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: me.id });

			// Compare password
			const same = await argon2.verify(profile.password!, ps.currentPassword);

			if (!same) {
				throw new Error('incorrect password');
			}

			// Generate hash of password
			//const salt = await bcrypt.genSalt(8);
			const hash = await argon2.hash(ps.newPassword);

			await this.userProfilesRepository.update(me.id, {
				password: hash,
			});
		});
	}
}
