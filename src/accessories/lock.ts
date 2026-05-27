import { Service, CharacteristicValue } from 'homebridge';
import { SmartRentPlatform } from '../platform';
import type { SmartRentAccessory } from '.';
import { Lock, LockAttributes } from './../devices';
import { WSEvent } from '../lib/client';

/**
 * Lock Accessory
 * An instance of this class is created for each accessory the platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LockAccessory {
  private service: Service;
  private battery: Service;

  private state: {
    hubId: string;
    deviceId: string;
    locked: {
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
      locked: {
        current: this.platform.Characteristic.LockTargetState.UNSECURED,
        target: this.platform.Characteristic.LockTargetState.UNSECURED,
      },
    };

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.device.id.toString()
      );

    // set the battery level service for the lock accessory
    this.battery =
      this.accessory.getService(this.platform.Service.Battery) ||
      this.accessory.addService(this.platform.Service.Battery);
    this.battery
      .getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(() => this.handleBatteryLevelGet());

    // get the LockMechanism service if it exists, otherwise create a new LockMechanism service
    this.service =
      this.accessory.getService(this.platform.Service.LockMechanism) ||
      this.accessory.addService(this.platform.Service.LockMechanism);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name
    );

    // create handlers for required characteristics
    // see https://developers.homebridge.io/#/service/LockMechanism
    this.service
      .getCharacteristic(this.platform.Characteristic.LockCurrentState)
      .onGet(this.handleLockCurrentStateGet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.LockTargetState)
      .onGet(this.handleLockTargetStateGet.bind(this))
      .onSet(this.handleLockTargetStateSet.bind(this));

    // subscribe to the lock state change event
    this.platform.smartRentApi.websocket.event[this.state.deviceId] =
      this.handleLockEvent.bind(this);
  }

  private _getLockStateCharacteristicValue(locked: boolean) {
    const currentValue = locked
      ? this.platform.Characteristic.LockTargetState.SECURED
      : this.platform.Characteristic.LockTargetState.UNSECURED;
    return currentValue;
  }

  /**
   * Handle requests to get the current value of the "Battery Level" characteristic
   */
  async handleBatteryLevelGet(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET BatteryLevel');
    const lockData = await this.platform.smartRentApi.getData(
      this.state.hubId,
      this.state.deviceId
    );
    this.platform.log.debug('Lock Data', lockData);
    const batteryLevel = Math.round(Number(lockData.battery_level)) as number;
    return batteryLevel;
  }

  /**
   * Handle requests to get the current value of the "Lock Current State" characteristic
   */
  async handleLockCurrentStateGet(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      'Triggered GET LockCurrentState Start',
      this.state.locked.current
    );
    const lockAttributes = await this.platform.smartRentApi.getState(
      this.state.hubId,
      this.state.deviceId
    );
    const locked = lockAttributes.locked as boolean;
    const currentValue = this._getLockStateCharacteristicValue(locked);
    this.state.locked.current = currentValue;
    this.platform.log.debug(
      'Triggered GET LockCurrentState Done',
      this.state.locked.current
    );
    return currentValue;
  }

  /**
   * Handle requests to get the current value of the "Lock Target State" characteristic
   */
  async handleLockTargetStateGet(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      'Triggered GET LockTargetState',
      this.state.locked.target
    );
    const lockAttributes = await this.platform.smartRentApi.getState(
      this.state.hubId,
      this.state.deviceId
    );
    const locked = lockAttributes.locked as boolean;
    const currentValue = this._getLockStateCharacteristicValue(locked);
    return currentValue;
  }

  /**
   * Handle requests to set the "Lock Target State" characteristic
   */
  async handleLockTargetStateSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET LockTargetState:', value);
    this.state.locked.target = value;
    const lockAttributes = await this.platform.smartRentApi.setState<
      Lock,
      LockAttributes
    >(this.state.hubId, this.state.deviceId, { locked: !!value });
    this.platform.log.debug('Triggered SET LockTargetState:', value);
  }

  /**
   * Handle lock websocket events
   */
  async handleLockEvent(event: WSEvent) {
    this.platform.log.debug('Recieved event on Lock: ', event);
    switch (event.name) {
      case 'locked':
        const currentValue = this._getLockStateCharacteristicValue(
          event.last_read_state === 'true'
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.LockCurrentState,
          currentValue
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.LockTargetState,
          currentValue
        );
        break;
      case 'notifications':
        break;
    }
    // if (event.name === 'locked') {
    //   const currentValue = this._getLockStateCharacteristicValue(event.last_read_state === 'true');
    //   this.service.getCharacteristic(this.platform.Characteristic.LockTargetState).updateValue(currentValue);
    //   this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState).updateValue(currentValue);
    // }
  }

  /**
   * Refresh the current state of the lock using the SmartRent API HTTP request in intervals
   */
  async updateStateTask() {
    const INTERVAL = 10000;
    this.platform.log.debug(
      'Beginning updateStateTask',
      this.state.locked.current
    );
    try {
      const lockAttributes = await this.platform.smartRentApi.getState(
        this.state.hubId,
        this.state.deviceId
      );
      // this.platform.log.debug('lockAttributes', lockAttributes);
      const locked = lockAttributes.locked as boolean;
      const currentValue = this._getLockStateCharacteristicValue(locked);
      this.state.locked.current = currentValue;
      this.state.locked.target = currentValue;
      this.service
        .getCharacteristic(this.platform.Characteristic.LockCurrentState)
        .updateValue(this.state.locked.current);
      this.service
        .getCharacteristic(this.platform.Characteristic.LockTargetState)
        .updateValue(this.state.locked.target);
    } catch (err) {
      this.platform.log.error('Error getting lock state', err);
      this.service
        .getCharacteristic(this.platform.Characteristic.LockCurrentState)
        .updateValue(this.platform.Characteristic.LockCurrentState.UNKNOWN);
    }

    this.platform.log.debug(
      'Ending updateStateTask',
      this.state.locked.current
    );
    setTimeout(() => {
      this.updateStateTask();
    }, INTERVAL);
  }
}
