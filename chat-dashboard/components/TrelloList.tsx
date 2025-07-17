'use client';

import React, { useState } from 'react';
import { Plus, MoreHorizontal, X } from 'lucide-react';
import TrelloCardComponent from './TrelloCard';
import { TrelloList as TrelloListType, TrelloCard as TrelloCardType } from '@/lib/trello-client';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrelloListProps {
  list: TrelloListType;
  onCreateCard: (listId: string, name: string, description?: string) => void;
  onCardClick?: (card: TrelloCardType) => void;
  className?: string;
  searchQuery?: string;
}

const TrelloList: React.FC<TrelloListProps> = ({
  list,
  onCreateCard,
  onCardClick,
  className = '',
  searchQuery = ''
}) => {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardDescription, setCardDescription] = useState('');
  
  const { setNodeRef } = useDroppable({
    id: list.id,
  });

  const handleCreateCard = () => {
    if (cardName.trim()) {
      onCreateCard(list.id, cardName.trim(), cardDescription.trim() || undefined);
      setCardName('');
      setCardDescription('');
      setIsAddingCard(false);
    }
  };

  const handleCancelAdd = () => {
    setCardName('');
    setCardDescription('');
    setIsAddingCard(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateCard();
    } else if (e.key === 'Escape') {
      handleCancelAdd();
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-gray-100 rounded-lg shadow-sm ${className}`}
    >
      {/* List Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
            {list.name}
          </h3>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
              {list.cards?.length || 0}
            </span>
            <button className="p-1 hover:bg-gray-200 rounded">
              <MoreHorizontal className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards Container */}
      <div className="p-3 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        <SortableContext
          items={list.cards?.map(card => card.id) || []}
          strategy={verticalListSortingStrategy}
        >
          {list.cards?.map((card) => (
            <SortableTrelloCard
              key={card.id}
              card={card}
              onClick={onCardClick}
              searchQuery={searchQuery}
            />
          ))}
        </SortableContext>

        {/* Add Card Form */}
        {isAddingCard ? (
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <input
              type="text"
              placeholder="Enter card title..."
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-2 border border-gray-300 rounded mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            
            <textarea
              placeholder="Enter card description (optional)..."
              value={cardDescription}
              onChange={(e) => setCardDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-2 border border-gray-300 rounded mb-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />

            <div className="flex space-x-2">
              <button
                onClick={handleCreateCard}
                disabled={!cardName.trim()}
                className="flex-1 bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Card
              </button>
              <button
                onClick={handleCancelAdd}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Add Card Button */
          <button
            onClick={() => setIsAddingCard(true)}
            className="w-full p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-all duration-200 group"
          >
            <div className="flex items-center justify-center space-x-2">
              <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Add a card</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

// Sortable wrapper for TrelloCard
interface SortableTrelloCardProps {
  card: TrelloCardType;
  onClick?: (card: TrelloCardType) => void;
  searchQuery?: string;
}

const SortableTrelloCard: React.FC<SortableTrelloCardProps> = ({ card, onClick, searchQuery = '' }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TrelloCardComponent
        card={card}
        onDragStart={() => {}}
        onClick={onClick}
        searchQuery={searchQuery}
      />
    </div>
  );
};

export default TrelloList;