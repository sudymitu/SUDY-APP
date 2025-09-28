import React from 'react';
import { Tab } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { LockClosedIcon } from './icons';
import { useActivation } from '../contexts/ActivationContext';

interface WelcomeScreenProps {
  setActiveTab: (tab: Tab) => void;
  TAB_ICONS: Record<Tab, React.ReactNode>;
}

const ToolCard: React.FC<{ tab: Tab; onClick: () => void; className?: string; TAB_ICONS: Record<Tab, React.ReactNode>, isLocked: boolean }> = ({ tab, onClick, className = '', TAB_ICONS, isLocked }) => {
    const { t } = useTranslation();
    const Icon = TAB_ICONS[tab];
    const title = t(tab);
    const description = t(`welcome.card.${tab}.desc`);
    let features: string[] = [];
    try {
        features = JSON.parse(t(`welcome.card.${tab}.features`));
    } catch(e) {
        console.error(`Could not parse features for ${tab}`, e)
    }


    return (
        <div 
            className={`relative group rounded-xl cursor-pointer [perspective:1000px] ${className}`}
            onClick={onClick}
        >
            <div className="relative h-full w-full rounded-xl shadow-lg transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                {/* Front */}
                <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center text-center [backface-visibility:hidden]">
                    <div className="flex-shrink-0 w-12 h-12 mb-4 text-blue-500 dark:text-blue-400">
                        {Icon}
                    </div>
                    <div className="min-h-0 flex-grow flex flex-col overflow-y-auto no-scrollbar w-full">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{description}</p>
                    </div>
                </div>
                {/* Back */}
                <div className="absolute inset-0 h-full w-full rounded-xl bg-gray-800 dark:bg-gray-900 border border-gray-700 p-6 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <div className="text-center flex flex-col h-full">
                        <h3 className="font-bold text-lg text-white flex-shrink-0">{title}</h3>
                        <p className="text-sm font-semibold text-blue-400 mt-2 mb-3 flex-shrink-0">{t('welcome.card.key_features')}</p>
                        <div className="min-h-0 flex-grow overflow-y-auto no-scrollbar text-left">
                            <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside">
                               {features.map((feature, index) => <li key={index}>{feature}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            {isLocked && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center z-10 pointer-events-none">
                    <LockClosedIcon className="w-12 h-12 text-yellow-400" />
                </div>
            )}
        </div>
    );
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ setActiveTab, TAB_ICONS }) => {
    const { t } = useTranslation();
    const { isActivated, openActivationModal } = useActivation();

    const isLocked = (tab: Tab) => {
        const lockedTabs = [Tab.Veo, Tab.FloorPlanColoring];
        return lockedTabs.includes(tab) && !isActivated;
    };

    const handleCardClick = (tab: Tab) => {
        if (isLocked(tab)) {
            openActivationModal();
        } else {
            setActiveTab(tab);
        }
    };

    const TABS_IN_ORDER = [
        Tab.QuickGenerate,
        Tab.Enhance,
        Tab.VirtualTour,
        Tab.ImageFromReference,
        Tab.RenderAI,
        Tab.FloorPlanRender,
        Tab.TechnicalDrawing,
        Tab.FloorPlanColoring,
        Tab.Veo,
        Tab.ImageLibrary,
    ];

    const cardSizes = {
        [Tab.QuickGenerate]: 'col-span-2',
        [Tab.Enhance]: 'col-span-2',
        [Tab.VirtualTour]: 'col-span-2 md:col-span-3 lg:col-span-4',
        [Tab.ImageFromReference]: 'col-span-2',
        [Tab.ImageLibrary]: 'col-span-2 lg:col-span-2',
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
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl w-full z-10">
                <div className="col-span-2 md:col-span-3 lg:col-span-4 min-h-[180px]">
                    <ToolCard 
                        tab={Tab.RenderAI} 
                        onClick={() => handleCardClick(Tab.RenderAI)}
                        TAB_ICONS={TAB_ICONS} 
                        isLocked={isLocked(Tab.RenderAI)} 
                    />
                </div>
                {TABS_IN_ORDER.filter(tab => tab !== Tab.RenderAI).map(tab => (
                    <div key={tab} className={`${cardSizes[tab as keyof typeof cardSizes] || ''} min-h-[180px]`}>
                        <ToolCard 
                            tab={tab} 
                            onClick={() => handleCardClick(tab)}
                            TAB_ICONS={TAB_ICONS} 
                            isLocked={isLocked(tab)} 
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WelcomeScreen;