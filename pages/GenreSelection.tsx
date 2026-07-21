// This file is no longer used in the main application flow based on the user's request.
// It is conceptually removed as 'GenreSelection' is no longer the first page.
// The App.tsx file no longer renders this component.
// Keeping it here for completeness of existing files, but it's effectively inactive.

import React, { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import Pill from '../components/Pill';
import { GENRE_PILLS } from '../constants';

interface GenreSelectionProps {
  onNext: (genres: string[]) => void;
  initialSelection: string[];
  onBack?: () => void;
}

const GenreSelection: React.FC<GenreSelectionProps> = ({ onNext, initialSelection, onBack }) => {
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialSelection);

  const handlePillClick = (id: string) => {
    setSelectedGenres((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((genreId) => genreId !== id)
        : [...prevSelected, id]
    );
  };

  const isNextDisabled = selectedGenres.length < 3;

  return (
    <PageLayout
      title="Pick Your Vibe Pix!"
      description="Select at least 3 genres that get your cinematic heart racing. We'll use these to fine-tune your recommendations."
      onBack={onBack}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {GENRE_PILLS.map((pill) => (
          <Pill
            key={pill.id}
            pill={pill}
            isSelected={selectedGenres.includes(pill.id)}
            onClick={handlePillClick}
          />
        ))}
      </div>
      <div className="sticky bottom-4 w-full flex justify-center">
        <Button onClick={() => onNext(selectedGenres)} disabled={isNextDisabled}>
          Next: Check Your Mood!
        </Button>
      </div>
    </PageLayout>
  );
};

export default GenreSelection;