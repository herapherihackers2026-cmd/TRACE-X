import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Network,
  FolderOpen,
  Shield,
  Upload,
  FolderKanban,
  ChevronDown
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { testDatabase } from "../services/api";
import { useInvestigation } from "../context/InvestigationContext";

function Sidebar() {
  const [dbStatus, setDbStatus] = useState("checking");
  const {
    investigations,
    activeInvestigation,
    setActiveInvestigation,
  } = useInvestigation();

  useEffect(() => {
    let isMounted = true;

    const checkDb = async () => {
      try {
        const res = await testDatabase();
        if (isMounted) {
          if (res.data?.status === "success") {
            setDbStatus("online");
          } else {
            setDbStatus("error");
          }
        }
      } catch (err) {
        if (isMounted) setDbStatus("offline");
      }
    };

    checkDb();
    const interval = setInterval(checkDb, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleInvChange = (e) => {
    const invId = e.target.value;
    const found = investigations.find((i) => i.id === invId);
    if (found) {
      setActiveInvestigation(found);
    }
  };

  return (
    <aside className="sidebar">
      {/* BRAND / LOGO */}
      <div className="logo">
        <div className="logo-badge">
          <Shield size={22} className="logo-shield-icon" />
        </div>
        <div>
          <h2>TRACE-X</h2>
          <span>CRIMINAL NETWORK INTELLIGENCE</span>
        </div>
      </div>

      {/* QUICK INVESTIGATION SELECTOR */}
      <div className="sidebar-inv-selector-box">
        <div className="inv-selector-header">
          <span className="inv-label">ACTIVE INVESTIGATION</span>
          <span className="inv-node-badge">
            {activeInvestigation?.node_count ?? 0} Nodes
          </span>
        </div>

        <div className="inv-select-wrapper">
          <select
            value={activeInvestigation?.id || ""}
            onChange={handleInvChange}
            className="sidebar-inv-dropdown"
          >
            {investigations.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.id})
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-arrow" />
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">INTELLIGENCE</div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/network"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <Network size={18} />
          <span>Global Network</span>
        </NavLink>

        <NavLink
          to="/persons"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <Users size={18} />
          <span>Suspects Registry</span>
        </NavLink>

        <NavLink
          to="/cases"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <FolderOpen size={18} />
          <span>Cases Dossier</span>
        </NavLink>

        <div className="nav-section-title mt-3">EVIDENCE & INGESTION</div>

        <NavLink
          to="/import"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <Upload size={18} />
          <span>Import Data</span>
        </NavLink>

        <NavLink
          to="/investigations"
          className={({ isActive }) =>
            `nav-item ${isActive ? "active" : ""}`
          }
        >
          <FolderKanban size={18} />
          <span>Investigations</span>
        </NavLink>
      </nav>

      {/* FOOTER & STATUS */}
      <div className="sidebar-bottom">
        <div className={`system-status ${dbStatus}`}>
          <span className="status-indicator-wrapper">
            <span className={`status-dot ${dbStatus}`}></span>
            <span className="status-ping"></span>
          </span>
          <div className="status-text-block">
            <span className="status-title">Neo4j Engine</span>
            <span className="status-state">
              {dbStatus === "online" && "Connected & Live"}
              {dbStatus === "checking" && "Connecting..."}
              {dbStatus === "offline" && "Server Offline"}
              {dbStatus === "error" && "Database Error"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;