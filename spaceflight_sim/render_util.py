import math
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
    visible = camera.get_visible_rect()
    zoom_log = math.log10(max(camera.zoom, 1e-10))
    star_size = max(1, 1 + zoom_log * 0.2)
    for sx, sy, brightness in stars:
        screen_x = int((sx - camera.x) * camera.zoom + width / 2)
        screen_y = int(-(sy - camera.y) * camera.zoom + height / 2)
        if 0 <= screen_x <= width and 0 <= screen_y <= height:
            alpha = min(255, max(30, brightness * (1 + zoom_log * 0.1)))
            color = (int(200 * alpha / 255), int(200 * alpha / 255), int(220 * alpha / 255))
            draw_circle(surface, color, (screen_x, screen_y), max(1, int(star_size)))
