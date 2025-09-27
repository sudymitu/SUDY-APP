import React, { useState } from 'react';
import { useActivation } from '../contexts/ActivationContext';
import { useTranslation } from '../hooks/useTranslation';
import { KeyIcon, XMarkIcon } from './icons';

const ActivationModal: React.FC = () => {
    const { isModalOpen, closeActivationModal, activate } = useActivation();
    const { t } = useTranslation();
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleActivate = () => {
        if (activate(code)) {
            setError('');
            setSuccess(t('activation.success'));
            setTimeout(() => {
                // No need to call closeActivationModal as activate() already does it
                setSuccess('');
                setCode('');
            }, 2000);
        } else {
            setError(t('activation.error'));
            setSuccess('');
        }
    };

    const handleClose = () => {
        setCode('');
        setError('');
        setSuccess('');
        closeActivationModal();
    };

    if (!isModalOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm"
            onClick={handleClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 relative border border-gray-300 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    onClick={handleClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
                
                <div className="flex items-center mb-4">
                    <KeyIcon className="w-8 h-8 text-yellow-500 mr-3 flex-shrink-0" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('activation.title')}</h2>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4" dangerouslySetInnerHTML={{ __html: t('activation.message') }} />

                <div className="space-y-2">
                    <label htmlFor="activation-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('activation.label')}</label>
                    <input
                        id="activation-code"
                        type="text"
                        value={code}
                        onChange={(e) => {
                            setError('');
                            setCode(e.target.value);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                        placeholder={t('activation.placeholder')}
                        className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                {success && <p className="text-green-500 text-sm mt-2">{success}</p>}

                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={handleActivate}
                        disabled={!!success || !code}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500"
                    >
                        {t('activation.button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActivationModal;
