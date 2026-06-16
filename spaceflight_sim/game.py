import pygame
from .config import WINDOW_WIDTH, WINDOW_HEIGHT, FPS, COLORS
from .bodies import create_solar_system
from .menu_screen import MenuScreen
from .vab_screen import VABScreen
from .flight_screen import FlightScreen

class Game:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption('Spaceflight Simulator')
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        self.clock = pygame.time.Clock()
        self.running = True
        self.screen_name = 'menu'

        self.bodies = create_solar_system()
        self.menu_screen = MenuScreen(self)
        self.vab_screen = VABScreen(self)
        self.flight_screen = FlightScreen(self)

        self.current_screen = self.menu_screen

    def start_flight(self):
        default_parts = [
            'nose_cone', 'fuel_tank_small', 'engine_small',
            'decoupler', 'fuel_tank_medium', 'engine_medium'
        ]
        self.flight_screen.start([{'type': t} for t in default_parts])
        self.screen_name = 'flight'
        self.current_screen = self.flight_screen

    def start_vab(self):
        self.vab_screen.activate()
        self.screen_name = 'vab'
        self.current_screen = self.vab_screen

    def start_flight_from_vab(self, placed_parts):
        if not placed_parts:
            return
        self.flight_screen.start(placed_parts)
        self.screen_name = 'flight'
        self.current_screen = self.flight_screen

    @property
    def screen(self):
        return self.screen_name

    @screen.setter
    def screen(self, value):
        self.screen_name = value
        if value == 'menu':
            self.current_screen = self.menu_screen
        elif value == 'vab':
            self.vab_screen.activate()
            self.current_screen = self.vab_screen
        elif value == 'flight':
            self.current_screen = self.flight_screen

    def run(self):
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0
            dt = min(dt, 0.05)

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                else:
                    self.current_screen.handle_event(event)

            self.current_screen.update(dt)
            self.current_screen.draw(self.screen)

            pygame.display.flip()

        pygame.quit()
