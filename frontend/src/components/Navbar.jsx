import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const navItems = [
    { path: '/search', name: 'Search' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/crawl', name: 'Crawl' },
    { path: '/sources', name: 'Sources' },
    { path: '/trending', name: 'Trending' }, // Ensure Trending nav item is present
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 md:px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="text-3xl font-extrabold text-indigo-300 tracking-tight drop-shadow-lg flex items-center gap-2 hover:text-indigo-400 transition-colors duration-200">
              <span className="text-4xl">🕷️</span> DarkLens
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={
                    (location.pathname === item.path
                      ? 'text-indigo-400 border-b-2 border-indigo-500 bg-slate-800'
                      : 'text-slate-300 hover:text-indigo-300 hover:bg-slate-800/60') +
                    ' px-4 py-2 rounded-lg text-base font-semibold transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 transform hover:scale-105 relative after:absolute after:left-4 after:right-4 after:bottom-1 after:h-0.5 after:bg-indigo-400 after:rounded-full after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200 after:ease-in-out'
                  }
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar; 