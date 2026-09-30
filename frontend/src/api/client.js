import axios from 'axios';
import { API_BASE, WS_BASE } from '../config/constants';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const detectImage = async (file, cameraId = 'default') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('camera_id', cameraId);
  return api.post('/api/detect/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const detectVideo = async (file, cameraId = 'default') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('camera_id', cameraId);
  return api.post('/api/detect/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const getZones = (cameraId) => api.get('/api/zones', { params: cameraId ? { camera_id: cameraId } : {} });
export const getCameraIds = () => api.get('/api/zones/cameras');
export const createZone = (data) => api.post('/api/zones', data);
export const updateZone = (id, data) => api.put(`/api/zones/${id}`, data);
export const deleteZone = (id) => api.delete(`/api/zones/${id}`);

export const getViolations = (params) => api.get('/api/violations', { params });
export const deleteViolation = (id) => api.delete(`/api/violations/${id}`);
export const exportViolations = (params) => api.get('/api/violations/export', { params, responseType: 'blob' });

export const getComplianceSummary = () => api.get('/api/compliance-summary');

export const getSettings = () => api.get('/api/settings');
export const updateSettings = (data) => api.put('/api/settings', data);

export const connectVideoStream = (jobId, onMessage, onClose, onError) => {
  const ws = new WebSocket(`${WS_BASE}/ws/video-stream/${jobId}`);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.error('WebSocket message parse error', e);
    }
  };
  
  ws.onclose = () => {
    if (onClose) onClose();
  };
  
  ws.onerror = (error) => {
    if (onError) onError(error);
  };
  
  return ws;
};
