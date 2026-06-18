import React, { useState, useEffect, useContext } from 'react';
import { GameContext, Screen } from '../../App';
import { SpacecraftBuilder, PARTS_LIBRARY } from '../../core/spacecraft';
import SpacecraftPreview from '../components/SpacecraftPreview';

interface VABScreenProps {
  onNavigate: (screen: Screen) => void;
}

const VABScreen: React.FC<VABScreenProps> = ({ onNavigate }) => {
  const game = useContext(GameContext);
  const [showSetup, setShowSetup] = useState(true);
  const [rocketName, setRocketName] = useState('');
  const [builder, setBuilder] = useState<SpacecraftBuilder | null>(null);
  const [selectedStage, setSelectedStage] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [, forceUpdate] = useState(0);

  const presets = SpacecraftBuilder.getPresets();

  const createBuilder = (name: string) => {
    if (!game) return null;
    const b = new SpacecraftBuilder(name);
    game.buildSpacecraft(name, () => {});
    setBuilder(b);
    setShowSetup(false);
    setSelectedStage(0);
    return b;
  };

  const createWithPreset = (presetIdx: number) => {
    if (!game) return;
    const b = new SpacecraftBuilder(presets[presetIdx].name);
    presets[presetIdx].build(b);
    game.buildSpacecraft(presets[presetIdx].name, () => {});
    setBuilder(b);
    setShowSetup(false);
    setSelectedStage(0);
    setRocketName(presets[presetIdx].name);
  };

  const handleCreate = () => {
    if (!rocketName.trim()) return;
    createBuilder(rocketName.trim());
  };

  if (!game) return <div className="loading">Loading...</div>;

  if (showSetup) {
    const allParts = Object.values(PARTS_LIBRARY);
    return (
      <div className="vab-screen">
        <div className="vab-header">
          <h1>Vehicle Assembly</h1>
          <div className="vab-header-actions">
            <button className="btn btn-sm" onClick={() => onNavigate('menu')}>Back</button>
          </div>
        </div>
        <div className="vab-body" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start', padding: 40 }}>
          <div className="glass" style={{ padding: 32, textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'Orbitron', fontSize: 18, color: 'var(--accent)', marginBottom: 24, letterSpacing: 2 }}>
              Custom Build
            </h2>
            <label style={{ display: 'block', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              Vehicle Name
              <input
                type="text"
                value={rocketName}
                onChange={(e) => setRocketName(e.target.value)}
                placeholder="Enter name..."
                style={{
                  display: 'block', width: '100%', marginTop: 8, padding: '10px 16px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)',
                  borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
                  fontSize: 14, outline: 'none',
                }}
                autoFocus
              />
            </label>
            <button className="btn btn-primary" onClick={handleCreate} style={{ width: '100%' }}>Build</button>
          </div>

          <div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: 'var(--accent)', marginBottom: 20, letterSpacing: 2, textAlign: 'center' }}>
              Preset Rockets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, margin: '0 auto' }}>
              {presets.map((p, idx) => (
                <div
                  key={idx}
                  className="glass-sm"
                  style={{ padding: 20, cursor: 'pointer', transition: 'all 0.3s' }}
                  onClick={() => createWithPreset(idx)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
                >
                  <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Click to select</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!builder) return null;

  const spacecraft = builder.build();
  const stages = spacecraft.stages;
  const currentStage = stages[selectedStage];
  const allParts = Object.values(PARTS_LIBRARY);
  const parts = filter === 'all'
    ? allParts
    : allParts.filter((p) => p.type === filter);

  const addPart = (partId: string) => {
    builder.addPartToStage(selectedStage, partId);
    forceUpdate((n) => n + 1);
  };

  const addStage = () => {
    builder.addStage();
    setSelectedStage(builder.build().stages.length - 1);
    forceUpdate((n) => n + 1);
  };

  const removePart = (partIdx: number) => {
    builder.removePartFromStage(selectedStage, partIdx);
    forceUpdate((n) => n + 1);
  };

  const removeStage = (idx: number) => {
    builder.removeStage(idx);
    if (selectedStage >= builder.build().stages.length) {
      setSelectedStage(builder.build().stages.length - 1);
    }
    forceUpdate((n) => n + 1);
  };

  const launch = () => {
    if (game) {
      game.buildSpacecraft(rocketName || 'Rocket', (cb) => {
        stages.forEach((s) => {
          s.parts.forEach((p) => cb.addPartToStage(cb.build().stages.length - 1, p.id));
          if (stages.indexOf(s) < stages.length - 1) cb.addStage();
        });
      });
      onNavigate('flight');
    }
  };

  const stageTypes: string[] = Array.from(new Set(allParts.map((p) => p.type)));

  return (
    <div className="vab-screen">
      <div className="vab-header">
        <h1>VAB — {rocketName || spacecraft.name}</h1>
        <div className="vab-header-actions">
          <button className="btn btn-primary btn-sm" onClick={launch}>Launch</button>
          <button className="btn btn-sm" onClick={() => onNavigate('menu')}>Back</button>
        </div>
      </div>
      <div className="vab-body">
        <div className="vab-panel">
          <div className="vab-panel-title">Parts</div>
          <div className="part-selector">
            <div className="part-filter">
              <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
              {stageTypes.map((t) => (
                <button key={t} className={`filter-btn ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>
              ))}
            </div>
            <div className="part-list">
              {parts.map((part: any) => (
                <div key={part.id} className="part-card" onClick={() => addPart(part.id)}>
                  <h4>{part.name}</h4>
                  <div className="part-specs">
                    <span className="spec">Mass: {part.dryMass} kg &middot; {part.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="vab-center">
          <SpacecraftPreview spacecraft={spacecraft} />
        </div>

        <div className="vab-panel">
          <div className="vab-panel-title">Stages</div>
          <div className="stage-list">
            {stages.map((stage, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                <button
                  className={`stage-btn ${selectedStage === idx ? 'active' : ''}`}
                  onClick={() => setSelectedStage(idx)}
                  style={{ flex: 1 }}
                >
                  Stage {stage.number} &mdash; {stage.parts.length} parts
                </button>
                {stages.length > 1 && (
                  <button className="btn btn-sm btn-danger" onClick={() => removeStage(idx)} style={{ padding: '0 10px' }}>&times;</button>
                )}
              </div>
            ))}
            <button className="btn btn-sm" onClick={addStage}>+ Add Stage</button>
          </div>

          {currentStage && (
            <>
              <div className="vab-panel-title" style={{ fontSize: 10, marginBottom: 8 }}>
                Stage {currentStage.number} Parts
              </div>
              <div className="parts-list">
                {currentStage.parts.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8, textAlign: 'center' }}>
                    No parts &mdash; click a part to add
                  </div>
                )}
                {currentStage.parts.map((part: any, idx: number) => (
                  <div key={idx} className="part-item">
                    <span>{part.name}</span>
                    <button className="remove-btn" onClick={() => removePart(idx)}>&times;</button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="control-info">
            <div className="info-item">
              <span className="label">Total Mass</span>
              <span className="value">{spacecraft.mass.toFixed(0)} kg</span>
            </div>
            <div className="info-item">
              <span className="label">Stages</span>
              <span className="value">{stages.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VABScreen;
