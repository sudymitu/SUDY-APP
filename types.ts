


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