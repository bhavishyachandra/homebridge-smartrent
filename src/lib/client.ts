import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios';
import { API_URL, API_CLIENT_HEADERS, WS_API_URL, WS_VERSION } from './request';
import { SmartRentAuthClient } from './auth';
import { SmartRentPlatform } from '../platform';
import WebSocket from 'ws';

export type WSDeviceList = `devices:${string}`;
export type WSEvent = {
  id: number;
  name:
    | 'leak'
    | 'fan_mode'
    | 'current_temp'
    | 'current_humidity'
    | 'heating_setpoint'
    | 'cooling_setpoint'
    | 'mode'
    | 'locked'
    | 'on'
    | 'notifications';
  remote_id: string;
  type: string;
  last_read_state: string;
  last_read_state_changed_at: string;
};
export type WSPayload = [null, null, WSDeviceList, string, WSEvent];

export class SmartRentApiClient {
  private authClient: SmartRentAuthClient;
  private readonly apiClient: AxiosInstance;
  // wsClient: Promise<WebSocket>;

  constructor(readonly platform: SmartRentPlatform) {
    this.authClient = new SmartRentAuthClient(
      platform.api.user.storagePath(),
      platform.log
    );
    this.apiClient = this._initializeApiClient();
  }

  /**
   * Initialize Axios instance for SmartRent API requests
   * @returns Axios instance
   */
  private _initializeApiClient() {
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: API_CLIENT_HEADERS,
    });
    apiClient.interceptors.request.use(this._handleRequest.bind(this));
    apiClient.interceptors.response.use(this._handleResponse.bind(this));
    return apiClient;
  }

  /**
   * Get the SmartRent API access token
   * @returns Oauth access token
   */
  public async getAccessToken() {
    return this.authClient.getAccessToken({
      email: this.platform.config.email,
      password: this.platform.config.password,
      tfaCode: this.platform.config.tfaCode,
    });
  }

  /**
   * Attach the access token to the SmartRent API request and log the request
   * @param config Axios request config
   * @returns Axios request config
   */
  private async _handleRequest(config: AxiosRequestConfig) {
    const accessToken = await this.getAccessToken();
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`,
    };
    this.platform.log.debug('Request:', JSON.stringify(config, null, 2));
    this.platform.log.debug('Request:');
    return config;
  }

  /**
   * Log the SmartRent API response
   * @param response Axios response
   * @returns SmartRent response data payload
   */
  private _handleResponse(response: AxiosResponse) {
    this.platform.log.debug(
      'Response:',
      JSON.stringify(response.data, null, 2)
    );
    return response;
  }

  // API request methods

  public async get<T, D = unknown>(
    path: string,
    config?: AxiosRequestConfig<D>
  ) {
    const response = await this.apiClient.get<T>(path, config);
    return response.data;
  }

  public async post<T, D = unknown>(
    path: string,
    data?: D,
    config?: AxiosRequestConfig<D>
  ) {
    const response = await this.apiClient.post<T>(path, data, config);
    return response.data;
  }

  public async patch<T, D = unknown>(
    path: string,
    data?: D,
    config?: AxiosRequestConfig<D>
  ) {
    const response = await this.apiClient.patch<T>(path, data, config);
    return response.data;
  }
}

export class SmartRentWebsocketClient extends SmartRentApiClient {
  public wsClient: Promise<WebSocket>;
  public event: Object;
  private devices: Number[];

  constructor(readonly platform: SmartRentPlatform) {
    super(platform);
    this.wsClient = this._initializeWsClient();
    this.event = {};
    this.devices = [];
  }

  private _emitize(obj: object, eventName: string) {
    let _subscriptions = new Set<Function>();
    Object.defineProperty(obj, eventName, {
      set(func) {
        _subscriptions.add(func);
      },
      get() {
        var emit = (...args: any[]) => {
          _subscriptions.forEach(f => f(...args));
        };

        Object.defineProperty(emit, 'off', {
          set(func) {
            _subscriptions.delete(func);
          },
          get() {
            _subscriptions = new Set();
          },
        });

        return emit;
      },
    });
  }

  /**
   * Initialize WebSocket client for SmartRent API
   * @returns WebSocket client
   */
  private async _initializeWsClient() {
    this.platform.log.debug('WebSocket connection opening');
    const token = String(await this.getAccessToken());
    const wsClient = new WebSocket(
      WS_API_URL +
        '?' +
        new URLSearchParams({ token, vsn: WS_VERSION }).toString()
    );
    wsClient.onopen = this._handleWsOpen.bind(this);
    wsClient.onmessage = this._handleWsMessage.bind(this);
    wsClient.onerror = this._handleWsError.bind(this);
    wsClient.onclose = this._handleWsClose.bind(this);
    return wsClient;
  }

  private _handleWsOpen() {
    this.platform.log.debug('WebSocket connection opened');
    this.devices.forEach(device => this.subscribeDevice(device));
  }

  private _handleWsMessage(message: WebSocket.MessageEvent) {
    this.platform.log.debug(
      `WebSocket message received: Data: ${message.data}`
    );
    let data: WSPayload = JSON.parse(String(message.data));
    if (data[3].includes('attribute_state')) {
      const device = data[2].split(':')[1];
      this.platform.log.debug(String(data[4]));
      this.event[device](data[4]);
    }
  }

  private _handleWsError(error: WebSocket.ErrorEvent) {
    this.platform.log.error(`WebSocket error: ${error}`);
  }

  private _handleWsClose(event: WebSocket.CloseEvent) {
    this.platform.log.debug(
      `WebSocket connection closed: Code: ${event.code}, Reason: ${event.reason}`
    );
    this.wsClient = this._initializeWsClient();
  }

  /**
   * Adds device to websocket client subsciption list and announces events to device handlers
   * @param deviceId Device ID
   */
  public async subscribeDevice(deviceId: Number) {
    this.platform.log.debug(`Subscribing to device: ${deviceId}`);
    if (!this.devices.includes(deviceId)) {
      this.devices.push(deviceId);
      this._emitize(this.event, `${deviceId}`);
    }
    try {
      if ((await this.wsClient).readyState !== WebSocket.OPEN)
        throw 'WebSocket not ready';
      (await this.wsClient).send(
        JSON.stringify(<WSPayload>[
          null,
          null,
          `devices:${deviceId}`,
          'phx_join',
          {},
        ])
      );
      this.platform.log.debug(`Subscribed to device: ${deviceId}`);
    } catch (err) {
      this.platform.log.error(String(err));
      this.platform.log.error(`Dang didnt subscribe ${deviceId}, trying again`);
      setTimeout(() => this.subscribeDevice(deviceId), 1000);
    }
  }
}
