import React from 'react';
import { useApiQuota } from '../contexts/ApiQuotaContext';
import { useTranslation } from '../hooks/useTranslation';
import { SparklesIcon } from './icons';

const ApiQuotaDisplay: React.FC = () => {
    const { remaining, limit, timeUntilReset } = useApiQuota();
    const { t } = useTranslation();

    const percentage = limit > 0 ? (remaining / limit) * 100 : 0;
    let colorClass = 'text-green-500';
    if (percentage < 50) colorClass = 'text-yellow-500';
    if (percentage < 20) colorClass = 'text-red-500';
    if (remaining <= 0) colorClass = 'text-red-600';

    return (
        <div className="bg-gray-200 dark:bg-gray-800 p-1 px-3 rounded-lg flex items-center text-xs sm:text-sm font-semibold whitespace-nowrap">
            {remaining > 0 ? (
                <>
                    <SparklesIcon className={`w-4 h-4 mr-2 ${colorClass}`} />
                    <span className="hidden sm:inline text-gray-600 dark:text-gray-400 mr-1">{t('quota.remaining')}</span>
                    <span className={`${colorClass}`}>{remaining} / {limit}</span>
                </>
            ) : (
                <div className="flex flex-col items-center text-center">
                    <span className="text-red-500">{t('quota.depleted')}</span>
                    <span className="font-mono text-red-500">{timeUntilReset}</span>
                </div>
            )}
        </div>
    );
};

export default ApiQuotaDisplay;