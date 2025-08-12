import React from "react";
import ExpenseForm from "@/components/ExpenseForm";
import { useNavigate } from "react-router-dom";

const NovoReembolsoPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-5xl mx-auto">
        <ExpenseForm
          onClose={() => navigate("/")}
          onSubmit={() => navigate("/")}
        />
      </div>
    </div>
  );
};

export default NovoReembolsoPage; 