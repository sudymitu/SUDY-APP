
import React from 'react';
import RenderTabBase from './RenderTabBase';
import { EnhanceState, ImageResult, Tab } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface ExteriorRenderTabProps {
    state: any;
    setState: (state: any) => void;
    onClear: () => void;
    onEnhance: (state: EnhanceState) => void;
    onFullscreen: (images: ImageResult[], startIndex: number) => void;
}

const ExteriorRenderTab: React.FC<ExteriorRenderTabProps> = ({ state, setState, onClear, onEnhance, onFullscreen }) => {
  const { t } = useTranslation();
  return (
    <RenderTabBase 
      // FIX: The 'ExteriorRender' enum member does not exist. Changed to 'RenderAI'.
      tabType={Tab.RenderAI}
      title={t('exterior.title')}
      promptPlaceholder={t('exterior.placeholder')}
      state={state}
      setState={setState}
      onClear={onClear}
      onEnhance={onEnhance}
      onFullscreen={onFullscreen}
    />
  );
};

export default ExteriorRenderTab;