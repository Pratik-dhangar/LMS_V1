import React, { useState, useEffect } from 'react';
import vlogService from '../../api/services/vlogService';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';

const ViewVlogs = () => {
  const [vlogs, setVlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVlog, setSelectedVlog] = useState(null);

  useEffect(() => {
    const fetchVlogs = async () => {
      try {
        const data = await vlogService.getAllVlogs();
        setVlogs(data);
      } catch {
        setError('Failed to fetch vlogs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchVlogs();
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Training Vlogs</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {vlogs.map((vlog) => (
          <div
            key={vlog.id}
            className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer"
            onClick={() => setSelectedVlog(vlog)}
          >
            <div className="aspect-w-16 aspect-h-9">
              <img
                src={vlog.thumbnail_url}
                alt={vlog.title}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">{vlog.title}</h3>
              <p className="text-gray-600 line-clamp-2">{vlog.description}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedVlog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">{selectedVlog.title}</h2>
              <button
                onClick={() => setSelectedVlog(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="aspect-w-16 aspect-h-9 mb-4">
              <video
                src={selectedVlog.file_url}
                controls
                className="w-full rounded-lg"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <p className="text-gray-700">{selectedVlog.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewVlogs;