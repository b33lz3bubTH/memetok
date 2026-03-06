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

export const CATEGORIES = [
  {
    name: "Entertainment",
    sub: ["Movies", "Music", "Gaming", "v8"],
  },
  {
    name: "Lifestyle",
    sub: ["Fashion", "Food", "Travel", "Fitness"],
  },
  {
    name: "Technology",
    sub: ["Coding", "Gadgets", "AI", "Blockchain"],
  },
];

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
  likedByUser?: boolean;
  savedByUser?: boolean;
  media?: Array<{ type: 'video' | 'image'; id: string }>;
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
  appName: 'Memetok - New Media Libs',
  version: '2.0.0',
  maxVideosToLoad: 5,
  intersectionThreshold: 0.5,
  animationDuration: 0.3,
  initialPostsToFetch: 3,
  postsPerPage: 3,
  staticPages: {
    about: {
      title: "About MemeTok",
      subtitle: "The future of micro-video entertainment.",
      content: "MemeTok is a cutting-edge short-form video platform designed for the next generation of creators. We combine high-performance streaming with a premium, themeable user interface to provide the best browsing experience on any device.",
      sections: [
        {
          title: "Our Mission",
          text: "To empower creators with professional-grade tools and provide users with a clean, distraction-free environment to discover the world's best short-form content."
        },
        {
          title: "The Technology",
          text: "Built on a modern stack including React, Vite, and GSAP, MemeTok offers lightning-fast performance, smooth animations, and a seamless mobile-first experience."
        }
      ]
    },
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "March 2026",
      content: "Your privacy is our priority. This policy outlines how we handle your data and ensure your security while using MemeTok.",
      sections: [
        {
          title: "Data Collection",
          text: "We collect minimal data necessary for core functionality: profile information, engagement metrics (to improve your feed), and technical device logs for performance optimization."
        },
        {
          title: "Data Sharing",
          text: "MemeTok does not sell your personal information. We only share data with essential service providers like authentication systems and content delivery networks."
        }
      ]
    },
    dmca: {
      title: "DMCA Policy",
      content: "MemeTok respects intellectual property rights. If you believe your copyrighted work has been infringed, please follow our notification procedure.",
      sections: [
        {
          title: "Filing a Notice",
          text: "All notices must include: an electronic signature of the copyright owner, a description of the copyrighted work, and the specific URL where the material is located."
        },
        {
          title: "Counter Notifications",
          text: "If you believe your content was removed in error, you may file a counter-notice providing your information and why the removal was a mistake."
        }
      ]
    },
    contact: {
      title: "Contact Us",
      content: "Have questions or feedback? We'd love to hear from you. Our support team is available 24/7.",
      email: "support@memetok.io",
      address: "123 Innovation Way, Tech Tower, San Francisco, CA",
      socials: [
        { platform: "Twitter", handle: "@memetok_io" },
        { platform: "Instagram", handle: "@memetok_official" }
      ]
    }
  }
};
