export function DashboardPreview() {
  return (
    <div className="dashboard-preview" aria-label="Voorbeeld van het LinkConnect dashboard">
      <div className="dashboard-topbar">
        <div>
          <span className="dashboard-kicker">Mijn leads</span>
          <strong>Deze week</strong>
        </div>
        <span className="dashboard-count">02 nieuw</span>
      </div>
      <div className="dashboard-filters">
        <span>Categorie: IT &amp; software</span>
        <span>Regio: Randstad</span>
      </div>
      <div className="lead-row lead-row-highlight">
        <span className="lead-status" aria-hidden="true" />
        <div>
          <strong>Groeiend B2B-team</strong>
          <span>Wil kennismaken over procesverbetering</span>
        </div>
        <time dateTime="2026-10-02">Vandaag</time>
      </div>
      <div className="lead-row">
        <span className="lead-status" aria-hidden="true" />
        <div>
          <strong>Regionale dienstverlener</strong>
          <span>Past binnen jouw gekozen categorie</span>
        </div>
        <time dateTime="2026-10-01">Gisteren</time>
      </div>
      <div className="dashboard-footer">
        <span>Alle leads komen met context</span>
        <span className="dashboard-link">Bekijk dashboard</span>
      </div>
    </div>
  );
}
