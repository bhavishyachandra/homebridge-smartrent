import { LeakSensorData } from './leakSensor';
import { LockData } from './lock';
import { SwitchData } from './switch';
import { ThermostatData } from './thermostat';

export * from './base';
export * from './leakSensor';
export * from './lock';
export * from './switch';
export * from './thermostat';

export type DeviceDataUnion =
  | LeakSensorData
  | LockData
  | SwitchData
  | ThermostatData;
