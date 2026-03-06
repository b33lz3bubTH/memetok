import React, { useState, useEffect, useRef } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface VideoSeekBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isActive: boolean;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const VideoSeekBar = ({ currentTime, duration, onSeek, isActive }: VideoSeekBarProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [localValue, setLocalValue] = useState([0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update local value when currentTime changes, but not while scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setLocalValue([currentTime]);
    }
  }, [currentTime, isScrubbing]);

  const handleValueChange = (values: number[]) => {
    setIsScrubbing(true);
    setLocalValue(values);
    if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleValueCommit = (values: number[]) => {
    onSeek(values[0]);
    setIsScrubbing(false);
    
    // Auto-hide after scrubbing (like Reels)
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 1500);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHovering(true);
    if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isScrubbing) {
       setIsHovering(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsHovering(true);
    if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleSliderClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute bottom-0 left-0 right-0 z-[60] px-4 transition-all duration-300 ease-in-out cursor-pointer",
        (isHovering || isScrubbing) ? "h-16 pt-6 pb-4" : "h-1.5 pb-0"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onMouseDown={handleSliderClick}
      onClick={handleSliderClick}
    >
      {/* Time Labels Backdrop (Subtle Gradient for readability) */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none transition-opacity duration-500",
          (isHovering || isScrubbing) ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Time Labels */}
      <div 
        className={cn(
          "relative z-10 flex justify-between items-center px-1 mb-2 text-white font-medium transition-all duration-300 pointer-events-none",
          (isHovering || isScrubbing) ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-2"
        )}
      >
        <span className="text-[11px] tabular-nums drop-shadow-md">
          {formatTime(localValue[0])}
        </span>
        <span className="text-[11px] tabular-nums opacity-80 drop-shadow-md">
          {formatTime(duration)}
        </span>
      </div>

      {/* Progress Bar Container */}
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-2 group"
        value={localValue}
        max={duration || 100}
        step={0.1}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
      >
        <Slider.Track className={cn(
            "bg-white/20 relative grow h-0.5 rounded-full overflow-hidden transition-all duration-300",
            (isHovering || isScrubbing) ? "h-1.5" : "h-0.5"
        )}>
          <Slider.Range className="absolute bg-white h-full" />
        </Slider.Track>
        
        {/* Thumb - only visible when interaction happens */}
        <Slider.Thumb
          className={cn(
            "block w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-white/20 focus:outline-none transition-transform duration-200 hover:scale-125 focus:scale-125",
            (isHovering || isScrubbing) ? "scale-100 opacity-100" : "scale-0 opacity-0"
          )}
          aria-label="Seek Video"
        />
      </Slider.Root>
      
      {/* Visual Feedback Line at very bottom when not interacting */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-[2px] bg-white transform origin-left transition-all duration-300 ease-out z-20",
          (isHovering || isScrubbing) ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
        )}
        style={{ 
          width: `${(currentTime / duration) * 100}%`,
          background: 'var(--theme-gradient)'
        }}
      />
    </div>
  );
};

export default VideoSeekBar;
