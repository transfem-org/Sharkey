export class OldDateNoteEdit1697970083001 {
	name = "OldDateNoteEdit1697970083001";

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_edit" ADD COLUMN "oldDate" TIMESTAMP WITH TIME ZONE`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "note_edit" DROP COLUMN "oldDate"`);
	}
}
