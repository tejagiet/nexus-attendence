import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';

export default function AttendanceGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
        if (!scriptUrl) {
          throw new Error('VITE_GOOGLE_SCRIPT_URL is not configured.');
        }

        const response = await fetch(scriptUrl);
        const json = await response.json();

        if (json.success) {
          setImages(json.data);
        } else {
          throw new Error(json.error || 'Failed to fetch images');
        }
      } catch (err) {
        console.error('Gallery Fetch Error:', err);
        setError(err.message || 'Could not load attendance photos.');
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  return (
    <div className="min-h-screen bg-nexus-bg flex flex-col p-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between py-4 mb-6 border-b border-white/5">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/5 rounded-full text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <ImageIcon size={20} className="text-nexus-primary" />
          <h2 className="text-white font-medium">Attendance Photo Gallery</h2>
        </div>
        <div className="w-9"></div> {/* Spacer for centering */}
      </header>

      <main className="flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={32} className="text-nexus-primary animate-spin mb-4" />
            <p className="text-nexus-muted">Loading photos from Drive...</p>
          </div>
        ) : error ? (
          <div className="bg-nexus-error-bg text-nexus-error p-4 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center p-8 border border-white/5 rounded-2xl">
            <ImageIcon size={48} className="text-nexus-muted/30 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-1">No Photos Found</h3>
            <p className="text-nexus-muted text-sm">Upload a photo from the dashboard to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {images.map((img) => (
              <div key={img.id} className="glass-card overflow-hidden group">
                <div className="aspect-square relative overflow-hidden bg-black/50">
                  <img 
                    src={img.thumbnail} 
                    alt={img.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <a 
                    href={img.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute bottom-3 right-3 bg-nexus-primary text-black text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0"
                  >
                    View Full
                  </a>
                </div>
                <div className="p-3">
                  <h4 className="text-white text-xs font-medium truncate" title={img.name}>{img.name}</h4>
                  <p className="text-nexus-muted text-[10px] mt-1">
                    {new Date(img.dateCreated).toLocaleDateString()} • {new Date(img.dateCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
