'use client';

import React, { useState } from 'react';
import { Bell, Volume2, Clock, Settings, Check, X, TestTube } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationService } from '@/lib/notification-service';
import { SoundService } from '@/lib/sound-service';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSettings({ isOpen, onClose }: NotificationSettingsProps) {
  const { settings, updateSettings, permissionStatus, requestPermission } = useNotifications();
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const notificationService = NotificationService.getInstance();
  const soundService = SoundService.getInstance();

  const handlePermissionRequest = async () => {
    setIsRequestingPermission(true);
    try {
      const permission = await requestPermission();
      if (permission === 'granted') {
        updateSettings({ browserNotifications: true });
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleTestNotification = async () => {
    if (permissionStatus === 'granted') {
      await notificationService.showTestNotification();
    }
  };

  const handleTestSound = async () => {
    await soundService.playTestSound();
  };

  const handleQuietHoursChange = (field: string, value: string | boolean) => {
    updateSettings({
      quietHours: {
        ...settings.quietHours,
        [field]: value
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Bell className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="space-y-6">
            {/* Browser Notifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Browser Notifications
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Desktop Notifications</h4>
                    <p className="text-sm text-gray-600">
                      Show notifications on your desktop when you receive messages
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {permissionStatus === 'granted' ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.browserNotifications}
                          onChange={(e) => updateSettings({ browserNotifications: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    ) : (
                      <button
                        onClick={handlePermissionRequest}
                        disabled={isRequestingPermission}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isRequestingPermission ? 'Requesting...' : 'Enable'}
                      </button>
                    )}
                  </div>
                </div>

                {permissionStatus === 'granted' && settings.browserNotifications && (
                  <div className="ml-4 p-3 bg-blue-50 rounded-lg">
                    <button
                      onClick={handleTestNotification}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <TestTube className="h-4 w-4" />
                      <span>Test Notification</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sound Notifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Volume2 className="h-5 w-5 mr-2" />
                Sound Notifications
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Sound Alerts</h4>
                    <p className="text-sm text-gray-600">
                      Play sounds when you receive messages
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.soundNotifications}
                      onChange={(e) => updateSettings({ soundNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {settings.soundNotifications && (
                  <div className="ml-4 p-3 bg-green-50 rounded-lg">
                    <button
                      onClick={handleTestSound}
                      className="flex items-center space-x-2 text-green-600 hover:text-green-800 transition-colors"
                    >
                      <TestTube className="h-4 w-4" />
                      <span>Test Sound</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notification Frequency */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Notification Frequency
              </h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { value: 'immediate', label: 'Immediate', description: 'Get notified right away' },
                    { value: 'batched', label: 'Batched', description: 'Group notifications every few minutes' },
                    { value: 'quiet', label: 'Quiet', description: 'Only urgent notifications' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        name="frequency"
                        value={option.value}
                        checked={settings.notificationFrequency === option.value}
                        onChange={(e) => updateSettings({ notificationFrequency: e.target.value as any })}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{option.label}</div>
                        <div className="text-sm text-gray-600">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Quiet Hours
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Enable Quiet Hours</h4>
                    <p className="text-sm text-gray-600">
                      Silence notifications during specified hours
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.quietHours.enabled}
                      onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {settings.quietHours.enabled && (
                  <div className="ml-4 p-4 bg-purple-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={settings.quietHours.start}
                          onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={settings.quietHours.end}
                          onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}