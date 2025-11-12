import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex flex-col justify-center items-center pb-16">
    <div className="w-full max-w-3xl mx-auto px-4 pt-20 pb-10 text-center">
      <div className="flex flex-col items-center mb-8">
        <span className="text-7xl md:text-8xl mb-4 drop-shadow-lg">🕷️</span>
        <h1 className="text-5xl md:text-6xl font-extrabold text-indigo-300 mb-4 drop-shadow-lg">DarkLens</h1>
        <p className="text-lg md:text-xl text-slate-300 mb-2 font-medium">Dark Web Search &amp; Intelligence Platform</p>
        <p className="text-base text-slate-400 mb-6">Explore, analyze, and monitor .onion sites, markets, forums, and leaks with AI-powered tagging, screenshots, and risk scoring.</p>
        <Link to="/search" className="mt-4 inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-xl shadow-lg text-lg transition-all duration-200 ease-in-out transform hover:scale-105">
          Start Searching
        </Link>
      </div>
      <div className="bg-slate-900/90 rounded-2xl shadow-xl p-8 border border-slate-800 mt-8">
        <h2 className="text-2xl font-bold text-indigo-200 mb-4">How It Works</h2>
        <ol className="text-left text-slate-300 space-y-4 list-decimal list-inside mx-auto max-w-xl">
          <li>
            <span className="font-semibold text-indigo-300">Crawling:</span> Our backend crawler continuously scans and indexes .onion sites using Tor, extracting content, screenshots, and metadata.
          </li>
          <li>
            <span className="font-semibold text-indigo-300">AI Tagging &amp; Risk Scoring:</span> Each site is analyzed for keywords (e.g., drugs, bitcoin, hacking) and assigned a risk score based on its content.
          </li>
          <li>
            <span className="font-semibold text-indigo-300">Search &amp; Explore:</span> Use the search engine to find onion links, view screenshots, see risk levels, and explore related subdomains.
          </li>
          <li>
            <span className="font-semibold text-indigo-300">Monitor &amp; Manage:</span> Dashboard and source management tools help you track trends, manage sources, and monitor new leaks.
          </li>
        </ol>
      </div>
    </div>
  </div>
);

export default HomePage; 