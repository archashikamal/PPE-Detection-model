import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, XCircle, User, Users, AlertTriangle, MapPin } from 'lucide-react';
import { useToast } from '../components/Toast';
import { CLASS_COLORS, VIOLATION_CLASSES, PPE_CLASSES, API_BASE } from '../config/constants';
import { detectVideo, detectImage, connectVideoStream, getCameraIds } from '../api/client';

const LiveMonitor = () => {
  const [state, setState] = useState('idle'); // idle, uploading, processing, complete, image-result
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [frameDataMap, setFrameDataMap] = useState({}); // timestamp_sec -> detections
  const [currentPersons, setCurrentPersons] = useState([]);
  const [summary, setSummary] = useState(null);
  const [imageResult, setImageResult] = useState(null);
  const [toasts, setToastsLocal] = useState([]);
  // Which zones apply is determined by this — must match the Camera / Site ID
  // used when those zones were drawn in Zone Config.
  const [cameraId, setCameraId] = useState('default');
  const [cameraOptions, setCameraOptions] = useState(['default']);
  const [addingCamera, setAddingCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imgCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const wsRef = useRef(null);
  const animFrameRef = useRef(null);
  const latestFrameRef = useRef(null);
  const { addToast } = useToast();

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (wsRef.current) wsRef.current.close();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [fileUrl]);

  useEffect(() => {
    getCameraIds()
      .then(res => {
        const ids = res.data || [];
        setCameraOptions(ids.includes('default') ? ids : ['default', ...ids]);
      })
      .catch(err => console.error('Failed to load camera list:', err));
  }, []);

  const handleCameraSelectChange = (value) => {
    if (value === '__new__') {
      setAddingCamera(true);
      setNewCameraName('');
    } else {
      setCameraId(value);
    }
  };

  const confirmNewCamera = () => {
    const name = newCameraName.trim();
    if (!name) {
      setAddingCamera(false);
      return;
    }
    setCameraOptions(prev => (prev.includes(name) ? prev : [...prev, name]));
    setCameraId(name);
    setAddingCamera(false);
    setNewCameraName('');
  };

  const onDragOver = (e) => { e.preventDefault(); };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (selectedFile) => {
    // Reset state
    setFrameDataMap({});
    setCurrentPersons([]);
    setSummary(null);
    setImageResult(null);
    setProgress(0);

    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setFileUrl(url);

    if (selectedFile.type.startsWith('image/')) {
      await processImage(selectedFile);
    } else if (selectedFile.type.startsWith('video/')) {
      await processVideo(selectedFile);
    } else {
      addToast({ title: 'Invalid file', message: 'Please upload an image or video file.', type: 'error' });
    }
  };

  // ---- IMAGE DETECTION ----
  const processImage = async (imgFile) => {
    setState('uploading');
    try {
      const res = await detectImage(imgFile, cameraId);
      const data = res.data;
      setImageResult(data);
      setCurrentPersons(data.persons || []);
      setState('image-result');

      // Log violations as toasts
      if (data.violations && data.violations.length > 0) {
        data.violations.forEach((v) => {
          addToast({ title: 'Violation Detected', message: `${v.class_name} — ${v.zone_name || 'No Zone'}`, type: 'error' });
        });
      }
    } catch (e) {
      addToast({ title: 'Detection failed', message: e.response?.data?.detail || e.message, type: 'error' });
      setState('idle');
    }
  };

  // Helper: compute object-contain scale + offset for a media element inside a container
  const getContainLayout = (containerW, containerH, mediaW, mediaH) => {
    const containerAspect = containerW / containerH;
    const mediaAspect = mediaW / mediaH;
    let renderedW, renderedH, offsetX, offsetY;
    if (mediaAspect > containerAspect) {
      // media is wider → fills container width, letterboxed top/bottom
      renderedW = containerW;
      renderedH = containerW / mediaAspect;
      offsetX = 0;
      offsetY = (containerH - renderedH) / 2;
    } else {
      // media is taller → fills container height, letterboxed left/right
      renderedH = containerH;
      renderedW = containerH * mediaAspect;
      offsetX = (containerW - renderedW) / 2;
      offsetY = 0;
    }
    return {
      scaleX: renderedW / mediaW,
      scaleY: renderedH / mediaH,
      offsetX,
      offsetY,
    };
  };

  // Draw detections on image after it loads
  useEffect(() => {
    if (state === 'image-result' && imageResult && imgRef.current && imgCanvasRef.current) {
      const img = imgRef.current;
      const canvas = imgCanvasRef.current;

      const drawOnLoad = () => {
        // Use the container's displayed size for the canvas, not the raw image pixels
        const container = canvas.parentElement;
        const containerW = container.clientWidth || img.clientWidth;
        const containerH = container.clientHeight || img.clientHeight;

        canvas.width = containerW;
        canvas.height = containerH;

        const { scaleX, scaleY, offsetX, offsetY } = getContainLayout(
          containerW, containerH, img.naturalWidth, img.naturalHeight
        );
        drawDetectionsOnCanvas(
          canvas, imageResult.detections,
          containerW, containerH,
          scaleX, scaleY, offsetX, offsetY
        );
      };

      if (img.complete) {
        drawOnLoad();
      } else {
        img.onload = drawOnLoad;
      }
    }
  }, [state, imageResult]);

  // ---- VIDEO DETECTION ----
  const processVideo = async (vidFile) => {
    setState('uploading');
    try {
      const res = await detectVideo(vidFile, cameraId);
      const jobId = res.data.job_id;
      setState('processing');

      // Start playback
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }

      // Connect WebSocket
      wsRef.current = connectVideoStream(
        jobId,
        // onMessage
        (data) => {
          if (data.type === 'frame') {
            latestFrameRef.current = data;
            setProgress(Math.round(data.progress || 0));
            setCurrentPersons(data.persons || []);

            // Store frame data keyed by timestamp for sync rendering
            setFrameDataMap(prev => ({
              ...prev,
              [data.timestamp_sec]: data.detections
            }));

            // Show violation toasts (throttled: only every 5th frame that has violations)
            if (data.violations && data.violations.length > 0 && data.frame_number % 25 === 0) {
              data.violations.forEach((v) => {
                addToast({ title: 'Violation Detected', message: `${v.class_name} — ${v.zone_name || 'No Zone'}`, type: 'error' });
              });
            }
          } else if (data.type === 'complete') {
            setSummary(data);
            setState('complete');
            if (videoRef.current) videoRef.current.pause();
          }
        },
        // onClose
        () => {
          if (state === 'processing') {
            setState('complete');
          }
        },
        // onError
        (err) => {
          addToast({ title: 'Connection error', message: 'WebSocket connection failed', type: 'error' });
          setState('idle');
        }
      );

      // Start the animation loop for synced drawing
      startCanvasLoop();
    } catch (e) {
      addToast({ title: 'Upload failed', message: e.response?.data?.detail || e.message, type: 'error' });
      setState('idle');
    }
  };

  const startCanvasLoop = () => {
    const loop = () => {
      if (videoRef.current && canvasRef.current && latestFrameRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Match canvas to video container display size
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const frameData = latestFrameRef.current;

        if (frameData && frameData.detections && video.videoWidth) {
          // Account for object-contain letterboxing inside the container
          const { scaleX, scaleY, offsetX, offsetY } = getContainLayout(
            rect.width, rect.height, video.videoWidth, video.videoHeight
          );
          drawDetectionsOnCanvas(
            canvas, frameData.detections,
            rect.width, rect.height,
            scaleX, scaleY, offsetX, offsetY
          );
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  };

  // ---- CANVAS DRAWING ----
  const drawDetectionsOnCanvas = (canvas, detections, canvasW, canvasH, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);

    if (!detections) return;

    detections.forEach(d => {
      const [x1, y1, x2, y2] = d.bbox;
      // Apply scale + letterbox offset so boxes align with the rendered image/video
      const sx1 = x1 * scaleX + offsetX;
      const sy1 = y1 * scaleY + offsetY;
      const sw = (x2 - x1) * scaleX;
      const sh = (y2 - y1) * scaleY;
      const color = CLASS_COLORS[d.class_name] || '#6B7280';
      const conf = d.confidence || d.conf || 0;

      // Box stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx1, sy1, sw, sh);

      // Label
      const text = `${d.class_name} ${Math.round(conf * 100)}%`;
      ctx.font = 'bold 12px Inter, sans-serif';
      const textWidth = ctx.measureText(text).width;

      // Label background — clamp so it doesn't draw above the canvas top
      const labelY = Math.max(sy1, 20);
      ctx.fillStyle = color;
      ctx.fillRect(sx1, labelY - 20, textWidth + 10, 20);

      // Label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, sx1 + 5, labelY - 5);
    });
  };

  const resetAll = () => {
    setState('idle');
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setFrameDataMap({});
    setCurrentPersons([]);
    setSummary(null);
    setImageResult(null);
    setProgress(0);
    if (wsRef.current) wsRef.current.close();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    latestFrameRef.current = null;
  };

  return (
    <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Live Monitor</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Camera / Site</label>
            {addingCamera ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={newCameraName}
                  onChange={e => setNewCameraName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmNewCamera(); if (e.key === 'Escape') setAddingCamera(false); }}
                  className="bg-surface border border-safety-yellow rounded px-3 py-1.5 text-sm w-40 focus:outline-none"
                  placeholder="e.g. entrance-cam"
                />
                <button onClick={confirmNewCamera} className="text-xs bg-safety-yellow text-black px-2 py-1.5 rounded font-medium">Add</button>
                <button onClick={() => setAddingCamera(false)} className="text-xs text-gray-400 px-1">Cancel</button>
              </>
            ) : (
              <select
                value={cameraId}
                onChange={e => handleCameraSelectChange(e.target.value)}
                disabled={state === 'uploading' || state === 'processing'}
                className="bg-surface border border-surface-border rounded px-3 py-1.5 text-sm w-44 disabled:opacity-50"
              >
                {cameraOptions.map(id => <option key={id} value={id}>{id}</option>)}
                <option value="__new__">+ New Camera / Site…</option>
              </select>
            )}
          </div>
        </div>

        <div className="flex-1 bg-surface-raised border border-surface-border rounded-xl overflow-hidden flex flex-col" style={{ minHeight: '520px' }}>

          {/* IDLE: Upload area */}
          {state === 'idle' && (
            <div
              className="flex-1 flex flex-col items-center justify-center p-12"
              onDragOver={onDragOver}
              onDrop={onDrop}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <div className="border-2 border-dashed border-surface-border rounded-xl p-16 w-full max-w-2xl text-center hover:border-gray-500 transition-colors bg-surface/50 cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium mb-2">Drop a video or image file here</h3>
                <p className="text-gray-400 mb-6">or click to browse</p>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept="video/*,image/*"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="file-upload"
                  className="bg-surface-raised border border-surface-border px-6 py-2 rounded-md hover:bg-surface cursor-pointer inline-block"
                  onClick={e => e.stopPropagation()}
                >
                  Browse Files
                </label>
              </div>
            </div>
          )}

          {/* UPLOADING spinner */}
          {state === 'uploading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-raised/90 z-10">
              <div className="w-12 h-12 border-4 border-surface-border border-t-safety-yellow rounded-full animate-spin mb-4"></div>
              <p>Uploading and initializing detection...</p>
            </div>
          )}

          {/* VIDEO: processing or complete */}
          {(state === 'processing' || state === 'complete') && file?.type.startsWith('video/') && (
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                src={fileUrl}
                className="max-h-full max-w-full object-contain"
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          )}

          {/* IMAGE result */}
          {state === 'image-result' && (
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
              <img
                ref={imgRef}
                src={fileUrl}
                className="max-h-full max-w-full object-contain"
                alt="Detection result"
              />
              <canvas
                ref={imgCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          )}

          {/* Progress Bar */}
          {state === 'processing' && (
            <div className="bg-surface p-4 border-t border-surface-border">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Processing: {progress}% complete</span>
              </div>
              <div className="h-2 bg-surface-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-safety-yellow transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Complete bar */}
          {(state === 'complete' || state === 'image-result') && (
            <div className="bg-surface p-4 border-t border-surface-border flex justify-between items-center">
              <span className="text-compliant-green font-medium flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                {state === 'complete' && summary
                  ? `Complete — ${summary.processed_frames} frames, ${summary.total_violations} violations, ${Math.round(summary.overall_compliance_rate)}% compliance`
                  : state === 'image-result' && imageResult
                  ? `${imageResult.detections?.length || 0} detections — ${Math.round(imageResult.compliance_rate)}% compliance`
                  : 'Processing Complete'}
              </span>
              <button
                onClick={resetAll}
                className="px-4 py-2 bg-surface-raised border border-surface-border rounded-md hover:bg-surface text-sm"
              >
                Process Another File
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel - Workers */}
      <div className="w-80 shrink-0 flex flex-col bg-surface-raised border border-surface-border rounded-xl" style={{ minHeight: '520px' }}>
        <div className="p-4 border-b border-surface-border">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Workers Detected
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentPersons.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-10">
              No workers detected in current frame.
            </div>
          ) : (
            currentPersons.map((person, idx) => (
              <div key={idx} className="bg-surface border border-surface-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-medium">
                    <User className="w-4 h-4 text-gray-400" />
                    Worker {idx + 1}
                  </div>
                  {person.compliant ? (
                    <span className="text-xs font-bold bg-compliant-green/20 text-compliant-green px-2 py-1 rounded">COMPLIANT</span>
                  ) : (
                    <span className="text-xs font-bold bg-violation-red/20 text-violation-red px-2 py-1 rounded">VIOLATION</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                  <MapPin className="w-3 h-3" />
                  {(person.zone_names || []).length > 0
                    ? `Checked against: ${person.zone_names.join(', ')}`
                    : 'No zone — global check'}
                </div>

                <div className="space-y-2 text-sm">
                  {PPE_CLASSES.map((ppeName) => {
                    const isWearing = (person.wearing || []).includes(ppeName);
                    const isMissing = (person.missing || []).includes(ppeName);
                    return (
                      <div key={ppeName} className="flex items-center justify-between">
                        <span className="text-gray-400">{ppeName}</span>
                        {isWearing ? (
                          <CheckCircle className="w-4 h-4 text-compliant-green" />
                        ) : isMissing ? (
                          <XCircle className="w-4 h-4 text-violation-red" />
                        ) : (
                          <span className="w-4 h-4 text-gray-600">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMonitor;
