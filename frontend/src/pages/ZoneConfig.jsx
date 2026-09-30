import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Edit2, Map } from 'lucide-react';
import { useToast } from '../components/Toast';
import { getZones, createZone, updateZone as updateZoneApi, deleteZone as deleteZoneApi, getCameraIds } from '../api/client';

const ZoneConfig = () => {
  const canvasRef = useRef(null);
  const mousePosRef = useRef(null);
  const [zones, setZones] = useState([]);
  const [points, setPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(true);
  const [formData, setFormData] = useState({ name: '', reqHardhat: true, reqMask: false, reqVest: true });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [referenceImage, setReferenceImage] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });
  // Zones only ever apply to detections run against the SAME camera/site ID —
  // without this, a zone drawn for one scene could coincidentally overlap an
  // unrelated video's frame and get checked against it too.
  const [cameraId, setCameraId] = useState('default');
  const [cameraOptions, setCameraOptions] = useState(['default']);
  const [addingCamera, setAddingCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');
  const { addToast } = useToast();

  // Fetch zones whenever the selected camera changes
  useEffect(() => {
    setLoading(true);
    fetchZones();
  }, [cameraId]);

  useEffect(() => {
    fetchCameraOptions();
  }, []);

  const fetchCameraOptions = async () => {
    try {
      const res = await getCameraIds();
      const ids = res.data || [];
      setCameraOptions(ids.includes('default') ? ids : ['default', ...ids]);
    } catch (err) {
      console.error('Failed to load camera list:', err);
    }
  };

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

  const fetchZones = async () => {
    try {
      const res = await getZones(cameraId);
      // Map API format to internal format (polygon_points are normalized 0-1)
      const mapped = (res.data || []).map(z => ({
        id: z.id,
        name: z.name,
        camera_id: z.camera_id,
        // Convert normalized coords (0-1) to canvas pixel coords (800x450)
        polygon: (z.polygon_points || []).map(p => [p.x * 800, p.y * 450]),
        polygonNormalized: z.polygon_points || [],
        reqHardhat: (z.required_ppe || []).includes('Hardhat'),
        reqMask: (z.required_ppe || []).includes('Mask'),
        reqVest: (z.required_ppe || []).includes('Safety Vest'),
      }));
      setZones(mapped);
    } catch (err) {
      console.error('Failed to load zones:', err);
    } finally {
      setLoading(false);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing saved zones (faded) — convert normalized coords to current canvas pixels
    zones.forEach(zone => {
      if (zone.id === editingId) return;
      const pixelPoly = (zone.polygonNormalized || []).map(p => [
        p.x * canvasSize.width,
        p.y * canvasSize.height,
      ]);
      drawPolygon(ctx, pixelPoly, 'rgba(107, 114, 128, 0.2)', '#6B7280');
    });

    // Draw current polygon
    if (points.length > 0) {
      const isClosed = !isDrawing;
      // Show amber fill as soon as 3+ points placed (not just after closing)
      const fillColor = (isClosed || points.length >= 3)
        ? 'rgba(245, 158, 11, 0.25)'
        : 'transparent';
      drawPolygon(ctx, points, fillColor, '#F59E0B', true);

      // Draw dashed preview line from last point → cursor while still drawing
      const mp = mousePosRef.current;
      if (isDrawing && mp && points.length > 0) {
        const last = points[points.length - 1];
        ctx.beginPath();
        ctx.moveTo(last[0], last[1]);
        ctx.lineTo(mp.x, mp.y);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]); // reset dash
      }
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [points, zones, isDrawing, editingId, canvasSize]);

  const drawPolygon = (ctx, polyPoints, fillColor, strokeColor, drawVertices = false) => {
    if (polyPoints.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(polyPoints[0][0], polyPoints[0][1]);
    for (let i = 1; i < polyPoints.length; i++) {
      ctx.lineTo(polyPoints[i][0], polyPoints[i][1]);
    }

    // Only close the path when the polygon is actually closed (not while still drawing)
    if (!isDrawing) {
      ctx.closePath();
    }

    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (drawVertices) {
      polyPoints.forEach(p => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, 2 * Math.PI);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        // White inner dot for clarity
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      });
    }
  };

  const handleCanvasClick = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Scale click position to canvas logical coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicking near first point to close
    if (points.length >= 3) {
      const dx = x - points[0][0];
      const dy = y - points[0][1];
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        setIsDrawing(false);
        return;
      }
    }

    setPoints([...points, [x, y]]);
  };

  const handleClear = () => {
    setPoints([]);
    setIsDrawing(true);
    mousePosRef.current = null;
  };

  const handleUndo = () => {
    if (!isDrawing) setIsDrawing(true);
    setPoints(points.slice(0, -1));
  };

  // Track cursor position to draw live preview line
  const handleCanvasMouseMove = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    drawCanvas();
  };

  const handleCanvasMouseLeave = () => {
    mousePosRef.current = null;
    drawCanvas();
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (points.length < 3 || isDrawing) {
      addToast({ title: 'Invalid Zone', message: 'Please close the polygon first', type: 'error' });
      return;
    }
    if (!formData.name) {
      addToast({ title: 'Missing Name', message: 'Zone name is required', type: 'error' });
      return;
    }

    // Convert pixel coords to normalized (0-1) using actual canvas dimensions
    const normalizedPoints = points.map(([x, y]) => ({
      x: x / canvasSize.width,
      y: y / canvasSize.height,
    }));

    const requiredPpe = [];
    if (formData.reqHardhat) requiredPpe.push('Hardhat');
    if (formData.reqMask) requiredPpe.push('Mask');
    if (formData.reqVest) requiredPpe.push('Safety Vest');

    try {
      if (editingId) {
        await updateZoneApi(editingId, {
          name: formData.name,
          camera_id: cameraId,
          polygon_points: normalizedPoints,
          required_ppe: requiredPpe,
        });
        addToast({ title: 'Success', message: 'Zone updated successfully', type: 'success' });
      } else {
        await createZone({
          name: formData.name,
          camera_id: cameraId,
          polygon_points: normalizedPoints,
          required_ppe: requiredPpe,
        });
        addToast({ title: 'Success', message: 'Zone created successfully', type: 'success' });
      }

      // Refresh zones + camera list (in case this was a brand-new camera ID)
      await fetchZones();
      await fetchCameraOptions();
      handleClear();
      setFormData({ name: '', reqHardhat: true, reqMask: false, reqVest: true });
      setEditingId(null);
      setSubmitted(false);
    } catch (err) {
      addToast({ title: 'Error', message: err.response?.data?.detail || 'Failed to save zone', type: 'error' });
    }
  };

  const editZone = (zone) => {
    setEditingId(zone.id);
    // Convert normalized coords → canvas pixels for the current canvas size
    setPoints((zone.polygonNormalized || []).map(p => [
      p.x * canvasSize.width,
      p.y * canvasSize.height,
    ]));
    setIsDrawing(false);
    setFormData({ name: zone.name, reqHardhat: zone.reqHardhat, reqMask: zone.reqMask, reqVest: zone.reqVest });
    setSubmitted(false);
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm('Delete this zone?')) return;
    try {
      await deleteZoneApi(id);
      await fetchZones();
      if (editingId === id) {
        handleClear();
        setFormData({ name: '', reqHardhat: true, reqMask: false, reqVest: true });
        setEditingId(null);
        setSubmitted(false);
      }
      addToast({ title: 'Deleted', message: 'Zone removed', type: 'info' });
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to delete zone', type: 'error' });
    }
  };

  // Handle reference image upload — resize canvas to match image aspect ratio
  const handleRefImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        // Fit image within a max of 800w × 600h while preserving aspect ratio
        const MAX_W = 800, MAX_H = 600;
        const aspect = img.naturalWidth / img.naturalHeight;
        let w = MAX_W;
        let h = Math.round(MAX_W / aspect);
        if (h > MAX_H) {
          h = MAX_H;
          w = Math.round(MAX_H * aspect);
        }
        setCanvasSize({ width: w, height: h });
        setReferenceImage(url);
        // Clear drawn polygon — coordinate space has changed with the new image
        handleClear();
      };
      img.src = url;
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left Col - Canvas */}
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Zone Configuration</h2>
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
                className="bg-surface border border-surface-border rounded px-3 py-1.5 text-sm w-44"
              >
                {cameraOptions.map(id => <option key={id} value={id}>{id}</option>)}
                <option value="__new__">+ New Camera / Site…</option>
              </select>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Zones are only checked against videos/images uploaded under the same Camera / Site ID in Live Monitor.
        </p>

        {/* Canvas container — aspect ratio matches uploaded image exactly */}
        <div
          className="relative bg-surface-raised border border-surface-border rounded-xl overflow-hidden w-full"
          style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}
        >
          {/* Background: reference image fills canvas with no cropping */}
          {referenceImage ? (
            <>
              <img src={referenceImage} className="absolute inset-0 w-full h-full object-fill" alt="Reference frame" />
              {/* Swap image button */}
              <label className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded cursor-pointer transition-colors">
                Change Image
                <input type="file" accept="image/*" className="hidden" onChange={handleRefImageUpload} />
              </label>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 p-8 text-center bg-black/40 z-20">
              <div>
                <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Upload a reference image to see a frame here.</p>
                <label className="mt-3 inline-block bg-surface-raised border border-surface-border px-4 py-1.5 rounded text-sm cursor-pointer hover:bg-surface">
                  Upload Image
                  <input type="file" accept="image/*" className="hidden" onChange={handleRefImageUpload} />
                </label>
              </div>
            </div>
          )}

          {/* pointer-events-none when no image — no point drawing on a blank canvas */}
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            className={`absolute inset-0 w-full h-full z-10 ${referenceImage ? 'cursor-crosshair' : 'pointer-events-none'}`}
          />
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="text-gray-400">
            {isDrawing ? (
              points.length === 0 ? "Click to place first point" : "Click to add points. Click first point to close."
            ) : (
              <span className="text-safety-yellow">Polygon closed. Ready to save.</span>
            )}
            {" • "}{points.length} vertices
          </div>
          <div className="space-x-3">
            <button onClick={handleUndo} disabled={points.length === 0} className="text-gray-400 hover:text-white disabled:opacity-50">Undo Point</button>
            <button onClick={handleClear} disabled={points.length === 0} className="text-gray-400 hover:text-white disabled:opacity-50">Clear All</button>
          </div>
        </div>
      </div>

      {/* Right Col - Form & List */}
      <div className="w-96 shrink-0 flex flex-col min-h-0 space-y-6">
        {/* Form */}
        <div className="bg-surface-raised border border-surface-border rounded-xl p-5">
          <h3 className="font-medium mb-4">{editingId ? 'Edit Zone' : 'New Zone'}</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Zone Name <span className="text-violation-red">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className={`w-full bg-surface border rounded px-3 py-2 text-sm focus:outline-none transition-colors ${
                  submitted && !formData.name
                    ? 'border-violation-red/50 focus:border-violation-red'
                    : 'border-surface-border focus:border-safety-yellow'
                }`}
                placeholder="e.g. Loading Area"
              />
              {submitted && !formData.name && (
                <p className="text-xs text-violation-red mt-1">Zone name is required</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Required PPE</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.reqHardhat} onChange={e => setFormData({...formData, reqHardhat: e.target.checked})} className="accent-safety-yellow" />
                  <span className="text-sm">Hardhat required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.reqMask} onChange={e => setFormData({...formData, reqMask: e.target.checked})} className="accent-safety-yellow" />
                  <span className="text-sm">Mask required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.reqVest} onChange={e => setFormData({...formData, reqVest: e.target.checked})} className="accent-safety-yellow" />
                  <span className="text-sm">Safety Vest required</span>
                </label>
              </div>
            </div>

            {/* Live PPE preview — always shows exactly what will be saved */}
            {!isDrawing && formData.name && (
              <div className="text-xs bg-surface border border-surface-border rounded px-3 py-2">
                <span className="text-gray-500 mr-2">Will save with:</span>
                {formData.reqHardhat
                  ? <span className="inline-flex items-center gap-1 mr-1 text-safety-yellow font-medium">✓ Hardhat</span>
                  : <span className="inline-flex items-center gap-1 mr-1 text-gray-600 line-through">Hardhat</span>
                }
                {formData.reqMask
                  ? <span className="inline-flex items-center gap-1 mr-1 text-safety-yellow font-medium">✓ Mask</span>
                  : <span className="inline-flex items-center gap-1 mr-1 text-gray-600 line-through">Mask</span>
                }
                {formData.reqVest
                  ? <span className="inline-flex items-center gap-1 mr-1 text-safety-yellow font-medium">✓ Safety Vest</span>
                  : <span className="inline-flex items-center gap-1 mr-1 text-gray-600 line-through">Safety Vest</span>
                }
                {!formData.reqHardhat && !formData.reqMask && !formData.reqVest && (
                  <span className="text-violation-red">⚠ No PPE selected</span>
                )}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isDrawing || !formData.name}
              className={`w-full font-medium py-2 rounded transition-colors ${
                isDrawing || !formData.name
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-safety-yellow text-black hover:bg-yellow-400 cursor-pointer'
              }`}
            >
              {editingId ? 'Update Zone' : 'Save Zone'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="font-medium mb-3 text-gray-400 text-sm uppercase tracking-wider">Saved Zones</h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {loading ? (
              <div className="text-center text-gray-500 text-sm mt-4">Loading zones...</div>
            ) : zones.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-4">
                No zones configured yet. Draw a zone on the frame above to get started.
              </div>
            ) : (
              zones.map(zone => (
                <div key={zone.id} className="bg-surface-raised border border-surface-border rounded-lg p-4 relative group">
                  <h4 className="font-medium mb-2">{zone.name}</h4>
                  <div className="flex gap-2 mb-3">
                    {zone.reqHardhat && <span className="bg-surface text-gray-300 text-xs px-2 py-1 rounded border border-surface-border">Hardhat</span>}
                    {zone.reqMask && <span className="bg-surface text-gray-300 text-xs px-2 py-1 rounded border border-surface-border">Mask</span>}
                    {zone.reqVest && <span className="bg-surface text-gray-300 text-xs px-2 py-1 rounded border border-surface-border">Vest</span>}
                  </div>

                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => editZone(zone)} className="text-gray-400 hover:text-white p-1">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteZone(zone.id)} className="text-violation-red hover:text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneConfig;
