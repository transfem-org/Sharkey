/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { action } from '@storybook/addon-actions';
import { userEvent, waitFor, within } from '@storybook/testing-library';
import { StoryObj } from '@storybook/vue3';
import { rest } from 'msw';
import { channel } from '../../.storybook/fakes';
import { commonHandlers } from '../../.storybook/mocks';
import MkChannelFollowButton from './MkChannelFollowButton.vue';
export const Default = {
	render(args) {
		return {
			components: {
				MkChannelFollowButton,
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
				events() {
					return {
						
					};
				},
			},
			template: '<MkChannelFollowButton v-bind="props" v-on="events" />',
		};
	},
	args: {
		channel: channel(),
	},
	parameters: {
		layout: 'centered',
		msw: {
			handlers: [
				...commonHandlers,
				rest.post('/api/channels/follow', async (req, res, ctx) => {
					action('POST /api/channels/follow')(await req.json());
					return res(ctx.status(204));
				}),
				rest.post('/api/channels/unfollow', async (req, res, ctx) => {
					action('POST /api/channels/unfollow')(await req.json());
					return res(ctx.status(204));
				}),
			],
		},
	},
} satisfies StoryObj<typeof MkChannelFollowButton>;
export const Following = {
	...Default,
	async play({ canvasElement }) {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button');
		await waitFor(() => userEvent.click(button));
	},
	parameters: {
		...Default.parameters,
		msw: {
			handlers: [
				...commonHandlers,
				rest.post('/api/channels/follow', async (req, res, ctx) => {
					action('POST /api/channels/follow')(await req.json());
					await new Promise(() => {});
				}),
				rest.post('/api/channels/unfollow', async (req, res, ctx) => {
					action('POST /api/channels/unfollow')(await req.json());
					await new Promise(() => {});
				}),
			],
		},
	},
}
export const Followed = {
	...Default,
	args: {
		...Default.args,
		channel: {
			...channel(),
			isFollowing: true,
		},
	},
} satisfies StoryObj<typeof MkChannelFollowButton>;
export const Full = {
	...Default,
	args: {
		...Default.args,
		full: true,
	},
} satisfies StoryObj<typeof MkChannelFollowButton>;
export const FullFollowing = {
	...Following,
	args: {
		...Following.args,
		full: true,
	},
} satisfies StoryObj<typeof MkChannelFollowButton>;
export const FullFollowed = {
	...Followed,
	args: {
		...Followed.args,
		full: true,
	},
} satisfies StoryObj<typeof MkChannelFollowButton>;
