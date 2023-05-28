/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { StoryObj } from '@storybook/vue3';
import { channel } from '../../.storybook/fakes';
import MkChannelPreview from './MkChannelPreview.vue';
export const Default = {
	render(args) {
		return {
			components: {
				MkChannelPreview,
			},
			setup() {
				return {
					args,
				};
			},
			computed: {
				props() {
					return {
						...this.args,
					};
				},
			},
			template: '<MkChannelPreview v-bind="props" / >',
		};
	},
	args: {
		channel: channel(),
	},
	parameters: {
		layout: 'default',
	},
} satisfies StoryObj<typeof MkChannelPreview>;
