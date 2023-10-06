export class Clean1696332072038 {
    name = 'Clean1696332072038'

    async up(queryRunner) {
    
        await queryRunner.query(`DROP INDEX "public"."IDX_d844bfc6f3f523a05189076efa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_605472305f26818cc93d1baaa7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90f7da835e4c10aca6853621e1"`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "preservedUsernames" SET DEFAULT '{ "admin", "administrator", "root", "system", "maintainer", "host", "mod", "moderator", "owner", "superuser", "staff", "auth", "i", "me", "everyone", "all", "mention", "mentions", "example", "user", "users", "account", "accounts", "official", "help", "helps", "support", "supports", "info", "information", "informations", "announce", "announces", "announcement", "announcements", "notice", "notification", "notifications", "dev", "developer", "developers", "tech", "misskey" }'`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_e4f3094c43f2d665e6030b0337"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cddcaf418dc4d392ecfcca842a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_021015e6683570ae9f6b0c62be"`);
        await queryRunner.query(`ALTER TABLE "meta" ALTER COLUMN "preservedUsernames" SET DEFAULT '{admin,administrator,root,system,maintainer,host,mod,moderator,owner,superuser,staff,auth,i,me,everyone,all,mention,mentions,example,user,users,account,accounts,official,help,helps,support,supports,info,information,informations,announce,announces,announcement,announcements,notice,notification,notifications,dev,developer,developers,tech,misskey}'`);
    }
}
