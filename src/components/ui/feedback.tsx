import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

// Componente para exibir mensagens de erro globais
export const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [error, setError] = React.useState<Error | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    // Handler para erros não capturados
    const handleError = (event: ErrorEvent) => {
      console.error("Erro não capturado:", event.error);
      setError(event.error);
      
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado. Por favor, tente novamente ou contate o suporte.",
        variant: "destructive",
      });
      
      // Prevenir comportamento padrão do navegador
      event.preventDefault();
    };

    // Handler para rejeições de promessas não tratadas
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Promessa rejeitada não tratada:", event.reason);
      
      toast({
        title: "Erro de operação",
        description: "Uma operação falhou. Por favor, verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
      
      // Prevenir comportamento padrão do navegador
      event.preventDefault();
    };

    // Registrar handlers
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // Limpar handlers ao desmontar
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [toast]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center text-red-500 mb-4">
            <AlertCircle className="h-6 w-6 mr-2" />
            <h2 className="text-xl font-bold">Algo deu errado</h2>
          </div>
          <p className="text-gray-700 mb-4">
            Ocorreu um erro inesperado. Por favor, tente novamente ou contate o suporte técnico.
          </p>
          <div className="bg-red-50 p-3 rounded-md text-sm text-red-800 mb-4">
            {error.message || "Erro desconhecido"}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <Toaster />
    </>
  );
};

// Componente para exibir feedback de sucesso
export const SuccessFeedback: React.FC<{ 
  message: string;
  onDismiss?: () => void;
}> = ({ message, onDismiss }) => {
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
      <div className="flex">
        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
        <div className="flex-1">
          <p className="text-green-700">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-green-500 hover:text-green-700"
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
};

// Componente para exibir dicas e informações
export const InfoTip: React.FC<{ 
  message: string;
}> = ({ message }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
      <div className="flex">
        <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
        <p className="text-blue-700 text-sm">{message}</p>
      </div>
    </div>
  );
};

// Hook para mostrar feedback de carregamento
export const useLoadingFeedback = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  
  const showLoading = (message: string = "Carregando...") => {
    setIsLoading(true);
    
    // Mostrar toast de carregamento
    toast({
      title: "Carregando",
      description: message,
      duration: Infinity,
    });
    
    // Função para finalizar o carregamento
    return () => {
      // Mostrar toast de conclusão (sem usar id)
      toast({
        title: "Concluído",
        description: "Operação concluída com sucesso",
        duration: 3000,
      });
      setIsLoading(false);
    };
  };
  
  return { isLoading, showLoading };
};

// Função para mostrar feedback de confirmação
export const showConfirmation = (
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void
) => {
  // Esta é uma implementação simplificada
  // Em um caso real, você usaria um modal ou dialog
  if (window.confirm(message)) {
    onConfirm();
  } else {
    onCancel();
  }
};
