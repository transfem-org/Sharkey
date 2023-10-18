/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class IsSilenced1697624010000 {
    name = 'IsSilenced1697624010000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "isSilenced" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSilenced"`);
    }
}
