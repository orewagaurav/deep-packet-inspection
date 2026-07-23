import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Traffic from './pages/Traffic'
import Blocked from './pages/Blocked'
import Alerts from './pages/Alerts'
import Rules from './pages/Rules'
import Geo from './pages/Geo'

export default function App() {
  return (
    <div className="relative flex min-h-screen text-ink">
      <Sidebar />
      <main className="relative z-10 ml-60 flex-1 px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/traffic" element={<Traffic />} />
            <Route path="/blocked" element={<Blocked />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/geo" element={<Geo />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
