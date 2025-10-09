import React, { useState, useEffect, useRef } from "react";
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
import { supabase, withConnection } from "@/lib/supabase";

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

    console.log('[NovoPedido] Form submitted');

    if (loading) {
      console.log('[NovoPedido] Already loading, skipping');
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log('[NovoPedido] Validating user and items...');

      if (!user) {
        console.error('[NovoPedido] No user found');
        throw new Error("Usuário não autenticado");
      }

      console.log('[NovoPedido] User:', user.id);

      if (items.length === 0) {
        console.error('[NovoPedido] No items in order');
        throw new Error("Adicione pelo menos um item ao pedido.");
      }

      console.log('[NovoPedido] Items to create:', items.length);
      console.log('[NovoPedido] Order data:', { title, description, itemCount: items.length, fileCount: files.length });

      await withConnection(async () => {
        console.log('[NovoPedido] Inside withConnection, calculating total...');

        const total = items.reduce((sum, item) => {
          const preco = Number(item.price);
          return sum + (isNaN(preco) ? 0 : preco * item.quantity);
        }, 0);

        console.log('[NovoPedido] Total amount calculated:', total);

        const insertData = {
          title,
          description,
          total_amount: total,
          user_id: user.id,
        };

        console.log('[NovoPedido] Inserting purchase order:', insertData);

        const { data, error: insertError } = await supabase
          .from("purchase_orders")
          .insert(insertData)
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('[NovoPedido] Insert error:', insertError);
          console.error('[NovoPedido] Insert error details:', {
            message: insertError.message,
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint
          });
          throw new Error(`Erro ao criar pedido: ${insertError.message}`);
        }

        if (!data) {
          console.error('[NovoPedido] No data returned after insert');
          throw new Error("Pedido não foi criado. Verifique se você tem permissão para criar pedidos.");
        }

        console.log('[NovoPedido] Purchase order created successfully:', data.id);

        console.log('[NovoPedido] Inserting items...');
        for (const item of items) {
          console.log('[NovoPedido] Inserting item:', item.name);

          const { error: itemError } = await supabase
            .from("purchase_order_items")
            .insert({
              purchase_order_id: data.id,
              name: item.name,
              quantity: item.quantity,
              unit_price: parseFloat(item.price),
            });

          if (itemError) {
            console.error('[NovoPedido] Item insert error:', itemError);
            console.error('[NovoPedido] Item error details:', {
              message: itemError.message,
              code: itemError.code,
              details: itemError.details,
              hint: itemError.hint
            });
            throw new Error(`Erro ao salvar item ${item.name}: ${itemError.message}`);
          }

          console.log('[NovoPedido] Item inserted successfully:', item.name);
        }

        console.log('[NovoPedido] All items inserted successfully');

        if (files.length > 0) {
          console.log('[NovoPedido] Uploading files:', files.length);

          for (const file of files) {
            const fileName = `${data.id}/${Date.now()}_${file.name}`;
            const filePath = `${fileName}`;

            console.log('[NovoPedido] Uploading file:', file.name);

            const { error: uploadError } = await supabase.storage
              .from("receipts")
              .upload(filePath, file);

            if (uploadError) {
              console.error('[NovoPedido] Upload error:', uploadError);
              throw new Error(`Erro ao fazer upload de ${file.name}: ${uploadError.message}`);
            }

            console.log('[NovoPedido] File uploaded, registering in database...');

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
              console.error('[NovoPedido] Receipt DB error:', dbError);
              throw new Error(`Erro ao registrar comprovante ${file.name}: ${dbError.message}`);
            }

            console.log('[NovoPedido] Receipt registered:', file.name);
          }

          console.log('[NovoPedido] All files uploaded successfully');
        }

        console.log('[NovoPedido] Order creation complete!');
      });

      console.log('[NovoPedido] Clearing form...');
      setTitle("");
      setDescription("");
      setItems([]);
      setFiles([]);
      setError("");

      console.log('[NovoPedido] Calling onSuccess callback...');
      if (onSuccess) onSuccess();

      console.log('[NovoPedido] Closing modal...');
      onOpenChange(false);

      console.log('[NovoPedido] Order created successfully!');
    } catch (err: any) {
      console.error('[NovoPedido] Error during order creation:', err);
      console.error('[NovoPedido] Error stack:', err.stack);

      const errorMessage = err.message || "Erro ao criar pedido";
      console.error('[NovoPedido] Final error message:', errorMessage);

      setError(errorMessage);
      alert(`Erro: ${errorMessage}`);
    } finally {
      setLoading(false);
      console.log('[NovoPedido] Form submission complete');
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
            <Button type="submit" className="w-full h-12 text-lg bg-primary text-white font-bold rounded-md hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
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