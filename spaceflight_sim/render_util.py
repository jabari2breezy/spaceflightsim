import math
import random
import pygame
from .config import WINDOW_WIDTH, WINDOW_HEIGHT

class Camera:
    def __init__(self):
        self.x = 0.0
        self.y = 0.0
        self.zoom = 1.0
        self.target_zoom = 1.0
        self.width = WINDOW_WIDTH
        self.height = WINDOW_HEIGHT

    def world_to_screen(self, wx, wy):
        sx = (wx - self.x) * self.zoom + self.width / 2
        sy = -(wy - self.y) * self.zoom + self.height / 2
        return int(sx), int(sy)

    def screen_to_world(self, sx, sy):
        wx = (sx - self.width / 2) / self.zoom + self.x
        wy = -(sy - self.height / 2) / self.zoom + self.y
        return wx, wy

    def world_length(self, length):
        return max(1, int(length * self.zoom))

    def set_target(self, wx, wy):
        self.x += (wx - self.x) * 0.1
        self.y += (wy - self.y) * 0.1

    def set_zoom(self, target):
        self.target_zoom = max(1e-12, min(target, 1e12))
        self.zoom += (self.target_zoom - self.zoom) * 0.1

    def zoom_at_point(self, factor, screen_x, screen_y):
        wx, wy = self.screen_to_world(screen_x, screen_y)
        self.zoom = max(1e-12, min(self.zoom * factor, 1e12))
        new_wx, new_wy = self.screen_to_world(screen_x, screen_y) if False else (0, 0)

    def get_visible_rect(self):
        half_w = self.width / (2 * self.zoom)
        half_h = self.height / (2 * self.zoom)
        return (self.x - half_w, self.y - half_h, self.x + half_w, self.y + half_h)


def draw_circle(surface, color, center, radius, width=0):
    pygame.draw.circle(surface, color, center, max(1, int(radius)), width)


def draw_line(surface, color, start, end, width=1):
    pygame.draw.line(surface, color, start, end, max(1, width))


def draw_rect(surface, color, rect, width=0):
    pygame.draw.rect(surface, color, rect, width)


def draw_polygon(surface, color, points, width=0):
    if len(points) >= 2:
        pygame.draw.polygon(surface, color, points, width)


def draw_text(surface, text, size, x, y, color=(200, 200, 210), font=None, center=True, alpha=255):
    if font is None:
        font = pygame.font.Font(None, size)
    text_surf = font.render(text, True, color)
    if alpha < 255:
        text_surf.set_alpha(alpha)
    if center:
        rect = text_surf.get_rect(center=(x, y))
    else:
        rect = text_surf.get_rect(topleft=(x, y))
    surface.blit(text_surf, rect)
    return rect


def draw_rounded_rect(surface, color, rect, radius):
    r = min(radius, rect[3] // 2, rect[2] // 2)
    pygame.draw.rect(surface, color, rect, border_radius=max(1, r))


def draw_thrust_plume(surface, x, y, angle, thrust, zoom):
    if thrust <= 0:
        return
    length = min(60, 10 + thrust * 0.15) * zoom
    width = max(2, 4 * zoom)
    ex = -math.cos(angle)
    ey = -math.sin(angle)
    px = -ey
    py = ex
    end_x = x + length * ex
    end_y = y + length * ey

    plume_color = (255, 200, 100) if thrust > 0.3 else (200, 150, 80)
    core_color = (255, 255, 200) if thrust > 0.5 else (255, 220, 150)

    points = [
        (x + width * px, y + width * py),
        (end_x, end_y),
        (x - width * px, y - width * py),
    ]
    draw_polygon(surface, plume_color, points)
    core_width = max(1, width * 0.4)
    core_points = [
        (x + core_width * px, y + core_width * py),
        (x + (end_x - x) * 0.7 + x, y + (end_y - y) * 0.7 + y),
        (x - core_width * px, y - core_width * py),
    ]
    draw_polygon(surface, core_color, core_points)


def draw_starfield(surface, stars, camera, width, height):
    zoom_log = math.log10(max(camera.zoom, 1e-10))
    star_size = max(1, 1 + zoom_log * 0.2)
    
    for sx, sy, brightness in stars:
        depth = 0.01 + brightness * 0.04
        px = (sx - camera.x * depth) * math.pow(camera.zoom, 0.1)
        py = -(sy - camera.y * depth) * math.pow(camera.zoom, 0.1)
        
        screen_x = int(px) % width
        screen_y = int(py) % height
        
        alpha = min(255, max(30, brightness * 255))
        color = (int(200 * alpha / 255), int(200 * alpha / 255), int(220 * alpha / 255))
        draw_circle(surface, color, (screen_x, screen_y), max(1, int(star_size)))

class ParticleSystem:
    def __init__(self):
        self.particles = []

    def emit(self, x, y, vx, vy, life, color, size, growth=-0.1):
        self.particles.append({
            'x': x, 'y': y, 'vx': vx, 'vy': vy,
            'life': life, 'max_life': life,
            'color': color, 'size': size, 'growth': growth
        })

    def update(self, dt):
        for p in self.particles:
            p['x'] += p['vx'] * dt
            p['y'] += p['vy'] * dt
            p['life'] -= dt
            p['size'] += p['growth'] * dt
        self.particles = [p for p in self.particles if p['life'] > 0 and p['size'] > 0]

    def draw(self, surface, camera):
        for p in self.particles:
            alpha = max(0, min(255, int(255 * (p['life'] / p['max_life']))))
            if alpha <= 0: continue
            sx, sy = camera.world_to_screen(p['x'], p['y'])
            r = max(1, int(p['size'] * camera.zoom))
            if r > 100: continue
            if -r < sx < WINDOW_WIDTH + r and -r < sy < WINDOW_HEIGHT + r:
                if len(p['color']) == 4 or alpha < 255:
                    c = (*p['color'][:3], alpha)
                    s = pygame.Surface((r*2, r*2), pygame.SRCALPHA)
                    pygame.draw.circle(s, c, (r, r), r)
                    surface.blit(s, (sx - r, sy - r))
                else:
                    pygame.draw.circle(surface, p['color'][:3], (sx, sy), r)

