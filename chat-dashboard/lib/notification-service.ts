/**
 * Browser Notification Service
 * Handles desktop notifications with proper permission management
 */

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: any;
  onClick?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export class NotificationService {
  private static instance: NotificationService;
  private permissionStatus: NotificationPermission = 'default';
  private notifications: Map<string, Notification> = new Map();

  private constructor() {
    if ('Notification' in window) {
      this.permissionStatus = Notification.permission;
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check if browser notifications are supported
   */
  isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return this.permissionStatus;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    if (this.permissionStatus === 'granted') {
      return 'granted';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionStatus = permission;
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Show a desktop notification
   */
  async show(options: NotificationOptions): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('Browser notifications not supported');
      return false;
    }

    if (this.permissionStatus !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag || `notification-${Date.now()}`,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        data: options.data
      });

      // Store notification reference
      if (options.tag) {
        this.notifications.set(options.tag, notification);
      }

      // Set up event listeners
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (options.onClick) {
          options.onClick();
        }
        notification.close();
      };

      notification.onclose = () => {
        if (options.tag) {
          this.notifications.delete(options.tag);
        }
        if (options.onClose) {
          options.onClose();
        }
      };

      notification.onerror = (error) => {
        console.error('Notification error:', error);
        if (options.onError) {
          options.onError(error);
        }
      };

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Close a specific notification by tag
   */
  close(tag: string): void {
    const notification = this.notifications.get(tag);
    if (notification) {
      notification.close();
    }
  }

  /**
   * Close all notifications
   */
  closeAll(): void {
    this.notifications.forEach(notification => {
      notification.close();
    });
    this.notifications.clear();
  }

  /**
   * Show notification for new message
   */
  async showMessageNotification(options: {
    senderName: string;
    channelName: string;
    message: string;
    avatar?: string;
    onClick?: () => void;
  }): Promise<boolean> {
    return this.show({
      title: `${options.senderName} in #${options.channelName}`,
      body: options.message,
      icon: options.avatar || '/favicon.ico',
      tag: `message-${Date.now()}`,
      onClick: options.onClick
    });
  }

  /**
   * Show notification for mention
   */
  async showMentionNotification(options: {
    senderName: string;
    channelName: string;
    message: string;
    avatar?: string;
    onClick?: () => void;
  }): Promise<boolean> {
    return this.show({
      title: `${options.senderName} mentioned you in #${options.channelName}`,
      body: options.message,
      icon: options.avatar || '/favicon.ico',
      tag: `mention-${Date.now()}`,
      requireInteraction: true, // Keep mention notifications visible longer
      onClick: options.onClick
    });
  }

  /**
   * Show notification for direct message
   */
  async showDirectMessageNotification(options: {
    senderName: string;
    message: string;
    avatar?: string;
    onClick?: () => void;
  }): Promise<boolean> {
    return this.show({
      title: `Direct message from ${options.senderName}`,
      body: options.message,
      icon: options.avatar || '/favicon.ico',
      tag: `dm-${Date.now()}`,
      requireInteraction: true,
      onClick: options.onClick
    });
  }

  /**
   * Show notification for reaction
   */
  async showReactionNotification(options: {
    senderName: string;
    channelName: string;
    reaction: string;
    onClick?: () => void;
  }): Promise<boolean> {
    return this.show({
      title: `${options.senderName} reacted to your message`,
      body: `${options.reaction} in #${options.channelName}`,
      icon: '/favicon.ico',
      tag: `reaction-${Date.now()}`,
      onClick: options.onClick
    });
  }

  /**
   * Check if quiet hours are active
   */
  isQuietHours(quietHours: { enabled: boolean; start: string; end: string }): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { start, end } = quietHours;

    if (start <= end) {
      // Same day range (e.g., 09:00 to 17:00)
      return currentTime >= start && currentTime <= end;
    } else {
      // Overnight range (e.g., 22:00 to 08:00)
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * Test notification - useful for settings
   */
  async showTestNotification(): Promise<boolean> {
    return this.show({
      title: 'Test Notification',
      body: 'This is a test notification from Mattermost Chat Dashboard',
      icon: '/favicon.ico',
      tag: 'test-notification'
    });
  }
}