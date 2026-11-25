export default function Loading() {
  return (
    <main className="page container" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 44, width: "min(420px, 80%)", marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 18, width: "min(560px, 90%)", marginBottom: 40 }} />
      <div className="tournament-grid">{[0, 1, 2].map((index) => <div key={index} className="skeleton" style={{ height: 340 }} />)}</div>
    </main>
  );
}
