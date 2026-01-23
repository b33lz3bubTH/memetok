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
    text: '260 30% 15%',
    background: '300 20% 98%',
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

export const MOCK_FEED_DATA: VideoPost[] = [
  {
    id: 'vid-001',
    url: '/video/1',
    title: 'Coding Hacks',
    description: 'Learn this one trick that will change your coding forever! 🚀',
    extras: {
      tags: ['#coding', '#tech', '#viral', '#developer'],
      title: 'Mind-Blowing Hack',
      thumbnail: 'https://placehold.co/400x800/1a1a2e/ffffff',
    },
    postVideos: [
      {
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      },
    ],
    stats: {
      likes: 125400,
      comments: 3240,
      shares: 8900,
    },
    author: {
      username: 'techmaster',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=techmaster',
    },
  },
  {
    id: 'vid-002',
    url: '/video/2',
    title: 'Nature Vibes',
    description: 'The most beautiful sunset you will ever see 🌅',
    extras: {
      tags: ['#nature', '#sunset', '#beautiful', '#travel'],
      title: 'Golden Hour Magic',
      thumbnail: 'https://placehold.co/400x800/2d1b69/ffffff',
    },
    postVideos: [
      {
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      },
    ],
    stats: {
      likes: 89200,
      comments: 1560,
      shares: 4300,
    },
    author: {
      username: 'naturelover',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=naturelover',
    },
  },
  {
    id: 'vid-003',
    url: '/video/3',
    title: 'Dance Challenge',
    description: 'Try this new dance challenge! Can you do it? 💃',
    extras: {
      tags: ['#dance', '#challenge', '#trending', '#fun'],
      title: 'Viral Dance Move',
      thumbnail: 'https://placehold.co/400x800/16213e/ffffff',
    },
    postVideos: [
      {
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      },
    ],
    stats: {
      likes: 256000,
      comments: 8900,
      shares: 15600,
    },
    author: {
      username: 'danceking',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=danceking',
    },
  },
  {
    id: 'vid-004',
    url: '/video/4',
    title: 'Cooking Tips',
    description: 'Restaurant secrets they dont want you to know! 🍳',
    extras: {
      tags: ['#cooking', '#food', '#recipe', '#chef'],
      title: 'Chef Secrets Revealed',
      thumbnail: 'https://placehold.co/400x800/0d7377/ffffff',
    },
    postVideos: [
      {
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      },
    ],
    stats: {
      likes: 67800,
      comments: 2100,
      shares: 3200,
    },
    author: {
      username: 'cheflife',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cheflife',
    },
  },
  {
    id: 'vid-005',
    url: '/video/5',
    title: 'Fitness Goals',
    description: 'Get shredded in 30 days with this workout! 💪',
    extras: {
      tags: ['#fitness', '#workout', '#gym', '#motivation'],
      title: '30 Day Transformation',
      thumbnail: 'https://placehold.co/400x800/212121/ffffff',
    },
    postVideos: [
      {
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      },
    ],
    stats: {
      likes: 189500,
      comments: 5600,
      shares: 12400,
    },
    author: {
      username: 'fitnessguru',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fitnessguru',
    },
  },
];

export const MOCK_COMMENTS = [
  { id: 'c1', username: 'user123', text: 'This is amazing! 🔥', likes: 234, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user123' },
  { id: 'c2', username: 'coolgirl', text: 'Tried this and it actually works!', likes: 156, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=coolgirl' },
  { id: 'c3', username: 'tech_nerd', text: 'Where can I learn more?', likes: 89, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tech_nerd' },
  { id: 'c4', username: 'happy_vibes', text: 'Love this content ❤️', likes: 312, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=happy_vibes' },
  { id: 'c5', username: 'explorer_22', text: 'Saved for later!', likes: 67, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=explorer_22' },
  { id: 'c6', username: 'nightowl', text: 'Cant stop watching this 😂', likes: 445, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nightowl' },
];

export const APP_CONFIG = {
  appName: 'TikVibe',
  version: '1.0.0',
  maxVideosToLoad: 5,
  intersectionThreshold: 0.5,
  animationDuration: 0.3,
};
