import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

const ConnectionStatus: React.FC = () => {
  const { isOnline } = useConnectionStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Alert variant="destructive">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Você está offline. A conexão será restaurada automaticamente quando a internet voltar.
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
};

export default ConnectionStatus;