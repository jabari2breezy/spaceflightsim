import pygame
from .config import COLORS, PART_TYPES, PART_ORDER, WINDOW_WIDTH, WINDOW_HEIGHT
from .config import CATEGORY_ORDER, CATEGORY_NAMES, CATEGORY_COLORS
from .render_util import draw_text, draw_rounded_rect

class VABScreen:
    def __init__(self, game):
        self.game = game
        self.placed_parts = []
        self.selected_part_type = None
        self.scroll_offset = 0
        self.total_cost = 0
        self.vehicle_name = 'Rocket 1'

        self.panel_w = 150
        self.build_x = self.panel_w + 5
        self.build_y = 55
        self.cell_size = 30

        self.grid_cols = 30
        self.grid_rows = 20

        self._build_from_categories()

    def _build_from_categories(self):
        self.categorized = {}
        for cat in CATEGORY_ORDER:
            parts = [pt for pt in PART_ORDER if PART_TYPES[pt].get('category', '') == cat]
            if parts:
                self.categorized[cat] = parts

    def activate(self):
        self.placed_parts = []
        self.total_cost = 0
        self.selected_part_type = None
        self.scroll_offset = 0

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1:
                mx, my = event.pos
                if self._handle_palette_click(mx, my):
                    return True
                if self._handle_build_click(mx, my):
                    return True
                if self._handle_ui_click(mx, my):
                    return True
            elif event.button == 3 and self.selected_part_type:
                self.selected_part_type = None
        if event.type == pygame.MOUSEWHEEL:
            self.scroll_offset = max(0, self.scroll_offset - event.y * 25)
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.game.screen = 'menu'
            if event.key in (pygame.K_SPACE, pygame.K_RETURN):
                if self.placed_parts:
                    self.game.start_flight_from_vab(self.placed_parts)
        return False

    def _handle_palette_click(self, mx, my):
        if mx > self.panel_w:
            return False
        y = 65 - self.scroll_offset
        for cat in CATEGORY_ORDER:
            if cat not in self.categorized:
                continue
            y += 22
            for pt in self.categorized[cat]:
                rect = pygame.Rect(5, y, self.panel_w - 10, 28)
                if rect.collidepoint(mx, my):
                    self.selected_part_type = pt
                    return True
                y += 30
        self.scroll_offset = max(0, min(self.scroll_offset, max(0, y - 700)))
        return False

    def _handle_build_click(self, mx, my):
        if mx < self.build_x or not self.selected_part_type:
            return False
        gx = (mx - self.build_x) // self.cell_size
        gy = (my - self.build_y) // self.cell_size
        if gx < 0 or gx >= self.grid_cols or gy < 0 or gy >= self.grid_rows:
            return False

        spec = PART_TYPES[self.selected_part_type]
        pw = max(1, int(spec['width'] * 2))
        ph = max(1, int(spec['height'] * 2))

        if gx + pw > self.grid_cols:
            gx = self.grid_cols - pw
        if gy + ph > self.grid_rows:
            gy = self.grid_rows - ph

        if self.placed_parts:
            bottom_part = max(self.placed_parts, key=lambda p: p['gy'] + p['ph'])
            new_bottom = bottom_part['gy'] + bottom_part['ph']
            gy = new_bottom
            if gy + ph > self.grid_rows:
                return False
            gx = self.grid_cols // 2 - pw // 2

        part = {
            'type': self.selected_part_type,
            'gx': gx,
            'gy': gy,
            'pw': pw,
            'ph': ph,
        }
        self.placed_parts.append(part)
        self.total_cost += PART_TYPES[self.selected_part_type]['cost']
        return True

    def _handle_ui_click(self, mx, my):
        launch_btn = pygame.Rect(WINDOW_WIDTH - 110, 8, 100, 36)
        clear_btn = pygame.Rect(WINDOW_WIDTH - 220, 8, 100, 36)
        menu_btn = pygame.Rect(5, 8, 55, 36)

        if launch_btn.collidepoint(mx, my) and self.placed_parts:
            self.game.start_flight_from_vab(self.placed_parts)
            return True
        if clear_btn.collidepoint(mx, my):
            self.placed_parts = []
            self.total_cost = 0
            return True
        if menu_btn.collidepoint(mx, my):
            self.game.screen = 'menu'
            return True

        for part in reversed(self.placed_parts):
            rx = self.build_x + part['gx'] * self.cell_size
            ry = self.build_y + part['gy'] * self.cell_size
            rw = part['pw'] * self.cell_size
            rh = part['ph'] * self.cell_size
            if pygame.Rect(rx, ry, rw, rh).collidepoint(mx, my):
                self.placed_parts.remove(part)
                self.total_cost -= PART_TYPES[part['type']]['cost']
                return True
        return False

    def update(self, dt):
        pass

    def draw(self, surface):
        surface.fill((12, 15, 28))

        self._draw_top_bar(surface)
        self._draw_palette(surface)
        self._draw_build_area(surface)
        self._draw_parts(surface)
        self._draw_selected_highlight(surface)
        self._draw_stats(surface)

    def _draw_top_bar(self, surface):
        bar = pygame.Surface((WINDOW_WIDTH, 50), pygame.SRCALPHA)
        bar.fill((8, 10, 22, 220))
        surface.blit(bar, (0, 0))
        pygame.draw.line(surface, COLORS['panel_border'], (0, 50), (WINDOW_WIDTH, 50), 1)

        draw_text(surface, 'VAB', 18, 35, 15, COLORS['cyan'])
        draw_text(surface, self.vehicle_name, 14, 35, 34, COLORS['light_grey'])

        total_mass = sum(PART_TYPES[p['type']]['mass'] for p in self.placed_parts)
        total_fuel = sum(PART_TYPES[p['type']].get('fuel_capacity', 0) for p in self.placed_parts)
        total_thrust = sum(PART_TYPES[p['type']].get('thrust', 0) for p in self.placed_parts)

        info_x = 250
        info_y = 15
        draw_text(surface, f'H: {info_x + 100}', 12, info_x + 20, info_y, COLORS['light_grey'])
        draw_text(surface, f'M: {total_mass:.1f}t', 13, info_x + 200, info_y, COLORS['light_grey'])
        draw_text(surface, f'F: {total_fuel:.0f}t', 13, info_x + 200, info_y + 18, COLORS['light_grey'])
        draw_text(surface, f'T: {total_thrust:.0f}kN', 13, info_x + 200, info_y + 36, COLORS['light_grey'])

        menu_rect = pygame.Rect(5, 8, 55, 36)
        m_hover = menu_rect.collidepoint(pygame.mouse.get_pos())
        pygame.draw.rect(surface, COLORS['button_hover'] if m_hover else COLORS['button'],
                         menu_rect, border_radius=4)
        draw_text(surface, 'MENU', 12, 32, 26, COLORS['light_grey'])

        clear_rect = pygame.Rect(WINDOW_WIDTH - 220, 8, 100, 36)
        c_hover = clear_rect.collidepoint(pygame.mouse.get_pos())
        pygame.draw.rect(surface, COLORS['button_hover'] if c_hover else COLORS['button'],
                         clear_rect, border_radius=4)
        draw_text(surface, 'CLEAR', 13, WINDOW_WIDTH - 170, 26, COLORS['light_grey'])

        launch_rect = pygame.Rect(WINDOW_WIDTH - 110, 8, 100, 36)
        l_hover = launch_rect.collidepoint(pygame.mouse.get_pos())
        color = COLORS['button_active'] if l_hover else COLORS['dark_cyan']
        pygame.draw.rect(surface, color, launch_rect, border_radius=4)
        draw_text(surface, 'LAUNCH', 14, WINDOW_WIDTH - 60, 26, COLORS['white'])

    def _draw_palette(self, surface):
        panel = pygame.Surface((self.panel_w, WINDOW_HEIGHT - 50), pygame.SRCALPHA)
        panel.fill((8, 10, 22, 230))
        surface.blit(panel, (0, 50))
        pygame.draw.line(surface, COLORS['panel_border'],
                         (self.panel_w, 50), (self.panel_w, WINDOW_HEIGHT), 1)

        draw_text(surface, 'PARTS', 13, self.panel_w // 2, 58, COLORS['cyan'])

        y = 65 - self.scroll_offset
        for cat in CATEGORY_ORDER:
            if cat not in self.categorized:
                continue
            cat_color = CATEGORY_COLORS.get(cat, COLORS['light_grey'])
            if y + 15 > 55 and y < WINDOW_HEIGHT - 5:
                draw_text(surface, CATEGORY_NAMES[cat], 10, self.panel_w // 2, y + 8, cat_color)
            y += 22

            for pt in self.categorized[cat]:
                spec = PART_TYPES[pt]
                if y + 14 > 55 and y < WINDOW_HEIGHT - 5:
                    selected = self.selected_part_type == pt
                    rect = pygame.Rect(5, y, self.panel_w - 10, 28)
                    bg = COLORS['button_active'] if selected else COLORS['button']
                    pygame.draw.rect(surface, bg, rect, border_radius=4)

                    color_swatch = pygame.Rect(8, y + 4, 10, 20)
                    pygame.draw.rect(surface, spec['color'], color_swatch)

                    label = spec['name'][:12]
                    draw_text(surface, label, 11, 5 + self.panel_w // 2, y + 14, COLORS['white'])

                    if spec.get('fuel_capacity', 0) > 0:
                        fc = spec['fuel_capacity']
                        draw_text(surface, f'{fc:.0f}t', 8, self.panel_w - 8, y + 16,
                                  COLORS['light_grey'], center=False)
                    elif spec.get('thrust', 0) > 0:
                        th = spec['thrust']
                        draw_text(surface, f'{th:.0f}', 8, self.panel_w - 8, y + 16,
                                  COLORS['light_grey'], center=False)
                y += 30
        self._palette_total_height = y

    def _draw_build_area(self, surface):
        ax = self.build_x
        ay = self.build_y
        aw = WINDOW_WIDTH - ax - 5
        ah = WINDOW_HEIGHT - ay - 5

        bg = pygame.Surface((aw, ah))
        bg.fill((14, 17, 32))
        surface.blit(bg, (ax, ay))
        pygame.draw.rect(surface, COLORS['panel_border'], (ax, ay, aw, ah), 1)

        for gx in range(self.grid_cols + 1):
            x = ax + gx * self.cell_size
            color = (25, 30, 50) if gx % 2 == 0 else (20, 25, 45)
            for gy in range(self.grid_rows + 1):
                y = ay + gy * self.cell_size
                rect = pygame.Rect(x, y, self.cell_size, self.cell_size)
                if (gx + gy) % 2 == 0:
                    pygame.draw.rect(surface, color, rect)

        for gx in range(self.grid_cols + 1):
            x = ax + gx * self.cell_size
            pygame.draw.line(surface, (25, 30, 55), (x, ay), (x, ay + ah), 1)
        for gy in range(self.grid_rows + 1):
            y = ay + gy * self.cell_size
            pygame.draw.line(surface, (25, 30, 55), (ax, y), (ax + aw, y), 1)

    def _draw_parts(self, surface):
        for part in self.placed_parts:
            spec = PART_TYPES[part['type']]
            rx = self.build_x + part['gx'] * self.cell_size
            ry = self.build_y + part['gy'] * self.cell_size
            rw = part['pw'] * self.cell_size - 2
            rh = part['ph'] * self.cell_size - 2

            part_surf = pygame.Surface((rw, rh))
            part_surf.fill(spec['color'])
            surface.blit(part_surf, (rx + 1, ry + 1))
            pygame.draw.rect(surface, COLORS['panel_border'], (rx + 1, ry + 1, rw, rh), 1,
                             border_radius=2)

            for gx in range(part['pw']):
                for gy in range(part['ph']):
                    px = rx + gx * self.cell_size + 4
                    py = ry + gy * self.cell_size + 4
                    pygame.draw.rect(surface, (40, 40, 50), (px, py, self.cell_size - 8, self.cell_size - 8), 1)

            label = spec['name'][:10]
            draw_text(surface, label, 10, rx + rw // 2, ry + rh // 2, COLORS['black'])

    def _draw_selected_highlight(self, surface):
        if not self.selected_part_type:
            return
        mx, my = pygame.mouse.get_pos()
        if mx < self.build_x:
            return
        gx = (mx - self.build_x) // self.cell_size
        gy = (my - self.build_y) // self.cell_size
        spec = PART_TYPES[self.selected_part_type]
        pw = max(1, int(spec['width'] * 2))
        ph = max(1, int(spec['height'] * 2))
        rx = self.build_x + gx * self.cell_size
        ry = self.build_y + gy * self.cell_size
        rw = pw * self.cell_size
        rh = ph * self.cell_size
        s = pygame.Surface((rw, rh), pygame.SRCALPHA)
        s.fill((0, 188, 212, 50))
        surface.blit(s, (rx, ry))
        pygame.draw.rect(surface, COLORS['cyan'], (rx, ry, rw, rh), 2, border_radius=2)

    def _draw_stats(self, surface):
        if not self.placed_parts:
            return
        total_mass = sum(PART_TYPES[p['type']]['mass'] for p in self.placed_parts)
        total_fuel = sum(PART_TYPES[p['type']].get('fuel_capacity', 0) for p in self.placed_parts)
        total_thrust = sum(PART_TYPES[p['type']].get('thrust', 0) for p in self.placed_parts)

        panel = pygame.Surface((420, 40), pygame.SRCALPHA)
        panel.fill((8, 10, 22, 200))
        surface.blit(panel, (self.build_x, WINDOW_HEIGHT - 42))
        pygame.draw.rect(surface, COLORS['panel_border'],
                         (self.build_x, WINDOW_HEIGHT - 42, 420, 40), 1)

        twr = (total_thrust / (total_mass * 9.81)) if total_mass > 0 and total_thrust > 0 else 0
        parts_count = len(self.placed_parts)

        texts = [
            f'Mass: {total_mass:.1f}t',
            f'Fuel: {total_fuel:.0f}t',
            f'Thrust: {total_thrust:.0f}kN',
            f'TWR: {twr:.2f}',
            f'Parts: {parts_count}',
        ]
        for i, t in enumerate(texts):
            tx = self.build_x + 10 + i * 82
            c = COLORS['green'] if 'TWR' in t and twr < 1 else COLORS['hud_value']
            if 'TWR' in t:
                c = COLORS['hud_warn'] if twr < 1.1 and twr > 0 else COLORS['green'] if twr >= 1.1 else c
            draw_text(surface, t, 12, tx + 40, WINDOW_HEIGHT - 22, c)
