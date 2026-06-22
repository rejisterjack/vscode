/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Central place for all FewStepsAway chat command registrations.
 *
 * Importing this module registers all commands and context menu actions
 * via side-effect, mirroring how VS Code contrib modules work.
 */

import './actions/contextActions.js';
import './actions/modeActions.js';
import './disableLegacyExtension.contribution.js';
