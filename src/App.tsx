// src/App.tsx
import { Routes, Route, useLocation } from 'react-router-dom'

import Nav from './components/Nav'
import ProtectedRoute from './components/ProtectedRoute'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'

import Dashboard from './pages/dashboard/Dashboard'
import Overview from './pages/dashboard/Overview'
import Mou from './pages/dashboard/Mou'
import Invoice from './pages/dashboard/Invoice'
import Kuitansi from './pages/dashboard/Kuitansi'

import PublishPage from './pages/publish/PublishPage'
import DealPublishPage from './pages/publish/DealPublishPage'
import Superadmin from './pages/Superadmin'

export default function App() {
  const location = useLocation()
  const hideNav = /^\/(publish|deal)\//.test(location.pathname)

  return (
    <>
      {!hideNav && <Nav />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Private */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/overview" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
        <Route path="/dashboard/mou/:dealId" element={<ProtectedRoute><Mou /></ProtectedRoute>} />
        <Route path="/dashboard/invoice/:dealId" element={<ProtectedRoute><Invoice /></ProtectedRoute>} />
        <Route path="/dashboard/kuitansi/:dealId" element={<ProtectedRoute><Kuitansi /></ProtectedRoute>} />

        {/* Public publish */}
        <Route path="/publish/:uid" element={<PublishPage />} />
        <Route path="/deal/:uid" element={<DealPublishPage />} />

        {/* Admin */}
        <Route path="/superadmin" element={<Superadmin />} />
      </Routes>
    </>
  )
}
