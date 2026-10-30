import { PageMetadata } from "./components/PageMetadata";
import { ToolPage } from "./components/ToolPage";
import { toolPages } from "./pageMetadata";
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './HomePage';
const JSONCompare = lazy(() => import('./JSONCompare'));
const HelpPage = lazy(() => import('./HelpPage'));

const App = () => {
  return (
    <BrowserRouter>
      <PageMetadata />
      <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center text-sm text-slate-300">Opening workspace…</div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {toolPages.map(page => <Route key={page.path} path={page.path} element={<ToolPage page={page} />} />)}
        <Route path="/compare" element={<JSONCompare />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
