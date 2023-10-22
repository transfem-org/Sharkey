import { Ref, defineAsyncComponent } from 'vue';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { MenuItem } from '@/types/menu.js';
import { dateTimeFormat } from './intl-const.js';

export async function getNoteVersionsMenu(props: {
	note: Misskey.entities.Note;
	menuButton: Ref<HTMLElement>;
}) {
	const isRenote = (
		props.note.renote != null &&
		props.note.text == null &&
		props.note.fileIds.length === 0 &&
		props.note.poll == null
	);

	const appearNote = isRenote ? props.note.renote as Misskey.entities.Note : props.note;

	const cleanups = [] as (() => void)[];

	function openVersion(info): void {
		os.popup(defineAsyncComponent(() => import('@/components/SkOldNoteWindow.vue')), {
			note: appearNote,
			oldText: info.text,
			updatedAt: info.updatedAt,
		}, {
		}, 'closed');
	}

	const menu: MenuItem[] = [];
	const statePromise = os.api('notes/versions', {
		noteId: appearNote.id,
	});

	await statePromise.then((versions) => {
		for (const edit of versions) {
			const _time = edit.updatedAt == null ? NaN :
				typeof edit.updatedAt === 'number' ? edit.updatedAt :
				(edit.updatedAt instanceof Date ? edit.updatedAt : new Date(edit.updatedAt)).getTime();
			
			menu.push({
				icon: 'ph-pencil ph-bold ph-lg',
				text: dateTimeFormat.format(_time),
				action: () => openVersion(edit),
			});
		}
	});

	const cleanup = () => {
		if (_DEV_) console.log('note menu cleanup', cleanups);
		for (const cl of cleanups) {
			cl();
		}
	};

	return {
		menu,
		cleanup,
	};
}
