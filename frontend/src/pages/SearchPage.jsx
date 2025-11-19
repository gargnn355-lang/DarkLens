import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { getFilebaseUrl } from "../utils/filebase";

// Utility to get base .onion domain
function getBaseOnionDomain(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : "http://" + url);
    const host = u.hostname;
    const onionIndex = host.indexOf(".onion");
    if (onionIndex !== -1) {
      return host.slice(0, onionIndex + 6); // include '.onion'
    }
    return host;
  } catch {
    return url;
  }
}

// Utility to filter only main onion links (shortest URL per base domain)
function filterMainOnionLinks(links) {
  const mainLinks = {};
  for (const link of links) {
    const base = getBaseOnionDomain(link.url);
    if (!mainLinks[base] || link.url.length < mainLinks[base].url.length) {
      mainLinks[base] = link;
    }
  }
  return Object.values(mainLinks);
}

// Utility to get status color
function getStatusColor(status) {
  switch (status) {
    case "active":
      return "bg-green-500/20 text-green-400";
    case "inactive":
      return "bg-red-500/20 text-red-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}

// Utility to get risk color
function getRiskColor(risk) {
  switch (risk) {
    case "high":
      return "bg-red-500/20 text-red-400";
    case "medium":
      return "bg-yellow-500/20 text-yellow-400";
    case "low":
      return "bg-green-500/20 text-green-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}

// Debounce utility
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback(
    async (currentSearchTerm) => {
      setLoading(true);
      setError(null);

      let query;

      if (currentSearchTerm.trim() === "") {
        setSearchedTerm("");
        query = supabase
          .from("onion_links")
          .select(
            "id, title, url, content, screenshot_url, risk_score, status, updated_at",
          )
          .order("updated_at", { ascending: false });

        if (riskFilter !== "all") query = query.eq("risk_score", riskFilter);
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
      } else {
        setSearchedTerm(currentSearchTerm);
        const cleanTerm = currentSearchTerm.trim();
        const searchQuery = `title.ilike.%${cleanTerm}%,content.ilike.%${cleanTerm}%,url.ilike.%${cleanTerm}%`;

        query = supabase
          .from("onion_links")
          .select(
            "id, title, url, content, screenshot_url, risk_score, status, updated_at",
          )
          .or(searchQuery)
          .order("updated_at", { ascending: false });

        if (riskFilter !== "all") query = query.eq("risk_score", riskFilter);
        if (statusFilter !== "all") query = query.eq("status", statusFilter);
      }

      try {
        const { data, error } = await query;

        if (error) {
          console.error("Error fetching data:", error);
          setError(
            "Failed to fetch search results. Please check permissions or try again.",
          );
        } else {
          let newResults = data || [];

          if (currentSearchTerm.trim()) {
            const searchLower = currentSearchTerm.toLowerCase();
            newResults = newResults.filter((link) => {
              const title = (link.title || "").toLowerCase();
              const content = (link.content || "").toLowerCase();
              const url = (link.url || "").toLowerCase();

              return (
                title.includes(searchLower) ||
                content.includes(searchLower) ||
                url.includes(searchLower)
              );
            });
          }

          setResults(newResults);
          setTotalCount(newResults.length);
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to fetch search results.");
      }

      setLoading(false);
    },
    [riskFilter, statusFilter],
  );

  const handleFormSubmit = (e) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  // Load initial data on component mount
  useEffect(() => {
    performSearch("");
  }, []);

  // Effect for debounced search
  useEffect(() => {
    if (debouncedSearchTerm !== searchedTerm) {
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  // Effect for filter changes
  useEffect(() => {
    performSearch(debouncedSearchTerm);
  }, [riskFilter, statusFilter]);

  // Memoize filtered results for better performance
  const filteredResults = useMemo(() => {
    return filterMainOnionLinks(results);
  }, [results]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950">
      <div className="w-full h-screen flex flex-col pt-6 pb-4 px-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 drop-shadow-lg">
            DarkLens Search
          </h1>
          <p className="text-xs text-slate-300 mb-1">
            Search the dark web for onion links, markets, forums, and more.
          </p>
          <p className="text-xs text-slate-500">
            Powered by Tor, Supabase, and AI keyword tagging
          </p>
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col sm:flex-row items-center gap-2 bg-slate-800/80 p-2 rounded-lg shadow-lg mb-4 border border-slate-700"
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search content or links, e.g. counterfeit, market..."
            className="flex-grow bg-slate-700 text-white placeholder-slate-400 p-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-md transition-all text-sm"
          />
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-slate-700 text-white p-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-md transition-all text-sm"
          >
            <option value="all">All Risks</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-700 text-white p-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-md transition-all text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded shadow-lg disabled:bg-indigo-400 transition-all text-sm"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && (
          <p className="text-red-500 mt-1 text-center text-xs">{error}</p>
        )}

        {!loading && results.length > 0 && (
          <div className="text-center mb-2">
            <p className="text-slate-300 text-sm">
              Showing {filteredResults.length} results
              {searchedTerm && ` for "${searchedTerm}"`}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-2">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="text-slate-300 mt-2 text-sm">
                  Searching dark web...
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
              {filteredResults.length > 0 ? (
                filteredResults.map((link) => (
                  <Link
                    to={`/link/${link.id}?q=${encodeURIComponent(searchedTerm || "")}`}
                    key={link.id}
                    className="block bg-slate-900 hover:bg-slate-800 rounded-lg border shadow-md overflow-hidden transition-all group border-slate-800 hover:border-indigo-600 focus:ring-2 focus:ring-indigo-500 h-full flex flex-col"
                  >
                    <div className="relative flex-1 bg-slate-800 flex items-center justify-center overflow-hidden min-h-[180px]">
                    {link.screenshot_url ? (
                      <div className="relative w-full h-full">
                        <img
                          src={getFilebaseUrl(link.screenshot_path || link.screenshot_url)}
                          alt={link.title || "Screenshot"}
                          className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                          onError={(e) => {
                            console.error('Failed to load image:', e.target.src);
                            e.target.style.display = 'none';
                            // Show error message
                            const errorDiv = e.target.nextElementSibling;
                            if (errorDiv) errorDiv.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 text-sm">
                          <span>Image not available</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                        No image available
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-slate-900/80 px-2 py-1 rounded text-xs text-slate-300 font-semibold shadow">
                      {link.risk_score || "N/A"}
                    </div>
                    <div
                      className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-semibold shadow ${getStatusColor(link.status)}`}
                    >
                      {link.status || "Unknown"}
                    </div>
                    </div>
                    <div className="p-3 flex flex-col">
                      <h3 className="text-sm font-bold text-indigo-300 truncate group-hover:text-indigo-400">
                        {link.title || "Untitled Link"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {link.url}
                      </p>
                      <div className="mt-2 text-xs text-slate-300 line-clamp-2 flex-1">
                        {link.content || "No description available"}
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-slate-400">
                          {link.updated_at
                            ? new Date(link.updated_at).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  <p className="text-slate-400 text-sm">
                    {searchedTerm
                      ? `No results found for "${searchedTerm}"`
                      : "No links available. Try changing filters."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
