import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

interface ActivationContextType {
  isActivated: boolean;
  activate: (code: string) => boolean;
  isModalOpen: boolean;
  openActivationModal: () => void;
  closeActivationModal: () => void;
}

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

export const ACTIVATION_CODE = '@DdSudy';

export const ActivationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const storedStatus = localStorage.getItem('sudy-app-activated');
    if (storedStatus === 'true') {
      setIsActivated(true);
    }
  }, []);

  const activate = (code: string): boolean => {
    if (code === ACTIVATION_CODE) {
      localStorage.setItem('sudy-app-activated', 'true');
      setIsActivated(true);
      setIsModalOpen(false);
      return true;
    }
    return false;
  };

  const openActivationModal = useCallback(() => {
    if (!isActivated) {
        setIsModalOpen(true);
    }
  }, [isActivated]);

  const closeActivationModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <ActivationContext.Provider value={{ isActivated, activate, isModalOpen, openActivationModal, closeActivationModal }}>
      {children}
    </ActivationContext.Provider>
  );
};

export const useActivation = (): ActivationContextType => {
  const context = useContext(ActivationContext);
  if (!context) {
    throw new Error('useActivation must be used within an ActivationProvider');
  }
  return context;
};
