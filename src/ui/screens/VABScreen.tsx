/**
 * Vehicle Assembly Building (VAB) Screen
 */

import React, { useState } from 'react';
import { Screen } from '../../App';
import { SpacecraftBuilder, PARTS_LIBRARY } from '../../core/spacecraft';
import PartSelector from '../components/PartSelector';
import SpacecraftPreview from '../components/SpacecraftPreview';

interface VABScreenProps {
  onNavigate: (screen: Screen) => void;
  onBuild: (builder: SpacecraftBuilder) => void;
}

const VABScreen: React.FC<VABScreenProps> = ({ onNavigate, onBuild }) => {
  const [spacecraft, setSpacecraft] = useState<SpacecraftBuilder | null>(null);
  const [, forceUpdate] = useState(0);
  const [selectedStage, setSelectedStage] = useState<number>(0);
  const [spacecraftName, setSpacecraftName] = useState('Untitled Rocket');

  const initializeBuilder = () => {
    const builder = new SpacecraftBuilder(spacecraftName);
    builder.addStage();
    setSpacecraft(builder);
  };

  const addPart = (partId: string) => {
    if (spacecraft) {
      spacecraft.addPartToStage(selectedStage, partId);
      forceUpdate((n) => n + 1);
    }
  };

  const addStage = () => {
    if (spacecraft) {
      spacecraft.addStage();
      setSelectedStage(spacecraft.build().stages.length - 1);
      forceUpdate((n) => n + 1);
    }
  };

  const launchSpacecraft = () => {
    if (spacecraft) {
      const validation = spacecraft.validate();
      if (!validation.valid) {
        alert('Invalid spacecraft design:\n' + validation.errors.join('\n'));
        return;
      }
      onBuild(spacecraft);
      onNavigate('flight');
    }
  };

  if (!spacecraft) {
    return (
      <div className="vab-screen">
        <div className="vab-setup">
          <h2>New Spacecraft Design</h2>
          <label>
            Spacecraft Name:
            <input
              type="text"
              value={spacecraftName}
              onChange={(e) => setSpacecraftName(e.target.value)}
              placeholder="Enter spacecraft name"
            />
          </label>
          <button onClick={initializeBuilder} className="button primary">
            Start Building
          </button>
        </div>
      </div>
    );
  }

  const built = spacecraft.build();
  const currentStage = built.stages[selectedStage];

  return (
    <div className="vab-screen">
      <div className="vab-header">
        <h1>{spacecraftName}</h1>
        <div className="vab-stats">
          <div className="stat">
            <span className="label">Mass:</span>
            <span className="value">{(built.mass / 1000).toFixed(1)} t</span>
          </div>
          <div className="stat">
            <span className="label">Cost:</span>
            <span className="value">{spacecraft.getTotalCost()}</span>
          </div>
          <div className="stat">
            <span className="label">ΔV:</span>
            <span className="value">{spacecraft.calculateDeltaV().toFixed(0)} m/s</span>
          </div>
          <div className="stat">
            <span className="label">Thrust:</span>
            <span className="value">{(spacecraft.getTotalThrust() / 1e6).toFixed(2)} MN</span>
          </div>
        </div>
      </div>

      <div className="vab-body">
        <div className="vab-left">
          <h3>Part Library</h3>
          <PartSelector
            parts={PARTS_LIBRARY}
            onSelectPart={addPart}
          />
        </div>

        <div className="vab-center">
          <SpacecraftPreview spacecraft={built} />
        </div>

        <div className="vab-right">
          <h3>Stage {selectedStage + 1}</h3>
          <div className="stage-list">
            {built.stages.map((stage, idx) => (
              <button
                key={idx}
                className={`stage-button ${idx === selectedStage ? 'active' : ''}`}
                onClick={() => setSelectedStage(idx)}
              >
                Stage {idx + 1} ({stage.parts.length} parts)
              </button>
            ))}
          </div>

          <button onClick={addStage} className="button">
            + Add Stage
          </button>

          <h4>Current Stage Parts</h4>
          <div className="parts-list">
            {currentStage?.parts.map((part, idx) => (
              <div key={idx} className="part-item">
                <span>{part.name}</span>
                <button
                  onClick={() => spacecraft.removePartFromStage(selectedStage, idx)}
                  className="remove-button"
                >
                  ✕
                </button>
              </div>
            )) || <p>No parts in this stage</p>}
          </div>

          <div className="vab-actions">
            <button onClick={launchSpacecraft} className="button primary">
              Launch
            </button>
            <button onClick={() => onNavigate('menu')} className="button">
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VABScreen;
