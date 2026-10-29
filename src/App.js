import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './HomePage';
const JSONCompare = lazy(() => import('./JSONCompare'));
const HelpPage = lazy(() => import('./HelpPage'));

const App = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center text-sm text-slate-300">Opening workspace…</div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/compare" element={<JSONCompare />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
