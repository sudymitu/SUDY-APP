import React from 'react';
import { Tab } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { LockClosedIcon, VideoCameraIcon, SparklesIcon } from './icons';
import { useActivation } from '../contexts/ActivationContext';

interface WelcomeScreenProps {
  setActiveTab: (tab: Tab) => void;
  TAB_ICONS: Record<Tab, React.ReactNode>;
  TABS_IN_ORDER: Tab[];
}

const ToolCard: React.FC<{ tab: Tab; onClick: () => void; TAB_ICONS: Record<Tab, React.ReactNode>, isLocked: boolean }> = ({ tab, onClick, TAB_ICONS, isLocked }) => {
    const { t } = useTranslation();
    const Icon = TAB_ICONS[tab];
    const title = t(tab);
    const description = t(`welcome.card.${tab}.desc`);

    return (
        <div 
            className={`relative group h-full rounded-xl cursor-pointer bg-gray-100 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-500/50`}
            onClick={onClick}
        >
            <div className="flex-shrink-0 w-12 h-12 mb-4 text-blue-500 dark:text-blue-400">
                {Icon}
            </div>
            <div className="min-h-0 flex-grow flex flex-col overflow-y-auto no-scrollbar w-full">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{description}</p>
            </div>
            {isLocked && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center z-10">
                    <LockClosedIcon className="w-12 h-12 text-yellow-400" />
                </div>
            )}
        </div>
    );
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ setActiveTab, TAB_ICONS, TABS_IN_ORDER }) => {
    const { t } = useTranslation();
    const { isActivated, openActivationModal } = useActivation();

    const isLocked = (tab: Tab) => {
        const lockedTabs = [Tab.Veo, Tab.FloorPlanColoring, Tab.Upscale4K];
        return lockedTabs.includes(tab) && !isActivated;
    };

    const handleCardClick = (tab: Tab) => {
        if (isLocked(tab)) {
            openActivationModal();
        } else {
            setActiveTab(tab);
        }
    };

    const cardSizes: Record<string, string> = {
        [Tab.RenderAI]: 'lg:col-span-3',
        [Tab.QuickGenerate]: 'lg:col-span-3',
        [Tab.FloorPlanColoring]: 'lg:col-span-3',
        [Tab.Veo]: 'lg:col-span-3',
        [Tab.Enhance]: 'lg:col-span-2',
        [Tab.VirtualTour]: 'lg:col-span-2',
        [Tab.ImageFromReference]: 'lg:col-span-2',
        [Tab.FloorPlanRender]: 'lg:col-span-2',
        [Tab.TechnicalDrawing]: 'lg:col-span-2',
        [Tab.ImageLibrary]: 'lg:col-span-2',
    };

    return (
        <div className="relative w-full min-h-full overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-900/50">
            <div className="text-center z-10 my-8">
                <h1 className="font-orbitron text-4xl md:text-5xl font-bold text-gray-800 dark:text-white">
                    {t('appTitle')}
                </h1>
                <p className="mt-2 text-md md:text-lg text-gray-600 dark:text-gray-300">
                    {t('welcome.subtitle')}
                </p>
                <div className="mt-6 max-w-2xl mx-auto p-4 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 text-sm sm:text-base text-gray-700 dark:text-gray-300">
                    <p dangerouslySetInnerHTML={{ __html: t('welcomeScreen.zaloInvite') }} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 max-w-7xl w-full z-10">
                {TABS_IN_ORDER.map(tab => (
                    <div key={tab} className={`${cardSizes[tab] || 'lg:col-span-2'} col-span-1 sm:col-span-1 min-h-[220px]`}>
                        <ToolCard 
                            tab={tab} 
                            onClick={() => handleCardClick(tab)}
                            TAB_ICONS={TAB_ICONS} 
                            isLocked={isLocked(tab)} 
                        />
                    </div>
                ))}
            </div>

            <div className="text-center z-10 my-12 max-w-6xl w-full">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('welcome.otherApps.title')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <a href="https://ai.studio/apps/drive/1fJgkdgReNo0-31zIE7LjgU8Z2qKQBoIT" target="_blank" rel="noopener noreferrer" className="block p-6 bg-gray-100 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-500 transition-all">
                        <div className="flex items-center justify-center gap-4">
                            <VideoCameraIcon className="w-10 h-10 text-blue-500"/>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">SUDY MASTER SCRIPT</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('welcome.otherApps.masterScript.desc')}</p>
                            </div>
                        </div>
                    </a>
                     <a href="https://ai.studio/apps/drive/1fvOVAddGw7G5ZdRFs_8cgTNbTD4wRsB1" target="_blank" rel="noopener noreferrer" className="block p-6 bg-gray-100 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-500 transition-all">
                        <div className="flex items-center justify-center gap-4">
                            <SparklesIcon className="w-10 h-10 text-pink-500"/>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">SUDY Magic Tools</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('welcome.otherApps.magicTools.desc')}</p>
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;