import pygame
from .config import COLORS, WINDOW_WIDTH, WINDOW_HEIGHT
from .render_util import draw_rounded_rect, draw_text

class Button:
    def __init__(self, x, y, w, h, text, callback=None, color=None, text_color=None, font_size=20):
        self.rect = pygame.Rect(x, y, w, h)
        self.text = text
        self.callback = callback
        self.color = color or COLORS['button']
        self.hover_color = COLORS['button_hover']
        self.text_color = text_color or COLORS['white']
        self.font_size = font_size
        self.hovered = False
        self.active = False
        self.enabled = True
        self.visible = True
        self.data = None

    def handle_event(self, event):
        if not self.enabled or not self.visible:
            return False
        if event.type == pygame.MOUSEMOTION:
            self.hovered = self.rect.collidepoint(event.pos)
            return False
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.hovered:
                if self.callback:
                    self.callback(self.data)
                return True
        return False

    def draw(self, surface):
        if not self.visible:
            return
        if self.hovered and self.enabled:
            color = self.hover_color
        elif self.active:
            color = COLORS['button_active']
        else:
            color = self.color
        draw_rounded_rect(surface, color, self.rect, 4)
        if not self.enabled:
            c = list(COLORS['mid_grey'])
            if len(c) == 3:
                pass
            draw_rounded_rect(surface, COLORS['mid_grey'], self.rect, 4)
        draw_text(surface, self.text, self.font_size, self.rect.centerx, self.rect.centery, self.text_color)


class Panel:
    def __init__(self, x, y, w, h, title='', color=None):
        self.rect = pygame.Rect(x, y, w, h)
        self.title = title
        self.color = color or COLORS['panel']
        self.border_color = COLORS['panel_border']
        self.visible = True
        self.children = []
        self.draggable = False
        self.dragging = False
        self.drag_offset = (0, 0)

    def add_child(self, child):
        self.children.append(child)
        return child

    def handle_event(self, event):
        if not self.visible:
            return False
        if self.draggable and event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            title_rect = pygame.Rect(self.rect.x, self.rect.y, self.rect.w, 30)
            if title_rect.collidepoint(event.pos):
                self.dragging = True
                self.drag_offset = (event.pos[0] - self.rect.x, event.pos[1] - self.rect.y)
                return True
        if self.draggable and event.type == pygame.MOUSEBUTTONUP:
            self.dragging = False
        if self.draggable and event.type == pygame.MOUSEMOTION and self.dragging:
            self.rect.x = event.pos[0] - self.drag_offset[0]
            self.rect.y = event.pos[1] - self.drag_offset[1]
            return True
        for child in reversed(self.children):
            if hasattr(child, 'handle_event') and child.handle_event(event):
                return True
        return False

    def draw(self, surface):
        if not self.visible:
            return
        draw_rounded_rect(surface, self.color, self.rect, 6)
        draw_rounded_rect(surface, self.border_color, self.rect, 6)
        if self.title:
            draw_text(surface, self.title, 18, self.rect.centerx, self.rect.y + 15, COLORS['white'])
        for child in self.children:
            if hasattr(child, 'draw'):
                child.draw(surface)


class Slider:
    def __init__(self, x, y, w, h, min_val=0, max_val=100, initial=50, callback=None, label=''):
        self.rect = pygame.Rect(x, y, w, h)
        self.min_val = min_val
        self.max_val = max_val
        self.value = initial
        self.callback = callback
        self.label = label
        self.dragging = False
        self.visible = True

    def handle_event(self, event):
        if not self.visible:
            return False
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.rect.collidepoint(event.pos):
                self.dragging = True
                self._update_value(event.pos[0])
                return True
        if event.type == pygame.MOUSEBUTTONUP:
            self.dragging = False
        if event.type == pygame.MOUSEMOTION and self.dragging:
            self._update_value(event.pos[0])
        return False

    def _update_value(self, mx):
        ratio = (mx - self.rect.x) / max(self.rect.w, 1)
        ratio = max(0, min(1, ratio))
        self.value = self.min_val + ratio * (self.max_val - self.min_val)
        if self.callback:
            self.callback(self.value)

    def draw(self, surface):
        if not self.visible:
            return
        draw_rounded_rect(surface, COLORS['dark_grey'], self.rect, 3)
        ratio = (self.value - self.min_val) / max(self.max_val - self.min_val, 1)
        fill_rect = pygame.Rect(self.rect.x, self.rect.y, int(self.rect.w * ratio), self.rect.h)
        draw_rounded_rect(surface, COLORS['blue'], fill_rect, 3)
        handle_x = self.rect.x + int(self.rect.w * ratio)
        draw_circle_ui(surface, COLORS['light_grey'], (handle_x, self.rect.centery), self.rect.h // 2 + 2)
        if self.label:
            draw_text(surface, f'{self.label}: {self.value:.1f}', 14, self.rect.centerx, self.rect.y - 12, COLORS['white'])


def draw_circle_ui(surface, color, center, radius):
    pygame.draw.circle(surface, color, center, max(1, int(radius)))
