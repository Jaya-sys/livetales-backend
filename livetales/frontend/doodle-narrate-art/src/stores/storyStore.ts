import { create } from 'zustand';

export interface StoryPage {
  text: string;
  imageUrl: string | null;
  narrationUrl: string | null;
  videoUrl: string | null;
  pageNumber: number;
}

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

interface StoryState {
  isRecording: boolean;
  isTaliSpeaking: boolean;
  currentPage: number;
  totalPages: number;
  storyPages: StoryPage[];
  isStoryComplete: boolean;
  canvasStrokes: Stroke[];
  selectedColor: string;
  brushSize: number;
  showCompleteModal: boolean;
  wsStatus: WsStatus;
  taliText: string;
  videoStatus: string;
  videoMessage: string;
  storyNarrationUrl: string | null;
  storyVideoUrl: string | null;
  isGeneratingStory: boolean;
  generatingPage: number | null;

  setRecording: (v: boolean) => void;
  setTaliSpeaking: (v: boolean) => void;
  setCurrentPage: (p: number) => void;
  setStoryComplete: (v: boolean) => void;
  setSelectedColor: (c: string) => void;
  setBrushSize: (s: number) => void;
  addStroke: (s: Stroke) => void;
  undoStroke: () => void;
  clearStrokes: () => void;
  setShowCompleteModal: (v: boolean) => void;
  setWsStatus: (s: WsStatus) => void;
  setTaliText: (t: string) => void;
  addStoryText: (pageNumber: number, text: string) => void;
}

const defaultPages: StoryPage[] = Array.from({ length: 6 }, (_, i) => ({
  text: '',
  imageUrl: null,
  narrationUrl: null,
  videoUrl: null,
  pageNumber: i + 1,
}));

export const useStoryStore = create<StoryState>((set) => ({
  isRecording: false,
  isTaliSpeaking: false,
  currentPage: 1,
  totalPages: 6,
  storyPages: defaultPages,
  isStoryComplete: false,
  canvasStrokes: [],
  selectedColor: '#1E1B4B',
  brushSize: 4,
  showCompleteModal: false,
  wsStatus: 'disconnected',
  taliText: '',
  videoStatus: '',
  videoMessage: '',
  storyNarrationUrl: null,
  storyVideoUrl: null,
  isGeneratingStory: false,
  generatingPage: null,

  setRecording: (v) => set({ isRecording: v }),
  setTaliSpeaking: (v) => set({ isTaliSpeaking: v }),
  setCurrentPage: (p) => set({ currentPage: p }),
  setStoryComplete: (v) => set({ isStoryComplete: v, showCompleteModal: v }),
  setSelectedColor: (c) => set({ selectedColor: c }),
  setBrushSize: (s) => set({ brushSize: s }),
  addStroke: (s) => set((state) => ({ canvasStrokes: [...state.canvasStrokes, s] })),
  undoStroke: () => set((state) => ({ canvasStrokes: state.canvasStrokes.slice(0, -1) })),
  clearStrokes: () => set({ canvasStrokes: [] }),
  setShowCompleteModal: (v) => set({ showCompleteModal: v }),
  setWsStatus: (s) => set({ wsStatus: s }),
  setTaliText: (t) => set({ taliText: t }),
  addStoryText: (pageNumber, text) =>
    set((state) => ({
      storyPages: state.storyPages.map((p) =>
        p.pageNumber === pageNumber ? { ...p, text: p.text + text } : p
      ),
    })),
}));
