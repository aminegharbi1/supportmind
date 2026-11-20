import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TicketDetail from "./pages/TicketDetail";
import TicketList from "./pages/TicketList";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <header className="topbar">
        <span className="brand">SupportMind</span>
        <nav>
          <NavLink to="/" end>Tickets</NavLink>
          <NavLink to="/tableau-de-bord">Tableau de bord</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<TicketList />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/tableau-de-bord" element={<Dashboard />} />
          <Route path="*" element={<p className="muted">Page introuvable.</p>} />
        </Routes>
      </main>
    </BrowserRouter>
  </React.StrictMode>
);
