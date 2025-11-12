import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Highlight from '../components/Highlight';

const LinkDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subdomains, setSubdomains] = useState([]);
  
  const queryParams = new URLSearchParams(location.search);
  const searchTerm = queryParams.get('q') || '';

  useEffect(() => {
    const fetchLink = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('onion_links')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching link details:', error);
      } else {
        setLink(data);
        // Fetch subdomains with the same base domain
        if (data && data.url) {
          const baseDomain = getBaseOnionDomain(data.url);
          const { data: subdomainData } = await supabase
            .from('onion_links')
            .select('id, url, title, risk_score, updated_at')
            .neq('id', id)
            .ilike('url', `%${baseDomain}%`);
          setSubdomains(subdomainData || []);
        }
      }
      setLoading(false);
    };

    if (id) {
      fetchLink();
    }
  }, [id]);

  function getBaseOnionDomain(url) {
    try {
      const u = new URL(url.startsWith('http') ? url : 'http://' + url);
      // Only keep the .onion domain part
      const host = u.hostname;
      const onionIndex = host.indexOf('.onion');
      if (onionIndex !== -1) {
        return host.slice(0, onionIndex + 6); // include '.onion'
      }
      return host;
    } catch {
      return url;
    }
  }

  const generateReport = () => {
    if (!link) return;

    const matches = {
      title: [],
      content: [],
      metadata: [],
      links: [],
    };

    const searchRegex = new RegExp(searchTerm, 'gi');

    // Check title
    if (link.title && link.title.match(searchRegex)) {
      matches.title.push(link.title);
    }
    // Check content
    if (link.content && link.content.match(searchRegex)) {
      matches.content.push(...link.content.match(new RegExp(`.{0,50}${searchTerm}.{0,50}`, 'gi')));
    }
    // Check metadata
    if (link.metadata) {
      const metaString = JSON.stringify(link.metadata);
      if (metaString.match(searchRegex)) {
        matches.metadata.push(metaString);
      }
    }
    // Check links
    if (link.links) {
      link.links.forEach(l => {
        if (l.match(searchRegex)) {
          matches.links.push(l);
        }
      });
    }

    const report = {
      searchedUrl: link.url,
      searchTerm: searchTerm,
      riskScore: link.risk_score,
      timestamp: new Date().toISOString(),
      matches: matches,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `report_${link.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (loading) return <p>Loading link details...</p>;
  if (!link) return <p>Link not found.</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 pb-16">
      <div className="max-w-screen-2xl mx-auto pt-12 pb-6 px-2 sm:px-4 md:px-6 lg:px-12">
        <div className="bg-slate-900/90 p-6 rounded-2xl shadow-2xl border border-slate-800">
          {link.screenshot_url && (
            <div className="mb-6 flex justify-center">
              <img
                src={link.screenshot_url}
                alt={link.title || 'Screenshot'}
                className="rounded-xl shadow-lg max-h-96 object-contain border border-slate-800 bg-slate-800"
                style={{ maxWidth: '100%' }}
              />
            </div>
          )}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-400">
            <Highlight text={link.title || 'No Title'} term={searchTerm} />
          </h1>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:underline">
            <Highlight text={link.url} term={searchTerm} />
          </a>
        </div>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
            link.risk_score === 'high' ? 'bg-red-500/20 text-red-400' :
            link.risk_score === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
          }`}>
            {link.risk_score} Risk
          </span>
          <button onClick={generateReport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm">
            Download Report
          </button>
        </div>
      </div>

      <div className="prose prose-invert max-w-none mt-6">
            <h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-1 mb-2">Page Content</h2>
        <p className="text-slate-300 whitespace-pre-wrap">
          <Highlight text={link.content} term={searchTerm} />
        </p>

        {link.metadata && Object.keys(link.metadata).length > 0 && (
          <>
                <h2 className="text-xl font-semibold text-white mt-6 border-b border-slate-700 pb-1 mb-2">Metadata</h2>
            <pre className="bg-slate-900 p-4 rounded-md text-sm text-slate-300">
              <Highlight text={JSON.stringify(link.metadata, null, 2)} term={searchTerm} />
            </pre>
          </>
        )}

        {link.links && link.links.length > 0 && (
          <>
                <h2 className="text-xl font-semibold text-white mt-6 border-b border-slate-700 pb-1 mb-2">Discovered .onion Links ({link.links.length})</h2>
            <ul className="list-disc pl-5">
              {link.links.map((l, i) => (
                <li key={i} className="text-slate-400"><Highlight text={l} term={searchTerm} /></li>
              ))}
            </ul>
          </>
        )}
            {/* Subdomains Section */}
            {subdomains.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-semibold text-indigo-300 mb-4 border-b border-slate-700 pb-1">Other Subdomains for this Onion</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {subdomains.map((sub) => (
                    <Link
                      to={`/link/${sub.id}`}
                      key={sub.id}
                      className="block bg-slate-900 hover:bg-slate-800 rounded-lg shadow-md p-4 transition-colors border border-slate-800"
                    >
                      <div className="font-bold text-indigo-200 truncate mb-1">{sub.title || 'No Title'}</div>
                      <div className="text-xs text-slate-400 truncate mb-1">{sub.url}</div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${sub.risk_score === 'high' ? 'bg-red-700 text-red-200' : sub.risk_score === 'medium' ? 'bg-yellow-700 text-yellow-200' : sub.risk_score === 'low' ? 'bg-green-700 text-green-200' : 'bg-slate-700 text-slate-200'}`}>{sub.risk_score || 'N/A'}</span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-700 text-slate-200">{sub.updated_at ? new Date(sub.updated_at).toLocaleDateString() : 'Never'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkDetailPage; 
