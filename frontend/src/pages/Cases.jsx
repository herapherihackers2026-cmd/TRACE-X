import { useEffect, useState, useMemo } from "react";
import {
  FolderOpen,
  Search,
  Users,
  ArrowRight,
  MapPin,
  Calendar,
  ShieldAlert,
  FileText,
  Upload,
  FolderKanban
} from "lucide-react";
import { getCases } from "../services/api";
import { Link } from "react-router-dom";
import { useInvestigation } from "../context/InvestigationContext";

function Cases() {
  const { activeInvestigation } = useInvestigation();
  const invId = activeInvestigation?.id;

  const [cases, setCases] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCases() {
      try {
        setLoading(true);
        const response = await getCases(invId);
        setCases(response.data?.cases || []);
      } catch (err) {
        console.error("Failed to load cases:", err);
        setError("Failed to load cases dossier from database.");
      } finally {
        setLoading(false);
      }
    }

    loadCases();
  }, [invId]);

  const filteredCases = useMemo(() => {
    const text = search.toLowerCase();
    return cases.filter((item) => {
      return (
        String(item.id || "").toLowerCase().includes(text) ||
        String(item.name || "").toLowerCase().includes(text) ||
        String(item.type || "").toLowerCase().includes(text) ||
        String(item.location || "").toLowerCase().includes(text) ||
        String(item.status || "").toLowerCase().includes(text)
      );
    });
  }, [cases, search]);

  return (
    <main className="dashboard">
      {/* HEADER */}
      <div className="dashboard-header flex justify-between items-start">
        <div className="header-title-block">
          <div className="header-badge">
            <FolderOpen size={13} />
            TRACE-X INCIDENT DOSSIERS
          </div>
          <h1>{activeInvestigation?.name ? `${activeInvestigation.name} Cases` : "TRACE-X Active Case Files"}</h1>
          <p>
            Investigation: <strong>{activeInvestigation?.id || "INV-DEMO-001"}</strong> • Review criminal incident files, occurrence locations, and linked suspects.
          </p>
        </div>

        <div className="header-actions-group">
          <Link to="/import" className="secondary-action-btn">
            <Upload size={15} />
            <span>Add Incident</span>
          </Link>
          <Link to="/investigations" className="secondary-action-btn">
            <FolderKanban size={15} />
            <span>Switch Case</span>
          </Link>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="search-box">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search cases by Case ID, incident type, location, or status..."
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

      {/* LOADING */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading syndicate case files...</p>
        </div>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="empty-state error">
          <ShieldAlert size={36} />
          <h3>Error Loading Cases</h3>
          <p>{error}</p>
        </div>
      )}

      {/* CASES CARDS */}
      {!loading && !error && filteredCases.length > 0 && (
        <div className="cases-grid">
          {filteredCases.map((item) => (
            <div className="case-card" key={item.id}>
              <div className="case-card-header">
                <div className="case-title-left">
                  <div className="case-icon-box">
                    <FileText size={22} className="text-purple-400" />
                  </div>
                  <div>
                    <h3>{item.name}</h3>
                    <span className="case-id-tag">TRACE-X Case Ref: {item.id}</span>
                  </div>
                </div>
                <span className="case-status-badge">{item.status}</span>
              </div>

              <div className="case-meta-grid">
                <div className="case-meta-item">
                  <Calendar size={15} className="text-slate-400" />
                  <div>
                    <span className="meta-label">Incident Date</span>
                    <strong>{item.date || "Under Investigation"}</strong>
                  </div>
                </div>

                <div className="case-meta-item">
                  <MapPin size={15} className="text-orange-400" />
                  <div>
                    <span className="meta-label">Location</span>
                    <strong>{item.location}</strong>
                  </div>
                </div>
              </div>

              {/* ASSOCIATED SUSPECTS */}
              <div className="case-suspects-block">
                <div className="suspects-heading">
                  <Users size={14} />
                  <span>
                    Linked Suspects ({item.person_count || 0})
                  </span>
                </div>

                {item.persons?.length > 0 ? (
                  <div className="case-suspects-chips">
                    {item.persons.map((person) => (
                      <Link
                        key={person.id}
                        to={`/person/${encodeURIComponent(String(person.id))}`}
                        className="case-suspect-chip"
                        title={`Investigate ${person.name}`}
                      >
                        <span className="suspect-dot"></span>
                        <span className="suspect-chip-name">{person.name}</span>
                        <ArrowRight size={13} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="no-suspects-hint">No direct suspects logged yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EMPTY */}
      {!loading && !error && filteredCases.length === 0 && (
        <div className="empty-state">
          <ShieldAlert size={36} />
          <h3>No Cases Found</h3>
          <p>No criminal case files found in this investigation.</p>
        </div>
      )}
    </main>
  );
}

export default Cases;