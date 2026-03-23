import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthProvider';
import { Zap } from 'lucide-react';

/**
 * AuthCallback handles the OAuth redirect from Emergent Auth
 * It extracts session_id from URL hash and exchanges it for a session
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleGoogleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      // Extract session_id from URL hash
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        console.error('No session_id found in URL');
        navigate('/Login', { replace: true });
        return;
      }

      const sessionId = sessionIdMatch[1];

      try {
        await handleGoogleCallback(sessionId);
        // Redirect to dashboard with user data
        navigate('/Dashboard', { replace: true });
      } catch (error) {
        console.error('OAuth callback failed:', error);
        navigate('/Login', { replace: true });
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#ff5a1f' }}>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-2xl">LeadFlow AI</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-white">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Completing sign in...</span>
        </div>
      </div>
    </div>
  );
}
