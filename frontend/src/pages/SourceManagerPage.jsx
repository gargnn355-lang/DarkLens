import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const INITIAL_SOURCES = [

  {
    url: 'http://zqktlwiuavvvqqt4ybvgvi7tyo4hjl5xgfuvpdf6otjiycgwqbym2qad.onion/wiki/index.php/Main_Page',
    description: 'The Hidden Wiki (v3 mirror)'
  },
  {
    url: 'http://torlinksge6enmcyyuxjpjkoouw4oorgdgeo7ftnq3zodj7g2zxi3kyd.onion/',
    description: 'TorLinks (Hidden Wiki alternative)'
  },
  {
    url: 'http://jaz45aabn5vkemy4jkg4mi4syheisqn2wn2n4fsuitpccdackjwxplad.onion/',
    description: 'OnionLinks (Hidden Wiki mirror)'
  }
];

const SourceManagerPage = () => {
  const [sources, setSources] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef();

  useEffect(() => {
    fetchSources();
    // eslint-disable-next-line
  }, []);

  async function fetchSources() {
    setLoading(true);
    const { data, error } = await supabase
      .from('onion_sources')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) {
      setSources(data);
      // If table is empty, initialize with default sources
      if (data.length === 0) {
        await initializeSources();
        // Fetch again after initializing
        const { data: newData } = await supabase
          .from('onion_sources')
          .select('*')
          .order('created_at', { ascending: false });
        setSources(newData);
        setMessage('Initialized with default sources.');
      }
    }
    setLoading(false);
  }

  async function initializeSources() {
    for (const src of INITIAL_SOURCES) {
      // Check if the source already exists
      const { data: existing } = await supabase
        .from('onion_sources')
        .select('id')
        .eq('url', src.url)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from('onion_sources')
          .insert([src]);
      }
    }
  }

  async function addSource(e) {
    e.preventDefault();
    setMessage('');
    if (!newUrl) return;

    // Check for duplicate
    const exists = sources.some(src => src.url.trim() === newUrl.trim());
    if (exists) {
      setMessage('This source already exists.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('onion_sources')
      .insert([{ url: newUrl.trim(), description: newDescription }]);
    if (!error) {
      setNewUrl('');
      setNewDescription('');
      fetchSources();
      setMessage('Source added!');
    } else if (error.code === '23505') {
      setMessage('This source already exists.');
    } else {
      setMessage('Error adding source.');
    }
    setLoading(false);
  }

  async function handleFileUpload(e) {
    setMessage('');
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);

    try {
      const text = await file.text();
      const urls = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.startsWith('http'));

      let added = 0;
      for (const url of urls) {
        // Check for duplicate in current sources
        if (!sources.some(src => src.url.trim() === url)) {
          const { error } = await supabase
            .from('onion_sources')
            .insert([{ url }]);
          if (!error) added++;
        }
      }
      setMessage(`${added} source(s) added from file.`);
      fetchSources();
    } catch (err) {
      setMessage('Error reading file.');
    }

    // Discard the file (reset input)
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(false);
  }

  async function updateSource(id, updates) {
    setLoading(true);
    await supabase
      .from('onion_sources')
      .update(updates)
      .eq('id', id);
    fetchSources();
    setLoading(false);
  }

  async function removeSource(id) {
    setLoading(true);
    await supabase
      .from('onion_sources')
      .delete()
      .eq('id', id);
    fetchSources();
    setLoading(false);
  }

  function isExpired(src) {
    return src.last_status && [404, 410].includes(src.last_status);
  }

  async function removeExpiredSources() {
    setLoading(true);
    const expired = sources.filter(isExpired);
    for (const src of expired) {
      await supabase.from('onion_sources').delete().eq('id', src.id);
    }
    fetchSources();
    setLoading(false);
    setMessage(`${expired.length} expired source(s) removed.`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 pb-16">
      <div className="max-w-screen-2xl mx-auto pt-12 pb-6 px-2 sm:px-4 md:px-6 lg:px-12">
        <div className="bg-slate-900/90 p-6 rounded-2xl shadow-2xl border border-slate-800 mt-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-300 mb-6 drop-shadow-lg text-center">Manage Onion Sources</h1>
      <form onSubmit={addSource} className="mb-6 flex flex-col gap-2">
        <input
          type="url"
          className="p-2 rounded bg-slate-700 text-white"
          placeholder="Source URL"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          required
        />
        <input
          type="text"
          className="p-2 rounded bg-slate-700 text-white"
          placeholder="Description (optional)"
          value={newDescription}
          onChange={e => setNewDescription(e.target.value)}
        />
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading}
        >
          Add Source
        </button>
        <input
          type="file"
          accept=".txt"
          ref={fileInputRef}
          className="mt-2"
          onChange={handleFileUpload}
          disabled={loading}
        />
        {message && <div className="text-sm text-yellow-400 mt-1">{message}</div>}
      </form>
      <button
        onClick={removeExpiredSources}
        className="mb-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        disabled={loading}
      >
        Remove Expired Sources
      </button>
          <h2 className="text-2xl font-semibold text-white mb-4 mt-8 border-b border-slate-700 pb-1">Current Sources</h2>
      <div className="mb-4 text-yellow-300 text-sm">
        After adding a new source, please wait at least <b>10 seconds</b> for the system to fetch links from that source.
      </div>
      {loading ? (
            <p className="text-slate-400 text-center">Loading...</p>
      ) : (
            <ul className="space-y-4">
          {sources.map(src => (
                <li key={src.id} className="bg-slate-800 p-4 rounded-xl flex flex-col gap-1 w-full shadow border border-slate-700">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center w-full gap-2">
                    <span className="text-indigo-200 break-all font-semibold text-lg">{src.url}</span>
                    <div className="flex flex-row gap-2 mt-2 md:mt-0">
                  <button
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      src.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}
                    onClick={() => updateSource(src.id, { is_active: !src.is_active })}
                  >
                    {src.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    className="px-3 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400"
                    onClick={() => removeSource(src.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
                  <div className="text-slate-300 text-sm break-all mt-1">{src.description}</div>
                  <div className="text-slate-500 text-xs mt-1">
                Last checked: {src.last_checked_at ? new Date(src.last_checked_at).toLocaleString() : 'Never'}
                {src.last_status && ` | Last status: ${src.last_status}`}
                {isExpired(src) && <span className="ml-2 text-red-400 font-bold">[Expired]</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
        </div>
      </div>
    </div>
  );
};

export default SourceManagerPage;
