import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { LogOut, User, Settings } from 'lucide-react';

const UserProfile = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="fixed top-4 right-4 z-50" ref={menuRef}>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="glass px-4 py-2 rounded-full text-sm text-white/90 font-medium hover:opacity-90 transition-opacity">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="glass px-3 py-2 rounded-full flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || 'Profile'}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            <span className="text-white/90 text-sm font-medium max-w-[120px] truncate">
              {user?.fullName || user?.username || 'User'}
            </span>
          </button>

          {isOpen && (
            <div className="absolute top-full right-0 mt-2 glass rounded-lg shadow-lg min-w-[200px] overflow-hidden">
              <div className="p-2">
                <div className="px-3 py-2 text-sm text-white/70 border-b border-white/10">
                  <div className="font-medium text-white">{user?.fullName || user?.username}</div>
                  <div className="text-xs text-white/50 truncate">{user?.primaryEmailAddress?.emailAddress}</div>
                </div>
                
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/user');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 rounded flex items-center gap-2 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 rounded flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                
                <button
                  onClick={() => {
                    setIsOpen(false);
                    signOut();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/10 rounded flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
};

export default UserProfile;
