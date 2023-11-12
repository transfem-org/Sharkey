import * as fs from 'node:fs';
import * as vm from 'node:vm';
import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ZipReader } from 'slacc';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, DriveFilesRepository, MiDriveFile, MiNote } from '@/models/_.js';
import type Logger from '@/logger.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { QueueService } from '@/core/QueueService.js';
import { createTemp, createTempDir } from '@/misc/create-temp.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { DriveService } from '@/core/DriveService.js';
import { MfmService } from '@/core/MfmService.js';
import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import { extractApHashtagObjects } from '@/core/activitypub/models/tag.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbNoteImportToDbJobData, DbNoteImportJobData } from '../types.js';

@Injectable()
export class ImportNotesProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private queueService: QueueService,
		private utilityService: UtilityService,
		private noteCreateService: NoteCreateService,
		private mfmService: MfmService,
		private apNoteService: ApNoteService,
		private driveService: DriveService,
		private downloadService: DownloadService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-notes');
	}
	@bindThis
	private async _keepTweet(tweet: any) {
		if (!tweet.created_at.endsWith(new Date().getFullYear())) {
			return false;
		}
	
		return !tweet.full_text.startsWith('@');
	}

	@bindThis
	private async uploadFiles(dir: any, user: any) {
		const fileList = fs.readdirSync(dir);
		for (const file of fileList) {
			const name = `${dir}/${file}`;
			if (fs.statSync(name).isDirectory()) {
				await this.uploadFiles(name, user);
			} else {
				const exists = await this.driveFilesRepository.findOneBy({ name: file, userId: user.id });

				if (file.endsWith('.srt')) return;

				if (!exists) {
					await this.driveService.addFile({
						user: user,
						path: name,
						name: file,
					});
				}
			}
		}
	}

	@bindThis
	private isIterable(obj: any) {
		if (obj == null) {
			return false;
		}
		return typeof obj[Symbol.iterator] === 'function';
	}

	@bindThis
	public async process(job: Bull.Job<DbNoteImportJobData>): Promise<void> {
		this.logger.info(`Importing following of ${job.data.user.id} ...`);

		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		const file = await this.driveFilesRepository.findOneBy({
			id: job.data.fileId,
		});
		if (file == null) {
			return;
		}

		const type = job.data.type ?? '';

		if (type === 'Twitter' || file.name.startsWith('twitter') && file.name.endsWith('.zip')) {
			const [path, cleanup] = await createTempDir();

			this.logger.info(`Temp dir is ${path}`);

			const destPath = path + '/twitter.zip';

			try {
				fs.writeFileSync(destPath, '', 'binary');
				await this.downloadService.downloadUrl(file.url, destPath);
			} catch (e) { // TODO: 何度か再試行
				if (e instanceof Error || typeof e === 'string') {
					this.logger.error(e);
				}
				throw e;
			}

			const outputPath = path + '/twitter';
			try {
				this.logger.succ(`Unzipping to ${outputPath}`);
				ZipReader.withDestinationPath(outputPath).viaBuffer(await fs.promises.readFile(destPath));
				const fakeWindow: any = {
					window: {
						YTD: {
							tweets: {
								part0: {},
							},
						},
					},
				};
				const script = new vm.Script(fs.readFileSync(outputPath + '/data/tweets.js', 'utf-8'));
				const context = vm.createContext(fakeWindow);
				script.runInContext(context);
				const tweets = Object.keys(fakeWindow.window.YTD.tweets.part0).reduce((m, key, i, obj) => {
					return m.concat(fakeWindow.window.YTD.tweets.part0[key].tweet);
				}, []).filter(this._keepTweet);
				this.queueService.createImportTweetsToDbJob({ id: user.id }, tweets);
			} finally {
				cleanup();
			}
		} else if (file.name.endsWith('.zip')) {
			const [path, cleanup] = await createTempDir();

			this.logger.info(`Temp dir is ${path}`);

			const destPath = path + '/unknown.zip';

			try {
				fs.writeFileSync(destPath, '', 'binary');
				await this.downloadService.downloadUrl(file.url, destPath);
			} catch (e) { // TODO: 何度か再試行
				if (e instanceof Error || typeof e === 'string') {
					this.logger.error(e);
				}
				throw e;
			}

			const outputPath = path + '/unknown';
			try {
				this.logger.succ(`Unzipping to ${outputPath}`);
				ZipReader.withDestinationPath(outputPath).viaBuffer(await fs.promises.readFile(destPath));
				const isInstagram = type === 'Instagram' || fs.existsSync(outputPath + '/instagram_live') || fs.existsSync(outputPath + '/instagram_ads_and_businesses');
				const isOutbox = type === 'Mastodon' || fs.existsSync(outputPath + '/outbox.json');
				if (isInstagram) {
					const postsJson = fs.readFileSync(outputPath + '/content/posts_1.json', 'utf-8');
					const posts = JSON.parse(postsJson);
					await this.uploadFiles(outputPath + '/media/posts', user);
					this.queueService.createImportIGToDbJob({ id: user.id }, posts);
				} else if (isOutbox) {
					const actorJson = fs.readFileSync(outputPath + '/actor.json', 'utf-8');
					const actor = JSON.parse(actorJson);
					const isPleroma = actor['@context'].some((v: any) => typeof v === 'string' && v.match(/litepub(.*)/));
					if (isPleroma) {
						const outboxJson = fs.readFileSync(outputPath + '/outbox.json', 'utf-8');
						const outbox = JSON.parse(outboxJson);
						this.queueService.createImportPleroToDbJob({ id: user.id }, outbox.orderedItems.filter((x: any) => x.type === 'Create' && x.object.type === 'Note'));
					} else {
						const outboxJson = fs.readFileSync(outputPath + '/outbox.json', 'utf-8');
						const outbox = JSON.parse(outboxJson);
						if (fs.existsSync(outputPath + '/media_attachments/files')) await this.uploadFiles(outputPath + '/media_attachments/files', user);
						this.queueService.createImportMastoToDbJob({ id: user.id }, outbox.orderedItems.filter((x: any) => x.type === 'Create' && x.object.type === 'Note'));
					}
				}
			} finally {
				cleanup();
			}
		} else if (job.data.type === 'Misskey' || file.name.startsWith('notes-') && file.name.endsWith('.json')) {
			const [path, cleanup] = await createTemp();

			this.logger.info(`Temp dir is ${path}`);

			try {
				fs.writeFileSync(path, '', 'utf-8');
				await this.downloadService.downloadUrl(file.url, path);
			} catch (e) { // TODO: 何度か再試行
				if (e instanceof Error || typeof e === 'string') {
					this.logger.error(e);
				}
				throw e;
			}

			const notesJson = fs.readFileSync(path, 'utf-8');
			const notes = JSON.parse(notesJson);
			this.queueService.createImportKeyNotesToDbJob({ id: user.id }, notes);
			cleanup();
		}

		this.logger.succ('Import jobs created');
	}

	@bindThis
	public async processKeyNotesToDb(job: Bull.Job<DbNoteImportToDbJobData>): Promise<void> {
		const note = job.data.target;
		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		const files: MiDriveFile[] = [];
		const date = new Date(note.createdAt);

		if (note.files && this.isIterable(note.files)) {
			for await (const file of note.files) {
				const [filePath, cleanup] = await createTemp();
				const slashdex = file.url.lastIndexOf('/');
				const name = file.url.substring(slashdex + 1);

				const exists = await this.driveFilesRepository.findOneBy({ name: name, userId: user.id });

				if (!exists) {
					try {
						await this.downloadService.downloadUrl(file.url, filePath);
					} catch (e) { // TODO: 何度か再試行
						this.logger.error(e instanceof Error ? e : new Error(e as string));
					}
					const driveFile = await this.driveService.addFile({
						user: user,
						path: filePath,
						name: name,
					});
					files.push(driveFile);
				} else {
					files.push(exists);
				}

				cleanup();
			}
		}

		await this.noteCreateService.import(user, { createdAt: date, text: note.text, apMentions: new Array(0), visibility: note.visibility, localOnly: note.localOnly, files: files, cw: note.cw });
		if (note.childNotes) this.queueService.createImportKeyNotesToDbJob(user, note.childNotes);
	}

	@bindThis
	public async processMastoToDb(job: Bull.Job<DbNoteImportToDbJobData>): Promise<void> {
		const toot = job.data.target;
		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		const date = new Date(toot.object.published);
		let text = undefined;
		const files: MiDriveFile[] = [];
		let reply: MiNote | null = null;

		if (toot.object.inReplyTo != null) {
			try {
				reply = await this.apNoteService.resolveNote(toot.object.inReplyTo);
			} catch (error) {
				reply = null;
			}
		}

		if (toot.directMessage) return;

		const hashtags = extractApHashtagObjects(toot.object.tag).map((x) => x.name).filter((x): x is string => x != null);

		try {
			text = await this.mfmService.fromHtml(toot.object.content, hashtags);
		} catch (error) {
			text = undefined;
		}

		if (toot.object.attachment && this.isIterable(toot.object.attachment)) {
			for await (const file of toot.object.attachment) {
				const slashdex = file.url.lastIndexOf('/');
				const name = file.url.substring(slashdex + 1);
				const exists = await this.driveFilesRepository.findOneBy({ name: name, userId: user.id });
				if (exists) {
					files.push(exists);
				}
			}
		}

		await this.noteCreateService.import(user, { createdAt: date, text: text, files: files, apMentions: new Array(0), cw: toot.object.sensitive ? toot.object.summary : null, reply: reply });
	}

	@bindThis
	public async processPleroToDb(job: Bull.Job<DbNoteImportToDbJobData>): Promise<void> {
		const post = job.data.target;
		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		const date = new Date(post.object.published);
		let text = undefined;
		const files: MiDriveFile[] = [];
		let reply: MiNote | null = null;

		if (post.object.inReplyTo != null) {
			try {
				reply = await this.apNoteService.resolveNote(post.object.inReplyTo);
			} catch (error) {
				reply = null;
			}
		}

		if (post.directMessage) return;

		const hashtags = extractApHashtagObjects(post.object.tag).map((x) => x.name).filter((x): x is string => x != null);

		try {
			text = await this.mfmService.fromHtml(post.object.content, hashtags);
		} catch (error) {
			text = undefined;
		}

		if (post.object.attachment && this.isIterable(post.object.attachment)) {
			for await (const file of post.object.attachment) {
				const slashdex = file.url.lastIndexOf('/');
				const name = file.url.substring(slashdex + 1);
				const [filePath, cleanup] = await createTemp();

				const exists = await this.driveFilesRepository.findOneBy({ name: name, userId: user.id });

				if (!exists) {
					try {
						await this.downloadService.downloadUrl(file.url, filePath);
					} catch (e) { // TODO: 何度か再試行
						this.logger.error(e instanceof Error ? e : new Error(e as string));
					}
					const driveFile = await this.driveService.addFile({
						user: user,
						path: filePath,
						name: name,
					});
					files.push(driveFile);
				} else {
					files.push(exists);
				}

				cleanup();
			}
		}

		await this.noteCreateService.import(user, { createdAt: date, text: text, files: files, apMentions: new Array(0), cw: post.object.sensitive ? post.object.summary : null, reply: reply });
	}

	@bindThis
	public async processIGDb(job: Bull.Job<DbNoteImportToDbJobData>): Promise<void> {
		const post = job.data.target;
		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		let date;
		let title;
		const files: MiDriveFile[] = [];

		if (post.media && this.isIterable(post.media) && post.media.length > 1) {
			date = new Date(post.creation_timestamp * 1000);
			title = post.title;
			for await (const file of post.media) {
				const slashdex = file.uri.lastIndexOf('/');
				const name = file.uri.substring(slashdex + 1);
				const exists = await this.driveFilesRepository.findOneBy({ name: name, userId: user.id }) ?? await this.driveFilesRepository.findOneBy({ name: `${name}.jpg`, userId: user.id }) ?? await this.driveFilesRepository.findOneBy({ name: `${name}.mp4`, userId: user.id });
				if (exists) {
					files.push(exists);
				}
			}
		} else if (post.media && this.isIterable(post.media) && !(post.media.length > 1)) {
			date = new Date(post.media[0].creation_timestamp * 1000);
			title = post.media[0].title;
			const slashdex = post.media[0].uri.lastIndexOf('/');
			const name = post.media[0].uri.substring(slashdex + 1);
			const exists = await this.driveFilesRepository.findOneBy({ name: name, userId: user.id }) ?? await this.driveFilesRepository.findOneBy({ name: `${name}.jpg`, userId: user.id }) ?? await this.driveFilesRepository.findOneBy({ name: `${name}.mp4`, userId: user.id });
			if (exists) {
				files.push(exists);
			}
		}

		await this.noteCreateService.import(user, { createdAt: date, text: title, files: files });
	}

	@bindThis
	public async processTwitterDb(job: Bull.Job<DbNoteImportToDbJobData>): Promise<void> {
		const tweet = job.data.target;
		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		if (tweet.in_reply_to_status_id_str) return;

		async function replaceTwitterUrls(full_text: string, urls: any) {
			let full_textedit = full_text;
			urls.forEach((url: any) => {
				full_textedit = full_textedit.replaceAll(url.url, url.expanded_url);
			});
			return full_textedit;
		}

		async function replaceTwitterMentions(full_text: string, mentions: any) {
			let full_textedit = full_text;
			mentions.forEach((mention: any) => {
				full_textedit = full_textedit.replaceAll(`@${mention.screen_name}`, `[@${mention.screen_name}](https://nitter.net/${mention.screen_name})`);
			});
			return full_textedit;
		}

		try {
			const date = new Date(tweet.created_at);
			const textReplaceURLs = tweet.entities.urls && tweet.entities.urls.length > 0 ? await replaceTwitterUrls(tweet.full_text, tweet.entities.urls) : tweet.full_text;
			const text = tweet.entities.user_mentions && tweet.entities.user_mentions.length > 0 ? await replaceTwitterMentions(textReplaceURLs, tweet.entities.user_mentions) : textReplaceURLs; 
			const files: MiDriveFile[] = [];
			
			if (tweet.extended_entities && this.isIterable(tweet.extended_entities.media)) {
				for await (const file of tweet.extended_entities.media) {
					if (file.video_info) {
						const [filePath, cleanup] = await createTemp();
						const slashdex = file.video_info.variants[0].url.lastIndexOf('/');
						const name = file.video_info.variants[0].url.substring(slashdex + 1);

						const exists = await this.driveFilesRepository.findOneBy({ name: name, userId: user.id });

						const videos = file.video_info.variants.filter((x: any) => x.content_type === 'video/mp4');

						if (!exists) {
							try {
								await this.downloadService.downloadUrl(videos[0].url, filePath);
							} catch (e) { // TODO: 何度か再試行
								this.logger.error(e instanceof Error ? e : new Error(e as string));
							}
							const driveFile = await this.driveService.addFile({
								user: user,
								path: filePath,
								name: name,
							});
							files.push(driveFile);
						} else {
							files.push(exists);
						}

						cleanup();
					} else if (file.media_url_https) {
						const [filePath, cleanup] = await createTemp();
						const slashdex = file.media_url_https.lastIndexOf('/');
						const name = file.media_url_https.substring(slashdex + 1);

						const exists = await this.driveFilesRepository.findOneBy({ name: name, userId: user.id });

						if (!exists) {
							try {
								await this.downloadService.downloadUrl(file.media_url_https, filePath);
							} catch (e) { // TODO: 何度か再試行
								this.logger.error(e instanceof Error ? e : new Error(e as string));
							}

							const driveFile = await this.driveService.addFile({
								user: user,
								path: filePath,
								name: name,
							});
							files.push(driveFile);
						} else {
							files.push(exists);
						}
						cleanup();
					}
				}
			}
			await this.noteCreateService.import(user, { createdAt: date, text: text, files: files });
		} catch (e) {
			this.logger.warn(`Error: ${e}`);
		}
	}
}
