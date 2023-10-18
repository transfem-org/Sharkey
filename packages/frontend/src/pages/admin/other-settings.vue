<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkStickyContainer>
	<template #header><XHeader :actions="headerActions" :tabs="headerTabs"/></template>
	<MkSpacer :contentMax="700" :marginMin="16" :marginMax="32">
		<FormSuspense :p="init">
			<div class="_gaps">
				<div class="_panel" style="padding: 16px;">
					<MkSwitch v-model="enableServerMachineStats">
						<template #label>{{ i18n.ts.enableServerMachineStats }}</template>
						<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
					</MkSwitch>
				</div>

				<div class="_panel" style="padding: 16px;">
					<MkSwitch v-model="enableAchievements">
						<template #label>{{ i18n.ts.enableAchievements }}</template>
						<template #caption>{{ i18n.ts.turnOffAchievements}}</template>
					</MkSwitch>
				</div>

				<div class="_panel" style="padding: 16px;">
					<MkSwitch v-model="enableBotTrending">
						<template #label>{{ i18n.ts.enableBotTrending }}</template>
						<template #caption>{{ i18n.ts.turnOffBotTrending }}</template>
					</MkSwitch>
				</div>

				<div class="_panel" style="padding: 16px;">
					<MkSwitch v-model="enableIdenticonGeneration">
						<template #label>{{ i18n.ts.enableIdenticonGeneration }}</template>
						<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
					</MkSwitch>
				</div>

				<div class="_panel" style="padding: 16px;">
					<MkSwitch v-model="enableChartsForRemoteUser">
						<template #label>{{ i18n.ts.enableChartsForRemoteUser }}</template>
						<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
					</MkSwitch>
				</div>

				<div class="_panel" style="padding: 16px;">
					<MkSwitch v-model="enableChartsForFederatedInstances">
						<template #label>{{ i18n.ts.enableChartsForFederatedInstances }}</template>
						<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
					</MkSwitch>
				</div>
			</div>
		</FormSuspense>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { } from 'vue';
import XHeader from './_header_.vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePageMetadata } from '@/scripts/page-metadata.js';
import MkSwitch from '@/components/MkSwitch.vue';

let enableServerMachineStats: boolean = $ref(false);
let enableAchievements: boolean = $ref(false);
let enableBotTrending: boolean = $ref(false);
let enableIdenticonGeneration: boolean = $ref(false);
let enableChartsForRemoteUser: boolean = $ref(false);
let enableChartsForFederatedInstances: boolean = $ref(false);

async function init() {
	const meta = await os.api('admin/meta');
	enableServerMachineStats = meta.enableServerMachineStats;
	enableAchievements = meta.enableAchievements;
	enableBotTrending = meta.enableBotTrending;
	enableIdenticonGeneration = meta.enableIdenticonGeneration;
	enableChartsForRemoteUser = meta.enableChartsForRemoteUser;
	enableChartsForFederatedInstances = meta.enableChartsForFederatedInstances;
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		enableServerMachineStats,
		enableAchievements,
		enableBotTrending,
		enableIdenticonGeneration,
		enableChartsForRemoteUser,
		enableChartsForFederatedInstances,
	}).then(() => {
		fetchInstance();
	});
}

const headerActions = $computed(() => [{
	asFullButton: true,
	icon: 'ph-check ph-bold ph-lg',
	text: i18n.ts.save,
	handler: save,
}]);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.other,
	icon: 'ph-faders ph-bold ph-lg',
});
</script>
