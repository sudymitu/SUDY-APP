
import React from 'react';

interface MultiSelectCheckboxProps {
  label: string;
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
}

const MultiSelectCheckbox: React.FC<MultiSelectCheckboxProps> = ({ label, options, selectedOptions, onChange }) => {
  const handleCheckboxChange = (option: string) => {
    const isDefault = options[0];
    const newSelection = [...selectedOptions];

    if (option === isDefault) {
      // If default is clicked, select only it
      onChange([isDefault]);
      return;
    }
    
    // If a non-default is clicked, ensure default is deselected
    const defaultIndex = newSelection.indexOf(isDefault);
    if(defaultIndex > -1) {
        newSelection.splice(defaultIndex, 1);
    }
    
    const currentIndex = newSelection.indexOf(option);
    if (currentIndex === -1) {
      newSelection.push(option);
    } else {
      newSelection.splice(currentIndex, 1);
    }

    // If nothing is selected, revert to default
    if (newSelection.length === 0) {
      onChange([isDefault]);
    } else {
      onChange(newSelection);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((option) => (
          <label key={option} className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-colors ${selectedOptions.includes(option) ? 'bg-blue-500/30 dark:bg-blue-600/50' : 'bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/50 dark:hover:bg-gray-600/50'}`}>
            <input
              type="checkbox"
              checked={selectedOptions.includes(option)}
              onChange={() => handleCheckboxChange(option)}
              className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 flex-shrink-0"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200 min-w-0">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default MultiSelectCheckbox;