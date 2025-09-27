

import React from 'react';
import RenderTabBase from './RenderTabBase';
import { EnhanceState, ImageResult, Tab } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { INTERIOR_RENDER_VIEW_KEYS } from '../constants';

interface InteriorRenderTabProps {
    state: any;
    setState: (state: any) => void;
    onClear: () => void;
    onEnhance: (state: EnhanceState) => void;
    onFullscreen: (images: ImageResult[], startIndex: number) => void;
}

const InteriorRenderTab: React.FC<InteriorRenderTabProps> = ({ state, setState, onClear, onEnhance, onFullscreen }) => {
  const { t } = useTranslation();
  return (
    <RenderTabBase 
      // FIX: The 'InteriorRender' enum member does not exist. Changed to 'RenderAI'.
      tabType={Tab.RenderAI}
      title={t('interior.title')}
      promptPlaceholder={t('interior.placeholder')}
      state={state}
      setState={setState}
      onClear={onClear}
      onEnhance={onEnhance}
      onFullscreen={onFullscreen}
      renderViewKeys={INTERIOR_RENDER_VIEW_KEYS}
    />
  );
};

export default InteriorRenderTab;