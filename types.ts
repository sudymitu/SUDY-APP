

// FIX: Removed a self-referential import of `Tab` that was causing a declaration conflict.
// import { Tab } from './types';

export enum Tab {
  Welcome = 'Welcome',
  Enhance = 'Enhance',
  QuickGenerate = 'QuickGenerate',
  RenderAI = 'RenderAI',
  FloorPlanRender = 'FloorPlanRender',
  FloorPlanColoring = 'FloorPlanColoring',
  ImageFromReference = 'ImageFromReference',
  TechnicalDrawing = 'TechnicalDrawing',
  Upscale4K = 'Upscale4K',
  Veo = 'Veo',
  VirtualTour = 'VirtualTour',
  ImageLibrary = 'ImageLibrary',
}

export interface GenerationInfo {
  originTab: Tab;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
}

export interface ImageResult {
  id: string;
  base64: string;
  mimeType: string;
  generationInfo?: GenerationInfo;
  isLineArt?: boolean;
}

export interface VideoResult {
    id: string;
    url: string; // This will be a blob URL
    posterBase64: string; // Thumbnail
    generationInfo?: GenerationInfo;
}

export interface EnhanceState {
  image: string;
  mimeType: string;
}

export enum Theme {
    Light = 'light',
    Dark = 'dark',
    System = 'system',
    Pink = 'pink',
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  imagePreview?: string;
  imageFile?: File;
  botAction?: {
    tab: Tab;
    prompt?: string;
    buttonText: string;
  };
  suggestedPrompt?: string;
}

export interface LoraFileContent {
  refImages: { base64: string; mimeType: string; name: string }[];
  stylePrompt: string;
  featureType: 'geometry' | 'material';
  featureImage: string; // base64
}