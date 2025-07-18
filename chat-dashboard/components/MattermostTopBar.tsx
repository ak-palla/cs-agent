'use client';

import { Search, Bell, HelpCircle, Settings, ChevronDown } from 'lucide-react';

interface MattermostTopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

/**
 * Top navigation bar for Mattermost interface matching the screenshot design.
 * 
 * Args:
 *   searchQuery (string): Current search query value
 *   onSearchChange (function): Callback when search query changes
 * 
 * Returns:
 *   JSX.Element: Top navigation bar component
 */
export default function MattermostTopBar({ searchQuery, onSearchChange }: MattermostTopBarProps) {
  return (
    <div className="h-14 bg-[#1e1e2e] text-white border-b border-gray-600 flex items-center px-4 flex-shrink-0">
      {/* Left: Team Selector */}
      <div className="flex items-center space-x-2 mr-6">
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            {/* Mattermost Icon */}
            <div className="w-6 h-6 mr-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span className="text-white font-medium">Mattermost</span>
            <span className="ml-2 text-xs bg-blue-500 px-2 py-1 rounded text-white">FREE EDITION</span>
          </div>
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded focus:bg-gray-600 focus:outline-none placeholder-gray-400 text-sm"
          />
        </div>
      </div>

      {/* Right: User Actions */}
      <div className="flex items-center space-x-1">
        {/* Help */}
        <button className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white">
          <HelpCircle className="h-5 w-5" />
        </button>
        
        {/* Notifications */}
        <button className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white">
          <Bell className="h-5 w-5" />
        </button>
        
        {/* Settings */}
        <button className="p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white">
          <Settings className="h-5 w-5" />
        </button>
        
        {/* User Avatar */}
        <div className="ml-2 flex items-center cursor-pointer hover:bg-gray-700 rounded px-2 py-1">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold text-sm mr-2">
            N
          </div>
          <span className="text-sm text-gray-300">NJ Designpark</span>
          <ChevronDown className="h-4 w-4 ml-1 text-gray-400" />
        </div>
      </div>
    </div>
  );
} 