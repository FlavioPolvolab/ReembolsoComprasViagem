import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface NovoPedidoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const NovoPedido: React.FC<NovoPedidoProps> = ({ open, onOpenChange, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const [items, setItems] = useState<{ name: string; quantity: number; price: string }[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState("");
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [submitAttemptWhileHidden, setSubmitAttemptWhileHidden] = useState(false);

  useEffect(() => {
    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      console.log('Tab visibility:', visible ? 'visible' : 'hidden');

      if (visible) {
        setSubmitAttemptWhileHidden(false);
      }
    };

    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const checkConnection = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      } catch (err) {
        setConnectionWarning(true);
      }
    };

    checkConnection();
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    if (!isTabVisible) {
      setSubmitAttemptWhileHidden(true);
      setError("Por favor, mantenha esta aba ativa para criar o pedido.");
      return;
    }

    setLoading(true);
    setError("");
    setConnectionWarning(false);
    setSubmitAttemptWhileHidden(false);

    console.log("Iniciando criação do pedido...");

    let wakeLock: any = null;
    const visibilityCheck = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        console.warn('AVISO: Aba ficou oculta durante o processo!');
      }
    }, 500);

    try {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock ativado - tela não dormirá');
        } catch (err) {
          console.warn('Não foi possível ativar Wake Lock:', err);
        }
      }
    } catch (e) {
      console.warn('Wake Lock não disponível');
    }

    try {
      if (!user) throw new Error("Usuário não autenticado");
      if (items.length === 0) throw new Error("Adicione pelo menos um item ao pedido.");

      console.log("Dados do pedido:", { title, description, items, user: user.id });
      
      // 1. Criar pedido
      const total = items.reduce((sum, item) => {
        const preco = Number(item.price);
        return sum + (isNaN(preco) ? 0 : preco * item.quantity);
      }, 0);
      
      console.log("Criando pedido com total:", total);
      console.log("User ID:", user.id);
      console.log("Executando INSERT usando fetch direto...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessão não encontrada. Faça login novamente.");
      }

      console.log("Sessão obtida, fazendo fetch...");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/purchase_orders?select=*`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            title,
            description,
            total_amount: total,
            user_id: user.id,
          }),
          keepalive: true
        }
      );

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro na resposta:", errorText);
        throw new Error(`Erro ao criar pedido: ${response.status} - ${errorText}`);
      }

      const dataArray = await response.json();
      const data = dataArray[0];

      console.log("INSERT completo! data:", data);

      const insertError = null;

      if (insertError) {
        console.error("Erro ao inserir pedido:", insertError);
        throw new Error(`Erro do banco: ${insertError.message || JSON.stringify(insertError)}`);
      }

      if (!data) {
        console.error("Pedido criado mas sem dados retornados!");
        throw new Error("Pedido criado mas sem dados retornados. Verifique as permissões RLS.");
      }

      console.log("✅ Pedido criado com sucesso:", data);
      
      // 2. Salvar itens
      console.log("Salvando", items.length, "itens usando fetch...");

      for (const item of items) {
        console.log("Salvando item:", item.name);

        const itemResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/purchase_order_items`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              purchase_order_id: data.id,
              name: item.name,
              quantity: item.quantity,
              unit_price: parseFloat(item.price),
            }),
            keepalive: true
          }
        );

        if (!itemResponse.ok) {
          const errorText = await itemResponse.text();
          console.error("Erro ao inserir item:", errorText);
          throw new Error(`Erro ao salvar item: ${itemResponse.status}`);
        }

        console.log("Item salvo:", item.name);
      }

      console.log("✅ Todos os itens salvos com sucesso!");
      
      // 3. Upload dos arquivos
      if (files.length > 0 && data) {
        console.log("Fazendo upload de", files.length, "arquivos...");

        for (const file of files) {
          console.log("Fazendo upload:", file.name);
          const fileName = `${data.id}/${Date.now()}_${file.name}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await (supabase as any).storage
            .from("receipts")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Erro no upload:", uploadError);
            throw uploadError;
          }

          const { error: dbError } = await (supabase as any)
            .from("purchase_order_receipts")
            .insert({
              purchase_order_id: data.id,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              storage_path: filePath,
            });

          if (dbError) {
            console.error("Erro ao registrar comprovante:", dbError);
            throw dbError;
          }
        }

        console.log("Todos os arquivos enviados com sucesso!");
      }
      
      console.log("Pedido criado com sucesso!");
      
      // Limpar formulário
      setTitle("");
      setDescription("");
      setItems([]);
      setFiles([]);
      setError("");
      
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro completo:", err);
      let errorMessage = err.message || "Erro ao criar pedido";

      if (errorMessage.includes('Timeout')) {
        errorMessage = "A operação está demorando muito. Isso pode acontecer quando você sai da aba do navegador. Por favor, mantenha a aba ativa e tente novamente.";
      } else if (errorMessage.includes('session')) {
        errorMessage = "Sua sessão expirou. Por favor, recarregue a página e faça login novamente.";
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = "Problema de conexão. Verifique sua internet e tente novamente.";
      }

      setError(errorMessage);

      if (typeof window !== 'undefined') {
        alert(`Erro: ${errorMessage}`);
      }
    } finally {
      if (wakeLock) {
        try {
          await wakeLock.release();
          console.log('Wake Lock liberado');
        } catch (err) {
          console.warn('Erro ao liberar Wake Lock:', err);
        }
      }
      clearInterval(visibilityCheck);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-8 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Compra</DialogTitle>
          <DialogDescription>Preencha os campos abaixo para criar um novo pedido de compra.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Título</label>
            <input
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition placeholder-gray-400 bg-white"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="Ex: Compra de materiais de escritório"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Descrição</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition placeholder-gray-400 bg-white min-h-[80px] resize-none"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhe o motivo ou itens do pedido"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Itens do Pedido</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              <input
                className="border border-gray-300 rounded-md px-2 py-1 w-1/2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition placeholder-gray-400 bg-white"
                placeholder="Nome do item"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
              />
              <input
                className="border border-gray-300 rounded-md px-2 py-1 w-16 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition bg-white"
                type="number"
                min="1"
                value={itemQty}
                onChange={e => setItemQty(Number(e.target.value))}
                placeholder="Qtd"
              />
              <input
                className="border border-gray-300 rounded-md px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition bg-white"
                type="number"
                min="0"
                step="0.01"
                value={itemPrice}
                onChange={e => setItemPrice(e.target.value)}
                placeholder="Preço"
              />
              <Button type="button" size="sm" className="bg-primary text-white rounded-md px-4 py-2 font-semibold hover:bg-primary/90 transition" onClick={() => {
                const precoNum = Number(itemPrice);
                if (itemName && !isNaN(precoNum) && precoNum > 0) {
                  setItems([...items, { name: itemName, quantity: itemQty, price: precoNum.toString() }]);
                  setItemName("");
                  setItemQty(1);
                  setItemPrice("");
                }
              }}>Adicionar</Button>
            </div>
            {items.length > 0 ? (
              <ul className="mb-2 divide-y divide-gray-100 bg-gray-50 rounded-md p-2">
                {items.map((item, idx) => (
                  <li key={idx} className="flex gap-2 items-center text-sm py-1">
                    <span className="w-1/2 truncate text-gray-800">{item.name}</span>
                    <span className="w-12 text-center text-gray-600">{item.quantity}</span>
                    <span className="w-20 text-right text-gray-700">R$ {parseFloat(item.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => setItems(items.filter((_, i) => i !== idx))}>Remover</Button>
                  </li>
                ))}
              </ul>
            ) : <div className="text-gray-400 text-sm">Nenhum item adicionado.</div>}
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">Comprovantes <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              disabled={loading}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
            />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="truncate max-w-[70%]">{file.name}</span>
                    <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleRemoveFile(idx)} disabled={loading}>
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!isTabVisible && (
            <div className="bg-orange-50 border-2 border-orange-400 rounded-md p-4 text-sm text-orange-900">
              <strong>⚠️ ABA INATIVA DETECTADA!</strong>
              <p className="mt-1">Esta aba está oculta. Por favor, mantenha-a visível para criar pedidos.</p>
            </div>
          )}
          {submitAttemptWhileHidden && (
            <div className="bg-red-50 border-2 border-red-400 rounded-md p-4 text-sm text-red-900">
              <strong>❌ BLOQUEADO:</strong>
              <p className="mt-1">Não é possível criar pedidos com a aba inativa. Mantenha esta janela visível.</p>
            </div>
          )}
          {connectionWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              <strong>⚠️ Atenção:</strong> A conexão pode estar inativa. Recomendamos esperar alguns segundos antes de enviar o formulário.
            </div>
          )}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 animate-pulse">
              <strong>💡 IMPORTANTE - NÃO SAIA DESTA ABA!</strong>
              <p className="mt-1">Processando... Mantenha esta janela visível até concluir.</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <strong>❌ Erro:</strong> {error}
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2">
            {!isTabVisible && (
              <div className="w-full text-center text-red-600 font-bold animate-pulse">
                🚫 IMPOSSÍVEL ENVIAR - ABA INATIVA
              </div>
            )}
            <Button type="submit" className="w-full h-12 text-lg bg-primary text-white font-bold rounded-md hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading || !isTabVisible}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </div>
              ) : (
                "Salvar Pedido"
              )}
            </Button>
            <Button type="button" variant="outline" className="w-full h-12 text-lg border-gray-300 font-bold rounded-md" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NovoPedido; 