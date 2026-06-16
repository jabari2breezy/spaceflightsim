from .parts import Part

class Stage:
    def __init__(self, number):
        self.number = number
        self.parts = []
        self.active = False
        self.separated = False

    def add_part(self, part):
        self.parts.append(part)

    def total_mass(self):
        return sum(p.wet_mass() for p in self.parts)

    def dry_mass(self):
        return sum(p.dry_mass() for p in self.parts)

    def total_fuel(self):
        return sum(p.fuel for p in self.parts if p.is_fuel_tank())

    def total_thrust(self, throttle=1.0):
        return sum(p.thrust * p.throttle * throttle for p in self.parts if p.is_engine() and not p.decouple_fired)

    def total_fuel_consumption(self, throttle=1.0):
        return sum(p.fuel_consumption * p.throttle * throttle for p in self.parts if p.is_engine() and not p.decouple_fired)

    def has_active_engines(self):
        return any(p.is_engine() and not p.decouple_fired for p in self.parts)

    def get_engines(self):
        return [p for p in self.parts if p.is_engine() and not p.decouple_fired]

    def get_fuel_tanks(self):
        return [p for p in self.parts if p.is_fuel_tank()]

    def get_decouplers(self):
        return [p for p in self.parts if p.is_decoupler() and not p.decouple_fired]


class Vehicle:
    def __init__(self):
        self.stages = []
        self.current_stage_index = 0
        self.all_parts = []
        self.root_part = None

    def build_from_parts(self, part_types):
        self.all_parts = []
        self.stages = []
        for i, pt in enumerate(part_types):
            part = Part(pt)
            self.all_parts.append(part)
            if i > 0:
                part.attached_above = self.all_parts[i - 1]
                self.all_parts[i - 1].attached_below = part
        self.root_part = self.all_parts[0] if self.all_parts else None
        self._assign_stages()

    def build_from_tree(self, root_part):
        self.all_parts = []
        self.root_part = root_part
        self._flatten_tree(root_part)
        self._assign_stages()

    def _flatten_tree(self, part):
        self.all_parts.append(part)
        if part.attached_below:
            self._flatten_tree(part.attached_below)

    def _assign_stages(self):
        self.stages = []
        current_parts = []
        for part in reversed(self.all_parts):
            current_parts.append(part)
            if part.is_decoupler() or part.type == 'separator':
                stage = Stage(len(self.stages))
                for p in reversed(current_parts):
                    stage.add_part(p)
                current_parts = [part]
                self.stages.append(stage)
        if current_parts:
            stage = Stage(len(self.stages))
            for p in reversed(current_parts):
                stage.add_part(p)
            self.stages.append(stage)
        self.stages.reverse()
        for i, stage in enumerate(self.stages):
            stage.number = i
        self.current_stage_index = len(self.stages) - 1
        if self.stages:
            self.stages[self.current_stage_index].active = True

    def total_mass(self):
        return sum(p.wet_mass() for p in self.all_parts if not p.decouple_fired and not p.stage_dropped)

    def dry_mass(self):
        return sum(p.dry_mass() for p in self.all_parts if not p.decouple_fired and not p.stage_dropped)

    def total_fuel(self):
        return sum(p.fuel for p in self.all_parts if p.is_fuel_tank() and not p.decouple_fired and not p.stage_dropped)

    def active_stage(self):
        if 0 <= self.current_stage_index < len(self.stages):
            return self.stages[self.current_stage_index]
        return None

    def previous_stages(self):
        return [s for s in self.stages[:self.current_stage_index] if not s.separated]

    def get_active_engines(self):
        engines = []
        for stage in self.stages[self.current_stage_index:]:
            if stage.separated:
                break
            for p in stage.parts:
                if p.is_engine() and not p.decouple_fired and not p.stage_dropped:
                    engines.append(p)
        return engines

    def get_active_fuel_tanks(self):
        tanks = []
        for stage in self.stages[self.current_stage_index:]:
            if stage.separated:
                break
            for p in stage.parts:
                if p.is_fuel_tank() and not p.decouple_fired and not p.stage_dropped:
                    tanks.append(p)
        return tanks

    def total_thrust(self, throttle=1.0):
        return sum(e.thrust * e.throttle * throttle for e in self.get_active_engines())

    def total_fuel_consumption(self, throttle=1.0):
        return sum(e.fuel_consumption * e.throttle * throttle for e in self.get_active_engines())

    def consume_fuel(self, dt, throttle=1.0):
        engines = self.get_active_engines()
        tanks = self.get_active_fuel_tanks()
        for engine in engines:
            if not engine.is_engine():
                continue
            needed = engine.fuel_consumption * dt * throttle * engine.throttle
            for tank in tanks:
                if needed <= 0:
                    break
                consumed = tank.consume_fuel(needed)
                needed -= consumed
            if needed > 0:
                engine.throttle = max(0, 1.0 - needed / (engine.fuel_consumption * dt * throttle + 0.001))

    def stage(self):
        current = self.active_stage()
        if current is None:
            return False

        if self.current_stage_index <= 0:
            return False

        upper = self.stages[self.current_stage_index - 1]
        has_decoupler = any(p.is_decoupler() or p.type == 'separator' for p in upper.parts)
        if not has_decoupler:
            return False

        for part in upper.parts:
            if part.is_decoupler() or part.type == 'separator':
                part.decouple_fired = True
            if part.is_decoupler():
                part.attached_below = None

        for part in current.parts:
            part.stage_dropped = True

        current.active = False
        current.separated = True

        self.current_stage_index -= 1
        self.stages[self.current_stage_index].active = True
        return True

    def get_attached_parts_below(self, part):
        parts = []
        current = part
        while current:
            parts.append(current)
            current = current.attached_below
        return parts

    def get_active_mass(self):
        mass = 0.0
        for stage in self.stages[self.current_stage_index:]:
            if stage.separated:
                break
            for p in stage.parts:
                if not p.decouple_fired and not p.stage_dropped:
                    mass += p.wet_mass()
        return mass

    def get_attitude_torque(self, input_dir):
        torque = 0.0
        rcs_parts = [p for p in self.all_parts if p.is_rcs() and not p.decouple_fired]
        if rcs_parts:
            torque = input_dir * 0.5 * len(rcs_parts)
        engines = self.get_active_engines()
        for e in engines:
            if e.gimbal > 0:
                torque += input_dir * e.gimbal * 0.01 * e.thrust
        return torque

    def center_of_mass(self):
        if not self.all_parts:
            return 0, 0
        total_mass = 0
        cx = 0
        cy = 0
        for p in self.all_parts:
            if p.decouple_fired:
                continue
            m = p.wet_mass()
            total_mass += m
            cx += p.tree_x * m
            cy += p.tree_y * m
        if total_mass > 0:
            return cx / total_mass, cy / total_mass
        return 0, 0
