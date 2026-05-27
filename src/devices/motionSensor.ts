import { DeviceData, Device } from './base';

export type MotionSensorAttributes = { motion_binary: boolean };

export type MotionSensorData = DeviceData<
  MotionSensorAttributes,
  'sensor_notification',
  true
>;

export type MotionSensor = Device<MotionSensorData, MotionSensorAttributes>;
