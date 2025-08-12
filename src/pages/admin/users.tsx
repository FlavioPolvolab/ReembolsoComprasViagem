import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import UserRegisterTab from "@/components/admin/UserRegisterTab";

const AdminUsersPage = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        </div>
        <UserRegisterTab />
      </div>
    </div>
  );
};

export default AdminUsersPage; 