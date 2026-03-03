import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { accessApi } from "@/lib/api";
import Loader from "./Loader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireUploader?: boolean;
}

export default function ProtectedRoute({
  children,
  requireUploader = false,
}: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const location = useLocation();

  const { data: access, isLoading: isAccessLoading } = useQuery({
    queryKey: ["my-access", isSignedIn, user?.id],
    queryFn: async () => {
      if (!isSignedIn || !user) return null;
      const token = await getToken();
      if (!token) return null;
      return accessApi.me(token, user.primaryEmailAddress?.emailAddress);
    },
    enabled: isLoaded && isSignedIn && !!user,
  });

  if (!isLoaded || (isSignedIn && isAccessLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader themeName="Admin" />
      </div>
    );
  }

  if (!isSignedIn) {
    // Redirect to home if not signed in, or could redirect to a sign-in page if we had one
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requireUploader && access && !access.isUploader) {
    // If uploader is required but user is not an uploader
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
