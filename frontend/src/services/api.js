import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

// Helper to attach investigation_id param
const withInv = (params = {}, investigationId) => {
  const p = { ...params };
  if (investigationId) {
    p.investigation_id = investigationId;
  }
  return p;
};

// --------------------------------------------------
// DATABASE TEST
// --------------------------------------------------

export const testDatabase = () => {
  return API.get("/test-db");
};

// --------------------------------------------------
// INVESTIGATION MANAGEMENT
// --------------------------------------------------

export const getInvestigations = () => {
  return API.get("/investigations");
};

export const createInvestigation = (payload) => {
  return API.post("/investigations", payload);
};

export const deleteInvestigation = (invId) => {
  return API.delete(`/investigations/${encodeURIComponent(invId)}`);
};

export const validateImportData = (payload) => {
  return API.post("/investigations/validate", payload);
};

export const importInvestigationData = (invId, payload) => {
  return API.post(`/investigations/${encodeURIComponent(invId)}/import`, payload);
};

export const getCSVTemplate = (entityType) => {
  return API.get(`/investigations/templates/csv/${encodeURIComponent(entityType)}`);
};

// --------------------------------------------------
// DASHBOARD STATS
// --------------------------------------------------

export const getStats = (investigationId) => {
  return API.get("/stats", {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// PERSONS
// --------------------------------------------------

export const getPersons = (investigationId) => {
  return API.get("/persons", {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// SINGLE PERSON
// --------------------------------------------------

export const getPerson = (personId, investigationId) => {
  return API.get(`/person/${encodeURIComponent(personId)}`, {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// PERSON NETWORK
// --------------------------------------------------

export const getNetwork = (personId, investigationId) => {
  return API.get(`/network/${encodeURIComponent(personId)}`, {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// GLOBAL NETWORK
// --------------------------------------------------

export const getGlobalNetwork = (investigationId) => {
  return API.get("/global-network", {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// PERSON INSIGHTS
// --------------------------------------------------

export const getInsights = (personId, investigationId) => {
  return API.get(`/insights/${encodeURIComponent(personId)}`, {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// SHARED ENTITIES
// --------------------------------------------------

export const getSharedEntities = (person1, person2, investigationId) => {
  return API.get(
    `/shared/${encodeURIComponent(person1)}/${encodeURIComponent(person2)}`,
    {
      params: withInv({}, investigationId),
    }
  );
};

// --------------------------------------------------
// CASES
// --------------------------------------------------

export const getCases = (investigationId) => {
  return API.get("/cases", {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// KEY SUSPECTS & CENTRALITY ANALYTICS
// --------------------------------------------------

export const getKeySuspects = (investigationId) => {
  return API.get("/analytics/key-suspects", {
    params: withInv({}, investigationId),
  });
};

// --------------------------------------------------
// SHORTEST PATH TRACER
// --------------------------------------------------

export const getPath = (sourceId, targetId, investigationId) => {
  return API.get(
    `/path/${encodeURIComponent(sourceId)}/${encodeURIComponent(targetId)}`,
    {
      params: withInv({}, investigationId),
    }
  );
};

// --------------------------------------------------
// GLOBAL MULTI-ENTITY SEARCH
// --------------------------------------------------

export const searchGlobal = (query, investigationId) => {
  return API.get(`/search`, {
    params: withInv({ q: query }, investigationId),
  });
};

// --------------------------------------------------
// DEFAULT API
// --------------------------------------------------

export default API;