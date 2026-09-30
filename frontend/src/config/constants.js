export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
export const WS_BASE = import.meta.env.VITE_WS_BASE || API_BASE.replace(/^http/, 'ws');

export const CLASS_NAMES = [
  'Hardhat', 'Mask', 'NO-Hardhat', 'NO-Mask', 'NO-Safety Vest',
  'Person', 'Safety Cone', 'Safety Vest', 'machinery', 'vehicle'
];

export const CLASS_COLORS = {
  'Hardhat': '#F59E0B',
  'Mask': '#F59E0B', 
  'Safety Vest': '#F59E0B',
  'NO-Hardhat': '#EF4444',
  'NO-Mask': '#EF4444',
  'NO-Safety Vest': '#EF4444',
  'Person': '#6B7280',
  'Safety Cone': '#6B7280',
  'machinery': '#6B7280',
  'vehicle': '#6B7280',
};

export const PPE_CLASSES = ['Hardhat', 'Mask', 'Safety Vest'];
export const VIOLATION_CLASSES = ['NO-Hardhat', 'NO-Mask', 'NO-Safety Vest'];
