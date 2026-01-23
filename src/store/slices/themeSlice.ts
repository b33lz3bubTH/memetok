import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { THEME_PALETTES, ThemePalette } from '@/config/appConfig';

interface ThemeState {
  currentTheme: ThemePalette;
  isInitialized: boolean;
}

const getRandomTheme = (): ThemePalette => {
  const randomIndex = Math.floor(Math.random() * THEME_PALETTES.length);
  return THEME_PALETTES[randomIndex];
};

const initialState: ThemeState = {
  currentTheme: getRandomTheme(),
  isInitialized: false,
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    initializeTheme: (state) => {
      if (!state.isInitialized) {
        state.currentTheme = getRandomTheme();
        state.isInitialized = true;
      }
    },
    setTheme: (state, action: PayloadAction<ThemePalette>) => {
      state.currentTheme = action.payload;
    },
  },
});

export const { initializeTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
