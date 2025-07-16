'use client';

import React from 'react';

interface MessageRendererProps {
  content: string;
  className?: string;
}

export default function MessageRenderer({ content, className = '' }: MessageRendererProps) {
  // Enhanced markdown rendering with support for Mattermost formatting
  const renderMarkdown = (text: string) => {
    if (!text) return '';
    
    return text
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text  
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Underline text
      .replace(/__(.*?)__/g, '<u>$1</u>')
      // Strikethrough text
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Code blocks
      .replace(/```([^`]+)```/g, '<pre class="bg-gray-100 p-3 rounded mt-2 mb-2 overflow-x-auto"><code class="text-sm font-mono">$1</code></pre>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
      // Auto-detect URLs
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
      // Mentions
      .replace(/@([a-zA-Z0-9_.-]+)/g, '<span class="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">@$1</span>')
      // Channel mentions
      .replace(/#([a-zA-Z0-9_.-]+)/g, '<span class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded">#$1</span>')
      // Blockquotes
      .replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 my-2 text-gray-700 italic">$1</blockquote>')
      // Lists
      .replace(/^- (.*)$/gm, '<li class="ml-4">$1</li>')
      .replace(/^(\d+)\. (.*)$/gm, '<li class="ml-4 list-decimal">$2</li>')
      // Emojis (basic support)
      .replace(/:([a-zA-Z0-9_+-]+):/g, '<span class="text-lg">$1</span>')
      // Line breaks
      .replace(/\n/g, '<br>');
  };

  return (
    <div 
      className={`message-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      style={{
        wordBreak: 'break-word',
        lineHeight: '1.5'
      }}
    />
  );
}