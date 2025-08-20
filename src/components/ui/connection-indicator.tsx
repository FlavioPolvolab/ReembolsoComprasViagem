import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface ConnectionIndicatorProps {
  onRetry?: () => void;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ onRetry }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineAlert(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-hide alert after 5 seconds when back online
    if (isOnline && showOfflineAlert) {
      const timer = setTimeout(() => setShowOfflineAlert(false), 5000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, showOfflineAlert]);

  if (!showOfflineAlert && isOnline) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Alert variant={isOnline ? "default" : "destructive"}>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          
          <div className="flex-1">
            <AlertDescription>
              {isOnline ? (
                "Conexão restaurada"
              ) : (
                "Sem conexão com a internet"
              )}
            </AlertDescription>
          </div>

          {!isOnline && onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="ml-2"
            >
              Tentar novamente
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
};

export default ConnectionIndicator;