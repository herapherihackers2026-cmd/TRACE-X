import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  Network,
  Users,
  FolderOpen,
  Calendar,
  Trash2,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  Upload,
  AlertTriangle,
  X
} from "lucide-react";
import { useInvestigation } from "../context/InvestigationContext";
import { deleteInvestigation as apiDeleteInvestigation } from "../services/api";

function Investigations() {
  const navigate = useNavigate();
  const {
    investigations,
    activeInvestigation,
    setActiveInvestigation,
    createInvestigation,
    refreshInvestigations,
    loading,
  } = useInvestigation();

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg("Investigation name is required.");
      return;
    }

    try {
      setCreating(true);
      setErrorMsg("");
      const inv = await createInvestigation(newName, newDesc);
      setShowCreateModal(false);
      setNewName("");
      setNewDesc("");
      setNewId("");
      setActiveInvestigation(inv);
    } catch (err) {
      setErrorMsg(err.message || "Failed to create investigation.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (confirmName !== deleteTarget.id) {
      setErrorMsg(`Please type "${deleteTarget.id}" exactly to confirm.`);
      return;
    }

    try {
      setDeleting(true);
      await apiDeleteInvestigation(deleteTarget.id);
      await refreshInvestigations();
      setDeleteTarget(null);
      setConfirmName("");
    } catch (err) {
      console.error("Delete failed:", err);
      setErrorMsg("Failed to delete investigation.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectInvestigation = (inv) => {
    setActiveInvestigation(inv);
  };

  return (
    <main className="dashboard">
      {/* HEADER */}
      <div className="dashboard-header flex justify-between items-center">
        <div className="header-title-block">
          <div className="header-badge">
            <FolderKanban size={13} />
            TRACE-X INVESTIGATION MANAGER
          </div>
          <h1>Investigation Workspaces</h1>
          <p>
            Manage isolated criminal investigation files, switch active working datasets, and import evidence.
          </p>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="primary-action-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>New Investigation</span>
          </button>
        </div>
      </div>

      {/* INVESTIGATION CARDS GRID */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading investigation files...</p>
        </div>
      ) : (
        <div className="investigations-grid">
          {investigations.map((inv) => {
            const isActive = activeInvestigation?.id === inv.id;
            const isDemo = inv.id === "INV-DEMO-001";

            return (
              <div
                className={`investigation-card ${isActive ? "active-inv" : ""}`}
                key={inv.id}
              >
                <div className="inv-card-header">
                  <div className="inv-title-group">
                    <div className="inv-icon-box">
                      <FolderKanban size={22} className={isActive ? "text-cyan-400" : "text-slate-400"} />
                    </div>
                    <div>
                      <h3>{inv.name}</h3>
                      <span className="inv-id-tag">ID: {inv.id}</span>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="active-inv-badge">
                      <CheckCircle size={12} />
                      ACTIVE
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="set-active-btn"
                      onClick={() => handleSelectInvestigation(inv)}
                    >
                      Set Active
                    </button>
                  )}
                </div>

                <p className="inv-description">
                  {inv.description || "No description provided for this case file."}
                </p>

                {/* METRICS ROW */}
                <div className="inv-stats-row">
                  <div className="inv-stat-cell">
                    <span className="stat-label">Total Nodes</span>
                    <strong>{inv.node_count ?? 0}</strong>
                  </div>
                  <div className="inv-stat-cell">
                    <span className="stat-label">Suspects</span>
                    <strong className="text-red-400">{inv.person_count ?? 0}</strong>
                  </div>
                  <div className="inv-stat-cell">
                    <span className="stat-label">Cases</span>
                    <strong className="text-purple-400">{inv.case_count ?? 0}</strong>
                  </div>
                  <div className="inv-stat-cell">
                    <span className="stat-label">Links</span>
                    <strong className="text-yellow-400">{inv.rel_count ?? 0}</strong>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="inv-card-footer">
                  <div className="inv-date-tag">
                    <Calendar size={13} />
                    <span>
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "Active"}
                    </span>
                    {isDemo && <span className="demo-tag">Sample Demo</span>}
                  </div>

                  <div className="inv-footer-actions">
                    <button
                      type="button"
                      className="inv-icon-action"
                      title="Import data into this investigation"
                      onClick={() => {
                        setActiveInvestigation(inv);
                        navigate("/import");
                      }}
                    >
                      <Upload size={15} />
                    </button>

                    <button
                      type="button"
                      className="inv-icon-action primary"
                      title="Open Network Graph"
                      onClick={() => {
                        setActiveInvestigation(inv);
                        navigate("/network");
                      }}
                    >
                      <Network size={15} />
                    </button>

                    {!isDemo && (
                      <button
                        type="button"
                        className="inv-icon-action danger"
                        title="Delete investigation"
                        onClick={() => {
                          setDeleteTarget(inv);
                          setConfirmName("");
                          setErrorMsg("");
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE INVESTIGATION MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Investigation File</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              {errorMsg && <div className="modal-error-box">{errorMsg}</div>}

              <div className="input-field-group mb-3">
                <label>Investigation Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Operation Northern Hawk"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="custom-input"
                  required
                />
              </div>

              <div className="input-field-group mb-4">
                <label>Case Brief / Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief synopsis of suspects, syndicate, and scope..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="custom-input"
                />
              </div>

              <div className="modal-footer-btns">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-confirm-btn"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Investigation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-content danger-modal">
            <div className="modal-header">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle size={20} />
                <h3>Delete Investigation?</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="danger-text">
              This action will permanently delete investigation <strong>{deleteTarget.name}</strong> and all its {deleteTarget.node_count} nodes and {deleteTarget.rel_count} relationships from Neo4j. This cannot be undone.
            </p>

            <div className="input-field-group mb-4">
              <label>
                To confirm, type <strong>{deleteTarget.id}</strong> below:
              </label>
              <input
                type="text"
                placeholder={deleteTarget.id}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="custom-input danger-input"
              />
            </div>

            {errorMsg && <div className="modal-error-box mb-3">{errorMsg}</div>}

            <div className="modal-footer-btns">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-delete-confirm-btn"
                onClick={handleDelete}
                disabled={deleting || confirmName !== deleteTarget.id}
              >
                {deleting ? "Deleting..." : "Permanently Delete Investigation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Investigations;
