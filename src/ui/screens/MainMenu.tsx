/**
 * Main Menu Screen
 */

import React from 'react';
import { Screen } from '../../App';

interface MainMenuProps {
  onNavigate: (screen: Screen) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onNavigate }) => {
  return (
    <div className="main-menu">
      <div className="menu-container">
        <h1 className="title">CELESTIA</h1>
        <p className="subtitle">Advanced Space Flight Simulator</p>

        <div className="menu-buttons">
          <button
            className="menu-button primary"
            onClick={() => onNavigate('flight')}
          >
            <span className="button-text">New Mission</span>
            <span className="button-desc">Start flying</span>
          </button>

          <button
            className="menu-button"
            onClick={() => onNavigate('vab')}
          >
            <span className="button-text">Vehicle Assembly Building</span>
            <span className="button-desc">Design your spacecraft</span>
          </button>

          <button className="menu-button">
            <span className="button-text">Load Mission</span>
            <span className="button-desc">Continue saved game</span>
          </button>

          <button className="menu-button">
            <span className="button-text">Settings</span>
            <span className="button-desc">Configure options</span>
          </button>
        </div>

        <div className="menu-footer">
          <p>© 2026 Celestia Development. All rights reserved.</p>
          <p>Realistic space flight simulation with advanced physics</p>
        </div>
      </div>

      <div className="menu-background">
        <div className="stars"></div>
      </div>
    </div>
  );
};

export default MainMenu;
