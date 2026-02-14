/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { AIMode, CodeContext } from './ai.types.js';
import { Event } from '../../../base/common/event.js';

/**
 * Conversation (chat) types for FewStepAway
 */

/**
 * Message role
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Conversation message
 */
export interface IMessage {
	/** Message ID */
	id: string;
	/** Message role */
	role: MessageRole;
	/** Message content */
	content: string;
	/** Timestamp */
	timestamp: number;
	/** Tokens used for this message */
	tokensUsed?: number;
	/** Context snapshot when message was sent */
	contextSnapshot?: ContextSnapshot;
	/** Optional metadata */
	metadata?: {
		/** If this message is an error */
		isError?: boolean;
		/** If this message is streaming */
		isStreaming?: boolean;
		/** Tool calls if applicable */
		toolCalls?: ToolCall[];
	};
}

/**
 * Tool call in a message
 */
export interface ToolCall {
	/** Tool call ID */
	id: string;
	/** Tool name */
	tool: string;
	/** Tool arguments */
	arguments: Record<string, unknown>;
}

/**
 * Context snapshot for conversation
 */
export interface ContextSnapshot {
	/** Open files at time of message */
	openFiles: string[];
	/** Current file */
	currentFile?: string;
	/** Selected code */
	selection?: string;
	/** Git branch */
	gitBranch?: string;
	/** Timestamp */
	timestamp: number;
}

/**
 * Conversation interface
 */
export interface IConversation {
	/** Conversation ID */
	id: string;
	/** Conversation title */
	title: string;
	/** AI mode */
	mode: AIMode;
	/** Messages in the conversation */
	messages: IMessage[];
	/** Creation timestamp */
	createdAt: number;
	/** Last update timestamp */
	updatedAt: number;
	/** Associated workspace */
	workspacePath?: string;
	/** Metadata */
	metadata: {
		/** Total tokens used in conversation */
		totalTokens: number;
		/** Files referenced */
		fileReferences: string[];
		/** Custom data */
		[key: string]: unknown;
	};
}

/**
 * Conversation creation options
 */
export interface ConversationOptions {
	/** AI mode */
	mode?: AIMode;
	/** Initial title */
	title?: string;
	/** Associated workspace */
	workspacePath?: string;
	/** Initial messages */
	initialMessages?: IMessage[];
}

/**
 * Chat service interface
 */
export interface IChatService {
	/**
	 * Create a new conversation
	 */
	createConversation(options?: ConversationOptions): Promise<IConversation>;

	/**
	 * Get a conversation by ID
	 */
	getConversation(id: string): IConversation | undefined;

	/**
	 * Get all conversations
	 */
	getAllConversations(): IConversation[];

	/**
	 * Delete a conversation
	 */
	deleteConversation(id: string): Promise<void>;

	/**
	 * Send a message in a conversation
	 */
	sendMessage(conversationId: string, content: string): Promise<void>;

	/**
	 * Stream a message response
	 */
	streamMessage(conversationId: string, content: string): AsyncIterable<IMessageChunk>;

	/**
	 * Update conversation title
	 */
	updateTitle(conversationId: string, title: string): Promise<void>;

	/**
	 * Export conversation
	 */
	exportConversation(id: string, format: 'json' | 'markdown'): string;

	/**
	 * Import conversation
	 */
	importConversation(data: string, format: 'json' | 'markdown'): Promise<IConversation>;

	/**
	 * Clear all messages in a conversation
	 */
	clearConversation(id: string): Promise<void>;

	/**
	 * Event fired when a message is received
	 */
	onMessageReceived: Event<{ conversationId: string; message: IMessage }>;

	/**
	 * Event fired when a conversation is updated
	 */
	onConversationUpdated: Event<IConversation>;

	/**
	 * Event fired when streaming message updates
	 */
	onMessageStreaming: Event<{ conversationId: string; content: string; messageId: string }>;
}

/**
 * Message chunk for streaming
 */
export interface IMessageChunk {
	/** Content chunk */
	content: string;
	/** Whether this is the final chunk */
	done: boolean;
	/** Message ID */
	messageId: string;
}

/**
 * Conversation storage interface
 */
export interface IConversationStorage {
	/**
	 * Save a conversation
	 */
	saveConversation(conversation: IConversation): Promise<void>;

	/**
	 * Get a conversation by ID
	 */
	getConversation(id: string): Promise<IConversation | undefined>;

	/**
	 * Get all conversations
	 */
	getAllConversations(): Promise<IConversation[]>;

	/**
	 * Delete a conversation
	 */
	deleteConversation(id: string): Promise<void>;

	/**
	 * Search conversations
	 */
	searchConversations(query: string): Promise<IConversation[]>;
}

/**
 * Message processor interface
 */
export interface IMessageProcessor {
	/**
	 * Process user message before sending
	 */
	processUserMessage(content: string, context: CodeContext): string;

	/**
	 * Process assistant response
	 */
	processAssistantResponse(content: string): string;

	/**
	 * Extract code blocks from message
	 */
	extractCodeBlocks(content: string): CodeBlock[];

	/**
	 * Extract file references from message
	 */
	extractFileReferences(content: string): string[];
}

/**
 * Code block in a message
 */
export interface CodeBlock {
	/** Language identifier */
	language?: string;
	/** Code content */
	code: string;
	/** Whether it's a complete file */
	isCompleteFile: boolean;
	/** File path if specified */
	filePath?: string;
}

/**
 * Mode manager interface
 */
export interface IModeManager {
	/**
	 * Get available modes
	 */
	getAvailableModes(): AIMode[];

	/**
	 * Get mode configuration
	 */
	getModeConfig(mode: AIMode): ModeConfiguration;

	/**
	 * Switch conversation mode
	 */
	switchMode(conversationId: string, mode: AIMode): void;

	/**
	 * Register custom mode
	 */
	registerCustomMode(mode: AIMode, config: ModeConfiguration): void;
}

/**
 * Mode configuration
 */
export interface ModeConfiguration {
	/** System prompt */
	systemPrompt: string;
	/** Temperature */
	temperature: number;
	/** Max tokens */
	maxTokens: number;
	/** Context window */
	contextWindow: number;
	/** Available tools */
	tools: string[];
	/** Response format */
	responseFormat: 'text' | 'code' | 'structured';
}
