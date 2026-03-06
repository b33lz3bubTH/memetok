import React, { useState, useEffect } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface VideoSeekBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isActive: boolean;
  isPaused: boolean;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const VideoSeekBar = ({ currentTime, duration, onSeek, isActive, isPaused }: VideoSeekBarProps) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [localValue, setLocalValue] = useState([0]);

  // Update local value when currentTime changes, but not while scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setLocalValue([currentTime]);
    }
  }, [currentTime, isScrubbing]);

  const handleValueChange = (values: number[]) => {
    setIsScrubbing(true);
    setLocalValue(values);
  };

  const handleValueCommit = (values: number[]) => {
    onSeek(values[0]);
    setIsScrubbing(false);
  };

  const handleSliderClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  const isVisible = isPaused || isScrubbing;

  return (
    <div 
      className={cn(
        "relative w-full z-[60] transition-all duration-300 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onMouseDown={handleSliderClick}
      onClick={handleSliderClick}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Time Labels */}
      <div className="flex justify-between items-center px-4 mb-1 text-white font-medium">
        <span className="text-[11px] tabular-nums drop-shadow-md">
          {formatTime(localValue[0])}
        </span>
        <span className="text-[11px] tabular-nums opacity-80 drop-shadow-md">
          {formatTime(duration)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-4 group"
          value={localValue}
          max={duration || 100}
          step={0.1}
          onValueChange={handleValueChange}
          onValueCommit={handleValueCommit}
        >
          <Slider.Track className="bg-white/20 relative grow h-1 rounded-full overflow-hidden">
            <Slider.Range className="absolute bg-white h-full" />
          </Slider.Track>
          
          <Slider.Thumb
            className="block w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-white/20 focus:outline-none transition-transform duration-200 hover:scale-125 focus:scale-125"
            aria-label="Seek Video"
          />
        </Slider.Root>
      </div>
    </div>
  );
};

export default VideoSeekBar;
