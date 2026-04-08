import { useState, useCallback } from 'react'
import LoginPage from './pages/LoginPage.jsx'
import CalibrationPage from './pages/CalibrationPage.jsx'
import ResearchPage from './pages/ResearchPage.jsx'


export default function App() {
  const [page, setPage] = useState('login')

  const goTo = useCallback((p) => setPage(p), [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {page === 'login' && (
        <LoginPage onLogin={() => goTo('calibration')} />
      )}
      {page === 'calibration' && (
        <CalibrationPage onComplete={() => goTo('research')} />
      )}
      {page === 'research' && (
        <ResearchPage />
      )}
    </div>
  )
}
