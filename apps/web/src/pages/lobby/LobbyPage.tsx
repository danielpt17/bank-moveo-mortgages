import './LobbyPage.css';
import { useLobby } from '../../api/hooks';
import { AppHeader } from '../../components/layout/AppHeader';
import { HeroWave } from '../../components/layout/HeroWave';
import { TopNav } from '../../components/layout/TopNav';
import { ErrorState, Loading } from '../../components/ui/States';
import { useEffect } from 'react';
import { HelpCard } from './HelpCard';
import { MarketingCard } from './MarketingCard';
import { MortgageDetails } from './MortgageDetails';
import { MortgageTimeline } from './MortgageTimeline';
import { PortfolioSummary } from './PortfolioSummary';
import { BankerCard, TipCard } from './Sidebar';

export function LobbyPage() {
  const lobby = useLobby();
  useEffect(() => {
    document.title = 'המשכנתאות שלי | בנק מובאו';
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">
        דלג לתוכן הראשי
      </a>
      <AppHeader variant="lobby" customer={lobby.data?.customer} />
      <HeroWave />
      <TopNav />

      <main id="main" className="lobby">
        {/* The page's single h1; Figma: font/size/XL (32px), Medium, line-height 100%. */}
        <h1 className="text-xl lobby__title">המשכנתאות שלי</h1>

        {lobby.isPending ? <Loading /> : null}
        {lobby.isError ? <ErrorState error={lobby.error} onRetry={() => void lobby.refetch()} /> : null}

        {lobby.data ? (
          <div className="lobby__columns">
            <div className="lobby__main">
              <PortfolioSummary summary={lobby.data.summary} generatedAt={lobby.data.generatedAt} />
              <MortgageTimeline properties={lobby.data.properties} />
              <HelpCard />
              <MarketingCard />
              <MortgageDetails properties={lobby.data.properties} />
            </div>
            <aside className="lobby__aside" aria-label="מידע אישי ועדכונים">
              <BankerCard />
              <TipCard />
            </aside>
          </div>
        ) : null}
      </main>
    </>
  );
}
