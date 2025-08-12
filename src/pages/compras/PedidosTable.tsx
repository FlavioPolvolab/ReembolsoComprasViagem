import React, { useEffect, useState, useMemo, useRef } from "react";
import { fetchPurchaseOrders, approvePurchaseOrder, rejectPurchaseOrder, deletePurchaseOrder } from "@/services/purchaseOrderService";
import { PurchaseOrder } from "@/types/purchaseOrder";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import NovoPedido from "./NovoPedido";
import PedidoDetail from "./PedidoDetail";
import { CheckCircle, XCircle, Clock, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import PurchaseOrderTable from "@/components/PurchaseOrderTable";

const TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Tempo limite excedido ao buscar pedidos.")), ms))
  ]);
}

const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: any;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const PedidosTable: React.FC = () => {
  const [pedidos, setPedidos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [massActionLoading, setMassActionLoading] = useState(false);
  const { user, isAdmin, hasRole } = useAuth();
  const loadingRef = useRef(false);

  const loadPedidos = async () => {
    if (loadingRef.current) return;
    setLoading(true);
    loadingRef.current = true;
    try {
      const data = await withTimeout((fetchPurchaseOrders as any)(user?.id, isAdmin), TIMEOUT_MS);
      setPedidos((data as PurchaseOrder[]) || []);
    } catch (e) {
      setPedidos([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const debouncedLoadPedidos = useRef(debounce(loadPedidos, 500)).current;

  useEffect(() => {
    loadPedidos();
  }, []);

  // Resumos
  const totalCount = pedidos.length;
  const pending = pedidos.filter(p => p.status === "pending");
  const approved = pedidos.filter(p => p.status === "approved");
  const approvedSorted = [...approved].sort((a, b) => {
    if (a.is_paid === b.is_paid) return 0;
    return a.is_paid ? 1 : -1;
  });
  const rejected = pedidos.filter(p => p.status === "rejected");
  const totalValue = pedidos.reduce((acc, p) => acc + (p.total_amount || 0), 0);
  const pendingValue = pending.reduce((acc, p) => acc + (p.total_amount || 0), 0);
  const approvedValue = approved.reduce((acc, p) => acc + (p.total_amount || 0), 0);
  const rejectedValue = rejected.reduce((acc, p) => acc + (p.total_amount || 0), 0);

  // Cálculo de pagos e pendentes entre aprovados (exemplo: todos aprovados são pagos)
  const paidCount = approved.length; // ajuste se houver status de pagamento
  const paidValue = approvedValue;   // ajuste se houver status de pagamento
  const pendingPaidCount = 0;
  const pendingPaidValue = 0;

  // Filtro e tabs
  const filteredPedidos = useMemo(() => {
    let result = pedidos;
    if (search.trim() !== "") {
      const s = search.trim().toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(s) ||
        (p.description && p.description.toLowerCase().includes(s))
      );
    }
    if (activeTab === "pending") result = result.filter(p => p.status === "pending");
    if (activeTab === "approved") result = approvedSorted;
    if (activeTab === "rejected") result = result.filter(p => p.status === "rejected");
    return result;
  }, [pedidos, search, activeTab, approvedSorted]);

  // Handler para fechar modal e recarregar lista
  const handleNovoClose = (refresh?: boolean) => {
    setShowNovoModal(false);
    if (refresh) loadPedidos();
  };
  const handleDetailClose = (refresh?: boolean) => {
    setSelectedPedidoId(null);
    if (refresh) loadPedidos();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(filteredPedidos.map(p => p.id));
    else setSelectedIds([]);
  };
  const handleSelect = (id: string, checked: boolean) => {
    if (checked) setSelectedIds([...selectedIds, id]);
    else setSelectedIds(selectedIds.filter(i => i !== id));
  };
  const handleMassApprove = async () => {
    if (!user) return;
    setMassActionLoading(true);
    try {
      await Promise.all(selectedIds.map(id => approvePurchaseOrder(id, user.id)));
      setSelectedIds([]);
      loadPedidos();
    } finally {
      setMassActionLoading(false);
    }
  };
  const handleMassReject = async () => {
    if (!user) return;
    setMassActionLoading(true);
    try {
      await Promise.all(selectedIds.map(id => rejectPurchaseOrder(id, user.id, "Rejeitado em massa")));
      setSelectedIds([]);
      loadPedidos();
    } finally {
      setMassActionLoading(false);
    }
  };

  const handleMarkPaid = async (pedido: PurchaseOrder) => {
    if (!pedido || pedido.is_paid) return;
    setLoading(true);
    try {
      await (supabase as any)
        .from("purchase_orders")
        .update({ is_paid: true })
        .eq("id", pedido.id);
      loadPedidos();
    } catch (e) {
      // Pode exibir um toast de erro se desejar
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-[80vh] p-4">
      <div className="w-full max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Sistema de Pedidos de Compras</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white">
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <span className="text-blue-600"><Clock size={20} /></span>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <div className="text-sm text-muted-foreground mt-1">{totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <span className="text-yellow-500"><Clock size={20} /></span>
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{pending.length}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{pendingValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <span className="text-green-600"><CheckCircle size={20} /></span>
              <CardTitle className="text-sm font-medium text-muted-foreground">Aprovados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{approved.length}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{approvedValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
              <div className="text-xs mt-1">
                <span className="text-green-700">Pagos: {paidCount} ({paidValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span><br />
                <span className="text-yellow-700">Pendentes: {pendingPaidCount} ({pendingPaidValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <span className="text-red-600"><XCircle size={20} /></span>
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejeitados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{rejected.length}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{rejectedValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-0">
              <TabsTrigger value="pending" className="flex items-center gap-2">Pendentes</TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">Aprovados</TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">Rejeitados</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2 ml-4">
            <Button variant="outline" onClick={() => window.location.assign('/')}>Home</Button>
            <Button variant="outline" onClick={debouncedLoadPedidos} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={() => setShowNovoModal(true)}>
              Novo Pedido
            </Button>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Buscar pedidos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span>{selectedIds.length} itens selecionados</span>
            <Button variant="default" size="sm" className="text-green-700" onClick={handleMassApprove} disabled={massActionLoading}>Aprovar Selecionados</Button>
            <Button variant="destructive" size="sm" onClick={handleMassReject} disabled={massActionLoading}>Rejeitar Selecionados</Button>
          </div>
        )}

        <PurchaseOrderTable
          orders={filteredPedidos}
          onViewDetails={pedido => setSelectedPedidoId(pedido.id)}
          onBulkAction={async (selected, action) => {
            if (!user) return;
            if (action === "approve") {
              await Promise.all(selected.map(p => approvePurchaseOrder(p.id, user.id)));
            } else if (action === "reject") {
              await Promise.all(selected.map(p => rejectPurchaseOrder(p.id, user.id, "Rejeitado em massa")));
            }
            loadPedidos();
          }}
          onApprove={async pedido => { if (!user) return; await approvePurchaseOrder(pedido.id, user.id); loadPedidos(); }}
          onReject={async pedido => { if (!user) return; await rejectPurchaseOrder(pedido.id, user.id, "Rejeitado"); loadPedidos(); }}
          onDelete={async pedido => { if (!user) return; await deletePurchaseOrder(pedido.id, user.id); loadPedidos(); }}
          isAdmin={isAdmin}
          hasRole={hasRole}
          onMarkPaid={handleMarkPaid}
        />
      </div>
      {/* Modal de novo pedido */}
      <Dialog open={showNovoModal} onOpenChange={open => setShowNovoModal(open)}>
        <DialogContent className="max-w-xl p-0">
          <NovoPedido open={showNovoModal} onOpenChange={setShowNovoModal} onSuccess={() => handleNovoClose(true)} />
        </DialogContent>
      </Dialog>
      {/* Modal de detalhes do pedido */}
      <Dialog open={!!selectedPedidoId} onOpenChange={open => { if (!open) setSelectedPedidoId(null); }}>
        <DialogContent className="max-w-3xl p-0">
          {selectedPedidoId && <PedidoDetail pedidoId={selectedPedidoId} onClose={() => handleDetailClose(true)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PedidosTable; 