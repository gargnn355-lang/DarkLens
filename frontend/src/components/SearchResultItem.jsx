import React from 'react';
import { Link } from 'react-router-dom';
import Highlight from './Highlight';

const SearchResultItem = ({ link, searchTerm }) => {

  const createSnippet = (content, term) => {
    if (!term || !content) {
      return <p className="text-slate-300 mt-2 text-sm line-clamp-2">{content || 'No content available'}</p>;
    }

    const lowerContent = content.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const termIndex = lowerContent.indexOf(lowerTerm);

    if (termIndex === -1) {
      return <p className="text-slate-300 mt-2 text-sm line-clamp-2">{content}</p>;
    }
    
    const start = Math.max(0, termIndex - 75);
    const end = Math.min(content.length, termIndex + term.length + 75);
    
    let snippet = content.substring(start, end);
    
    const regex = new RegExp(`(${term})`, 'gi');
    snippet = snippet.replace(regex, `<mark class="bg-indigo-500 text-white px-1">$1</mark>`);

    if (start > 0) {
      snippet = '...' + snippet;
    }
    if (end < content.length) {
      snippet = snippet + '...';
    }

    return <p className="text-slate-300 mt-2 text-sm" dangerouslySetInnerHTML={{ __html: snippet }}></p>;
  };

  // Safely get values with fallbacks
  const title = link?.title || 'No Title';
  const url = link?.url || 'No URL';
  const content = link?.content || '';
  const riskScore = link?.risk_score || 'unknown';
  const isActive = link?.is_active !== false; // Default to true if not explicitly false
  const lastChecked = link?.updated_at ? new Date(link.updated_at).toLocaleDateString() : 'Never';

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusColor = (active) => {
    return active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400';
  };

  return (
    <Link to={`/link/${link?.id}?q=${encodeURIComponent(searchTerm || '')}`} key={link?.id} className="block bg-slate-800 hover:bg-slate-700 p-4 rounded-lg shadow-md transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-indigo-400 truncate">
            <Highlight text={title} term={searchTerm} />
          </h3>
          <p className="text-sm text-slate-400 truncate">{url}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(riskScore)}`}>
              {riskScore}
            </span>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(isActive)}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="text-xs text-slate-500">
              Last checked: {lastChecked}
            </span>
          </div>
        </div>
      </div>
      {createSnippet(content, searchTerm)}
    </Link>
  );
};

export default SearchResultItem;