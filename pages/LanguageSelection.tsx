import React, { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import Pill from '../components/Pill';
import { LANGUAGE_PILLS } from '../constants';

interface LanguageSelectionProps {
  onNext: (languages: string[]) => void;
  initialSelection: string[];
  onBack?: () => void; // Keep for potential future use or consistency, but won't be passed from App.tsx
}

const LanguageSelection: React.FC<LanguageSelectionProps> = ({ onNext, initialSelection, onBack }) => {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(initialSelection);

  const handlePillClick = (id: string) => {
    setSelectedLanguages((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((langId) => langId !== id)
        : [...prevSelected, id]
    );
  };

  const isNextDisabled = selectedLanguages.length === 0;

  return (
    <PageLayout
      title="Select Your Preferred Languages"
      description="Choose one or more languages for your movie recommendations. This helps us find content that truly resonates with you."
      // Removed onBack prop, as this is now the first page.
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {LANGUAGE_PILLS.map((pill) => (
          <Pill
            key={pill.id}
            pill={pill}
            isSelected={selectedLanguages.includes(pill.id)}
            onClick={handlePillClick}
          />
        ))}
      </div>
      <div className="w-full flex justify-center mt-8">
        <Button onClick={() => onNext(selectedLanguages)} disabled={isNextDisabled}>
          Next: Refine with Swipes!
        </Button>
      </div>
    </PageLayout>
  );
};

export default LanguageSelection;