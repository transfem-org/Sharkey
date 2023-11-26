export class UpdateIndexable1700228972000 {
    name = 'UpdateIndexable1700228972000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "isIndexable" TO "noindex"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "noindex" SET DEFAULT false`);
        await queryRunner.query(`UPDATE "user" SET "noindex" = NOT "noindex"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`UPDATE "user" SET "noindex" = NOT "noindex"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "noindex" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "noindex" TO "isIndexable"`);
    }
}
