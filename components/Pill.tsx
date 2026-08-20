import React from 'react';
import { GenrePill as GenrePillType } from '../types';

interface PillProps {
  pill: GenrePillType;
  isSelected: boolean;
  onClick: (id: string) => void;
}

const Pill: React.FC<PillProps> = ({ pill, isSelected, onClick }) => {
  const handleClick = () => {
    onClick(pill.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        w-full flex items-center justify-center gap-2 overflow-hidden
        py-3 px-3 sm:px-6 rounded-full text-base sm:text-lg font-semibold cursor-pointer
        transition-all duration-300 ease-in-out
        bg-white/5 backdrop-blur-sm border border-white/20
        ${isSelected
          ? 'bg-neon-blue/20 border-neon-blue text-white shadow-lg shadow-neon-blue/30'
          : 'hover:bg-white/10 hover:border-white/40 text-white'
        }
      `}
    >
      {/* Conditionally render emoji/icon only if pill.emoji is provided */}
      {pill.emoji && (pill.emoji.startsWith('data:image/svg+xml') ? (
        <img src={pill.emoji} alt={pill.name} className="w-5 h-5" />
      ) : (
        <span className="text-xl text-white">{pill.emoji}</span>
      ))}
      <span className="truncate">{pill.name}</span>
    </button>
  );
};

export default Pill;