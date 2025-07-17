'use client';

import React, { useState } from 'react';
import { Calendar, User, MessageCircle, Paperclip, Tag, Clock, CheckCircle } from 'lucide-react';
import { TrelloCard as TrelloCardType } from '@/lib/trello-client';

interface TrelloCardProps {
  card: TrelloCardType;
  onDragStart: (e: React.DragEvent, card: TrelloCardType) => void;
  onClick?: (card: TrelloCardType) => void;
  className?: string;
  searchQuery?: string;
}

const TrelloCard: React.FC<TrelloCardProps> = ({ card, onDragStart, onClick, className = '', searchQuery = '' }) => {
  const [isHovered, setIsHovered] = useState(false);

  const isOverdue = card.due && new Date(card.due) < new Date() && !card.dueComplete;
  const isDueSoon = card.due && new Date(card.due) > new Date() && 
    new Date(card.due) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

  // Function to highlight search terms
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    let highlightedText = text;
    
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>');
    });
    
    return highlightedText;
  };

  const getCardStyle = () => {
    // Check if card has a label with a color for background
    const primaryLabel = card.labels.find(label => label.color && label.color !== 'none');
    
    if (primaryLabel) {
      const labelColors = {
        'green': 'bg-gradient-to-r from-green-400 to-green-500',
        'yellow': 'bg-gradient-to-r from-yellow-400 to-yellow-500',
        'orange': 'bg-gradient-to-r from-orange-400 to-orange-500',
        'red': 'bg-gradient-to-r from-red-400 to-red-500',
        'purple': 'bg-gradient-to-r from-purple-400 to-purple-500',
        'blue': 'bg-gradient-to-r from-blue-400 to-blue-500',
        'sky': 'bg-gradient-to-r from-sky-400 to-sky-500',
        'lime': 'bg-gradient-to-r from-lime-400 to-lime-500',
        'pink': 'bg-gradient-to-r from-pink-400 to-pink-500',
        'black': 'bg-gradient-to-r from-gray-700 to-gray-800',
      };
      
      return labelColors[primaryLabel.color as keyof typeof labelColors] || 'bg-white';
    }
    
    return 'bg-white';
  };

  const getTextColor = () => {
    const primaryLabel = card.labels.find(label => label.color && label.color !== 'none');
    if (primaryLabel && ['black', 'purple', 'red', 'blue'].includes(primaryLabel.color)) {
      return 'text-white';
    }
    return 'text-gray-900';
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onClick={() => onClick?.(card)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        ${getCardStyle()}
        rounded-lg p-3 shadow-sm border border-gray-200 
        hover:shadow-md cursor-pointer transition-all duration-200
        ${isHovered ? 'transform scale-105' : ''}
        ${className}
      `}
    >
      {/* Card Title */}
      <div 
        className={`font-medium mb-2 ${getTextColor()}`}
        dangerouslySetInnerHTML={{ __html: highlightText(card.name, searchQuery) }}
      />

      {/* Card Description */}
      {card.desc && (
        <p 
          className={`text-sm mb-3 line-clamp-3 ${getTextColor()} opacity-90`}
          dangerouslySetInnerHTML={{ __html: highlightText(card.desc, searchQuery) }}
        />
      )}

      {/* Labels */}
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map(label => (
            <span
              key={label.id}
              className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${label.color === 'green' ? 'bg-green-100 text-green-800' :
                  label.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  label.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                  label.color === 'red' ? 'bg-red-100 text-red-800' :
                  label.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                  label.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                  label.color === 'sky' ? 'bg-sky-100 text-sky-800' :
                  label.color === 'lime' ? 'bg-lime-100 text-lime-800' :
                  label.color === 'pink' ? 'bg-pink-100 text-pink-800' :
                  'bg-gray-100 text-gray-800'}
              `}
            >
              {label.name || 'No name'}
            </span>
          ))}
        </div>
      )}

      {/* Card Footer with Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Due Date */}
          {card.due && (
            <div className={`
              flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium
              ${isOverdue ? 'bg-red-100 text-red-700' :
                card.dueComplete ? 'bg-green-100 text-green-700' :
                isDueSoon ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-700'}
            `}>
              {card.dueComplete ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              <span>{new Date(card.due).toLocaleDateString()}</span>
            </div>
          )}

          {/* Members */}
          {card.idMembers.length > 0 && (
            <div className={`
              flex items-center space-x-1 px-2 py-1 rounded text-xs
              ${getTextColor() === 'text-white' ? 'bg-white bg-opacity-20 text-white' : 'bg-gray-100 text-gray-700'}
            `}>
              <User className="h-3 w-3" />
              <span>{card.idMembers.length}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Comments */}
          {card.badges.comments > 0 && (
            <div className={`
              flex items-center space-x-1 text-xs
              ${getTextColor() === 'text-white' ? 'text-white opacity-90' : 'text-gray-600'}
            `}>
              <MessageCircle className="h-3 w-3" />
              <span>{card.badges.comments}</span>
            </div>
          )}

          {/* Attachments */}
          {card.badges.attachments > 0 && (
            <div className={`
              flex items-center space-x-1 text-xs
              ${getTextColor() === 'text-white' ? 'text-white opacity-90' : 'text-gray-600'}
            `}>
              <Paperclip className="h-3 w-3" />
              <span>{card.badges.attachments}</span>
            </div>
          )}

          {/* Checklist Progress */}
          {card.badges.checkItems > 0 && (
            <div className={`
              flex items-center space-x-1 text-xs
              ${getTextColor() === 'text-white' ? 'text-white opacity-90' : 'text-gray-600'}
            `}>
              <CheckCircle className="h-3 w-3" />
              <span>{card.badges.checkItemsChecked}/{card.badges.checkItems}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Cover Image */}
      {card.attachments && card.attachments.length > 0 && (
        <div className="mt-2">
          {card.attachments.map(attachment => (
            attachment.previews && attachment.previews.length > 0 && (
              <img
                key={attachment.id}
                src={attachment.previews[0].url}
                alt={attachment.name}
                className="w-full h-24 object-cover rounded"
              />
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default TrelloCard;