/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class BotTrending1697603945000 {
    name = 'BotTrending1697603945000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "enableBotTrending" boolean NOT NULL DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "enableBotTrending"`);
    }
}
