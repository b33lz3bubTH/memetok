import { useEffect, useState } from "react";
import VideoFeed from "@/components/VideoFeed";
import { useAuth } from "@clerk/clerk-react";
import { accessApi } from "@/lib/api";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { getToken, isSignedIn } = useAuth();
  const [isUploader, setIsUploader] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn) {
      getToken()
        .then((token) => {
          if (token) return accessApi.me(token);
          return null;
        })
        .then((res) => {
          if (res && res.isUploader) {
            setIsUploader(true);
          }
        })
        .catch(console.error);
    }
  }, [isSignedIn, getToken]);

  return (
    <div className="relative w-full h-screen">
      <VideoFeed />
      {isUploader && (
        <button
          onClick={() => navigate("/upload")}
          className="fixed bottom-24 right-6 z-50 bg-pink-500 hover:bg-pink-600 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center animate-fade-in"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Index;
