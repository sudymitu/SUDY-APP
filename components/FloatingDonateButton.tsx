import React from 'react';
import { HeartIcon, QuestionMarkCircleIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface FloatingDonateButtonProps {
    onOpenDonationModal: () => void;
    onOpenInfoModal: () => void;
}

const FloatingDonateButton: React.FC<FloatingDonateButtonProps> = ({ onOpenDonationModal, onOpenInfoModal }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed bottom-5 right-5 z-30 flex flex-col items-center space-y-2">
            <button
                onClick={onOpenInfoModal}
                className="flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg transform hover:scale-105 transition-transform duration-200 ease-in-out"
                title={t('helpModal.buttonTitle')}
            >
                <QuestionMarkCircleIcon className="w-8 h-8" />
            </button>
            <button
                onClick={onOpenDonationModal}
                className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full shadow-lg transform hover:scale-105 transition-transform duration-200 ease-in-out"
                title={t('donate')}
            >
                <HeartIcon className="w-6 h-6 mr-2" />
                <span className="font-semibold text-sm">{t('donate.button')}</span>
            </button>
        </div>
    );
};

export default FloatingDonateButton;