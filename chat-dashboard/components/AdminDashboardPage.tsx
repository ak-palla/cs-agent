'use client';

import { useState, useEffect } from 'react';
import { Activity, Workflow, Zap, Users, BarChart3, RefreshCw, Search, Filter, Download, Play, Pause, Settings, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import EnhancedActivityCard from './EnhancedActivityCard';
import { preloadUserAndChannelData } from '@/lib/activity-helpers';
// Removed direct activity processor import - using API routes instead

interface ActivityStats {
  total: number;
  by_platform: Record<string, number>;
  by_event_type: Record<string, number>;
  timeframe: string;
}

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

interface ExecutionStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'workflows' | 'triggers' | 'logs'>('overview');
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [executionStats, setExecutionStats] = useState<ExecutionStats>({ total: 0, pending: 0, running: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    loadDashboardData();
    // Set up real-time updates
    const interval = setInterval(loadDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeframe]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + R to refresh (prevent default browser refresh)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && activeTab === 'activities') {
        e.preventDefault();
        loadDashboardData();
      }
      
      // Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
      
      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && activeTab === 'activities') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search activities"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTab, searchQuery]);

  const loadDashboardData = async () => {
    try {
      console.log('🔄 Loading admin dashboard data...', { timeframe, selectedPlatform });
      setLoading(true);
      
      // Preload user and channel data for better performance
      console.log('🔄 Preloading user and channel data...');
      preloadUserAndChannelData().catch(error => {
        console.warn('⚠️ Failed to preload user/channel data:', error);
      });
      
      // Load activity statistics
      console.log('📊 Fetching activity statistics...');
      const statsResponse = await fetch(`/api/admin/activities/stats?timeframe=${timeframe}`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setActivityStats(stats);
        console.log('✅ Activity stats loaded:', stats);
      } else {
        console.error('❌ Error fetching activity stats:', await statsResponse.text());
      }

      // Load recent activities
      console.log('📋 Fetching recent activities...');
      const activitiesResponse = await fetch(`/api/admin/activities?platform=${selectedPlatform}&limit=50&offset=0`);
      if (activitiesResponse.ok) {
        const activities = await activitiesResponse.json();
        setRecentActivities(activities);
        console.log('✅ Recent activities loaded:', { count: activities.length });
      } else {
        console.error('❌ Error fetching activities:', await activitiesResponse.text());
      }

      // Get real execution stats from Supabase
      console.log('⚙️ Fetching execution statistics...');
      try {
        const execStatsResponse = await fetch('/api/admin/executions/stats');
        if (execStatsResponse.ok) {
          const execStats = await execStatsResponse.json();
          setExecutionStats(execStats);
          console.log('✅ Execution stats loaded:', execStats);
        } else {
          console.error('❌ Error fetching execution stats:', await execStatsResponse.text());
          setExecutionStats({
            total: 0,
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0
          });
        }
      } catch (error) {
        console.error('❌ Error loading execution stats:', error);
        setExecutionStats({
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0
        });
      }

      console.log('✅ Dashboard data loading completed successfully');
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const getPlatformIcon = (platform: string) => {
    const icons = {
      mattermost: '💬',
      trello: '📋',
      flock: '🐦'
    };
    return icons[platform as keyof typeof icons] || '❓';
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      mattermost: 'bg-blue-100 text-blue-800',
      trello: 'bg-green-100 text-green-800',
      flock: 'bg-purple-100 text-purple-800'
    };
    return colors[platform as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredActivities = recentActivities.filter(activity => {
    if (selectedPlatform !== 'all' && activity.platform !== selectedPlatform) {
      return false;
    }
    
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    
    // Search in multiple fields for better results
    const searchableContent = [
      activity.event_type,
      activity.user_id,
      activity.channel_id,
      activity.data?.message || '',
      activity.data?.text || '',
      activity.data?.content || '',
      activity.platform,
      // Include any other relevant data fields
      Object.values(activity.data || {}).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchableContent.includes(query);
  });

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black">CS Agent Admin Dashboard</h1>
              <p className="text-sm text-black">Monitor activities and manage AI workflows</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
        <div className="flex">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'activities', label: 'Activity Monitor', icon: Activity },
            { id: 'workflows', label: 'Workflows', icon: Workflow },
            { id: 'triggers', label: 'Triggers', icon: Zap },
            { id: 'logs', label: 'Execution Logs', icon: Clock }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-black hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="p-6 h-full overflow-y-auto">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-black">Total Activities ({timeframe})</p>
                    <p className="text-3xl font-bold text-black">{activityStats?.total || 0}</p>
                  </div>
                  <Activity className="w-12 h-12 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-black">Active Triggers</p>
                    <p className="text-3xl font-bold text-green-600">0</p>
                    <p className="text-xs text-black">No triggers configured</p>
                  </div>
                  <Zap className="w-12 h-12 text-green-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-black">Running Workflows</p>
                    <p className="text-3xl font-bold text-yellow-600">{executionStats.running}</p>
                  </div>
                  <Play className="w-12 h-12 text-yellow-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-black">Success Rate</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {executionStats.total > 0 
                        ? `${Math.round((executionStats.completed / executionStats.total) * 100)}%`
                        : '0%'
                      }
                    </p>
                    <p className="text-xs text-black">
                      {executionStats.total === 0 ? 'No executions yet' : `${executionStats.completed}/${executionStats.total} completed`}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-black mb-4">Activity by Platform</h3>
                <div className="space-y-4">
                  {activityStats?.by_platform && Object.entries(activityStats.by_platform).map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getPlatformIcon(platform)}</span>
                        <span className="capitalize font-medium text-black">{platform}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{count}</span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(count / (activityStats?.total || 1)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-black mb-4">Workflow Status</h3>
                <div className="space-y-4">
                  {[
                    { status: 'Completed', count: executionStats.completed, color: 'text-green-600', icon: CheckCircle },
                    { status: 'Failed', count: executionStats.failed, color: 'text-red-600', icon: AlertTriangle },
                    { status: 'Running', count: executionStats.running, color: 'text-blue-600', icon: Play },
                    { status: 'Pending', count: executionStats.pending, color: 'text-yellow-600', icon: Clock }
                  ].map(({ status, count, color, icon: Icon }) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-5 h-5 ${color}`} />
                        <span className="font-medium text-black">{status}</span>
                      </div>
                      <span className={`font-semibold ${color}`}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="p-6 h-full flex flex-col">
            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search activities, users, channels, messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              >
                <option value="all">All Platforms</option>
                <option value="mattermost">Mattermost</option>
                <option value="trello">Trello</option>
                <option value="flock">Flock</option>
              </select>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              
              {/* Refresh Button */}
              <button
                onClick={loadDashboardData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                title="Refresh activities"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Results Summary */}
            {!loading && (
              <div className="flex items-center justify-between text-sm text-gray-600 mb-4 bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="font-medium text-gray-900">
                      {filteredActivities.length}
                    </span>
                    <span className="text-gray-600">
                      {filteredActivities.length === 1 ? ' activity' : ' activities'}
                    </span>
                    {recentActivities.length !== filteredActivities.length && (
                      <span className="text-gray-500">
                        {' '}of {recentActivities.length} total
                      </span>
                    )}
                  </div>
                  {searchQuery && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Filtered by: "{searchQuery}"
                    </div>
                  )}
                  {selectedPlatform !== 'all' && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Platform: {selectedPlatform}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Updated {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            )}

            {/* Activity List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading activities...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredActivities.map((activity) => (
                  <EnhancedActivityCard
                    key={activity.id}
                    activity={activity}
                    onViewMessage={(channelId, messageId) => {
                      // Navigate to message in Mattermost chat
                      window.open(`/mattermost?channel=${channelId}&message=${messageId}`, '_blank');
                    }}
                    onViewChannel={(channelId) => {
                      // Navigate to channel in Mattermost chat
                      window.open(`/mattermost?channel=${channelId}`, '_blank');
                    }}
                  />
                ))}
                
                {/* Empty State */}
                {filteredActivities.length === 0 && (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchQuery || selectedPlatform !== 'all' 
                        ? 'Try adjusting your filters or search terms.'
                        : 'Activities will appear here as they are processed.'}
                    </p>
                    
                    {/* Helpful Tips */}
                    <div className="bg-blue-50 rounded-lg p-4 text-left max-w-md mx-auto">
                      <h4 className="font-medium text-blue-900 mb-2">💡 Tips:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Search for usernames, channels, or message content</li>
                        <li>• Use <kbd className="bg-blue-200 px-1 rounded">Ctrl+F</kbd> to quickly focus search</li>
                        <li>• Press <kbd className="bg-blue-200 px-1 rounded">Esc</kbd> to clear search</li>
                        <li>• Click channel names to navigate directly</li>
                        <li>• Use the copy button to share activity details</li>
                      </ul>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Other tabs would be implemented similarly */}
        {activeTab !== 'overview' && activeTab !== 'activities' && (
          <div className="p-6 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-lg font-semibold text-black mb-2">Coming Soon</h3>
              <p className="text-black">This section is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}