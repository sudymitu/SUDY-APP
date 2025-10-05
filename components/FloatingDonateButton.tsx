import React from 'react';
import { HeartIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface FloatingDonateButtonProps {
  onClick: () => void;
}

const FloatingDonateButton: React.FC<FloatingDonateButtonProps> = ({ onClick }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="w-16 h-16 bg-pink-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 hover:scale-110 hover:bg-pink-600"
      title={t('donate')}
    >
      <HeartIcon className="w-8 h-8" />
    </button>
  );
};

export default FloatingDonateButton;
