'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, User, Hash, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  resolveUserName, 
  resolveChannelName, 
  getMessagePreview, 
  getRelativeTime, 
  getEventTypeInfo, 
  getPlatformInfo 
} from '@/lib/activity-helpers';

interface Activity {
  id: string;
  platform: 'mattermost' | 'trello' | 'flock';
  event_type: string;
  user_id?: string;
  channel_id?: string;
  data: any;
  timestamp: string;
  processed: boolean;
}

interface EnhancedActivityCardProps {
  activity: Activity;
  onViewMessage?: (channelId: string, messageId?: string) => void;
  onViewChannel?: (channelId: string) => void;
}

export default function EnhancedActivityCard({ 
  activity, 
  onViewMessage, 
  onViewChannel 
}: EnhancedActivityCardProps) {
  const [userName, setUserName] = useState<string>('Loading...');
  const [channelName, setChannelName] = useState<string>('Loading...');
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  // Resolve IDs to human-readable names
  useEffect(() => {
    const resolveNames = async () => {
      if (activity.user_id) {
        const resolvedUserName = await resolveUserName(activity.user_id);
        setUserName(resolvedUserName);
      } else {
        setUserName('System');
      }

      if (activity.channel_id) {
        const resolvedChannelName = await resolveChannelName(activity.channel_id);
        setChannelName(resolvedChannelName);
      } else {
        setChannelName('Direct Message');
      }
    };

    resolveNames();
  }, [activity.user_id, activity.channel_id]);

  const eventInfo = getEventTypeInfo(activity.event_type);
  const platformInfo = getPlatformInfo(activity.platform);
  const messagePreview = getMessagePreview(activity.data);
  const relativeTime = getRelativeTime(activity.timestamp);

  const handleCopyDetails = async () => {
    const details = `
Activity: ${activity.event_type}
User: ${userName} (${activity.user_id})
Channel: ${channelName} (${activity.channel_id})
Time: ${activity.timestamp}
Platform: ${activity.platform}
Message: ${messagePreview}
    `.trim();

    try {
      await navigator.clipboard.writeText(details);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  const handleViewMessage = () => {
    if (activity.channel_id && onViewMessage) {
      const messageId = activity.data?.message_id || activity.data?.id;
      onViewMessage(activity.channel_id, messageId);
    }
  };

  const handleViewChannel = () => {
    if (activity.channel_id && onViewChannel) {
      onViewChannel(activity.channel_id);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        {/* Main Content */}
        <div className="flex items-start space-x-3 flex-1">
          {/* Platform Icon */}
          <div className={`text-2xl p-2 rounded-lg ${platformInfo.bgColor}`}>
            {platformInfo.icon}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header with Event Type and Platform */}
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">{eventInfo.icon}</span>
              <span className={`font-semibold ${eventInfo.color}`}>
                {eventInfo.label}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${platformInfo.color} ${platformInfo.bgColor}`}>
                {activity.platform}
              </span>
              {activity.processed ? (
                <CheckCircle className="w-4 h-4 text-green-500" title="Processed" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500" title="Pending" />
              )}
            </div>

            {/* User and Channel Info */}
            <div className="flex items-center space-x-4 mb-2">
              <div className="flex items-center space-x-1 text-sm text-gray-700">
                <User className="w-4 h-4" />
                <span className="font-medium">{userName}</span>
              </div>
              {activity.channel_id && (
                <div className="flex items-center space-x-1 text-sm text-gray-700">
                  <Hash className="w-4 h-4" />
                  <button 
                    onClick={handleViewChannel}
                    className="font-medium hover:text-blue-600 transition-colors"
                    title="View channel"
                  >
                    {channelName}
                  </button>
                </div>
              )}
            </div>

            {/* Message Preview */}
            {messagePreview && (
              <div className="bg-gray-50 rounded-md p-3 mb-2">
                <p className="text-sm text-gray-800 italic">
                  "{messagePreview}"
                </p>
              </div>
            )}

            {/* Additional Data */}
            {activity.data?.file_ids && activity.data.file_ids.length > 0 && (
              <div className="flex items-center space-x-1 text-xs text-gray-500 mb-2">
                <span>📎</span>
                <span>{activity.data.file_ids.length} file(s) attached</span>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{relativeTime}</span>
              <span className="text-gray-400">•</span>
              <span className="font-mono">
                {new Date(activity.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1 ml-4">
          {activity.channel_id && activity.data?.message_id && (
            <button
              onClick={handleViewMessage}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="View message in channel"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          
          <div className="relative">
            <button
              onClick={handleCopyDetails}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
              title="Copy activity details"
            >
              <Copy className="w-4 h-4" />
            </button>
            {copyFeedback && (
              <div className="absolute -top-8 right-0 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {copyFeedback}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Technical Details (Collapsible) */}
      <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
          Technical Details
        </summary>
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono space-y-1">
          <div><strong>ID:</strong> {activity.id}</div>
          <div><strong>User ID:</strong> {activity.user_id || 'N/A'}</div>
          <div><strong>Channel ID:</strong> {activity.channel_id || 'N/A'}</div>
          <div><strong>Event:</strong> {activity.event_type}</div>
          <div><strong>Platform:</strong> {activity.platform}</div>
          <div><strong>Processed:</strong> {activity.processed ? 'Yes' : 'No'}</div>
          {activity.data && Object.keys(activity.data).length > 0 && (
            <div>
              <strong>Data:</strong>
              <pre className="mt-1 text-xs overflow-x-auto">
                {JSON.stringify(activity.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}