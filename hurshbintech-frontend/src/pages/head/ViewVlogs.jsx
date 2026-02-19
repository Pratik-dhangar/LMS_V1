import React, { useState, useEffect } from 'react';
import vlogService from '../../api/services/vlogService';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import { getFileUrl } from '../../utils/urlHelper';


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
    <div className="page-content">
      <h1 className="page-title">Training Vlogs</h1>

      <div className="card-grid">
        {vlogs.map((vlog) => (
          <div
            key={vlog.id}
            className="card card-hover"
            onClick={() => setSelectedVlog(vlog)}
          >
            <div className="card-image-wrapper">
              <img
                src={getFileUrl(vlog.thumbnail_url)}
                alt={vlog.title}
                className="card-image"
              />
            </div>
            <div className="card-content">
              <h3 className="card-title">{vlog.title}</h3>
              <p className="card-description">{vlog.description}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedVlog && (
        <div className="app-modal-overlay">
          <div className="app-modal-content modal-content-wide">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">{selectedVlog.title}</h2>
              <button
                onClick={() => setSelectedVlog(null)}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="video-wrapper">
              <video
                src={getFileUrl(selectedVlog.file_url)}
                controls
                className="video-player"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <p className="modal-description">{selectedVlog.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewVlogs;
