import { Suspense, useEffect, useState } from "react";
import {
  useRoutes,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Home from "./components/home";
import LoginForm from "./components/auth/LoginForm";
import SignupForm from "./components/auth/SignupForm";
import AuthLayout from "./components/layout/AuthLayout";
import AdminPanel from "./components/admin/AdminPanel";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import routes from "tempo-routes";
import HomeSelector from "./pages/HomeSelector";
import PedidosTable from "./pages/compras/PedidosTable";
import NovoPedido from "./pages/compras/NovoPedido";
import ViagensPage from "./pages/viagens/ViagensPage";

// Componente para proteger rotas baseado em papéis
const RoleProtectedRoute = ({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole: string;
}) => {
  const { isLoading, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !hasRole(requiredRole as any)) {
      navigate("/", { replace: true, state: { from: location } });
    }
  }, [isLoading, hasRole, requiredRole, navigate, location]);

  if (isLoading) {
    return <p>Carregando...</p>;
  }

  return hasRole(requiredRole as any) ? <>{children}</> : null;
};

function App() {
  const [openNovoPedido, setOpenNovoPedido] = useState(true); // ou false, conforme sua lógica
  return (
    <AuthProvider>
      <Suspense fallback={<p>Loading...</p>}>
        <>
          <Routes>
            <Route element={<AuthLayout requireAuth={false} />}>
              <Route path="/login" element={<LoginForm />} />
              <Route path="/signup" element={<SignupForm />} />
            </Route>

            <Route element={<AuthLayout requireAuth={true} />}>
              <Route path="/" element={<HomeSelector />} />
              <Route path="/reembolso/*" element={<Home />} />
              <Route path="/compras" element={<PedidosTable />} />
              <Route path="/compras/novo" element={<NovoPedido open={openNovoPedido} onOpenChange={setOpenNovoPedido} onSuccess={() => setOpenNovoPedido(false)} />} />
              <Route path="/viagens" element={<ViagensPage />} />
            </Route>

            {/* Add this to allow Tempo routes to work */}
            {import.meta.env.VITE_TEMPO === "true" && (
              <Route path="/tempobook/*" />
            )}
          </Routes>
          {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
        </>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
