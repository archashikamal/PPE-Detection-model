import React from 'react';
import { Info } from 'lucide-react';

const EmptyState = ({ icon: Icon = Info, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-raised rounded-lg border border-surface-border">
      <div className="w-16 h-16 bg-surface flex items-center justify-center rounded-full mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {description && <p className="text-gray-400 max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
