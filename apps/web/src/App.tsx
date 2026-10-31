import { Navigate, Route, Routes } from 'react-router';
import { LobbyPage } from './pages/lobby/LobbyPage';
import { RequestFlowLayout } from './pages/request/RequestFlowLayout';
import { RequestFlowProvider } from './pages/request/RequestFlowContext';
import { StepChooseDay } from './pages/request/StepChooseDay';
import { StepDone } from './pages/request/StepDone';
import { StepSelectMortgages } from './pages/request/StepSelectMortgages';
import { StepSummary } from './pages/request/StepSummary';

import { FLOW_BASE } from './routes';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyPage />} />
      <Route
        path={FLOW_BASE}
        element={
          <RequestFlowProvider>
            <RequestFlowLayout />
          </RequestFlowProvider>
        }
      >
        <Route index element={<Navigate to="select" replace />} />
        <Route path="select" element={<StepSelectMortgages />} />
        <Route path="day" element={<StepChooseDay />} />
        <Route path="summary" element={<StepSummary />} />
        <Route path="done/:id" element={<StepDone />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
