import { APP_CONFIG } from '@/config/appConfig';
import { useEffect, useState } from 'react';

interface LoaderProps {
  themeName: string;
}

const Loader = ({ themeName }: LoaderProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 20;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loader-container">
      <div className="flex flex-col items-center gap-6">
        {/* Logo / Spinner */}
        <div className="relative">
          <div className="loader-spinner" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="gradient-text text-2xl font-bold">T</span>
          </div>
        </div>

        {/* App Name */}
        <h1 className="gradient-text text-3xl font-bold tracking-tight">
          {APP_CONFIG.appName}
        </h1>

        {/* Progress Bar */}
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: 'var(--theme-gradient)',
            }}
          />
        </div>

        {/* Theme Name */}
        <p className="text-muted-foreground text-sm">
          Loading {themeName} theme...
        </p>
      </div>
    </div>
  );
};

export default Loader;
