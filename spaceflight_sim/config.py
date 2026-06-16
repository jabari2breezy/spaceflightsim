import pygame

WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 720
FPS = 60

G = 6.67430e-11

PHYSICS_DT = 1.0 / 60.0
SUBSTEPS = 8

ATMOSPHERE_SCALE = 1.0

COLORS = {
    'black': (0, 0, 0),
    'white': (255, 255, 255),
    'dark_grey': (40, 40, 45),
    'mid_grey': (80, 80, 90),
    'light_grey': (160, 160, 170),
    'blue': (70, 130, 200),
    'dark_blue': (20, 25, 45),
    'light_blue': (135, 206, 250),
    'cyan': (0, 188, 212),
    'dark_cyan': (0, 150, 180),
    'red': (255, 60, 60),
    'dark_red': (140, 30, 30),
    'green': (80, 200, 80),
    'dark_green': (30, 80, 30),
    'orange': (255, 140, 40),
    'yellow': (255, 220, 50),
    'brown': (160, 100, 50),
    'tan': (210, 180, 140),
    'grey': (128, 128, 128),
    'panel': (25, 28, 38),
    'panel_border': (55, 58, 68),
    'button': (45, 50, 65),
    'button_hover': (65, 70, 85),
    'button_active': (0, 150, 180),
    'thrust_plume': (255, 180, 50),
    'thrust_core': (255, 255, 200),
    'solar_yellow': (255, 200, 50),
    'earth_blue': (30, 80, 180),
    'earth_green': (60, 140, 60),
    'earth_white': (220, 220, 230),
    'moon_grey': (180, 180, 175),
    'mars_red': (190, 85, 55),
    'venus_yellow': (200, 170, 100),
    'mercury_grey': (160, 155, 150),
    'sun_yellow': (255, 220, 50),
    'space_bg': (5, 5, 18),
    'star': (200, 200, 220),
    'green_dim': (40, 100, 40),
    'red_dim': (100, 40, 40),
    'blue_dim': (40, 40, 100),
    'transparent_bg': (0, 0, 0, 160),
    'ui_highlight': (0, 188, 212),
    'hud_label': (180, 185, 190),
    'hud_value': (255, 255, 255),
    'hud_warn': (255, 220, 50),
    'hud_danger': (255, 60, 60),
    'fuel_bar_bg': (35, 35, 45),
    'fuel_bar_fill': (255, 180, 40),
}

PART_SIZE = 24

FUEL_DENSITY = 1.0

PART_TYPES = {
    'nose_cone': {
        'name': 'Nose Cone',
        'width': 1,
        'height': 1,
        'mass': 0.2,
        'cost': 200,
        'color': (200, 200, 210),
        'attach_top': False,
        'attach_bottom': True,
        'description': 'Reduces drag',
        'category': 'aero',
    },
    'fuel_tank_small': {
        'name': 'Small Fuel Tank',
        'width': 1,
        'height': 1,
        'mass': 0.3,
        'cost': 300,
        'color': (230, 230, 240),
        'fuel_capacity': 2.0,
        'attach_top': True,
        'attach_bottom': True,
        'description': '2.0t fuel',
        'category': 'fuel',
    },
    'fuel_tank_medium': {
        'name': 'Medium Fuel Tank',
        'width': 1,
        'height': 2,
        'mass': 0.5,
        'cost': 600,
        'color': (220, 220, 235),
        'fuel_capacity': 5.0,
        'attach_top': True,
        'attach_bottom': True,
        'description': '5.0t fuel',
        'category': 'fuel',
    },
    'fuel_tank_large': {
        'name': 'Large Fuel Tank',
        'width': 2,
        'height': 2,
        'mass': 1.0,
        'cost': 1200,
        'color': (210, 210, 230),
        'fuel_capacity': 12.0,
        'attach_top': True,
        'attach_bottom': True,
        'description': '12.0t fuel',
        'category': 'fuel',
    },
    'engine_small': {
        'name': 'Small Engine',
        'width': 1,
        'height': 1,
        'mass': 0.3,
        'cost': 400,
        'color': (80, 80, 90),
        'thrust': 150.0,
        'isp': 280.0,
        'gimbal': 5.0,
        'fuel_consumption': 0.10,
        'attach_top': True,
        'attach_bottom': False,
        'description': '150kN | 280s ISP',
        'category': 'engine',
    },
    'engine_medium': {
        'name': 'Medium Engine',
        'width': 1,
        'height': 1,
        'mass': 0.6,
        'cost': 800,
        'color': (70, 70, 85),
        'thrust': 350.0,
        'isp': 300.0,
        'gimbal': 4.0,
        'fuel_consumption': 0.24,
        'attach_top': True,
        'attach_bottom': False,
        'description': '350kN | 300s ISP',
        'category': 'engine',
    },
    'engine_large': {
        'name': 'Large Engine',
        'width': 2,
        'height': 1,
        'mass': 1.5,
        'cost': 2000,
        'color': (60, 60, 80),
        'thrust': 1000.0,
        'isp': 310.0,
        'gimbal': 3.0,
        'fuel_consumption': 0.68,
        'attach_top': True,
        'attach_bottom': False,
        'description': '1000kN | 310s ISP',
        'category': 'engine',
    },
    'decoupler': {
        'name': 'Decoupler',
        'width': 1,
        'height': 0.5,
        'mass': 0.05,
        'cost': 200,
        'color': (140, 140, 120),
        'attach_top': True,
        'attach_bottom': True,
        'description': 'Stage separation',
        'category': 'structural',
    },
    'parachute': {
        'name': 'Parachute',
        'width': 1,
        'height': 0.5,
        'mass': 0.1,
        'cost': 400,
        'color': (255, 100, 100),
        'attach_top': False,
        'attach_bottom': True,
        'description': 'Slows descent',
        'category': 'aero',
    },
    'landing_leg': {
        'name': 'Landing Leg',
        'width': 1,
        'height': 0.5,
        'mass': 0.1,
        'cost': 300,
        'color': (150, 130, 100),
        'attach_top': True,
        'attach_bottom': False,
        'description': 'Sturdy landing',
        'category': 'utility',
    },
    'rcs_thruster': {
        'name': 'RCS Thruster',
        'width': 0.5,
        'height': 0.5,
        'mass': 0.05,
        'cost': 500,
        'color': (120, 120, 130),
        'attach_top': True,
        'attach_bottom': True,
        'description': 'Rotation control',
        'category': 'utility',
    },
    'fin': {
        'name': 'Fin',
        'width': 1,
        'height': 0.5,
        'mass': 0.08,
        'cost': 250,
        'color': (100, 100, 110),
        'attach_top': False,
        'attach_bottom': True,
        'description': 'Aero stability',
        'category': 'aero',
    },
    'battery': {
        'name': 'Battery',
        'width': 1,
        'height': 0.5,
        'mass': 0.1,
        'cost': 350,
        'color': (200, 180, 50),
        'attach_top': True,
        'attach_bottom': True,
        'description': 'Electric charge',
        'category': 'utility',
    },
    'probe': {
        'name': 'Probe Core',
        'width': 1,
        'height': 0.5,
        'mass': 0.1,
        'cost': 600,
        'color': (80, 80, 100),
        'attach_top': True,
        'attach_bottom': True,
        'description': 'Unmanned control',
        'category': 'control',
    },
    'heat_shield': {
        'name': 'Heat Shield',
        'width': 1,
        'height': 0.25,
        'mass': 0.15,
        'cost': 500,
        'color': (60, 50, 40),
        'attach_top': True,
        'attach_bottom': False,
        'description': 'Reentry protection',
        'category': 'aero',
    },
    'structural': {
        'name': 'Structural',
        'width': 1,
        'height': 0.25,
        'mass': 0.02,
        'cost': 100,
        'color': (150, 150, 160),
        'attach_top': True,
        'attach_bottom': True,
        'description': 'Connector piece',
        'category': 'structural',
    },
    'separator': {
        'name': 'Side Separator',
        'width': 1,
        'height': 0.25,
        'mass': 0.03,
        'cost': 300,
        'color': (100, 100, 80),
        'attach_top': True,
        'attach_bottom': True,
        'description': 'Side stage sep',
        'category': 'structural',
    },
}

PART_ORDER = [
    'nose_cone', 'fuel_tank_small', 'fuel_tank_medium', 'fuel_tank_large',
    'engine_small', 'engine_medium', 'engine_large',
    'decoupler', 'separator', 'parachute', 'landing_leg',
    'fin', 'rcs_thruster', 'battery', 'probe', 'heat_shield', 'structural',
]

CATEGORY_ORDER = ['control', 'fuel', 'engine', 'structural', 'aero', 'utility']
CATEGORY_NAMES = {
    'control': 'CONTROL',
    'fuel': 'FUEL TANKS',
    'engine': 'ENGINES',
    'structural': 'STRUCTURAL',
    'aero': 'AERODYNAMICS',
    'utility': 'UTILITY',
}
CATEGORY_COLORS = {
    'control': (0, 180, 200),
    'fuel': (200, 200, 60),
    'engine': (200, 100, 40),
    'structural': (140, 140, 140),
    'aero': (100, 180, 200),
    'utility': (180, 160, 80),
}

SUN = 'sun'
MERCURY = 'mercury'
VENUS = 'venus'
EARTH = 'earth'
MOON = 'moon'
MARS = 'mars'

AU = 1.496e11
DAY = 86400.0
YEAR = 365.25 * DAY
EARTH_RADIUS = 6.371e6
EARTH_MASS = 5.972e24
MOON_RADIUS = 1.737e6
MOON_MASS = 7.342e22
SOLAR_RADIUS = 6.957e8
SOLAR_MASS = 1.989e30
MARS_RADIUS = 3.389e6
MARS_MASS = 6.417e23
VENUS_RADIUS = 6.052e6
VENUS_MASS = 4.867e24
MERCURY_RADIUS = 2.440e6
MERCURY_MASS = 3.301e23

EARTH_ATM_HEIGHT = 68e3
EARTH_ATM_DENSITY_SEA = 1.225
EARTH_ATM_SCALE_HEIGHT = 8.5e3
MARS_ATM_HEIGHT = 25e3
MARS_ATM_DENSITY_SEA = 0.020
MARS_ATM_SCALE_HEIGHT = 11.1e3
VENUS_ATM_HEIGHT = 100e3
VENUS_ATM_DENSITY_SEA = 65.0
VENUS_ATM_SCALE_HEIGHT = 15.9e3

MAP_VIEW_DISTANCE = 0.5e9
