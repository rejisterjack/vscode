/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { ITool, ToolResult } from '../toolTypes.js';

/**
 * A todo list item.
 */
export interface TodoItem {
	readonly id: string;
	readonly content: string;
	readonly status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Write/update a todo list. Port of
 * `references/kilocode/packages/opencode/src/tool/todo.ts`. Exposes an event
 * the UI can subscribe to for rendering the todo list.
 */
export class TodoWriteTool implements ITool {
	readonly id = 'todo';
	readonly description = 'Create or update a todo list for the current task. Pass the complete list of todos each time (this replaces the previous list). Use to track multi-step progress.';
	readonly parameters = {
		type: 'object',
		properties: {
			todos: {
				type: 'array',
				description: 'The complete list of todos.',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string', description: 'Unique identifier for the todo.' },
						content: { type: 'string', description: 'The todo description.' },
						status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'The todo status.' }
					},
					required: ['id', 'content', 'status']
				}
			}
		},
		required: ['todos']
	};

	private _todos: TodoItem[] = [];
	private readonly _onDidChangeTodos = new Emitter<readonly TodoItem[]>();
	readonly onDidChangeTodos: Event<readonly TodoItem[]> = this._onDidChangeTodos.event;

	get todos(): readonly TodoItem[] {
		return this._todos;
	}

	async execute(args: { todos: TodoItem[] }): Promise<ToolResult> {
		this._todos = args.todos;
		this._onDidChangeTodos.fire(this._todos);
		const summary = args.todos.map(t => `[${t.status}] ${t.content}`).join('\n');
		return {
			title: 'Update todos',
			output: `Todo list updated:\n${summary}`
		};
	}
}
