export class IsIndexable1699376974000 {
    name = 'IsIndexable1699376974000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "isIndexable" boolean NOT NULL DEFAULT true`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isIndexable"`);
    }
}
