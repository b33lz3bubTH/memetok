import { configureStore } from '@reduxjs/toolkit';
import themeReducer from './slices/themeSlice';
import feedReducer from './slices/feedSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    feed: feedReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
