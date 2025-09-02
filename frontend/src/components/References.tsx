import React from 'react';
import { Reference } from '../types';

interface ReferencesProps {
  references: Reference[];
  className?: string;
}

export const References: React.FC<ReferencesProps> = ({ references, className = '' }) => {
  if (!references || references.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
        **References:**
      </h4>
      <div className="space-y-2">
        {references.map((ref) => (
          <div key={ref.id} className="flex items-start space-x-3">
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400 min-w-[1.5rem]">
              [{ref.id}]
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                {ref.domain} - {ref.title}
              </div>
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300
                  underline break-all transition-colors duration-200
                "
                title={ref.url}
              >
                {ref.url}
              </a>
              {ref.snippet && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {ref.snippet}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};