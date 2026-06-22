/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter, Event } from '../../base/common/event.js';
import { FileAccess } from '../../base/common/network.js';
import { IProductService } from '../../platform/product/common/productService.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';

/**
 * Sound types for different attention events.
 */
export type AttentionSoundType =
	| 'yup'      // Task completed successfully
	| 'nope'     // Task failed or errored
	| 'alert'    // Permission or question requested
	| 'bipbop';  // Generic notification

/**
 * Attention service — plays sound effects for chat events.
 *
 * Ported from the extension's AttentionService. Plays WAV files from the
 * bundled audio assets when a chat turn completes, a permission is requested,
 * or an error occurs. Sounds can be disabled via settings.
 */
export interface IAttentionService {
	readonly _serviceBrand: undefined;

	/**
	 * Play a sound effect
	 */
	play(type: AttentionSoundType): void;

	/**
	 * Event fired when a sound is played (for UI feedback)
	 */
	readonly onDidPlaySound: Event<AttentionSoundType>;
}

export const IAttentionService = createDecorator<IAttentionService>('attentionService');

const SOUND_FILES: Record<AttentionSoundType, string[]> = {
	yup: ['yup-01.wav', 'yup-02.wav', 'yup-03.wav', 'yup-04.wav', 'yup-05.wav', 'yup-06.wav'],
	nope: ['nope-01.wav', 'nope-02.wav', 'nope-03.wav', 'nope-04.wav', 'nope-05.wav'],
	alert: ['alert-01.wav', 'alert-02.wav', 'alert-03.wav', 'alert-04.wav', 'alert-05.wav'],
	bipbop: ['bip-bop-01.wav', 'bip-bop-02.wav', 'bip-bop-03.wav', 'bip-bop-04.wav']
};

export class AttentionService extends Disposable implements IAttentionService {
	readonly _serviceBrand: undefined;

	private readonly _onDidPlaySound = this._register(new Emitter<AttentionSoundType>());
	readonly onDidPlaySound: Event<AttentionSoundType> = this._onDidPlaySound.event;

	private audioElements = new Map<string, HTMLAudioElement>();

	constructor(
		@IProductService private readonly productService: IProductService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
	}

	/**
	 * Play a sound effect. No-op if sounds are disabled or the audio file
	 * cannot be loaded (e.g. in environments without audio support).
	 */
	play(type: AttentionSoundType): void {
		// Check if sounds are enabled (defaults to false; user must opt in)
		const enabled = this.configurationService.getValue<boolean>('ai.chat.sounds.enabled');
		if (!enabled) { return; }

		const files = SOUND_FILES[type];
		if (!files || files.length === 0) { return; }

		// Pick a random sound file for variety
		const file = files[Math.floor(Math.random() * files.length)];

		try {
			const audio = this.getOrCreateAudio(type, file);
			if (audio) {
				audio.currentTime = 0;
				void audio.play().catch(() => {
					// Autoplay may be blocked; ignore silently
				});
				this._onDidPlaySound.fire(type);
			}
		} catch {
			// Audio not supported in this environment
		}
	}

	private getOrCreateAudio(type: AttentionSoundType, file: string): HTMLAudioElement | null {
		const key = `${type}:${file}`;
		const existing = this.audioElements.get(key);
		if (existing) {
			return existing;
		}

		// Resolve the audio file path relative to the extension or product resources.
		// During migration, files live in extensions/fewstepsaway-ai/audio-wav/.
		// Phase 8 cleanup moves them to resources/audio/.
		const basePath = this.productService.cli?.fewstepsawayPath
			? 'resources/audio/'  // Product-level (after cleanup)
			: 'extensions/fewstepsaway-ai/audio-wav/';  // Extension-level (during migration)

		const uri = FileAccess.asBrowserUri(`${basePath}${file}`);
		const audio = new Audio(uri.toString(true));
		audio.preload = 'auto';
		audio.volume = 0.5;
		this.audioElements.set(key, audio);
		return audio;
	}

	override dispose(): void {
		for (const audio of this.audioElements.values()) {
			audio.pause();
			audio.src = '';
		}
		this.audioElements.clear();
		super.dispose();
	}
}
