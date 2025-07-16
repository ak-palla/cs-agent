'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Smile, Edit, Trash2, MoreHorizontal, Reply, Pin, Copy, Flag } from 'lucide-react';

interface MessageActionsProps {
  messageId: string;
  canEdit?: boolean;
  canDelete?: boolean;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onPin?: (messageId: string) => void;
  onCopy?: (messageId: string) => void;
  onFlag?: (messageId: string) => void;
  className?: string;
  threadCount?: number;
}

const commonEmojis = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉', '🔥'];

export default function MessageActions({
  messageId,
  canEdit = false,
  canDelete = false,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onCopy,
  onFlag,
  className = '',
  threadCount = 0
}: MessageActionsProps) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReaction = (emoji: string) => {
    onReact?.(messageId, emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className={`message-actions ${className}`}>
      <div
        ref={actionsRef}
        className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-1 space-x-1"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Thread Reply */}
        {onReply && (
          <button
            onClick={() => onReply(messageId)}
            className="flex items-center space-x-1 px-2 py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Reply in thread"
          >
            <MessageSquare className="h-4 w-4" />
            {threadCount > 0 && (
              <span className="text-xs font-medium">{threadCount}</span>
            )}
          </button>
        )}

        {/* React with Emoji */}
        <div className="relative" ref={emojiRef}>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 text-gray-600 hover:text-yellow-500 hover:bg-yellow-50 rounded transition-colors"
            title="Add reaction"
          >
            <Smile className="h-4 w-4" />
          </button>
          
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
              <div className="grid grid-cols-5 gap-1">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="w-8 h-8 text-lg hover:bg-gray-100 rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* More Actions */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            title="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          
          {showMoreMenu && (
            <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
              {onCopy && (
                <button
                  onClick={() => {
                    onCopy(messageId);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy text</span>
                </button>
              )}
              
              {onPin && (
                <button
                  onClick={() => {
                    onPin(messageId);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Pin className="h-4 w-4" />
                  <span>Pin message</span>
                </button>
              )}
              
              {canEdit && onEdit && (
                <button
                  onClick={() => {
                    onEdit(messageId);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Edit className="h-4 w-4" />
                  <span>Edit message</span>
                </button>
              )}
              
              <div className="border-t border-gray-200 my-1" />
              
              {onFlag && (
                <button
                  onClick={() => {
                    onFlag(messageId);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Flag className="h-4 w-4" />
                  <span>Flag message</span>
                </button>
              )}
              
              {canDelete && onDelete && (
                <button
                  onClick={() => {
                    onDelete(messageId);
                    setShowMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete message</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}