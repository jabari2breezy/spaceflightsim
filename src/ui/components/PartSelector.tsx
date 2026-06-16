/**
 * Part Selector Component
 */

import React, { useState } from 'react';
import { SpacecraftPart } from '../../types';

interface PartSelectorProps {
  parts: Record<string, SpacecraftPart>;
  onSelectPart: (partId: string) => void;
}

const PartSelector: React.FC<PartSelectorProps> = ({ parts, onSelectPart }) => {
  const [filter, setFilter] = useState<string>('all');

  const partsByType: Record<string, SpacecraftPart[]> = {};
  
  for (const part of Object.values(parts)) {
    if (!partsByType[part.type]) {
      partsByType[part.type] = [];
    }
    partsByType[part.type].push(part);
  }

  const filteredParts = filter === 'all'
    ? Object.values(parts)
    : partsByType[filter] || [];

  return (
    <div className="part-selector">
      <div className="part-filter">
        <button
          className={`filter-button ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {Object.keys(partsByType).map((type) => (
          <button
            key={type}
            className={`filter-button ${filter === type ? 'active' : ''}`}
            onClick={() => setFilter(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="part-list">
        {filteredParts.map((part) => (
          <div key={part.id} className="part-card">
            <h4>{part.name}</h4>
            <div className="part-specs">
              <span className="spec">Mass: {part.dryMass} kg</span>
              <span className="spec">Cost: {part.cost}</span>
              <span className="spec">{part.type}</span>
            </div>
            <button
              onClick={() => onSelectPart(part.id)}
              className="button small"
            >
              Add to Stage
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PartSelector;
