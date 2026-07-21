// This file is no longer used in the main application flow based on the user's request.
// It is conceptually removed as 'MoodCheck' is no longer the second page.
// The App.tsx file no longer renders this component.
// Keeping it here for completeness of existing files, but it's effectively inactive.

import React, { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import VibeCard from '../components/VibeCard';
import { VIBE_CARDS } from '../constants';

interface MoodCheckProps {
  onNext: (mood: string) => void;
  initialSelection: string | null;
  onBack?: () => void;
}

const MoodCheck: React.FC<MoodCheckProps> = ({ onNext, initialSelection, onBack }) => {
  const [selectedMood, setSelectedMood] = useState<string | null>(initialSelection);

  const handleCardClick = (id: string) => {
    setSelectedMood(id);
  };

  const isNextDisabled = !selectedMood;

  return (
    <PageLayout
      title="Mood Check!"
      description="Select the mood that best suits your cinematic cravings right now."
      onBack={onBack}
    >
      <div className="grid grid-cols-2 gap-6 mb-10">
        {VIBE_CARDS.map((vibe) => (
          <VibeCard
            key={vibe.id}
            vibe={vibe}
            isSelected={selectedMood === vibe.id}
            onClick={handleCardClick}
          />
        ))}
      </div>
      <div className="sticky bottom-4 w-full flex justify-center">
        <Button onClick={() => selectedMood && onNext(selectedMood)} disabled={isNextDisabled}>
          Next: Refine with Swipes!
        </Button>
      </div>
    </PageLayout>
  );
};

export default MoodCheck;