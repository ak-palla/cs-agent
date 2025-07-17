'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface NotificationItem {
  id: string;
  type: 'message' | 'mention' | 'reaction' | 'reply' | 'direct_message';
  channelId: string;
  channelName: string;
  channelDisplayName: string;
  channelType: string;
  userId: string;
  username: string;
  userDisplayName: string;
  message: string;
  timestamp: number;
  read: boolean;
  messageId?: string;
  postId?: string;
  mentioned?: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface NotificationSettings {
  browserNotifications: boolean;
  soundNotifications: boolean;
  notificationFrequency: 'immediate' | 'batched' | 'quiet';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  channelSettings: {
    [channelId: string]: {
      notifications: boolean;
      mentions: boolean;
      sounds: boolean;
    };
  };
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  settings: NotificationSettings;
  permissionStatus: NotificationPermission;
  
  // Actions
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  requestPermission: () => Promise<NotificationPermission>;
  
  // Filtering
  getUnreadNotifications: () => NotificationItem[];
  getNotificationsByChannel: (channelId: string) => NotificationItem[];
  getHighPriorityNotifications: () => NotificationItem[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const DEFAULT_SETTINGS: NotificationSettings = {
  browserNotifications: false,
  soundNotifications: true,
  notificationFrequency: 'immediate',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  },
  channelSettings: {}
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('mattermost-notification-settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      } catch (error) {
        console.error('Failed to parse notification settings:', error);
      }
    }

    // Load notifications from localStorage
    const savedNotifications = localStorage.getItem('mattermost-notifications');
    if (savedNotifications) {
      try {
        const parsedNotifications = JSON.parse(savedNotifications);
        // Ensure notifications are sorted by timestamp (latest first)
        const sortedNotifications = parsedNotifications.sort((a: NotificationItem, b: NotificationItem) => b.timestamp - a.timestamp);
        setNotifications(sortedNotifications);
      } catch (error) {
        console.error('Failed to parse notifications:', error);
      }
    }

    // Check initial permission status
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('mattermost-notification-settings', JSON.stringify(settings));
  }, [settings]);

  // Save notifications to localStorage when they change
  useEffect(() => {
    localStorage.setItem('mattermost-notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Clean up old notifications (keep last 100) and ensure proper sorting
  useEffect(() => {
    if (notifications.length > 100) {
      setNotifications(prev => {
        const sorted = [...prev].sort((a, b) => b.timestamp - a.timestamp);
        return sorted.slice(0, 100);
      });
    }
  }, [notifications]);

  const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);
    
    // Debug log to confirm proper ordering
    console.log('📨 Added notification:', {
      id: newNotification.id,
      timestamp: newNotification.timestamp,
      type: newNotification.type,
      channel: newNotification.channelDisplayName,
      user: newNotification.userDisplayName
    });

    // Show browser notification if enabled and permission granted
    if (settings.browserNotifications && permissionStatus === 'granted') {
      showBrowserNotification(newNotification);
    }

    // Play sound if enabled
    if (settings.soundNotifications && shouldPlaySound(newNotification)) {
      playNotificationSound(newNotification);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);
    
    if (permission === 'granted') {
      updateSettings({ browserNotifications: true });
    }
    
    return permission;
  };

  const getUnreadNotifications = () => {
    return notifications.filter(n => !n.read).sort((a, b) => b.timestamp - a.timestamp);
  };

  const getNotificationsByChannel = (channelId: string) => {
    return notifications.filter(n => n.channelId === channelId).sort((a, b) => b.timestamp - a.timestamp);
  };

  const getHighPriorityNotifications = () => {
    return notifications.filter(n => n.priority === 'high' && !n.read).sort((a, b) => b.timestamp - a.timestamp);
  };

  const shouldPlaySound = (notification: NotificationItem): boolean => {
    // Check quiet hours
    if (settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = settings.quietHours;
      
      if (start <= end) {
        // Same day range
        if (currentTime >= start && currentTime <= end) {
          return false;
        }
      } else {
        // Overnight range
        if (currentTime >= start || currentTime <= end) {
          return false;
        }
      }
    }

    // Check channel-specific settings
    const channelSettings = settings.channelSettings[notification.channelId];
    if (channelSettings && !channelSettings.sounds) {
      return false;
    }

    return true;
  };

  const showBrowserNotification = (notification: NotificationItem) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const title = `${notification.userDisplayName} in #${notification.channelDisplayName}`;
    const body = notification.message;
    const icon = '/favicon.ico'; // You can customize this

    const browserNotification = new Notification(title, {
      body,
      icon,
      tag: notification.id,
      requireInteraction: notification.priority === 'high',
      silent: !settings.soundNotifications
    });

    browserNotification.onclick = () => {
      window.focus();
      // You can add navigation logic here
      browserNotification.close();
    };

    // Auto-close after 5 seconds for non-high priority
    if (notification.priority !== 'high') {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  };

  const playNotificationSound = (notification: NotificationItem) => {
    // Different sounds for different notification types
    const soundFile = notification.type === 'mention' || notification.type === 'direct_message'
      ? '/sounds/mention.mp3'
      : '/sounds/message.mp3';

    const audio = new Audio(soundFile);
    audio.volume = 0.5;
    audio.play().catch(error => {
      console.log('Could not play notification sound:', error);
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    settings,
    permissionStatus,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    updateSettings,
    requestPermission,
    getUnreadNotifications,
    getNotificationsByChannel,
    getHighPriorityNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}