/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Central place for all FewStepsAway chat command registrations.
 *
 * Importing this module registers all commands and context menu actions
 * via side-effect, mirroring how VS Code contrib modules work.
 */

import './actions/contextActions.js';
import './actions/sessionActions.js';
import './actions/modeActions.js';
import './actions/providerSettingsActions.js';
import './actions/fewStepsAwayAuthActions.js';
import './actions/composerActions.js';
import './actions/mcpSettingsActions.js';
import './actions/onboardingActions.js';
import './actions/debtActions.js';
import './disableLegacyExtension.contribution.js';
