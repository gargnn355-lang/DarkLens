import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-red-500 mb-4">404</h1>
          <h2 className="text-3xl font-semibold text-slate-200 mb-4">
            Page Not Found
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved to a different location.
          </p>
        </div>
        
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Go to Homepage
          </Link>
          
          <div className="flex justify-center space-x-4">
            <Link
              to="/search"
              className="text-slate-400 hover:text-slate-200 transition-colors duration-200"
            >
              Search
            </Link>
            <Link
              to="/dashboard"
              className="text-slate-400 hover:text-slate-200 transition-colors duration-200"
            >
              Dashboard
            </Link>
            <Link
              to="/trending"
              className="text-slate-400 hover:text-slate-200 transition-colors duration-200"
            >
              Trending
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;