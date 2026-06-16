import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from spaceflight_sim.game import Game

async def main():
    game = Game()
    await game.run()

if __name__ == '__main__':
    asyncio.run(main())
