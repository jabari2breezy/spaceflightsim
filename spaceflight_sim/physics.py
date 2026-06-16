import math
from .config import G, PHYSICS_DT, SUBSTEPS, EARTH

class PhysicsState:
    def __init__(self):
        self.x = 0.0
        self.y = 0.0
        self.vx = 0.0
        self.vy = 0.0
        self.angle = 0.0
        self.angular_vel = 0.0
        self.mass = 0.0
        self.thrust = 0.0
        self.throttle = 1.0
        self.body = None
        self.altitude = 0.0
        self.latitude = 0.0
        self.longitude = 0.0
        self.substep_thrust = 0.0

    def altitude_above(self, body):
        dx = self.x - body.x
        dy = self.y - body.y
        dist = math.hypot(dx, dy)
        return max(0, dist - body.radius)

    def distance_to(self, body):
        return math.hypot(self.x - body.x, self.y - body.y)


def calculate_gravity(physics, bodies):
    fx = 0.0
    fy = 0.0
    mass_kg = physics.mass * 1000
    for body in bodies.values():
        dx = body.x - physics.x
        dy = body.y - physics.y
        dist_sq = dx * dx + dy * dy
        dist = math.sqrt(dist_sq)
        if dist < 1:
            continue
        force_mag = G * body.mass * mass_kg / dist_sq
        fx += force_mag * dx / dist
        fy += force_mag * dy / dist
    return fx, fy


def calculate_drag(physics, body):
    rel_vx = physics.vx - body.vx
    rel_vy = physics.vy - body.vy
    v = math.hypot(rel_vx, rel_vy)
    if v < 0.1:
        return 0.0, 0.0
    alt = physics.altitude
    if alt > body.atm_height:
        return 0.0, 0.0
    density = body.atm_density_at(alt)
    if density <= 0:
        return 0.0, 0.0
    drag_coeff = 0.35
    area = 1.0
    drag_mag = 0.5 * density * v * v * drag_coeff * area
    drag_mag = min(drag_mag, 5e6)
    v_angle = math.atan2(rel_vy, rel_vx)
    return -drag_mag * math.cos(v_angle), -drag_mag * math.sin(v_angle)


def update_physics(physics, thrust_force, bodies, dt):
    fx, fy = calculate_gravity(physics, bodies)
    dx, dy = 0.0, 0.0
    if physics.body:
        dx, dy = calculate_drag(physics, physics.body)
    fx += dx + thrust_force[0]
    fy += dy + thrust_force[1]
    mass_kg = physics.mass * 1000
    ax = fx / mass_kg
    ay = fy / mass_kg
    physics.vx += ax * dt
    physics.vy += ay * dt
    physics.x += physics.vx * dt
    physics.y += physics.vy * dt

    mass_kg = physics.mass * 1000
    physics.angular_vel += (thrust_force[2] / max(mass_kg, 1)) * dt * 0.01
    physics.angular_vel *= 0.995
    physics.angle += physics.angular_vel * dt

    if physics.body:
        physics.altitude = physics.altitude_above(physics.body)
        dx = physics.x - physics.body.x
        dy = physics.y - physics.body.y
        physics.longitude = math.atan2(dy, dx)
        physics.latitude = math.asin(max(-1, min(1, (physics.y - physics.body.y) / max(1, physics.distance_to(physics.body)))))


def find_dominant_body(physics, bodies):
    closest_body = None
    closest_dist = float('inf')
    for body in bodies.values():
        dist = physics.distance_to(body)
        soi = body.soi_radius() if body.parent else float('inf')
        effective = dist / max(soi, 1)
        if effective < closest_dist:
            closest_dist = effective
            closest_body = body
    return closest_body if closest_body else bodies[EARTH]


def orbital_elements_from_state(physics, body):
    mu = G * body.mass
    rx = physics.x - body.x
    ry = physics.y - body.y
    vx = physics.vx - body.vx
    vy = physics.vy - body.vy
    r = math.hypot(rx, ry)
    v = math.hypot(vx, vy)
    if r < 1 or mu < 1:
        return {'semi_major': 0, 'eccentricity': 0, 'periapsis': 0, 'apoapsis': 0, 'body': body}

    specific_energy = 0.5 * v * v - mu / r
    specific_angular_momentum = rx * vy - ry * vx
    h_mag = abs(specific_angular_momentum)

    if specific_energy >= 0:
        return {'semi_major': float('inf'), 'eccentricity': 1.0, 'periapsis': r, 'apoapsis': float('inf'), 'body': body, 'hyperbolic': True}

    if h_mag < 1e-6:
        return {'semi_major': -mu / (2 * specific_energy), 'eccentricity': 0, 'periapsis': r, 'apoapsis': r, 'body': body}

    semi_major = -mu / (2 * specific_energy)
    h = specific_angular_momentum
    ecc_vec_x = (vy * h) / mu - rx / r
    ecc_vec_y = (-vx * h) / mu - ry / r
    eccentricity = math.hypot(ecc_vec_x, ecc_vec_y)
    periapsis = semi_major * (1 - eccentricity)
    apoapsis = semi_major * (1 + eccentricity)

    return {
        'semi_major': semi_major,
        'eccentricity': eccentricity,
        'periapsis': periapsis,
        'apoapsis': apoapsis,
        'body': body,
        'hyperbolic': False,
        'h_mag': h_mag,
        'rx': rx, 'ry': ry,
        'vx': vx, 'vy': vy,
        'mu': mu,
    }


def compute_orbit_path(elements, num_points=128):
    if elements.get('hyperbolic') or elements['semi_major'] == float('inf'):
        return []
    a = elements['semi_major']
    e = elements['eccentricity']
    mu = elements['mu']
    rx, ry = elements['rx'], elements['ry']
    vx, vy = elements['vx'], elements['vy']

    h = rx * vy - ry * vx

    true_anomaly = math.atan2(
        (rx * vy - ry * vx) * (rx * vy - ry * vx) / (mu * e) if e > 0 else 0,
        0
    )

    if e > 0.001:
        f = math.acos(max(-1, min(1, (a * (1 - e * e) / max(h * h / mu, 1e-10) - 1) / e)))
        if rx * vx + ry * vy < 0:
            f = 2 * math.pi - f
    else:
        f = 0.0

    points = []
    for i in range(num_points + 1):
        angle = f + (2 * math.pi * i / num_points)
        r = a * (1 - e * e) / (1 + e * math.cos(angle))
        if r <= 0:
            continue
        px = r * math.cos(angle)
        py = r * math.sin(angle)

        body_angle = math.atan2(ry, rx)

        cos_a = math.cos(-body_angle)
        sin_a = math.sin(-body_angle)
        rx_rot = px * cos_a - py * sin_a
        ry_rot = px * sin_a + py * cos_a

        points.append((rx_rot + elements['body'].x, ry_rot + elements['body'].y))

    return points
