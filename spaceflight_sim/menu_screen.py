import random
import math
import pygame
from .config import COLORS, WINDOW_WIDTH, WINDOW_HEIGHT
from .render_util import draw_text, draw_circle, draw_line, draw_rounded_rect

class MenuScreen:
    def __init__(self, game):
        self.game = game
        self.stars = [(random.uniform(0, WINDOW_WIDTH), random.uniform(0, WINDOW_HEIGHT),
                       random.uniform(0.3, 1.0)) for _ in range(120)]
        self.time = 0.0
        self.planets = self._create_bg_planets()

    def _create_bg_planets(self):
        return [
            {'x': WINDOW_WIDTH * 0.15, 'y': WINDOW_HEIGHT * 0.25, 'r': 30, 'color': COLORS['mars_red'], 'speed': 0.1, 'phase': 0},
            {'x': WINDOW_WIDTH * 0.85, 'y': WINDOW_HEIGHT * 0.20, 'r': 45, 'color': COLORS['earth_blue'], 'speed': 0.08, 'phase': 1.5},
            {'x': WINDOW_WIDTH * 0.75, 'y': WINDOW_HEIGHT * 0.65, 'r': 20, 'color': COLORS['moon_grey'], 'speed': 0.12, 'phase': 3.0},
            {'x': WINDOW_WIDTH * 0.25, 'y': WINDOW_HEIGHT * 0.70, 'r': 35, 'color': COLORS['venus_yellow'], 'speed': 0.06, 'phase': 4.2},
        ]

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            mx, my = event.pos
            cx = WINDOW_WIDTH // 2
            launch_btn = pygame.Rect(cx - 100, 340, 200, 50)
            vab_btn = pygame.Rect(cx - 100, 400, 200, 50)
            quit_btn = pygame.Rect(cx - 100, 460, 200, 50)
            if launch_btn.collidepoint(mx, my):
                self.game.start_flight()
            elif vab_btn.collidepoint(mx, my):
                self.game.start_vab()
            elif quit_btn.collidepoint(mx, my):
                self.game.running = False
        return False

    def update(self, dt):
        self.time += dt

    def draw(self, surface):
        surface.fill(COLORS['space_bg'])
        for sx, sy, b in self.stars:
            twinkle = 0.7 + 0.3 * math.sin(self.time * 2 + sx * 0.1)
            c = int(180 * twinkle)
            draw_circle(surface, (c, c, min(255, c + 20)), (int(sx), int(sy)), max(1, int(1.5 * b * twinkle)))

        for p in self.planets:
            offset = math.sin(self.time * p['speed'] + p['phase']) * 10
            draw_circle(surface, p['color'], (int(p['x'] + offset), int(p['y'])), p['r'])
            highlight = (min(255, p['color'][0] + 60), min(255, p['color'][1] + 60), min(255, p['color'][2] + 60))
            draw_circle(surface, highlight, (int(p['x'] + offset - p['r'] * 0.3), int(p['y'] - p['r'] * 0.3)), max(1, p['r'] // 3))

        cx = WINDOW_WIDTH // 2
        draw_text(surface, 'SPACEFLIGHT', 56, cx, 150, COLORS['white'])
        draw_text(surface, 'S I M U L A T O R', 36, cx, 200, COLORS['light_blue'])

        draw_text(surface, 'v2.0', 16, cx, 230, COLORS['light_grey'])

        # buttons
        btn_color = COLORS['button']
        hover = pygame.mouse.get_pos()

        for i, (text, y_offset) in enumerate([('LAUNCH', 320), ('VEHICLE ASSEMBLY', 390), ('QUIT', 460)]):
            rect = pygame.Rect(cx - 120, y_offset, 240, 50)
            color = COLORS['button_hover'] if rect.collidepoint(hover) else COLORS['button']
            pygame.draw.rect(surface, color, rect, border_radius=6)
            pygame.draw.rect(surface, COLORS['panel_border'], rect, 2, border_radius=6)
            draw_text(surface, text, 22, cx, y_offset + 25, COLORS['white'])

        controls = [
            'W/S  - Throttle up/down     A/D - Roll',
            'SPACE - Stage      TAB - Map view',
            'F - SAS toggle     R - RCS toggle',
            'T/Y - Time warp    P - Parachute',
            'Scroll to zoom     ESC - Menu',
        ]
        y = WINDOW_HEIGHT - 155
        draw_rounded_rect(surface, COLORS['panel'], (cx - 200, y - 10, 400, 120), 6)
        draw_text(surface, 'CONTROLS', 14, cx, y + 5, COLORS['white'])
        for i, c in enumerate(controls):
            draw_text(surface, c, 12, cx, y + 25 + i * 16, COLORS['light_grey'])
