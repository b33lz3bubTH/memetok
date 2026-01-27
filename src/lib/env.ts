export const env = {
  memetokApiBaseUrl: (import.meta.env.VITE_MEMETOK_API_BASE_URL as string | undefined) ?? 'http://localhost:8000',
  streamlanderBaseUrl: (import.meta.env.VITE_STREAMLANDER_BASE_URL as string | undefined) ?? 'http://localhost:8080',
  clerkPublishableKey: (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? '',
};

