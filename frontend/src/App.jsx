import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import SearchPage from './pages/SearchPage';
import DashboardPage from './pages/DashboardPage';
import CrawlPage from './pages/CrawlPage';
import LinkDetailPage from './pages/LinkDetailPage';
import SourceManagerPage from './pages/SourceManagerPage';
import NotFoundPage from './pages/NotFoundPage';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/crawl" element={<CrawlPage />} />
            <Route path="/link/:id" element={<LinkDetailPage />} />
            <Route path="/sources" element={<SourceManagerPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;