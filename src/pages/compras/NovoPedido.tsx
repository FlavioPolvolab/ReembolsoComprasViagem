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
import { supabase, waitForSessionRefresh, ensureValidSession, isSessionRefreshing } from "@/lib/supabase";

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
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    if (!open) return;

    const checkConnection = async () => {
      setSessionRefreshing(true);
      setIsReady(false);
      try {
        await waitForSessionRefresh();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      } catch (err) {
        setConnectionWarning(true);
      } finally {
        setTimeout(() => {
          setSessionRefreshing(false);
          setIsReady(true);
        }, 500);
      }
    };

    checkConnection();
  }, [open]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Janela recebeu foco, aguardando atualização da sessão...');
        setSessionRefreshing(true);
        setIsReady(false);

        await waitForSessionRefresh();

        setTimeout(() => {
          setSessionRefreshing(false);
          setIsReady(true);
          console.log('Sessão atualizada, pronto para enviar');
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

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

    console.log("Iniciando criação do pedido...")

    try {
      if (!user) throw new Error("Usuário não autenticado");
      if (items.length === 0) throw new Error("Adicione pelo menos um item ao pedido.");

      console.log("Dados do pedido:", { title, description, items, user: user.id });

      console.log("Aguardando refresh da sessão se necessário...");
      await waitForSessionRefresh();

      console.log("Validando sessão...");
      const session = await ensureValidSession();
      console.log("Sessão validada:", { userId: session.user.id });

      const total = items.reduce((sum, item) => {
        const preco = Number(item.price);
        return sum + (isNaN(preco) ? 0 : preco * item.quantity);
      }, 0);

      console.log("Criando pedido com total:", total);
      console.log("User ID:", user.id);

      const insertData = {
        title,
        description,
        total_amount: total,
        user_id: user.id,
      };

      console.log("Dados do INSERT:", JSON.stringify(insertData, null, 2));

      const insertPromise = supabase
        .from("purchase_orders")
        .insert(insertData)
        .select()
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: A operação demorou mais de 10 segundos")), 10000);
      });

      console.log("Executando INSERT...");
      const { data, error: insertError } = await Promise.race([insertPromise, timeoutPromise]) as any;

      console.log("INSERT response:", { data, insertError });
      console.log("INSERT error details:", insertError ? JSON.stringify(insertError, null, 2) : 'nenhum erro');

      if (insertError) {
        console.error("Erro ao inserir pedido:", insertError);
        console.error("Código do erro:", insertError.code);
        console.error("Detalhes do erro:", insertError.details);
        console.error("Hint do erro:", insertError.hint);
        console.error("Mensagem do erro:", insertError.message);

        let errorMsg = `Erro ao criar pedido: ${insertError.message}`;
        if (insertError.code) errorMsg += ` (Código: ${insertError.code})`;
        if (insertError.hint) errorMsg += ` - Dica: ${insertError.hint}`;
        if (insertError.details) errorMsg += ` - Detalhes: ${insertError.details}`;

        throw new Error(errorMsg);
      }

      if (!data) {
        console.error("Pedido criado mas sem dados retornados!");
        console.error("Verificando RLS policies...")
        throw new Error("Pedido não foi criado. Verifique se você tem permissão para criar pedidos. Se o problema persistir, contate o administrador.");
      }

      console.log("✅ Pedido criado com sucesso:", data);

      // 2. Salvar itens
      console.log("Salvando", items.length, "itens...");

      for (const item of items) {
        console.log("Salvando item:", item.name);

        const { error: itemError } = await supabase
          .from("purchase_order_items")
          .insert({
            purchase_order_id: data.id,
            name: item.name,
            quantity: item.quantity,
            unit_price: parseFloat(item.price),
          });

        if (itemError) {
          console.error("Erro ao inserir item:", itemError);
          throw new Error(`Erro ao salvar item ${item.name}: ${itemError.message}`);
        }

        console.log("✅ Item salvo:", item.name);
      }

      console.log("✅ Todos os itens salvos com sucesso!");
      
      // 3. Upload dos arquivos
      if (files.length > 0 && data) {
        console.log("Fazendo upload de", files.length, "arquivos...");

        for (const file of files) {
          console.log("Fazendo upload:", file.name);
          const fileName = `${data.id}/${Date.now()}_${file.name}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Erro no upload:", uploadError);
            throw new Error(`Erro ao fazer upload de ${file.name}: ${uploadError.message}`);
          }

          const { error: dbError } = await supabase
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
            throw new Error(`Erro ao registrar comprovante ${file.name}: ${dbError.message}`);
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
        errorMessage = "A operação está demorando muito. Tente novamente.";
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
          {sessionRefreshing && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <strong>🔄 Atualizando sessão...</strong>
              <p className="mt-1">Aguarde alguns instantes enquanto sincronizamos sua conexão.</p>
            </div>
          )}
          {connectionWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              <strong>⚠️ Atenção:</strong> A conexão pode estar inativa. Recomendamos esperar alguns segundos antes de enviar o formulário.
            </div>
          )}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 animate-pulse">
              <strong>Processando...</strong>
              <p className="mt-1">Aguarde enquanto criamos seu pedido.</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <strong>❌ Erro:</strong> {error}
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full h-12 text-lg bg-primary text-white font-bold rounded-md hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading || !isReady || sessionRefreshing}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </div>
              ) : sessionRefreshing ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Aguarde...
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