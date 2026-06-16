import random
import math
import pygame
from .config import COLORS, WINDOW_WIDTH, WINDOW_HEIGHT
from .render_util import draw_text, draw_circle

class MenuScreen:
    def __init__(self, game):
        self.game = game
        self.stars = [(random.uniform(0, WINDOW_WIDTH), random.uniform(0, WINDOW_HEIGHT),
                       random.uniform(0.3, 1.0)) for _ in range(120)]
        self.time = 0.0
        self.planets = self._create_bg_planets()

    def _create_bg_planets(self):
        return [
            {'x': WINDOW_WIDTH * 0.15, 'y': WINDOW_HEIGHT * 0.30, 'r': 35,
             'color': COLORS['earth_blue'], 'atmos': (60, 140, 200, 60),
             'speed': 0.08, 'phase': 0},
            {'x': WINDOW_WIDTH * 0.82, 'y': WINDOW_HEIGHT * 0.22, 'r': 28,
             'color': COLORS['mars_red'], 'atmos': (200, 120, 80, 40),
             'speed': 0.06, 'phase': 2.0},
            {'x': WINDOW_WIDTH * 0.70, 'y': WINDOW_HEIGHT * 0.68, 'r': 18,
             'color': COLORS['moon_grey'], 'atmos': None,
             'speed': 0.10, 'phase': 3.5},
            {'x': WINDOW_WIDTH * 0.25, 'y': WINDOW_HEIGHT * 0.72, 'r': 30,
             'color': COLORS['venus_yellow'], 'atmos': (200, 180, 120, 50),
             'speed': 0.05, 'phase': 1.0},
        ]

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            mx, my = event.pos
            cx = WINDOW_WIDTH // 2
            btn_w, btn_h = 240, 50
            gap = 10

            btns = [
                (self.game.start_flight, 310),
                (self.game.start_vab, 310 + btn_h + gap),
            ]

            for i, (action, y) in enumerate(btns):
                rect = pygame.Rect(cx - btn_w // 2, y, btn_w, btn_h)
                if rect.collidepoint(mx, my):
                    action()
                    return True

            quit_rect = pygame.Rect(WINDOW_WIDTH - 100, 10, 90, 35)
            if quit_rect.collidepoint(mx, my):
                self.game.running = False
        return False

    def update(self, dt):
        self.time += dt

    def draw(self, surface):
        surface.fill(COLORS['space_bg'])

        for sx, sy, b in self.stars:
            twinkle = 0.6 + 0.4 * math.sin(self.time * 1.5 + sx * 0.1)
            c = int(180 * twinkle)
            draw_circle(surface, (c, c, min(255, c + 20)),
                        (int(sx), int(sy)), max(1, int(1.5 * b * twinkle)))

        for p in self.planets:
            ox = math.sin(self.time * p['speed'] + p['phase']) * 12
            oy = math.cos(self.time * p['speed'] * 0.7 + p['phase'] + 1) * 6
            px, py = int(p['x'] + ox), int(p['y'] + oy)

            if p['atmos']:
                atmos_surf = pygame.Surface((p['r'] * 4, p['r'] * 4), pygame.SRCALPHA)
                pygame.draw.circle(atmos_surf, p['atmos'],
                                   (p['r'] * 2, p['r'] * 2), p['r'] * 1.6)
                surface.blit(atmos_surf, (px - p['r'] * 2, py - p['r'] * 2))

            draw_circle(surface, p['color'], (px, py), p['r'])

            hl = (min(255, p['color'][0] + 60),
                  min(255, p['color'][1] + 60),
                  min(255, p['color'][2] + 60))
            draw_circle(surface, hl, (px - p['r'] // 3, py - p['r'] // 3),
                        max(2, p['r'] // 4))

        cx = WINDOW_WIDTH // 2

        title_surf = pygame.Surface((500, 100), pygame.SRCALPHA)
        draw_text(title_surf, 'SPACEFLIGHT', 58, 250, 30, COLORS['white'])
        draw_text(title_surf, 'SIMULATOR', 58, 250, 75, COLORS['cyan'])
        surface.blit(title_surf, (cx - 250, 100))

        draw_text(surface, 'v2.0', 14, cx + 180, 175, COLORS['light_grey'])

        btn_w, btn_h = 240, 50
        container_x = cx - btn_w // 2

        mouse_x, mouse_y = pygame.mouse.get_pos()

        btns = [
            ('LAUNCH', 310, self.game.start_flight),
            ('VEHICLE ASSEMBLY', 310 + btn_h + 10, self.game.start_vab),
        ]

        panel_x = container_x - 15
        panel_y = btns[0][1] - 15
        panel_w = btn_w + 30
        panel_h = (len(btns) * (btn_h + 10)) + 20
        panel = pygame.Surface((panel_w, panel_h), pygame.SRCALPHA)
        panel.fill((10, 12, 25, 160))
        surface.blit(panel, (panel_x, panel_y))
        pygame.draw.rect(surface, COLORS['panel_border'],
                         (panel_x, panel_y, panel_w, panel_h), 1, border_radius=6)

        for text, y, action in btns:
            rect = pygame.Rect(container_x, y, btn_w, btn_h)
            hovered = rect.collidepoint(mouse_x, mouse_y)
            color = COLORS['button_hover'] if hovered else COLORS['button']
            pygame.draw.rect(surface, color, rect, border_radius=6)
            pygame.draw.rect(surface, COLORS['cyan'] if hovered else COLORS['panel_border'],
                             rect, 2, border_radius=6)
            draw_text(surface, text, 20, cx, y + btn_h // 2, COLORS['white'])

        quit_rect = pygame.Rect(WINDOW_WIDTH - 100, 10, 90, 35)
        q_hover = quit_rect.collidepoint(mouse_x, mouse_y)
        pygame.draw.rect(surface, COLORS['button_hover'] if q_hover else COLORS['button'],
                         quit_rect, border_radius=4)
        draw_text(surface, 'QUIT', 16, WINDOW_WIDTH - 55, 27, COLORS['light_grey'])

        controls = [
            'W/S - Throttle        A/D - Steer',
            'SPACE - Stage            TAB - Map',
            'F - SAS      R - RCS      T/Y - Warp',
            'P - Parachute      L - Landing Legs',
        ]
        cw, ch = 340, 90
        cx2 = WINDOW_WIDTH - cw - 15
        cy2 = WINDOW_HEIGHT - ch - 15
        panel2 = pygame.Surface((cw, ch), pygame.SRCALPHA)
        panel2.fill((10, 12, 25, 150))
        surface.blit(panel2, (cx2, cy2))
        pygame.draw.rect(surface, COLORS['panel_border'],
                         (cx2, cy2, cw, ch), 1, border_radius=4)
        draw_text(surface, 'CONTROLS', 13, cx2 + cw // 2, cy2 + 10, COLORS['cyan'])
        for i, c in enumerate(controls):
            draw_text(surface, c, 12, cx2 + cw // 2, cy2 + 28 + i * 16, COLORS['light_grey'])
