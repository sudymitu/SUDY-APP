
import React from 'react';
import { Tab } from '../types';
import { useTranslation } from '../hooks/useTranslation';
// FIX: Import the ViewfinderCircleIcon to be used for the RenderAI tab.
import { SparklesIcon, LightningBoltIcon, HomeIcon, ArmchairIcon, BlueprintIcon, PhotoIcon, PencilRulerIcon, ViewfinderCircleIcon } from './icons';

interface EmptyStateGuideProps {
  tabType: Tab;
}

// FIX: Replaced obsolete 'ExteriorRender' and 'InteriorRender' with 'RenderAI' and used the correct icon.
const ICONS: Partial<Record<Tab, React.ReactNode>> = {
    [Tab.Enhance]: <SparklesIcon className="w-16 h-16 mb-4" />,
    [Tab.QuickGenerate]: <LightningBoltIcon className="w-16 h-16 mb-4" />,
    [Tab.RenderAI]: <ViewfinderCircleIcon className="w-16 h-16 mb-4" />,
    [Tab.FloorPlanRender]: <BlueprintIcon className="w-16 h-16 mb-4" />,
    [Tab.ImageFromReference]: <PhotoIcon className="w-16 h-16 mb-4" />,
    [Tab.TechnicalDrawing]: <PencilRulerIcon className="w-16 h-16 mb-4" />,
};

const EmptyStateGuide: React.FC<EmptyStateGuideProps> = ({ tabType }) => {
    const { t } = useTranslation();

    const titleKey = `guide.${tabType}.title`;
    let features: string[] = [];
    try {
        features = JSON.parse(t(`guide.${tabType}.features`));
    } catch(e) {
        console.error("Failed to parse features JSON from translations", e);
    }


    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 p-4 sm:p-8">
            {ICONS[tabType]}
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-4">{t(titleKey)}</h3>
            <ul className="list-disc list-inside text-left max-w-md space-y-2 text-gray-600 dark:text-gray-400">
                {features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                ))}
            </ul>
        </div>
    );
};

export default EmptyStateGuide;