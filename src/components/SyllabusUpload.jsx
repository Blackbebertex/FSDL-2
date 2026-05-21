import React, { useState } from 'react';
import './SyllabusUpload.css';

export default function SyllabusUpload({ onDetailsExtracted, onCancel }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file');
        setFile(null);
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit');
        setFile(null);
        return;
      }
      setError('');
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('syllabus', file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/syllabus/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      setExtractedData(data.details);
    } catch (err) {
      setError(err.message || 'Failed to upload and process syllabus');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    if (extractedData) {
      onDetailsExtracted(extractedData);
    }
  };

  const handleReset = () => {
    setFile(null);
    setExtractedData(null);
    setError('');
  };

  return (
    <div className="syllabus-upload">
      <div className="syllabus-card">
        <h3>Upload Syllabus</h3>
        <p className="subtitle">Upload a PDF syllabus to auto-extract exam details</p>

        {!extractedData ? (
          <div className="upload-section">
            <div className="file-input-wrapper">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={uploading}
                id="syllabus-file"
              />
              <label htmlFor="syllabus-file" className="file-label">
                {file ? file.name : 'Choose PDF file'}
              </label>
            </div>

            {file && (
              <p className="file-info">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}

            {error && <div className="error-message">{error}</div>}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="upload-btn"
            >
              {uploading ? 'Processing...' : 'Upload & Extract'}
            </button>
          </div>
        ) : (
          <div className="extracted-section">
            <h4>Extracted Details</h4>
            <div className="details-grid">
              <div className="detail-item">
                <label>Subject Name:</label>
                <p>{extractedData.subjectName || '(Not detected)'}</p>
              </div>
              <div className="detail-item">
                <label>Total Marks:</label>
                <p>{extractedData.marks}</p>
              </div>
              <div className="detail-item">
                <label>Duration (minutes):</label>
                <p>{extractedData.durationMinutes}</p>
              </div>
              {extractedData.passingMarks && (
                <div className="detail-item">
                  <label>Passing Marks:</label>
                  <p>{extractedData.passingMarks}</p>
                </div>
              )}
            </div>
            <p className="note">
              Review the extracted details. You can edit them in the exam form if needed.
            </p>
          </div>
        )}

        <div className="button-group">
          {extractedData ? (
            <>
              <button onClick={handleConfirm} className="confirm-btn">
                Use These Details
              </button>
              <button onClick={handleReset} className="secondary-btn">
                Upload Different
              </button>
            </>
          ) : (
            <button onClick={onCancel} className="secondary-btn">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
