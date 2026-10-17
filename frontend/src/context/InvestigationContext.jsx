import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getInvestigations, createInvestigation as apiCreateInvestigation } from "../services/api";

const InvestigationContext = createContext(null);

export function InvestigationProvider({ children }) {
  const [investigations, setInvestigations] = useState([]);
  const [activeInvestigation, setActiveInvestigationState] = useState(() => {
    try {
      const saved = localStorage.getItem("tracex_active_investigation");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refreshInvestigations = useCallback(async (selectId = null) => {
    try {
      setLoading(true);
      const res = await getInvestigations();
      const list = res.data?.investigations || [];
      setInvestigations(list);

      // Determine active investigation
      if (selectId) {
        const found = list.find((i) => i.id === selectId);
        if (found) {
          setActiveInvestigationState(found);
          localStorage.setItem("tracex_active_investigation", JSON.stringify(found));
          return;
        }
      }

      setActiveInvestigationState((prev) => {
        if (prev) {
          const current = list.find((i) => i.id === prev.id);
          if (current) {
            localStorage.setItem("tracex_active_investigation", JSON.stringify(current));
            return current;
          }
        }
        const defaultInv = list.find((i) => i.id === "INV-DEMO-001") || list[0] || null;
        if (defaultInv) {
          localStorage.setItem("tracex_active_investigation", JSON.stringify(defaultInv));
        }
        return defaultInv;
      });
    } catch (err) {
      console.error("Failed to load investigations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshInvestigations();
  }, [refreshInvestigations]);

  const setActiveInvestigation = (inv) => {
    setActiveInvestigationState(inv);
    if (inv) {
      localStorage.setItem("tracex_active_investigation", JSON.stringify(inv));
    } else {
      localStorage.removeItem("tracex_active_investigation");
    }
  };

  const createInvestigation = async (name, description = "") => {
    const res = await apiCreateInvestigation({ name, description });
    if (res.data?.success && res.data.investigation) {
      await refreshInvestigations(res.data.investigation.id);
      return res.data.investigation;
    }
    throw new Error(res.data?.message || "Failed to create investigation");
  };

  return (
    <InvestigationContext.Provider
      value={{
        investigations,
        activeInvestigation,
        setActiveInvestigation,
        refreshInvestigations,
        createInvestigation,
        loading,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigation() {
  const ctx = useContext(InvestigationContext);
  if (!ctx) {
    throw new Error("useInvestigation must be used within an InvestigationProvider");
  }
  return ctx;
}
