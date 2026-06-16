import math
import random
import pygame
from .config import *
from .render_util import Camera, draw_circle, draw_text, draw_thrust_plume, draw_line, draw_starfield, ParticleSystem
from .physics import PhysicsState, update_physics, find_dominant_body, orbital_elements_from_state
from .vehicle import Vehicle


class FlightScreen:
    def __init__(self, game):
        self.game = game
        self.camera = Camera()
        self.physics = PhysicsState()
        self.vehicle = None
        self.bodies = None
        self.particle_system = ParticleSystem()

        self.throttle = 0.0
        self.target_throttle = 0.0
        self.sas_active = False
        self.rcs_active = False
        self.control_input = 0.0
        self.w_key_held = False
        self.s_key_held = False

        self.time_warp = 1
        self.warp_indices = [1, 2, 5, 10, 50, 100, 1000, 10000]
        self.warp_index = 0

        self.stars = [(random.uniform(-1e12, 1e12), random.uniform(-1e12, 1e12),
                       random.uniform(0.3, 1.0)) for _ in range(300)]
        self.time = 0.0

        self.elements = None
        self.orbit_path = []
        self.map_mode = False

        self.mission_time = 0.0
        self.max_altitude = 0.0
        self.max_speed = 0.0
        self.show_hud = True
        self.flight_log = []
        self.current_body = None
        self.parachute_deployed = False
        self.landing_legs_deployed = False
        self.crashed = False

    def start(self, placed_parts):
        self.bodies = self.game.bodies
        self.crashed = False
        self.parachute_deployed = False
        self.landing_legs_deployed = False

        self.vehicle = Vehicle()
        part_types = [p['type'] for p in placed_parts]
        self.vehicle.build_from_parts(part_types)

        earth = self.bodies[EARTH]

        self.physics.x = earth.x
        self.physics.y = earth.y + earth.radius + 5.0
        self.physics.vx = earth.vx
        self.physics.vy = earth.vy
        self.physics.angle = math.pi / 2
        self.physics.angular_vel = 0.0
        self.physics.body = earth
        self.physics.mass = self.vehicle.get_active_mass()
        self.physics.altitude = 5.0
        self.physics.throttle = 0.0

        self.camera.set_target(self.physics.x, self.physics.y)
        self.camera.zoom = 0.003

        self.throttle = 0.0
        self.target_throttle = 0.0
        self.w_key_held = False
        self.s_key_held = False
        self.time_warp = 1
        self.warp_index = 0
        self.mission_time = 0.0
        self.max_altitude = 0.0
        self.max_speed = 0.0
        self.current_body = earth
        self.flight_log = []
        self.map_mode = False

    def handle_event(self, event):
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_TAB:
                self.map_mode = not self.map_mode
                if self.map_mode:
                    self.camera.zoom = max(self.camera.zoom, 1e-7)
            if event.key == pygame.K_SPACE and not self.map_mode:
                if self.vehicle:
                    success = self.vehicle.stage()
                    if success:
                        self.flight_log.append(f'Stage {self.vehicle.current_stage_index}: Fired')
            if event.key == pygame.K_w and not self.map_mode:
                self.w_key_held = True
                self.target_throttle = min(1.0, self.target_throttle + 0.05)
            if event.key == pygame.K_s and not self.map_mode:
                self.s_key_held = True
                self.target_throttle = max(0.0, self.target_throttle - 0.05)
            if event.key == pygame.K_t and not self.map_mode:
                self.warp_index = min(len(self.warp_indices) - 1, self.warp_index + 1)
                self.time_warp = self.warp_indices[self.warp_index]
            if event.key == pygame.K_y and not self.map_mode:
                self.warp_index = max(0, self.warp_index - 1)
                self.time_warp = self.warp_indices[self.warp_index]
            if event.key == pygame.K_f:
                self.sas_active = not self.sas_active
            if event.key == pygame.K_r:
                self.rcs_active = not self.rcs_active
            if event.key == pygame.K_h:
                self.show_hud = not self.show_hud
            if event.key == pygame.K_ESCAPE and not self.crashed:
                self.game.screen = 'menu'
            if event.key == pygame.K_p and not self.map_mode:
                self._deploy_parachute()
            if event.key == pygame.K_l and not self.map_mode:
                self._deploy_landing_legs()
            if event.key in (pygame.K_LEFT, pygame.K_a):
                self.control_input = -1.0
            if event.key in (pygame.K_RIGHT, pygame.K_d):
                self.control_input = 1.0
            if event.key == pygame.K_RETURN and self.crashed:
                self.game.screen = 'menu'

        if event.type == pygame.KEYUP:
            if event.key in (pygame.K_LEFT, pygame.K_a) and self.control_input < 0:
                self.control_input = 0.0
            if event.key in (pygame.K_RIGHT, pygame.K_d) and self.control_input > 0:
                self.control_input = 0.0
            if event.key == pygame.K_w:
                self.w_key_held = False
                if not self.s_key_held:
                    self.target_throttle = 0.0
            if event.key == pygame.K_s:
                self.s_key_held = False
                if not self.w_key_held:
                    self.target_throttle = 0.0

        if event.type == pygame.MOUSEWHEEL:
            factor = 1.1 if event.y > 0 else 0.9
            if self.map_mode:
                self.camera.zoom = max(1e-12, min(self.camera.zoom * factor, 1e8))
            else:
                self.camera.zoom = max(1e-12, min(self.camera.zoom * factor, 1.0))

        return False

    def _deploy_parachute(self):
        if self.parachute_deployed:
            return
        has_chute = any(p.is_parachute() and not p.decouple_fired for p in self.vehicle.all_parts)
        if has_chute:
            self.parachute_deployed = True
            for p in self.vehicle.all_parts:
                if p.is_parachute():
                    p.deployed = True
            self.flight_log.append('Parachute deployed')

    def _deploy_landing_legs(self):
        if self.landing_legs_deployed:
            return
        has_legs = any(p.is_landing_leg() and not p.decouple_fired for p in self.vehicle.all_parts)
        if has_legs:
            self.landing_legs_deployed = True
            for p in self.vehicle.all_parts:
                if p.is_landing_leg():
                    p.deployed = True
            self.flight_log.append('Landing legs deployed')

    def update(self, dt):
        self.time += dt
        effective_dt = dt * self.time_warp
        if self.time_warp == 1:
            self.particle_system.update(effective_dt)

        if self.time_warp > 100 and self.physics.altitude < 100000:
            self.time_warp = 100
            self.warp_index = self.warp_indices.index(100) if 100 in self.warp_indices else 4
        if self.time_warp > 1 and self.physics.altitude < 50000:
            self.time_warp = 1
            self.warp_index = 0

        for body in self.bodies.values():
            body.update(effective_dt)

        if self.vehicle and self.physics.body and not self.crashed:
            self._update_vehicle(effective_dt)
            self._update_orbit_elements()

        self.physics.altitude = self.physics.altitude_above(self.physics.body)
        self.max_altitude = max(self.max_altitude, self.physics.altitude)
        speed = math.hypot(self.physics.vx, self.physics.vy)
        self.max_speed = max(self.max_speed, speed)
        self.mission_time += effective_dt

        body = find_dominant_body(self.physics, self.bodies)
        if body != self.current_body:
            self.flight_log.append(f'Entered {body.name} SOI')
        self.current_body = body
        if self.physics.body != body:
            self.physics.body = body

        if self.map_mode:
            self._update_map_camera()
        else:
            self.camera.set_target(self.physics.x, self.physics.y)

        if self.physics.altitude < 0:
            self.physics.altitude = 0
            rel_vx = self.physics.vx - self.physics.body.vx
            rel_vy = self.physics.vy - self.physics.body.vy
            impact_speed = math.hypot(rel_vx, rel_vy)

            if impact_speed < 5:
                self.physics.vx = self.physics.body.vx
                self.physics.vy = self.physics.body.vy
                self.physics.angular_vel = 0
            elif impact_speed > 20:
                if not self.crashed:
                    self.crashed = True
                    self.flight_log.append(f'CRASH! Impact speed: {impact_speed:.0f} m/s')
                    self.camera.zoom = max(self.camera.zoom * 0.5, 0.001)
            else:
                self.physics.vx = self.physics.body.vx
                self.physics.vy = self.physics.body.vy
                self.physics.angular_vel *= 0.5

        if self.parachute_deployed:
            drag_force = 2000.0 * self.physics.body.atm_density_at(self.physics.altitude)
            if drag_force > 0:
                rel_vx = self.physics.vx - self.physics.body.vx
                rel_vy = self.physics.vy - self.physics.body.vy
                v = math.hypot(rel_vx, rel_vy)
                if v > 2:
                    drag_x = -rel_vx / v * drag_force / max(self.physics.mass, 1)
                    drag_y = -rel_vy / v * drag_force / max(self.physics.mass, 1)
                    self.physics.vx += drag_x * effective_dt
                    self.physics.vy += drag_y * effective_dt

        self.throttle += (self.target_throttle - self.throttle) * 0.1

    def _update_vehicle(self, dt):
        if not self.vehicle:
            return

        engine_thrust = self.vehicle.total_thrust(self.throttle)
        self.physics.mass = self.vehicle.get_active_mass()

        angle = self.physics.angle

        if self.sas_active and abs(self.control_input) < 0.1:
            vel_angle = math.atan2(self.physics.vy, self.physics.vx)
            target = vel_angle + math.pi / 2 if abs(self.physics.vx) + abs(self.physics.vy) > 1 else math.pi / 2
            diff = target - angle
            while diff > math.pi: diff -= 2 * math.pi
            while diff < -math.pi: diff += 2 * math.pi
            self.control_input = max(-1, min(1, diff * 3))

        torque = self.vehicle.get_attitude_torque(self.control_input)
        self.physics.angular_vel += torque * dt / max(self.physics.mass * 1000, 1)
        self.physics.angular_vel *= 0.97
        angle += self.physics.angular_vel * dt
        self.physics.angle = angle

        self.vehicle.consume_fuel(dt, self.throttle)

        thrust_x = engine_thrust * 1000 * math.cos(angle)
        thrust_y = engine_thrust * 1000 * math.sin(angle)

        if engine_thrust > 0 and self.throttle > 0 and self.time_warp == 1:
            amount = max(1, int(2 * self.throttle * engine_thrust / 100))
            for _ in range(amount):
                ex = -math.cos(angle)
                ey = -math.sin(angle)
                px = self.physics.x + random.uniform(-0.5, 0.5)
                py = self.physics.y + random.uniform(-0.5, 0.5)
                pvx = self.physics.vx + ex * random.uniform(10, 30) + random.uniform(-2, 2)
                pvy = self.physics.vy + ey * random.uniform(10, 30) + random.uniform(-2, 2)
                color = (255, random.randint(180, 220), random.randint(100, 150), 200)
                self.particle_system.emit(px, py, pvx, pvy, random.uniform(0.5, 1.2), color, random.uniform(0.5, 2), growth=1.5)

        self.physics.substep_thrust = engine_thrust
        update_physics(self.physics, (thrust_x, thrust_y, torque), self.bodies, dt)

    def _update_orbit_elements(self):
        if not self.current_body:
            return
        self.elements = orbital_elements_from_state(self.physics, self.current_body)
        from .physics import compute_orbit_path
        self.orbit_path = compute_orbit_path(self.elements)

    def _update_map_camera(self):
        if self.current_body:
            self.camera.set_target(self.current_body.x, self.current_body.y)

    def draw(self, surface):
        if self.map_mode:
            self._draw_map_view(surface)
        else:
            self._draw_flight_view(surface)

    def _draw_flight_view(self, surface):
        surface.fill(COLORS['space_bg'])
        draw_starfield(surface, self.stars, self.camera, WINDOW_WIDTH, WINDOW_HEIGHT)

        if self.current_body:
            self._draw_body(surface)

        if self.vehicle and not self.crashed:
            self._draw_vehicle(surface)
            self._draw_thrust(surface)
            if self.parachute_deployed:
                self._draw_parachute(surface)
            if self.landing_legs_deployed:
                self._draw_landing_legs(surface)

        self.particle_system.draw(surface, self.camera)

        if self.current_body and self.orbit_path:
            self._draw_orbit_path(surface)

        if self.show_hud:
            if self.crashed:
                self._draw_crash_screen(surface)
            else:
                self._draw_hud(surface)

    def _draw_body(self, surface):
        body = self.current_body
        sx, sy = self.camera.world_to_screen(body.x, body.y)
        radius = self.camera.world_length(body.radius)

        if radius > 2:
            body_surf = pygame.Surface((max(2, radius * 2 + 4), max(2, radius * 2 + 4)), pygame.SRCALPHA)
            c = max(2, int(radius))
            pygame.draw.circle(body_surf, body.color, (c, c), c)
            if radius > 10:
                random.seed(hash(body.name))
                for _ in range(int(min(50, radius // 2))):
                    a = body.rotation_angle + random.uniform(0, 2 * math.pi)
                    dist = random.uniform(0, 0.9)
                    ox = int(radius * dist * math.cos(a))
                    oy = int(radius * dist * math.sin(a))
                    size = max(1, int(radius * random.uniform(0.02, 0.15)))
                    shade = random.randint(-30, 30)
                    rc = (max(0, min(255, body.color[0] + shade)),
                          max(0, min(255, body.color[1] + shade)),
                          max(0, min(255, body.color[2] + shade)))
                    pygame.draw.circle(body_surf, rc, (c + ox, c + oy), size)
                random.seed()
            surface.blit(body_surf, (sx - c, sy - c))

            if body.atm_height > 0 and radius > 5:
                atm_r = max(2, self.camera.world_length(body.radius + body.atm_height))
                atm_surf = pygame.Surface((atm_r * 2, atm_r * 2), pygame.SRCALPHA)
                for i in range(10, 0, -1):
                    frac = i / 10.0
                    r_layer = int(radius + (atm_r - radius) * frac)
                    alpha = int(60 * (1.0 - frac)**2)
                    pygame.draw.circle(atm_surf, (*body.color[:3], alpha), (atm_r, atm_r), r_layer)
                surface.blit(atm_surf, (sx - atm_r, sy - atm_r))
        else:
            draw_circle(surface, body.color, (sx, sy), max(2, radius))

    def _draw_vehicle(self, surface):
        if not self.vehicle or not self.vehicle.all_parts:
            return

        sx, sy = self.camera.world_to_screen(self.physics.x, self.physics.y)
        zoom = self.camera.zoom

        if zoom < 1e-8:
            return

        part_height = 12 * zoom
        part_width = 10 * zoom

        angle = self.physics.angle
        cos_a = math.cos(angle - math.pi / 2)
        sin_a = math.sin(angle - math.pi / 2)

        active_parts = [p for p in self.vehicle.all_parts if not p.decouple_fired and not p.stage_dropped]

        total_height = sum(max(3, p.height * part_height) for p in reversed(active_parts))
        base_y = 0

        for part in reversed(active_parts):
            pw = max(4, part.width * part_width)
            ph = max(4, part.height * part_height)

            hw = pw / 2
            hh = ph / 2

            local_y = base_y + hh

            corners = []
            for lx, ly in [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]:
                wx = lx * cos_a - ly * sin_a
                wy = lx * sin_a + ly * cos_a
                corners.append((int(sx + wx - (total_height - base_y - hh) * sin_a),
                               int(sy - wy + (total_height - base_y - hh) * cos_a)))

            base_y += ph

            if len(corners) >= 4:
                pygame.draw.polygon(surface, part.color, corners)
                
                p1, p2, p3, p4 = corners[0], corners[1], corners[2], corners[3]
                dark_color = (max(0, part.color[0] - 40), max(0, part.color[1] - 40), max(0, part.color[2] - 40))
                right_poly = [
                    (p1[0]*0.5 + p2[0]*0.5, p1[1]*0.5 + p2[1]*0.5), p2, p3,
                    (p4[0]*0.5 + p3[0]*0.5, p4[1]*0.5 + p3[1]*0.5)
                ]
                pygame.draw.polygon(surface, dark_color, right_poly)
                
                light_color = (min(255, part.color[0] + 40), min(255, part.color[1] + 40), min(255, part.color[2] + 40))
                left_poly = [
                    p1, (p1[0]*0.8 + p2[0]*0.2, p1[1]*0.8 + p2[1]*0.2),
                    (p4[0]*0.8 + p3[0]*0.2, p4[1]*0.8 + p3[1]*0.2), p4
                ]
                pygame.draw.polygon(surface, light_color, left_poly)
                
                pygame.draw.polygon(surface, COLORS['panel_border'], corners, 1)

                if part.is_fuel_tank() and part.fuel_capacity > 0:
                    fuel_ratio = part.fuel / max(part.fuel_capacity, 0.001)
                    if fuel_ratio > 0:
                        inner_rect = pygame.Rect(
                            corners[0][0] + 2, corners[0][1] + 2,
                            abs(corners[2][0] - corners[0][0]) - 4,
                            int((corners[2][1] - corners[0][1]) * fuel_ratio) - 4
                        )
                        if inner_rect.w > 2 and inner_rect.h > 2:
                            pygame.draw.rect(surface, (80, 100, 140), inner_rect)

    def _draw_thrust(self, surface):
        if not self.vehicle or self.throttle <= 0:
            return
        engines = self.vehicle.get_active_engines()
        if not engines:
            return
        sx, sy = self.camera.world_to_screen(self.physics.x, self.physics.y)
        zoom = self.camera.zoom
        total_thrust = sum(e.thrust * e.throttle * self.throttle for e in engines)
        draw_thrust_plume(surface, sx, sy, self.physics.angle, total_thrust, zoom)

    def _draw_parachute(self, surface):
        sx, sy = self.camera.world_to_screen(self.physics.x, self.physics.y)
        zoom = self.camera.zoom
        offset = 30 * zoom
        px = int(sx)
        py = int(sy - offset)

        chute_color = (255, 100, 100)
        r = int(20 * zoom)
        if r < 3:
            return
        draw_circle(surface, chute_color, (px, py), r)
        draw_circle(surface, (255, 200, 200), (px, py), r - 2)
        for i in range(6):
            a = i * math.pi / 3
            lx = int(px + r * 0.8 * math.cos(a))
            ly = int(py + r * 0.8 * math.sin(a))
            draw_line(surface, (200, 200, 200), (px, py), (lx, ly), 1)

    def _draw_landing_legs(self, surface):
        sx, sy = self.camera.world_to_screen(self.physics.x, self.physics.y)
        zoom = self.camera.zoom
        leg_len = int(20 * zoom)
        if leg_len < 3:
            return
        for side in [-1, 1]:
            ex = int(sx + side * 12 * zoom)
            ey = int(sy + leg_len)
            draw_line(surface, (150, 130, 100), (sx, sy), (ex, ey), max(1, int(3 * zoom)))
            draw_line(surface, (150, 130, 100), (ex, ey), (int(ex + side * 6 * zoom), ey), max(1, int(2 * zoom)))

    def _draw_orbit_path(self, surface):
        if not self.orbit_path or len(self.orbit_path) < 3:
            return
        points = []
        for wx, wy in self.orbit_path:
            sx, sy = self.camera.world_to_screen(wx, wy)
            if -10000 < sx < WINDOW_WIDTH + 10000 and -10000 < sy < WINDOW_HEIGHT + 10000:
                points.append((sx, sy))
        if len(points) > 2:
            pygame.draw.lines(surface, COLORS['green_dim'], False, points, 1)

    def _draw_hud(self, surface):
        self._draw_telemetry_panel(surface)
        self._draw_fuel_bar(surface)
        self._draw_staging_panel(surface)
        self._draw_status_indicators(surface)

    def _draw_telemetry_panel(self, surface):
        pw, ph = 190, 170
        px, py = 10, 10
        panel = pygame.Surface((pw, ph), pygame.SRCALPHA)
        panel.fill((25, 30, 45, 160))
        pygame.draw.rect(panel, (255, 255, 255, 30), panel.get_rect(), 1, border_radius=6)
        surface.blit(panel, (px, py))

        speed = math.hypot(
            self.physics.vx - (self.current_body.vx if self.current_body else 0),
            self.physics.vy - (self.current_body.vy if self.current_body else 0))
        alt_km = self.physics.altitude / 1000

        alt_color = COLORS['hud_warn']
        alt_text = f'{alt_km:.2f}' if alt_km < 100 else f'{alt_km:.0f}'
        alt_unit = 'km' if alt_km >= 1 else 'm'
        alt_val = self.physics.altitude if alt_km < 1 else alt_km

        draw_text(surface, 'ALT', 13, px + 22, py + 12, COLORS['hud_label'])
        if alt_km < 1:
            draw_text(surface, f'{self.physics.altitude:.0f}', 28, px + 22, py + 38, alt_color)
            draw_text(surface, 'm', 13, px + 70, py + 32, COLORS['hud_label'])
        else:
            draw_text(surface, f'{alt_km:.2f}', 28, px + 22, py + 38, alt_color)
            draw_text(surface, 'km', 13, px + 80, py + 32, COLORS['hud_label'])

        draw_text(surface, 'SPD', 13, px + 22, py + 72, COLORS['hud_label'])
        draw_text(surface, f'{speed:.1f}', 22, px + 22, py + 95, COLORS['hud_value'])
        draw_text(surface, 'm/s', 11, px + 70, py + 90, COLORS['hud_label'])

        throttle_pct = self.throttle * 100
        draw_text(surface, 'THR', 13, px + 22, py + 128, COLORS['hud_label'])
        bar_w = 120
        bar_h = 8
        bar_x = px + 50
        bar_y = py + 130
        pygame.draw.rect(surface, COLORS['fuel_bar_bg'], (bar_x, bar_y, bar_w, bar_h))
        fill_w = int(bar_w * self.throttle)
        if fill_w > 0:
            tc = COLORS['orange'] if throttle_pct < 50 else COLORS['yellow']
            pygame.draw.rect(surface, tc, (bar_x, bar_y, fill_w, bar_h))
        draw_text(surface, f'{throttle_pct:.0f}%', 11, bar_x + bar_w + 28, bar_y + 4, COLORS['hud_value'])

        if self.elements:
            pe = self.elements.get('periapsis', 0)
            ap = self.elements.get('apoapsis', 0)
            el_y = py + ph + 5

            if ap < 1e8:
                info_panel = pygame.Surface((pw, 50), pygame.SRCALPHA)
                info_panel.fill((8, 10, 22, 200))
                surface.blit(info_panel, (px, el_y))
                pygame.draw.rect(surface, COLORS['panel_border'], (px, el_y, pw, 50), 1, border_radius=4)

                pe_km = pe / 1000
                ap_km = ap / 1000
                draw_text(surface, 'Pe', 12, px + 22, el_y + 12, COLORS['hud_warn'])
                draw_text(surface, f'{pe_km:.1f} km', 16, px + 22, el_y + 32, COLORS['hud_value'])
                draw_text(surface, 'Ap', 12, px + pw // 2 + 10, el_y + 12, COLORS['hud_warn'])
                draw_text(surface, f'{ap_km:.1f} km', 16, px + pw // 2 + 10, el_y + 32, COLORS['hud_value'])
            else:
                info_panel = pygame.Surface((pw, 28), pygame.SRCALPHA)
                info_panel.fill((8, 10, 22, 200))
                surface.blit(info_panel, (px, el_y))
                pygame.draw.rect(surface, COLORS['panel_border'], (px, el_y, pw, 28), 1, border_radius=4)
                draw_text(surface, 'ESCAPE', 14, px + pw // 2, el_y + 14, COLORS['hud_warn'])

    def _draw_fuel_bar(self, surface):
        pw, ph = 190, 30
        px, py = 10, WINDOW_HEIGHT - ph - 10
        panel = pygame.Surface((pw, ph), pygame.SRCALPHA)
        panel.fill((25, 30, 45, 160))
        pygame.draw.rect(panel, (255, 255, 255, 30), panel.get_rect(), 1, border_radius=6)
        surface.blit(panel, (px, py))

        fuel_pct = 0
        if self.vehicle:
            tanks = [p for p in self.vehicle.all_parts if p.is_fuel_tank() and not p.stage_dropped]
            total_cap = sum(p.fuel_capacity for p in tanks)
            total_fuel = sum(p.fuel for p in tanks)
            fuel_pct = (total_fuel / total_cap * 100) if total_cap > 0 else 0

        draw_text(surface, 'FUEL', 12, px + 22, py + ph // 2, COLORS['hud_label'])
        bar_w = 100
        bar_h = 12
        bar_x = px + 48
        bar_y = py + ph // 2 - bar_h // 2
        pygame.draw.rect(surface, COLORS['fuel_bar_bg'], (bar_x, bar_y, bar_w, bar_h))
        if fuel_pct > 0:
            fill_w = int(bar_w * fuel_pct / 100)
            fc = COLORS['fuel_bar_fill'] if fuel_pct > 20 else COLORS['hud_danger']
            pygame.draw.rect(surface, fc, (bar_x, bar_y, fill_w, bar_h))
        draw_text(surface, f'{fuel_pct:.0f}%', 11, bar_x + bar_w + 24, py + ph // 2, COLORS['hud_value'])

    def _draw_staging_panel(self, surface):
        if not self.vehicle or not self.vehicle.stages:
            return

        stages = self.vehicle.stages
        spw = 140
        sph = 30 + len(stages) * 28
        spx = WINDOW_WIDTH - spw - 10
        spy = WINDOW_HEIGHT - sph - 10

        panel = pygame.Surface((spw, sph), pygame.SRCALPHA)
        panel.fill((25, 30, 45, 160))
        pygame.draw.rect(panel, (255, 255, 255, 30), panel.get_rect(), 1, border_radius=6)
        surface.blit(panel, (spx, spy))

        draw_text(surface, 'STAGES', 11, spx + spw // 2, spy + 10, COLORS['cyan'])

        node_x = spx + 25
        for i, stage in enumerate(stages):
            y = spy + 28 + i * 28
            color = COLORS['green'] if stage.active else (COLORS['mid_grey'] if not stage.separated else COLORS['red_dim'])
            label = 'ACTIVE' if stage.active else ('READY' if not stage.separated else 'FIRED')

            draw_circle(surface, color, (node_x, y), 5)
            draw_text(surface, f'STAGE {i + 1}', 10, node_x + 14, y - 4, COLORS['hud_value'], center=False)
            draw_text(surface, label, 9, node_x + 14, y + 8, color, center=False)

            if i < len(stages) - 1:
                draw_line(surface, COLORS['mid_grey'], (node_x, y + 5), (node_x, y + 23), 1)

    def _draw_status_indicators(self, surface):
        right_x = WINDOW_WIDTH - 12

        sas_color = COLORS['green'] if self.sas_active else COLORS['mid_grey']
        rcs_color = COLORS['green'] if self.rcs_active else COLORS['mid_grey']

        sas_rect = pygame.Rect(right_x - 110, 10, 55, 20)
        rcs_rect = pygame.Rect(right_x - 55, 10, 55, 20)

        pygame.draw.rect(surface, COLORS['panel'], sas_rect, border_radius=3)
        pygame.draw.rect(surface, COLORS['panel_border'], sas_rect, 1, border_radius=3)
        pygame.draw.circle(surface, sas_color, (right_x - 98, 20), 4)
        draw_text(surface, 'SAS', 10, right_x - 86, 20, COLORS['white'])

        pygame.draw.rect(surface, COLORS['panel'], rcs_rect, border_radius=3)
        pygame.draw.rect(surface, COLORS['panel_border'], rcs_rect, 1, border_radius=3)
        pygame.draw.circle(surface, rcs_color, (right_x - 43, 20), 4)
        draw_text(surface, 'RCS', 10, right_x - 31, 20, COLORS['white'])

        warp_text = f'{self.time_warp}x'
        draw_text(surface, warp_text, 11, right_x - 55, 38, COLORS['orange'])

        body_name = self.current_body.name if self.current_body else '?'
        draw_text(surface, body_name, 11, right_x - 55, 55, COLORS['light_grey'])

        if self.parachute_deployed:
            draw_text(surface, 'CHUTE', 10, right_x - 55, 72, COLORS['hud_danger'])
        if self.landing_legs_deployed:
            draw_text(surface, 'LEGS', 10, right_x - 55, 86, COLORS['orange'])

        mission_text = self._format_time(self.mission_time)
        draw_text(surface, mission_text, 11, right_x - 55, WINDOW_HEIGHT - 20, COLORS['light_grey'])

    def _draw_crash_screen(self, surface):
        overlay = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.SRCALPHA)
        overlay.fill((60, 8, 8, 160))
        surface.blit(overlay, (0, 0))

        cx = WINDOW_WIDTH // 2
        cy = WINDOW_HEIGHT // 2
        draw_text(surface, 'DESTROYED', 60, cx, cy - 50, COLORS['hud_danger'])
        draw_text(surface, 'Press ENTER to return to menu', 18, cx, cy + 15, COLORS['white'])
        draw_text(surface, f'Max altitude: {self.max_altitude / 1000:.1f} km', 16, cx, cy + 50, COLORS['light_grey'])
        draw_text(surface, f'Max speed: {self.max_speed:.0f} m/s', 16, cx, cy + 73, COLORS['light_grey'])
        draw_text(surface, f'Mission time: {self._format_time(self.mission_time)}', 16, cx, cy + 96, COLORS['light_grey'])

    def _draw_map_view(self, surface):
        surface.fill(COLORS['space_bg'])
        draw_starfield(surface, self.stars, self.camera, WINDOW_WIDTH, WINDOW_HEIGHT)

        for body in self.bodies.values():
            sx, sy = self.camera.world_to_screen(body.x, body.y)
            radius = max(3, self.camera.world_length(body.radius))
            draw_circle(surface, body.color, (sx, sy), radius)

            if body.parent:
                px, py = self.camera.world_to_screen(body.parent.x, body.parent.y)
                draw_line(surface, COLORS['dark_grey'], (px, py), (sx, sy), 1)

            if body == self.current_body:
                draw_circle(surface, COLORS['cyan'], (sx, sy), radius + 3, 1)

            if radius > 5:
                draw_text(surface, body.name, 11, sx, sy + radius + 10, COLORS['white'])

        if self.physics:
            sx, sy = self.camera.world_to_screen(self.physics.x, self.physics.y)
            draw_circle(surface, COLORS['yellow'], (sx, sy), max(4, int(5 * self.camera.zoom * 1e6)))

            if self.orbit_path:
                points = []
                pe_pt = None
                ap_pt = None
                min_d = float('inf')
                max_d = 0
                for wx, wy in self.orbit_path:
                    d = math.hypot(wx - self.current_body.x, wy - self.current_body.y)
                    if d < min_d: min_d = d; pe_pt = (wx, wy)
                    if d > max_d: max_d = d; ap_pt = (wx, wy)
                    psx, psy = self.camera.world_to_screen(wx, wy)
                    if -10000 < psx < WINDOW_WIDTH + 10000 and -10000 < psy < WINDOW_HEIGHT + 10000:
                        points.append((psx, psy))
                if len(points) > 2:
                    pygame.draw.lines(surface, COLORS['green'], False, points, 2)
                
                if self.elements and pe_pt and ap_pt:
                    ap_val = self.elements.get('apoapsis', 0)
                    if ap_val < 1e8:
                        apx, apy = self.camera.world_to_screen(*ap_pt)
                        draw_circle(surface, COLORS['hud_warn'], (apx, apy), 3)
                        draw_text(surface, f'Ap', 12, apx, apy - 10, COLORS['hud_warn'])
                    pex, pey = self.camera.world_to_screen(*pe_pt)
                    draw_circle(surface, COLORS['hud_warn'], (pex, pey), 3)
                    draw_text(surface, f'Pe', 12, pex, pey - 10, COLORS['hud_warn'])

            if self.elements:
                pe = self.elements.get('periapsis', 0) / 1000
                ap = self.elements.get('apoapsis', 0) / 1000
                info = [
                    f'Body: {self.current_body.name if self.current_body else "?"}',
                    f'Alt: {self.physics.altitude / 1000:.1f} km',
                    f'Speed: {math.hypot(self.physics.vx, self.physics.vy):.1f} m/s',
                ]
                if ap < 1e8:
                    info.append(f'Pe: {pe:.0f} km  Ap: {ap:.0f} km')
                else:
                    info.append('Hyperbolic trajectory')

                panel = pygame.Surface((240, 12 + len(info) * 20), pygame.SRCALPHA)
                panel.fill((8, 10, 22, 200))
                surface.blit(panel, (10, 10))
                pygame.draw.rect(surface, COLORS['panel_border'], (10, 10, 240, 12 + len(info) * 20), 1)
                for i, line in enumerate(info):
                    draw_text(surface, line, 14, 130, 20 + i * 20, COLORS['white'])

        draw_text(surface, 'MAP VIEW [TAB]', 14, WINDOW_WIDTH // 2, 12, COLORS['light_grey'])

    def _format_time(self, seconds):
        if seconds < 60:
            return f'T+{seconds:.0f}s'
        elif seconds < 3600:
            return f'T+{int(seconds // 60)}m {int(seconds % 60)}s'
        elif seconds < 86400:
            h = int(seconds // 3600)
            m = int((seconds % 3600) // 60)
            return f'T+{h}h {m}m'
        else:
            d = int(seconds // 86400)
            h = int((seconds % 86400) // 3600)
            return f'T+{d}d {h}h'
