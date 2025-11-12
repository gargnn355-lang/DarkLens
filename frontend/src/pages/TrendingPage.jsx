import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const TrendingPage = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  const fetchTrendingLinks = async (pageNum = 0, status = 'all', tag = '') => {
      setLoading(true);
      setError(null);
    let query = supabase
        .from('onion_links')
        .select('id, url, source_urls, title, tags, status, trending_score, last_crawled_at, source_count')
        .order('trending_score', { ascending: false })
      .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1);
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }
    const { data, error } = await query;
      if (error) setError(error.message);
    else {
      setLinks(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
    }
      setLoading(false);
    };

  // Fetch all unique tags for filtering
  const fetchTags = async () => {
    const { data, error } = await supabase
      .from('onion_links')
      .select('tags');
    if (!error && data) {
      const tagsSet = new Set();
      data.forEach(row => {
        if (Array.isArray(row.tags)) {
          row.tags.forEach(tag => tagsSet.add(tag));
        }
      });
      setAvailableTags(Array.from(tagsSet));
    }
  };

  useEffect(() => {
    fetchTrendingLinks(page, statusFilter, tagFilter);
    // eslint-disable-next-line
  }, [page, statusFilter, tagFilter]);

  useEffect(() => {
    fetchTags();
  }, []);

  const handleRefresh = () => {
    fetchTrendingLinks(page, statusFilter, tagFilter);
  };

  const handleRetry = () => {
    fetchTrendingLinks(page, statusFilter, tagFilter);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(0);
  };

  const handleTagChange = (e) => {
    setTagFilter(e.target.value);
    setPage(0);
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-white mb-6">Trending Onion Links</h1>
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <button
          onClick={handleRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          Refresh
        </button>
        <div>
          <label className="text-slate-300 mr-2">Status:</label>
          <select value={statusFilter} onChange={handleStatusChange} className="bg-slate-700 text-white rounded px-2 py-1">
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-slate-300 mr-2">Tag:</label>
          <select value={tagFilter} onChange={handleTagChange} className="bg-slate-700 text-white rounded px-2 py-1">
            <option value="">All</option>
            {availableTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <p className="text-center text-slate-300">Loading...</p>
      ) : error ? (
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <button
            onClick={handleRetry}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg shadow-lg bg-slate-800">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Trending</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">URL</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Sources</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Source Count</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Last Crawled</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Title</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Tags</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {links.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-6">No trending links found.</td>
                </tr>
              ) : (
                links.map(link => (
                  <tr key={link.id} className="hover:bg-slate-700 transition-colors">
                      <td className="px-4 py-2 font-bold text-indigo-400">{link.trending_score ?? 0}</td>
                    <td className="px-4 py-2 break-all">
                        {link.url ? (
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{link.url}</a>
                        ) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-2 break-all text-slate-300">{Array.isArray(link.source_urls) ? link.source_urls.join(', ') : (link.source_urls || '-')}</td>
                      <td className="px-4 py-2 text-slate-200">{link.source_count ?? 1}</td>
                    <td className="px-4 py-2 text-slate-200">{link.last_crawled_at ? new Date(link.last_crawled_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2 text-slate-200">{link.title || '-'}</td>
                    <td className="px-4 py-2">
                      {Array.isArray(link.tags) && link.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {link.tags.map(tag => (
                            <span key={tag} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-semibold">{tag}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${link.status === 'active' ? 'bg-green-600 text-white' : link.status === 'inactive' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white'}`}>{link.status || '-'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0 || loading}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-slate-300">Page {page + 1}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasMore || loading}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TrendingPage; 