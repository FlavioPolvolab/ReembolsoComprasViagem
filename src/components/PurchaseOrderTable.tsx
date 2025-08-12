import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Eye, CheckCircle, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PurchaseOrder {
  id: string;
  user_name?: string;
  description?: string;
  total_amount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  submitted_date?: string;
  is_paid?: boolean;
}

interface PurchaseOrderTableProps {
  orders: PurchaseOrder[];
  onViewDetails?: (order: PurchaseOrder) => void;
  onApprove?: (order: PurchaseOrder) => void;
  onReject?: (order: PurchaseOrder) => void;
  onBulkAction?: (orders: PurchaseOrder[], action: "approve" | "reject") => void;
  isAdmin?: boolean;
  hasRole?: (role: string) => boolean;
  onDelete?: (order: PurchaseOrder) => void;
  onMarkPaid?: (order: PurchaseOrder) => void;
}

const PurchaseOrderTable: React.FC<PurchaseOrderTableProps> = ({
  orders = [],
  onViewDetails,
  onApprove = () => {},
  onReject = () => {},
  onBulkAction = () => {},
  isAdmin = false,
  hasRole,
  onDelete,
  onMarkPaid,
}) => {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Seleção múltipla
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedOrders(orders.map((order) => order.id));
    else setSelectedOrders([]);
  };
  const handleSelectOne = (checked: boolean, orderId: string) => {
    if (checked) setSelectedOrders([...selectedOrders, orderId]);
    else setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
  };

  // Ações em massa
  const handleBulkApprove = () => {
    const selectedItems = orders.filter((order) => selectedOrders.includes(order.id));
    onBulkAction(selectedItems, "approve");
    setSelectedOrders([]);
  };
  const handleBulkReject = () => {
    const selectedItems = orders.filter((order) => selectedOrders.includes(order.id));
    onBulkAction(selectedItems, "reject");
    setSelectedOrders([]);
  };

  // Badge de status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">Aprovado</Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">Rejeitado</Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">Concluído</Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendente</Badge>
        );
    }
  };

  // Formatar moeda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Ações em massa */}
      {isAdmin && selectedOrders.length > 0 && (
        <div className="p-4 bg-muted/20 border-b flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedOrders.length} itens selecionados
          </span>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              className="text-green-600 border-green-600 hover:bg-green-50"
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              Aprovar Selecionados
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkReject}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <XCircle className="mr-1 h-4 w-4" />
              Rejeitar Selecionados
            </Button>
          </div>
        </div>
      )}
      {/* Tabela */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedOrders.includes(order.id)}
                    onCheckedChange={(checked) => handleSelectOne(!!checked, order.id)}
                  />
                </TableCell>
                <TableCell>{order.user_name || '-'}</TableCell>
                <TableCell>{order.description ? (order.description.length > 80 ? order.description.slice(0, 80) + '...' : order.description) : '-'}</TableCell>
                <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>{order.submitted_date ? new Date(order.submitted_date).toLocaleDateString("pt-BR") : '-'}</TableCell>
                <TableCell>
                  {order.is_paid ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">Pago</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {order.status === "approved" ? (
                    <div className="flex gap-2 items-center">
                      <Button variant="ghost" size="icon" onClick={() => onViewDetails && onViewDetails(order)}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Ver detalhes</span>
                      </Button>
                      {!order.is_paid && (
                        <Button variant="outline" size="sm" onClick={() => onMarkPaid && onMarkPaid(order)}>
                          <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                          Marcar como pago
                        </Button>
                      )}
                    </div>
                  ) : order.status === "pending" ? (
                    <div className="flex gap-2 items-center">
                      <Button variant="ghost" size="icon" onClick={() => onViewDetails && onViewDetails(order)}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Ver detalhes</span>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Abrir menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => onViewDetails && onViewDetails(order)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          {hasRole && hasRole("approver") && (
                            <DropdownMenuItem onClick={() => onApprove && onApprove(order)}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onReject && onReject(order)}>
                            <XCircle className="mr-2 h-4 w-4 text-red-600" />
                            Rejeitar
                          </DropdownMenuItem>
                          {(isAdmin || (hasRole && hasRole("approver"))) && (
                            <DropdownMenuItem onClick={() => onDelete && onDelete(order)}>
                              <XCircle className="mr-2 h-4 w-4 text-red-600" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Abrir menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onViewDetails && onViewDetails(order)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PurchaseOrderTable; 