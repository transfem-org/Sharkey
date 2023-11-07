<template>
<div v-if="hide" class="mod-player-disabled" @click="toggleVisible()">
	<div>
		<b><i class="ph-eye ph-bold ph-lg"></i> {{ i18n.ts.sensitive }}</b>
		<span>{{ i18n.ts.clickToShow }}</span>
	</div>
</div>

<div v-else class="mod-player-enabled">
	<div class="pattern-display">
		<canvas ref="displayCanvas" class="pattern-canvas"></canvas>
	</div>
	<div class="controls">
		<button class="play" @click="playPause()">
			<i v-if="playing" class="ph-pause ph-bold ph-lg"></i>
			<i v-else class="ph-play ph-bold ph-lg"></i>
		</button>
		<button class="stop" @click="stop()">
			<i class="ph-stop ph-bold ph-lg"></i>
		</button>
		<input ref="progress" v-model="position" class="progress" type="range" min="0" max="1" step="0.1" @mousedown="initSeek()" @mouseup="performSeek()"/>
		<input v-model="player.context.gain.value" type="range" min="0" max="1" step="0.1"/>
		<a class="download" :title="i18n.ts.download" :href="module.url" target="_blank">
			<i class="ph-download ph-bold ph-lg"></i>
		</a>
	</div>
	<i class="hide ph-eye-slash ph-bold ph-lg" @click="toggleVisible()"></i>
</div>
</template>

<script lang="ts" setup>
import { ref, nextTick } from 'vue';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import { defaultStore } from '@/store.js';
import { ChiptuneJsPlayer, ChiptuneJsConfig } from '@/scripts/chiptune2.js';

const CHAR_WIDTH = 6;
const CHAR_HEIGHT = 12;
const ROW_OFFSET_Y = 10;

const colours = {
	background: '#000000',
	default: {
		active: '#ffffff',
		inactive: '#808080',
	},
	quarter: {
		active: '#ffff00',
		inactive: '#ffe135',
	},
	instr: {
		active: '#80e0ff',
		inactive: '#0099cc',
	},
	volume: {
		active: '#80ff80',
		inactive: '#008000',
	},
	fx: {
		active: '#ff80e0',
		inactive: '#800060',
	},
	operant: {
		active: '#ffe080',
		inactive: '#806000',
	},
};

const props = defineProps<{
	module: Misskey.entities.DriveFile
}>();

const isSensitive = $computed(() => { return props.module.isSensitive; });
const url = $computed(() => { return props.module.url; });
let hide = ref((defaultStore.state.nsfw === 'force') ? true : isSensitive && (defaultStore.state.nsfw !== 'ignore'));
let playing = ref(false);
let displayCanvas = ref<HTMLCanvasElement>();
let progress = ref<HTMLProgressElement>();
let position = ref(0);
const player = ref(new ChiptuneJsPlayer(new ChiptuneJsConfig()));

const rowBuffer = 24;
let buffer = null;
let isSeeking = false;

player.value.load(url).then((result) => {
	buffer = result;
	try {
		player.value.play(buffer);
		progress.value!.max = player.value.duration();
		display();
	} catch (err) {
		console.warn(err);
	}
	player.value.stop();
}).catch((error) => {
	console.error(error);
});

function playPause() {
	player.value.addHandler('onRowChange', () => {
		progress.value!.max = player.value.duration();
		if (!isSeeking) {
			position.value = player.value.position() % player.value.duration();
		}
		display();
	});

	player.value.addHandler('onEnded', () => {
		stop();
	});

	if (player.value.currentPlayingNode === null) {
		player.value.play(buffer);
		player.value.seek(position.value);
		playing.value = true;
	} else {
		player.value.togglePause();
		playing.value = !player.value.currentPlayingNode.paused;
	}
}

function stop(noDisplayUpdate = false) {
	player.value.stop();
	playing.value = false;
	if (!noDisplayUpdate) {
		try {
			player.value.play(buffer);
			display();
		} catch (err) {
			console.warn(err);
		}
	}
	player.value.stop();
	position.value = 0;
	player.value.handlers = [];
}

function initSeek() {
	isSeeking = true;
}

function performSeek() {
	const noNode = !player.value.currentPlayingNode;
	if (noNode) {
		player.value.play(buffer);
	}
	player.value.seek(position.value);
	display();
	if (noNode) {
		player.value.stop();
	}
	isSeeking = false;
}

function toggleVisible() {
	hide.value = !hide.value;
	nextTick(() => { stop(hide.value); });
}

function display() {
	if (!displayCanvas.value) {
		stop();
		return;
	}

	const canvas = displayCanvas.value;

	const pattern = player.value.getPattern();
	const row = player.value.getRow();
	let nbChannels = 0;
	if (player.value.currentPlayingNode) {
		nbChannels = player.value.currentPlayingNode.nbChannels;
	}
	if (canvas.width !== 12 + 84 * nbChannels + 2) {
		canvas.width = 12 + 84 * nbChannels + 2;
		canvas.height = 12 * rowBuffer;
	}
	const nbRows = player.value.getPatternNumRows(pattern);
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
	ctx.font = '10px monospace';
	ctx.fillStyle = colours.background;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = colours.default.inactive;
	for (let rowOffset = 0; rowOffset < rowBuffer; rowOffset++) {
		const rowToDraw = row - rowBuffer / 2 + rowOffset;
		if (rowToDraw >= 0 && rowToDraw < nbRows) {
			const active = (rowToDraw === row) ? 'active' : 'inactive';
			let rowText = parseInt(rowToDraw).toString(16);
			if (rowText.length === 1) {
				rowText = '0' + rowText;
			}
			ctx.fillStyle = colours.default[active];
			if (rowToDraw % 4 === 0) {
				ctx.fillStyle = colours.quarter[active];
			}
			ctx.fillText(rowText, 0, 10 + rowOffset * 12);
			for (let channel = 0; channel < nbChannels; channel++) {
				const part = player.value.getPatternRowChannel(pattern, rowToDraw, channel);
				const baseOffset = (2 + (part.length + 1) * channel) * CHAR_WIDTH;
				const baseRowOffset = ROW_OFFSET_Y + rowOffset * CHAR_HEIGHT;

				ctx.fillStyle = colours.default[active];
				ctx.fillText('|', baseOffset, baseRowOffset);

				const note = part.substring(0, 3);
				ctx.fillStyle = colours.default[active];
				ctx.fillText(note, baseOffset + CHAR_WIDTH, baseRowOffset);

				const instr = part.substring(4, 6);
				ctx.fillStyle = colours.instr[active];
				ctx.fillText(instr, baseOffset + CHAR_WIDTH * 5, baseRowOffset);
				
				const volume = part.substring(6, 9);
				ctx.fillStyle = colours.volume[active];
				ctx.fillText(volume, baseOffset + CHAR_WIDTH * 7, baseRowOffset);

				const fx = part.substring(10, 11);
				ctx.fillStyle = colours.fx[active];
				ctx.fillText(fx, baseOffset + CHAR_WIDTH * 11, baseRowOffset);

				const op = part.substring(11, 13);
				ctx.fillStyle = colours.operant[active];
				ctx.fillText(op, baseOffset + CHAR_WIDTH * 12, baseRowOffset);
			}
		}
	}
}

</script>

<style lang="scss" scoped>

.hide {
	border-radius: var(--radius-sm) !important;
	background-color: black !important;
	color: var(--accentLighten) !important;
	font-size: 12px !important;
}

.mod-player-enabled {
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;

	> i {
		display: block;
		position: absolute;
		border-radius: var(--radius-sm);
		background-color: var(--fg);
		color: var(--accentLighten);
		font-size: 14px;
		opacity: .5;
		padding: 3px 6px;
		text-align: center;
		cursor: pointer;
		top: 12px;
		right: 12px;
	}

	> .pattern-display {
		width: 100%;
		height: 100%;
		overflow-x: scroll;
		overflow-y: hidden;
		background-color: black;
		text-align: center;
		.pattern-canvas {
			background-color: black;
			height: 100%;
		}
	}

	> .controls {
		display: flex;
		width: 100%;
		background-color: var(--bg);

		> * {
			padding: 4px 8px;
		}

		> button, a {
			border: none;
			background-color: transparent;
			color: var(--accent);
			cursor: pointer;

			&:hover {
				background-color: var(--fg);
			}
		}

		> input[type=range] {
			height: 21px;
			-webkit-appearance: none;
			width: 90px;
			padding: 0;
			margin: 4px 8px;
			overflow-x: hidden;

			&:focus {
				outline: none;

				&::-webkit-slider-runnable-track {
					background: var(--bg);
				}

				&::-ms-fill-lower, &::-ms-fill-upper {
					background: var(--bg);
				}
			}

			&::-webkit-slider-runnable-track {
				width: 100%;
				height: 100%;
				cursor: pointer;
				border-radius: 0;
				animate: 0.2s;
				background: var(--bg);
				border: 1px solid var(--fg);
				overflow-x: hidden;
			}

			&::-webkit-slider-thumb {
				border: none;
				height: 100%;
				width: 14px;
				border-radius: 0;
				background: var(--accentLighten);
				cursor: pointer;
				-webkit-appearance: none;
				box-shadow: calc(-100vw - 14px) 0 0 100vw var(--accent);
				clip-path: polygon(1px 0, 100% 0, 100% 100%, 1px 100%, 1px calc(50% + 10.5px), -100vw calc(50% + 10.5px), -100vw calc(50% - 10.5px), 0 calc(50% - 10.5px));
				z-index: 1;
			}

			&::-moz-range-track {
				width: 100%;
				height: 100%;
				cursor: pointer;
				border-radius: 0;
				animate: 0.2s;
				background: var(--bg);
				border: 1px solid var(--fg);
			}

			&::-moz-range-progress {
				cursor: pointer;
				height: 100%;
				background: var(--accent);
			}

			&::-moz-range-thumb {
				border: none;
				height: 100%;
				border-radius: 0;
				width: 14px;
				background: var(--accentLighten);
				cursor: pointer;
			}

			&::-ms-track {
				width: 100%;
				height: 100%;
				cursor: pointer;
				border-radius: 0;
				animate: 0.2s;
				background: transparent;
				border-color: transparent;
				color: transparent;
			}

			&::-ms-fill-lower {
				background: var(--accent);
				border: 1px solid var(--fg);
				border-radius: 0;
			}

			&::-ms-fill-upper {
				background: var(--bg);
				border: 1px solid var(--fg);
				border-radius: 0;
			}

			&::-ms-thumb {
				margin-top: 1px;
				border: none;
				height: 100%;
				width: 14px;
				border-radius: 0;
				background: var(--accentLighten);
				cursor: pointer;
			}

			&.progress {
				flex-grow: 1;
				min-width: 0;
			}
		}
	}
}

.mod-player-disabled {
	display: flex;
	justify-content: center;
	align-items: center;
	background: #111;
	color: #fff;

	> div {
		display: table-cell;
		text-align: center;
		font-size: 12px;

		> b {
			display: block;
		}
	}
}
</style>
