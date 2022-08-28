import { DeviceData, Device } from './base';

export type ThermostatFanMode = 'auto' | 'on';
export type ThermostatMode = 'off' | 'cool' | 'heat' | 'auto';

export type ThermostatAttributes = {
  cool_target_temp: number;
  current_humidity: number;
  current_temp: number;
  fan_mode: ThermostatFanMode;
  heat_target_temp: number;
  mode: ThermostatMode;
};

export type ThermostatData = DeviceData<
  ThermostatAttributes,
  'thermostat',
  false
>;

export type Thermostat = Device<ThermostatData, ThermostatAttributes>;
