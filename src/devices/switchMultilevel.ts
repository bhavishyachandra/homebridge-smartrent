import { DeviceData, Device } from './base.js';

export type SwitchMultilevelAttributes = { level: number };

export type SwitchMultilevelData = DeviceData<
  SwitchMultilevelAttributes,
  'switch_multilevel',
  false
>;

export type SwitchMultilevel = Device<
  SwitchMultilevelData,
  SwitchMultilevelAttributes
>;
