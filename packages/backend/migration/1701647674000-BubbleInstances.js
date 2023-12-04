export class BubbleInstances1701647674000 {
    name = 'BubbleInstances1701647674000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "bubbleInstances" character varying(256) array NOT NULL DEFAULT '{}'::varchar[]`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "bubbleInstances"`);
    }
}
