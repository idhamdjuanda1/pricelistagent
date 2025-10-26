import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

// sesuai casing & lokasi:
const PublishPage = lazy(() => import("../pages/publish/PublishPage"));
const DealPublishPage = lazy(() => import("../pages/publish/DealPublishPage"));

export default function AppRouters() {
  return (
    <Suspense fallback={<div style={{padding:16}}>Loading…</div>}>
      <Routes>
        <Route path="/publish/:uid" element={<PublishPage />} />
        <Route path="/deal/:uid" element={<DealPublishPage />} />
      </Routes>
    </Suspense>
  );
}
