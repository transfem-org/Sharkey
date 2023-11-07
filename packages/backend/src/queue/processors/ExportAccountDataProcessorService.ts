import * as fs from 'node:fs';
import { Inject, Injectable } from '@nestjs/common';
import { In, IsNull, MoreThan, Not } from 'typeorm';
import { format as dateFormat } from 'date-fns';
import mime from 'mime-types';
import archiver from 'archiver';
import { DI } from '@/di-symbols.js';
import type { AntennasRepository, BlockingsRepository, DriveFilesRepository, FollowingsRepository, MiBlocking, MiFollowing, MiMuting, MiNote, MiNoteFavorite, MiPoll, MiUser, MutingsRepository, NoteFavoritesRepository, NotesRepository, PollsRepository, SigninsRepository, UserListMembershipsRepository, UserListsRepository, UserProfilesRepository, UsersRepository } from '@/models/_.js';
import type { Config } from '@/config.js';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { IdService } from '@/core/IdService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { createTemp, createTempDir } from '@/misc/create-temp.js';
import { bindThis } from '@/decorators.js';
import { Packed } from '@/misc/json-schema.js';
import { UtilityService } from '@/core/UtilityService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { EmailService } from '@/core/EmailService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class ExportAccountDataProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.noteFavoritesRepository)
		private noteFavoritesRepository: NoteFavoritesRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.antennasRepository)
		private antennasRepository: AntennasRepository,

		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		@Inject(DI.userListMembershipsRepository)
		private userListMembershipsRepository: UserListMembershipsRepository,

		@Inject(DI.signinsRepository)
		private signinsRepository: SigninsRepository,

		private utilityService: UtilityService,
		private driveService: DriveService,
		private idService: IdService,
		private driveFileEntityService: DriveFileEntityService,
		private downloadService: DownloadService,
		private emailService: EmailService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('export-account-data');
	}

	@bindThis
	public async process(job: Bull.Job): Promise<void> {
		this.logger.info('Exporting Account Data...');

		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		const profile = await this.userProfilesRepository.findOneBy({ userId: job.data.user.id });
		if (profile == null) {
			return;
		}

		const [path, cleanup] = await createTempDir();

		this.logger.info(`Temp dir is ${path}`);

		// User Export

		const userPath = path + '/user.json';

		fs.writeFileSync(userPath, '', 'utf-8');

		const userStream = fs.createWriteStream(userPath, { flags: 'a' });

		const writeUser = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				userStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeUser(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","user":[`);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { host, uri, sharedInbox, followersUri, lastFetchedAt, inbox, ...userTrimmed } = user;

		await writeUser(JSON.stringify(userTrimmed));

		await writeUser(']}');

		userStream.end();

		// Profile Export

		const profilePath = path + '/profile.json';

		fs.writeFileSync(profilePath, '', 'utf-8');

		const profileStream = fs.createWriteStream(profilePath, { flags: 'a' });

		const writeProfile = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				profileStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { emailVerifyCode, twoFactorBackupSecret, twoFactorSecret, password, twoFactorTempSecret, userHost, ...profileTrimmed } = profile;

		await writeProfile(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","profile":[`);

		await writeProfile(JSON.stringify(profileTrimmed));

		await writeProfile(']}');

		profileStream.end();

		// Stored IPs export

		const signins = await this.signinsRepository.findBy({ userId: user.id });

		const ipPath = path + '/ips.json';

		fs.writeFileSync(ipPath, '', 'utf-8');

		const ipStream = fs.createWriteStream(ipPath, { flags: 'a' });

		const writeIPs = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				ipStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeIPs(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","ips":[`);

		for (const signin of signins) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { userId, id, user, ...signinTrimmed } = signin;
			const isFirst = signins.indexOf(signin) === 0;

			await writeIPs(isFirst ? JSON.stringify(signinTrimmed) : ',\n' + JSON.stringify(signinTrimmed));
		}

		await writeIPs(']}');

		ipStream.end();

		// Note Export

		const notesPath = path + '/notes.json';

		fs.writeFileSync(notesPath, '', 'utf-8');

		const notesStream = fs.createWriteStream(notesPath, { flags: 'a' });

		const writeNotes = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				notesStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeNotes(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","notes":[`);

		let noteCursor: MiNote['id'] | null = null;
		let exportedNotesCount = 0;

		while (true) {
			const notes = await this.notesRepository.find({
				where: {
					userId: user.id,
					...(noteCursor ? { id: MoreThan(noteCursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			}) as MiNote[];

			if (notes.length === 0) {
				break;
			}

			noteCursor = notes.at(-1)?.id ?? null;

			for (const note of notes) {
				let poll: MiPoll | undefined;
				if (note.hasPoll) {
					poll = await this.pollsRepository.findOneByOrFail({ noteId: note.id });
				}
				const files = await this.driveFileEntityService.packManyByIds(note.fileIds);
				const content = JSON.stringify(this.noteSerialize(note, poll, files));
				const isFirst = exportedNotesCount === 0;
				await writeNotes(isFirst ? content : ',\n' + content);
				exportedNotesCount++;
			}
		}

		await writeNotes(']}');

		notesStream.end();

		// Following Export

		const followingsPath = path + '/followings.json';

		fs.writeFileSync(followingsPath, '', 'utf-8');

		const followingStream = fs.createWriteStream(followingsPath, { flags: 'a' });

		const writeFollowing = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				followingStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeFollowing(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","followings":[`);

		let followingsCursor: MiFollowing['id'] | null = null;
		let exportedFollowingsCount = 0;

		const mutings = await this.mutingsRepository.findBy({
			muterId: user.id,
		});
		
		while (true) {
			const followings = await this.followingsRepository.find({
				where: {
					followerId: user.id,
					...(mutings.length > 0 ? { followeeId: Not(In(mutings.map(x => x.muteeId))) } : {}),
					...(followingsCursor ? { id: MoreThan(followingsCursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			}) as MiFollowing[];

			if (followings.length === 0) {
				break;
			}

			followingsCursor = followings.at(-1)?.id ?? null;

			for (const following of followings) {
				const u = await this.usersRepository.findOneBy({ id: following.followeeId });
				if (u == null) {
					continue;
				}

				if (u.updatedAt && (Date.now() - u.updatedAt.getTime() > 1000 * 60 * 60 * 24 * 90)) {
					continue;
				}

				const isFirst = exportedFollowingsCount === 0;
				const content = this.utilityService.getFullApAccount(u.username, u.host);
				await writeFollowing(isFirst ? `"${content}"` : ',\n' + `"${content}"`);
				exportedFollowingsCount++;
			}
		}

		await writeFollowing(']}');

		followingStream.end();

		// Followers Export

		const followersPath = path + '/followers.json';

		fs.writeFileSync(followersPath, '', 'utf-8');

		const followerStream = fs.createWriteStream(followersPath, { flags: 'a' });

		const writeFollowers = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				followerStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeFollowers(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","followers":[`);

		let followersCursor: MiFollowing['id'] | null = null;
		let exportedFollowersCount = 0;
		
		while (true) {
			const followers = await this.followingsRepository.find({
				where: {
					followeeId: user.id,
					...(followersCursor ? { id: MoreThan(followersCursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			}) as MiFollowing[];

			if (followers.length === 0) {
				break;
			}

			followersCursor = followers.at(-1)?.id ?? null;

			for (const follower of followers) {
				const u = await this.usersRepository.findOneBy({ id: follower.followerId });
				if (u == null) {
					continue;
				}

				const isFirst = exportedFollowersCount === 0;
				const content = this.utilityService.getFullApAccount(u.username, u.host);
				await writeFollowers(isFirst ? `"${content}"` : ',\n' + `"${content}"`);
				exportedFollowersCount++;
			}
		}

		await writeFollowers(']}');

		followerStream.end();

		// Drive Export

		const filesPath = path + '/drive.json';

		fs.writeFileSync(filesPath, '', 'utf-8');

		const filesStream = fs.createWriteStream(filesPath, { flags: 'a' });

		const writeDrive = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				filesStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		fs.mkdirSync(`${path}/files`);

		await writeDrive(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","drive":[`);

		const driveFiles = await this.driveFilesRepository.find({ where: { userId: user.id } });

		for (const file of driveFiles) {
			const ext = mime.extension(file.type);
			const fileName = file.name + '.' + ext;
			const filePath = path + '/files/' + fileName;
			fs.writeFileSync(filePath, '', 'binary');
			let downloaded = false;

			try {
				await this.downloadService.downloadUrl(file.url, filePath);
				downloaded = true;
			} catch (e) {
				this.logger.error(e instanceof Error ? e : new Error(e as string));
			}

			if (!downloaded) {
				fs.unlinkSync(filePath);
			}

			const content = JSON.stringify({
				fileName: fileName,
				file: file,
			});
			const isFirst = driveFiles.indexOf(file) === 0;

			await writeDrive(isFirst ? content : ',\n' + content);
		}

		await writeDrive(']}');

		filesStream.end();

		// Muting Export

		const mutingPath = path + '/mutings.json';

		fs.writeFileSync(mutingPath, '', 'utf-8');

		const mutingStream = fs.createWriteStream(mutingPath, { flags: 'a' });

		const writeMuting = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				mutingStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeMuting(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","mutings":[`);

		let exportedMutingCount = 0;
		let mutingCursor: MiMuting['id'] | null = null;

		while (true) {
			const mutes = await this.mutingsRepository.find({
				where: {
					muterId: user.id,
					expiresAt: IsNull(),
					...(mutingCursor ? { id: MoreThan(mutingCursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			});

			if (mutes.length === 0) {
				break;
			}

			mutingCursor = mutes.at(-1)?.id ?? null;

			for (const mute of mutes) {
				const u = await this.usersRepository.findOneBy({ id: mute.muteeId });

				if (u == null) {
					exportedMutingCount++; continue;
				}

				const content = this.utilityService.getFullApAccount(u.username, u.host);
				const isFirst = exportedMutingCount === 0;
				await writeMuting(isFirst ? `"${content}"` : ',\n' + `"${content}"`);
				exportedMutingCount++;
			}
		}

		await writeMuting(']}');

		mutingStream.end();

		// Blockings Export

		const blockingPath = path + '/blockings.json';

		fs.writeFileSync(blockingPath, '', 'utf-8');

		const blockingStream = fs.createWriteStream(blockingPath, { flags: 'a' });

		const writeBlocking = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				blockingStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeBlocking(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","blockings":[`);

		let exportedBlockingCount = 0;
		let blockingCursor: MiBlocking['id'] | null = null;

		while (true) {
			const blockings = await this.blockingsRepository.find({
				where: {
					blockerId: user.id,
					...(blockingCursor ? { id: MoreThan(blockingCursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			});

			if (blockings.length === 0) {
				break;
			}

			blockingCursor = blockings.at(-1)?.id ?? null;

			for (const block of blockings) {
				const u = await this.usersRepository.findOneBy({ id: block.blockeeId });

				if (u == null) {
					exportedBlockingCount++; continue;
				}

				const content = this.utilityService.getFullApAccount(u.username, u.host);
				const isFirst = exportedBlockingCount === 0;
				await writeBlocking(isFirst ? `"${content}"` : ',\n' + `"${content}"`);
				exportedBlockingCount++;
			}
		}

		await writeBlocking(']}');

		blockingStream.end();

		// Favorites export

		const favoritePath = path + '/favorites.json';

		fs.writeFileSync(favoritePath, '', 'utf-8');

		const favoriteStream = fs.createWriteStream(favoritePath, { flags: 'a' });

		const writeFavorite = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				favoriteStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeFavorite(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","favorites":[`);

		let exportedFavoritesCount = 0;
		let favoriteCursor: MiNoteFavorite['id'] | null = null;

		while (true) {
			const favorites = await this.noteFavoritesRepository.find({
				where: {
					userId: user.id,
					...(favoriteCursor ? { id: MoreThan(favoriteCursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
				relations: ['note', 'note.user'],
			}) as (MiNoteFavorite & { note: MiNote & { user: MiUser } })[];

			if (favorites.length === 0) {
				break;
			}

			favoriteCursor = favorites.at(-1)?.id ?? null;

			for (const favorite of favorites) {
				let poll: MiPoll | undefined;
				if (favorite.note.hasPoll) {
					poll = await this.pollsRepository.findOneByOrFail({ noteId: favorite.note.id });
				}
				const content = JSON.stringify(this.favoriteSerialize(favorite, poll));
				const isFirst = exportedFavoritesCount === 0;
				await writeFavorite(isFirst ? content : ',\n' + content);
				exportedFavoritesCount++;
			}
		}

		await writeFavorite(']}');

		favoriteStream.end();

		// Antennas export

		const antennaPath = path + '/antennas.json';

		fs.writeFileSync(antennaPath, '', 'utf-8');

		const antennaStream = fs.createWriteStream(antennaPath, { flags: 'a' });

		const writeAntenna = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				antennaStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		await writeAntenna(`{"metaVersion":1,"host":"${this.config.host}","exportedAt":"${new Date().toString()}","antennas":[`);

		const antennas = await this.antennasRepository.findBy({ userId: user.id });

		for (const [index, antenna] of antennas.entries()) {
			let users: MiUser[] | undefined;
			if (antenna.userListId !== null) {
				const memberships = await this.userListMembershipsRepository.findBy({ userListId: antenna.userListId });
				users = await this.usersRepository.findBy({
					id: In(memberships.map(j => j.userId)),
				});
			}

			await writeAntenna(JSON.stringify({
				name: antenna.name,
				src: antenna.src,
				keywords: antenna.keywords,
				excludeKeywords: antenna.excludeKeywords,
				users: antenna.users,
				userListAccts: typeof users !== 'undefined' ? users.map((u) => {
					return this.utilityService.getFullApAccount(u.username, u.host); // acct
				}) : null,
				caseSensitive: antenna.caseSensitive,
				localOnly: antenna.localOnly,
				withReplies: antenna.withReplies,
				withFile: antenna.withFile,
				notify: antenna.notify,
			}));

			if (antennas.length - 1 !== index) {
				await writeAntenna(', ');
			}
		}

		await writeAntenna(']}');

		antennaStream.end();

		// Lists export

		const listPath = path + '/lists.csv';

		fs.writeFileSync(listPath, '', 'utf-8');

		const listStream = fs.createWriteStream(listPath, { flags: 'a' });

		const writeList = (text: string): Promise<void> => {
			return new Promise<void>((res, rej) => {
				listStream.write(text, err => {
					if (err) {
						this.logger.error(err);
						rej(err);
					} else {
						res();
					}
				});
			});
		};

		const lists = await this.userListsRepository.findBy({
			userId: user.id,
		});

		for (const list of lists) {
			const memberships = await this.userListMembershipsRepository.findBy({ userListId: list.id });
			const users = await this.usersRepository.findBy({
				id: In(memberships.map(j => j.userId)),
			});

			for (const u of users) {
				const acct = this.utilityService.getFullApAccount(u.username, u.host);
				const content = `${list.name},${acct}`;
				await writeList(content + '\n');
			}
		}

		listStream.end();

		// Create archive
		await new Promise<void>(async (resolve) => {
			const [archivePath, archiveCleanup] = await createTemp();
			const archiveStream = fs.createWriteStream(archivePath);
			const archive = archiver('zip', {
				zlib: { level: 0 },
			});
			archiveStream.on('close', async () => {
				this.logger.succ(`Exported to: ${archivePath}`);

				const fileName = 'data-request-' + dateFormat(new Date(), 'yyyy-MM-dd-HH-mm-ss') + '.zip';
				const driveFile = await this.driveService.addFile({ user, path: archivePath, name: fileName, force: true });

				this.logger.succ(`Exported to: ${driveFile.id}`);
				cleanup();
				archiveCleanup();
				if (profile.email) {
					this.emailService.sendEmail(profile.email, 
						'Your data archive is ready', 
						`Click the following link to download the archive: ${driveFile.url}<br/>It is also available in your drive.`, 
						`Click the following link to download the archive: ${driveFile.url}\r\n\r\nIt is also available in your drive.`,
					);
				}
				resolve();
			});
			archive.pipe(archiveStream);
			archive.directory(path, false);
			archive.finalize();
		});
	}

	private noteSerialize(note: MiNote, poll: MiPoll | null = null, files: Packed<'DriveFile'>[]): Record<string, unknown> {
		return {
			id: note.id,
			text: note.text,
			createdAt: this.idService.parse(note.id).date.toISOString(),
			fileIds: note.fileIds,
			files: files,
			replyId: note.replyId,
			renoteId: note.renoteId,
			poll: poll,
			cw: note.cw,
			visibility: note.visibility,
			visibleUserIds: note.visibleUserIds,
			localOnly: note.localOnly,
			reactionAcceptance: note.reactionAcceptance,
		};
	}

	private favoriteSerialize(favorite: MiNoteFavorite & { note: MiNote & { user: MiUser } }, poll: MiPoll | null = null): Record<string, unknown> {
		return {
			id: favorite.id,
			createdAt: this.idService.parse(favorite.id).date.toISOString(),
			note: {
				id: favorite.note.id,
				text: favorite.note.text,
				createdAt: this.idService.parse(favorite.note.id).date.toISOString(),
				fileIds: favorite.note.fileIds,
				replyId: favorite.note.replyId,
				renoteId: favorite.note.renoteId,
				poll: poll,
				cw: favorite.note.cw,
				visibility: favorite.note.visibility,
				visibleUserIds: favorite.note.visibleUserIds,
				localOnly: favorite.note.localOnly,
				reactionAcceptance: favorite.note.reactionAcceptance,
				uri: favorite.note.uri,
				url: favorite.note.url,
				user: {
					id: favorite.note.user.id,
					name: favorite.note.user.name,
					username: favorite.note.user.username,
					host: favorite.note.user.host,
					uri: favorite.note.user.uri,
				},
			},
		};
	}
}
