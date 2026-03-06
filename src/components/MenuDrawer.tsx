import { useEffect, useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeMenu } from "@/store/slices/uiSlice";
import { X, ChevronRight, Home, TrendingUp, Compass, Info, Shield, Mail, Layers, FileText, ChevronDown } from "lucide-react";
import gsap from "gsap";
import { APP_CONFIG } from "@/config/appConfig";
import { useState } from "react";

const CATEGORIES = [
  {
    name: "Entertainment",
    sub: ["Movies", "Music", "Gaming", "Comedy"],
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

const MenuDrawer = () => {
  const dispatch = useAppDispatch();
  const { isMenuOpen } = useAppSelector((state) => state.ui);
  const { currentTheme } = useAppSelector((state) => state.theme);
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [activeStaticPage, setActiveStaticPage] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (isMenuOpen) {
      if (backdropRef.current) {
        gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      }
      if (drawerRef.current) {
        gsap.fromTo(drawerRef.current, { x: "-100%" }, { x: "0%", duration: 0.4, ease: "power3.out" });
      }
    }
  }, [isMenuOpen]);

  const handleClose = useCallback(() => {
    if (backdropRef.current) gsap.to(backdropRef.current, { opacity: 0, duration: 0.2, ease: "power2.in" });
    if (drawerRef.current) {
      gsap.to(drawerRef.current, {
        x: "-100%",
        duration: 0.3,
        ease: "power3.in",
        onComplete: () => {
          dispatch(closeMenu());
          setActiveStaticPage(null);
        },
      });
    }
  }, [dispatch]);

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const renderStaticPage = (key: keyof typeof APP_CONFIG.staticPages) => {
    const page = APP_CONFIG.staticPages[key] as any;
    return (
      <div className="absolute inset-0 bg-background z-20 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-4 flex items-center gap-3 border-b border-white/10">
          <button onClick={() => setActiveStaticPage(null)} className="p-1.5 rounded-full hover:bg-white/10">
            <ChevronRight className="w-5 h-5 text-white/70 rotate-180" />
          </button>
          <h2 className="text-white font-bold">{page.title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6 hide-scrollbar">
          <p className="text-white/60 text-sm leading-relaxed">{page.content}</p>
          {page.sections?.map((section: any, idx: number) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-white font-semibold text-sm">{section.title}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{section.text}</p>
            </div>
          ))}
          {key === 'contact' && (
            <div className="bg-white/5 p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-3 text-white/70">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-xs">{page.email}</span>
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <Info className="w-4 h-4 text-primary" />
                <span className="text-xs">{page.address}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isMenuOpen) return null;

  return (
    <>
      <div ref={backdropRef} className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm" onClick={handleClose} />
      <div ref={drawerRef} className="fixed top-0 left-0 bottom-0 w-[280px] bg-background z-[101] flex flex-col border-r border-white/10 overflow-hidden">
        
        {/* Active Static Page Layer */}
        {activeStaticPage && renderStaticPage(activeStaticPage as any)}

        {/* Normal Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/10 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">MemeTok</span>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-2 hide-scrollbar">
          {/* Main Links */}
          <div className="px-2 space-y-1 mb-4">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-medium">
              <Home className="w-5 h-5" />
              <span>For You</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/70 hover:bg-white/5 transition-all">
              <TrendingUp className="w-5 h-5" />
              <span>Trending</span>
            </button>
          </div>

          {/* Categories - Collapsable by default */}
          <div className="px-4 mb-4">
            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[2px] mb-2 px-1">Categories</h3>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => {
                const isExpanded = expandedCategories.includes(cat.name);
                return (
                  <div key={cat.name} className="overflow-hidden">
                    <button 
                      onClick={() => toggleCategory(cat.name)}
                      className="w-full flex items-center justify-between px-2 py-2 rounded-lg text-white/80 hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Layers className={`w-4 h-4 transition-colors ${isExpanded ? 'text-primary' : 'text-white/20'}`} />
                        <span className="text-sm font-medium">{cat.name}</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-white/20 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`pl-9 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-40 opacity-100 py-1' : 'max-h-0 opacity-0'}`}>
                      {cat.sub.map(sub => (
                        <button key={sub} className="w-full text-left py-1.5 text-xs text-white/40 hover:text-white/80">
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Static Pages */}
          <div className="px-4 mb-4">
            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[2px] mb-2 px-1">Support</h3>
            <div className="grid grid-cols-1 gap-1">
              <button onClick={() => setActiveStaticPage('about')} className="flex items-center gap-3 px-2 py-2 rounded-lg text-white/70 hover:bg-white/5"><Info className="w-4 h-4" /> <span className="text-sm">About</span></button>
              <button onClick={() => setActiveStaticPage('privacy')} className="flex items-center gap-3 px-2 py-2 rounded-lg text-white/70 hover:bg-white/5"><Shield className="w-4 h-4" /> <span className="text-sm">Privacy</span></button>
              <button onClick={() => setActiveStaticPage('contact')} className="flex items-center gap-3 px-2 py-2 rounded-lg text-white/70 hover:bg-white/5"><Mail className="w-4 h-4" /> <span className="text-sm">Contact</span></button>
              <button onClick={() => setActiveStaticPage('dmca')} className="flex items-center gap-3 px-2 py-2 rounded-lg text-white/70 hover:bg-white/5"><FileText className="w-4 h-4" /> <span className="text-sm">DMCA</span></button>
            </div>
          </div>
        </div>

        {/* Theme Footer */}
        <div className="p-4 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between px-2 py-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/30 font-bold uppercase">Theme</span>
            <span className="text-[10px] text-primary font-black uppercase tracking-widest">{currentTheme.name}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default MenuDrawer;
