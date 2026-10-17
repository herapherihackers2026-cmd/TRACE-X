import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import NetworkGraph from "../components/NetworkGraph";
import {
  ArrowLeft,
  User,
  Network,
  Activity,
  Users,
  Link2,
  Phone,
  Car,
  FileText,
  MapPin,
  ShieldAlert,
  AlertTriangle,
  Fingerprint
} from "lucide-react";
import {
  getPerson,
  getNetwork,
  getInsights,
  getSharedEntities
} from "../services/api";
import { useInvestigation } from "../context/InvestigationContext";

function PersonDetails() {
  const { personId } = useParams();
  const { activeInvestigation } = useInvestigation();
  const invId = activeInvestigation?.id;

  const [person, setPerson] = useState(null);
  const [network, setNetwork] = useState(null);
  const [insights, setInsights] = useState(null);

  const [sharedConnections, setSharedConnections] = useState([]);
  const [sharedLoading, setSharedLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // LOAD PERSON DATA
  // --------------------------------------------------
  useEffect(() => {
    async function loadPersonData() {
      try {
        setLoading(true);
        setError("");

        const [personResponse, networkResponse, insightsResponse] =
          await Promise.all([
            getPerson(personId, invId),
            getNetwork(personId, invId),
            getInsights(personId, invId),
          ]);

        setPerson(personResponse.data);
        setNetwork(networkResponse.data);
        setInsights(insightsResponse.data);

        // Load Shared Connections
        setSharedLoading(true);
        try {
          const connectedPeople = (networkResponse.data?.nodes || []).filter(
            (node) =>
              String(node.type).toLowerCase() === "person" &&
              String(node.id) !== String(personId)
          );

          if (connectedPeople.length > 0) {
            const results = await Promise.all(
              connectedPeople.map(async (connectedPerson) => {
                try {
                  const response = await getSharedEntities(
                    personId,
                    connectedPerson.id,
                    invId
                  );
                  return {
                    person: connectedPerson,
                    ...response.data,
                  };
                } catch (err) {
                  console.error("Failed to load shared connection:", err);
                  return null;
                }
              })
            );

            setSharedConnections(results.filter(Boolean));
          } else {
            setSharedConnections([]);
          }
        } finally {
          setSharedLoading(false);
        }
      } catch (err) {
        console.error("Failed to load person information:", err);
        setError("Failed to load suspect dossier.");
      } finally {
        setLoading(false);
      }
    }

    loadPersonData();
  }, [personId, invId]);

  if (loading) {
    return (
      <main className="dashboard">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Compiling TRACE-X suspect intelligence dossier & sub-network...</p>
        </div>
      </main>
    );
  }

  if (error || !person || person.status === "not_found") {
    return (
      <main className="dashboard">
        <Link to="/persons" className="back-button">
          <ArrowLeft size={16} />
          Back to Persons
        </Link>
        <div className="empty-state error">
          <ShieldAlert size={40} />
          <h3>Person Not Found</h3>
          <p>{error || `No suspect profile exists for reference ID "${personId}".`}</p>
        </div>
      </main>
    );
  }

  const getEntityIcon = (type) => {
    switch (String(type).toLowerCase()) {
      case "phone":
        return <Phone size={16} color="#38bdf8" />;
      case "vehicle":
        return <Car size={16} color="#22c55e" />;
      case "case":
        return <FileText size={16} color="#a855f7" />;
      case "location":
        return <MapPin size={16} color="#f97316" />;
      default:
        return <Link2 size={16} color="#94a3b8" />;
    }
  };

  const riskLevel = (insights?.risk_level || "LOW").toLowerCase();

  return (
    <main className="dashboard">
      {/* HEADER WITH DOSSIER TITLE & RISK BANNER */}
      <div className="details-header">
        <Link to="/persons" className="back-button">
          <ArrowLeft size={16} />
          Back to Persons
        </Link>

        <div className="person-hero-card">
          <div className="person-hero-left">
            <div className={`large-person-avatar ${riskLevel}`}>
              <User size={36} />
            </div>
            <div className="person-hero-meta">
              <div className="person-name-title-row">
                <h1>{person.name}</h1>
                <span className={`risk-badge ${riskLevel}`}>
                  {insights?.risk_level || "LOW"} RISK
                </span>
              </div>
              <div className="hero-id-tags">
                <span className="id-chip">
                  <Fingerprint size={13} />
                  TRACE-X Ref: <strong>{person.id}</strong>
                </span>
                <span className="age-chip">
                  Age: <strong>{person.age ?? "N/A"}</strong>
                </span>
                {person.gender && (
                  <span className="age-chip">
                    Gender: <strong>{person.gender}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="person-hero-right">
            <div className="risk-score-circle">
              <div className="risk-gauge-val">{insights?.risk_score ?? 0}</div>
              <span className="risk-gauge-label">RISK INDEX</span>
            </div>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN INTELLIGENCE SECTION */}
      <div className="details-grid">
        {/* PERSONAL DOSSIER & CONNECTIVITY */}
        <div className="detail-card">
          <div className="detail-card-header">
            <User size={19} className="text-cyan-400" />
            <div>
              <h2>TRACE-X Profile Overview</h2>
              <p>Verified database identity metrics</p>
            </div>
          </div>

          <div className="detail-row">
            <span>Full Legal Name</span>
            <strong>{person.name}</strong>
          </div>
          <div className="detail-row">
            <span>Suspect ID</span>
            <strong>{person.id}</strong>
          </div>
          <div className="detail-row">
            <span>Age</span>
            <strong>{person.age ? `${person.age} years` : "Unknown"}</strong>
          </div>
          {person.aliases && (
            <div className="detail-row">
              <span>Known Aliases</span>
              <strong>{person.aliases}</strong>
            </div>
          )}
          {person.notes && (
            <div className="detail-row">
              <span>Investigative Notes</span>
              <strong>{person.notes}</strong>
            </div>
          )}

          <div className="mini-stats-grid">
            <div className="mini-stat-box">
              <span>Connected Associates</span>
              <strong className="text-red-400">{insights?.connected_people ?? 0}</strong>
            </div>
            <div className="mini-stat-box">
              <span>Linked Cases</span>
              <strong className="text-purple-400">{insights?.cases ?? 0}</strong>
            </div>
            <div className="mini-stat-box">
              <span>Intercepted Phones</span>
              <strong className="text-cyan-400">{insights?.phones ?? 0}</strong>
            </div>
            <div className="mini-stat-box">
              <span>Tracked Vehicles</span>
              <strong className="text-green-400">{insights?.vehicles ?? 0}</strong>
            </div>
            <div className="mini-stat-box">
              <span>Known Locations</span>
              <strong className="text-orange-400">{insights?.locations ?? 0}</strong>
            </div>
            <div className="mini-stat-box">
              <span>Total Direct Links</span>
              <strong className="text-yellow-400">{insights?.total_connections ?? 0}</strong>
            </div>
          </div>
        </div>

        {/* RISK ASSESSMENT & INDICATORS */}
        <div className="detail-card">
          <div className="detail-card-header">
            <Activity size={19} className="text-red-400" />
            <div>
              <h2>TRACE-X Risk Assessment</h2>
              <p>Automated network topology heuristic indicators</p>
            </div>
          </div>

          {insights?.risk_indicators?.length > 0 ? (
            <div className="risk-indicators-list">
              {insights.risk_indicators.map((indicator, index) => (
                <div className="risk-indicator-item" key={index}>
                  <AlertTriangle size={16} className="text-amber-400" />
                  <span>{indicator}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-indicators-text">
              No elevated risk flags detected for this individual.
            </p>
          )}

          {/* RELATIONSHIP BREAKDOWN */}
          <div className="relationship-breakdown-box">
            <h4>Direct Connection Types</h4>
            <div className="connection-types-list">
              {(insights?.connections || []).map((conn, idx) => (
                <div className="connection-type-pill" key={idx}>
                  <span className="rel-tag">{conn.relationship}</span>
                  <span className="rel-count">
                    {conn.count} {conn.target_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SHARED CONNECTIONS */}
      <div className="detail-card shared-connections-section">
        <div className="detail-card-header">
          <Users size={19} className="text-cyan-400" />
          <div>
            <h2>Shared Syndicate Connections</h2>
            <p>Common entities bridging this suspect to other syndicate members</p>
          </div>
        </div>

        {sharedLoading ? (
          <div className="loading-state">Analyzing shared entities...</div>
        ) : sharedConnections.length === 0 ? (
          <p className="no-data-hint">No multi-hop shared connections identified.</p>
        ) : (
          <div className="shared-cards-grid">
            {sharedConnections.map((conn, index) => (
              <div className="shared-connection-card" key={`${conn.person.id}-${index}`}>
                <div className="shared-card-top">
                  <div className="shared-target-person">
                    <User size={18} />
                    <Link
                      to={`/person/${encodeURIComponent(conn.person.id)}`}
                      className="target-person-link"
                    >
                      <strong>{conn.person.label}</strong>
                      <span>({conn.person.id})</span>
                    </Link>
                  </div>
                  <span className={`strength-badge ${(conn.connection_strength || "LOW").toLowerCase()}`}>
                    {conn.connection_strength} LINK ({conn.shared_count} Shared)
                  </span>
                </div>

                <div className="shared-entities-pills">
                  {conn.shared_entities?.map((ent, entIdx) => (
                    <div className="shared-entity-chip" key={entIdx}>
                      {getEntityIcon(ent.type)}
                      <span>
                        <strong>{ent.type}:</strong> {ent.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOCUSED SUB-NETWORK GRAPH */}
      <div className="detail-card network-subgraph-card">
        <div className="detail-card-header">
          <Network size={19} className="text-cyan-400" />
          <div>
            <h2>TRACE-X Sub-Network Visualizer</h2>
            <p>Direct and 2nd-degree connections centered on {person.name}</p>
          </div>
        </div>

        <NetworkGraph network={network} height={460} />
      </div>
    </main>
  );
}

export default PersonDetails;