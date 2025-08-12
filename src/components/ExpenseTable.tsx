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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Expense {
  id: string;
  name: string;
  description: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  date: string;
  purpose: string;
  costCenter: string;
  category: string;
  paymentDate: string;
  payment_status?: string;
  receipt?: string;
}

interface ExpenseTableProps {
  expenses?: Expense[];
  onViewDetails?: (expense: Expense) => void;
  onApprove?: (expense: Expense) => void;
  onReject?: (expense: Expense) => void;
  onBulkAction?: (expenses: Expense[], action: "approve" | "reject") => void;
  showPaymentStatus?: boolean;
  onBulkMarkPaid?: (expenses: Expense[]) => void;
  isAdmin?: boolean;
  hasRole?: (role: string) => boolean;
  onDelete?: (expense: Expense) => void;
}

const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses = [],
  onViewDetails,
  onApprove = () => {},
  onReject = () => {},
  onBulkAction = () => {},
  showPaymentStatus = false,
  onBulkMarkPaid = () => {},
  isAdmin = false,
  hasRole,
  onDelete,
}) => {
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Expense;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Handle sorting
  const requestSort = (key: keyof Expense) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting
  const sortedExpenses = React.useMemo(() => {
    const sortableExpenses = [...expenses];
    if (sortConfig !== null) {
      sortableExpenses.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableExpenses;
  }, [expenses, sortConfig]);

  // Handle checkbox selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedExpenses(sortedExpenses.map((expense) => expense.id));
    } else {
      setSelectedExpenses([]);
    }
  };

  const handleSelectOne = (checked: boolean, expenseId: string) => {
    if (checked) {
      setSelectedExpenses([...selectedExpenses, expenseId]);
    } else {
      setSelectedExpenses(selectedExpenses.filter((id) => id !== expenseId));
    }
  };

  // Handle bulk actions
  const handleBulkApprove = () => {
    const selectedItems = expenses.filter((expense) =>
      selectedExpenses.includes(expense.id),
    );
    onBulkAction(selectedItems, "approve");
    setSelectedExpenses([]);
  };

  const handleBulkReject = () => {
    const selectedItems = expenses.filter((expense) =>
      selectedExpenses.includes(expense.id),
    );
    onBulkAction(selectedItems, "reject");
    setSelectedExpenses([]);
  };

  const handleBulkMarkPaid = () => {
    const selectedItems = expenses.filter((expense) =>
      selectedExpenses.includes(expense.id),
    );
    onBulkMarkPaid(selectedItems);
    setSelectedExpenses([]);
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedExpenses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pendente
          </Badge>
        );
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Bulk actions */}
      {isAdmin && selectedExpenses.length > 0 && (
        <div className="p-4 bg-muted/20 border-b flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedExpenses.length} itens selecionados
          </span>
          <div className="space-x-2">
            {showPaymentStatus ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkMarkPaid}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Pago Selecionados
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkApprove}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Aprovar Selecionados
              </Button>
            )}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedExpenses.length === expenses.length}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort("name")}>Nome</TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort("description")}>Descrição</TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort("amount")}>Valor</TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort("status")}>Status</TableHead>
              {showPaymentStatus && (
                <TableHead>Status do Pagamento</TableHead>
              )}
              <TableHead className="cursor-pointer" onClick={() => requestSort("date")}>Data</TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort("costCenter")}>Centro de Custo</TableHead>
              <TableHead className="cursor-pointer" onClick={() => requestSort("category")}>Categoria</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedExpenses.includes(expense.id)}
                    onCheckedChange={(checked) =>
                      handleSelectOne(!!checked, expense.id)
                    }
                  />
                </TableCell>
                <TableCell>{expense.name}</TableCell>
                <TableCell>{expense.description}</TableCell>
                <TableCell>{formatCurrency(expense.amount)}</TableCell>
                <TableCell>{getStatusBadge(expense.status)}</TableCell>
                {showPaymentStatus && (
                  <TableCell>
                    {expense.payment_status === "paid" ? (
                      <Badge className="bg-green-100 text-green-800">Pago</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {new Date(expense.date).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>{expense.costCenter}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Abrir menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails(expense)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalhes
                      </DropdownMenuItem>
                      {expense.status === "pending" && (
                        <>
                          {hasRole && hasRole('approver') && (
                            <DropdownMenuItem onClick={() => onApprove(expense)}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onReject(expense)}>
                            <XCircle className="mr-2 h-4 w-4 text-red-600" />
                            Rejeitar
                          </DropdownMenuItem>
                          {(isAdmin || (hasRole && hasRole('approver'))) && (
                            <DropdownMenuItem onClick={() => onDelete && onDelete(expense)}>
                              <XCircle className="mr-2 h-4 w-4 text-red-600" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="py-4 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      isActive={currentPage === page}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default ExpenseTable;
