import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { PurchaseOrder, PurchaseOrderReceipt, PurchaseOrderItem } from "@/types/purchaseOrder";
import { uploadPurchaseOrderReceipt, fetchPurchaseOrderItems, addPurchaseOrderItem, deletePurchaseOrderItem, approvePurchaseOrder, rejectPurchaseOrder, deletePurchaseOrder, updatePurchaseOrderItem } from "@/services/purchaseOrderService";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { DialogTitle } from "@/components/ui/dialog";

interface PedidoDetailProps {
  pedidoId: string;
  onClose?: () => void;
}

const TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Tempo limite excedido ao carregar detalhes.")), ms))
  ]);
}

const PedidoDetail: React.FC<PedidoDetailProps> = ({ pedidoId, onClose }) => {
  const [pedido, setPedido] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<PurchaseOrderReceipt[]>([]);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { user, isAdmin, hasRole } = useAuth();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [modalType, setModalType] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<{ [id: string]: { name: string; quantity: number; unit_price: number; saving?: boolean } }>({});

  useEffect(() => {
    let isCurrent = true;
    setError(null);
    if (pedidoId) {
      (async () => {
        setLoading(true);
        try {
          // Buscar pedido
          const { data: pedidoData, error: pedidoError } = await withTimeout(
            (async () => {
              return await (supabase as any)
                .from("purchase_orders")
                .select("*, users:user_id(name)")
                .eq("id", pedidoId)
                .single();
            })(),
            TIMEOUT_MS
          );
          if (!isCurrent) return;
          if (pedidoError || !pedidoData) throw pedidoError || new Error("Pedido não encontrado");
          setPedido(pedidoData);

          // Buscar comprovantes
          const { data: receiptsData, error: receiptsError } = await withTimeout(
            (async () => {
              return await (supabase as any)
                .from("purchase_order_receipts")
                .select("*")
                .eq("purchase_order_id", pedidoId);
            })(),
            TIMEOUT_MS
          );
          if (!isCurrent) return;
          if (receiptsError) throw receiptsError;
          setReceipts(receiptsData || []);

          // Buscar itens
          const itemsData = await withTimeout(fetchPurchaseOrderItems(pedidoId), TIMEOUT_MS);
          if (!isCurrent) return;
          setItems(itemsData || []);
        } catch (error: any) {
          if (!isCurrent) return;
          setPedido(null);
          setReceipts([]);
          setItems([]);
          setError(error?.message || "Erro ao carregar detalhes do pedido.");
          toast({
            title: "Erro",
            description: error?.message || "Falha ao carregar detalhes do pedido.",
            variant: "destructive",
          });
        } finally {
          if (isCurrent) setLoading(false);
        }
      })();
    }
    return () => { isCurrent = false; };
  }, [pedidoId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pedidoId || !e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      await uploadPurchaseOrderReceipt(pedidoId, e.target.files[0]);
      // Recarregar comprovantes
      const { data: receiptsData } = await (supabase as any)
        .from("purchase_order_receipts")
        .select("*")
        .eq("purchase_order_id", pedidoId);
      setReceipts(receiptsData || []);
    } catch (err) {
      alert("Erro ao enviar comprovante");
    } finally {
      setUploading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoId || !itemName || !itemPrice) return;
    setAddingItem(true);
    try {
      await addPurchaseOrderItem(pedidoId, itemName, itemQty, parseFloat(itemPrice));
      setItemName("");
      setItemQty(1);
      setItemPrice("");
      const itemsData = await fetchPurchaseOrderItems(pedidoId);
      setItems(itemsData || []);
    } catch (err) {
      alert("Erro ao adicionar item");
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Excluir este item?")) return;
    try {
      await deletePurchaseOrderItem(itemId);
      if (pedidoId) {
        const itemsData = await fetchPurchaseOrderItems(pedidoId);
        setItems(itemsData || []);
      }
    } catch (err) {
      alert("Erro ao excluir item");
    }
  };

  const handleApprove = async () => {
    if (!pedido || !user) return;
    setActionLoading(true);
    try {
      await approvePurchaseOrder(pedido.id, user.id);
      if (onClose) onClose();
    } catch (err) {
      alert("Erro ao aprovar pedido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!pedido || !user || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectPurchaseOrder(pedido.id, user.id, rejectionReason);
      setShowRejectForm(false);
      setRejectionReason("");
      if (onClose) onClose();
    } catch (err) {
      alert("Erro ao rejeitar pedido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pedido || !user) return;
    if (!window.confirm("Tem certeza que deseja excluir este pedido?")) return;
    setActionLoading(true);
    try {
      await deletePurchaseOrder(pedido.id, user.id);
      if (onClose) onClose();
    } catch (err) {
      alert("Erro ao excluir pedido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetPaid = async (checked: boolean) => {
    if (!pedido || !user) return;
    setActionLoading(true);
    try {
      await (supabase as any)
        .from("purchase_orders")
        .update({ is_paid: checked })
        .eq("id", pedido.id);
      setPedido({ ...pedido, is_paid: checked });
    } catch (err) {
      alert("Erro ao atualizar pagamento");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={!!onClose} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] bg-white">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando detalhes do pedido...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={!!onClose} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] bg-white">
          <DialogHeader>
            <DialogTitle>Erro ao carregar detalhes</DialogTitle>
          </DialogHeader>
          <p>{error}</p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!pedido) return <div className="p-8 text-red-500">Pedido não encontrado.</div>;

  return (
    <Dialog open={!!onClose} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full p-8 sm:rounded-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold mb-2">Detalhe do Pedido de Compra</DialogTitle>
        </DialogHeader>
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-2"><strong>Título:</strong> {pedido.title}</div>
            <div className="mb-2"><strong>Valor Total:</strong> R$ {pedido.total_amount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            <div className="mb-2">
              <strong>Pagamento:</strong> {pedido.is_paid ? (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs ml-1">Pago</span>
              ) : (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs ml-1">Pendente</span>
              )}
            </div>
            <div className="mb-2"><strong>Status:</strong> <span className="capitalize">{pedido.status}</span></div>
          </div>
          <div>
            <div className="mb-2">
              <label className="block font-medium mb-1">Enviar novo comprovante</label>
              <input type="file" accept="image/*,application/pdf" onChange={handleUpload} disabled={uploading} />
            </div>
            <div>
              <h3 className="font-medium mb-2">Comprovantes</h3>
              {receipts.length === 0 ? (
                <p className="text-gray-500">Nenhum comprovante enviado.</p>
              ) : (
                <ul className="space-y-2">
                  {receipts.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="truncate max-w-xs">{r.file_name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setModalLoading(true);
                          setImgError(false);
                          try {
                            const { data, error } = await (supabase as any).storage
                              .from("receipts")
                              .createSignedUrl(r.storage_path, 60 * 10); // 10 minutos
                            if (error || !data?.signedUrl) throw error || new Error("Erro ao gerar link assinado");
                            setModalUrl(data.signedUrl);
                            setModalType(r.file_type);
                          } catch (e) {
                            setModalUrl(null);
                            setModalType(null);
                            setImgError(true);
                          } finally {
                            setModalLoading(false);
                          }
                        }}
                      >
                        Visualizar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mb-2 col-span-2">
            <strong>Descrição:</strong>
            <div className="break-words whitespace-pre-line mt-1">
              {pedido.description || "-"}
            </div>
          </div>
        </div>
        <div className="mb-8">
          <h3 className="font-medium mb-2">Itens do Pedido</h3>
          <form onSubmit={handleAddItem} className="flex gap-2 mb-4 flex-wrap">
            <input
              className="border rounded px-2 py-1"
              placeholder="Nome do item"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              required
            />
            <input
              className="border rounded px-2 py-1 w-20"
              type="number"
              min="1"
              value={itemQty}
              onChange={e => setItemQty(Number(e.target.value))}
              required
            />
            <input
              className="border rounded px-2 py-1 w-28"
              type="number"
              min="0"
              step="0.01"
              placeholder="Preço unitário"
              value={itemPrice}
              onChange={e => setItemPrice(e.target.value)}
              required
            />
            <Button type="submit" disabled={addingItem}>Adicionar</Button>
          </form>
          {items.length === 0 ? (
            <p className="text-gray-500">Nenhum item adicionado.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Qtd</TableCell>
                  <TableCell>Unitário</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  if (true) { // Forçar renderização do bloco de edição para depuração
                    const edit = editItems[item.id] || { name: item.name, quantity: item.quantity, unit_price: item.unit_price };
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={edit.name}
                            onChange={e => setEditItems(editItems => ({
                              ...editItems,
                              [item.id]: { ...edit, name: e.target.value }
                            }))}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className="border rounded px-2 py-1 w-16"
                            type="number"
                            min="1"
                            value={edit.quantity}
                            onChange={e => setEditItems(editItems => ({
                              ...editItems,
                              [item.id]: { ...edit, quantity: Number(e.target.value) }
                            }))}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className="border rounded px-2 py-1 w-24"
                            type="number"
                            min="0"
                            step="0.01"
                            value={edit.unit_price}
                            onChange={e => setEditItems(editItems => ({
                              ...editItems,
                              [item.id]: { ...edit, unit_price: Number(e.target.value) }
                            }))}
                          />
                        </TableCell>
                        <TableCell>
                          R$ {(edit.unit_price * edit.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={async () => {
                              setEditItems(editItems => ({
                                ...editItems,
                                [item.id]: { ...edit, saving: true }
                              }));
                              try {
                                await updatePurchaseOrderItem(item.id, edit.name, edit.quantity, edit.unit_price);
                                const itemsData = await fetchPurchaseOrderItems(pedidoId);
                                setItems(itemsData || []);
                                // Atualizar o total_amount na ordem
                                const newTotal = (itemsData || []).reduce((sum, it) => sum + (Number(it.unit_price) * Number(it.quantity)), 0);
                                await (supabase as any).from("purchase_orders").update({ total_amount: newTotal }).eq("id", pedidoId);
                                toast({ title: "Item atualizado!" });
                                setEditItems(editItems => ({ ...editItems, [item.id]: undefined }));
                              } catch (e) {
                                toast({ title: "Erro ao atualizar item", variant: "destructive" });
                                alert("Erro ao atualizar item: " + (e?.message || JSON.stringify(e)));
                              } finally {
                                setEditItems(editItems => ({
                                  ...editItems,
                                  [item.id]: { ...edit, saving: false }
                                }));
                              }
                            }}
                            // disabled={!!edit.saving} // Removido para depuração
                          >
                            {edit.saving ? "Salvando..." : "Salvar"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id)}>
                            Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  } else {
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>R$ {item.unit_price?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>R$ {item.total_price?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id)}>
                            Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }
                })}
              </TableBody>
            </Table>
          )}
        </div>
        {(isAdmin || (hasRole && hasRole("approver"))) && (pedido.status === "pending" || pedido.status === "approved") && (
          <div className="flex gap-2 mb-6 items-center">
            {pedido.status === "pending" && (
              <Button onClick={handleApprove} disabled={actionLoading}>Aprovar</Button>
            )}
            {pedido.status === "approved" && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!pedido.is_paid}
                  onChange={e => handleSetPaid(e.target.checked)}
                  disabled={actionLoading}
                />
                Marcar como pago
              </label>
            )}
            {pedido.status === "pending" && showRejectForm ? (
              <>
                <input
                  className="border rounded px-2 py-1"
                  placeholder="Motivo da rejeição"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  disabled={actionLoading}
                />
                <Button onClick={handleReject} disabled={actionLoading || !rejectionReason.trim()} variant="destructive">Confirmar Rejeição</Button>
                <Button onClick={() => setShowRejectForm(false)} disabled={actionLoading} variant="outline">Cancelar</Button>
              </>
            ) : pedido.status === "pending" ? (
              <Button onClick={() => setShowRejectForm(true)} disabled={actionLoading} variant="destructive">Rejeitar</Button>
            ) : null}
            {(pedido.status === "pending" || pedido.status === "approved") && (
              <Button onClick={handleDelete} disabled={actionLoading} variant="destructive">Excluir</Button>
            )}
          </div>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose}>Voltar</Button>
        )}
      </DialogContent>
      {/* Modal de visualização de comprovante */}
      <Dialog open={!!modalUrl || modalLoading} onOpenChange={open => { if (!open) { setModalUrl(null); setImgError(false); setModalLoading(false); } }}>
        <DialogContent className="max-w-2xl">
          {modalLoading ? (
            <div className="text-center">Carregando comprovante...</div>
          ) : modalUrl && modalType?.startsWith("image") ? (
            imgError ? (
              <div className="text-center text-red-500">Não foi possível carregar a imagem do comprovante.</div>
            ) : (
              <img src={modalUrl} alt="Comprovante" className="max-h-[70vh] mx-auto" onError={() => setImgError(true)} />
            )
          ) : modalUrl && modalType?.includes("pdf") ? (
            <iframe src={modalUrl} title="Comprovante PDF" className="w-full h-[70vh]" />
          ) : modalUrl ? (
            <div className="text-center">
              <a href={modalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Baixar comprovante</a>
            </div>
          ) : imgError ? (
            <div className="text-center text-red-500">Não foi possível carregar a imagem do comprovante.</div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default PedidoDetail; 