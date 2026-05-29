import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Editor from "./pages/Editor";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/editor" element={<Editor />} />
    </Routes>
  );
}