import math
from .config import *

class CelestialBody:
    def __init__(self, key, name, mass, radius, color, atm_height=0, atm_density=0, atm_scale=8500):
        self.key = key
        self.name = name
        self.mass = mass
        self.radius = radius
        self.color = color
        self.atm_height = atm_height
        self.atm_density_sea = atm_density
        self.atm_scale_height = atm_scale
        self.x = 0.0
        self.y = 0.0
        self.vx = 0.0
        self.vy = 0.0
        self.parent = None
        self.orbital_radius = 0.0
        self.orbital_period = 0.0
        self.orbital_angle = 0.0
        self.orbital_speed = 0.0
        self.rotation_period = float('inf')
        self.rotation_angle = 0.0

    def set_orbit(self, parent, radius, period, initial_angle=0):
        self.parent = parent
        self.orbital_radius = radius
        self.orbital_period = period
        self.orbital_angle = initial_angle
        self.orbital_speed = 2 * math.pi / period if period > 0 else 0

    def set_rotation(self, period_seconds):
        self.rotation_period = period_seconds
        self.rotation_angle = 0.0

    def update(self, dt):
        if self.parent and self.orbital_speed > 0:
            self.orbital_angle += self.orbital_speed * dt
            if self.orbital_angle > 2 * math.pi:
                self.orbital_angle -= 2 * math.pi
            self.x = self.parent.x + self.orbital_radius * math.cos(self.orbital_angle)
            self.y = self.parent.y + self.orbital_radius * math.sin(self.orbital_angle)
            dv = self.orbital_speed * self.orbital_radius
            self.vx = self.parent.vx - dv * math.sin(self.orbital_angle)
            self.vy = self.parent.vy + dv * math.cos(self.orbital_angle)
        self.rotation_angle += (2 * math.pi / self.rotation_period) * dt if self.rotation_period > 0 and self.rotation_period != float('inf') else 0

    def soi_radius(self):
        if not self.parent:
            return float('inf')
        return self.orbital_radius * (self.mass / self.parent.mass) ** 0.4

    def g_at_radius(self, r):
        if r < self.radius:
            return G * self.mass / (self.radius * self.radius)
        return G * self.mass / (r * r)

    def surface_gravity(self):
        return self.g_at_radius(self.radius)

    def atm_density_at(self, altitude):
        if altitude > self.atm_height:
            return 0.0
        if self.atm_density_sea <= 0:
            return 0.0
        return self.atm_density_sea * math.exp(-altitude / self.atm_scale_height)


def create_solar_system():
    bodies = {}

    sun = CelestialBody(SUN, 'Sun', SOLAR_MASS, SOLAR_RADIUS, COLORS['sun_yellow'])

    merc = CelestialBody(MERCURY, 'Mercury', MERCURY_MASS, MERCURY_RADIUS, COLORS['mercury_grey'])
    merc.set_orbit(sun, 0.387 * AU, 87.97 * DAY)

    venus = CelestialBody(VENUS, 'Venus', VENUS_MASS, VENUS_RADIUS, COLORS['venus_yellow'],
                          VENUS_ATM_HEIGHT, VENUS_ATM_DENSITY_SEA, VENUS_ATM_SCALE_HEIGHT)
    venus.set_orbit(sun, 0.723 * AU, 224.7 * DAY)

    earth = CelestialBody(EARTH, 'Earth', EARTH_MASS, EARTH_RADIUS, COLORS['earth_blue'],
                          EARTH_ATM_HEIGHT, EARTH_ATM_DENSITY_SEA, EARTH_ATM_SCALE_HEIGHT)
    earth.set_orbit(sun, AU, YEAR)

    moon = CelestialBody(MOON, 'Moon', MOON_MASS, MOON_RADIUS, COLORS['moon_grey'])
    moon.set_orbit(earth, 3.844e8, 27.32 * DAY, initial_angle=1.2)

    mars = CelestialBody(MARS, 'Mars', MARS_MASS, MARS_RADIUS, COLORS['mars_red'],
                         MARS_ATM_HEIGHT, MARS_ATM_DENSITY_SEA, MARS_ATM_SCALE_HEIGHT)
    mars.set_orbit(sun, 1.524 * AU, 687.0 * DAY, initial_angle=2.8)

    for b in [sun, merc, venus, earth, moon, mars]:
        bodies[b.key] = b

    return bodies
