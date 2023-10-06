export class SpeakAsCat1696386694000 {
	name = "SpeakAsCat1696386694000";

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" ADD "speakAsCat" boolean NOT NULL DEFAULT true`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."speakAsCat" IS 'Whether to speak as a cat if chosen.'`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "speakAsCat"`);
	}
}
