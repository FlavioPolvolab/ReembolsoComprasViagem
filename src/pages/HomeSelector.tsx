import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const HomeSelector: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-extrabold text-center mb-8 bg-gradient-to-r from-indigo-600 to-cyan-600 text-transparent bg-clip-text">
          Escolha o sistema
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-xl transition border-0 bg-white/90 backdrop-blur rounded-2xl">
            <CardHeader>
              <CardTitle>Sistema de Reembolso</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Lance, acompanhe e aprove reembolsos.</p>
              <Button className="w-full h-11 bg-gradient-to-r from-indigo-600 to-cyan-600" onClick={() => navigate("/reembolso")}>Acessar</Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-xl transition border-0 bg-white/90 backdrop-blur rounded-2xl">
            <CardHeader>
              <CardTitle>Pedido de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Cadastre pedidos, anexe comprovantes e marque pagamentos.</p>
              <Button className="w-full h-11 bg-gradient-to-r from-indigo-600 to-cyan-600" onClick={() => navigate("/compras")}>Acessar</Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-xl transition border-0 bg-white/90 backdrop-blur rounded-2xl">
            <CardHeader>
              <CardTitle>Conciliação de Viagens</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Controle orçamento, despesas e fechamento.</p>
              <Button className="w-full h-11 bg-gradient-to-r from-indigo-600 to-cyan-600" onClick={() => navigate("/viagens")}>Acessar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HomeSelector; 