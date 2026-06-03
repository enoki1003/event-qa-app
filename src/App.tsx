import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import HostLogin from "./pages/HostLogin";
import HostDashboard from "./pages/HostDashboard";
import HostRoom from "./pages/HostRoom";
import HostReport from "./pages/HostReport";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<Room />} />
        <Route path="/host" element={<HostLogin />} />
        <Route path="/host/dashboard" element={<HostDashboard />} />
        <Route path="/host/room/:roomId" element={<HostRoom />} />
        <Route path="/host/room/:roomId/report" element={<HostReport />} />
      </Routes>
    </BrowserRouter>
  );
}
