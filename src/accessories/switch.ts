import { Service, CharacteristicValue } from 'homebridge';
import { SmartRentPlatform } from '../platform';
import type { SmartRentAccessory } from '.';
import { Switch, SwitchAttributes } from './../devices';
import { WSEvent } from '../lib/client';

/**
 * Switch Accessory
 * An instance of this class is created for each accessory the platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SwitchAccessory {
  private service: Service;

  private state: {
    hubId: string;
    deviceId: string;
    on: {
      current: CharacteristicValue;
      target: CharacteristicValue;
    };
  };

  constructor(
    private readonly platform: SmartRentPlatform,
    private readonly accessory: SmartRentAccessory
  ) {
    this.state = {
      hubId: this.accessory.context.device.room.hub_id.toString(),
      deviceId: this.accessory.context.device.id.toString(),
      on: {
        current: 0,
        target: 0,
      },
    };

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.device.id.toString()
      );

    // get the Switch service if it exists, otherwise create a new Switch service
    this.service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name
    );

    // create handlers for required characteristics
    // see https://developers.homebridge.io/#/service/Switch
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    // subscribe to device state changed events
    this.platform.smartRentApi.websocket.event[this.state.deviceId] = (
      event: WSEvent
    ) => this.handleDeviceStateChanged(event);
  }

  private static _getOnCharacteristicValue(on: boolean) {
    const currentValue = on ? 1 : 0;
    return currentValue;
  }

  /**
   * Handle device state changed events
   */
  async handleDeviceStateChanged(event: WSEvent) {
    this.platform.log.debug('Received websocket Switch event:', event);
    switch (event.name) {
      case 'on':
        this.state.on.current = SwitchAccessory._getOnCharacteristicValue(
          event.last_read_state === 'true'
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          this.state.on.current
        );
        break;
      default:
        break;
    }
  }

  /**
   * Handle requests to get the current value of the "On" characteristic
   */
  async handleOnGet(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET On');
    const switchAttributes = await this.platform.smartRentApi.getState(
      this.state.hubId,
      this.state.deviceId
    );
    const on = switchAttributes.on as boolean;
    const currentValue = SwitchAccessory._getOnCharacteristicValue(on);
    this.state.on.current = currentValue;
    return currentValue;
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET On:', value);
    this.state.on.target = value;
    const switchAttributes = await this.platform.smartRentApi.setState<
      Switch,
      SwitchAttributes
    >(this.state.hubId, this.state.deviceId, { on: !!value });
    const on = switchAttributes.on as boolean;
    this.state.on.current = SwitchAccessory._getOnCharacteristicValue(on);
  }
}
