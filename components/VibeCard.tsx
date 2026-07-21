import React from 'react';
import { VibeCard as VibeCardType } from '../types';

interface VibeCardProps {
  vibe: VibeCardType;
  isSelected: boolean;
  onClick: (id: string) => void;
}

const VibeCard: React.FC<VibeCardProps> = ({ vibe, isSelected, onClick }) => {
  const handleClick = () => {
    onClick(vibe.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex flex-col items-center justify-center p-6 rounded-2xl
        bg-white/5 backdrop-blur-sm border border-white/20
        transition-all duration-300 ease-in-out cursor-pointer
        ${isSelected
          ? 'bg-neon-blue/20 border-neon-blue text-neon-blue shadow-lg shadow-neon-blue/30 scale-105'
          : 'hover:bg-white/10 hover:border-white/40 hover:scale-105'
        }
      `}
    >
      {/* Render emoji as an image if it's an SVG data URI, otherwise as a span */}
      {vibe.emoji.startsWith('data:image/svg+xml') ? (
        <img src={vibe.emoji} alt={vibe.name} className="w-12 h-12 mb-3 text-white" />
      ) : (
        <span className="text-5xl mb-3">{vibe.emoji}</span>
      )}
      <h3 className="text-xl font-bold mb-1 text-white">{vibe.name}</h3>
      <p className="text-sm text-white/70">{vibe.description}</p>
    </button>
  );
};

export default VibeCard;