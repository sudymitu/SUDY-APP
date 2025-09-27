

import React from 'react';

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  isExpanded: boolean;
  onClick: () => void;
  isNew?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon, isActive, isExpanded, onClick, isNew = false }) => {
  const baseClasses = 'w-full flex items-center p-3 my-1 rounded-lg font-medium transition-colors duration-200 focus:outline-none relative';
  const activeClasses = 'bg-blue-500/20 dark:bg-blue-500/30 text-blue-600 dark:text-blue-400 border-l-4 border-blue-500';
  const inactiveClasses = 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white border-l-4 border-transparent';
  
  const justification = isExpanded ? 'justify-start' : 'justify-center';

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${justification}`}
      title={label}
    >
      <div className="relative w-6 h-6 flex-shrink-0">
        {icon}
        {isNew && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-100 dark:border-gray-800"></span>}
      </div>
      {isExpanded && <span className="ml-4 truncate">{label}</span>}
    </button>
  );
};

export default TabButton;