'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, LayoutGrid, Users } from 'lucide-react';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Mattermost', href: '/mattermost', icon: MessageSquare },
  { name: 'Trello', href: '/trello', icon: LayoutGrid },
  { name: 'Flock', href: '/flock', icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-16 flex-col items-center space-y-4 bg-gray-900 py-4">
      {navigation.map((item) => {
        const isActive = pathname === item.href || 
          (item.href !== '/' && pathname.startsWith(item.href));
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <item.icon className="h-6 w-6" />
            <span className="absolute left-full ml-4 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-sm text-white group-hover:block">
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}