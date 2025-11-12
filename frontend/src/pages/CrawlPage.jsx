import React from 'react';

const CrawlPage = () => {
  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-white mb-4">Manual Crawl</h1>
      <p className="text-slate-300">
        The crawler runs as a continuous background process on the server. To add new seed URLs, please add them to the `links.txt` file and restart the crawler script.
      </p>
      <p className="mt-4 text-sm text-slate-400">
        This UI does not trigger crawls directly. This design ensures that the crawling process is managed securely and efficiently on the backend.
      </p>
    </div>
  );
};

export default CrawlPage; 