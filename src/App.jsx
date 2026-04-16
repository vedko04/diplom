import { useState } from 'react'
import LoginPage from './pages/LoginPage.jsx'
import CalibrationPage from './pages/CalibrationPage.jsx'
import ResearchPage from './pages/ResearchPage.jsx'

export default function App() {
  const [page, setPage] = useState('login')

  // Добавим лог для отладки
  console.log("Текущая страница:", page);

  return (
      <div style={{ width: '100vw', height: '100vh', background: '#05080f' }}>
        {page === 'login' && (
            <LoginPage onLogin={() => setPage('calibration')} />
        )}
        {page === 'calibration' && (
            <CalibrationPage onComplete={() => setPage('research')} />
        )}
        {page === 'research' && (
            <ResearchPage />
        )}
      </div>
  )
}