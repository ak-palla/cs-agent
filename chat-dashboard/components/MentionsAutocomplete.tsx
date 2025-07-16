'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User } from 'lucide-react';

interface MentionsAutocompleteProps {
  users: Array<{ id: string; username: string; first_name: string; last_name: string; }>;
  onSelect: (user: { id: string; username: string; }) => void;
  query: string;
  visible: boolean;
  position: { x: number; y: number; };
}

export default function MentionsAutocomplete({
  users,
  onSelect,
  query,
  visible,
  position
}: MentionsAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(query.toLowerCase()) ||
    user.first_name.toLowerCase().includes(query.toLowerCase()) ||
    user.last_name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10); // Limit to 10 results

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || filteredUsers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          // Parent should handle closing
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, filteredUsers, selectedIndex, onSelect]);

  if (!visible || filteredUsers.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
      style={{
        left: position.x,
        top: position.y - 200, // Position above the cursor
        minWidth: '200px',
        maxWidth: '300px'
      }}
    >
      <div className="p-2 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">
          People
        </h3>
      </div>
      
      {filteredUsers.map((user, index) => {
        const displayName = user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`
          : user.username;
          
        return (
          <div
            key={user.id}
            onClick={() => onSelect(user)}
            className={`
              flex items-center px-3 py-2 cursor-pointer transition-colors
              ${index === selectedIndex 
                ? 'bg-blue-50 text-blue-900' 
                : 'hover:bg-gray-50'
              }
            `}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm mr-3">
              {displayName[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {displayName}
              </div>
              <div className="text-xs text-gray-500">
                @{user.username}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}