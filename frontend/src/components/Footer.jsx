import React from 'react';

const Footer = () => (
  <footer className="w-full bg-gradient-to-t from-slate-950 via-slate-900 to-transparent py-8 mt-16 border-t border-slate-800">
    <div className="max-w-screen-2xl mx-auto px-4 text-center">
      <p className="text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} <span className="font-bold text-indigo-300">DarkLens</span> &mdash; Dark Web Search &amp; Intelligence Platform
      </p>
      <p className="text-xs text-slate-600 mt-2">
        Powered by Tor, Supabase, and AI. For research and educational use only.
      </p>
    </div>
  </footer>
);

export default Footer; 