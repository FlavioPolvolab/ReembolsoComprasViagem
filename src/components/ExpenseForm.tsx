import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarIcon, Upload, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  createExpense,
  fetchCategories,
  fetchCostCenters,
} from "@/services/expenseService";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  description: z.string().min(1, { message: "Descrição é obrigatória" }),
  amount: z.string().min(1, { message: "Valor é obrigatório" }),
  purpose: z.string().min(1, { message: "Finalidade é obrigatória" }),
  costCenterId: z.string().min(1, { message: "Centro de custo é obrigatório" }),
  categoryId: z.string().min(1, { message: "Categoria é obrigatória" }),
  paymentDate: z.date({
    required_error: "Data de pagamento é obrigatória",
  }),
  receipts: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ExpenseFormProps {
  onSubmit?: (data: any) => void;
  onClose?: () => void;
}

const ExpenseForm = ({ onSubmit, onClose }: ExpenseFormProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const loadFormData = async () => {
      setError(null);
      try {
        const [categoriesData, costCentersData] = await Promise.all([
          fetchCategories(),
          fetchCostCenters(),
        ]);

        if (!categoriesData || categoriesData.length === 0) {
          throw new Error("Não foi possível carregar as categorias");
        }

        if (!costCentersData || costCentersData.length === 0) {
          throw new Error("Não foi possível carregar os centros de custo");
        }

        setCategories(categoriesData);
        setCostCenters(costCentersData);
      } catch (err) {
        console.error("Error loading form data:", err);
        setError(
          "Falha ao carregar dados do formulário. Por favor, tente novamente.",
        );
        toast({
          title: "Erro",
          description:
            "Falha ao carregar dados do formulário. Por favor, tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFormData();
  }, [toast]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      amount: "",
      purpose: "Reembolso",
      costCenterId: "",
      categoryId: "",
      paymentDate: new Date(),
    },
  });

  const selectedDate = watch("paymentDate");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitForm = async (data: FormValues) => {
    setError(null);

    if (!user) {
      setError("Você precisa estar logado para enviar uma despesa.");
      toast({
        title: "Erro",
        description: "Você precisa estar logado para enviar uma despesa.",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0) {
      setError("Por favor, anexe pelo menos um comprovante.");
      toast({
        title: "Erro",
        description: "Por favor, anexe pelo menos um comprovante.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate and convert amount to number
      let amountValue: number;
      try {
        // Handle both comma and period as decimal separators
        const normalizedAmount = data.amount
          .replace(/\./g, "")
          .replace(",", ".");
        amountValue = parseFloat(normalizedAmount);

        if (isNaN(amountValue) || amountValue <= 0) {
          throw new Error("Valor inválido");
        }
      } catch (err) {
        setError("Por favor, insira um valor válido.");
        toast({
          title: "Erro",
          description: "Por favor, insira um valor válido.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const expenseData = {
        user_id: user.id,
        name: data.name,
        description: data.description,
        amount: amountValue,
        purpose: data.purpose,
        cost_center_id: data.costCenterId,
        category_id: data.categoryId,
        payment_date: data.paymentDate.toISOString().split("T")[0],
        status: "pending" as "pending",
      };

      const result = await createExpense(expenseData, files);

      toast({
        title: "Sucesso",
        description: "Despesa enviada com sucesso!",
      });

      reset();
      setFiles([]);

      if (onSubmit) {
        onSubmit(result);
      }

      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      console.error("Error submitting expense:", err);
      const errorMessage =
        err.message || "Falha ao enviar despesa. Por favor, tente novamente.";
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-3xl mx-auto bg-white">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Carregando dados do formulário...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto bg-white">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          Solicitação de Reembolso de Despesa
        </CardTitle>
        <CardDescription>
          Preencha o formulário abaixo para enviar sua solicitação de reembolso
          de despesa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                {...register("name")}
                className={cn(errors.name && "border-red-500")}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                placeholder="0,00"
                {...register("amount")}
                className={cn(errors.amount && "border-red-500")}
                onBlur={(e) => {
                  try {
                    // Format the number with Brazilian currency format
                    const value = e.target.value.replace(/[^0-9,.-]/g, "");
                    if (value) {
                      const normalizedValue = value
                        .replace(/\./g, "")
                        .replace(",", ".");
                      const number = parseFloat(normalizedValue);
                      if (!isNaN(number)) {
                        e.target.value = number.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      }
                    }
                  } catch (err) {
                    // Keep the original value if formatting fails
                    console.error("Error formatting amount:", err);
                  }
                }}
              />
              {errors.amount && (
                <p className="text-sm text-red-500">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva sua despesa"
              {...register("description")}
              className={cn(errors.description && "border-red-500")}
            />
            {errors.description && (
              <p className="text-sm text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="purpose">Finalidade</Label>
              <Select
                defaultValue="Reembolso"
                onValueChange={(value) => setValue("purpose", value)}
              >
                <SelectTrigger
                  id="purpose"
                  className={cn(errors.purpose && "border-red-500")}
                >
                  <SelectValue placeholder="Selecione a finalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reembolso">Reembolso</SelectItem>
                  <SelectItem value="Pagamento">Pagamento</SelectItem>
                </SelectContent>
              </Select>
              {errors.purpose && (
                <p className="text-sm text-red-500">{errors.purpose.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="costCenterId">Centro de Custo</Label>
              <Select
                onValueChange={(value) => setValue("costCenterId", value)}
              >
                <SelectTrigger
                  id="costCenterId"
                  className={cn(errors.costCenterId && "border-red-500")}
                >
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.length > 0 ? (
                    costCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-data" disabled>
                      Nenhum centro de custo disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.costCenterId && (
                <p className="text-sm text-red-500">
                  {errors.costCenterId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoria</Label>
              <Select onValueChange={(value) => setValue("categoryId", value)}>
                <SelectTrigger
                  id="categoryId"
                  className={cn(errors.categoryId && "border-red-500")}
                >
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-data" disabled>
                      Nenhuma categoria disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-red-500">
                  {errors.categoryId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Data de Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      errors.paymentDate && "border-red-500",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(selectedDate, "dd/MM/yyyy")
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setValue("paymentDate", date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              {errors.paymentDate && (
                <p className="text-sm text-red-500">
                  {errors.paymentDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipts" className="flex items-center">
              Upload de Comprovante <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="receipts"
                className={cn(
                  "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100",
                  files.length === 0 ? "border-red-300" : "border-gray-300",
                )}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">
                      Clique para fazer upload
                    </span>{" "}
                    ou arraste e solte
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, PNG, JPG (MÁX. 10MB)
                  </p>
                </div>
                <input
                  id="receipts"
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            {files.length === 0 && (
              <p className="text-sm text-red-500">
                Pelo menos um comprovante é obrigatório
              </p>
            )}
            {files.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Arquivos enviados:</h4>
                <ul className="space-y-2">
                  {files.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    >
                      <span className="text-sm truncate max-w-[80%]">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || files.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Solicitação"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={() => {
            reset();
            setFiles([]);
            setError(null);
          }}
          disabled={isSubmitting}
        >
          Limpar Formulário
        </Button>
        {onClose && (
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ExpenseForm;
