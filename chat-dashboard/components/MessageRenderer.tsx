'use client';

import React, { useMemo, useCallback } from 'react';
import DOMPurify from 'dompurify';

interface MessageRendererProps {
  content: string;
  className?: string;
}

/**
 * Enhanced message renderer that properly handles HTML content, markdown formatting, 
 * and provides safe rendering with content sanitization.
 */
export default function MessageRenderer({ content, className = '' }: MessageRendererProps) {
  // Enhanced markdown rendering with better error handling
  const renderMarkdown = useCallback((text: string): string => {
    if (!text) return '';
    
    try {
      return text
        // Bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
        // Italic text  
        .replace(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>')
        // Underline text
        .replace(/__(.*?)__/g, '<u class="underline text-gray-800">$1</u>')
        // Strikethrough text
        .replace(/~~(.*?)~~/g, '<del class="line-through text-gray-600">$1</del>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono border">$1</code>')
        // Code blocks
        .replace(/```([^`]+)```/g, '<pre class="bg-gray-50 border border-gray-200 p-3 rounded-md mt-2 mb-2 overflow-x-auto"><code class="text-sm font-mono text-gray-800">$1</code></pre>')
        // Markdown links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">$1</a>')
        // Auto-detect URLs (more conservative pattern)
        .replace(/(?<!["'])(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline transition-colors">$1</a>')
        // User mentions
        .replace(/@([a-zA-Z0-9_.-]+)/g, '<span class="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-blue-200 transition-colors">@$1</span>')
        // Channel mentions
        .replace(/#([a-zA-Z0-9_.-]+)/g, '<span class="bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded font-medium cursor-pointer hover:bg-gray-200 transition-colors">#$1</span>')
        // Blockquotes
        .replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-blue-300 pl-3 py-1 my-2 bg-blue-50 rounded-r-md text-gray-700 italic">$1</blockquote>')
        // Lists
        .replace(/^- (.*)$/gm, '<li class="ml-4 text-gray-800">• $1</li>')
        .replace(/^(\d+)\. (.*)$/gm, '<li class="ml-4 text-gray-800 list-decimal">$2</li>')
        // Line breaks
        .replace(/\n/g, '<br>');
    } catch (error) {
      console.warn('Error processing markdown:', error);
      // Fallback to plain text with basic HTML escaping
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  }, []);

  // Sanitize and process content
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    // First, clean the content and remove any HTML artifacts
    let cleanContent = content
      // Remove HTML attributes that appear as raw text
      .replace(/\s*target="_blank"\s*/g, ' ')
      .replace(/\s*rel="noopener noreferrer"\s*/g, ' ')
      .replace(/\s*class="[^"]*"\s*/g, ' ')
      .replace(/\s*#gid=\d+"/g, '')
      // Clean up malformed HTML
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // Convert markdown to HTML
    const htmlContent = renderMarkdown(cleanContent);
    
    // Sanitize the HTML to prevent XSS and clean up malformed content
    return DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: [
        'strong', 'em', 'u', 'del', 'code', 'pre', 'a', 'span', 
        'div', 'p', 'br', 'li', 'ul', 'ol', 'blockquote'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'class'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|mailto:|tel:|#)/i
    });
  }, [content]);

  // Extract URLs for link previews (now from processed content)
  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    return text.match(urlRegex) || [];
  };

  const urls = useMemo(() => extractUrls(content), [content]);

  // Enhanced link previews with better error handling
  const renderLinkPreviews = () => {
    if (!urls.length) return null;
    
    return urls.map((url, index) => {
      let domain: string;
      try {
        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
        domain = new URL(normalizedUrl).hostname;
      } catch {
        return null;
      }
      
      // Enhanced platform-specific previews
      
      // YouTube preview
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        return (
          <div 
            key={index} 
            className="mt-3 border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all duration-200" 
            onClick={() => window.open(url, '_blank')}
          >
            <div className="flex">
              <div className="w-32 h-24 bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <div className="w-10 h-10 bg-red-600 bg-opacity-80 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                  YouTube Video
                </div>
                <div className="text-xs text-gray-500 font-medium">youtube.com</div>
                <div className="text-xs text-blue-600 mt-1">Click to watch</div>
              </div>
            </div>
          </div>
        );
      }
      
      // GitHub preview
      if (url.includes('github.com')) {
        const repoMatch = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
        const repoName = repoMatch ? repoMatch[1] : 'Repository';
        return (
          <div 
            key={index} 
            className="mt-3 border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all duration-200" 
            onClick={() => window.open(url, '_blank')}
          >
            <div className="flex">
              <div className="w-32 h-24 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div className="flex-1 p-4">
                <div className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                  {repoName}
                </div>
                <div className="text-xs text-gray-500 font-medium">github.com</div>
                <div className="text-xs text-blue-600 mt-1">View repository</div>
              </div>
            </div>
          </div>
        );
      }
      
      // Google Sheets/Docs preview
      if (url.includes('docs.google.com') || url.includes('sheets.google.com')) {
        const isSheet = url.includes('sheets.google.com');
        return (
          <div 
            key={index} 
            className="mt-3 border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all duration-200" 
            onClick={() => window.open(url, '_blank')}
          >
            <div className="flex">
              <div className={`w-32 h-24 flex items-center justify-center ${isSheet ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  {isSheet ? (
                    <path d="M19,3H5C3.9,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.9 20.1,3 19,3M19,19H5V5H19V19Z"/>
                  ) : (
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  )}
                </svg>
              </div>
              <div className="flex-1 p-4">
                <div className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                  Google {isSheet ? 'Sheets' : 'Docs'}
                </div>
                <div className="text-xs text-gray-500 font-medium">docs.google.com</div>
                <div className="text-xs text-blue-600 mt-1">Open document</div>
              </div>
            </div>
          </div>
        );
      }
      
      // Generic link preview with enhanced styling
      return (
        <div 
          key={index} 
          className="mt-3 border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-50 hover:shadow-md hover:border-gray-300 transition-all duration-200" 
          onClick={() => window.open(url, '_blank')}
        >
          <div className="flex">
            <div className="w-12 h-12 m-4 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </div>
            <div className="flex-1 p-4 pl-0 min-w-0">
              <div className="text-sm font-semibold text-gray-900 mb-1 truncate">
                {domain}
              </div>
              <div className="text-xs text-gray-500 mb-2 break-all line-clamp-2 leading-relaxed">
                {url.length > 60 ? `${url.substring(0, 60)}...` : url}
              </div>
              <div className="text-xs text-blue-600 font-medium">Click to open link</div>
            </div>
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  // Error boundary for content rendering
  if (!content) {
    return <div className={`message-content ${className}`}></div>;
  }

  return (
    <div className={`message-content ${className}`}>
      <div 
        dangerouslySetInnerHTML={{ __html: processedContent }}
        className="prose prose-sm max-w-none"
        style={{
          wordBreak: 'break-word',
          lineHeight: '1.6',
          fontSize: '14px'
        }}
      />
      {renderLinkPreviews()}
    </div>
  );
}