'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  userReacted: boolean;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  onReact: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
  onAddReaction: () => void;
  className?: string;
}

export default function MessageReactions({
  reactions,
  onReact,
  onRemoveReaction,
  onAddReaction,
  className = ''
}: MessageReactionsProps) {
  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 mt-2 ${className}`}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => reaction.userReacted ? onRemoveReaction(reaction.emoji) : onReact(reaction.emoji)}
          className={`
            inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium transition-colors
            ${reaction.userReacted 
              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }
          `}
          title={`${reaction.users.join(', ')} reacted with ${reaction.emoji}`}
        >
          <span className="text-sm">{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
      
      {/* Add reaction button */}
      <button
        onClick={onAddReaction}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
        title="Add reaction"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}