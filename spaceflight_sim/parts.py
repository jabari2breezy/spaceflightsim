from .config import PART_TYPES

class Part:
    def __init__(self, part_type):
        self.type = part_type
        spec = PART_TYPES[part_type]
        self.name = spec['name']
        self.width = spec['width']
        self.height = spec['height']
        self.mass = spec['mass']
        self.cost = spec['cost']
        self.color = spec['color']
        self.attach_top = spec.get('attach_top', True)
        self.attach_bottom = spec.get('attach_bottom', True)
        self.description = spec.get('description', '')

        self.fuel_capacity = spec.get('fuel_capacity', 0.0)
        self.fuel = self.fuel_capacity

        self.thrust = spec.get('thrust', 0.0)
        self.isp = spec.get('isp', 0.0)
        self.gimbal = spec.get('gimbal', 0.0)
        self.fuel_consumption = spec.get('fuel_consumption', 0.0)
        self.throttle = 1.0

        self.attached_above = None
        self.attached_below = None

        self.tree_y = 0
        self.tree_x = 0

        self.deployed = False
        self.decouple_fired = False
        self.shroud_deployed = False
        self.stage_dropped = False

    def get_total_fuel(self):
        return self.fuel

    def is_engine(self):
        return self.thrust > 0

    def is_fuel_tank(self):
        return self.fuel_capacity > 0

    def is_decoupler(self):
        return self.type == 'decoupler'

    def is_parachute(self):
        return self.type == 'parachute'

    def is_landing_leg(self):
        return self.type == 'landing_leg'

    def is_fin(self):
        return self.type == 'fin'

    def is_rcs(self):
        return self.type == 'rcs_thruster'

    def dry_mass(self):
        return self.mass

    def wet_mass(self):
        return self.mass + self.fuel

    def consume_fuel(self, amount):
        if self.fuel > 0:
            consumed = min(self.fuel, amount)
            self.fuel -= consumed
            return consumed
        return 0.0

    def copy(self):
        p = Part(self.type)
        p.fuel = self.fuel
        return p
