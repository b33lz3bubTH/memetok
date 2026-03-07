export interface AdConfig {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  isAd: true;
}

export const AD_LIST: AdConfig[] = [
  {
    id: 'ad-1',
    youtubeId: 'dQw4w9WgXcQ',
    title: 'Unlimited Fun with Streamlander',
    description: 'Experience the best streaming quality today!',
    isAd: true,
  },
  {
    id: 'ad-2',
    youtubeId: '9bZkp7q19f0',
    title: 'MemeTok Premium',
    description: 'Get ad-free experience and exclusive content.',
    isAd: true,
  },
  {
    id: 'ad-3',
    youtubeId: 'jNQXAC9IVRw',
    title: 'Join our Community',
    description: 'Connect with millions of creators worldwide.',
    isAd: true,
  }
];

export const AD_INTERVAL = 5;

/**
 * Generator that yields ads in a round-robin fashion infinitely
 */
export function* adGenerator() {
  let index = 0;
  while (true) {
    yield AD_LIST[index % AD_LIST.length];
    index++;
  }
}
