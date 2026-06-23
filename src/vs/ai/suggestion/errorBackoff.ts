/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../base/common/event.js';
import { Disposable } from '../../base/common/lifecycle.js';

/**
 * A circuit breaker that backs off on 401/402/429/5xx errors. Port of
 * `references/kilocode/packages/kilo-vscode/src/services/autocomplete/classic-auto-complete/ErrorBackoff.ts`.
 *
 * After a threshold of consecutive errors, the breaker trips and blocks all
 * requests for a backoff duration. The backoff grows exponentially with each
 * trip.
 */
export class ErrorBackoff extends Disposable {
	private errorCount = 0;
	private backoffUntil = 0;
	private backoffMs = 1000;
	private readonly maxBackoffMs = 60000;

	private readonly _onDidTrip = this._register(new Emitter<void>());
	readonly onDidTrip: Event<void> = this._onDidTrip.event;

	constructor(
		private readonly threshold = 3,
		private readonly initialBackoffMs = 5000
	) {
		super();
		this.backoffMs = initialBackoffMs;
	}

	/**
	 * Whether the breaker is currently tripped (blocking requests).
	 */
	isTripped(): boolean {
		return Date.now() < this.backoffUntil;
	}

	/**
	 * Time until the breaker resets, in ms (0 if not tripped).
	 */
	timeUntilReset(): number {
		return Math.max(0, this.backoffUntil - Date.now());
	}

	/**
	 * Record a successful request -- resets the error count.
	 */
	recordSuccess(): void {
		this.errorCount = 0;
		this.backoffMs = this.initialBackoffMs;
	}

	/**
	 * Record an error. If the error count exceeds the threshold, the breaker
	 * trips.
	 */
	recordError(statusCode?: number): void {
		// Only trip on retryable errors.
		if (statusCode && statusCode !== 401 && statusCode !== 402 && statusCode !== 429 && statusCode < 500) {
			return;
		}
		this.errorCount++;
		if (this.errorCount >= this.threshold) {
			this.trip();
		}
	}

	private trip(): void {
		this.backoffUntil = Date.now() + this.backoffMs;
		this.backoffMs = Math.min(this.maxBackoffMs, this.backoffMs * 2);
		this.errorCount = 0;
		this._onDidTrip.fire();
	}
}
