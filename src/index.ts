import type { API, PlatformPluginConstructor } from 'homebridge';

import { PLATFORM_NAME } from './settings.js';
import { SmartRentPlatform } from './platform.js';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(
    PLATFORM_NAME,
    SmartRentPlatform as unknown as PlatformPluginConstructor
  );
};
