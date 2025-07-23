'use client';

import { useState } from 'react';
import { Search, Hash, Plus, ChevronDown, Shield } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'direct';
  unread?: number;
  status?: 'online' | 'offline';
}

interface MattermostSidebarProps {
  channels: Channel[];
  directMessages: Channel[];
  currentChannel: string;
  onChannelSelect: (channelId: string) => void;
  onAdminDashboard?: () => void;
}

/**
 * Left sidebar navigation for Mattermost interface matching the screenshot design.
 * 
 * Args:
 *   channels (Channel[]): List of channel objects
 *   directMessages (Channel[]): List of direct message objects
 *   currentChannel (string): Currently selected channel ID
 *   onChannelSelect (function): Callback when channel is selected
 * 
 * Returns:
 *   JSX.Element: Sidebar navigation component
 */
export default function MattermostSidebar({ 
  channels, 
  directMessages, 
  currentChannel, 
  onChannelSelect,
  onAdminDashboard
}: MattermostSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="w-60 bg-[#2d3748] text-white flex flex-col border-r border-gray-600">
      {/* Team Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs font-bold">
              N
            </div>
            <span className="font-semibold text-sm">NJ Designpark</span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
        
        {/* Find Channel Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Find channel"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-600 text-white pl-10 pr-4 py-1.5 rounded text-sm focus:bg-gray-500 focus:outline-none placeholder-gray-400"
          />
        </div>
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Threads */}
        <div className="p-2 border-b border-gray-600">
          <button className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-600 text-sm text-left">
            <div className="w-4 h-4 rounded bg-purple-500 flex items-center justify-center">
              <span className="text-xs">T</span>
            </div>
            <span>Threads</span>
          </button>
        </div>

        {/* Channels Section */}
        <div className="px-2 py-3">
          <div className="flex items-center justify-between px-3 py-1 mb-2">
            <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Channels
            </span>
            <Plus className="h-4 w-4 text-gray-400 cursor-pointer hover:text-white" />
          </div>
          
          <div className="space-y-1">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onChannelSelect(channel.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center justify-between group ${
                  currentChannel === channel.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                <div className="flex items-center min-w-0">
                  <Hash className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </div>
                {channel.unread && channel.unread > 0 && (
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">
                    {channel.unread > 99 ? '99+' : channel.unread}
                  </div>
                )}
              </button>
            ))}
            
            {/* Add channels option */}
            <button className="w-full text-left px-3 py-1.5 rounded text-sm text-gray-400 hover:bg-gray-600 hover:text-white flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              <span>Add channels</span>
            </button>
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="px-2 py-3">
          <div className="flex items-center justify-between px-3 py-1 mb-2">
            <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Direct Messages
            </span>
            <Plus className="h-4 w-4 text-gray-400 cursor-pointer hover:text-white" />
          </div>
          
          <div className="space-y-1">
            {directMessages.map((dm) => (
              <button
                key={dm.id}
                onClick={() => onChannelSelect(dm.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center justify-between group ${
                  currentChannel === dm.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                <div className="flex items-center min-w-0">
                  <div className={`w-2 h-2 rounded-full mr-3 ${
                    dm.status === 'online' ? 'bg-green-400' : 'bg-gray-400'
                  }`}></div>
                  <span className="truncate">{dm.name}</span>
                </div>
                {dm.unread && dm.unread > 0 && (
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">
                    {dm.unread > 99 ? '99+' : dm.unread}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Admin Dashboard */}
        {onAdminDashboard && (
          <div className="px-2 py-2 border-t border-gray-600">
            <button 
              onClick={onAdminDashboard}
              className="w-full text-left px-3 py-1.5 rounded text-sm text-gray-400 hover:bg-blue-600 hover:text-white flex items-center transition-colors group"
              title="Open Admin Dashboard"
            >
              <div className="flex items-center justify-center w-4 h-4 mr-2">
                <Shield className="h-4 w-4 group-hover:text-white" />
              </div>
              <span className="font-medium">Admin Dashboard</span>
            </button>
          </div>
        )}

        {/* Invite Members */}
        <div className="px-2 py-2 border-t border-gray-600 mt-auto">
          <button className="w-full text-left px-3 py-1.5 rounded text-sm text-gray-400 hover:bg-gray-600 hover:text-white flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            <span>Invite Members</span>
          </button>
        </div>
      </div>
    </div>
  );
} 