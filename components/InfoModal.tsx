
import React from 'react';
import { XMarkIcon, HeartIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showDonateButton?: boolean;
  onOpenDonationModal?: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, title, children, showDonateButton = false, onOpenDonationModal }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleDonateClick = () => {
    onClose(); // Close this modal first
    if (onOpenDonationModal) {
      onOpenDonationModal();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg m-4 relative border border-gray-300 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{title}</h2>
        
        <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {children}
        </div>

        <div className="mt-6 flex justify-end items-center space-x-2">
          {showDonateButton && (
            <button 
                onClick={handleDonateClick}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-pink-500 rounded-md hover:bg-pink-600 transition-colors"
            >
                <HeartIcon className="w-5 h-5 mr-2" />
                {t('donate.button')}
            </button>
          )}
           <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
