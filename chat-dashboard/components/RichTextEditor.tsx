'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, Code, Link, List, Quote, Smile, AtSign } from 'lucide-react';
import MentionsAutocomplete from './MentionsAutocomplete';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  onTyping?: () => void;
  disabled?: boolean;
  users?: Array<{ id: string; username: string; first_name: string; last_name: string; }>;
}

export default function RichTextEditor({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message...",
  onTyping,
  disabled = false,
  users = []
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [mentionsVisible, setMentionsVisible] = useState(false);
  const [mentionsQuery, setMentionsQuery] = useState('');
  const [mentionsPosition, setMentionsPosition] = useState({ x: 0, y: 0 });
  const [mentionsStart, setMentionsStart] = useState(0);

  // Insert formatting around selected text or at cursor
  const insertFormatting = useCallback((prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);
    
    const newValue = beforeText + prefix + selectedText + suffix + afterText;
    onChange(newValue);
    
    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  // Format handlers
  const handleBold = () => insertFormatting('**', '**');
  const handleItalic = () => insertFormatting('*', '*');
  const handleUnderline = () => insertFormatting('__', '__');
  const handleCode = () => insertFormatting('`', '`');
  const handleCodeBlock = () => insertFormatting('```\n', '\n```');
  const handleLink = () => insertFormatting('[', '](url)');
  const handleList = () => insertFormatting('- ', '');
  const handleQuote = () => insertFormatting('> ', '');
  const handleMention = () => insertFormatting('@', '');

  // Convert markdown to HTML for preview
  const renderPreview = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n/g, '<br>');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleMentionSelect = useCallback((user: { id: string; username: string; }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeMention = value.substring(0, mentionsStart);
    const afterMention = value.substring(textarea.selectionStart);
    const newValue = beforeMention + `@${user.username} ` + afterMention;
    
    onChange(newValue);
    setMentionsVisible(false);
    
    // Focus textarea and position cursor
    setTimeout(() => {
      textarea.focus();
      const cursorPos = beforeMention.length + user.username.length + 2; // +2 for @space
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }, [value, mentionsStart, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    onTyping?.();
    
    // Check for @mentions
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.]*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      const mentionStart = cursorPos - mentionMatch[0].length;
      
      // Get cursor position for autocomplete
      const textarea = e.target;
      const rect = textarea.getBoundingClientRect();
      const textMetrics = getTextMetrics(textarea, mentionStart);
      
      setMentionsQuery(query);
      setMentionsStart(mentionStart);
      setMentionsPosition({
        x: rect.left + textMetrics.x,
        y: rect.top + textMetrics.y
      });
      setMentionsVisible(true);
    } else {
      setMentionsVisible(false);
    }
  };

  // Helper function to get text cursor position
  const getTextMetrics = (textarea: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.height = 'auto';
    div.style.width = textarea.clientWidth + 'px';
    div.style.fontSize = style.fontSize;
    div.style.fontFamily = style.fontFamily;
    div.style.lineHeight = style.lineHeight;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    
    const text = textarea.value.substring(0, position);
    div.textContent = text;
    
    const span = document.createElement('span');
    span.textContent = '|';
    div.appendChild(span);
    
    document.body.appendChild(div);
    const rect = span.getBoundingClientRect();
    const containerRect = div.getBoundingClientRect();
    document.body.removeChild(div);
    
    return {
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top
    };
  };

  return (
    <div className="border border-gray-300 rounded-lg bg-white relative">
      {/* Mentions Autocomplete */}
      <MentionsAutocomplete
        users={users}
        onSelect={handleMentionSelect}
        query={mentionsQuery}
        visible={mentionsVisible}
        position={mentionsPosition}
      />
      
      {/* Formatting Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleBold}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Bold (Ctrl+B)"
            disabled={disabled}
          >
            <Bold className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={handleItalic}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Italic (Ctrl+I)"
            disabled={disabled}
          >
            <Italic className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={handleUnderline}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Underline (Ctrl+U)"
            disabled={disabled}
          >
            <Underline className="h-4 w-4 text-gray-600" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button
            type="button"
            onClick={handleCode}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Inline code"
            disabled={disabled}
          >
            <Code className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={handleCodeBlock}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Code block"
            disabled={disabled}
          >
            <Code className="h-4 w-4 text-gray-600" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button
            type="button"
            onClick={handleLink}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Link"
            disabled={disabled}
          >
            <Link className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={handleList}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="List"
            disabled={disabled}
          >
            <List className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={handleQuote}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Quote"
            disabled={disabled}
          >
            <Quote className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={handleMention}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Mention (@)"
            disabled={disabled}
          >
            <AtSign className="h-4 w-4 text-gray-600" />
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors"
            disabled={disabled}
          >
            {isPreviewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3">
        {isPreviewMode ? (
          <div
            className="min-h-[60px] max-h-40 p-2 bg-gray-50 rounded text-sm"
            dangerouslySetInnerHTML={{ __html: renderPreview(value) || '<em>Nothing to preview</em>' }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="w-full min-h-[60px] max-h-40 resize-none border-none outline-none bg-transparent text-sm"
            disabled={disabled}
            style={{ lineHeight: '1.5' }}
          />
        )}
        
        {/* Character/Word Count */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>
            {value.length > 0 && (
              <>
                {value.length} characters • {value.split(/\s+/).filter(Boolean).length} words
              </>
            )}
          </span>
          <span className="text-gray-400">
            Shift+Enter for new line • Enter to send
          </span>
        </div>
      </div>
    </div>
  );
}