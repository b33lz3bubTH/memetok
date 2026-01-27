// Central Configuration File
// All app data, themes, and mock content

export interface ThemePalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  text: string;
  background: string;
  accent: string;
  gradient: string;
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'neon-cyberpunk',
    name: 'Neon Cyberpunk',
    primary: '280 100% 60%',
    secondary: '180 100% 50%',
    text: '0 0% 100%',
    background: '260 30% 6%',
    accent: '330 100% 60%',
    gradient: 'linear-gradient(135deg, hsl(280 100% 60%), hsl(330 100% 60%))',
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    primary: '340 80% 75%',
    secondary: '200 80% 75%',
    text: '0 0% 95%',
    background: '300 20% 12%',
    accent: '280 70% 70%',
    gradient: 'linear-gradient(135deg, hsl(340 80% 75%), hsl(200 80% 75%))',
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    primary: '210 100% 60%',
    secondary: '0 0% 40%',
    text: '0 0% 95%',
    background: '0 0% 7%',
    accent: '40 100% 50%',
    gradient: 'linear-gradient(135deg, hsl(210 100% 60%), hsl(40 100% 50%))',
  },
  {
    id: 'sunset',
    name: 'Sunset Vibes',
    primary: '25 100% 55%',
    secondary: '350 90% 60%',
    text: '0 0% 100%',
    background: '20 30% 8%',
    accent: '45 100% 60%',
    gradient: 'linear-gradient(135deg, hsl(25 100% 55%), hsl(350 90% 60%))',
  },
  {
    id: 'ocean',
    name: 'Ocean Depths',
    primary: '190 100% 45%',
    secondary: '220 80% 50%',
    text: '0 0% 100%',
    background: '210 40% 8%',
    accent: '160 100% 45%',
    gradient: 'linear-gradient(135deg, hsl(190 100% 45%), hsl(160 100% 45%))',
  },
];

export interface VideoPost {
  id: string;
  mediaId?: string;
  mediaType?: 'video' | 'image';
  url: string;
  title: string;
  description: string;
  extras: {
    tags: string[];
    title: string;
    thumbnail: string;
  };
  postVideos: {
    videoUrl: string;
  }[];
  stats: {
    likes: number;
    comments: number;
    shares: number;
  };
  author: {
    username: string;
    avatar: string;
  };
}

export const APP_CONFIG = {
  appName: 'TikVibe',
  version: '1.0.0',
  maxVideosToLoad: 5,
  intersectionThreshold: 0.5,
  animationDuration: 0.3,
};
