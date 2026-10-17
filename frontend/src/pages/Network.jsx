import { useEffect, useState, useMemo } from "react";
import {
  Network as NetworkIcon,
  Users,
  Link2,
  Search,
  Layers,
  ShieldAlert,
  Sparkles,
  Upload,
  FolderKanban
} from "lucide-react";
import { Link } from "react-router-dom";
import NetworkGraph from "../components/NetworkGraph";
import { getGlobalNetwork } from "../services/api";
import { useInvestigation } from "../context/InvestigationContext";

function Network() {
  const { activeInvestigation } = useInvestigation();
  const invId = activeInvestigation?.id;

  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadNetwork() {
      try {
        setLoading(true);
        setError("");
        const response = await getGlobalNetwork(invId);
        setNetwork(response.data);
      } catch (err) {
        console.error("Failed to load global network:", err);
        setError("Failed to connect to Neo4j graph engine.");
      } finally {
        setLoading(false);
      }
    }

    loadNetwork();
  }, [invId]);

  const nodes = network?.nodes || [];
  const relationships = network?.relationships || [];

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();
    return nodes.filter((node) =>
      String(node.label || "").toLowerCase().includes(term) ||
      String(node.id || "").toLowerCase().includes(term) ||
      String(node.type || "").toLowerCase().includes(term)
    );
  }, [nodes, search]);

  const personCount = useMemo(
    () => nodes.filter((n) => String(n.type).toLowerCase() === "person").length,
    [nodes]
  );
  const caseCount = useMemo(
    () => nodes.filter((n) => String(n.type).toLowerCase() === "case").length,
    [nodes]
  );
  const entityCount = nodes.length - personCount;

  if (loading) {
    return (
      <main className="dashboard">
        <div className="dashboard-header">
          <h1>TRACE-X Global Criminal Network</h1>
          <p>Compiling graph nodes, associations, and intelligence entities...</p>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Constructing multi-entity graph layout...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="dashboard">
        <div className="empty-state error">
          <ShieldAlert size={36} />
          <h3>Network Unavailable</h3>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      {/* HEADER */}
      <div className="dashboard-header flex justify-between items-start">
        <div className="header-title-block">
          <div className="header-badge">
            <Sparkles size={13} />
            TRACE-X GRAPH WORKBENCH
          </div>
          <h1>{activeInvestigation?.name || "TRACE-X Global Criminal Network"}</h1>
          <p>
            Investigation File: <strong>{activeInvestigation?.id || "INV-DEMO-001"}</strong> • Holistic graph visualization of suspects, communications, vehicles, and case linkages.
          </p>
        </div>

        <div className="header-actions-group">
          <Link to="/import" className="secondary-action-btn">
            <Upload size={15} />
            <span>Import Evidence</span>
          </Link>
          <Link to="/investigations" className="secondary-action-btn">
            <FolderKanban size={15} />
            <span>Switch Case</span>
          </Link>
        </div>
      </div>

      {/* METRIC STRIP */}
      <div className="stats-grid stats-grid-compact">
        <div className="stat-card">
          <div className="stat-icon person-theme">
            <Users size={20} />
          </div>
          <div>
            <p>Suspects</p>
            <h2>{personCount}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon entity-theme">
            <Layers size={20} />
          </div>
          <div>
            <p>Connected Entities</p>
            <h2>{entityCount}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon link-theme">
            <Link2 size={20} />
          </div>
          <div>
            <p>Active Links</p>
            <h2>{relationships.length}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon case-theme">
            <NetworkIcon size={20} />
          </div>
          <div>
            <p>Syndicate Cases</p>
            <h2>{caseCount}</h2>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="network-controls-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search network by ID, name, vehicle number, phone, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch("")}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* EMPTY NETWORK STATE */}
      {nodes.length === 0 ? (
        <div className="empty-state">
          <NetworkIcon size={44} className="text-slate-500 mb-2" />
          <h3>Empty Investigation Network</h3>
          <p>No criminal entities or evidence have been uploaded to this investigation file yet.</p>
          <Link to="/import" className="commit-import-btn mt-3" style={{ width: "auto" }}>
            <Upload size={16} />
            <span>Import Evidence to this Investigation</span>
          </Link>
        </div>
      ) : (
        /* GRAPH CANVAS WRAPPER */
        <div className="detail-card network-main-card">
          <div className="detail-card-header">
            <NetworkIcon size={20} className="text-cyan-400" />
            <div className="network-card-header-info">
              <h2>TRACE-X Graph Explorer</h2>
              <p>
                Click Person nodes to open their full dossier. Click other entities to inspect metadata. Drag to arrange.
              </p>
            </div>
          </div>

          <NetworkGraph
            network={{
              nodes: filteredNodes,
              relationships,
            }}
            height={540}
          />

          {/* NETWORK LEGEND */}
          <div className="network-legend-bar">
            <div className="legend-item">
              <span className="legend-dot person"></span>
              <span>Person (Click for Dossier)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot case"></span>
              <span>Case</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot phone"></span>
              <span>Phone</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot vehicle"></span>
              <span>Vehicle</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot location"></span>
              <span>Location</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Network;