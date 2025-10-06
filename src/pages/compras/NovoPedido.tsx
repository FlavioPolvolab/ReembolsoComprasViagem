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

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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

    setLoading(true);
    setError("");
    setConnectionWarning(false);

    console.log("Iniciando criação do pedido...");

    try {
      if (!user) throw new Error("Usuário não autenticado");
      if (items.length === 0) throw new Error("Adicione pelo menos um item ao pedido.");

      console.log("Verificando sessão...");
      try {
        await supabase.auth.refreshSession();
      } catch (refreshError) {
        console.warn("Erro ao renovar sessão, tentando continuar:", refreshError);
      }
      
      console.log("Dados do pedido:", { title, description, items, user: user.id });
      
      // 1. Criar pedido
      const total = items.reduce((sum, item) => {
        const preco = Number(item.price);
        return sum + (isNaN(preco) ? 0 : preco * item.quantity);
      }, 0);
      
      console.log("Criando pedido com total:", total);

      const insertPromise = (supabase as any)
        .from("purchase_orders")
        .insert({
          title,
          description,
          total_amount: total,
          user_id: user.id,
        })
        .select()
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: A operação está demorando muito. Verifique sua conexão.')), 30000)
      );

      const { data, error: insertError } = await Promise.race([insertPromise, timeoutPromise]) as any;

      if (insertError) {
        console.error("Erro ao inserir pedido:", insertError);
        throw insertError;
      }
      
      console.log("Pedido criado:", data);
      
      // 2. Salvar itens
      const itemPromises = items.map(async (item) => {
        console.log("Salvando item:", item);
        return (supabase as any)
          .from("purchase_order_items")
          .insert({
            purchase_order_id: data.id,
            name: item.name,
            quantity: item.quantity,
            unit_price: parseFloat(item.price),
          });
      });

      const itemsTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao salvar itens')), 30000)
      );

      const itemResults = await Promise.race([
        Promise.all(itemPromises),
        itemsTimeout
      ]) as any[];

      for (const result of itemResults) {
        if (result.error) {
          console.error("Erro ao inserir item:", result.error);
          throw result.error;
        }
      }
      
      console.log("Todos os itens salvos");
      
      // 3. Upload dos arquivos
      if (files.length > 0 && data) {
        const uploadPromises = files.map(async (file) => {
          console.log("Fazendo upload do arquivo:", file.name);
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
        });

        const uploadTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout ao fazer upload dos arquivos')), 60000)
        );

        await Promise.race([
          Promise.all(uploadPromises),
          uploadTimeout
        ]);
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
          {connectionWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              <strong>⚠️ Atenção:</strong> A conexão pode estar inativa. Recomendamos esperar alguns segundos antes de enviar o formulário.
            </div>
          )}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <strong>💡 Importante:</strong> Mantenha esta aba ativa até concluir o salvamento. Não mude de aba durante o processo.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <strong>❌ Erro:</strong> {error}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" className="w-full h-12 text-lg bg-primary text-white font-bold rounded-md hover:bg-primary/90 transition" disabled={loading}>
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