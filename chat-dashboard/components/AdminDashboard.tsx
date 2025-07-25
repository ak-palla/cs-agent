'use client';

import { useState, useEffect } from 'react';
import { X, Activity, Workflow, Zap, Users, BarChart3, RefreshCw, Search, Filter, Download, Play, Pause, Settings, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { activityProcessor } from '@/lib/activity-processor';
import EnhancedActivityCard from '@/components/EnhancedActivityCard';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

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

interface WorkflowTrigger {
  id: string;
  name: string;
  description?: string;
  platform: 'mattermost' | 'trello' | 'flock';
  event_type: string;
  conditions: any;
  ai_agent_config: any;
  enabled: boolean;
  created_at: string;
}

interface ExecutionStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export default function AdminDashboard({ isOpen, onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'workflows' | 'triggers' | 'logs'>('overview');
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [executionStats, setExecutionStats] = useState<ExecutionStats>({ total: 0, pending: 0, running: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    if (isOpen) {
      loadDashboardData();
      // Set up real-time updates
      const interval = setInterval(loadDashboardData, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, timeframe]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load activity statistics
      const stats = await activityProcessor.getActivityStats(timeframe);
      setActivityStats(stats);

      // Load recent activities
      const activities = await activityProcessor.getRecentActivities(
        selectedPlatform === 'all' ? undefined : selectedPlatform as any,
        50
      );
      setRecentActivities(activities);

      // Mock execution stats (would be real data from Supabase)
      setExecutionStats({
        total: 156,
        pending: 3,
        running: 2,
        completed: 142,
        failed: 9
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
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

  const filteredActivities = recentActivities.filter(activity => {
    const matchesSearch = !searchQuery || 
      activity.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.user_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(activity.data).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlatform = selectedPlatform === 'all' || activity.platform === selectedPlatform;
    
    return matchesSearch && matchesPlatform;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CS Agent Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Monitor activities and manage AI workflows</p>
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
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
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

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'overview' && (
            <div className="p-6 h-full overflow-y-auto">
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
                          <span className="text-2xl">{getPlatformIcon(platform)}</span>
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
              {/* Filters */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search activities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Platforms</option>
                  <option value="mattermost">Mattermost</option>
                  <option value="trello">Trello</option>
                  <option value="flock">Flock</option>
                </select>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              {/* Activity List */}
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-3">
                  {filteredActivities.map((activity) => (
                    <EnhancedActivityCard
                      key={activity.id}
                      activity={activity}
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
                </div>
              </div>
            </div>
          )}

          {/* Other tabs would be implemented similarly */}
          {activeTab !== 'overview' && activeTab !== 'activities' && (
            <div className="p-6 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
                <p className="text-gray-600">This section is under development.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}