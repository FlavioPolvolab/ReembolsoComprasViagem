import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { promoteToAdmin } from "@/services/adminService";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

const adminSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
});

type AdminFormValues = z.infer<typeof adminSchema>;

const AdminPanel = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de usuários.",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const onSubmit = async (data: AdminFormValues) => {
    setIsLoading(true);
    setResult(null);

    try {
      const result = await promoteToAdmin(data.email);
      setResult(result);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: result.message,
        });
        reset();
        fetchUsers(); // Atualizar a lista de usuários
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao promover usuário para administrador:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao promover o usuário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto bg-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Acesso Restrito</CardTitle>
          <CardDescription>
            Você não tem permissão para acessar esta página.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-md mx-auto bg-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Painel de Administração
          </CardTitle>
          <CardDescription>
            Promova um usuário para administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                {...register("email")}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Promover para Administrador"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="w-full mx-auto bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            Usuários do Sistema
          </CardTitle>
          <CardDescription>
            Lista de todos os usuários registrados no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-4 text-left">Nome</th>
                    <th className="py-2 px-4 text-left">Email</th>
                    <th className="py-2 px-4 text-left">Função</th>
                    <th className="py-2 px-4 text-left">Data de Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userItem) => (
                    <tr key={userItem.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">{userItem.name}</td>
                      <td className="py-2 px-4">{userItem.email}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${userItem.role === "admin" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
                        >
                          {userItem.role === "admin"
                            ? "Administrador"
                            : "Usuário"}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        {new Date(userItem.created_at).toLocaleDateString(
                          "pt-BR",
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhum usuário encontrado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
