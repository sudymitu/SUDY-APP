import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import TabButton from './components/TabButton';
import { Tab, EnhanceState, Theme, ImageResult, GenerationInfo, VideoResult, Message } from './types';
import { ASPECT_RATIO_KEYS, RENDER_VIEW_KEYS, IMAGE_GENERATION_MODELS } from './constants';
import FloorPlanRenderTab from './tabs/FloorPlanRenderTab';
import TrainingTab from './tabs/TrainingTab';
import EnhanceTab from './tabs/EnhanceTab';
import FullscreenView from './components/FullscreenView';
import ApiKeyModal from './components/ApiKeyModal';
import QuickGenerateTab from './tabs/QuickGenerateTab';
import TechnicalDrawingTab from './tabs/TechnicalDrawingTab';
import { useTranslation } from './hooks/useTranslation';
import DonationModal from './components/DonationModal';
import ImageLibraryTab from './tabs/ImageLibraryTab';
import { 
    SparklesIcon, 
    LightningBoltIcon,
    HomeIcon,
    FolderOpenIcon,
    BlueprintIcon,
    PhotoIcon,
    PencilRulerIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    VideoCameraIcon,
    ArrowUpOnSquareIcon,
    LockClosedIcon,
    PaintBrushIcon,
    ViewfinderCircleIcon,
    AvatarIcon,
    CubeIcon,
} from './components/icons';
import { nanoid } from 'nanoid';
import { useImageLibrary } from './contexts/ImageLibraryContext';
import InfoModal from './components/InfoModal';
import WelcomeScreen from './components/WelcomeScreen';
import Upscale4KTab from './tabs/Upscale4KTab';
import VeoTab from './tabs/VeoTab';
import { useActivation } from './contexts/ActivationContext';
import FloorPlanColoringTab from './tabs/IsometricRenderTab';
import ActivationModal from './components/ActivationModal';
import VirtualTourTab from './tabs/VirtualTourTab';
import RenderTab from './tabs/RenderTab';
import Chatbot from './components/Chatbot';
import { dataURLtoBase64, fileToDataURL, base64ToFile } from './utils/file';
import FloatingDonateButton from './components/FloatingDonateButton';
import LoginScreen from './components/LoginScreen';
import { AVATAR_BASE64 } from './assets/avatar';


const initialRenderAIState = {
  mainImageFile: null,
  mainImageUrl: null,
  processedImageUrl: null,
  refImageFile: null,
  refImageUrl: null,
  prompt: '',
  loraPrompt: '',
  aspectRatio: ASPECT_RATIO_KEYS[1], // Default to 16:9
  numResults: 1,
  results: [],
  useLineArt: false,
  sharpnessAdherence: 7,
  initialStateFromOtherTab: null,
  useRandomPrompts: false, // For new random prompt feature
  promptBankCategory: 'exterior', // For new random prompt feature
  adaptationMode: null,
};

const initialQuickGenerateState = {
    prompt: '',
    aspectRatio: ASPECT_RATIO_KEYS[1],
    numResults: 1,
    imageModel: IMAGE_GENERATION_MODELS[0].value,
    creativity: 5,
    loraPrompt: '',
    results: [],
};

const initialEnhanceState = {
  originalImageSrc: null,
  processedImageSrc: null,
  prompt: '',
  autoOptimizePrompt: false, // Set to false by default as requested
  creativity: 5,
  aspectRatio: 'Original Aspect Ratio',
  numResults: 1,
  adaptationMode: null,
  loraPrompt: '',
  results: [],
  showAdvancedElements: false,
  elements: Array(6).fill(null).map(() => ({ id: nanoid(), file: null, name: '', dataUrl: null })),
  initialStateFromOtherTab: null,
  drawingDataUrl: null,
  preInpaintSrc: null, // For reverting inpaint edits
};

const initialFloorPlanState = {
    floorplanFile: null,
    floorplanSrcForModal: null,
    inpaintedPlanDataUrl: null,
    refImageFile: null,
    refImageUrl: null,
    loraStylePrompt: '',
    prompt: '',
    aspectRatio: ASPECT_RATIO_KEYS[1],
    renderViews: [RENDER_VIEW_KEYS[10]],
    numResults: 1,
    results: [],
    showAdvancedElements: false,
    elements: Array(6).fill(null).map(() => ({ id: nanoid(), file: null, name: '', dataUrl: null })),
    drawingDataUrl: null,
};

const initialFloorPlanColoringState = {
    floorplanFile: null,
    floorplanUrl: null,
    prompt: '',
    selectedStylePreset: 'modern',
    refImageFile: null,
    refImageUrl: null,
    customStylePrompt: '',
    renderTopViewOnly: true,
    result: null,
};

const initialTrainingState = {
    descriptionPrompt: '',
    refImages: Array(6).fill(null),
    analysisResult: '',
    generationPrompt: '',
    numResults: 1,
    creativity: 5,
    results: [],
    initialStateFromOtherTab: null,
    generationMode: 'text', // 'text' or 'sketch'
    imageModel: IMAGE_GENERATION_MODELS[0].value,
    aspectRatio: ASPECT_RATIO_KEYS[1], // 16:9
    featureType: 'geometry',
    featureImage: null,
};

const initialTechDrawingState = {
    sourceImageFile: null,
    sourceImageUrl: null,
    prompt: '',
    results: [],
    initialStateFromOtherTab: null,
};

const initialUpscaleState = {
    sourceImageFile: null,
    sourceImageUrl: null,
    result: null,
    initialStateFromOtherTab: null,
};

const initialVeoState = {
    sourceImageFile: null,
    sourceImageUrl: null,
    prompt: '',
    aspectRatio: '16:9',
    result: null,
    initialStateFromOtherTab: null,
};

const initialVirtualTourState = {
    originalImageFile: null,
    originalImageUrl: null,
    prompt: '',
    movementIntensity: 1,
    history: [],
    historyIndex: -1,
};

const initialTabStates = {
    [Tab.Enhance]: initialEnhanceState,
    [Tab.QuickGenerate]: initialQuickGenerateState,
    [Tab.RenderAI]: initialRenderAIState,
    [Tab.FloorPlanRender]: initialFloorPlanState,
    [Tab.FloorPlanColoring]: initialFloorPlanColoringState,
    [Tab.ImageFromReference]: initialTrainingState,
    [Tab.TechnicalDrawing]: initialTechDrawingState,
    [Tab.Upscale4K]: initialUpscaleState,
    [Tab.Veo]: initialVeoState,
    [Tab.VirtualTour]: initialVirtualTourState,
};

const getTabIcons = (isActivated: boolean): Record<Tab, React.ReactNode> => {
    const renderIcon = (icon: React.ReactNode, isLocked: boolean) => {
        if (isLocked && !isActivated) {
            return (
                <div className="relative w-6 h-6">
                    {icon}
                    <LockClosedIcon className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-gray-100 dark:bg-gray-800 text-yellow-500 p-0.5 rounded-full" />
                </div>
            );
        }
        return <div className="w-6 h-6">{icon}</div>;
    };

    return {
        [Tab.Welcome]: renderIcon(<HomeIcon />, false),
        [Tab.Enhance]: renderIcon(<SparklesIcon />, false),
        [Tab.QuickGenerate]: renderIcon(<LightningBoltIcon />, false),
        [Tab.RenderAI]: renderIcon(<CubeIcon />, false),
        [Tab.FloorPlanRender]: renderIcon(<BlueprintIcon />, false),
        [Tab.FloorPlanColoring]: renderIcon(<PaintBrushIcon />, true),
        [Tab.ImageFromReference]: renderIcon(<PhotoIcon />, false),
        [Tab.TechnicalDrawing]: renderIcon(<PencilRulerIcon />, false),
        [Tab.Upscale4K]: renderIcon(<ArrowUpOnSquareIcon />, true),
        [Tab.Veo]: renderIcon(<VideoCameraIcon />, true),
        [Tab.VirtualTour]: renderIcon(<ViewfinderCircleIcon />, false),
        [Tab.ImageLibrary]: renderIcon(<FolderOpenIcon />, false),
    };
};


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Welcome);
  const [tabStates, setTabStates] = useState<any>(initialTabStates);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const [fullscreenState, setFullscreenState] = useState<{ images: ImageResult[], currentIndex: number } | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const { t } = useTranslation();
  const { images, addMedia } = useImageLibrary();
  const { isActivated, openActivationModal } = useActivation();
  const [imageForChatbot, setImageForChatbot] = useState<File | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{name: string, email: string, picture: string} | null>(null);

  const TAB_ICONS = getTabIcons(isActivated);

  // New state for modals
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const shownFeedbackMilestones = useRef(new Set());

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || Theme.System;
  });
  
  useEffect(() => {
    const loggedInStatus = localStorage.getItem('sud_app_isLoggedIn');
    if (loggedInStatus === 'true') {
        setIsLoggedIn(true);
        setUser({
            name: 'Dien Duy',
            email: 'dienduy.dev@example.com',
            picture: AVATAR_BASE64,
        });
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };
  
  // Welcome modal logic
  useEffect(() => {
    if (!isLoggedIn) return;
    // Show welcome modal on every app load.
    setIsWelcomeModalOpen(true);
  }, [isLoggedIn]);

  // Feedback modal logic
  useEffect(() => {
    const imageCount = images.length;
    // Trigger at every 8 images (8, 16, 24...)
    if (imageCount > 0 && imageCount % 8 === 0) {
      // Ensure we only show it once per milestone
      if (!shownFeedbackMilestones.current.has(imageCount)) {
        setIsFeedbackModalOpen(true);
        shownFeedbackMilestones.current.add(imageCount);
      }
    }
  }, [images.length]);

  const updateTabState = (tab: Tab, newStateOrFn: any) => {
    setTabStates((prev: any) => {
      const currentTabState = prev[tab];
      const newTabState =
        typeof newStateOrFn === 'function'
          ? newStateOrFn(currentTabState)
          : newStateOrFn;
      return {
        ...prev,
        [tab]: newTabState,
      };
    });
  };
  
  const handleBotAction = async (tab: Tab, stateUpdate: any, file: File | null) => {
    const newState = { ...stateUpdate };

    if (file) {
      const imageUrl = await fileToDataURL(file);
      const { base64, mimeType } = dataURLtoBase64(imageUrl);
      const imagePayload = { image: base64, mimeType };

      // Most tabs use `initialStateFromOtherTab` which expects `EnhanceState` format
      newState.initialStateFromOtherTab = imagePayload;
    }

    updateTabState(tab, (prevState: any) => ({
      // Reset the tab to its default state first to clear any old data
      ...initialTabStates[tab as keyof typeof initialTabStates],
      // Then apply the new state from the chatbot
      ...newState,
    }));
    setActiveTab(tab);
  };

  const consumeInitialStateForTab = (tab: Tab) => {
    setTabStates(prev => {
        if (prev[tab]?.initialStateFromOtherTab) {
            const newTabState = { ...prev[tab], initialStateFromOtherTab: null };
            return { ...prev, [tab]: newTabState };
        }
        return prev;
    });
  };

  const clearTabState = (tab: Tab) => {
      setTabStates((prev: any) => ({
          ...prev,
          // @ts-ignore
          [tab]: initialTabStates[tab],
      }));
  };

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Handle pink theme class
    root.classList.toggle('theme-pink', theme === Theme.Pink);

    // Handle dark class (pink is also a dark theme)
    const isDark =
      theme === Theme.Dark ||
      theme === Theme.Pink ||
      (theme === Theme.System && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === Theme.System) {
        root.classList.toggle('dark', mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);


  const TABS_FOR_SIDEBAR = [
    Tab.QuickGenerate,
    Tab.Enhance,
    Tab.RenderAI,
    Tab.VirtualTour,
    Tab.ImageFromReference,
    Tab.FloorPlanRender,
    Tab.FloorPlanColoring,
    Tab.TechnicalDrawing,
    // Tab.Upscale4K, // Hidden in v2.5
    Tab.Veo,
    Tab.ImageLibrary,
  ];

  const TABS_FOR_WELCOME = [
    Tab.RenderAI,
    Tab.QuickGenerate,
    Tab.FloorPlanColoring,
    Tab.Veo,
    Tab.Enhance,
    Tab.VirtualTour,
    Tab.ImageFromReference,
    Tab.FloorPlanRender,
    Tab.TechnicalDrawing,
    Tab.ImageLibrary,
  ];
  
  const NEW_TABS = [Tab.Veo, Tab.TechnicalDrawing, Tab.FloorPlanColoring, Tab.FloorPlanRender, Tab.VirtualTour, Tab.RenderAI];


  const handleEnhance = (state: EnhanceState) => {
    // This function now just switches tab, the state is passed via initial state to EnhanceTab
    setTabStates((prev: any) => ({
        ...prev,
        [Tab.Enhance]: { ...initialEnhanceState, initialStateFromOtherTab: state }
    }));
    setActiveTab(Tab.Enhance);
  };

  const handleSendToTraining = (state: EnhanceState) => {
    setTabStates((prev: any) => ({
        ...prev,
        [Tab.ImageFromReference]: { ...initialTrainingState, initialStateFromOtherTab: state }
    }));
    setActiveTab(Tab.ImageFromReference);
  };

  const handleSendToTechDrawing = (state: EnhanceState) => {
    setTabStates((prev: any) => ({
        ...prev,
        [Tab.TechnicalDrawing]: { ...initialTechDrawingState, initialStateFromOtherTab: state }
    }));
    setActiveTab(Tab.TechnicalDrawing);
  };

  const handleSendToUpscale = (state: EnhanceState) => {
    if (!isActivated) {
        openActivationModal();
        return;
    }
    setTabStates((prev: any) => ({
        ...prev,
        [Tab.Upscale4K]: { ...initialUpscaleState, initialStateFromOtherTab: state }
    }));
    setActiveTab(Tab.Upscale4K);
  };

  const handleSendToVeo = (state: EnhanceState) => {
    if (!isActivated) {
        openActivationModal();
        return;
    }
    setTabStates((prev: any) => ({
        ...prev,
        [Tab.Veo]: { ...initialVeoState, initialStateFromOtherTab: state }
    }));
    setActiveTab(Tab.Veo);
  };
  
  const handleFullscreen = (images: ImageResult[], startIndex: number) => {
    setFullscreenState({ images, currentIndex: startIndex });
  };
  
  const handleCloseFullscreen = () => setFullscreenState(null);
  const handleNextFullscreen = () => {
    if (fullscreenState) {
        const nextIndex = (fullscreenState.currentIndex + 1) % fullscreenState.images.length;
        setFullscreenState({ ...fullscreenState, currentIndex: nextIndex });
    }
  };
  const handlePrevFullscreen = () => {
    if (fullscreenState) {
        const prevIndex = (fullscreenState.currentIndex - 1 + fullscreenState.images.length) % fullscreenState.images.length;
        setFullscreenState({ ...fullscreenState, currentIndex: prevIndex });
    }
  };
  
  const handleRegenerate = (info: GenerationInfo) => {
      // Restore the state of the origin tab
      updateTabState(info.originTab, info.state);
      // Switch to the origin tab
      setActiveTab(info.originTab);
  };
  
  const handleSaveFilteredImage = (newImage: ImageResult) => {
    addMedia(newImage);
  };

  const handleSendToChatbot = (image: ImageResult) => {
    const file = base64ToFile(image.base64, `image-from-view-${image.id}.jpg`, image.mimeType);
    setImageForChatbot(file);
    setChatMessages(prev => [...prev]); // Trigger chatbot to notice file
    setFullscreenState(null); // Close fullscreen view
  };

  const WelcomeModalContent = () => {
    const { t } = useTranslation();
    const features: string[] = JSON.parse(t('welcomeModal.features'));
    return (
      <>
        <p>{t('welcomeModal.greeting')}</p>
        <p className="font-semibold mt-2">{t('welcomeModal.versionIntro')}</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          {features.map((feature, index) => (
            <li key={index} dangerouslySetInnerHTML={{ __html: feature.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 dark:text-gray-200">$1</strong>') }} />
          ))}
        </ul>
        <p className="mt-4" dangerouslySetInnerHTML={{ __html: t('welcomeModal.partners').replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 dark:text-gray-200">$1</strong>') }} />
        <p className="mt-3 italic">{t('welcomeModal.support')}</p>
      </>
    );
  };
  
  const FeedbackModalContent = () => {
      const { t } = useTranslation();
      return (
        <>
            <p className="font-semibold text-lg text-gray-900 dark:text-white">{t('feedbackModal.thankYou')}</p>
            <p dangerouslySetInnerHTML={{ __html: t('feedbackModal.request').replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-800 dark:text-gray-200">$1</strong>') }} />
            <div className="mt-4 p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-800 dark:text-blue-300">{t('feedbackModal.proTipTitle')}</p>
                <p className="text-sm" dangerouslySetInnerHTML={{ __html: t('feedbackModal.proTipContent').replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5 text-xs font-mono">$1</code>') }} />
            </div>
        </>
      );
  };

  const handleTabClick = (tabKey: Tab) => {
      const isExperimental = tabKey === Tab.Upscale4K || tabKey === Tab.Veo || tabKey === Tab.FloorPlanColoring;
      if (isExperimental && !isActivated) {
          openActivationModal();
      } else {
          setActiveTab(tabKey);
      }
  };

  const handleLoginSuccess = () => {
    localStorage.setItem('sud_app_isLoggedIn', 'true');
    setIsLoggedIn(true);
    setUser({
        name: 'Dien Duy',
        email: 'dienduy.dev@example.com',
        picture: AVATAR_BASE64,
    });
  };

  const handleLogout = () => {
      localStorage.removeItem('sud_app_isLoggedIn');
      setIsLoggedIn(false);
      setUser(null);
  };

  const renderContent = () => {
    if (activeTab === Tab.Welcome) {
        return <WelcomeScreen setActiveTab={setActiveTab} TAB_ICONS={TAB_ICONS} TABS_IN_ORDER={TABS_FOR_WELCOME} />;
    }
    switch (activeTab) {
      case Tab.Enhance:
        return <EnhanceTab 
                    initialState={tabStates[Tab.Enhance].initialStateFromOtherTab} 
                    state={tabStates[Tab.Enhance]}
                    setState={(s) => updateTabState(Tab.Enhance, s)}
                    onClear={() => clearTabState(Tab.Enhance)}
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.Enhance)}
                />;
      case Tab.QuickGenerate:
        return <QuickGenerateTab 
                    state={tabStates[Tab.QuickGenerate]}
                    setState={(s) => updateTabState(Tab.QuickGenerate, s)}
                    onClear={() => clearTabState(Tab.QuickGenerate)}
                    onEnhance={handleEnhance} 
                    onFullscreen={handleFullscreen} 
                />;
      case Tab.RenderAI:
        return <RenderTab
                    initialState={tabStates[Tab.RenderAI].initialStateFromOtherTab}
                    state={tabStates[Tab.RenderAI]}
                    setState={(s) => updateTabState(Tab.RenderAI, s)}
                    onClear={() => clearTabState(Tab.RenderAI)}
                    onEnhance={handleEnhance} 
                    onFullscreen={handleFullscreen} 
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.RenderAI)}
                />;
      case Tab.FloorPlanRender:
        return <FloorPlanRenderTab 
                    state={tabStates[Tab.FloorPlanRender]}
                    setState={(s) => updateTabState(Tab.FloorPlanRender, s)}
                    onClear={() => clearTabState(Tab.FloorPlanRender)}
                    onEnhance={handleEnhance} 
                    onFullscreen={handleFullscreen} 
                />;
      case Tab.FloorPlanColoring:
        return <FloorPlanColoringTab 
                    state={tabStates[Tab.FloorPlanColoring]}
                    setState={(s) => updateTabState(Tab.FloorPlanColoring, s)}
                    onClear={() => clearTabState(Tab.FloorPlanColoring)}
                    onEnhance={handleEnhance} 
                    onFullscreen={handleFullscreen} 
                />;
      case Tab.ImageFromReference:
        return <TrainingTab 
                    initialState={tabStates[Tab.ImageFromReference].initialStateFromOtherTab}
                    state={tabStates[Tab.ImageFromReference]}
                    setState={(s) => updateTabState(Tab.ImageFromReference, s)}
                    onClear={() => clearTabState(Tab.ImageFromReference)}
                    onEnhance={handleEnhance} 
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.ImageFromReference)}
                />;
      case Tab.TechnicalDrawing:
        return <TechnicalDrawingTab 
                    initialState={tabStates[Tab.TechnicalDrawing].initialStateFromOtherTab}
                    state={tabStates[Tab.TechnicalDrawing]}
                    setState={(s) => updateTabState(Tab.TechnicalDrawing, s)}
                    onClear={() => clearTabState(Tab.TechnicalDrawing)}
                    onEnhance={handleEnhance} 
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.TechnicalDrawing)}
                />;
      case Tab.Upscale4K:
        return <Upscale4KTab 
                    initialState={tabStates[Tab.Upscale4K].initialStateFromOtherTab}
                    state={tabStates[Tab.Upscale4K]}
                    setState={(s) => updateTabState(Tab.Upscale4K, s)}
                    onClear={() => clearTabState(Tab.Upscale4K)}
                    onEnhance={handleEnhance}
                    onFullscreen={handleFullscreen}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.Upscale4K)}
                />;
      case Tab.Veo:
        return <VeoTab 
                    initialState={tabStates[Tab.Veo].initialStateFromOtherTab}
                    state={tabStates[Tab.Veo]}
                    setState={(s) => updateTabState(Tab.Veo, s)}
                    onClear={() => clearTabState(Tab.Veo)}
                    onConsumeInitialState={() => consumeInitialStateForTab(Tab.Veo)}
                />;
       case Tab.VirtualTour:
        return <VirtualTourTab 
                    state={tabStates[Tab.VirtualTour]}
                    setState={(s) => updateTabState(Tab.VirtualTour, s)}
                    onClear={() => clearTabState(Tab.VirtualTour)}
                    onEnhance={handleEnhance}
                    onFullscreen={handleFullscreen}
                />;
      case Tab.ImageLibrary:
        return <ImageLibraryTab 
                  onFullscreen={handleFullscreen}
                  onSendToEnhance={handleEnhance}
                  onSendToTraining={handleSendToTraining}
                  onSendToTechDrawing={handleSendToTechDrawing}
                  onSendToUpscale={handleSendToUpscale}
                  onSendToVeo={handleSendToVeo}
                  onRegenerate={handleRegenerate}
                />;
      default:
        return null;
    }
  };

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen font-sans bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-hidden">
        {/* Sidebar */}
        <nav className={`flex flex-col flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
            <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700 px-2">
                <AvatarIcon className="w-10 h-10 flex-shrink-0" />
                <h1 className={`text-sm font-bold text-gray-900 dark:text-white font-orbitron uppercase ml-2 transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                    {isSidebarExpanded ? t('appTitle') : ''}
                </h1>
            </div>
            <div className="flex-grow overflow-y-auto overflow-x-hidden p-2">
                 <TabButton
                    key="home"
                    label={t(Tab.Welcome)}
                    icon={TAB_ICONS[Tab.Welcome]}
                    isActive={activeTab === Tab.Welcome}
                    isExpanded={isSidebarExpanded}
                    onClick={() => setActiveTab(Tab.Welcome)}
                />
                <div className="my-2 border-t border-gray-300 dark:border-gray-600"></div>
                {TABS_FOR_SIDEBAR.map((tabKey) => (
                    <TabButton
                    key={tabKey}
                    label={t(tabKey)}
                    icon={TAB_ICONS[tabKey]}
                    isActive={activeTab === tabKey}
                    isExpanded={isSidebarExpanded}
                    onClick={() => handleTabClick(tabKey)}
                    isNew={NEW_TABS.includes(tabKey)}
                    />
                ))}
            </div>
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <button 
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                    className="w-full flex items-center justify-center p-3 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                    title={isSidebarExpanded ? 'Collapse' : 'Expand'}
                >
                    {isSidebarExpanded ? <ChevronDoubleLeftIcon className="w-6 h-6"/> : <ChevronDoubleRightIcon className="w-6 h-6"/>}
                </button>
            </div>
        </nav>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
            <Header
                user={user}
                onLogout={handleLogout}
                theme={theme} 
                setTheme={setTheme} 
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            />
            <main className="flex-grow overflow-y-auto">
                {renderContent()}
                {activeTab !== Tab.Welcome && <Footer />}
            </main>
        </div>
        
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
            <Chatbot 
                messages={chatMessages}
                setMessages={setChatMessages}
                onAction={handleBotAction}
                onOpenDonationModal={() => setIsDonationModalOpen(true)}
                initialFile={imageForChatbot}
                onInitialFileConsumed={() => setImageForChatbot(null)}
            />
            <FloatingDonateButton onClick={() => setIsDonationModalOpen(true)} />
        </div>


        <ActivationModal />

        {fullscreenState && (
            <FullscreenView 
                images={fullscreenState.images} 
                currentIndex={fullscreenState.currentIndex}
                onClose={handleCloseFullscreen}
                onNext={handleNextFullscreen}
                onPrev={handlePrevFullscreen}
                onSave={handleSaveFilteredImage}
                onSendToChatbot={handleSendToChatbot}
            />
        )}
        <ApiKeyModal 
            isOpen={isApiKeyModalOpen} 
            onClose={() => setIsApiKeyModalOpen(false)}
        />
        <DonationModal isOpen={isDonationModalOpen} onClose={() => setIsDonationModalOpen(false)} />

        <InfoModal
            isOpen={isWelcomeModalOpen}
            onClose={() => setIsWelcomeModalOpen(false)}
            title={t('welcomeModal.title')}
            showDonateButton={true}
            onOpenDonationModal={() => setIsDonationModalOpen(true)}
        >
            <WelcomeModalContent />
        </InfoModal>

        <InfoModal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
            title={t('feedbackModal.title')}
            showDonateButton={true}
            onOpenDonationModal={() => setIsDonationModalOpen(true)}
        >
            <FeedbackModalContent />
        </InfoModal>
        
    </div>
  );
};

export default App;