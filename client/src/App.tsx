import { useEffect, useState } from 'react';
import { api } from './api/client';

export default function App() {
  const [status, setStatus] = useState<string>('…');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setStatus(res.data.status))
      .catch(() => setStatus('hors ligne'));
  }, []);

  return (
    <main className="app">
      <h1>SUPMEAL</h1>
      <p className="tagline">Gestion de recettes &amp; planification de repas</p>
      <p>
        API : <span className="badge">{status}</span>
      </p>
    </main>
  );
}
