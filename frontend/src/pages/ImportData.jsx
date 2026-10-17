import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Trash2,
  FolderPlus,
  Shield,
  Layers,
  Database,
  Sparkles
} from "lucide-react";
import { useInvestigation } from "../context/InvestigationContext";
import {
  validateImportData,
  importInvestigationData,
  getCSVTemplate
} from "../services/api";

function ImportData() {
  const navigate = useNavigate();
  const {
    investigations,
    activeInvestigation,
    setActiveInvestigation,
    createInvestigation,
    refreshInvestigations,
  } = useInvestigation();

  const [activeTab, setActiveTab] = useState("csv"); // 'csv', 'json', 'manual'

  // Target Investigation
  const [selectedInvId, setSelectedInvId] = useState(
    activeInvestigation?.id || "INV-NEW"
  );
  const [newInvName, setNewInvName] = useState("");
  const [newInvDesc, setNewInvDesc] = useState("");

  // Staged Payload
  const [stagedData, setStagedData] = useState({
    people: [],
    phones: [],
    vehicles: [],
    cases: [],
    locations: [],
    relationships: [],
  });

  // JSON Raw Input
  const [jsonText, setJsonText] = useState("");

  // Manual Form States
  const [manualType, setManualType] = useState("Person");
  const [manualPerson, setManualPerson] = useState({ id: "", name: "", age: "", gender: "Male", aliases: "", notes: "" });
  const [manualPhone, setManualPhone] = useState({ id: "", number: "", carrier: "", notes: "" });
  const [manualVehicle, setManualVehicle] = useState({ id: "", registration_number: "", type: "Sedan", model: "", color: "", notes: "" });
  const [manualCase, setManualCase] = useState({ id: "", name: "", type: "Armed Robbery", date: "", status: "Under Investigation", location: "", notes: "" });
  const [manualLocation, setManualLocation] = useState({ id: "", name: "", address: "", latitude: "", longitude: "", type: "Safehouse" });
  const [manualRel, setManualRel] = useState({ source: "", target: "", type: "INVOLVED_IN", notes: "" });

  // Validation & Import State
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState("");
  const [importSuccess, setImportSuccess] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (activeInvestigation && selectedInvId === "INV-NEW") {
      setSelectedInvId(activeInvestigation.id);
    }
  }, [activeInvestigation]);

  // --------------------------------------------------
  // CSV PARSER HELPER
  // --------------------------------------------------
  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      rows.push(row);
    }
    return rows;
  };

  const handleFileUpload = (type, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      if (type === "json") {
        setJsonText(content);
        try {
          const parsed = JSON.parse(content);
          setStagedData({
            people: parsed.people || [],
            phones: parsed.phones || [],
            vehicles: parsed.vehicles || [],
            cases: parsed.cases || [],
            locations: parsed.locations || [],
            relationships: parsed.relationships || [],
          });
          setStatusMessage("JSON file parsed successfully.");
        } catch (err) {
          setStatusMessage("Invalid JSON format in uploaded file.");
        }
      } else {
        const rows = parseCSV(content);
        setStagedData((prev) => {
          const updated = { ...prev };
          if (type === "people") {
            updated.people = rows.map((r) => ({
              id: r.id,
              name: r.name,
              age: r.age ? parseInt(r.age, 10) : undefined,
              gender: r.gender,
              aliases: r.aliases,
              notes: r.notes,
            }));
          } else if (type === "phones") {
            updated.phones = rows.map((r) => ({
              id: r.id,
              number: r.number,
              carrier: r.carrier,
              notes: r.notes,
            }));
          } else if (type === "vehicles") {
            updated.vehicles = rows.map((r) => ({
              id: r.id,
              registration_number: r.registration_number || r.number || r.id,
              type: r.type,
              model: r.model,
              color: r.color,
              notes: r.notes,
            }));
          } else if (type === "cases") {
            updated.cases = rows.map((r) => ({
              id: r.id,
              name: r.name,
              type: r.type,
              date: r.date,
              status: r.status,
              location: r.location,
              notes: r.notes,
            }));
          } else if (type === "locations") {
            updated.locations = rows.map((r) => ({
              id: r.id,
              name: r.name,
              address: r.address,
              latitude: r.latitude ? parseFloat(r.latitude) : undefined,
              longitude: r.longitude ? parseFloat(r.longitude) : undefined,
              type: r.type,
            }));
          } else if (type === "relationships") {
            updated.relationships = rows.map((r) => ({
              source: r.source,
              target: r.target,
              type: r.type,
              notes: r.notes,
            }));
          }
          return updated;
        });
        setStatusMessage(`Loaded ${rows.length} rows from ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = async (type) => {
    try {
      const res = await getCSVTemplate(type);
      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(res.data.csv);
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `tracex_template_${type}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download template:", err);
    }
  };

  const handleLoadSampleJSON = () => {
    const sample = {
      people: [
        { id: "P-401", name: "Devendra Malik", age: 46, gender: "Male", aliases: "The Baron", notes: "Syndicate boss" },
        { id: "P-402", name: "Sunil Verma", age: 31, gender: "Male", aliases: "Cortex", notes: "Financial hacker" },
        { id: "P-403", name: "Priya Sharma", age: 29, gender: "Female", aliases: "Ghost", notes: "Courier operative" }
      ],
      phones: [
        { id: "PH-801", number: "+91-9988776655", carrier: "Airtel", notes: "Encrypted burner line" },
        { id: "PH-802", number: "+91-9877665544", carrier: "Vi", notes: "Hawala coordinate line" }
      ],
      vehicles: [
        { id: "VH-901", registration_number: "KA-05-MM-3344", type: "SUV", model: "Scorpio", color: "Black", notes: "Used in transit" }
      ],
      cases: [
        { id: "CASE-501", name: "Cyber-Heist Syndicate Alpha", type: "Financial Fraud", date: "2026-06-12", status: "Active", location: "Bangalore Tech Park", notes: "₹45Cr crypto diversion" }
      ],
      locations: [
        { id: "LOC-701", name: "Indiranagar Safehouse", address: "100ft Road Indiranagar", latitude: 12.9784, longitude: 77.6408, type: "Safehouse" }
      ],
      relationships: [
        { source: "P-401", target: "CASE-501", type: "INVOLVED_IN", notes: "Mastermind" },
        { source: "P-402", target: "CASE-501", type: "INVOLVED_IN", notes: "Technical executor" },
        { source: "P-401", target: "P-402", type: "ASSOCIATED_WITH", notes: "Direct command" },
        { source: "P-401", target: "PH-801", type: "USES", notes: "Primary phone" },
        { source: "P-402", target: "PH-802", type: "USES", notes: "Hawala line" },
        { source: "P-403", target: "VH-901", type: "USES_VEHICLE", notes: "Courier transport" },
        { source: "CASE-501", target: "LOC-701", type: "OCCURRED_AT", notes: "Base of operations" }
      ]
    };

    setJsonText(JSON.stringify(sample, null, 2));
    setStagedData(sample);
    setStatusMessage("Loaded full sample criminal network template.");
  };

  // --------------------------------------------------
  // MANUAL ADD HANDLERS
  // --------------------------------------------------
  const handleAddManualItem = (e) => {
    e.preventDefault();
    if (manualType === "Person") {
      if (!manualPerson.id || !manualPerson.name) return;
      setStagedData((prev) => ({
        ...prev,
        people: [...prev.people, { ...manualPerson, age: manualPerson.age ? parseInt(manualPerson.age, 10) : undefined }],
      }));
      setManualPerson({ id: "", name: "", age: "", gender: "Male", aliases: "", notes: "" });
    } else if (manualType === "Phone") {
      if (!manualPhone.id || !manualPhone.number) return;
      setStagedData((prev) => ({
        ...prev,
        phones: [...prev.phones, { ...manualPhone }],
      }));
      setManualPhone({ id: "", number: "", carrier: "", notes: "" });
    } else if (manualType === "Vehicle") {
      if (!manualVehicle.id) return;
      setStagedData((prev) => ({
        ...prev,
        vehicles: [...prev.vehicles, { ...manualVehicle, registration_number: manualVehicle.registration_number || manualVehicle.id }],
      }));
      setManualVehicle({ id: "", registration_number: "", type: "Sedan", model: "", color: "", notes: "" });
    } else if (manualType === "Case") {
      if (!manualCase.id) return;
      setStagedData((prev) => ({
        ...prev,
        cases: [...prev.cases, { ...manualCase }],
      }));
      setManualCase({ id: "", name: "", type: "Armed Robbery", date: "", status: "Under Investigation", location: "", notes: "" });
    } else if (manualType === "Location") {
      if (!manualLocation.id || !manualLocation.name) return;
      setStagedData((prev) => ({
        ...prev,
        locations: [...prev.locations, {
          ...manualLocation,
          latitude: manualLocation.latitude ? parseFloat(manualLocation.latitude) : undefined,
          longitude: manualLocation.longitude ? parseFloat(manualLocation.longitude) : undefined,
        }],
      }));
      setManualLocation({ id: "", name: "", address: "", latitude: "", longitude: "", type: "Safehouse" });
    } else if (manualType === "Relationship") {
      if (!manualRel.source || !manualRel.target || !manualRel.type) return;
      setStagedData((prev) => ({
        ...prev,
        relationships: [...prev.relationships, { ...manualRel }],
      }));
      setManualRel({ source: "", target: "", type: "INVOLVED_IN", notes: "" });
    }
  };

  const handleClearStaged = () => {
    setStagedData({
      people: [],
      phones: [],
      vehicles: [],
      cases: [],
      locations: [],
      relationships: [],
    });
    setJsonText("");
    setValidationResult(null);
    setStatusMessage("Cleared staged dataset.");
  };

  // --------------------------------------------------
  // VALIDATION & COMMIT
  // --------------------------------------------------
  const handleValidate = async () => {
    try {
      setValidating(true);
      setValidationResult(null);
      const res = await validateImportData(stagedData);
      setValidationResult(res.data);
    } catch (err) {
      console.error("Validation error:", err);
      setStatusMessage("Failed to validate dataset with server.");
    } finally {
      setValidating(false);
    }
  };

  const handleCommitImport = async () => {
    try {
      setImporting(true);
      setImportStep("Preparing target investigation...");

      let targetId = selectedInvId;
      if (targetId === "INV-NEW") {
        if (!newInvName.trim()) {
          setStatusMessage("Please enter a name for the new investigation.");
          setImporting(false);
          return;
        }
        setImportStep("Creating new investigation node in Neo4j...");
        const newInv = await createInvestigation(newInvName, newInvDesc);
        targetId = newInv.id;
      }

      setImportStep("Validating data integrity...");
      const valRes = await validateImportData(stagedData);
      if (!valRes.data.valid) {
        setValidationResult(valRes.data);
        setImporting(false);
        return;
      }

      setImportStep("Writing entities and building relationships in Neo4j graph engine...");
      const importRes = await importInvestigationData(targetId, stagedData);

      if (importRes.data?.success) {
        setImportStep("Refreshing TRACE-X intelligence cache...");
        await refreshInvestigations(targetId);
        setImportSuccess({
          investigationId: targetId,
          ...importRes.data.imported,
        });
      } else {
        setStatusMessage(importRes.data?.message || "Import failed.");
      }
    } catch (err) {
      console.error("Import failure:", err);
      setStatusMessage("Import execution encountered an error.");
    } finally {
      setImporting(false);
    }
  };

  // All staged entity IDs for relationship selector
  const allStagedIds = [
    ...stagedData.people.map((p) => ({ id: p.id, label: `${p.name} (Person)` })),
    ...stagedData.phones.map((p) => ({ id: p.id, label: `${p.number} (Phone)` })),
    ...stagedData.vehicles.map((v) => ({ id: v.id, label: `${v.registration_number || v.id} (Vehicle)` })),
    ...stagedData.cases.map((c) => ({ id: c.id, label: `${c.name || c.id} (Case)` })),
    ...stagedData.locations.map((l) => ({ id: l.id, label: `${l.name} (Location)` })),
  ];

  const totalStagedCount =
    stagedData.people.length +
    stagedData.phones.length +
    stagedData.vehicles.length +
    stagedData.cases.length +
    stagedData.locations.length;

  return (
    <main className="dashboard">
      {/* HEADER */}
      <div className="dashboard-header">
        <div className="header-title-block">
          <div className="header-badge">
            <Upload size={13} />
            TRACE-X DATA INGESTION WORKBENCH
          </div>
          <h1>Import Investigation Data</h1>
          <p>
            Dynamically convert investigative CSV, JSON, or manual evidence into isolated Neo4j intelligence graphs.
          </p>
        </div>
      </div>

      {/* SUCCESS MODAL / BANNER */}
      {importSuccess && (
        <div className="import-success-banner">
          <CheckCircle2 size={32} className="text-emerald-400" />
          <div className="success-content">
            <h3>Investigation Data Ingested Successfully!</h3>
            <p>
              Target Investigation: <strong>{importSuccess.investigationId}</strong> •{" "}
              {importSuccess.people} Suspects, {importSuccess.phones} Phones, {importSuccess.vehicles} Vehicles,{" "}
              {importSuccess.cases} Cases, {importSuccess.locations} Locations, and {importSuccess.relationships} Network Links.
            </p>
          </div>
          <button
            type="button"
            className="view-network-btn"
            onClick={() => navigate("/network")}
          >
            <span>Open Network Graph</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* TARGET INVESTIGATION SELECTOR CARD */}
      <div className="detail-card mb-4">
        <div className="detail-card-header">
          <FolderPlus size={19} className="text-cyan-400" />
          <div>
            <h2>1. Target Investigation</h2>
            <p>Choose an existing investigation to append to, or create a new isolated case file</p>
          </div>
        </div>

        <div className="target-inv-grid">
          <div className="input-field-group">
            <label>Select Target Investigation</label>
            <select
              value={selectedInvId}
              onChange={(e) => setSelectedInvId(e.target.value)}
              className="custom-select"
            >
              <option value="INV-NEW">+ Create New Investigation File...</option>
              {investigations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} ({inv.id}) - {inv.node_count} nodes
                </option>
              ))}
            </select>
          </div>

          {selectedInvId === "INV-NEW" && (
            <>
              <div className="input-field-group">
                <label>New Investigation Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Operation Northern Hawk"
                  value={newInvName}
                  onChange={(e) => setNewInvName(e.target.value)}
                  className="custom-input"
                />
              </div>

              <div className="input-field-group full-width">
                <label>Description / Case Brief</label>
                <input
                  type="text"
                  placeholder="Brief summary of the intelligence case and syndicate scope..."
                  value={newInvDesc}
                  onChange={(e) => setNewInvDesc(e.target.value)}
                  className="custom-input"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* DATA INPUT TABS */}
      <div className="detail-card mb-4">
        <div className="detail-card-header">
          <Database size={19} className="text-purple-400" />
          <div>
            <h2>2. Provide Evidence & Entity Data</h2>
            <p>Select your preferred data source format</p>
          </div>
        </div>

        {/* TAB CONTROLS */}
        <div className="import-tabs-bar">
          <button
            type="button"
            className={`import-tab-btn ${activeTab === "csv" ? "active" : ""}`}
            onClick={() => setActiveTab("csv")}
          >
            <FileSpreadsheet size={16} />
            <span>CSV Batch Upload</span>
          </button>
          <button
            type="button"
            className={`import-tab-btn ${activeTab === "json" ? "active" : ""}`}
            onClick={() => setActiveTab("json")}
          >
            <FileText size={16} />
            <span>Structured JSON Ingestion</span>
          </button>
          <button
            type="button"
            className={`import-tab-btn ${activeTab === "manual" ? "active" : ""}`}
            onClick={() => setActiveTab("manual")}
          >
            <PlusCircle size={16} />
            <span>Manual Form Entry</span>
          </button>
        </div>

        {/* TAB 1: CSV UPLOAD */}
        {activeTab === "csv" && (
          <div className="tab-content-area">
            <p className="tab-hint">
              Upload individual CSV files for each entity type or relationship. Download sample templates below to match the expected format.
            </p>

            <div className="csv-upload-grid">
              {[
                { type: "people", label: "People / Suspects CSV", icon: "👤" },
                { type: "phones", label: "Phones / Burners CSV", icon: "📱" },
                { type: "vehicles", label: "Vehicles / Transport CSV", icon: "🚗" },
                { type: "cases", label: "Cases / Incidents CSV", icon: "📁" },
                { type: "locations", label: "Locations / Hotspots CSV", icon: "📍" },
                { type: "relationships", label: "Relationships / Links CSV", icon: "🔗" },
              ].map((item) => (
                <div className="csv-upload-card" key={item.type}>
                  <div className="csv-card-header">
                    <span className="csv-card-icon">{item.icon}</span>
                    <div>
                      <h4>{item.label}</h4>
                      <span className="csv-count-badge">
                        {stagedData[item.type]?.length || 0} staged
                      </span>
                    </div>
                  </div>

                  <div className="csv-actions-row">
                    <label className="csv-file-btn">
                      <Upload size={14} />
                      <span>Choose File</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileUpload(item.type, e)}
                        style={{ display: "none" }}
                      />
                    </label>

                    <button
                      type="button"
                      className="csv-template-btn"
                      onClick={() => handleDownloadTemplate(item.type)}
                      title="Download template"
                    >
                      <Download size={13} />
                      <span>Template</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: JSON INGESTION */}
        {activeTab === "json" && (
          <div className="tab-content-area">
            <div className="json-controls-header">
              <p className="tab-hint">
                Paste raw JSON or upload a structured <code>.json</code> network file.
              </p>
              <div className="json-btn-group">
                <label className="secondary-action-btn">
                  <Upload size={14} />
                  <span>Upload .json</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => handleFileUpload("json", e)}
                    style={{ display: "none" }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={handleLoadSampleJSON}
                >
                  <Sparkles size={14} />
                  <span>Load Sample Template</span>
                </button>
              </div>
            </div>

            <textarea
              className="json-editor-area"
              rows={14}
              placeholder={`{\n  "people": [\n    { "id": "P001", "name": "Vikram Roy", "age": 42 }\n  ],\n  "phones": [\n    { "id": "PH001", "number": "+91-9876543210" }\n  ],\n  "relationships": [\n    { "source": "P001", "target": "PH001", "type": "USES" }\n  ]\n}`}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                try {
                  const parsed = JSON.parse(e.target.value);
                  setStagedData({
                    people: parsed.people || [],
                    phones: parsed.phones || [],
                    vehicles: parsed.vehicles || [],
                    cases: parsed.cases || [],
                    locations: parsed.locations || [],
                    relationships: parsed.relationships || [],
                  });
                } catch {
                  // Wait for valid JSON syntax
                }
              }}
            />
          </div>
        )}

        {/* TAB 3: MANUAL ENTRY */}
        {activeTab === "manual" && (
          <div className="tab-content-area">
            <div className="manual-type-selector">
              {["Person", "Phone", "Vehicle", "Case", "Location", "Relationship"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`manual-pill ${manualType === t ? "active" : ""}`}
                  onClick={() => setManualType(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <form className="manual-entry-form" onSubmit={handleAddManualItem}>
              {manualType === "Person" && (
                <div className="form-fields-grid">
                  <div className="input-field-group">
                    <label>Person ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. CR-101"
                      value={manualPerson.id}
                      onChange={(e) => setManualPerson({ ...manualPerson, id: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Full Legal Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram Roy"
                      value={manualPerson.name}
                      onChange={(e) => setManualPerson({ ...manualPerson, name: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Age</label>
                    <input
                      type="number"
                      placeholder="e.g. 42"
                      value={manualPerson.age}
                      onChange={(e) => setManualPerson({ ...manualPerson, age: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Gender</label>
                    <select
                      value={manualPerson.gender}
                      onChange={(e) => setManualPerson({ ...manualPerson, gender: e.target.value })}
                      className="custom-select"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="input-field-group">
                    <label>Known Aliases</label>
                    <input
                      type="text"
                      placeholder="e.g. The Viper"
                      value={manualPerson.aliases}
                      onChange={(e) => setManualPerson({ ...manualPerson, aliases: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Notes / Intel</label>
                    <input
                      type="text"
                      placeholder="Principal financier"
                      value={manualPerson.notes}
                      onChange={(e) => setManualPerson({ ...manualPerson, notes: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                </div>
              )}

              {manualType === "Phone" && (
                <div className="form-fields-grid">
                  <div className="input-field-group">
                    <label>Phone ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. PH-101"
                      value={manualPhone.id}
                      onChange={(e) => setManualPhone({ ...manualPhone, id: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      placeholder="+91-9876543210"
                      value={manualPhone.number}
                      onChange={(e) => setManualPhone({ ...manualPhone, number: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Telecom Carrier</label>
                    <input
                      type="text"
                      placeholder="Airtel / Jio"
                      value={manualPhone.carrier}
                      onChange={(e) => setManualPhone({ ...manualPhone, carrier: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Notes</label>
                    <input
                      type="text"
                      placeholder="Burner line"
                      value={manualPhone.notes}
                      onChange={(e) => setManualPhone({ ...manualPhone, notes: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                </div>
              )}

              {manualType === "Vehicle" && (
                <div className="form-fields-grid">
                  <div className="input-field-group">
                    <label>Vehicle ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. VH-101"
                      value={manualVehicle.id}
                      onChange={(e) => setManualVehicle({ ...manualVehicle, id: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Registration Number</label>
                    <input
                      type="text"
                      placeholder="DL-01-AB-1234"
                      value={manualVehicle.registration_number}
                      onChange={(e) => setManualVehicle({ ...manualVehicle, registration_number: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Vehicle Type</label>
                    <input
                      type="text"
                      placeholder="Sedan / SUV"
                      value={manualVehicle.type}
                      onChange={(e) => setManualVehicle({ ...manualVehicle, type: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Model & Color</label>
                    <input
                      type="text"
                      placeholder="Black Honda City"
                      value={manualVehicle.model}
                      onChange={(e) => setManualVehicle({ ...manualVehicle, model: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                </div>
              )}

              {manualType === "Case" && (
                <div className="form-fields-grid">
                  <div className="input-field-group">
                    <label>Case ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. CASE-201"
                      value={manualCase.id}
                      onChange={(e) => setManualCase({ ...manualCase, id: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Case Title / Incident Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Downtown Bank Heist"
                      value={manualCase.name}
                      onChange={(e) => setManualCase({ ...manualCase, name: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Crime Category</label>
                    <input
                      type="text"
                      placeholder="Armed Robbery / Narcotics"
                      value={manualCase.type}
                      onChange={(e) => setManualCase({ ...manualCase, type: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Date of Incident</label>
                    <input
                      type="date"
                      value={manualCase.date}
                      onChange={(e) => setManualCase({ ...manualCase, date: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                </div>
              )}

              {manualType === "Location" && (
                <div className="form-fields-grid">
                  <div className="input-field-group">
                    <label>Location ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. LOC-101"
                      value={manualLocation.id}
                      onChange={(e) => setManualLocation({ ...manualLocation, id: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Location Name *</label>
                    <input
                      type="text"
                      placeholder="Central Safehouse"
                      value={manualLocation.name}
                      onChange={(e) => setManualLocation({ ...manualLocation, name: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Latitude (-90 to 90)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="28.6139"
                      value={manualLocation.latitude}
                      onChange={(e) => setManualLocation({ ...manualLocation, latitude: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                  <div className="input-field-group">
                    <label>Longitude (-180 to 180)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="77.2090"
                      value={manualLocation.longitude}
                      onChange={(e) => setManualLocation({ ...manualLocation, longitude: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                </div>
              )}

              {manualType === "Relationship" && (
                <div className="form-fields-grid">
                  <div className="input-field-group">
                    <label>Source Entity ID *</label>
                    <input
                      type="text"
                      list="staged-source-ids"
                      placeholder="Type or select Source ID"
                      value={manualRel.source}
                      onChange={(e) => setManualRel({ ...manualRel, source: e.target.value })}
                      className="custom-input"
                    />
                    <datalist id="staged-source-ids">
                      {allStagedIds.map((item) => (
                        <option key={`src-${item.id}`} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div className="input-field-group">
                    <label>Relationship Type *</label>
                    <select
                      value={manualRel.type}
                      onChange={(e) => setManualRel({ ...manualRel, type: e.target.value })}
                      className="custom-select"
                    >
                      <option value="INVOLVED_IN">INVOLVED_IN (Person → Case)</option>
                      <option value="USES">USES (Person → Phone)</option>
                      <option value="USES_VEHICLE">USES_VEHICLE (Person → Vehicle)</option>
                      <option value="ASSOCIATED_WITH">ASSOCIATED_WITH (Person ↔ Person)</option>
                      <option value="OCCURRED_AT">OCCURRED_AT (Case → Location)</option>
                      <option value="LOCATED_AT">LOCATED_AT (Person / Entity → Location)</option>
                      <option value="KNOWS">KNOWS (Person → Person)</option>
                      <option value="CALLED">CALLED (Phone → Phone)</option>
                    </select>
                  </div>

                  <div className="input-field-group">
                    <label>Target Entity ID *</label>
                    <input
                      type="text"
                      list="staged-target-ids"
                      placeholder="Type or select Target ID"
                      value={manualRel.target}
                      onChange={(e) => setManualRel({ ...manualRel, target: e.target.value })}
                      className="custom-input"
                    />
                    <datalist id="staged-target-ids">
                      {allStagedIds.map((item) => (
                        <option key={`tgt-${item.id}`} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div className="input-field-group">
                    <label>Intel Notes</label>
                    <input
                      type="text"
                      placeholder="Context of relationship"
                      value={manualRel.notes}
                      onChange={(e) => setManualRel({ ...manualRel, notes: e.target.value })}
                      className="custom-input"
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="add-entry-btn">
                <PlusCircle size={16} />
                <span>Add {manualType} to Staged Dataset</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* STAGED SUMMARY & VALIDATION PREVIEW */}
      <div className="detail-card mb-4">
        <div className="section-card-header">
          <div className="section-title-group">
            <Layers size={19} className="text-amber-400" />
            <div>
              <h2>3. Staged Data Preview & Integrity Verification</h2>
              <p>Verify entity counts and relationship validity before committing to Neo4j</p>
            </div>
          </div>

          <button
            type="button"
            className="clear-staged-btn"
            onClick={handleClearStaged}
            disabled={totalStagedCount === 0}
          >
            <Trash2 size={14} />
            <span>Clear Staged Data</span>
          </button>
        </div>

        {/* METRICS PREVIEW */}
        <div className="staged-counts-strip">
          <div className="staged-count-pill person">
            <span>People:</span> <strong>{stagedData.people.length}</strong>
          </div>
          <div className="staged-count-pill phone">
            <span>Phones:</span> <strong>{stagedData.phones.length}</strong>
          </div>
          <div className="staged-count-pill vehicle">
            <span>Vehicles:</span> <strong>{stagedData.vehicles.length}</strong>
          </div>
          <div className="staged-count-pill case">
            <span>Cases:</span> <strong>{stagedData.cases.length}</strong>
          </div>
          <div className="staged-count-pill location">
            <span>Locations:</span> <strong>{stagedData.locations.length}</strong>
          </div>
          <div className="staged-count-pill rel">
            <span>Relationships:</span> <strong>{stagedData.relationships.length}</strong>
          </div>
        </div>

        {statusMessage && <div className="status-banner">{statusMessage}</div>}

        {/* VALIDATION RESULTS */}
        {validationResult && (
          <div className={`validation-result-box ${validationResult.valid ? "valid" : "invalid"}`}>
            <div className="validation-box-header">
              {validationResult.valid ? (
                <>
                  <CheckCircle2 size={20} className="text-emerald-400" />
                  <strong>Dataset Validated Successfully (Ready to Ingest)</strong>
                </>
              ) : (
                <>
                  <XCircle size={20} className="text-rose-400" />
                  <strong>Validation Failed ({validationResult.errors.length} Critical Errors)</strong>
                </>
              )}
            </div>

            {validationResult.errors?.length > 0 && (
              <div className="validation-messages-list errors">
                <h4>Errors (Must fix before import):</h4>
                <ul>
                  {validationResult.errors.map((err, idx) => (
                    <li key={`err-${idx}`}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.warnings?.length > 0 && (
              <div className="validation-messages-list warnings">
                <h4>Warnings:</h4>
                <ul>
                  {validationResult.warnings.map((warn, idx) => (
                    <li key={`warn-${idx}`}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ACTIONS */}
        <div className="import-footer-actions">
          <button
            type="button"
            className="validate-action-btn"
            onClick={handleValidate}
            disabled={validating || totalStagedCount === 0}
          >
            <RefreshCw size={15} className={validating ? "spin" : ""} />
            <span>{validating ? "Validating Dataset..." : "Validate Data Integrity"}</span>
          </button>

          <button
            type="button"
            className="commit-import-btn"
            onClick={handleCommitImport}
            disabled={importing || totalStagedCount === 0}
          >
            <Shield size={16} />
            <span>{importing ? importStep : "Commit Import to Neo4j"}</span>
          </button>
        </div>
      </div>
    </main>
  );
}

export default ImportData;
