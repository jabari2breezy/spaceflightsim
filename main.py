import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from spaceflight_sim.game import Game

if __name__ == '__main__':
    game = Game()
    game.run()
