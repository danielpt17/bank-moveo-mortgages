import './States.css';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { ApiError } from '../../api/client';
import { Button } from './Button';

export function Loading({ label = 'טוען נתונים…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'אירעה שגיאה בלתי צפויה';
  return (
    <div className="state" role="alert">
      <WarningAmberOutlined style={{ fontSize: 32, color: 'var(--error)' }} />
      <p className="text-m">לא הצלחנו לטעון את הנתונים</p>
      <p className="text-xs">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          נסה שוב
        </Button>
      ) : null}
    </div>
  );
}
