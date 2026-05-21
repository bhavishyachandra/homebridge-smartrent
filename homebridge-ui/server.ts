/* eslint-disable no-console */
import {
  HomebridgePluginUiServer,
  RequestError,
} from '@homebridge/plugin-ui-utils';
import fs from 'node:fs';
import { SmartRentAuthClient } from '../dist/lib/auth.js';

interface LoginPayload {
  email?: string;
  password?: string;
  tfaCode?: string;
}

class PluginUiServer extends HomebridgePluginUiServer {
  private readonly storagePath: string;
  private readonly sessionPath: string;

  constructor() {
    super();

    if (!this.homebridgeStoragePath) {
      throw new Error('Homebridge storage path is not available');
    }
    this.storagePath = this.homebridgeStoragePath;
    this.sessionPath = `${this.storagePath}/smartrent/session.json`;

    this.onRequest('/session', this.checkSession.bind(this));
    this.onRequest('/logout', this.clearSession.bind(this));
    this.onRequest('/login', this.login.bind(this));

    this.ready();
  }

  async checkSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        return { code: 200 };
      }
      return { code: 404 };
    } catch (error) {
      throw new RequestError('Failed to check session', {
        message: (error as Error).message,
      });
    }
  }

  async clearSession() {
    try {
      if ((await this.checkSession()).code === 200) {
        await fs.promises.rm(this.sessionPath);
      }
      return { code: 200 };
    } catch (error) {
      throw new RequestError('Failed to delete auth token', {
        message: (error as Error).message,
      });
    }
  }

  async login(payload: LoginPayload) {
    try {
      const { email, password, tfaCode } = payload;
      if (!email) {
        console.error('Email required');
        return { code: 401, message: 'Email required' };
      }
      if (!password) {
        console.error('Password required');
        return { code: 401, message: 'Password required' };
      }
      const authClient = new SmartRentAuthClient(this.storagePath);
      const accessToken = await authClient.getAccessToken({
        email,
        password,
        tfaCode,
      });
      if (accessToken) {
        return { code: 200 };
      }
      if (authClient.isTfaSession) {
        return {
          code: 403,
          message: tfaCode ? 'Invalid 2FA code' : '2FA code required',
        };
      }
      return { code: 403, message: 'Invalid email or password' };
    } catch (error) {
      throw new RequestError('Failed to login to SmartRent', {
        message: (error as Error).message,
      });
    }
  }
}

(() => new PluginUiServer())();
