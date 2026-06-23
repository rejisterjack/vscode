/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * A question to ask the user.
 */
export interface Question {
	readonly id: string;
	readonly prompt: string;
	readonly options: Array<{ id: string; label: string; description?: string }>;
	readonly allowMultiple?: boolean;
}

/**
 * Ask the user a question. Port of
 * `references/kilocode/packages/opencode/src/tool/question.ts`. Pauses the
 * agent loop until the user answers. Exposes events for the UI to render the
 * question dock.
 */
export class QuestionTool implements ITool {
	readonly id = 'question';
	readonly description = 'Ask the user a multiple-choice question. Use to clarify requirements or request a decision. Pauses execution until the user answers.';
	readonly parameters = {
		type: 'object',
		properties: {
			questions: {
				type: 'array',
				description: 'The questions to ask.',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string', description: 'Unique identifier for the question.' },
						prompt: { type: 'string', description: 'The question text.' },
						options: {
							type: 'array',
							description: 'The available answers.',
							items: {
								type: 'object',
								properties: {
									id: { type: 'string', description: 'Unique identifier for the option.' },
									label: { type: 'string', description: 'Display label.' },
									description: { type: 'string', description: 'Optional longer description.' }
								},
								required: ['id', 'label']
							}
						},
						allowMultiple: { type: 'boolean', description: 'Allow selecting multiple options.' }
					},
					required: ['id', 'prompt', 'options']
				}
			}
		},
		required: ['questions']
	};

	private readonly _onDidAskQuestion = new Emitter<Question>();
	readonly onDidAskQuestion: Event<Question> = this._onDidAskQuestion.event;

	private pendingResolve: ((answers: Record<string, string[]>) => void) | null = null;

	/**
	 * Called by the UI when the user answers a pending question.
	 */
	answerQuestion(answers: Record<string, string[]>): void {
		if (this.pendingResolve) {
			this.pendingResolve(answers);
			this.pendingResolve = null;
		}
	}

	async execute(args: { questions: Question[] }, ctx: { ask: (prompt: string) => Promise<boolean> }): Promise<ToolResult> {
		const allAnswers: Record<string, string[]> = {};
		const summaries: string[] = [];

		for (const q of args.questions) {
			this._onDidAskQuestion.fire(q);
			const answers = await new Promise<string[]>((resolve) => {
				this.pendingResolve = (record) => resolve(record[q.id] ?? []);
			});
			allAnswers[q.id] = answers;
			const selectedLabels = q.options
				.filter(o => answers.includes(o.id))
				.map(o => o.label);
			summaries.push(`${q.prompt} -> ${selectedLabels.join(', ')}`);
		}

		return {
			title: 'Question answered',
			output: summaries.join('\n'),
			metadata: { answers: allAnswers }
		};
	}
}
