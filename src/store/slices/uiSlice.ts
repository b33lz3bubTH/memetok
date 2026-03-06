import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  isCommentDrawerOpen: boolean;
  activeVideoId: string | null;
  isMuted: boolean;
  isPaused: boolean;
  showPlayIcon: boolean;
  isMenuOpen: boolean;
}

const initialState: UIState = {
  isCommentDrawerOpen: false,
  activeVideoId: null,
  isMuted: true,
  isPaused: false,
  showPlayIcon: false,
  isMenuOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openCommentDrawer: (state, action: PayloadAction<string>) => {
      state.isCommentDrawerOpen = true;
      state.activeVideoId = action.payload;
    },
    closeCommentDrawer: (state) => {
      state.isCommentDrawerOpen = false;
    },
    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
    },
    setMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload;
    },
    togglePause: (state) => {
      state.isPaused = !state.isPaused;
    },
    setPaused: (state, action: PayloadAction<boolean>) => {
      state.isPaused = action.payload;
    },
    setShowPlayIcon: (state, action: PayloadAction<boolean>) => {
      state.showPlayIcon = action.payload;
    },
    setActiveVideoId: (state, action: PayloadAction<string | null>) => {
      state.activeVideoId = action.payload;
    },
    openMenu: (state) => {
      state.isMenuOpen = true;
    },
    closeMenu: (state) => {
      state.isMenuOpen = false;
    },
    toggleMenu: (state) => {
      state.isMenuOpen = !state.isMenuOpen;
    },
  },
});

export const { 
  openCommentDrawer, 
  closeCommentDrawer, 
  toggleMute, 
  setMuted,
  togglePause, 
  setPaused,
  setShowPlayIcon,
  setActiveVideoId,
  openMenu,
  closeMenu,
  toggleMenu
} = uiSlice.actions;
export default uiSlice.reducer;
