

import React from 'react';
import { Theme } from '../types';
import { SunIcon, MoonIcon, ComputerDesktopIcon, KeyIcon, HeartIcon, CatLogoIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface HeaderProps {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    onOpenApiKeyModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, setTheme, onOpenApiKeyModal }) => {
    const { t, language, setLanguage } = useTranslation();
    
    const themeButtonClass = (buttonTheme: Theme) => {
        const base = 'p-2 rounded-md transition-colors';
        if (theme === buttonTheme) {
            if (theme === Theme.Pink) {
                return `${base} bg-pink-600 text-white`;
            }
            return `${base} bg-blue-600 text-white`;
        }
        return `${base} text-gray-400 hover:bg-gray-700 hover:text-gray-200`;
    };

  const handleLanguageChange = () => {
    if (language === 'vi') {
      setLanguage('en');
    } else if (language === 'en') {
      setLanguage('zh');
    } else {
      setLanguage('vi');
    }
  };

  return (
    <header className="bg-white dark:bg-gray-900 p-2 sm:px-4 border-b-2 border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
      <div className="flex items-center">
        <h1 className="text-md font-bold text-gray-900 dark:text-white font-orbitron uppercase ml-2">
            {t('appTitle')}
        </h1>
      </div>
      <div className="flex items-center justify-end space-x-1 sm:space-x-2">
         <div className="bg-gray-200 dark:bg-gray-800 p-1 rounded-lg flex items-center">
            <button onClick={() => setTheme(Theme.Light)} className={themeButtonClass(Theme.Light)} title="Light Mode">
                <SunIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={() => setTheme(Theme.Dark)} className={themeButtonClass(Theme.Dark)} title="Dark Mode">
                <MoonIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={() => setTheme(Theme.System)} className={themeButtonClass(Theme.System)} title="System Default">
                <ComputerDesktopIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
             <button onClick={() => setTheme(Theme.Pink)} className={themeButtonClass(Theme.Pink)} title="Pink Mode">
                <HeartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
        </div>
         <button onClick={onOpenApiKeyModal} className="p-2 rounded-md text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200" title={t('settings')}>
            <KeyIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <button onClick={handleLanguageChange} className="p-2 w-10 sm:w-12 text-center rounded-md text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 font-bold text-sm" title={t('changeLanguage')}>
            {language.toUpperCase()}
        </button>
      </div>
    </header>
  );
};

export default Header;