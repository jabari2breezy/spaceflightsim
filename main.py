import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from spaceflight_sim.game import Game
import pygame

async def main():
    game = Game()
    await game.run()

if __name__ == '__main__':
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(main())
    except RuntimeError:
        asyncio.run(main())
