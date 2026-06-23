/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import {
	IInlineSuggestionService, InlineSuggestionService
} from './inlineSuggestionService.js';
import {
	INextEditService, NextEditService
} from './nextEditService.js';
import {
	IChatInputSuggestionService, ChatInputSuggestionService
} from './chatInputSuggestionService.js';
import {
	IAutocompleteServiceManager, AutocompleteServiceManager
} from './autocompleteServiceManager.js';
import { IVisibleCodeTracker, VisibleCodeTracker } from './visibleCodeTracker.js';
import { IEditHistoryTracker, EditHistoryTracker } from './editHistoryTracker.js';

registerSingleton(IInlineSuggestionService, InlineSuggestionService, InstantiationType.Delayed);
registerSingleton(INextEditService, NextEditService, InstantiationType.Delayed);
registerSingleton(IChatInputSuggestionService, ChatInputSuggestionService, InstantiationType.Delayed);
registerSingleton(IAutocompleteServiceManager, AutocompleteServiceManager, InstantiationType.Delayed);
registerSingleton(IEditHistoryTracker, EditHistoryTracker, InstantiationType.Delayed);
registerSingleton(IVisibleCodeTracker, VisibleCodeTracker, InstantiationType.Delayed);
