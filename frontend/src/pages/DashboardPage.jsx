import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';

const PAGE_SIZE = 20; // Number of items per page

const COUNTRY_KEYWORDS = {
  India: [
    'india', 'indian', 'government', 'govt', 'goi', 'mod', 'pm modi', 'parliament',
    'airforce', 'army', 'navy', 'nia', 'cbi', 'delhi police', 'uidai', 'aadhaar', 'passport',
    'delhi', 'mumbai', 'bangalore', 'kolkata', 'hyderabad', 'chennai', 'jaipur', 'lucknow',
    'kanpur', 'surat', 'pune', 'ahmedabad', 'uttar pradesh', 'maharashtra', 'tamil nadu',
    'gujarat', 'punjab', 'bihar',
  ],
  USA: [
    'usa', 'united states', 'america', 'american', 'us', 'fbi', 'cia', 'nsa', 'white house',
    'new york', 'california', 'texas', 'florida', 'chicago', 'los angeles', 'washington',
    'pentagon', 'homeland security', 'ssn', 'social security', 'irs', 'doj', 'dod',
  ],
  UK: [
    'uk', 'united kingdom', 'britain', 'british', 'england', 'scotland', 'wales', 'northern ireland',
    'london', 'manchester', 'nhs', 'mi5', 'mi6', 'gchq', 'passport', 'hmrc',
  ],
};
const COUNTRY_LIST = ['India', 'USA', 'UK', 'All'];

function getRiskColor(score) {
  if (score >= 8) return 'bg-red-700 text-red-200';
  if (score >= 5) return 'bg-yellow-700 text-yellow-200';
  return 'bg-green-700 text-green-200';
}

function highlightKeywords(text, keywords) {
  let result = text;
  keywords.forEach(kw => {
    const regex = new RegExp(`(${kw})`, 'gi');
    result = result.replace(regex, '<mark class="bg-yellow-300 text-black">$1</mark>');
  });
  return result;
}

function matchesCountry(link, country) {
  if (country === 'All') return true;
  const keywords = COUNTRY_KEYWORDS[country] || [];
  const text = (link.title || '') + ' ' + (link.content || '');
  return keywords.some(kw => text.toLowerCase().includes(kw));
}

const DashboardPage = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('India');

  useEffect(() => {
    const fetchLinks = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('onion_links')
        .select('id, url, title, content, risk_score, updated_at, status')
        .order('updated_at', { ascending: false })
        .limit(500); // Fetch more for filtering
      if (error) {
        setError('Failed to fetch data. Please try again.');
      } else {
        setLinks(data || []);
      }
      setLoading(false);
    };
    fetchLinks();
  }, []);

  const filteredLinks = links.filter(link => matchesCountry(link, activeTab));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 pb-16">
      <div className="max-w-screen-2xl mx-auto pt-12 pb-6 px-2 sm:px-4 md:px-6 lg:px-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3 drop-shadow-lg">Data Breach Dashboard</h1>
          <p className="text-lg text-slate-300 mb-2">Monitor global and country-specific breaches, leaks, and keywords on the dark web.</p>
        </div>
        <div className="flex justify-center mb-8 gap-2 flex-wrap">
          {COUNTRY_LIST.map(country => (
            <button
              key={country}
              onClick={() => setActiveTab(country)}
              className={
                (activeTab === country
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-indigo-800 hover:text-white') +
                ' px-6 py-2 rounded-full font-bold text-lg transition-all duration-200 ease-in-out border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
              }
            >
              {country}
            </button>
          ))}
        </div>
        {error && <p className="text-red-500 bg-red-900/50 p-3 rounded-md text-center mb-6">{error}</p>}
        {loading ? (
          <div className="text-center text-slate-300 text-lg">Loading data...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
            {filteredLinks.length === 0 ? (
              <div className="col-span-full text-center text-slate-400">No breaches found for {activeTab}.</div>
            ) : (
              filteredLinks.map(link => (
                <Link
                  key={link?.id || link?.url || Math.random()}
                  to={`/link/${link.id}`}
                  className={`block rounded-2xl shadow-xl p-5 transition-all h-full border border-slate-800 hover:border-indigo-600 bg-slate-900/90 hover:bg-slate-800 transform hover:scale-105 hover:shadow-2xl duration-200 ease-in-out`}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-2">
                      <h3 className="text-lg font-bold truncate text-indigo-300 group-hover:text-indigo-400 transition-colors">{link?.title || '(No title)'}</h3>
                      <p className="text-xs text-slate-400 break-all truncate">{link?.url || ''}</p>
                    </div>
                    <div className="flex-1 mb-2">
                      <div className="text-slate-200 text-sm line-clamp-3 whitespace-pre-line min-h-[2.5em]" dangerouslySetInnerHTML={{ __html: highlightKeywords((link?.content ? String(link.content).slice(0, 180) + (String(link.content).length > 180 ? '...' : '') : 'No content available'), COUNTRY_KEYWORDS[activeTab] || []) }} />
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-slate-700 text-slate-200">Risk: {link?.risk_score ?? 'N/A'}</span>
                      <span className="text-xs text-slate-400">{link?.updated_at ? new Date(link?.updated_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage; 