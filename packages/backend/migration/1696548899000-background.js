export class Background1696548899000 {
    name = 'Background1696548899000'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "backgroundId" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "REL_fwvhvbijn8nocsdpqhn012pfo5" UNIQUE ("backgroundId")`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_q5lm0tbgejtfskzg0rc4wd7t1n" FOREIGN KEY ("backgroundId") REFERENCES "drive_file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD "backgroundUrl" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "backgroundBlurhash" character varying(128)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "REL_fwvhvbijn8nocsdpqhn012pfo5"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_q5lm0tbgejtfskzg0rc4wd7t1n"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "backgroundId"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "backgroundUrl"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "backgroundBlurhash"`);
    }
}