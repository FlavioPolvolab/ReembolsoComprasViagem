import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PlusCircle, RefreshCw, CheckCircle, XCircle, FileText, Coins } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Trip,
  TripExpense,
  fetchTrips,
  createTrip,
  fetchTripExpenses,
  fetchTripReceipts,
  addTripExpense,
  updateTripExpense,
  deleteTripExpense,
  uploadTripReceipt,
  getSignedUrl,
  closeTrip,
  closeTripWithNote,
  deleteTripDeep,
  updateTrip,
} from "@/services/travelService";

const ViagensPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [showTripDetail, setShowTripDetail] = useState<null | Trip>(null);
  const [search, setSearch] = useState("");
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [filterCostCenterId, setFilterCostCenterId] = useState<string>("");

  const loadTrips = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await fetchTrips(user.id, isAdmin);
      setTrips(data || []);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao carregar viagens", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, toast]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("trip_cost_centers")
        .select("id, name")
        .order("name", { ascending: true });
      setCostCenters(data || []);
    })();
  }, []);

  const filteredTrips = useMemo(() => {
    let list = trips.filter(t => (activeTab === "open" ? t.status === "open" : t.status === "closed"));
    if (filterCostCenterId) list = list.filter(t => t.cost_center_id === filterCostCenterId);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(t =>
      [t.title, t.description, t.users?.name, t.cost_center?.name].some(v => v && String(v).toLowerCase().includes(q))
    );
  }, [trips, search, activeTab, filterCostCenterId]);

  const filteredForSummary = useMemo(() => {
    let list = trips;
    if (filterCostCenterId) list = list.filter(t => t.cost_center_id === filterCostCenterId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => [t.title, t.description, t.users?.name, t.cost_center?.name].some(v => v && String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [trips, search, filterCostCenterId]);

  const totalBudget = useMemo(() => filteredForSummary.reduce((s, t) => s + Number(t.budget_amount || 0), 0), [filteredForSummary]);
  const totalSpentAll = useMemo(() => filteredForSummary.reduce((s, t) => s + Number(t.spent_amount || 0), 0), [filteredForSummary]);
  const totalBalance = useMemo(() => totalBudget - totalSpentAll, [totalBudget, totalSpentAll]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Conciliação de Viagens</h1>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto max-w-xs sm:max-w-none">
            <Button onClick={() => window.location.assign('/')} variant="outline" className="w-full sm:w-auto">Home</Button>
            <Button onClick={loadTrips} variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
              <RefreshCw className="h-5 w-5" /> Atualizar
            </Button>
            <Button onClick={() => setShowNewTrip(true)} className="flex items-center gap-2 w-full sm:w-auto">
              <PlusCircle className="h-5 w-5" /> Nova Viagem
            </Button>
          </div>
        </div>

        {/* Resumo global (já respeita permissão pois trips vem filtrado para não-admin) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Orçamento total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Gasto total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSpentAll.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Saldo total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="open">Abertas</TabsTrigger>
            <TabsTrigger value="closed">Fechadas</TabsTrigger>
          </TabsList>

          <div className="flex mb-4 gap-2 items-center">
            <Input placeholder="Buscar por título, descrição, usuário ou centro de custo" value={search} onChange={e => setSearch(e.target.value)} />
            <select
              className="border rounded h-10 px-3 bg-background"
              value={filterCostCenterId}
              onChange={e => setFilterCostCenterId(e.target.value)}
            >
              <option value="">Centro de Custo</option>
              {costCenters.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.name}</option>
              ))}
            </select>
          </div>

          <TabsContent value="open">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrips.map(trip => (
                <Card key={trip.id} className="hover:shadow-md transition">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{trip.title}</span>
                      <span className="text-xs text-muted-foreground">{trip.users?.name || "-"}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm text-muted-foreground break-words whitespace-pre-line">
                      {trip.description || "Sem descrição"}
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-600" /> Orçamento: R$ {Number(trip.budget_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm">Gasto: R$ {Number(trip.spent_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm font-semibold">Saldo: R$ {Number(trip.budget_amount - trip.spent_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowTripDetail(trip)}>Ver detalhes</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="closed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrips.map(trip => (
                <Card key={trip.id} className="hover:shadow-md transition">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{trip.title}</span>
                      <span className="text-xs text-muted-foreground">{trip.users?.name || "-"}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm text-muted-foreground">Fechada em {trip.updated_at?.slice(0,10)}</div>
                    <div className="text-sm">Gasto final: R$ {Number(trip.spent_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowTripDetail(trip)}>Ver detalhes</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showNewTrip} onOpenChange={setShowNewTrip}>
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-3xl h-[92vh] sm:h-auto overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Nova Viagem</DialogTitle>
          </DialogHeader>
          <NewTripForm onCreated={() => { setShowNewTrip(false); loadTrips(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!showTripDetail} onOpenChange={(o) => { if (!o) setShowTripDetail(null); }}>
        <DialogContent className="w-[100svw] max-w-[100svw] sm:max-w-5xl sm:w-auto max-h-[92svh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6 rounded-none sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Detalhe da Viagem</DialogTitle>
          </DialogHeader>
          {showTripDetail && (
            <div className="max-h-[80svh] sm:max-h-[70vh] overflow-y-auto overscroll-contain pr-1">
              <TripDetail trip={showTripDetail} onClose={() => setShowTripDetail(null)} onChanged={loadTrips} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      
    </div>
  );
};

  const NewTripForm: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
    const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
    const [costCenterId, setCostCenterId] = useState<string>("");
  const [saving, setSaving] = useState(false);

    useEffect(() => {
      (async () => {
        const { data } = await (supabase as any)
          .from("trip_cost_centers")
          .select("id, name")
          .order("name", { ascending: true });
        setCostCenters(data || []);
      })();
    }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await createTrip({
        title,
        description,
        start_date: startDate || null,
        end_date: endDate || null,
        budget_amount: Number(budget || 0),
        user_id: user.id,
        cost_center_id: costCenterId || null,
      });
      toast({ title: "Viagem criada!" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao criar viagem", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label>Orçamento</Label>
          <Input type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} required />
        </div>
        <div>
          <Label>Início</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>Fim</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Centro de Custo</Label>
          <select
            className="border rounded h-10 px-3 w-full bg-background"
            value={costCenterId}
            onChange={e => setCostCenterId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {costCenters.map(cc => (
              <option key={cc.id} value={cc.id}>{cc.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
};

const TripDetail: React.FC<{ trip: Trip; onClose: () => void; onChanged: () => void }> = ({ trip, onClose, onChanged }) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiptsByExpense, setReceiptsByExpense] = useState<Record<string, { id: string; name: string; path: string; type: string; url?: string }[]>>({});
  const [currentBudget, setCurrentBudget] = useState<number>(Number(trip.budget_amount));
  const [budgetAdd, setBudgetAdd] = useState<string>("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [alertState, setAlertState] = useState<{open: boolean; title: string; message: string}>({ open: false, title: "", message: "" });
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState<string>("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTripExpenses(trip.id);
      setExpenses(data || []);
      // Carregar comprovantes e gerar URLs assinadas por despesa
      const map: Record<string, { id: string; name: string; path: string; type: string; url?: string }[]> = {};
      await Promise.all(
        (data || []).map(async (exp) => {
          const recs = await fetchTripReceipts(exp.id);
          const items = await Promise.all((recs || []).map(async (r) => {
            try {
              const url = await getSignedUrl(r.storage_path);
              return { id: r.id, name: r.file_name, path: r.storage_path, type: r.file_type, url };
            } catch {
              return { id: r.id, name: r.file_name, path: r.storage_path, type: r.file_type };
            }
          }));
          map[exp.id] = items;
        })
      );
      setReceiptsByExpense(map);
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao carregar despesas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [trip.id, toast]);

  useEffect(() => {
    // resetar estados ao trocar de viagem
    setExpenses([]);
    setReceiptsByExpense({});
    setNewDesc("");
    setNewAmount("");
    setFiles(null);
    setCloseNote("");
    setBudgetAdd("");
    setCurrentBudget(Number(trip.budget_amount));
    load();
  }, [load]);

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const balance = useMemo(() => Number(currentBudget) - totalSpent, [currentBudget, totalSpent]);

  const handleAddExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (adding) return;
    const normalizeNumber = (val: string) => {
      if (val == null) return NaN as any;
      const s = String(val).trim().replace(/\./g, "").replace(/,/g, ".");
      return Number(s);
    };
    const amountNum = normalizeNumber(newAmount);
    if (!newDesc.trim() || isNaN(amountNum)) {
      toast({ title: "Atenção", description: "Preencha descrição e valor válido.", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      console.log("[TripDetail] Adicionando despesa:", { tripId: trip.id, description: newDesc.trim(), amount: amountNum });
      toast({ title: "Adicionando despesa..." });
      const exp = await addTripExpense({ trip_id: trip.id, description: newDesc.trim(), amount: amountNum });
      console.log("[TripDetail] Despesa criada:", exp);
      if (files && files.length > 0) {
        const fileArray = Array.from(files);
        for (const f of fileArray) {
          console.log("[TripDetail] Enviando comprovante:", f.name, f.type, f.size);
          await uploadTripReceipt(trip.id, exp.id, f);
        }
      }
      setNewDesc(""); setNewAmount(""); setFiles(null);
      await load();
      onChanged();
      toast({ title: "Despesa adicionada!" });
    } catch (e: any) {
      console.error("[TripDetail] Erro ao adicionar despesa:", e);
      toast({ title: "Erro ao adicionar despesa", description: e?.message || JSON.stringify(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const toggleReconcile = async (expense: TripExpense) => {
    try {
      await updateTripExpense(expense.id, { reconciled: !expense.reconciled });
      await load();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao conciliar despesa", variant: "destructive" });
    }
  };

  const [closeNote, setCloseNote] = useState("");
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const handleCloseTrip = async () => {
    if (!user) return;
    const remaining = balance;
    if (remaining !== 0 && closeNote.trim().length < 3) {
      setAlertState({ open: true, title: "Descrição obrigatória", message: "Há saldo restante. Informe a descrição de fechamento antes de concluir." });
      return;
    }
    // bloquear fechamento sem todas despesas conciliadas
    const anyNotReconciled = expenses.some(e => !e.reconciled);
    if (anyNotReconciled) {
      setAlertState({ open: true, title: "Pendências de conciliação", message: "Concilie todas as despesas antes de fechar a viagem." });
      return;
    }
    try {
      await closeTripWithNote(trip.id, user.id, closeNote.trim() || undefined);
      toast({ title: "Viagem fechada!" });
      onChanged();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao fechar viagem", variant: "destructive" });
    }
  };

  const handleAddBudget = async () => {
    const add = Number(budgetAdd);
    if (isNaN(add) || add <= 0) {
      toast({ title: "Atenção", description: "Informe um valor válido para adicionar ao orçamento.", variant: "destructive" });
      return;
    }
    setBudgetSaving(true);
    try {
      const newBudget = Number(currentBudget) + add;
      const { error } = await (supabase as any)
        .from("trips")
        .update({ budget_amount: newBudget })
        .eq("id", trip.id);
      if (error) throw error;
      setCurrentBudget(newBudget);
      setBudgetAdd("");
      onChanged();
      toast({ title: "Orçamento atualizado!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao atualizar orçamento", variant: "destructive" });
    } finally {
      setBudgetSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base sm:text-lg">
            <span className="truncate max-w-[60%]">{trip.title}</span>
            <span className="text-xs text-muted-foreground">Orçamento: R$ {Number(currentBudget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm leading-tight">Descrição: <span className="break-words whitespace-pre-line">{trip.description || "-"}</span></div>
          <div className="text-sm leading-tight">Período: {trip.start_date || "-"} a {trip.end_date || "-"}</div>
          <div className="text-sm leading-tight">Centro de Custo: {trip.cost_center?.name || "-"}</div>
          <div className="text-sm leading-tight">Gasto calculado: R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div className="text-sm leading-tight font-semibold">Saldo: R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div className="text-sm leading-tight">Gasto x Orçamento: {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {Number(currentBudget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          {isAdmin && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Descrição do fechamento (obrigatória se houver saldo)</Label>
                <Input className="h-9" value={closeNote} onChange={e => setCloseNote(e.target.value)} placeholder="Ex: valor restante, justificativa, etc." />
              </div>
              <div className="grid grid-cols-1 gap-3 items-end sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Adicionar ao orçamento</Label>
                  <Input className="h-9" type="number" step="0.01" placeholder="0,00" value={budgetAdd} onChange={e => setBudgetAdd(e.target.value)} />
                </div>
                <div>
                  <Button className="w-full h-10" onClick={handleAddBudget} disabled={budgetSaving}>{budgetSaving ? "Atualizando..." : "Adicionar"}</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Alertas do detalhe */}
      <AlertDialog open={alertState.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertState.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertState.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertState({ open: false, title: "", message: "" })}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Despesas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={(e)=>{e.preventDefault(); handleAddExpense();}}>
            <div className="sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input className="h-9" value={newDesc} onChange={e => setNewDesc(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <Input className="h-9 w-full" type="text" inputMode="decimal" placeholder="0,00" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs">Comprovantes</Label>
              <Input className="h-9" type="file" multiple accept="image/*,application/pdf" onChange={e => setFiles(e.target.files)} />
            </div>
            <div className="col-span-1 sm:col-span-4 w-full">
              <Button className="h-10 w-full" type="submit" disabled={adding}>
                {adding ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-2">Descrição</th>
                  <th className="py-2 pr-2">Valor</th>
                  <th className="py-2 pr-2">Comprovantes</th>
                  <th className="py-2 pr-2">Conciliado</th>
                  <th className="py-2 pr-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id} className="border-t">
                    <td className="py-2 pr-2 break-words">{exp.description}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">R$ {Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 pr-2">
                      {receiptsByExpense[exp.id] && receiptsByExpense[exp.id].length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {receiptsByExpense[exp.id].map((r) => (
                            <Button
                              key={r.id}
                              variant="link"
                              className="p-0 h-auto text-[10px] sm:text-xs"
                              onClick={async () => {
                                try {
                                  setViewerLoading(true);
                                  const url = r.url || await getSignedUrl(r.path);
                                  if (!url) throw new Error('URL inválida');
                                  setViewerUrl(url);
                                  setViewerType(r.type);
                                } catch (e) {
                                  toast({ title: 'Erro', description: 'Falha ao abrir comprovante', variant: 'destructive' });
                                } finally {
                                  setViewerLoading(false);
                                }
                              }}
                            >
                              {r.name.length > 16 ? r.name.slice(0, 16) + '…' : r.name}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px] sm:text-xs">Nenhum</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">{exp.reconciled ? <span className="text-green-600">OK</span> : <span className="text-amber-600">Pendente</span>}</td>
                    <td className="py-2 flex gap-2">
                      <Button className="h-8 px-2" size="sm" variant="outline" onClick={() => toggleReconcile(exp)}>{exp.reconciled ? "Desfazer" : "Conferir"}</Button>
                      <Button className="h-8 px-2" size="sm" variant="destructive" onClick={async () => { await deleteTripExpense(exp.id); await load(); }}>Excluir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            <div className="flex justify-between items-center pt-2">
            <div className="text-sm">Total despesas: R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    // Persistir nota de fechamento (se digitada) e orçamento atual, se mudou
                    await updateTrip(trip.id, {
                      close_note: (closeNote || "").trim() || null,
                      budget_amount: Number(currentBudget),
                    });
                  } catch {}
                  await load();
                  onClose();
                }}
              >
                Atualizar
              </Button>
              {(isAdmin || user?.id === trip.user_id) && trip.status === "open" && (
                <Button onClick={handleCloseTrip}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Fechar Viagem
                </Button>
              )}
              {user?.id === "3fdb0cda-0282-4802-9147-7c3706d3868e" && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm("Tem certeza que deseja excluir esta viagem e todos os dados/imagens? Esta ação não pode ser desfeita.")) return;
                    try {
                      await deleteTripDeep(trip.id);
                      toast({ title: "Viagem excluída" });
                      onChanged();
                      onClose();
                    } catch (e: any) {
                      toast({ title: "Erro", description: e?.message || "Falha ao excluir viagem", variant: "destructive" });
                    }
                  }}
                >
                  Excluir Viagem
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Modal de visualização de comprovante */}
      <Dialog open={viewerLoading || !!viewerUrl} onOpenChange={(open) => { if (!open) { setViewerUrl(null); setViewerType(null); setViewerLoading(false); } }}>
        <DialogContent className="max-w-2xl">
          {viewerLoading ? (
            <div className="text-center">Carregando comprovante...</div>
          ) : viewerUrl && viewerType?.startsWith('image') ? (
            <img src={viewerUrl} alt="Comprovante" className="max-h-[70vh] mx-auto" />
          ) : viewerUrl && viewerType?.includes('pdf') ? (
            <iframe src={viewerUrl} title="Comprovante PDF" className="w-full h-[70vh]" />
          ) : viewerUrl ? (
            <div className="text-center">
              <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Abrir comprovante</a>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ViagensPage;



