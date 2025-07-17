'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Hash, Users, Settings, Trash2, UserPlus, UserMinus, X, Edit, Search } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  display_name: string;
  purpose: string;
  header: string;
  type: string;
  team_id: string;
}

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ChannelMember {
  user_id: string;
  channel_id: string;
  roles: string;
}

interface ChannelManagerProps {
  token: string;
  currentTeam: { id: string; display_name: string } | null;
  users: User[];
  onChannelCreated: (channel: Channel) => void;
  onChannelDeleted: (channelId: string) => void;
  onClose: () => void;
}

/**
 * Channel Management Component
 * 
 * Allows users to:
 * - Create new channels (public/private)
 * - Manage channel members (add/remove)
 * - Delete channels
 * - Edit channel details
 */
export default function ChannelManager({ 
  token, 
  currentTeam, 
  users, 
  onChannelCreated, 
  onChannelDeleted, 
  onClose 
}: ChannelManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState<string | null>(null);
  const [showMemberManager, setShowMemberManager] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelMembers, setChannelMembers] = useState<{ [channelId: string]: ChannelMember[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Create channel form state
  const [newChannel, setNewChannel] = useState({
    name: '',
    display_name: '',
    purpose: '',
    header: '',
    type: 'O' // 'O' for public, 'P' for private
  });

  // Edit channel form state
  const [editChannel, setEditChannel] = useState({
    id: '',
    name: '',
    display_name: '',
    purpose: '',
    header: '',
    type: 'O'
  });

  useEffect(() => {
    fetchChannels();
  }, [token, currentTeam]);

  const fetchChannels = async () => {
    if (!token || !currentTeam) return;

    try {
      const response = await fetch(`/api/mattermost/channels?teamId=${currentTeam.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const channelsData = await response.json();
        setChannels(channelsData);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  };

  const fetchChannelMembers = async (channelId: string) => {
    try {
      const response = await fetch(`/api/mattermost/channels/${channelId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const members = await response.json();
        setChannelMembers(prev => ({ ...prev, [channelId]: members }));
      }
    } catch (error) {
      console.error('Failed to fetch channel members:', error);
    }
  };

  const createChannel = async () => {
    if (!newChannel.name || !newChannel.display_name || !currentTeam) {
      setError('Channel name and display name are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mattermost/channels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newChannel,
          team_id: currentTeam.id
        })
      });

      if (response.ok) {
        const channel = await response.json();
        setChannels(prev => [...prev, channel]);
        onChannelCreated(channel);
        setNewChannel({ name: '', display_name: '', purpose: '', header: '', type: 'O' });
        setShowCreateForm(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create channel');
      }
    } catch (error) {
      setError('Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  const updateChannel = async () => {
    if (!editChannel.display_name || !editChannel.id) {
      setError('Display name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mattermost/channels', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: editChannel.id,
          display_name: editChannel.display_name,
          purpose: editChannel.purpose,
          header: editChannel.header
        })
      });

      if (response.ok) {
        const updatedChannel = await response.json();
        setChannels(prev => prev.map(c => c.id === editChannel.id ? updatedChannel : c));
        setShowEditForm(null);
        setEditChannel({ id: '', name: '', display_name: '', purpose: '', header: '', type: 'O' });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update channel');
      }
    } catch (error) {
      setError('Failed to update channel');
    } finally {
      setLoading(false);
    }
  };

  const startEditChannel = (channel: Channel) => {
    setEditChannel({
      id: channel.id,
      name: channel.name,
      display_name: channel.display_name,
      purpose: channel.purpose || '',
      header: channel.header || '',
      type: channel.type
    });
    setShowEditForm(channel.id);
  };

  const deleteChannel = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this channel? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/mattermost/channels?channelId=${channelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setChannels(prev => prev.filter(c => c.id !== channelId));
        onChannelDeleted(channelId);
      } else {
        setError('Failed to delete channel');
      }
    } catch (error) {
      setError('Failed to delete channel');
    } finally {
      setLoading(false);
    }
  };

  const addMemberToChannel = async (channelId: string, userId: string) => {
    try {
      const response = await fetch(`/api/mattermost/channels/${channelId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (response.ok) {
        await fetchChannelMembers(channelId);
      } else {
        setError('Failed to add member');
      }
    } catch (error) {
      setError('Failed to add member');
    }
  };

  const removeMemberFromChannel = async (channelId: string, userId: string) => {
    try {
      const response = await fetch(`/api/mattermost/channels/${channelId}/members?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchChannelMembers(channelId);
      } else {
        setError('Failed to remove member');
      }
    } catch (error) {
      setError('Failed to remove member');
    }
  };

  const getChannelMembers = (channelId: string) => {
    const members = channelMembers[channelId] || [];
    return members.map(member => 
      users.find(user => user.id === member.user_id)
    ).filter(Boolean);
  };

  const getNonMembers = (channelId: string) => {
    const members = channelMembers[channelId] || [];
    const memberIds = members.map(m => m.user_id);
    return users.filter(user => !memberIds.includes(user.id));
  };

  const filteredChannels = channels.filter(channel => {
    const query = searchQuery.toLowerCase();
    return (
      channel.name.toLowerCase().includes(query) ||
      channel.display_name.toLowerCase().includes(query) ||
      (channel.purpose && channel.purpose.toLowerCase().includes(query))
    );
  });

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-900">Channel Management</h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Create Channel Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            <span>Create New Channel</span>
          </button>
        </div>

        {/* Create Channel Form */}
        {showCreateForm && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium mb-4">Create New Channel</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Name *
                </label>
                <input
                  type="text"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel(prev => ({ 
                    ...prev, 
                    name: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="channel-name"
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase, no spaces. Use dashes or underscores.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={newChannel.display_name}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Channel Display Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose
                </label>
                <input
                  type="text"
                  value={newChannel.purpose}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="What is this channel for?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Type
                </label>
                <select
                  value={newChannel.type}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="O">Public Channel</option>
                  <option value="P">Private Channel</option>
                </select>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={createChannel}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Channel'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Channel Form */}
        {showEditForm && (
          <div className="mb-6 p-4 border border-orange-200 rounded-lg bg-orange-50">
            <h3 className="text-lg font-medium mb-4">Edit Channel</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={editChannel.name}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Channel name cannot be changed after creation.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={editChannel.display_name}
                  onChange={(e) => setEditChannel(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Channel Display Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose
                </label>
                <textarea
                  value={editChannel.purpose}
                  onChange={(e) => setEditChannel(prev => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="What is this channel for?"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Header
                </label>
                <input
                  type="text"
                  value={editChannel.header}
                  onChange={(e) => setEditChannel(prev => ({ ...prev, header: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Channel header text"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={updateChannel}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Updating...' : 'Update Channel'}
                </button>
                <button
                  onClick={() => {
                    setShowEditForm(null);
                    setEditChannel({ id: '', name: '', display_name: '', purpose: '', header: '', type: 'O' });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Channels List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Existing Channels</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          
          {filteredChannels.length === 0 && searchQuery ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No channels found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredChannels.map(channel => (
            <div key={channel.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Hash className="h-5 w-5 text-gray-500" />
                  <div>
                    <h4 className="font-medium text-gray-900">{channel.display_name}</h4>
                    <p className="text-sm text-gray-500">#{channel.name}</p>
                    {channel.purpose && (
                      <p className="text-sm text-gray-600 mt-1">{channel.purpose}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => startEditChannel(channel)}
                    className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Edit Channel"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowMemberManager(channel.id);
                      fetchChannelMembers(channel.id);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Manage Members"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => deleteChannel(channel.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Channel"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Member Management */}
              {showMemberManager === channel.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-medium text-gray-900">Channel Members</h5>
                    <button
                      onClick={() => setShowMemberManager(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Current Members */}
                  <div className="mb-4">
                    <h6 className="text-sm font-medium text-gray-700 mb-2">Current Members</h6>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {getChannelMembers(channel.id).map(member => (
                        <div key={member?.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <span className="text-sm font-medium">
                              {member?.first_name} {member?.last_name}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">@{member?.username}</span>
                          </div>
                          <button
                            onClick={() => removeMemberFromChannel(channel.id, member?.id || '')}
                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                            title="Remove from channel"
                          >
                            <UserMinus className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Members */}
                  <div>
                    <h6 className="text-sm font-medium text-gray-700 mb-2">Add Members</h6>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {getNonMembers(channel.id).map(user => (
                        <div key={user.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <div>
                            <span className="text-sm font-medium">
                              {user.first_name} {user.last_name}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">@{user.username}</span>
                          </div>
                          <button
                            onClick={() => addMemberToChannel(channel.id, user.id)}
                            className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                            title="Add to channel"
                          >
                            <UserPlus className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
          )}
        </div>
      </div>
    </div>
  );
} 