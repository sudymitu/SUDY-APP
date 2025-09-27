import React, { createContext, useContext, ReactNode } from 'react';
import { useApiQuota as useApiQuotaHook } from '../hooks/useApiQuota';

type ApiQuotaContextType = ReturnType<typeof useApiQuotaHook>;

const ApiQuotaContext = createContext<ApiQuotaContextType | undefined>(undefined);

export const ApiQuotaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const quota = useApiQuotaHook();
  return (
    <ApiQuotaContext.Provider value={quota}>
      {children}
    </ApiQuotaContext.Provider>
  );
};

export const useApiQuota = (): ApiQuotaContextType => {
  const context = useContext(ApiQuotaContext);
  if (context === undefined) {
    throw new Error('useApiQuota must be used within an ApiQuotaProvider');
  }
  return context;
};
