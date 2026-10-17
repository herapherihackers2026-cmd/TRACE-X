import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import { InvestigationProvider } from "./context/InvestigationContext";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import Persons from "./pages/Persons";
import PersonDetails from "./pages/PersonDetails";
import Network from "./pages/Network";
import Cases from "./pages/Cases";
import ImportData from "./pages/ImportData";
import Investigations from "./pages/Investigations";

function App() {
  return (
    <BrowserRouter>
      <InvestigationProvider>
        <div className="app">
          <Sidebar />

          <Routes>
            {/* DASHBOARD */}
            <Route
              path="/"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />

            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            {/* PERSONS */}
            <Route
              path="/persons"
              element={<Persons />}
            />

            {/* PERSON DETAILS */}
            <Route
              path="/person/:personId"
              element={<PersonDetails />}
            />

            {/* GLOBAL NETWORK */}
            <Route
              path="/network"
              element={<Network />}
            />

            {/* CASES */}
            <Route
              path="/cases"
              element={<Cases />}
            />

            {/* IMPORT DATA */}
            <Route
              path="/import"
              element={<ImportData />}
            />

            {/* INVESTIGATIONS MANAGER */}
            <Route
              path="/investigations"
              element={<Investigations />}
            />

            {/* FALLBACK */}
            <Route
              path="*"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />
          </Routes>
        </div>
      </InvestigationProvider>
    </BrowserRouter>
  );
}

export default App;