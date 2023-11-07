<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkSpacer :contentMax="narrow ? 800 : 1100" :style="background">
	<div ref="rootEl" class="ftskorzw" :class="{ wide: !narrow }" style="container-type: inline-size;">
		<div class="main _gaps">
			<MkInfo v-if="user.isSuspended" :warn="true">{{ i18n.ts.userSuspended }}</MkInfo>
			<MkInfo v-if="user.isSilenced" :warn="true">{{ i18n.ts.userSilenced }}</MkInfo>

			<div class="profile _gaps">
				<MkAccountMoved v-if="user.movedTo" :movedTo="user.movedTo"/>
				<MkRemoteCaution v-if="user.host != null" :href="user.url ?? user.uri!" class="warn"/>

				<div :key="user.id" class="main _panel">
					<div class="banner-container" :style="style">
						<div ref="bannerEl" class="banner" :style="style"></div>
						<div class="fade"></div>
						<div class="title">
							<MkUserName class="name" :user="user" :nowrap="true"/>
							<div class="bottom">
								<span class="username"><MkAcct :user="user" :detail="true"/></span>
								<span v-if="user.isAdmin" :title="i18n.ts.isAdmin" style="color: var(--badge);"><i class="ph-shield ph-bold ph-lg"></i></span>
								<span v-if="user.isLocked" :title="i18n.ts.isLocked"><i class="ph-lock ph-bold ph-lg"></i></span>
								<span v-if="user.isBot" :title="i18n.ts.isBot"><i class="ph-robot ph-bold ph-lg"></i></span>
								<button v-if="!isEditingMemo && !memoDraft" class="_button add-note-button" @click="showMemoTextarea">
									<i class="ph-pencil-line ph-bold ph-lg"/> {{ i18n.ts.addMemo }}
								</button>
							</div>
						</div>
						<span v-if="$i && $i.id != user.id && user.isFollowed" class="followed">{{ i18n.ts.followsYou }}</span>
						<div v-if="$i" class="actions">
							<button class="menu _button" @click="menu"><i class="ph-dots-three ph-bold ph-lg"></i></button>
							<MkFollowButton v-if="$i.id != user.id" v-model:user="user" :inline="true" :transparent="false" :full="true" class="koudoku"/>
						</div>
					</div>
					<MkAvatar class="avatar" :user="user" indicator/>
					<div class="title">
						<MkUserName :user="user" :nowrap="false" class="name"/>
						<div class="bottom">
							<span class="username"><MkAcct :user="user" :detail="true"/></span>
							<span v-if="user.isAdmin" :title="i18n.ts.isAdmin" style="color: var(--badge);"><i class="ph-shield ph-bold ph-lg"></i></span>
							<span v-if="user.isLocked" :title="i18n.ts.isLocked"><i class="ph-lock ph-bold ph-lg"></i></span>
							<span v-if="user.isBot" :title="i18n.ts.isBot"><i class="ph-robot ph-bold ph-lg"></i></span>
						</div>
					</div>
					<div v-if="user.roles.length > 0" class="roles">
						<span v-for="role in user.roles" :key="role.id" v-tooltip="role.description" class="role" :style="{ '--color': role.color }">
							<MkA v-adaptive-bg :to="`/roles/${role.id}`">
								<img v-if="role.iconUrl" style="height: 1.3em; vertical-align: -22%;" :src="role.iconUrl"/>
								{{ role.name }}
							</MkA>
						</span>
					</div>
					<div v-if="iAmModerator" class="moderationNote">
						<MkTextarea v-if="editModerationNote || (moderationNote != null && moderationNote !== '')" v-model="moderationNote" manualSave>
							<template #label>{{ i18n.ts.moderationNote }}</template>
						</MkTextarea>
						<div v-else>
							<MkButton small @click="editModerationNote = true">{{ i18n.ts.addModerationNote }}</MkButton>
						</div>
					</div>
					<div v-if="isEditingMemo || memoDraft" class="memo" :class="{'no-memo': !memoDraft}">
						<div class="heading" v-text="i18n.ts.memo"/>
						<textarea
							ref="memoTextareaEl"
							v-model="memoDraft"
							rows="1"
							@focus="isEditingMemo = true"
							@blur="updateMemo"
							@input="adjustMemoTextarea"
						/>
					</div>
					<div class="description">
						<MkOmit>
							<Mfm v-if="user.description" :text="user.description" :isNote="false" :author="user"/>
							<p v-else class="empty">{{ i18n.ts.noAccountDescription }}</p>
						</MkOmit>
					</div>
					<div class="fields system">
						<dl v-if="user.location" class="field">
							<dt class="name"><i class="ph-map-pin ph-bold ph-lg ti-fw"></i> {{ i18n.ts.location }}</dt>
							<dd class="value">{{ user.location }}</dd>
						</dl>
						<dl v-if="user.birthday" class="field">
							<dt class="name"><i class="ph-cake ph-bold ph-lg ti-fw"></i> {{ i18n.ts.birthday }}</dt>
							<dd class="value">{{ user.birthday.replace('-', '/').replace('-', '/') }} ({{ i18n.t('yearsOld', { age }) }})</dd>
						</dl>
						<dl class="field">
							<dt class="name"><i class="ph-calendar ph-bold ph-lg ti-fw"></i> {{ i18n.ts.registeredDate }}</dt>
							<dd class="value">{{ dateString(user.createdAt) }} (<MkTime :time="user.createdAt"/>)</dd>
						</dl>
					</div>
					<div v-if="user.fields.length > 0" class="fields">
						<dl v-for="(field, i) in user.fields" :key="i" class="field">
							<dt class="name">
								<Mfm :text="field.name" :plain="true" :colored="false"/>
							</dt>
							<dd class="value">
								<Mfm :text="field.value" :author="user" :colored="false"/>
								<i v-if="user.verifiedLinks.includes(field.value)" v-tooltip:dialog="i18n.ts.verifiedLink" class="ph-seal-check ph-bold ph-lg" :class="$style.verifiedLink"></i>
							</dd>
						</dl>
					</div>
					<div class="status">
						<MkA :to="userPage(user)">
							<b>{{ number(user.notesCount) }}</b>
							<span>{{ i18n.ts.notes }}</span>
						</MkA>
						<MkA v-if="isFfVisibleForMe(user)" :to="userPage(user, 'following')">
							<b>{{ number(user.followingCount) }}</b>
							<span>{{ i18n.ts.following }}</span>
						</MkA>
						<MkA v-if="isFfVisibleForMe(user)" :to="userPage(user, 'followers')">
							<b>{{ number(user.followersCount) }}</b>
							<span>{{ i18n.ts.followers }}</span>
						</MkA>
					</div>
				</div>
			</div>

			<div class="contents _gaps">
				<div v-if="user.pinnedNotes.length > 0" class="_gaps">
					<MkNote v-for="note in user.pinnedNotes" :key="note.id" class="note _panel" :note="note" :pinned="true"/>
				</div>
				<MkInfo v-else-if="$i && $i.id === user.id">{{ i18n.ts.userPagePinTip }}</MkInfo>
				<template v-if="narrow">
					<XFiles :key="user.id" :user="user"/>
					<XActivity :key="user.id" :user="user"/>
					<XListenBrainz v-if="user.listenbrainz && listenbrainzdata" :key="user.id" :user="user"/>
				</template>
				<!-- <div v-if="!disableNotes">
					<div style="margin-bottom: 8px; z-index: 1;">{{ i18n.ts.featured }}</div>
					<MkNotes :class="$style.tl" :noGap="true" :pagination="pagination"/>
				</div> -->
				<MkStickyContainer>
					<template #header>
						<MkTab v-model="noteview" :class="$style.tab">
							<option :value="null">{{ i18n.ts.notes }}</option>
							<option value="all">{{ i18n.ts.all }}</option>
							<option value="files">{{ i18n.ts.withFiles }}</option>
						</MkTab>
					</template>
					<MkNotes :class="$style.tl" :noGap="true" :pagination="AllPagination"/>
				</MkStickyContainer>
			</div>
		</div>
		<div v-if="!narrow" class="sub _gaps" style="container-type: inline-size;">
			<XFiles :key="user.id" :user="user"/>
			<XActivity :key="user.id" :user="user"/>
			<XListenBrainz v-if="user.listenbrainz && listenbrainzdata" :key="user.id" :user="user"/>
		</div>
	</div>
	<div class="background"></div>
</MkSpacer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import * as Misskey from 'misskey-js';
import MkTab from '@/components/MkTab.vue';
import MkNote from '@/components/MkNote.vue';
import MkFollowButton from '@/components/MkFollowButton.vue';
import MkAccountMoved from '@/components/MkAccountMoved.vue';
import MkRemoteCaution from '@/components/MkRemoteCaution.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkOmit from '@/components/MkOmit.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkButton from '@/components/MkButton.vue';
import { getScrollPosition } from '@/scripts/scroll.js';
import { getUserMenu } from '@/scripts/get-user-menu.js';
import number from '@/filters/number.js';
import { userPage } from '@/filters/user.js';
import * as os from '@/os.js';
import { useRouter } from '@/router.js';
import { i18n } from '@/i18n.js';
import { $i, iAmModerator } from '@/account.js';
import { dateString } from '@/filters/date.js';
import { confetti } from '@/scripts/confetti.js';
import MkNotes from '@/components/MkNotes.vue';
import { api } from '@/os.js';
import { isFfVisibleForMe } from '@/scripts/isFfVisibleForMe.js';

function calcAge(birthdate: string): number {
	const date = new Date(birthdate);
	const now = new Date();

	let yearDiff = now.getFullYear() - date.getFullYear();
	const monthDiff = now.getMonth() - date.getMonth();
	const pastDate = now.getDate() < date.getDate();

	if (monthDiff < 0 || (monthDiff === 0 && pastDate)) {
		yearDiff--;
	}

	return yearDiff;
}

const XFiles = defineAsyncComponent(() => import('./index.files.vue'));
const XActivity = defineAsyncComponent(() => import('./index.activity.vue'));
const XListenBrainz = defineAsyncComponent(() => import("./index.listenbrainz.vue"));

const props = withDefaults(defineProps<{
	user: Misskey.entities.UserDetailed;
	/** Test only; MkNotes currently causes problems in vitest */
	disableNotes: boolean;
}>(), {
	disableNotes: false,
});

const router = useRouter();

let user = $ref(props.user);
let parallaxAnimationId = $ref<null | number>(null);
let narrow = $ref<null | boolean>(null);
let rootEl = $ref<null | HTMLElement>(null);
let bannerEl = $ref<null | HTMLElement>(null);
let memoTextareaEl = $ref<null | HTMLElement>(null);
let memoDraft = $ref(props.user.memo);
let isEditingMemo = $ref(false);
let moderationNote = $ref(props.user.moderationNote);
let editModerationNote = $ref(false);
let noteview = $ref<string | null>(null);

let listenbrainzdata = false;
if (props.user.listenbrainz) {
	try {
		const response = await fetch(`https://api.listenbrainz.org/1/user/${props.user.listenbrainz}/playing-now`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			},
		});
		const data = await response.json();
		if (data.payload.listens && data.payload.listens.length !== 0) {
			listenbrainzdata = true;
		}
	} catch (err) {
		listenbrainzdata = false;
	}
}

const background = computed(() => {
	if (props.user.backgroundUrl == null) return {};
	return {
		'--backgroundImageStatic': `url('${props.user.backgroundUrl}')`
	};
});

watch($$(moderationNote), async () => {
	await os.api('admin/update-user-note', { userId: props.user.id, text: moderationNote });
});

const pagination = {
	endpoint: 'users/featured-notes' as const,
	limit: 10,
	params: computed(() => ({
		userId: props.user.id
	})),
};

const AllPagination = {
	endpoint: 'users/notes' as const,
	limit: 10,
	params: computed(() => ({
		userId: props.user.id,
		withRenotes: noteview === 'all',
		withReplies: noteview === 'all' || noteview === 'files',
		withChannelNotes: noteview === 'all',
		withFiles: noteview === 'files',
	})),
};

const style = $computed(() => {
	if (props.user.bannerUrl == null) return {};
	return {
		backgroundImage: `url(${ props.user.bannerUrl })`,
	};
});

const age = $computed(() => {
	return calcAge(props.user.birthday);
});

function menu(ev) {
	const { menu, cleanup } = getUserMenu(user, router);
	os.popupMenu(menu, ev.currentTarget ?? ev.target).finally(cleanup);
}

function parallaxLoop() {
	parallaxAnimationId = window.requestAnimationFrame(parallaxLoop);
	parallax();
}

function parallax() {
	const banner = bannerEl as any;
	if (banner == null) return;

	const top = getScrollPosition(rootEl);

	if (top < 0) return;

	const z = 1.75; // 奥行き(小さいほど奥)
	const pos = -(top / z);
	banner.style.backgroundPosition = `center calc(50% - ${pos}px)`;
}

function showMemoTextarea() {
	isEditingMemo = true;
	nextTick(() => {
		memoTextareaEl?.focus();
	});
}

function adjustMemoTextarea() {
	if (!memoTextareaEl) return;
	memoTextareaEl.style.height = '0px';
	memoTextareaEl.style.height = `${memoTextareaEl.scrollHeight}px`;
}

async function updateMemo() {
	await api('users/update-memo', {
		memo: memoDraft,
		userId: props.user.id,
	});
	isEditingMemo = false;
}

watch([props.user], () => {
	memoDraft = props.user.memo;
});

onMounted(() => {
	window.requestAnimationFrame(parallaxLoop);
	narrow = rootEl!.clientWidth < 1000;

	if (props.user.birthday) {
		const m = new Date().getMonth() + 1;
		const d = new Date().getDate();
		const bm = parseInt(props.user.birthday.split('-')[1]);
		const bd = parseInt(props.user.birthday.split('-')[2]);
		if (m === bm && d === bd) {
			confetti({
				duration: 1000 * 4,
			});
		}
	}
	nextTick(() => {
		adjustMemoTextarea();
	});
});

onUnmounted(() => {
	if (parallaxAnimationId) {
		window.cancelAnimationFrame(parallaxAnimationId);
	}
});
</script>

<style lang="scss" scoped>
.background{
	position: fixed;
	z-index: -1;
	background: var(--backgroundImageStatic);
	background-size: cover;
	background-position: center;
	pointer-events: none;
	filter: var(--blur, blur(10px)) opacity(0.6);
	// Funny CSS schenanigans to make background escape container
	left: -100%;
	top: -5%;
	right: -100%;
	bottom: -100%;
	background-attachment: fixed;
}

.ftskorzw {

	> .main {

		> .punished {
			font-size: 0.8em;
			padding: 16px;
		}

		> .profile {

			> .main {
				position: relative;
				overflow: clip;
				background: color-mix(in srgb, var(--panel) 65%, transparent);

				> .banner-container {
					position: relative;
					height: 250px;
					overflow: clip;
					background-size: cover;
					background-position: center;

					> .banner {
						height: 100%;
						background-color: #4c5e6d;
						background-size: cover;
						background-position: center;
						box-shadow: 0 0 128px rgba(0, 0, 0, 0.5) inset;
						will-change: background-position;
					}

					> .fade {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						height: 78px;
						background: linear-gradient(transparent, rgba(#000, 0.7));
					}

					> .followed {
						position: absolute;
						top: 12px;
						left: 12px;
						padding: 4px 8px;
						color: #fff;
						background: rgba(0, 0, 0, 0.7);
						font-size: 0.7em;
						border-radius: var(--radius-sm);
					}

					> .actions {
						position: absolute;
						top: 12px;
						right: 12px;
						-webkit-backdrop-filter: var(--blur, blur(8px));
						backdrop-filter: var(--blur, blur(8px));
						background: rgba(0, 0, 0, 0.2);
						padding: 8px;
						border-radius: var(--radius-lg);

						> .menu {
							vertical-align: bottom;
							height: 31px;
							width: 31px;
							color: #fff;
							text-shadow: 0 0 8px #000;
							font-size: 16px;
						}

						> .koudoku {
							margin-left: 4px;
							vertical-align: bottom;
						}
					}

					> .title {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						padding: 0 0 8px 154px;
						box-sizing: border-box;
						color: #fff;

						> .name {
							display: block;
							margin: 0;
							line-height: 32px;
							font-weight: bold;
							font-size: 1.8em;
							text-shadow: 0 0 8px #000;
						}

						> .bottom {
							> * {
								display: inline-block;
								margin-right: 16px;
								line-height: 20px;
								opacity: 0.8;

								&.username {
									font-weight: bold;
								}
							}

							> .add-note-button {
								background: rgba(0, 0, 0, 0.2);
								color: #fff;
								-webkit-backdrop-filter: var(--blur, blur(8px));
								backdrop-filter: var(--blur, blur(8px));
								border-radius: var(--radius-lg);
								padding: 4px 8px;
								font-size: 80%;
							}
						}
					}
				}

				> .title {
					display: none;
					text-align: center;
					padding: 50px 8px 16px 8px;
					font-weight: bold;
					border-bottom: solid 0.5px var(--divider);

					> .bottom {
						> * {
							display: inline-block;
							margin-right: 8px;
							opacity: 0.8;
						}
					}
				}

				> .avatar {
					display: block;
					position: absolute;
					top: 170px;
					left: 16px;
					z-index: 2;
					width: 120px;
					height: 120px;
					filter: drop-shadow(1px 1px 3px rgba(#000, 0.2));
				}

				> .roles {
					padding: 24px 24px 0 154px;
					font-size: 0.95em;
					display: flex;
					flex-wrap: wrap;
					gap: 8px;

					> .role {
						border: solid 1px var(--color, var(--divider));
						border-radius: var(--radius-ellipse);
						margin-right: 4px;
						padding: 3px 8px;
					}
				}

				> .moderationNote {
					margin: 12px 24px 0 154px;
				}

				> .memo {
					margin: 12px 24px 0 154px;
					background: transparent;
					color: var(--fg);
					border: 1px solid var(--divider);
					border-radius: var(--radius-sm);
					padding: 8px;
					line-height: 0;

					> .heading {
						text-align: left;
						color: var(--fgTransparent);
						line-height: 1.5;
						font-size: 85%;
					}

					textarea {
						margin: 0;
						padding: 0;
						resize: none;
						border: none;
						outline: none;
						width: 100%;
						height: auto;
						min-height: 0;
						line-height: 1.5;
						color: var(--fg);
						overflow: hidden;
						background: transparent;
						font-family: inherit;
					}
				}

				> .description {
					padding: 24px 24px 24px 154px;
					font-size: 0.95em;

					> .empty {
						margin: 0;
						opacity: 0.5;
					}
				}

				> .fields {
					padding: 24px;
					font-size: 0.9em;
					border-top: solid 0.5px var(--divider);

					> .field {
						display: flex;
						padding: 0;
						margin: 0;
						align-items: center;

						&:not(:last-child) {
							margin-bottom: 8px;
						}

						> .name {
							width: 30%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							font-weight: bold;
							text-align: center;
						}

						> .value {
							width: 70%;
							overflow: hidden;
							white-space: nowrap;
							text-overflow: ellipsis;
							margin: 0;
						}
					}

					&.system > .field > .name {
					}
				}

				> .status {
					display: flex;
					padding: 24px;
					border-top: solid 0.5px var(--divider);

					> a {
						flex: 1;
						text-align: center;

						&.active {
							color: var(--accent);
						}

						&:hover {
							text-decoration: none;
						}

						> b {
							display: block;
							line-height: 16px;
						}

						> span {
							font-size: 70%;
						}
					}
				}
			}
		}

		> .contents {
			> .content {
				margin-bottom: var(--margin);
			}
		}
	}

	&.wide {
		display: flex;
		width: 100%;

		> .main {
			width: 100%;
			min-width: 0;
		}

		> .sub {
			max-width: 350px;
			min-width: 350px;
			margin-left: var(--margin);
		}
	}
}

@container (max-width: 500px) {
	.ftskorzw {
		> .main {
			> .profile > .main {
				> .banner-container {
					height: 140px;

					> .fade {
						display: none;
					}

					> .title {
						display: none;
					}
				}

				> .title {
					display: block;
				}

				> .avatar {
					top: 90px;
					left: 0;
					right: 0;
					width: 92px;
					height: 92px;
					margin: auto;
				}

				> .roles {
					padding: 16px 16px 0 16px;
					justify-content: center;
				}

				> .moderationNote {
					margin: 16px 16px 0 16px;
				}

				> .memo {
					margin: 16px 16px 0 16px;
				}

				> .description {
					padding: 16px;
					text-align: center;
				}

				> .fields {
					padding: 16px;
				}

				> .status {
					padding: 16px;
				}
			}

			> .contents {
				> .nav {
					font-size: 80%;
				}
			}
		}
	}
}
</style>

<style lang="scss" module>
.tl {
	background-color: rgba(0, 0, 0, 0);
	border-radius: var(--radius);
	overflow: clip;
	z-index: 0;
}

.tab {
	margin: calc(var(--margin) / 2) 0;
	padding: calc(var(--margin) / 2) 0;
	background: color-mix(in srgb, var(--bg) 65%, transparent);
	backdrop-filter: var(--blur, blur(15px));
	border-radius: var(--radius-sm);

	> button {
		border-radius: var(--radius-sm);
		margin-left: 0.4rem;
		margin-right: 0.4rem;
	}
}

.verifiedLink {
	margin-left: 4px;
	color: var(--success);
}
</style>
