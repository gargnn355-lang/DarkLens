import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getFilebaseUrl } from '../utils/filebase';
import Highlight from '../components/Highlight';

const LinkDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subdomains, setSubdomains] = useState([]);
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState(null);
  
  const queryParams = new URLSearchParams(location.search);
  const searchTerm = queryParams.get('q') || '';


  // Helper function to extract base domain
  const getBaseOnionDomain = (url) => {
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
  };

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

  // Load screenshot function
  const loadScreenshot = async (screenshotPath) => {
    console.log('[loadScreenshot] Raw screenshot path:', screenshotPath);
    console.log('Loading screenshot with path:', screenshotPath);
    
    if (!screenshotPath) {
      console.log('No screenshot path provided');
      setScreenshotError('No screenshot available for this link');
      setIsLoadingScreenshot(false);
      return;
    }
    
    setIsLoadingScreenshot(true);
    setScreenshotError(null);
    
    try {
      // Clean up the path - remove any leading slashes or unwanted characters
      let cleanPath = screenshotPath;
      
      // If it's a full URL, use it as is
      if (!screenshotPath.startsWith('http')) {
        cleanPath = screenshotPath.replace(/^\/+/, '');
        
        // If the path doesn't look like a full path, try to construct it
        if (!cleanPath.includes('/')) {
          // Try to construct a path based on the link's URL
          try {
            const urlObj = new URL(link.url);
            const hostname = urlObj.hostname;
            cleanPath = `screenshots/${hostname}/${cleanPath}`;
            console.log('Reconstructed screenshot path:', cleanPath);
          } catch (e) {
            console.error('Error constructing screenshot path:', e);
          }
        }
      }
      
      console.log('Final screenshot path:', cleanPath);
      
      // Get the direct URL
      const directUrl = getFilebaseUrl(cleanPath);
      console.log('Constructed screenshot URL:', directUrl);
      
      // Log the full request that will be made
      console.log('Attempting to fetch from URL:', directUrl);
      
      // Try a direct fetch to see the response
      try {
        const response = await fetch(directUrl, { method: 'HEAD' });
        console.log('Screenshot HEAD response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
      } catch (fetchError) {
        console.error('Error fetching screenshot HEAD:', fetchError);
      }
      
      // Test if the URL is accessible
      const testImg = new Image();
      
      // Set up a promise to handle the image loading
      const loadImage = (url) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Image loading timed out'));
          }, 10000); // 10 second timeout
          
          testImg.onload = () => {
            clearTimeout(timeoutId);
            resolve(url);
          };
          
          testImg.onerror = (e) => {
            clearTimeout(timeoutId);
            reject(new Error('Failed to load image'));
          };
          
          // Start loading the image
          testImg.src = url;
        });
      };
      
      // Try to load the image
      try {
        await loadImage(directUrl);
        console.log('Screenshot loaded successfully');
        setScreenshotUrl(directUrl);
      } catch (error) {
        console.error('Error loading screenshot:', {
          path: screenshotPath,
          cleanPath,
          directUrl,
          error: error.message
        });
        
        // Try to load with a different approach if the first one fails
        if (screenshotPath !== cleanPath) {
          try {
            console.log('Trying alternative path:', screenshotPath);
            await loadImage(getFilebaseUrl(screenshotPath));
            console.log('Screenshot loaded successfully with alternative path');
            setScreenshotUrl(getFilebaseUrl(screenshotPath));
          } catch (e) {
            console.error('Alternative path also failed:', e);
            throw e;
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in loadScreenshot:', error);
      setScreenshotError('Failed to load screenshot. The screenshot may not be available for this link.');
    } finally {
      setIsLoadingScreenshot(false);
    }
  };

  useEffect(() => {
    const fetchLink = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('onion_links')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('Error fetching link details:', error);
        } else {
          console.log('Fetched link data:', {
            id: data.id,
            url: data.url,
            screenshot_path: data.screenshot_path,
            has_screenshot: !!data.screenshot_path
          });
          
          setLink(data);
          
          // Load screenshot if available
          if (data.screenshot_url) {
            const screenshotUrl = data.screenshot_url.startsWith('http') 
              ? data.screenshot_url 
              : getFilebaseUrl(data.screenshot_url);
            
            console.log('Screenshot details:', {
              originalUrl: data.screenshot_url,
              processedUrl: screenshotUrl,
              isFullUrl: data.screenshot_url.startsWith('http')
            });
            
            setScreenshotUrl(screenshotUrl);
            setIsLoadingScreenshot(false);
          } else {
            console.log('No screenshot available for this link');
            setScreenshotError('No screenshot available for this link');
            setIsLoadingScreenshot(false);
          }
          
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
      } catch (error) {
        console.error('Error in fetchLink:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLink();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex items-center justify-center">
        <div className="bg-slate-900/90 p-8 rounded-2xl shadow-2xl border border-slate-800 text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Link not found</h1>
          <Link 
            to="/" 
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 pb-16">
      <div className="max-w-screen-2xl mx-auto pt-12 pb-6 px-2 sm:px-4 md:px-6 lg:px-12">
        <div className="bg-slate-900/90 p-6 rounded-2xl shadow-2xl border border-slate-800">
          {/* Screenshot Section */}
          {isLoadingScreenshot ? (
            <div className="mb-6 flex justify-center">
              <div className="w-full h-64 bg-slate-800 rounded-xl animate-pulse"></div>
            </div>
          ) : screenshotUrl && !screenshotError ? (
            <div className="mb-6 flex justify-center">
              <div className="relative w-full">
                <img
                  src={screenshotUrl}
                  alt={link.title || 'Screenshot'}
                  className="rounded-xl shadow-lg max-h-96 object-contain border border-slate-800 bg-slate-800 mx-auto"
                  style={{ maxWidth: '100%' }}
                  onError={(e) => {
                    console.error('Failed to load image:', screenshotUrl);
                    e.target.style.display = 'none';
                    const errorDiv = e.target.nextSibling;
                    if (errorDiv) errorDiv.style.display = 'flex';
                  }}
                />
                <div className="hidden items-center justify-center w-full h-48 bg-slate-800 rounded-xl border border-slate-700 text-slate-500 text-sm">
                  Screenshot failed to load from Filebase
                </div>
              </div>
            </div>
          ) : null}
          
          {screenshotError && (
            <div className="mb-6 bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {screenshotError}
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-indigo-400">
                <Highlight text={link.title || 'No Title'} term={searchTerm} />
              </h1>
              <a 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-slate-400 hover:underline break-all"
              >
                <Highlight text={link.url} term={searchTerm} />
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                link.risk_score === 'high' ? 'bg-red-500/20 text-red-400' :
                link.risk_score === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 
                'bg-green-500/20 text-green-400'
              }`}>
                {link.risk_score || 'unknown'} Risk
              </span>
              <button 
                onClick={generateReport} 
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm"
              >
                Download Report
              </button>
            </div>
          </div>

          {/* Content Section */}
          <div className="prose prose-invert max-w-none mt-6">
            <h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-1 mb-2">Page Content</h2>
            <p className="text-slate-300 whitespace-pre-wrap">
              <Highlight text={link.content || 'No content available'} term={searchTerm} />
            </p>

            {/* Metadata Section */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-1 mb-2">Details</h2>
                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400">Last Crawled</h3>
                    <p className="text-slate-300">
                      {link.last_crawled ? new Date(link.last_crawled).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400">Content Type</h3>
                    <p className="text-slate-300">{link.content_type || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {link.metadata && Object.keys(link.metadata).length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-1 mb-2">Metadata</h2>
                  <pre className="bg-slate-900 p-4 rounded-md text-sm text-slate-300 overflow-auto max-h-60">
                    <Highlight text={JSON.stringify(link.metadata, null, 2)} term={searchTerm} />
                  </pre>
                </div>
              )}
            </div>

            {/* Links Section */}
            {link.links && link.links.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-1 mb-2">
                  Discovered .onion Links ({link.links.length})
                </h2>
                <ul className="list-disc pl-5 space-y-1">
                  {link.links.map((l, i) => (
                    <li key={i} className="text-slate-400">
                      <Highlight text={l} term={searchTerm} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Subdomains Section */}
            {subdomains.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-semibold text-indigo-300 mb-4 border-b border-slate-700 pb-1">Other Subdomains for this Onion</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {subdomains.map((sub) => (
                    <Link
                      to={`/link/${sub.id}${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''}`}
                      key={sub.id}
                      className="block bg-slate-900 hover:bg-slate-800 rounded-lg shadow-md p-4 transition-colors border border-slate-800"
                    >
                      <div className="font-bold text-indigo-200 truncate mb-1">{sub.title || 'No Title'}</div>
                      <div className="text-xs text-slate-400 truncate mb-1">{sub.url}</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          sub.risk_score === 'high' ? 'bg-red-700 text-red-200' : 
                          sub.risk_score === 'medium' ? 'bg-yellow-700 text-yellow-200' : 
                          sub.risk_score === 'low' ? 'bg-green-700 text-green-200' : 
                          'bg-slate-700 text-slate-200'
                        }`}>
                          {sub.risk_score || 'N/A'}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-700 text-slate-200">
                          {sub.updated_at ? new Date(sub.updated_at).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <Link 
                to="/" 
                className="inline-flex items-center text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <svg 
                  className="w-4 h-4 mr-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10 19l-7-7m0 0l7-7m-7 7h18" 
                  />
                </svg>
                Back to results
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkDetailPage;