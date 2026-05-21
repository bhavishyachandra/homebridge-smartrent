import { DeviceData, Device } from './base.js';

export type SwitchAttributes = { on: boolean };

export type SwitchData = DeviceData<SwitchAttributes, 'switch_binary', false>;

export type Switch = Device<SwitchData, SwitchAttributes>;
