'use client';

import React from 'react';

interface MessageRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders Mattermost message content with markdown formatting and link previews.
 * 
 * Args:
 *   content (string): Raw message content
 *   className (string): Additional CSS classes
 * 
 * Returns:
 *   JSX.Element: Rendered message with formatting and previews
 */
export default function MessageRenderer({ content, className = '' }: MessageRendererProps) {
  // Extract URLs from content for link previews
  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Enhanced markdown rendering with support for Mattermost formatting
  const renderMarkdown = (text: string) => {
    if (!text) return '';
    
    return text
      // Bold text with better styling
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      // Italic text  
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>')
      // Underline text
      .replace(/__(.*?)__/g, '<u class="underline text-gray-800">$1</u>')
      // Strikethrough text
      .replace(/~~(.*?)~~/g, '<del class="line-through text-gray-600">$1</del>')
      // Inline code with native-like styling
      .replace(/`([^`]+)`/g, '<code class="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-xs font-mono border border-red-200">$1</code>')
      // Code blocks with enhanced styling
      .replace(/```([^`]+)```/g, '<pre class="bg-gray-50 border border-gray-200 p-3 rounded-md mt-2 mb-2 overflow-x-auto"><code class="text-sm font-mono text-gray-800 leading-relaxed">$1</code></pre>')
      // Links with better hover effects
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">$1</a>')
      // Auto-detect URLs with native styling
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline transition-colors">$1</a>')
      // Mentions with native-style appearance
      .replace(/@([a-zA-Z0-9_.-]+)/g, '<span class="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-blue-200 transition-colors">@$1</span>')
      // Channel mentions with better styling
      .replace(/#([a-zA-Z0-9_.-]+)/g, '<span class="bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-gray-200 transition-colors">#$1</span>')
      // Enhanced blockquotes
      .replace(/^> (.*)$/gm, '<div class="border-l-4 border-blue-300 pl-3 py-1 my-2 bg-blue-50 rounded-r-md"><p class="text-gray-700 italic text-sm">$1</p></div>')
      // Better list styling
      .replace(/^- (.*)$/gm, '<li class="ml-4 text-gray-800 leading-relaxed">• $1</li>')
      .replace(/^(\d+)\. (.*)$/gm, '<li class="ml-4 text-gray-800 leading-relaxed list-decimal">$2</li>')
      // Enhanced emoji support
      .replace(/:([a-zA-Z0-9_+-]+):/g, '<span class="text-base">$1</span>')
      // Line breaks with proper spacing
      .replace(/\n/g, '<br class="leading-relaxed">');
  };

  const urls = extractUrls(content);
  
  // Create a simple URL metadata fetcher function (client-side)
  const getUrlPreview = async (url: string) => {
    // For security and CORS reasons, we'll create simple previews based on URL patterns
    // In a production app, you'd want to use a backend service to fetch metadata
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      // Extract video ID for better preview
      const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
      return {
        type: 'youtube',
        title: 'YouTube Video',
        description: 'Click to watch on YouTube',
        domain: 'youtube.com',
        videoId
      };
    }
    
    // For other URLs, create a generic preview
    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const domain = new URL(normalizedUrl).hostname;
      return {
        type: 'link',
        title: domain,
        description: 'Click to visit link',
        domain
      };
    } catch {
      return null;
    }
  };

  // Render link previews based on URL patterns
  const renderLinkPreviews = () => {
    return urls.map((url, index) => {
      let domain: string;
      try {
        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
        domain = new URL(normalizedUrl).hostname;
      } catch {
        // Skip invalid URLs
        return null;
      }
      
      // YouTube preview
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return (
          <div key={index} className="mt-3 border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-50" onClick={() => window.open(url, '_blank')}>
            <div className="flex">
              <div className="w-32 h-24 bg-gray-200 flex items-center justify-center">
                <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 p-3">
                <div className="text-sm font-medium text-gray-900 line-clamp-2">
                  YouTube Video
                </div>
                <div className="text-xs text-gray-500 mt-1">youtube.com</div>
              </div>
            </div>
          </div>
        );
      }
      
      // Generic link preview for other URLs
      return (
        <div key={index} className="mt-3 border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-50" onClick={() => window.open(url, '_blank')}>
          <div className="p-3">
            <div className="text-sm font-medium text-gray-900 mb-1">
              Link Preview
            </div>
            <div className="text-xs text-gray-500 mb-2 break-all">
              {url}
            </div>
            <div className="text-xs text-gray-500">{domain}</div>
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <div className={`message-content ${className}`}>
      <div 
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        style={{
          wordBreak: 'break-word',
          lineHeight: '1.5'
        }}
      />
      {renderLinkPreviews()}
    </div>
  );
}