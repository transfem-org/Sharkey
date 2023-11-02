/* global libopenmpt UTF8ToString writeAsciiToMemory */
/* eslint-disable */

const ChiptuneAudioContext = window.AudioContext || window.webkitAudioContext;

export function ChiptuneJsConfig (repeatCount: number, context: AudioContext) {
	this.repeatCount = repeatCount;
	this.context = context;
}

ChiptuneJsConfig.prototype.constructor = ChiptuneJsConfig;

export function ChiptuneJsPlayer (config: object) {
	this.config = config;
	this.audioContext = config.context || new ChiptuneAudioContext();
	this.context = this.audioContext.createGain();
	this.currentPlayingNode = null;
	this.handlers = [];
	this.touchLocked = true;
	this.volume = 1;
}

ChiptuneJsPlayer.prototype.constructor = ChiptuneJsPlayer;

ChiptuneJsPlayer.prototype.fireEvent = function (eventName: string, response) {
	const handlers = this.handlers;
	if (handlers.length > 0) {
		for(const handler of handlers) {
			if (handler.eventName === eventName) {
				handler.handler(response);
			}
		}
	}
};

ChiptuneJsPlayer.prototype.addHandler = function (eventName: string, handler: Function) {
	this.handlers.push({ eventName, handler });
};

ChiptuneJsPlayer.prototype.onEnded = function (handler: Function) {
	this.addHandler('onEnded', handler);
};

ChiptuneJsPlayer.prototype.onError = function (handler: Function) {
	this.addHandler('onError', handler);
};

ChiptuneJsPlayer.prototype.duration = function () {
	return libopenmpt._openmpt_module_get_duration_seconds(this.currentPlayingNode.modulePtr);
};

ChiptuneJsPlayer.prototype.position = function () {
	return libopenmpt._openmpt_module_get_position_seconds(this.currentPlayingNode.modulePtr);
};

ChiptuneJsPlayer.prototype.seek = function (position: number) {
	if (this.currentPlayingNode) {
		libopenmpt._openmpt_module_set_position_seconds(this.currentPlayingNode.modulePtr, position);
	}
};

ChiptuneJsPlayer.prototype.metadata = function () {
	const data = {};
	const keys = UTF8ToString(libopenmpt._openmpt_module_get_metadata_keys(this.currentPlayingNode.modulePtr)).split(';');
	let keyNameBuffer = 0;
	for (const key of keys) {
		keyNameBuffer = libopenmpt._malloc(key.length + 1);
		writeAsciiToMemory(key, keyNameBuffer);
		data[key] = UTF8ToString(libopenmpt._openmpt_module_get_metadata(this.currentPlayingNode.modulePtr, keyNameBuffer));
		libopenmpt._free(keyNameBuffer);
	}
	return data;
};

ChiptuneJsPlayer.prototype.unlock = function () {
	const context = this.audioContext;
	const buffer = context.createBuffer(1, 1, 22050);
	const unlockSource = context.createBufferSource();
	unlockSource.buffer = buffer;
	unlockSource.connect(this.context);
	this.context.connect(context.destination);
	unlockSource.start(0);
	this.touchLocked = false;
};

ChiptuneJsPlayer.prototype.load = function (input) {
	return new Promise((resolve, reject) => {
		if(this.touchLocked) {
			this.unlock();
		}
		const player = this;
		if (input instanceof File) {
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result);
			};
			reader.readAsArrayBuffer(input);
		} else {
			window.fetch(input).then((response) => {
				response.arrayBuffer().then((arrayBuffer) => {
					resolve(arrayBuffer);
				}).catch((error) => {
					reject(error);
				});
			}).catch((error) => {
				reject(error);
			});
		}
	});
};

ChiptuneJsPlayer.prototype.play = function (buffer: ArrayBuffer) {
	this.unlock();
	this.stop();
	const processNode = this.createLibopenmptNode(buffer, this.buffer);
	if (processNode === null) {
		return;
	}
	libopenmpt._openmpt_module_set_repeat_count(processNode.modulePtr, this.config.repeatCount || 0);
	this.currentPlayingNode = processNode;
	processNode.connect(this.context);
	this.context.connect(this.audioContext.destination);
};

ChiptuneJsPlayer.prototype.stop = function () {
	if (this.currentPlayingNode != null) {
		this.currentPlayingNode.disconnect();
		this.currentPlayingNode.cleanup();
		this.currentPlayingNode = null;
	}
};

ChiptuneJsPlayer.prototype.togglePause = function () {
	if (this.currentPlayingNode != null) {
		this.currentPlayingNode.togglePause();
	}
};

ChiptuneJsPlayer.prototype.getPattern = function () {
	if (this.currentPlayingNode && this.currentPlayingNode.modulePtr) {
		return libopenmpt._openmpt_module_get_current_pattern(this.currentPlayingNode.modulePtr);
	}
	return 0;
};

ChiptuneJsPlayer.prototype.getRow = function () {
	if (this.currentPlayingNode && this.currentPlayingNode.modulePtr) {
		return libopenmpt._openmpt_module_get_current_row(this.currentPlayingNode.modulePtr);
	}
	return 0;
};

ChiptuneJsPlayer.prototype.getPatternNumRows = function (pattern: number) {
	if (this.currentPlayingNode && this.currentPlayingNode.modulePtr) {
		return libopenmpt._openmpt_module_get_pattern_num_rows(this.currentPlayingNode.modulePtr, pattern);
	}
	return 0;
};

ChiptuneJsPlayer.prototype.getPatternRowChannel = function (pattern: number, row: number, channel: number) {
	if (this.currentPlayingNode && this.currentPlayingNode.modulePtr) {
		return UTF8ToString(libopenmpt._openmpt_module_format_pattern_row_channel(this.currentPlayingNode.modulePtr, pattern, row, channel, 0, true));
	}
	return '';
};

ChiptuneJsPlayer.prototype.createLibopenmptNode = function (buffer, config: object) {
	const maxFramesPerChunk = 4096;
	const processNode = this.audioContext.createScriptProcessor(2048, 0, 2);
	processNode.config = config;
	processNode.player = this;
	const byteArray = new Int8Array(buffer);
	const ptrToFile = libopenmpt._malloc(byteArray.byteLength);
	libopenmpt.HEAPU8.set(byteArray, ptrToFile);
	processNode.modulePtr = libopenmpt._openmpt_module_create_from_memory(ptrToFile, byteArray.byteLength, 0, 0, 0);
	processNode.nbChannels = libopenmpt._openmpt_module_get_num_channels(processNode.modulePtr);
	processNode.patternIndex = -1;
	processNode.paused = false;
	processNode.leftBufferPtr = libopenmpt._malloc(4 * maxFramesPerChunk);
	processNode.rightBufferPtr = libopenmpt._malloc(4 * maxFramesPerChunk);
	processNode.cleanup = function () {
		if (this.modulePtr !== 0) {
			libopenmpt._openmpt_module_destroy(this.modulePtr);
			this.modulePtr = 0;
		}
		if (this.leftBufferPtr !== 0) {
			libopenmpt._free(this.leftBufferPtr);
			this.leftBufferPtr = 0;
		}
		if (this.rightBufferPtr !== 0) {
			libopenmpt._free(this.rightBufferPtr);
			this.rightBufferPtr = 0;
		}
	};
	processNode.stop = function () {
		this.disconnect();
		this.cleanup();
	};
	processNode.pause = function () {
		this.paused = true;
	};
	processNode.unpause = function () {
		this.paused = false;
	};
	processNode.togglePause = function () {
		this.paused = !this.paused;
	};
	processNode.onaudioprocess = function (e) {
		const outputL = e.outputBuffer.getChannelData(0);
		const outputR = e.outputBuffer.getChannelData(1);
		let framesToRender = outputL.length;
		if (this.ModulePtr === 0) {
			for (let i = 0; i < framesToRender; ++i) {
				outputL[i] = 0;
				outputR[i] = 0;
			}
			this.disconnect();
			this.cleanup();
			return;
		}
		if (this.paused) {
			for (let i = 0; i < framesToRender; ++i) {
				outputL[i] = 0;
				outputR[i] = 0;
			}
			return;
		}
		let framesRendered = 0;
		let ended = false;
		let error = false;

		const currentPattern = libopenmpt._openmpt_module_get_current_pattern(this.modulePtr);
		const currentRow = libopenmpt._openmpt_module_get_current_row(this.modulePtr);
		if (currentPattern !== this.patternIndex) {
			processNode.player.fireEvent('onPatternChange');
		}
		processNode.player.fireEvent('onRowChange', { index: currentRow });

		while (framesToRender > 0) {
			const framesPerChunk = Math.min(framesToRender, maxFramesPerChunk);
			const actualFramesPerChunk = libopenmpt._openmpt_module_read_float_stereo(this.modulePtr, this.context.sampleRate, framesPerChunk, this.leftBufferPtr, this.rightBufferPtr);
			if (actualFramesPerChunk === 0) {
				ended = true;
				// modulePtr will be 0 on openmpt: error: openmpt_module_read_float_stereo: ERROR: module * not valid or other openmpt error
				error = !this.modulePtr;
			}
			const rawAudioLeft = libopenmpt.HEAPF32.subarray(this.leftBufferPtr / 4, this.leftBufferPtr / 4 + actualFramesPerChunk);
			const rawAudioRight = libopenmpt.HEAPF32.subarray(this.rightBufferPtr / 4, this.rightBufferPtr / 4 + actualFramesPerChunk);
			for (let i = 0; i < actualFramesPerChunk; ++i) {
				outputL[framesRendered + i] = rawAudioLeft[i];
				outputR[framesRendered + i] = rawAudioRight[i];
			}
			for (let i = actualFramesPerChunk; i < framesPerChunk; ++i) {
				outputL[framesRendered + i] = 0;
				outputR[framesRendered + i] = 0;
			}
			framesToRender -= framesPerChunk;
			framesRendered += framesPerChunk;
		}
		if (ended) {
			this.disconnect();
			this.cleanup();
			error ? processNode.player.fireEvent('onError', { type: 'openmpt' }) : processNode.player.fireEvent('onEnded');
		}
	};
	return processNode;
};
