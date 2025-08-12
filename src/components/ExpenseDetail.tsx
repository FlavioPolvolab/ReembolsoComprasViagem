import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, FileText, Download, Loader2, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchExpenseById,
  updateExpenseStatus,
  getReceiptUrl,
  updatePaymentStatus,
  deleteExpense,
} from "@/services/expenseService";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Receipt {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
}

interface ExpenseDetailProps {
  expenseId: string;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

const TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Tempo limite excedido ao carregar detalhes.")), ms))
  ]);
}

const ExpenseDetail: React.FC<ExpenseDetailProps> = ({
  expenseId,
  isOpen = false,
  onClose = () => {},
  onStatusChange = () => {},
}) => {
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});
  const { isAdmin, hasRole } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setError(null);
    if (isOpen && expenseId) {
      (async () => {
    setLoading(true);
    try {
          const data = await withTimeout(fetchExpenseById(expenseId), TIMEOUT_MS);
          if (!isCurrent) return;
      setExpense(data);

      // Load receipt URLs
      if (data.receipts && data.receipts.length > 0) {
        const urls: Record<string, string> = {};
        for (const receipt of data.receipts) {
          try {
            const url = await getReceiptUrl(receipt.storage_path);
                if (!isCurrent) return;
            urls[receipt.id] = url;
          } catch (error) {
                if (!isCurrent) return;
            console.error(`Erro ao carregar URL do comprovante ${receipt.id}:`, error);
          }
        }
        setReceiptUrls(urls);
      }
        } catch (error: any) {
          if (!isCurrent) return;
          setExpense(null);
          setError(error?.message || "Erro ao carregar detalhes do reembolso.");
      toast({
            title: "Erro",
            description: error?.message || "Falha ao carregar detalhes do reembolso.",
        variant: "destructive",
      });
    } finally {
          if (isCurrent) setLoading(false);
        }
      })();
    }
    return () => { isCurrent = false; };
  }, [isOpen, expenseId]);

  const handleApprove = async () => {
    if (!expense) return;

    setIsSubmitting(true);
    try {
      await updateExpenseStatus(expense.id, "approved");
      toast({
        title: "Success",
        description: "Expense approved successfully.",
      });
      onStatusChange();
      onClose();
    } catch (error) {
      console.error("Error approving expense:", error);
      toast({
        title: "Error",
        description: "Failed to approve expense.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!expense) return;

    if (showRejectForm) {
      if (!rejectionReason.trim()) return;

      setIsSubmitting(true);
      try {
        await updateExpenseStatus(expense.id, "rejected", rejectionReason);
        toast({
          title: "Success",
          description: "Expense rejected successfully.",
        });
        setRejectionReason("");
        setShowRejectForm(false);
        onStatusChange();
        onClose();
      } catch (error) {
        console.error("Error rejecting expense:", error);
        toast({
          title: "Error",
          description: "Failed to reject expense.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setShowRejectForm(true);
    }
  };

  const handleCancelReject = () => {
    setShowRejectForm(false);
    setRejectionReason("");
  };

  const handlePaymentStatusChange = async (isPaid: boolean) => {
    try {
      await updatePaymentStatus(expenseId, isPaid);
      toast({
        title: "Sucesso",
        description: isPaid ? "Despesa marcada como paga" : "Status de pagamento atualizado",
      });
      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error("Erro ao atualizar status de pagamento:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status de pagamento",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    if (!window.confirm("Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteExpense(expense.id);
      toast({
        title: "Sucesso",
        description: "Despesa excluída com sucesso!",
      });
      if (onStatusChange) onStatusChange();
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a despesa.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR").format(date);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Aprovado</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">Rejeitado</Badge>;
      default:
        return <Badge className="bg-yellow-500">Pendente</Badge>;
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] bg-white">
          <VisuallyHidden>
            <DialogTitle>Carregando detalhes do reembolso</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando detalhes do reembolso...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
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

  if (!expense) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] bg-white">
          <DialogHeader>
            <DialogTitle>Expense Not Found</DialogTitle>
          </DialogHeader>
          <p>The requested expense could not be found.</p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] bg-white max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            <span>Detalhes do Reembolso</span>
            {getStatusBadge(expense.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-sm text-gray-500">Solicitante</h3>
              <p className="text-base">{expense.users?.name || "Unknown"}</p>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-500">Descrição</h3>
              <p className="text-base">{expense.description}</p>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-500">Valor</h3>
              <p className="text-lg font-bold">
                {formatCurrency(expense.amount)}
              </p>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-500">Finalidade</h3>
              <p className="text-base">{expense.purpose}</p>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-500">
                Centro de Custo
              </h3>
              <p className="text-base">{expense.cost_centers?.name}</p>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-500">Categoria</h3>
              <p className="text-base">{expense.categories?.name}</p>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-500">
                Data para Pagamento
              </h3>
              <p className="text-base">{formatDate(expense.payment_date)}</p>
            </div>

            <div>
              <h3 className="font-medium text-sm text-gray-500">
                Data de Submissão
              </h3>
              <p className="text-base">{formatDate(expense.submitted_date)}</p>
            </div>

            {expense.status === "rejected" && expense.rejection_reason && (
              <div>
                <h3 className="font-medium text-sm text-red-500">
                  Motivo da Rejeição
                </h3>
                <p className="text-base text-red-500">
                  {expense.rejection_reason}
                </p>
              </div>
            )}

            {expense.status === "approved" && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Status do Pagamento</h3>
                <div className="flex items-center gap-4">
                  <Button
                    variant={expense.payment_status === "paid" ? "default" : "outline"}
                    onClick={() => handlePaymentStatusChange(true)}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Pago
                  </Button>
                  <Button
                    variant={expense.payment_status !== "paid" ? "default" : "outline"}
                    onClick={() => handlePaymentStatusChange(false)}
                    className="flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Pendente
                  </Button>
                </div>
                {expense.payment_status === "paid" && expense.paid_at && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Pago em: {format(new Date(expense.paid_at), "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-sm text-gray-500">Comprovantes</h3>
            {expense.receipts && expense.receipts.length > 0 ? (
              <div className="space-y-4">
                {expense.receipts.map((receipt: Receipt) => (
                  <div key={receipt.id} className="space-y-2">
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        {receipt.file_type && receipt.file_type.startsWith("image") ? (
                          receiptUrls[receipt.id] ? (
                            <img
                              src={receiptUrls[receipt.id]}
                              alt={receipt.file_name}
                              className="w-full h-64 object-contain bg-gray-100"
                              onError={e => {
                                e.currentTarget.src = '/fallback-image.png';
                                console.error('Erro ao carregar imagem do comprovante:', receipt.file_name, receiptUrls[receipt.id]);
                              }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-64 bg-gray-100">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )
                        ) : (
                          <div className="flex items-center justify-center h-64 bg-gray-100">
                            <FileText size={48} className="text-gray-400" />
                            <span className="ml-2 text-gray-500">
                              {receipt.file_name}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {receiptUrls[receipt.id] && (
                      <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={() => window.open(receiptUrls[receipt.id], "_blank")}
                      >
                        <Download size={16} />
                        Baixar Comprovante
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-100 rounded-md">
                <p className="text-gray-500">Nenhum comprovante disponível</p>
              </div>
            )}
          </div>
        </div>

        {isAdmin && expense.status === "pending" && (
          <DialogFooter>
            {showRejectForm ? (
              <div className="w-full space-y-4">
                <Textarea
                  placeholder="Informe o motivo da rejeição"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="min-h-[100px]"
                  disabled={isSubmitting}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelReject}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Confirmar Rejeição"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Fechar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="flex items-center gap-1"
                  disabled={isSubmitting}
                >
                  <X size={16} />
                  Excluir
                </Button>
                <Button
                  onClick={handleApprove}
                  className="flex items-center gap-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Aprovar
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogFooter>
        )}

        {(!isAdmin || expense.status !== "pending") && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseDetail;
