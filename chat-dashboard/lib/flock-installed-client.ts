/**
 * Flock Installed App Client
 * Simplified client for working with installed Flock apps (no OAuth required)
 */

import { flockLogger } from './logger';

export interface FlockInstalledConfig {
  appId: string;
  appSecret: string;
  apiUrl: string;
  webhookUrl?: string;
}

export interface FlockUserInfo {
  id: string;
  userId: string;
  name: string;
  email: string;
  profileImage?: string;
}

export interface FlockMessage {
  text?: string;
  attachments?: any[];
  to: string;
  notification?: string;
}

export class FlockInstalledClient {
  private config: FlockInstalledConfig;

  constructor(config: FlockInstalledConfig) {
    this.config = config;
    flockLogger.info('FlockInstalledClient initialized', {
      appId: config.appId,
      apiUrl: config.apiUrl
    });
  }

  /**
   * Get current user info using app token
   */
  async getCurrentUser(token: string): Promise<FlockUserInfo> {
    const response = await fetch(`${this.config.apiUrl}/users.getInfo?token=${token}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.userId || data.id,
      userId: data.userId || data.id,
      name: data.firstName ? `${data.firstName} ${data.lastName || ''}` : data.name || 'User',
      email: data.email || '',
      profileImage: data.profileImage
    };
  }

  /**
   * Send message to user/channel (for installed apps)
   */
  async sendMessage(token: string, message: FlockMessage) {
    const response = await fetch(`${this.config.apiUrl}/chat.sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        to: message.to,
        text: message.text,
        attachments: message.attachments,
        notification: message.notification
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Validate app token (for installed apps)
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      await this.getCurrentUser(token);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get app configuration (installed app version)
   */
  async getAppInfo(appToken: string) {
    const response = await fetch(`${this.config.apiUrl}/apps.getInfo?token=${appToken}`);
    if (!response.ok) {
      throw new Error(`Failed to get app info: ${response.status}`);
    }
    return response.json();
  }
}

export const createFlockInstalledClient = () => new FlockInstalledClient({
  appId: process.env.NEXT_PUBLIC_FLOCK_APP_ID || '',
  appSecret: process.env.FLOCK_APP_SECRET || '',
  apiUrl: process.env.NEXT_PUBLIC_FLOCK_URL || 'https://api.flock.com'
});

export default FlockInstalledClient;