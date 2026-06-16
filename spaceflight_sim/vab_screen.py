import pygame
from .config import COLORS, PART_TYPES, PART_ORDER, PART_SIZE, WINDOW_WIDTH, WINDOW_HEIGHT
from .render_util import draw_text, draw_circle, draw_rect, draw_rounded_rect

class VABScreen:
    def __init__(self, game):
        self.game = game
        self.parts_list = []
        self.selected_parts = []
        self.scroll_offset = 0
        self.max_scroll = 0
        self.part_panel_width = 200
        self.page = 'parts'

        self.build_area_x = self.part_panel_width + 20
        self.build_area_y = 60
        self.build_cell_size = PART_SIZE + 4

        self.placed_parts = []
        self.grid_snapped = True
        self.preview_ghost = None
        self.mouse_grid_x = 0
        self.mouse_grid_y = 0
        self.fuel_text = False

        self.vehicle_name = 'Untitled'
        self.total_cost = 0

    def activate(self):
        self.placed_parts = []
        self.total_cost = 0

    def _get_part_at_grid(self, gx, gy):
        for p in self.placed_parts:
            if p['grid_x'] == gx and p['grid_y'] == gy:
                return p
        return None

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            mx, my = event.pos
            if self._handle_part_selection(mx, my):
                return True
            if self._handle_build_area_click(mx, my):
                return True
            if self._handle_ui_click(mx, my):
                return True
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 3:
            mx, my = event.pos
            self._handle_remove_part(mx, my)
        if event.type == pygame.MOUSEWHEEL:
            self.scroll_offset = max(0, min(self.scroll_offset - event.y * 20, self.max_scroll))
        if event.type == pygame.MOUSEMOTION:
            mx, my = event.pos
            self._update_ghost(mx, my)
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.game.screen = 'menu'
            if event.key == pygame.K_SPACE or event.key == pygame.K_RETURN:
                if self.placed_parts:
                    self.game.start_flight_from_vab(self.placed_parts)
        return False

    def _handle_part_selection(self, mx, my):
        x = 10
        y = 70 - self.scroll_offset
        for pt in PART_ORDER:
            rect = pygame.Rect(x + 5, y, self.part_panel_width - 10, 55)
            if rect.collidepoint(mx, my):
                spec = PART_TYPES[pt]
                self.selected_parts.append(pt)
                return True
            y += 60
        self.max_scroll = max(0, y - 600)
        return False

    def _handle_build_area_click(self, mx, my):
        if not self.selected_parts:
            return False
        if mx < self.build_area_x:
            return False

        gx = int((mx - self.build_area_x) / self.build_cell_size)
        gy = int((my - self.build_area_y) / self.build_cell_size)

        gx = max(0, min(gx, 20))

        if gy < 0:
            return False

        ptype = self.selected_parts[-1]
        spec = PART_TYPES[ptype]
        w = spec['width']

        if self._get_part_at_grid(gx, gy) or self._get_part_at_grid(gx + w - 1, gy):
            return True

        if self.placed_parts:
            any_connected = False
            for p in self.placed_parts:
                pspec = PART_TYPES[p['type']]
                if (abs(p['grid_x'] - gx) < max(w, pspec['width']) and
                    abs(p['grid_y'] - gy) < max(spec['height'], pspec['height'])):
                    dx = abs(p['grid_x'] + pspec['width']/2 - (gx + w/2))
                    dy = abs(p['grid_y'] + pspec['height']/2 - (gy + spec['height']/2))
                    if dx <= max(w, pspec['width'])/2 + 0.1 and dy <= 1.5:
                        any_connected = True
                        break
            if not any_connected:
                return True

        part = {
            'type': ptype,
            'grid_x': gx,
            'grid_y': gy,
            'spec': spec,
        }
        self.placed_parts.append(part)
        self.total_cost += spec['cost']
        return True

    def _handle_remove_part(self, mx, my):
        if mx < self.build_area_x:
            return
        gx = int((mx - self.build_area_x) / self.build_cell_size)
        gy = int((my - self.build_area_y) / self.build_cell_size)
        for i, p in enumerate(self.placed_parts):
            pspec = PART_TYPES[p['type']]
            if p['grid_x'] <= gx < p['grid_x'] + pspec['width'] and p['grid_y'] == gy:
                removed = self.placed_parts.pop(i)
                self.total_cost -= pspec['cost']
                return

    def _handle_ui_click(self, mx, my):
        cx = WINDOW_WIDTH // 2
        launch_rect = pygame.Rect(cx + 60, 10, 100, 35)
        clear_rect = pygame.Rect(cx - 40, 10, 90, 35)
        menu_rect = pygame.Rect(10, 10, 60, 35)
        if launch_rect.collidepoint(mx, my) and self.placed_parts:
            self.game.start_flight_from_vab(self.placed_parts)
            return True
        if clear_rect.collidepoint(mx, my):
            self.placed_parts = []
            self.total_cost = 0
            return True
        if menu_rect.collidepoint(mx, my):
            self.game.screen = 'menu'
            return True
        return False

    def _update_ghost(self, mx, my):
        if mx < self.build_area_x or not self.selected_parts:
            self.preview_ghost = None
            return
        gx = int((mx - self.build_area_x) / self.build_cell_size)
        gy = int((my - self.build_area_y) / self.build_cell_size)
        gx = max(0, min(gx, 20))
        self.mouse_grid_x = gx
        self.mouse_grid_y = gy
        self.preview_ghost = self.selected_parts[-1] if self.selected_parts else None

    def update(self, dt):
        pass

    def draw(self, surface):
        surface.fill(COLORS['dark_grey'])

        self._draw_top_bar(surface)
        self._draw_part_panel(surface)
        self._draw_build_area(surface)
        self._draw_ghost(surface)
        self._draw_stats(surface)

    def _draw_top_bar(self, surface):
        draw_rounded_rect(surface, COLORS['panel'], (0, 0, WINDOW_WIDTH, 50), 0)
        draw_text(surface, f'VEHICLE ASSEMBLY - {self.vehicle_name}', 20, 200, 25, COLORS['white'])
        draw_text(surface, f'Cost: ${self.total_cost}', 16, 500, 25, COLORS['yellow'])
        draw_text(surface, f'Parts: {len(self.placed_parts)}', 16, 620, 25, COLORS['white'])
        draw_text(surface, 'LAUNCH', 16, WINDOW_WIDTH // 2 + 110, 27, COLORS['green'])
        draw_text(surface, 'CLEAR', 16, WINDOW_WIDTH // 2 + 5, 27, COLORS['white'])
        draw_text(surface, 'MENU', 14, 40, 27, COLORS['light_grey'])
        draw_text(surface, 'ESC: Menu  |  SPACE: Launch  |  Right-click: Remove', 13, WINDOW_WIDTH // 2, WINDOW_HEIGHT - 15, COLORS['light_grey'])

    def _draw_part_panel(self, surface):
        draw_rounded_rect(surface, COLORS['panel'], (0, 50, self.part_panel_width + 10, WINDOW_HEIGHT - 50), 0)
        draw_text(surface, 'PARTS', 16, self.part_panel_width // 2 + 5, 58, COLORS['white'])

        y = 70 - self.scroll_offset
        for pt in PART_ORDER:
            spec = PART_TYPES[pt]
            rect = pygame.Rect(10, y, self.part_panel_width - 10, 55)
            selected = self.selected_parts and self.selected_parts[-1] == pt
            color = COLORS['button_active'] if selected else COLORS['button']
            draw_rounded_rect(surface, color, rect, 4)
            draw_text(surface, spec['name'], 14, rect.centerx, rect.y + 14, COLORS['white'])
            draw_text(surface, f'Mass: {spec["mass"]}t  Cost: ${spec["cost"]}', 11, rect.centerx, rect.y + 32, COLORS['light_grey'])
            draw_text(surface, spec.get('description', ''), 10, rect.centerx, rect.y + 45, COLORS['light_grey'])
            y += 60

    def _draw_build_area(self, surface):
        draw_rounded_rect(surface, COLORS['panel'],
                          (self.build_area_x - 10, self.build_area_y - 10,
                           WINDOW_WIDTH - self.build_area_x + 10, WINDOW_HEIGHT - self.build_area_y + 10), 0)

        for py in range(0, 30):
            for px in range(0, 21):
                rx = self.build_area_x + px * self.build_cell_size
                ry = self.build_area_y + py * self.build_cell_size
                draw_rect(surface, COLORS['dark_grey'],
                          (rx, ry, self.build_cell_size - 2, self.build_cell_size - 2), 1)

        for part in self.placed_parts:
            self._draw_build_part(surface, part)

    def _draw_build_part(self, surface, part):
        spec = part['spec']
        px = self.build_area_x + part['grid_x'] * self.build_cell_size
        py = self.build_area_y + part['grid_y'] * self.build_cell_size
        pw = spec['width'] * self.build_cell_size - 4
        ph = spec['height'] * self.build_cell_size - 4
        color = spec['color']
        rect = pygame.Rect(px, py, pw, ph)
        draw_rounded_rect(surface, color, rect, 3)
        draw_rounded_rect(surface, COLORS['panel_border'], rect, 3)
        draw_text(surface, spec['name'][:12], 11, rect.centerx, rect.centery, COLORS['white'])

    def _draw_ghost(self, surface):
        if not self.preview_ghost or not self.selected_parts:
            return
        spec = PART_TYPES[self.preview_ghost]
        px = self.build_area_x + self.mouse_grid_x * self.build_cell_size
        py = self.build_area_y + self.mouse_grid_y * self.build_cell_size
        pw = spec['width'] * self.build_cell_size - 4
        ph = spec['height'] * self.build_cell_size - 4
        ghost_surf = pygame.Surface((pw, ph), pygame.SRCALPHA)
        ghost_color = (*spec['color'], 100)
        ghost_surf.fill(ghost_color)
        pygame.draw.rect(ghost_surf, (*COLORS['white'], 80), ghost_surf.get_rect(), 2, border_radius=3)
        surface.blit(ghost_surf, (px, py))

    def _draw_stats(self, surface):
        total_mass = sum(PART_TYPES[p['type']]['mass'] for p in self.placed_parts)
        total_fuel = sum(PART_TYPES[p['type']].get('fuel_capacity', 0) for p in self.placed_parts)
        total_thrust = sum(PART_TYPES[p['type']].get('thrust', 0) for p in self.placed_parts)

        panel_x = self.build_area_x
        panel_y = WINDOW_HEIGHT - 60
        draw_rounded_rect(surface, COLORS['transparent_bg'], (panel_x, panel_y, 300, 55), 4)
        draw_text(surface, f'Mass: {total_mass:.1f}t  Fuel: {total_fuel:.0f}  Thrust: {total_thrust:.0f}kN', 12, panel_x + 150, panel_y + 20, COLORS['white'])
        if total_mass > 0 and total_thrust > 0:
            twr = total_thrust / (total_mass * 9.81)
            draw_text(surface, f'TWR: {twr:.2f}', 12, panel_x + 150, panel_y + 38, COLORS['green'] if twr > 1 else COLORS['red'])
