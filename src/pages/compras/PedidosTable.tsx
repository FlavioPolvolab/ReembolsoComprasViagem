import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { fetchPurchaseOrders, approvePurchaseOrder, rejectPurchaseOrder, deletePurchaseOrder } from "@/services/purchaseOrderService";
import { PurchaseOrder } from "@/types/purchaseOrder";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DialogHeader } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import NovoPedido from "./NovoPedido";
import PedidoDetail from "./PedidoDetail";
import { CheckCircle, XCircle, Clock, RefreshCw, LogOut, WifiOff } from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import PurchaseOrderTable from "@/components/PurchaseOrderTable";

const PedidosTable: React.FC = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [massActionLoading, setMassActionLoading] = useState(false);
  const { user, isAdmin, hasRole } = useAuth();
  const [pedidos, setPedidos] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const loadPedidos = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      // Recarregar perfil do usuário
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: profileData } = await supabase
          .from("users")
          .select("*")
          .eq("id", currentUser.id)
          .single();
        console.log("Perfil recarregado em pedidos:", profileData);
      }
      
      const data = await fetchPurchaseOrders(user.id, isAdmin);
      setPedidos((data || []) as any);
    } catch (error: any) {
      setLoadError(error);
      console.error("Erro ao carregar pedidos:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  // Resumos
  const totalCount = pedidos?.length || 0;
  const pending = pedidos?.filter(p => p.status === "pending") || [];
  const approved = pedidos?.filter(p => p.status === "approved") || [];
  const approvedSorted = [...approved].sort((a, b) => {
    if (a.is_paid === b.is_paid) return 0;
    return a.is_paid ? 1 : -1;
  });
  const rejected = pedidos?.filter(p => p.status === "rejected") || [];
  const totalValue = pedidos?.reduce((acc, p) => acc + (p.total_amount || 0), 0) || 0;
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
    let result = pedidos || [];
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
    try {
      await (supabase as any)
        .from("purchase_orders")
        .update({ is_paid: true })
        .eq("id", pedido.id);
      loadPedidos();
    } catch (e) {
      // Pode exibir um toast de erro se desejar
    }
  };

  return (
    <div className="flex flex-col items-center min-h-[80vh] p-4">
      <div className="w-full max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold">Sistema de Pedidos de Compras</h1>
        </div>
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
            <Button 
              variant="outline" 
              onClick={loadPedidos} 
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button 
              onClick={() => setShowNovoModal(true)}
            >
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

        {loadError && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Erro ao carregar pedidos</h3>
              <p className="text-muted-foreground">
                {loadError.message || "Não foi possível carregar os pedidos."}
              </p>
            </div>
            <Button onClick={loadPedidos}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
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
          <DialogHeader>
            <VisuallyHidden>
              <DialogTitle>Novo Pedido de Compra</DialogTitle>
            </VisuallyHidden>
            <DialogDescription className="sr-only">Formulário para criar um novo pedido de compra.</DialogDescription>
          </DialogHeader>
          <NovoPedido open={showNovoModal} onOpenChange={setShowNovoModal} onSuccess={() => handleNovoClose(true)} />
        </DialogContent>
      </Dialog>
      {/* Modal de detalhes do pedido */}
      <Dialog open={!!selectedPedidoId} onOpenChange={open => { if (!open) setSelectedPedidoId(null); }}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader>
            <VisuallyHidden>
              <DialogTitle>Detalhes do Pedido de Compra</DialogTitle>
            </VisuallyHidden>
            <DialogDescription className="sr-only">Visualização dos detalhes do pedido de compra selecionado.</DialogDescription>
          </DialogHeader>
          {selectedPedidoId && <PedidoDetail pedidoId={selectedPedidoId} onClose={() => handleDetailClose(true)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PedidosTable; 