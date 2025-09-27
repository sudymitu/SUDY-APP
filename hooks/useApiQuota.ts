import { useState, useEffect, useCallback } from 'react';

const getLocalStorageItem = (key: string, defaultValue: number): number => {
    try {
        const item = localStorage.getItem(key);
        if (item === null || isNaN(Number(item))) {
            return defaultValue;
        }
        return parseInt(item, 10);
    } catch (error) {
        console.error(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
};

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const useApiQuota = () => {
    const [limit, setLimitState] = useState(() => getLocalStorageItem('api_quota_limit', 100));
    const [remaining, setRemaining] = useState(() => getLocalStorageItem('api_quota_count', 100));
    const [timeUntilReset, setTimeUntilReset] = useState('');

    const checkAndResetQuota = useCallback(() => {
        const lastResetStr = localStorage.getItem('api_quota_last_reset');
        const now = new Date();
        const todayStr = now.toDateString();

        if (lastResetStr !== todayStr) {
            const currentLimit = getLocalStorageItem('api_quota_limit', 100);
            localStorage.setItem('api_quota_count', String(currentLimit));
            localStorage.setItem('api_quota_last_reset', todayStr);
            setRemaining(currentLimit);
            setLimitState(currentLimit);
        }
    }, []);

    useEffect(() => {
        checkAndResetQuota();
        
        const interval = setInterval(() => {
            checkAndResetQuota();
            
            const currentRemaining = getLocalStorageItem('api_quota_count', limit);
            if (currentRemaining <= 0) {
                const msUntilReset = getTomorrow() - Date.now();
                if (msUntilReset > 0) {
                    setTimeUntilReset(formatTime(msUntilReset));
                } else {
                    checkAndResetQuota(); // Reset if timer runs out
                }
            } else {
                setTimeUntilReset('');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [checkAndResetQuota, limit]);
    
    const setLimit = (newLimit: number) => {
        const validatedLimit = Math.max(0, newLimit);
        localStorage.setItem('api_quota_limit', String(validatedLimit));
        setLimitState(validatedLimit);
        checkAndResetQuota(); // Reset count to new limit if it's a new day or just apply it
    };

    const decrementQuota = (amount: number) => {
        setRemaining(prev => {
            const newCount = Math.max(0, prev - amount);
            localStorage.setItem('api_quota_count', String(newCount));
            return newCount;
        });
    };

    const forceQuotaDepletion = useCallback(() => {
        setRemaining(0);
        localStorage.setItem('api_quota_count', '0');
    }, []);

    return { remaining, limit, timeUntilReset, setLimit, decrementQuota, forceQuotaDepletion };
};