export class NoteEdit1682753227899 {
	name = "NoteEdit1682753227899";

	async up(queryRunner) {
		await queryRunner.query(`
			CREATE TABLE "note_edit" (
					"id" character varying(32) NOT NULL,
					"noteId" character varying(32) NOT NULL,
					"text" text,
					"cw" character varying(512),
					"fileIds" character varying(32) array NOT NULL DEFAULT '{}',
					"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
					CONSTRAINT "PK_736fc6e0d4e222ecc6f82058e08" PRIMARY KEY ("id")
			)
		`);
		await queryRunner.query(`
			COMMENT ON COLUMN "note_edit"."noteId" IS 'The ID of note.'
		`);
		await queryRunner.query(`
			COMMENT ON COLUMN "note_edit"."updatedAt" IS 'The updated date of the Note.'
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_702ad5ae993a672e4fbffbcd38" ON "note_edit" ("noteId")
		`);
		await queryRunner.query(`
			ALTER TABLE "note"
			ADD "updatedAt" TIMESTAMP WITH TIME ZONE
		`);
		await queryRunner.query(`
			COMMENT ON COLUMN "note"."updatedAt" IS 'The updated date of the Note.'
		`);
		await queryRunner.query(`
			ALTER TABLE "note_edit"
			ADD CONSTRAINT "FK_702ad5ae993a672e4fbffbcd38c"
			FOREIGN KEY ("noteId")
			REFERENCES "note"("id")
			ON DELETE CASCADE
			ON UPDATE NO ACTION
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "note_edit" DROP CONSTRAINT "FK_702ad5ae993a672e4fbffbcd38c"
		`);
		await queryRunner.query(`
			ALTER TABLE "note" DROP COLUMN "updatedAt"
		`);
		await queryRunner.query(`
			DROP TABLE "note_edit"
		`);
	}
}
