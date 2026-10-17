import { useEffect, useState } from "react";
import {
  Users,
  FolderOpen,
  MapPin,
  Car,
  Phone,
  Network,
  Activity,
  ArrowRight,
  GitCommit,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Upload,
  FolderKanban
} from "lucide-react";
import { Link } from "react-router-dom";
import { getStats, getKeySuspects, getPersons, getPath } from "../services/api";
import { useInvestigation } from "../context/InvestigationContext";

function Dashboard() {
  const { activeInvestigation } = useInvestigation();

  const [stats, setStats] = useState(null);
  const [keySuspects, setKeySuspects] = useState([]);
  const [personsList, setPersonsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Path Tracer State
  const [sourcePerson, setSourcePerson] = useState("");
  const [targetPerson, setTargetPerson] = useState("");
  const [pathResult, setPathResult] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState("");

  const invId = activeInvestigation?.id;

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [statsRes, suspectsRes, personsRes] = await Promise.all([
          getStats(invId),
          getKeySuspects(invId),
          getPersons(invId),
        ]);

        setStats(statsRes.data);
        setKeySuspects(suspectsRes.data?.suspects || []);
        const persons = personsRes.data?.persons || [];
        setPersonsList(persons);

        if (persons.length >= 2) {
          setSourcePerson(persons[0].id);
          setTargetPerson(persons[persons.length - 1].id);
        } else if (persons.length === 1) {
          setSourcePerson(persons[0].id);
          setTargetPerson(persons[0].id);
        } else {
          setSourcePerson("");
          setTargetPerson("");
        }
        setPathResult(null);
        setPathError("");
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [invId]);

  const handleTracePath = async (e) => {
    e?.preventDefault();
    if (!sourcePerson || !targetPerson) return;
    if (sourcePerson === targetPerson) {
      setPathError("Please select two distinct individuals or entities.");
      setPathResult(null);
      return;
    }

    try {
      setPathLoading(true);
      setPathError("");
      const res = await getPath(sourcePerson, targetPerson, invId);
      if (res.data?.found) {
        setPathResult(res.data);
      } else {
        setPathResult(null);
        setPathError(res.data?.message || "No connection path detected between these entities.");
      }
    } catch (err) {
      console.error("Path search failed:", err);
      setPathError("Failed to calculate connection path.");
    } finally {
      setPathLoading(false);
    }
  };

  const statCards = [
    {
      title: "Suspects & Persons",
      value: stats?.persons ?? 0,
      icon: Users,
      color: "#ef4444",
      desc: "Tracked individuals",
    },
    {
      title: "Active Cases",
      value: stats?.cases ?? 0,
      icon: FolderOpen,
      color: "#a855f7",
      desc: "Syndicate incidents",
    },
    {
      title: "Identified Hotspots",
      value: stats?.locations ?? 0,
      icon: MapPin,
      color: "#f97316",
      desc: "Incident locations",
    },
    {
      title: "Associated Vehicles",
      value: stats?.vehicles ?? 0,
      icon: Car,
      color: "#22c55e",
      desc: "Transport & getaways",
    },
    {
      title: "Phone Intercepts",
      value: stats?.phones ?? 0,
      icon: Phone,
      color: "#38bdf8",
      desc: "Communication nodes",
    },
    {
      title: "Network Links",
      value: stats?.relationships ?? 0,
      icon: Network,
      color: "#eab308",
      desc: "Verified associations",
    },
  ];

  return (
    <main className="dashboard">
      {/* HEADER */}
      <div className="dashboard-header flex justify-between items-start">
        <div className="header-title-block">
          <div className="header-badge">
            <span className="badge-pulse"></span>
            TRACE-X INTELLIGENCE WORKBENCH
          </div>
          <h1>{activeInvestigation?.name || "TRACE-X Criminal Network Intelligence"}</h1>
          <p>
            Active Case File: <strong>{activeInvestigation?.id || "INV-DEMO-001"}</strong> • {activeInvestigation?.description || "Criminal network & syndicate intelligence analysis platform."}
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

      {/* STATS GRID */}
      <div className="stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="stat-card" key={card.title}>
              <div
                className="stat-icon"
                style={{
                  backgroundColor: `${card.color}15`,
                  borderColor: `${card.color}40`,
                }}
              >
                <Icon size={22} style={{ color: card.color }} />
              </div>
              <div className="stat-info">
                <span className="stat-title">{card.title}</span>
                <h2>{card.value}</h2>
                <span className="stat-desc">{card.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DASHBOARD TWO-COLUMN SECTION */}
      <div className="dashboard-columns-grid">
        {/* COLUMN 1: KEY SUSPECTS & SYNDICATE HUBS */}
        <div className="dashboard-section-card">
          <div className="section-card-header">
            <div className="section-title-group">
              <Flame size={20} className="text-red-500" />
              <div>
                <h2>Key Suspects & Syndicate Hubs</h2>
                <p>Ranked by network degree centrality and cross-case linkages</p>
              </div>
            </div>
            <Link to="/persons" className="section-link">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="loading-state">Analyzing network centrality...</div>
          ) : keySuspects.length === 0 ? (
            <div className="empty-sub-card">
              <Users size={28} className="text-slate-500 mb-2" />
              <p>No suspects identified in this investigation yet.</p>
              <Link to="/import" className="inline-action-link">
                Import evidence now &rarr;
              </Link>
            </div>
          ) : (
            <div className="suspects-table-list">
              {keySuspects.slice(0, 5).map((suspect, idx) => (
                <div className="suspect-ranking-item" key={suspect.id}>
                  <div className="ranking-number">#{idx + 1}</div>
                  <div className="suspect-avatar">
                    <Users size={18} />
                  </div>
                  <div className="suspect-details">
                    <div className="suspect-name-row">
                      <Link to={`/person/${encodeURIComponent(suspect.id)}`} className="suspect-name-link">
                        <strong>{suspect.name}</strong>
                      </Link>
                      <span className={`role-badge ${suspect.role === "Syndicate Hub" ? "hub" : "associate"}`}>
                        {suspect.role}
                      </span>
                    </div>
                    <div className="suspect-meta-tags">
                      <span>ID: {suspect.id}</span>
                      <span>•</span>
                      <span>{suspect.degree} Direct Links</span>
                      <span>•</span>
                      <span>{suspect.cases_count} Cases</span>
                      <span>•</span>
                      <span>{suspect.phones_count} Phones</span>
                    </div>
                  </div>
                  <div className="suspect-risk-pill">
                    <span className={`risk-tag ${suspect.risk_score >= 70 ? "high" : "medium"}`}>
                      Risk {suspect.risk_score}%
                    </span>
                    <Link
                      to={`/person/${encodeURIComponent(suspect.id)}`}
                      className="investigate-icon-btn"
                      title="Open Dossier"
                    >
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMN 2: CONNECTION TRACER / PATH FINDER */}
        <div className="dashboard-section-card">
          <div className="section-card-header">
            <div className="section-title-group">
              <GitCommit size={20} className="text-cyan-500" />
              <div>
                <h2>TRACE-X Connection Tracer</h2>
                <p>Find the shortest path & shared intermediaries between two suspects</p>
              </div>
            </div>
          </div>

          {personsList.length < 2 ? (
            <div className="empty-sub-card">
              <GitCommit size={28} className="text-slate-500 mb-2" />
              <p>At least 2 suspects are required to calculate connection paths.</p>
              <Link to="/import" className="inline-action-link">
                Add more suspects &rarr;
              </Link>
            </div>
          ) : (
            <>
              <form className="path-finder-form" onSubmit={handleTracePath}>
                <div className="path-select-grid">
                  <div className="path-input-group">
                    <label>Suspect A (Source)</label>
                    <select
                      value={sourcePerson}
                      onChange={(e) => setSourcePerson(e.target.value)}
                      className="custom-select"
                    >
                      {personsList.map((p) => (
                        <option key={`src-${p.id}`} value={p.id}>
                          {p.name} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="path-input-group">
                    <label>Suspect B (Target)</label>
                    <select
                      value={targetPerson}
                      onChange={(e) => setTargetPerson(e.target.value)}
                      className="custom-select"
                    >
                      {personsList.map((p) => (
                        <option key={`tgt-${p.id}`} value={p.id}>
                          {p.name} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTracePath}
                  className="trace-action-btn"
                  disabled={pathLoading}
                >
                  {pathLoading ? "Calculating Graph Path..." : "Trace Connection Path"}
                </button>
              </form>

              {pathError && (
                <div className="path-error-box">
                  <AlertTriangle size={16} />
                  <span>{pathError}</span>
                </div>
              )}

              {pathResult && (
                <div className="path-result-wrapper">
                  <div className="path-result-header">
                    <span>
                      Path Found: <strong>{pathResult.path_length} hops</strong>
                    </span>
                    <span className="chain-length">
                      {pathResult.nodes.length} Intermediary Nodes
                    </span>
                  </div>

                  <div className="path-nodes-chain">
                    {pathResult.nodes.map((node, index) => (
                      <div key={`${node.id}-${index}`} className="chain-segment">
                        <div className={`chain-node ${String(node.type).toLowerCase()}`}>
                          <span className="node-type-label">{node.type}</span>
                          <strong>
                            {node.type === "Person" ? (
                              <Link to={`/person/${encodeURIComponent(node.id)}`}>
                                {node.label}
                              </Link>
                            ) : (
                              node.label
                            )}
                          </strong>
                        </div>
                        {index < pathResult.nodes.length - 1 && (
                          <div className="chain-link-arrow">
                            <span className="link-rel-name">
                              {pathResult.relationships[index]?.type || "LINKED"}
                            </span>
                            <ArrowRight size={14} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default Dashboard;