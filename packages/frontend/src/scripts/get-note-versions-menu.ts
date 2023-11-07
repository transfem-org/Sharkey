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
			updatedAt: info.oldDate ? info.oldDate : info.updatedAt,
		}, {
		}, 'closed');
	}

	const menu: MenuItem[] = [];
	const statePromise = os.api('notes/versions', {
		noteId: appearNote.id,
	});

	await statePromise.then((versions) => {
		for (const edit of versions) {
			const _time = edit.oldDate == null ? NaN :
				typeof edit.oldDate === 'number' ? edit.oldDate :
				(edit.oldDate instanceof Date ? edit.oldDate : new Date(edit.oldDate)).getTime();
			
			menu.push({
				icon: 'ph-pencil ph-bold ph-lg',
				text: _time ? dateTimeFormat.format(_time) : dateTimeFormat.format(new Date(edit.updatedAt)),
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
