
import React, { useState } from 'react';
import { XMarkIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';
import { QR_CODE_BASE64 } from '../assets/qr-code';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const accountNumber = '1014685607';

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-sm m-4 relative border border-gray-300 dark:border-gray-700 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{t('donationTitle')}</h2>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('donationMessage')}
        </p>

        <div className="flex justify-center mb-4">
          <img src={QR_CODE_BASE64} alt="QR Code for donation" className="w-48 h-48 rounded-md border-4 border-white dark:border-gray-700 shadow-md" />
        </div>

        <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-left space-y-3">
          <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('donation.bank')}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">VIETCOMBANK</p>
          </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('donation.accountHolder')}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">TRUONG DIEN DUY</p>
          </div>
          <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('donation.accountNumber')}</p>
              <div className="flex items-center justify-between">
                <p className="text-xl font-mono font-bold text-blue-600 dark:text-blue-400">{accountNumber}</p>
                <button onClick={handleCopy} className="text-sm bg-gray-200 dark:bg-gray-600 px-3 py-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors w-20">
                    {copied ? t('donation.button.copied') : t('donation.button.copy')}
                </button>
              </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DonationModal;
