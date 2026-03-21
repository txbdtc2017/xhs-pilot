export default function Home() {
  return (
    <main
      className="container"
      style={{
        minHeight: '100vh',
        display: 'grid',
        alignItems: 'center',
        paddingBlock: 'var(--spacing-xl)',
      }}
    >
      <section
        className="card"
        style={{
          display: 'grid',
          gap: 'var(--spacing-lg)',
          padding: 'var(--spacing-xl)',
        }}
      >
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          <p
            style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-sm)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Phase 1 Scaffold
          </p>
          <h1 style={{ fontSize: '2.5rem', lineHeight: 1.1 }}>XHS Pilot</h1>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '42rem' }}>
            Project infrastructure is in place. This phase only exposes the health check, database
            migrations, storage and model clients, and a BullMQ worker skeleton.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 'var(--spacing-md)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-md)',
            }}
          >
            <strong>App Router</strong>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              Next.js scaffold with a single placeholder page.
            </p>
          </div>
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-md)',
            }}
          >
            <strong>Infrastructure</strong>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              PostgreSQL, Redis, storage abstraction, logging, and worker entrypoint.
            </p>
          </div>
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-md)',
            }}
          >
            <strong>Phase Boundary</strong>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              No business APIs, agent logic, or product pages beyond this placeholder.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
