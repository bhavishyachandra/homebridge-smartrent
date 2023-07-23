import { SmartRentPlatform } from '../platform';
import { SmartRentApiClient, SmartRentWebsocketClient } from './client';
import {
  BaseDeviceResponse,
  BaseDeviceDataResponse,
  BaseDeviceAttributes,
  DeviceDataUnion,
} from '../devices';

type UnitData = {
  building: string;
  city: string;
  country: string | null;
  floor: string;
  group: {
    city: string;
    country: string;
    group_white_label_config: null;
    id: number;
    marketing_name: string;
    organization_id: number;
    parking_enabled: false;
    property_code: string;
    rentcafe_id: null;
    state: string;
    store_url: null;
    street_address_1: string;
    street_address_2: string;
    sync_interval: number;
    temperature_scale: string;
    timezone: string;
    uuid: string;
    zip: string;
  };
  group_id: number;
  has_hub: boolean;
  hub: {
    connected_to_community_wifi: boolean;
    connection: string;
    firmware: string;
    hub_account_id: number;
    id: number;
    online: number;
    serial: string;
    timezone: null;
    type: string;
    unit_id: number;
    wifi_supported: boolean;
  };
  hub_id: number;
  id: number;
  image_url: string;
  marketing_name: string;
  parking_enabled: boolean;
  portal_only: boolean;
  ring_enabled: boolean;
  state: string;
  street_address_1: string;
  street_address_2: string;
  temperature_scale: string;
  timezone: string;
  unit_code: string;
  zip: string;
};

type UnitRecords = {
  current_page: 1;
  records: UnitData[];
  total_pages: 1;
  total_records: 1;
};

type DeviceRecords = {
  data: DeviceDataUnion[];
};

export class SmartRentApi {
  public readonly client: SmartRentApiClient;
  public readonly websocket: SmartRentWebsocketClient;

  constructor(private readonly platform: SmartRentPlatform) {
    this.client = new SmartRentApiClient(platform);
    this.websocket = new SmartRentWebsocketClient(platform);
  }

  public async discoverDevices() {
    const unitRecords = await this.client.get<UnitRecords>('/units');
    const unitRecordsData = unitRecords.records;
    // Get either the specified unit or the first one
    const unitName = this.platform.config.unitName;
    const unitData = unitName
      ? unitRecordsData.find(unit => unit.marketing_name === unitName)
      : unitRecordsData[0];
    if (!unitData) {
      this.platform.log.error(`Unit ${unitName} not found`);
      return [];
    }

    // Get the unit's hub
    const hubId = unitData.hub_id;
    if (!hubId) {
      this.platform.log.error('No SmartRent hub found');
      return [];
    }

    // Get the devices in the hub
    const devices = await this.client.get<DeviceRecords>(
      `/hubs/${hubId}/devices`
    );
    const devicesData = devices.data;
    this.platform.log.info('Devices Found: ', devicesData);

    if (devicesData.length) {
      this.platform.log.info(`Found ${devicesData.length} devices`);
    } else {
      this.platform.log.error('No devices found');
    }

    for (const i in devicesData) {
      this.platform.log.debug('device: ', devicesData[i]);
      const device = devicesData[i];
      this.websocket.subscribeDevice(device.id);
      // (await websocket.wsClient).send(JSON.stringify(<WSPayload>[null, null, `devices:${device.id}`, 'phx_join', {}]))
    }

    return devicesData;
  }

  public async getState<Device extends BaseDeviceResponse>(
    hubId: string,
    deviceId: string
  ) {
    const device = await this.client.get<Device>(
      `/hubs/${hubId}/devices/${deviceId}`
    );
    // this.platform.log.debug("device: ", device)
    return device.data.attributes;
  }

  public async getData<Device extends BaseDeviceDataResponse>(
    hubId: string,
    deviceId: string
  ) {
    const device = await this.client.get<Device>(
      `/hubs/${hubId}/devices/${deviceId}`
    );
    this.platform.log.debug('getData: ', device);
    return device.data;
  }

  public async setState<
    Device extends BaseDeviceResponse,
    A extends BaseDeviceAttributes
  >(hubId: string, deviceId: string, attributes: Partial<A>) {
    const device = await this.client.patch<Device>(
      `/hubs/${hubId}/devices/${deviceId}`,
      { attributes }
    );
    return device.data.attributes;
  }
}
