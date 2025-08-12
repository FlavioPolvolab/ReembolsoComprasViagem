import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z
    .string()
    .min(6, { message: "Senha deve ter pelo menos 6 caracteres" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginForm = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        let errorMsg = "Falha ao fazer login. Verifique suas credenciais.";
        if (error.message.includes("Invalid login")) {
          errorMsg = "Email ou senha incorretos. Verifique suas credenciais.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMsg = "Email não confirmado. Verifique sua caixa de entrada.";
        }
        setError(errorMsg);
        toast({
          title: "Erro de login",
          description: errorMsg,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login realizado",
          description: "Você foi autenticado com sucesso!",
        });
        navigate("/");
      }
    } catch (err) {
      const errorMsg = "Ocorreu um erro ao fazer login. Tente novamente.";
      setError(errorMsg);
      toast({
        title: "Erro",
        description: errorMsg,
        variant: "destructive",
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-white/90 backdrop-blur rounded-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-cyan-600 text-transparent bg-clip-text">
            Bem-vindo
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Acesse sua conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@exemplo.com"
                {...register("email")}
                className={cn("h-11", errors.email && "border-red-500")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                {...register("password")}
                className={cn("h-11", errors.password && "border-red-500")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Button
              variant="link"
              className="p-0"
              onClick={() => navigate("/signup")}
            >
              Cadastre-se
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
