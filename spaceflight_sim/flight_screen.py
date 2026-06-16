import math
import random
import pygame
from .config import *
from .render_util import Camera, draw_circle, draw_text, draw_thrust_plume, draw_line, draw_starfield
from .physics import PhysicsState, update_physics, find_dominant_body, orbital_elements_from_state
from .vehicle import Vehicle

class FlightScreen:
    def __init__(self, game):
        self.game = game
        self.camera = Camera()
        self.physics = PhysicsState()
        self.vehicle = None
        self.bodies = None

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

        if self.current_body and self.orbit_path:
            self._draw_orbit_path(surface)

        if self.show_hud:
            if self.crashed:
                self._draw_crash_screen(surface)
            else:
                self._draw_hud(surface)
                self._draw_staging(surface)

    def _draw_body(self, surface):
        body = self.current_body
        sx, sy = self.camera.world_to_screen(body.x, body.y)
        radius = self.camera.world_length(body.radius)

        if radius > 2:
            body_surf = pygame.Surface((max(2, radius * 2 + 4), max(2, radius * 2 + 4)), pygame.SRCALPHA)
            c = max(2, int(radius))
            pygame.draw.circle(body_surf, body.color, (c, c), c)
            if radius > 20:
                for i in range(6):
                    a = body.rotation_angle + i * math.pi / 3
                    ox = int(radius * 0.5 * math.cos(a))
                    oy = int(radius * 0.5 * math.sin(a))
                    lighter = (min(255, body.color[0] + 50), min(255, body.color[1] + 50), min(255, body.color[2] + 50))
                    pygame.draw.circle(body_surf, lighter, (c + ox, c + oy), max(2, radius // 10))
            surface.blit(body_surf, (sx - c, sy - c))

            if body.atm_height > 0 and radius > 5:
                atm_r = max(2, self.camera.world_length(body.radius + body.atm_height))
                atm_surf = pygame.Surface((atm_r * 2, atm_r * 2), pygame.SRCALPHA)
                pygame.draw.circle(atm_surf, (*body.color[:3], 18), (atm_r, atm_r), atm_r)
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
                            pygame.draw.rect(surface, (0, 100, 200), inner_rect)

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
        panel = pygame.Surface((270, 280), pygame.SRCALPHA)
        panel.fill((15, 15, 20, 200))
        surface.blit(panel, (8, 8))

        body_name = self.current_body.name if self.current_body else 'Unknown'
        alt_km = self.physics.altitude / 1000
        speed = math.hypot(
            self.physics.vx - (self.current_body.vx if self.current_body else 0),
            self.physics.vy - (self.current_body.vy if self.current_body else 0))

        lines = [
            f'ALT: {alt_km:.1f} km',
            f'SPD: {speed:.1f} m/s',
            f'THR: {self.throttle * 100:.0f}%',
            f'T+ : {self._format_time(self.mission_time)}',
            f'BODY: {body_name}',
        ]

        if self.elements:
            pe = self.elements.get('periapsis', 0) / 1000
            ap = self.elements.get('apoapsis', 0) / 1000
            if ap < 1e8:
                lines.append(f'Pe: {pe:.0f} km')
                lines.append(f'Ap: {ap:.0f} km')
            else:
                lines.append('ESCAPE TRAJECTORY')

        fuel_pct = 0
        if self.vehicle:
            tanks = [p for p in self.vehicle.all_parts if p.is_fuel_tank() and not p.stage_dropped]
            total_cap = sum(p.fuel_capacity for p in tanks)
            total_fuel = sum(p.fuel for p in tanks)
            fuel_pct = (total_fuel / total_cap * 100) if total_cap > 0 else 0

        for i, line in enumerate(lines):
            c = COLORS['yellow'] if any(line.startswith(x) for x in ('ALT', 'Pe', 'Ap')) else COLORS['white']
            draw_text(surface, line, 16, 140, 28 + i * 20, c)

        if fuel_pct > 0:
            fcolor = COLORS['green'] if fuel_pct > 30 else (COLORS['orange'] if fuel_pct > 10 else COLORS['red'])
            fuel_rect = pygame.Rect(12, 212, 190, 10)
            pygame.draw.rect(surface, COLORS['dark_grey'], fuel_rect)
            pygame.draw.rect(surface, fcolor, (12, 212, int(190 * fuel_pct / 100), 10))
            draw_text(surface, f'FUEL {fuel_pct:.0f}%', 12, 107, 220, COLORS['white'])

        rcs_text = f'RCS:{"ON" if self.rcs_active else "OFF"}'
        sas_text = f'SAS:{"ON" if self.sas_active else "OFF"}'
        warp_text = f'TIME x{self.time_warp}'

        right_x = WINDOW_WIDTH - 10
        draw_text(surface, sas_text, 13, right_x - 40, 25, COLORS['green'] if self.sas_active else COLORS['mid_grey'], center=False)
        draw_text(surface, rcs_text, 13, right_x - 40, 42, COLORS['green'] if self.rcs_active else COLORS['mid_grey'], center=False)
        draw_text(surface, warp_text, 13, right_x - 40, 59, COLORS['orange'], center=False)

        chute_deployed = any(p.deployed for p in self.vehicle.all_parts if p.is_parachute())
        legs_deployed = any(p.deployed for p in self.vehicle.all_parts if p.is_landing_leg())
        if chute_deployed:
            draw_text(surface, 'CHUTE:DEPLOYED', 12, right_x - 40, 80, COLORS['red'], center=False)
        if legs_deployed:
            draw_text(surface, 'LEGS:DEPLOYED', 12, right_x - 40, 95, COLORS['orange'], center=False)

    def _draw_staging(self, surface):
        if not self.vehicle:
            return
        stages = self.vehicle.stages
        if not stages:
            return

        panel_x = WINDOW_WIDTH - 155
        panel_y = WINDOW_HEIGHT - 40 - len(stages) * 24

        panel = pygame.Surface((150, 10 + len(stages) * 24), pygame.SRCALPHA)
        panel.fill((15, 15, 20, 190))
        surface.blit(panel, (panel_x, panel_y))

        draw_text(surface, 'STAGES', 12, panel_x + 75, panel_y + 8, COLORS['white'])

        for i, stage in enumerate(stages):
            y = panel_y + 24 + i * 24
            if stage.separated:
                color = COLORS['red_dim']
                label = f'[{i}] FIRED'
            elif stage.active:
                color = COLORS['green']
                label = f'[{i}] ACTIVE'
            else:
                color = COLORS['mid_grey']
                label = f'[{i}] READY'
            draw_text(surface, label, 12, panel_x + 75, y, color)

    def _draw_crash_screen(self, surface):
        overlay = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.SRCALPHA)
        overlay.fill((80, 10, 10, 120))
        surface.blit(overlay, (0, 0))

        cx = WINDOW_WIDTH // 2
        cy = WINDOW_HEIGHT // 2
        draw_text(surface, 'DESTROYED', 60, cx, cy - 40, COLORS['red'])
        draw_text(surface, 'Press ENTER to return to menu', 18, cx, cy + 20, COLORS['white'])
        draw_text(surface, f'Max altitude: {self.max_altitude / 1000:.1f} km', 16, cx, cy + 55, COLORS['light_grey'])
        draw_text(surface, f'Max speed: {self.max_speed:.0f} m/s', 16, cx, cy + 78, COLORS['light_grey'])
        draw_text(surface, f'Mission time: {self._format_time(self.mission_time)}', 16, cx, cy + 101, COLORS['light_grey'])

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
                draw_circle(surface, COLORS['white'], (sx, sy), radius + 3, 1)

            if radius > 5:
                draw_text(surface, body.name, 11, sx, sy + radius + 10, COLORS['white'])

        if self.physics:
            sx, sy = self.camera.world_to_screen(self.physics.x, self.physics.y)
            draw_circle(surface, COLORS['yellow'], (sx, sy), max(4, int(5 * self.camera.zoom * 1e6)))

            if self.orbit_path:
                points = []
                for wx, wy in self.orbit_path:
                    psx, psy = self.camera.world_to_screen(wx, wy)
                    if -10000 < psx < WINDOW_WIDTH + 10000 and -10000 < psy < WINDOW_HEIGHT + 10000:
                        points.append((psx, psy))
                if len(points) > 2:
                    pygame.draw.lines(surface, COLORS['green'], False, points, 2)

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
                panel.fill((10, 10, 15, 200))
                surface.blit(panel, (10, 10))
                for i, line in enumerate(info):
                    draw_text(surface, line, 14, 130, 20 + i * 20, COLORS['white'])

        draw_text(surface, 'MAP VIEW [TAB]', 14, WINDOW_WIDTH // 2, 12, COLORS['light_grey'])

    def _format_time(self, seconds):
        if seconds < 60:
            return f'{seconds:.0f}s'
        elif seconds < 3600:
            return f'{int(seconds // 60)}m {int(seconds % 60)}s'
        elif seconds < 86400:
            h = int(seconds // 3600)
            m = int((seconds % 3600) // 60)
            return f'{h}h {m}m'
        else:
            d = int(seconds // 86400)
            h = int((seconds % 86400) // 3600)
            return f'{d}d {h}h'
