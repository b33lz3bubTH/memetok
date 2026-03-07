import { useEffect, useRef, useState } from "react";
import { AdConfig } from "@/config/adConfig";
import { ExternalLink, Volume2, VolumeX } from "lucide-react";
import { useAppSelector } from "@/store/hooks";

interface AdCardProps {
  ad: AdConfig;
  isActive: boolean;
  dataIndex?: number;
}

const AdCard = ({ ad, isActive, dataIndex }: AdCardProps) => {
  const { isMuted } = useAppSelector((state) => state.ui);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [timeLeft, setTimeLeft] = useState(30);

  // Timer logic for countdown and auto-advance
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActive && isLoaded && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isActive && isLoaded && timeLeft === 0) {
      // Auto-advance to next video when ad finishes
      const container = document.querySelector('.video-feed-container');
      if (container) {
        const nextIndex = (dataIndex || 0) + 1;
        const nextElement = container.querySelector(`[data-index="${nextIndex}"]`);
        if (nextElement) {
          nextElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    return () => clearInterval(timer);
  }, [isActive, isLoaded, timeLeft, dataIndex]);

  // Construct YouTube URL
  const youtubeUrl = `https://www.youtube.com/embed/${ad.youtubeId}?autoplay=${isActive ? 1 : 0}&controls=0&modestbranding=1&rel=0&iv_load_policy=3&mute=${isMuted ? 1 : 0}&loop=1&playlist=${ad.youtubeId}&enablejsapi=1`;

  return (
    <div className="video-card bg-black" data-index={dataIndex}>
      {/* Media Layer */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center">
        {!isLoaded && (
          <div className="absolute inset-0 bg-black animate-pulse" />
        )}
        <iframe
          ref={iframeRef}
          src={youtubeUrl}
          className={`w-full h-full transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'} pointer-events-none scale-[1.3]`}
          allow="autoplay; encrypted-media"
          onLoad={() => setIsLoaded(true)}
          title={ad.title}
        />
        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />
      </div>

      {/* Timer Overlay - Top Right */}
      {isLoaded && (
        <div className="absolute top-20 right-4 z-40">
           <div className="glass px-4 py-2 rounded-full border-white/20 flex items-center gap-2 shadow-2xl backdrop-blur-3xl animate-fade-in">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ad ends in</span>
              <span className="text-sm font-black text-theme-primary drop-shadow-[0_0_8px_rgba(var(--theme-primary),0.5)]">
                {timeLeft}s
              </span>
           </div>
        </div>
      )}

      {/* Mute Control - Only functional button allowed */}
      <div className="absolute bottom-24 right-3 z-30">
        <button 
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            // Mute logic is handled globally in VideoFeed, 
            // but we show the state here for UI consistency
          }}
        >
          <div className="action-btn-icon bg-black/20 backdrop-blur-md border border-white/10 group">
              {isMuted ? (
                <VolumeX className="text-white/80 group-hover:text-white" />
              ) : (
                <Volume2 className="text-white/80 group-hover:text-white" />
              )}
          </div>
        </button>
      </div>

      {/* Content Overlay - Native TikTok Aesthetic */}
      <div className="absolute bottom-0 left-0 right-16 z-20 p-4 pb-8 w-full text-left">
        <div className="relative z-10">
            {/* CTA Button - Refined, high-gloss TikTok style */}
            <div className="mb-4 w-60">
                <button className="bg-[#FE2C55] text-white font-bold py-2.5 px-6 rounded-sm flex items-center justify-between gap-2 text-xs transition-all shadow-xl active:scale-[0.98] group">
                    <span className="uppercase tracking-wider">Learn More</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            {/* Username/Branding Row */}
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-white font-bold text-[15px] drop-shadow-md">
                    @{ad.title.toLowerCase().replace(/\s+/g, '')}
                </span>
                <span className="bg-white/10 backdrop-blur-xl px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold text-white/80 border border-white/10 uppercase tracking-tighter">
                    Sponsored
                </span>
            </div>

            {/* Description - Expandable 'Show More' logic */}
            <div className="mb-2 relative group/desc">
              <div 
                className={`text-white/90 text-sm leading-[1.3] drop-shadow-md font-normal transition-all duration-300 ease-in-out scrollbar-none
                  ${isExpanded ? 'max-h-[180px] overflow-y-auto pb-4' : 'line-clamp-2 overflow-hidden'}`}
              >
                {ad.description}
              </div>
              {ad.description.length > 80 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="text-white font-bold text-[10px] uppercase tracking-wider mt-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-[2px] border border-white/10 hover:bg-black/60 transition-colors"
                >
                  {isExpanded ? 'Collapse' : 'more'}
                </button>
              )}
            </div>
            
            {/* Native Tags */}
            <div className="flex flex-wrap gap-2 opacity-90 scale-90 origin-left">
                <span className="tag-pill bg-white/10 text-white border-none">#trending</span>
                <span className="tag-pill bg-white/10 text-white border-none">#sponsored</span>
            </div>
        </div>
      </div>

      {/* Interaction Blocker */}
      <div className="absolute inset-0 z-10 cursor-default" />
    </div>
  );
};

export default AdCard;
