import { Service, CharacteristicValue } from 'homebridge';
import { SmartRentPlatform } from '../platform';
import type { SmartRentAccessory } from '.';
import { WSEvent } from '../lib/client';

/**
 * Leak Sensor Accessory
 * An instance of this class is created for each accessory the platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LeakSensorAccessory {
  private service: Service;

  private state: {
    hubId: string;
    deviceId: string;
    leak: {
      current: CharacteristicValue;
    };
  };

  constructor(
    private readonly platform: SmartRentPlatform,
    private readonly accessory: SmartRentAccessory
  ) {
    this.state = {
      hubId: this.accessory.context.device.room.hub_id.toString(),
      deviceId: this.accessory.context.device.id.toString(),
      leak: {
        current: this.platform.Characteristic.LeakDetected.LEAK_NOT_DETECTED,
      },
    };

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.device.id.toString()
      );

    // get the LeakDetected service if it exists, otherwise create a new LeakSensor service
    this.service =
      this.accessory.getService(this.platform.Service.LeakSensor) ||
      this.accessory.addService(this.platform.Service.LeakSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name
    );

    // create handlers for required characteristics
    // see https://developers.homebridge.io/#/service/LeakSensor
    this.service
      .getCharacteristic(this.platform.Characteristic.LeakDetected)
      .onGet(this.handleLeakDetected.bind(this));

    // subscribe to device events
    this.platform.smartRentApi.websocket.event[this.state.deviceId] = (
      event: WSEvent
    ) => this.handleDeviceStateChanged(event);
  }

  private _getLeakDetectedCharacteristicValue(leak: boolean) {
    const currentValue = leak
      ? this.platform.Characteristic.LeakDetected.LEAK_DETECTED
      : this.platform.Characteristic.LeakDetected.LEAK_NOT_DETECTED;
    return currentValue;
  }

  /**
   * Handle requests to get the current value of the "Leak Detected" characteristic
   */
  async handleLeakDetected(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET LeakDetected');
    const leakAttributes = await this.platform.smartRentApi.getState(
      this.state.hubId,
      this.state.deviceId
    );
    const leak = leakAttributes.leak as boolean;
    const currentValue = this._getLeakDetectedCharacteristicValue(leak);
    this.state.leak.current = currentValue;
    return currentValue;
  }

  /**
   * Handle device state changed events
   * @param event
   */
  handleDeviceStateChanged(event: WSEvent) {
    this.platform.log.debug('Received websocket leak event:', event);
    switch (event.name) {
      case 'leak':
        const leak = this._getLeakDetectedCharacteristicValue(
          event.last_read_state === 'true'
        );
        this.state.leak.current = leak;
        this.service.updateCharacteristic(
          this.platform.Characteristic.LeakDetected,
          leak
        );
        break;
    }
  }
}
