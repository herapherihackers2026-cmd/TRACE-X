import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ForceGraph2D from "react-force-graph-2d";
import {
  X,
  FileText,
  Phone,
  Car,
  MapPin,
  User,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  Search,
  Eye,
  EyeOff,
  Crosshair,
  CheckCheck,
  Filter
} from "lucide-react";

function NetworkGraph({ network, height = 480 }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const navigate = useNavigate();

  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);

  // Filters state
  const [activeTypeFilters, setActiveTypeFilters] = useState({
    person: true,
    phone: true,
    vehicle: true,
    case: true,
    location: true,
  });

  const [activeRelFilters, setActiveRelFilters] = useState({
    INVOLVED_IN: true,
    USES: true,
    USES_VEHICLE: true,
    OCCURRED_AT: true,
  });

  // Controls state
  const [alwaysShowLabels, setAlwaysShowLabels] = useState(false);
  const [graphSearchQuery, setGraphSearchQuery] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // --------------------------------------------------
  // AUTO RESIZING CONTAINER
  // --------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = (entries) => {
      if (!containerRef.current) return;

      let measuredWidth = 0;
      if (entries && entries[0]) {
        measuredWidth = entries[0].contentRect.width;
      } else {
        measuredWidth = containerRef.current.clientWidth;
      }

      if (measuredWidth > 0) {
        const newWidth = Math.floor(measuredWidth);
        setDimensions((prev) => {
          if (Math.abs(prev.width - newWidth) > 1) {
            return { width: newWidth, height };
          }
          return prev;
        });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver((entries) => {
      updateSize(entries);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [height]);

  // --------------------------------------------------
  // FILTER VALID NODES & RELATIONSHIPS
  // --------------------------------------------------
  const rawNodes = network?.nodes || [];
  const rawRelationships = network?.relationships || [];

  const nodes = useMemo(() => {
    return rawNodes.filter((node) => {
      const type = String(node.type || "").toLowerCase();
      if (!["person", "phone", "vehicle", "case", "location"].includes(type)) {
        return false;
      }
      return activeTypeFilters[type] !== false;
    });
  }, [rawNodes, activeTypeFilters]);

  const validNodeIds = useMemo(() => {
    return new Set(nodes.map((node) => String(node.id)));
  }, [nodes]);

  // --------------------------------------------------
  // GRAPH DATA
  // --------------------------------------------------
  const graphData = useMemo(() => {
    const links = rawRelationships
      .filter((rel) => {
        const srcId = String(rel.source?.id || rel.source);
        const tgtId = String(rel.target?.id || rel.target);

        if (!validNodeIds.has(srcId) || !validNodeIds.has(tgtId)) {
          return false;
        }

        const relType = rel.type || "CONNECTED_TO";
        if (activeRelFilters[relType] === false) {
          return false;
        }

        return true;
      })
      .map((rel, index) => ({
        id: `${rel.source?.id || rel.source}-${rel.target?.id || rel.target}-${index}`,
        source: String(rel.source?.id || rel.source),
        target: String(rel.target?.id || rel.target),
        type: rel.type || "CONNECTED_TO",
      }));

    return {
      nodes: nodes.map((node) => ({
        id: String(node.id),
        label: node.label || node.id,
        type: node.type,
        properties: node.properties || {},
      })),
      links,
    };
  }, [nodes, rawRelationships, validNodeIds, activeRelFilters]);

  // --------------------------------------------------
  // HIGHLIGHT LOOKUPS
  // --------------------------------------------------
  const highlightNodes = useMemo(() => {
    const set = new Set();
    const active = hoverNode || selectedNode;
    if (!active) return set;

    const activeId = String(active.id);
    set.add(activeId);

    graphData.links.forEach((link) => {
      const srcId = String(link.source?.id || link.source);
      const tgtId = String(link.target?.id || link.target);
      if (srcId === activeId) set.add(tgtId);
      if (tgtId === activeId) set.add(srcId);
    });

    return set;
  }, [hoverNode, selectedNode, graphData.links]);

  const highlightLinks = useMemo(() => {
    const set = new Set();
    const active = hoverNode || selectedNode;
    if (!active) return set;

    const activeId = String(active.id);
    graphData.links.forEach((link) => {
      const srcId = String(link.source?.id || link.source);
      const tgtId = String(link.target?.id || link.target);
      if (srcId === activeId || tgtId === activeId) {
        set.add(link);
      }
    });

    return set;
  }, [hoverNode, selectedNode, graphData.links]);

  // Search autocomplete candidates
  const searchResults = useMemo(() => {
    if (!graphSearchQuery.trim()) return [];
    const term = graphSearchQuery.toLowerCase();
    return graphData.nodes
      .filter(
        (n) =>
          n.label.toLowerCase().includes(term) ||
          n.id.toLowerCase().includes(term) ||
          n.type.toLowerCase().includes(term)
      )
      .slice(0, 6);
  }, [graphData.nodes, graphSearchQuery]);

  // --------------------------------------------------
  // FORCE SIMULATION SETTINGS
  // --------------------------------------------------
  useEffect(() => {
    if (!graphRef.current) return;

    const graph = graphRef.current;

    // Node repulsion - balanced to prevent flying away or tight overlap
    const charge = graph.d3Force("charge");
    if (charge) {
      charge.strength(-110);
      charge.distanceMax(320);
    }

    // Link distance
    const link = graph.d3Force("link");
    if (link) {
      link.distance(90);
      link.strength(0.5);
    }

    // Center graph
    const center = graph.d3Force("center");
    if (center) {
      center.strength(0.06);
    }

    // Restart simulation & reheat
    graph.d3ReheatSimulation();

    // Fit graph after simulation settles
    const timer = setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.zoomToFit(800, 60);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [graphData]);

  // --------------------------------------------------
  // GRAPH ACTIONS & FOCUS
  // --------------------------------------------------
  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.3, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.3, 400);
    }
  };

  const handleZoomFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(600, 60);
    }
  };

  const handleResetPhysics = () => {
    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation();
      graphRef.current.zoomToFit(800, 60);
    }
  };

  const handleFocusNode = (node) => {
    if (!node || !graphRef.current) return;
    setSelectedNode(node);
    setSearchDropdownOpen(false);

    if (typeof node.x === "number" && typeof node.y === "number") {
      graphRef.current.centerAt(node.x, node.y, 800);
      graphRef.current.zoom(2.2, 800);
    }
  };

  const toggleTypeFilter = (type) => {
    setActiveTypeFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const toggleRelFilter = (relType) => {
    setActiveRelFilters((prev) => ({
      ...prev,
      [relType]: !prev[relType],
    }));
  };

  const handleSelectAll = () => {
    setActiveTypeFilters({
      person: true,
      case: true,
      phone: true,
      vehicle: true,
      location: true,
    });
    setActiveRelFilters({
      INVOLVED_IN: true,
      USES: true,
      USES_VEHICLE: true,
      OCCURRED_AT: true,
    });
  };

  const handleResetFilters = () => {
    setActiveTypeFilters({
      person: true,
      case: true,
      phone: true,
      vehicle: true,
      location: true,
    });
    setActiveRelFilters({
      INVOLVED_IN: true,
      USES: true,
      USES_VEHICLE: true,
      OCCURRED_AT: true,
    });
  };

  // --------------------------------------------------
  // STABLE NODE COLORS
  // --------------------------------------------------
  const getNodeColor = useCallback((type) => {
    switch (String(type).toLowerCase()) {
      case "person":
        return "#ef4444"; // Red
      case "phone":
        return "#38bdf8"; // Cyan
      case "vehicle":
        return "#22c55e"; // Green
      case "case":
        return "#a855f7"; // Purple
      case "location":
        return "#f97316"; // Orange
      default:
        return "#94a3b8"; // Slate
    }
  }, []);

  // --------------------------------------------------
  // RENDER GRAPH (CONTAINER & FILTERS ALWAYS MOUNTED)
  // --------------------------------------------------
  const allTypesSelected = Object.values(activeTypeFilters).every(Boolean);

  return (
    <div className="network-graph-wrapper" ref={containerRef}>
      {/* FILTER CONTROLS BAR */}
      <div className="graph-filter-bar">
        <span className="filter-label">
          <Layers size={13} />
          Node Types:
        </span>
        {[
          { key: "person", label: "Persons", color: "#ef4444" },
          { key: "case", label: "Cases", color: "#a855f7" },
          { key: "phone", label: "Phones", color: "#38bdf8" },
          { key: "vehicle", label: "Vehicles", color: "#22c55e" },
          { key: "location", label: "Locations", color: "#f97316" },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            className={`filter-pill ${activeTypeFilters[f.key] ? "active" : "inactive"}`}
            onClick={() => toggleTypeFilter(f.key)}
            style={{
              borderColor: activeTypeFilters[f.key] ? f.color : "rgba(148, 163, 184, 0.2)",
            }}
          >
            <span className="dot" style={{ backgroundColor: f.color }}></span>
            {f.label}
          </button>
        ))}

        <div className="filter-divider"></div>

        <span className="filter-label">Relationships:</span>
        {[
          { key: "INVOLVED_IN", label: "INVOLVED_IN" },
          { key: "USES", label: "USES" },
          { key: "USES_VEHICLE", label: "USES_VEHICLE" },
          { key: "OCCURRED_AT", label: "OCCURRED_AT" },
        ].map((r) => (
          <button
            key={r.key}
            type="button"
            className={`filter-pill rel-pill ${activeRelFilters[r.key] ? "active" : "inactive"}`}
            onClick={() => toggleRelFilter(r.key)}
          >
            {r.label}
          </button>
        ))}

        <div className="filter-divider"></div>

        <div className="filter-actions-group">
          <button
            type="button"
            className="filter-action-link"
            onClick={handleSelectAll}
            title="Select all node types and relationships"
          >
            <CheckCheck size={13} />
            <span>Select All</span>
          </button>
          <button
            type="button"
            className="filter-action-link"
            onClick={handleResetFilters}
            title="Reset filters to default"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* GRAPH CANVAS CONTAINER */}
      <div className="network-graph">
        {/* EMPTY FILTER STATE OVERLAY */}
        {nodes.length === 0 && (
          <div className="graph-empty-overlay">
            <Filter size={36} className="text-slate-500 mb-2" />
            <h3>No entity types selected</h3>
            <p>Select at least one entity type above or click below to display the network.</p>
            <div className="empty-actions-row">
              <button
                type="button"
                className="select-all-btn"
                onClick={handleSelectAll}
              >
                <CheckCheck size={15} />
                <span>Select All</span>
              </button>
              <button
                type="button"
                className="reset-filters-btn"
                onClick={handleResetFilters}
              >
                <RotateCcw size={15} />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        )}
        {/* IN-GRAPH SEARCH INPUT */}
        <div className="in-graph-search-container">
          <div className="in-graph-search-box">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Find & focus node..."
              value={graphSearchQuery}
              onChange={(e) => {
                setGraphSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
            />
            {graphSearchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setGraphSearchQuery("");
                  setSearchDropdownOpen(false);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {searchDropdownOpen && searchResults.length > 0 && (
            <div className="in-graph-search-dropdown">
              {searchResults.map((res) => (
                <div
                  key={`search-${res.id}`}
                  className="search-dropdown-item"
                  onClick={() => handleFocusNode(res)}
                >
                  <span className={`type-badge ${res.type.toLowerCase()}`}>
                    {res.type}
                  </span>
                  <strong>{res.label}</strong>
                  <span className="item-id">({res.id})</span>
                  <Crosshair size={13} className="focus-icon" />
                </div>
              ))}
            </div>
          )}
        </div>

        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#080d1a"
          enablePointerInteraction={true}
          nodeRelSize={5}
          nodeVal={(node) =>
            String(node.type).toLowerCase() === "person" ? 14 : 7
          }
          nodeLabel={(node) => `${node.label} (${node.type})`}
          // --------------------------------------------------
          // LINKS DRAWING & STYLING
          // --------------------------------------------------
          linkColor={(link) => {
            if (highlightLinks.size > 0) {
              return highlightLinks.has(link) ? "#38bdf8" : "rgba(71, 85, 105, 0.15)";
            }
            return "#334155";
          }}
          linkWidth={(link) => {
            if (highlightLinks.size > 0) {
              return highlightLinks.has(link) ? 2.5 : 0.8;
            }
            return 1.2;
          }}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(link) =>
            highlightLinks.has(link) ? "#38bdf8" : "#475569"
          }
          linkDirectionalParticles={0}
          linkCanvasObjectMode={() => "after"}
          linkCanvasObject={(link, ctx, globalScale) => {
            const isHighlighted = highlightLinks.has(link);
            if (!isHighlighted && !alwaysShowLabels && globalScale < 1.8) return;

            const start = link.source;
            const end = link.target;
            if (typeof start !== "object" || typeof end !== "object") return;

            const text = link.type || "";
            if (!text) return;

            const textPos = {
              x: start.x + (end.x - start.x) / 2,
              y: start.y + (end.y - start.y) / 2,
            };

            const fontSize = isHighlighted ? 8 : 7;
            ctx.font = `${fontSize}px Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = "rgba(8, 13, 26, 0.85)";
            ctx.fillRect(
              textPos.x - textWidth / 2 - 3,
              textPos.y - fontSize / 2 - 1,
              textWidth + 6,
              fontSize + 2
            );

            ctx.fillStyle = isHighlighted ? "#38bdf8" : "#94a3b8";
            ctx.fillText(text, textPos.x, textPos.y);
          }}
          // --------------------------------------------------
          // NODE DRAWING
          // --------------------------------------------------
          nodeCanvasObject={(node, ctx, globalScale) => {
            const isPerson = String(node.type).toLowerCase() === "person";
            const isTarget = selectedNode && String(selectedNode.id) === String(node.id);
            const isHovered = hoverNode && String(hoverNode.id) === String(node.id);
            const isHighlighted = highlightNodes.size > 0 && highlightNodes.has(String(node.id));
            const isDimmed = highlightNodes.size > 0 && !isHighlighted;

            const baseRadius = isPerson ? 10 : 6.5;
            const radius = isTarget || isHovered ? baseRadius * 1.25 : baseRadius;

            ctx.save();
            if (isDimmed) {
              ctx.globalAlpha = 0.25;
            }

            // Glow ring on target / hover
            if (isTarget || isHovered) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
              ctx.fillStyle = isPerson ? "rgba(239, 68, 68, 0.3)" : "rgba(56, 189, 248, 0.3)";
              ctx.fill();
            }

            // Main node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = getNodeColor(node.type);
            ctx.fill();

            // Crisp border (NO BLINKING, static line styles)
            ctx.strokeStyle = isTarget ? "#ffffff" : isPerson ? "#fecaca" : "#cbd5e1";
            ctx.lineWidth = isTarget ? 2 : 1;
            ctx.stroke();

            // Label display logic
            const showLabel = isPerson || isHighlighted || alwaysShowLabels || globalScale >= 1.6;
            if (showLabel) {
              const fontSize = isPerson ? 10 : 8;
              ctx.font = `${isPerson ? "bold " : ""}${fontSize}px Inter, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";

              const text = String(node.label || node.id);
              const textWidth = ctx.measureText(text).width;

              // Label background badge
              ctx.fillStyle = "rgba(11, 17, 32, 0.9)";
              ctx.fillRect(
                node.x - textWidth / 2 - 4,
                node.y + radius + 3,
                textWidth + 8,
                fontSize + 4
              );

              ctx.strokeStyle = isPerson ? "rgba(239, 68, 68, 0.4)" : "rgba(51, 65, 85, 0.6)";
              ctx.lineWidth = 0.8;
              ctx.strokeRect(
                node.x - textWidth / 2 - 4,
                node.y + radius + 3,
                textWidth + 8,
                fontSize + 4
              );

              // Label text
              ctx.fillStyle = isPerson ? "#ffffff" : "#e2e8f0";
              ctx.fillText(text, node.x, node.y + radius + 5);
            }

            ctx.restore();
          }}
          // --------------------------------------------------
          // HITBOX / POINTER AREA
          // --------------------------------------------------
          nodePointerAreaPaint={(node, color, ctx) => {
            const isPerson = String(node.type).toLowerCase() === "person";
            const hitRadius = isPerson ? 26 : 20;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, hitRadius, 0, Math.PI * 2);
            ctx.fill();
          }}
          // --------------------------------------------------
          // HOVER (FILTERED TO PREVENT RE-RENDER FLICKER)
          // --------------------------------------------------
          onNodeHover={(node) => {
            const currentHoverId = hoverNode?.id || null;
            const newHoverId = node?.id || null;
            if (currentHoverId !== newHoverId) {
              setHoverNode(node || null);
            }
          }}
          // --------------------------------------------------
          // CLICK BEHAVIORS
          // --------------------------------------------------
          onNodeClick={(node) => {
            if (String(node.type).toLowerCase() === "person") {
              navigate(`/person/${encodeURIComponent(String(node.id))}`);
              return;
            }
            setSelectedNode(node);
          }}
          onBackgroundClick={() => {
            setSelectedNode(null);
            setSearchDropdownOpen(false);
          }}
          // --------------------------------------------------
          // STABLE DRAG PINNING
          // --------------------------------------------------
          onNodeDragStart={(node) => {
            node.fx = node.x;
            node.fy = node.y;
          }}
          onNodeDrag={(node) => {
            node.fx = node.x;
            node.fy = node.y;
          }}
          onNodeDragEnd={(node) => {
            node.fx = node.x;
            node.fy = node.y;
          }}
          // Simulation parameters
          warmupTicks={80}
          cooldownTicks={120}
          cooldownTime={2000}
          d3VelocityDecay={0.4}
          d3AlphaDecay={0.08}
        />

        {/* FLOATING GRAPH TOOLBAR */}
        <div className="graph-toolbar">
          <button
            type="button"
            className="toolbar-btn"
            title="Zoom In"
            onClick={handleZoomIn}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Zoom Out"
            onClick={handleZoomOut}
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Fit to Screen"
            onClick={handleZoomFit}
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Reset Simulation Physics"
            onClick={handleResetPhysics}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className={`toolbar-btn ${alwaysShowLabels ? "active" : ""}`}
            title={alwaysShowLabels ? "Labels Always On" : "Zoom-Adaptive Labels"}
            onClick={() => setAlwaysShowLabels((prev) => !prev)}
          >
            {alwaysShowLabels ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        {/* SELECTED ENTITY POPUP / INSPECTOR */}
        {selectedNode && (
          <div className="entity-popup">
            <div className="entity-popup-header">
              <div className="entity-popup-title">
                {selectedNode.type === "Case" && <FileText size={18} color="#a855f7" />}
                {selectedNode.type === "Phone" && <Phone size={18} color="#38bdf8" />}
                {selectedNode.type === "Vehicle" && <Car size={18} color="#22c55e" />}
                {selectedNode.type === "Location" && <MapPin size={18} color="#f97316" />}
                {selectedNode.type === "Person" && <User size={18} color="#ef4444" />}
                <h3>{selectedNode.type} Entity</h3>
              </div>
              <button
                type="button"
                className="entity-popup-close"
                onClick={() => setSelectedNode(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="entity-popup-body">
              <div className="entity-detail">
                <span>ID / Reference</span>
                <strong>{selectedNode.id}</strong>
              </div>

              <div className="entity-detail">
                <span>Name / Value</span>
                <strong>{selectedNode.label}</strong>
              </div>

              <div className="entity-detail">
                <span>Entity Class</span>
                <strong style={{ color: getNodeColor(selectedNode.type) }}>
                  {selectedNode.type}
                </strong>
              </div>

              {selectedNode.properties?.category && (
                <div className="entity-detail">
                  <span>Category</span>
                  <strong>{selectedNode.properties.category}</strong>
                </div>
              )}

              {selectedNode.properties?.date && (
                <div className="entity-detail">
                  <span>Incident Date</span>
                  <strong>{selectedNode.properties.date}</strong>
                </div>
              )}

              {selectedNode.properties?.latitude && (
                <div className="entity-detail">
                  <span>Coordinates</span>
                  <strong>
                    {selectedNode.properties.latitude}, {selectedNode.properties.longitude}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NetworkGraph;