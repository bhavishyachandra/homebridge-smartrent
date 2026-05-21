import { PlatformAccessory } from 'homebridge';
import { DeviceDataUnion } from '../devices/index.js';

export * from './leakSensor.js';
export * from './lock.js';
export * from './switch.js';
export * from './thermostat.js';
export * from './switchMultilevel.js';

export type AccessoryContext = { device: DeviceDataUnion };
export type SmartRentAccessory = PlatformAccessory<AccessoryContext>;
