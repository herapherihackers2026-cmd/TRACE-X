import { useEffect, useState, useMemo } from "react";
import {
  Search,
  User,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  Link2,
  Upload,
  FolderKanban
} from "lucide-react";
import { getPersons } from "../services/api";
import { Link } from "react-router-dom";
import { useInvestigation } from "../context/InvestigationContext";

function Persons() {
  const { activeInvestigation } = useInvestigation();
  const invId = activeInvestigation?.id;

  const [persons, setPersons] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRiskFilter, setSelectedRiskFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("risk"); // 'risk', 'connections', 'name', 'age'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPersons(invId)
      .then((response) => {
        setPersons(response.data.persons || []);
      })
      .catch((error) => {
        console.error("Failed to load persons:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [invId]);

  const filteredAndSortedPersons = useMemo(() => {
    let result = persons.filter((person) => {
      const term = search.toLowerCase();
      const matchesSearch =
        String(person.id || "").toLowerCase().includes(term) ||
        String(person.name || "").toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (selectedRiskFilter !== "ALL") {
        return (person.risk_level || "LOW").toUpperCase() === selectedRiskFilter;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "risk") {
        return (b.risk_score || 0) - (a.risk_score || 0);
      }
      if (sortBy === "connections") {
        return (b.connections_count || 0) - (a.connections_count || 0);
      }
      if (sortBy === "name") {
        return String(a.name).localeCompare(String(b.name));
      }
      if (sortBy === "age") {
        return (b.age || 0) - (a.age || 0);
      }
      return 0;
    });

    return result;
  }, [persons, search, selectedRiskFilter, sortBy]);

  return (
    <main className="dashboard">
      {/* HEADER */}
      <div className="dashboard-header flex justify-between items-start">
        <div className="header-title-block">
          <div className="header-badge">
            <User size={13} />
            TRACE-X SUSPECT REGISTRY
          </div>
          <h1>{activeInvestigation?.name ? `${activeInvestigation.name} Suspects` : "TRACE-X Suspect Registry"}</h1>
          <p>
            Investigation: <strong>{activeInvestigation?.id || "INV-DEMO-001"}</strong> • Filter and investigate suspect dossiers for this case file.
          </p>
        </div>

        <div className="header-actions-group">
          <Link to="/import" className="secondary-action-btn">
            <Upload size={15} />
            <span>Add Suspects</span>
          </Link>
          <Link to="/investigations" className="secondary-action-btn">
            <FolderKanban size={15} />
            <span>Switch Case</span>
          </Link>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="persons-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by suspect name, alias, or criminal ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* RISK FILTER PILLS */}
        <div className="filter-group">
          <span className="filter-group-label">Risk Level:</span>
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((level) => (
            <button
              key={level}
              type="button"
              className={`risk-filter-btn ${level.toLowerCase()} ${
                selectedRiskFilter === level ? "active" : ""
              }`}
              onClick={() => setSelectedRiskFilter(level)}
            >
              {level === "ALL" ? "All Suspects" : `${level} Risk`}
            </button>
          ))}
        </div>

        {/* SORT CONTROLS */}
        <div className="sort-group">
          <SlidersHorizontal size={16} className="text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="risk">Sort by Highest Risk</option>
            <option value="connections">Sort by Most Connected</option>
            <option value="name">Sort by Name (A-Z)</option>
            <option value="age">Sort by Age</option>
          </select>
        </div>
      </div>

      {/* PERSONS GRID */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Retrieving suspect dossiers...</p>
        </div>
      ) : (
        <div className="persons-grid">
          {filteredAndSortedPersons.map((person) => {
            const riskLevel = (person.risk_level || "LOW").toLowerCase();
            return (
              <div className={`person-card risk-border-${riskLevel}`} key={person.id}>
                <div className="person-card-top">
                  <div className={`person-icon-box ${riskLevel}`}>
                    <User size={24} />
                  </div>
                  <div className="person-header-meta">
                    <div className="person-name-badge-row">
                      <h3>{person.name}</h3>
                      <span className={`risk-badge ${riskLevel}`}>
                        {person.risk_level || "LOW"} RISK
                      </span>
                    </div>
                    <span className="person-id-tag">ID: {person.id}</span>
                  </div>
                </div>

                <div className="person-stats-row">
                  <div className="person-stat-cell">
                    <span className="stat-label">Age</span>
                    <strong>{person.age ?? "N/A"}</strong>
                  </div>
                  <div className="person-stat-cell">
                    <span className="stat-label">Cases</span>
                    <strong className="text-purple-400">
                      {person.cases_count ?? 0}
                    </strong>
                  </div>
                  <div className="person-stat-cell">
                    <span className="stat-label">Phones</span>
                    <strong className="text-cyan-400">
                      {person.phones_count ?? 0}
                    </strong>
                  </div>
                  <div className="person-stat-cell">
                    <span className="stat-label">Vehicles</span>
                    <strong className="text-green-400">
                      {person.vehicles_count ?? 0}
                    </strong>
                  </div>
                </div>

                <div className="person-card-bottom">
                  <div className="connectivity-hint">
                    <Link2 size={13} />
                    <span>{person.connections_count ?? 0} direct network links</span>
                  </div>
                  <Link
                    to={`/person/${encodeURIComponent(person.id)}`}
                    className="investigate-btn"
                  >
                    <span>Investigate</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredAndSortedPersons.length === 0 && (
        <div className="empty-state">
          <ShieldAlert size={36} />
          <h3>No Suspects Found</h3>
          <p>No suspects match the current investigation and filter criteria.</p>
        </div>
      )}
    </main>
  );
}

export default Persons;