import { Service, CharacteristicValue } from 'homebridge';
import { SmartRentPlatform } from '../platform';
import type { SmartRentAccessory } from '.';
import { MotionSensorAttributes } from '../devices';
import { WSEvent } from '../lib/client';

export class MotionSensorAccessory {
  private service: Service;

  private state: {
    hubId: string;
    deviceId: string;
    motion: {
      current: CharacteristicValue;
    };
  };

  constructor(
    private readonly platform: SmartRentPlatform,
    private readonly accessory: SmartRentAccessory
  ) {
    const device = this.accessory.context.device;
    const motionAttributes =
      device.attributes as Partial<MotionSensorAttributes>;
    const motion = Boolean(motionAttributes.motion_binary);

    this.state = {
      hubId: device.room.hub_id.toString(),
      deviceId: device.id.toString(),
      motion: {
        current: motion,
      },
    };

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.device.id.toString()
      );

    this.service =
      this.accessory.getService(this.platform.Service.MotionSensor) ||
      this.accessory.addService(this.platform.Service.MotionSensor);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.MotionDetected)
      .onGet(this.handleMotionDetectedGet.bind(this));

    this.platform.smartRentApi.websocket.event[this.state.deviceId] = (
      event: WSEvent
    ) => this.handleDeviceStateChanged(event);
  }

  async handleMotionDetectedGet(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET MotionDetected');
    const motionAttributes = await this.platform.smartRentApi.getState(
      this.state.hubId,
      this.state.deviceId
    );
    const motion = Boolean(motionAttributes.motion_binary);
    this.state.motion.current = motion;
    return motion;
  }

  handleDeviceStateChanged(event: WSEvent) {
    this.platform.log.debug('Received websocket motion event:', event);
    if (event.name !== 'motion_binary') {
      return;
    }

    const motion = event.last_read_state === 'true';
    this.state.motion.current = motion;
    this.service.updateCharacteristic(
      this.platform.Characteristic.MotionDetected,
      motion
    );
  }
}
