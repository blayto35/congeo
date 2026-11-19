import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Manager from "./pages/Manager";
import Administration from "./pages/Administration";
import Historique from "./pages/Historique";
import Calendrier from "./pages/Calendrier";
import Layout from "./components/Layout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/connexion" replace />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/historique" element={<Historique />} />
          <Route path="/calendrier" element={<Calendrier />} />
          <Route path="/manager" element={<Manager />} />
          <Route path="/administration" element={<Administration />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
