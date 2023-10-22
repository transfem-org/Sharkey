export class AlterNoteEdit1697970083000 {
	name = "AlterNoteEdit1697970083000";

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_edit" RENAME COLUMN "text" TO "newText"`);
		await queryRunner.query(`ALTER TABLE "note_edit" ADD COLUMN "oldText" text`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_edit" RENAME COLUMN "newText" TO "text"`);
		await queryRunner.query(`ALTER TABLE "note_edit" DROP COLUMN "oldText"`);
	}
}
