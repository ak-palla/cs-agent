/**
 * Zoom Fix Component
 * Helps detect and fix zoom issues in the browser
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ZoomIn, ZoomOut, Monitor } from 'lucide-react';

export default function ZoomFix() {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const detectZoom = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const screenWidth = screen.width;
      const windowWidth = window.innerWidth;
      
      // Calculate approximate zoom level
      const zoom = Math.round((screenWidth / windowWidth) * 100);
      setZoomLevel(zoom);
      
      // Show warning if zoom is not 100%
      setShowWarning(zoom !== 100);
    };

    detectZoom();
    window.addEventListener('resize', detectZoom);
    
    return () => window.removeEventListener('resize', detectZoom);
  }, []);

  const resetZoom = () => {
    // Try to reset zoom programmatically (limited browser support)
    document.body.style.zoom = '1';
    document.body.style.transform = 'scale(1)';
    
    // Show instructions
    alert('To reset zoom:\n• Press Ctrl + 0 (zero)\n• Or go to browser settings and set zoom to 100%');
  };

  if (!showWarning) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg max-w-sm">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800">Browser Zoom Detected</h3>
          <p className="text-xs text-yellow-700 mt-1">
            Current zoom: {zoomLevel}%. For best experience, use 100% zoom.
          </p>
          <div className="mt-3 flex items-center space-x-2">
            <button
              onClick={resetZoom}
              className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700 transition-colors flex items-center space-x-1"
            >
              <Monitor className="w-3 h-3" />
              <span>Fix Zoom</span>
            </button>
            <button
              onClick={() => setShowWarning(false)}
              className="text-xs text-yellow-600 hover:text-yellow-800"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-yellow-600 mt-2">
            Quick fix: Press <kbd className="bg-yellow-200 px-1 rounded">Ctrl + 0</kbd>
          </p>
        </div>
      </div>
    </div>
  );
}