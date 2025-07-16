import NotificationFeed from '@/components/NotificationFeed';

export default function Home() {
  return (
    <div className="h-full bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat Dashboard</h1>
        <p className="text-sm text-gray-600">All your notifications in one place</p>
      </div>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h2>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <span className="text-lg font-bold text-blue-600">3</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Mattermost</p>
                  <p className="text-sm text-gray-600">New messages</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg bg-green-50 p-4">
              <div className="flex items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <span className="text-lg font-bold text-green-600">2</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Trello</p>
                  <p className="text-sm text-gray-600">Card updates</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg bg-purple-50 p-4">
              <div className="flex items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <span className="text-lg font-bold text-purple-600">1</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Flock</p>
                  <p className="text-sm text-gray-600">New notifications</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <NotificationFeed />
      </div>
    </div>
  );
}