'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, LayoutGrid, Users, Clock } from 'lucide-react';

interface Notification {
  id: string;
  platform: 'mattermost' | 'trello' | 'flock';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const platformIcons = {
  mattermost: MessageSquare,
  trello: LayoutGrid,
  flock: Users,
};

const platformColors = {
  mattermost: 'bg-blue-100 text-blue-800',
  trello: 'bg-green-100 text-green-800',
  flock: 'bg-purple-100 text-purple-800',
};

export default function NotificationFeed() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching notifications from all platforms
    const fetchNotifications = async () => {
      setIsLoading(true);
      
      // Mock data - replace with actual API calls
      const mockNotifications: Notification[] = [
        {
          id: '1',
          platform: 'mattermost',
          title: 'New message in #general',
          message: '@john: Welcome to the team!',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          read: false,
        },
        {
          id: '2',
          platform: 'trello',
          title: 'Card moved to Done',
          message: 'Project Alpha moved to Done by Sarah',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          read: false,
        },
        {
          id: '3',
          platform: 'flock',
          title: 'New file shared',
          message: 'Marketing report.pdf shared by Mike',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          read: true,
        },
        {
          id: '4',
          platform: 'mattermost',
          title: 'Direct message from Alice',
          message: 'Can we sync up at 3 PM?',
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          read: true,
        },
      ];

      setTimeout(() => {
        setNotifications(mockNotifications);
        setIsLoading(false);
      }, 1000);
    };

    fetchNotifications();
  }, []);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const groupedNotifications = notifications.reduce((acc, notification) => {
    const dateKey = notification.timestamp.toLocaleDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="rounded-lg bg-gray-200 p-4">
              <div className="h-4 w-32 rounded bg-gray-300"></div>
              <div className="mt-2 h-3 w-full rounded bg-gray-300"></div>
              <div className="mt-1 h-3 w-4/5 rounded bg-gray-300"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="text-gray-400">
            <MessageSquare className="mx-auto h-12 w-12" />
          </div>
          <p className="mt-2 text-sm text-gray-600">No notifications yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
        <div key={date} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">{date}</h3>
          <div className="space-y-2">
            {dateNotifications.map((notification) => {
              const Icon = platformIcons[notification.platform];
              const colorClass = platformColors[notification.platform];
              
              return (
                <div
                  key={notification.id}
                  className={`group rounded-lg border bg-white p-4 transition-all hover:shadow-md ${
                    !notification.read ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">{notification.title}</h4>
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(notification.timestamp)}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}