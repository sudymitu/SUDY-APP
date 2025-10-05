import React, { useState, useEffect, useRef } from 'react';
import { Theme } from '../types';
import { SunIcon, MoonIcon, ComputerDesktopIcon, KeyIcon, HeartIcon, LogoutIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface HeaderProps {
    user: { name: string; email: string; picture: string } | null;
    onLogout: () => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    onOpenApiKeyModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, theme, setTheme, onOpenApiKeyModal }) => {
    const { t, language, setLanguage } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


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

        {user && (
            <div className="relative ml-2" ref={dropdownRef}>
                <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white rounded-full">
                    <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                </button>
                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        <div className="py-1">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                            </div>
                            <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                                <LogoutIcon className="w-5 h-5 mr-3" />
                                {t('header.logout')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </header>
  );
};

export default Header;