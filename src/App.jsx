import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import BillDetail from "./pages/BillDetail";
import Following from "./pages/Following";
import CalendarPage from "./pages/CalendarPage";
import Representatives from "./pages/Representatives";
import Learn from "./pages/Learn";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/bills/:billId" element={<BillDetail />} />
        <Route path="/following" element={<Following />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/representatives" element={<Representatives />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}
