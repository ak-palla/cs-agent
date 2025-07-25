'use client';

import { useState, useEffect } from 'react';
import { Activity, Workflow, Zap, Users, BarChart3, RefreshCw, Search, Filter, Download, Play, Pause, Settings, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import EnhancedActivityCard from '@/components/EnhancedActivityCard';
import { getAuthenticationStatus, preloadUserAndChannelData, getPlatformInfo } from '@/lib/activity-helpers';

interface ActivityStats {
  total: number;
  by_platform: Record<string, number>;
}

interface ActivityData {
  id: string;
  platform: string;
  event_type: string;
  user_id?: string;
  channel_id?: string;
  timestamp: string;
  data: any;
}

interface ExecutionStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export default function AdminDashboardPage({ onClose }: { onClose?: () => void } = {}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'workflows' | 'triggers' | 'logs'>('overview');
  const [loading, setLoading] = useState(false);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<ActivityData[]>([]);
  const [executionStats, setExecutionStats] = useState<ExecutionStats>({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [authStatus, setAuthStatus] = useState<{ available: boolean; message: string }>({ available: false, message: '' });

  useEffect(() => {
    // Check authentication status
    const status = getAuthenticationStatus();
    setAuthStatus(status);
    
    // Preload user/channel data if authenticated
    if (status.available) {
      preloadUserAndChannelData();
    }
    
    loadDashboardData();
    // Set up real-time updates
    const interval = setInterval(loadDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeframe]);


  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load activity statistics via API
      const statsResponse = await fetch(`/api/admin/activities/stats?timeframe=${timeframe}`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setActivityStats(stats);
      }

      // Load recent activities via API
      const activitiesResponse = await fetch(`/api/admin/activities?platform=${selectedPlatform}&limit=50&offset=0`);
      if (activitiesResponse.ok) {
        const activities = await activitiesResponse.json();
        setRecentActivities(activities);
      }

      // Load execution stats via API
      const execStatsResponse = await fetch('/api/admin/executions/stats');
      if (execStatsResponse.ok) {
        const execStats = await execStatsResponse.json();
        setExecutionStats(execStats);
      } else {
        setExecutionStats({
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0
        });
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const filteredActivities = recentActivities.filter(activity => {
    const matchesSearch = !searchQuery || 
      activity.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.user_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(activity.data).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlatform = selectedPlatform === 'all' || activity.platform === selectedPlatform;
    
    return matchesSearch && matchesPlatform;
  });


  return (
    <div className="h-full bg-gray-50">
      <div className="bg-white h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CS Agent Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Monitor activities and manage AI workflows</p>
              {!authStatus.available && (
                <div className="mt-1 flex items-center text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  <span>Limited view: User/channel names will show as IDs without Mattermost auth</span>
                </div>
              )}
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
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <span className="w-6 h-6">✕</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-6">
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
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="p-6 overflow-y-auto">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Activities ({timeframe})</p>
                    <p className="text-3xl font-bold text-gray-900">{activityStats?.total || 0}</p>
                  </div>
                  <Activity className="w-12 h-12 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Active Triggers</p>
                    <p className="text-3xl font-bold text-green-600">12</p>
                  </div>
                  <Zap className="w-12 h-12 text-green-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Running Workflows</p>
                    <p className="text-3xl font-bold text-yellow-600">{executionStats.running}</p>
                  </div>
                  <Play className="w-12 h-12 text-yellow-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Success Rate</p>
                    <p className="text-3xl font-bold text-purple-600">94%</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity by Platform</h3>
                <div className="space-y-4">
                  {activityStats?.by_platform && Object.entries(activityStats.by_platform).map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getPlatformInfo(platform).icon}</span>
                        <span className="capitalize font-medium">{platform}</span>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Status</h3>
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
                        <span className="font-medium">{status}</span>
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
            {/* Search and Filters - matching the image layout */}
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search activities, users, channels, messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option value="all">All Platforms</option>
                <option value="mattermost">Mattermost</option>
                <option value="trello">Trello</option>
                <option value="flock">Flock</option>
              </select>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as '24h' | '7d' | '30d')}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button
                onClick={loadDashboardData}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Activity Count - matching the image */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-500">
                {filteredActivities.length} activities
              </div>
              <div className="text-xs text-gray-400">
                Updated {new Date().toLocaleTimeString()}
              </div>
            </div>

            {/* Activity List - matching the simple card design from image */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="inline-flex items-center px-4 py-2 text-blue-600">
                    <RefreshCw className="animate-spin -ml-1 mr-3 h-5 w-5" />
                    <span>Loading activities...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity) => (
                    <EnhancedActivityCard
                      key={activity.id}
                      activity={{
                        ...activity,
                        processed: false // Add processed field if missing
                      }}
                      onViewMessage={(channelId, messageId) => {
                        // Optional: Add functionality to view message in channel
                        console.log('View message:', channelId, messageId);
                      }}
                      onViewChannel={(channelId) => {
                        // Optional: Add functionality to view channel
                        console.log('View channel:', channelId);
                      }}
                    />
                  ))}
                  {filteredActivities.length === 0 && !loading && (
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No activities found</h3>
                      <p className="text-gray-600">
                        {searchQuery || selectedPlatform !== 'all' 
                          ? 'Try adjusting your search criteria or filters'
                          : 'Once your integrations start generating activities, they\'ll appear here'
                        }
                      </p>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
              <p className="text-gray-600">The {activeTab} section is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}