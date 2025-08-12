import React, { useState, useEffect } from "react";
import { Search, Calendar, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange, SelectRangeEventHandler } from "react-day-picker";
import { fetchCategories, fetchCostCenters } from "@/services/expenseService";
import { format } from "date-fns";

interface FilterBarProps {
  onFilterChange?: (filters: {
    search: string;
    status: string;
    category: string;
    costCenter: string;
    dateRange: { from: Date | undefined; to: Date | undefined };
  }) => void;
}

const FilterBar = ({ onFilterChange = () => {} }: FilterBarProps) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [categories, setCategories] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  // Carregar categorias e centros de custo do banco de dados
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [categoriesData, costCentersData] = await Promise.all([
          fetchCategories(),
          fetchCostCenters(),
        ]);
        setCategories(categoriesData || []);
        setCostCenters(costCentersData || []);
      } catch (error) {
        console.error("Erro ao carregar dados para filtros:", error);
      }
    };

    loadFilterData();
  }, []);

  const handleFilterChange = () => {
    onFilterChange({
      search,
      status,
      category,
      costCenter,
      dateRange,
    });
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setCategory("");
    setCostCenter("");
    setDateRange({ from: undefined, to: undefined });
    onFilterChange({
      search: "",
      status: "",
      category: "",
      costCenter: "",
      dateRange: { from: undefined, to: undefined },
    });
  };

  return (
    <div className="w-full p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar despesas..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onFilterChange({
                search: e.target.value,
                status: "",
                category: "",
                costCenter: "",
                dateRange: { from: undefined, to: undefined }
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
