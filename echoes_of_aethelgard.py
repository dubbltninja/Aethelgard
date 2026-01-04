#!/usr/bin/env python3
"""Echoes of Aethelgard - a text-based RPG."""

import json
import math
import os
import random
import sys
import time
from copy import deepcopy
from datetime import datetime

from aethelgard_data import ENEMY_DEFS, ITEM_DEFS, LOCATION_DEFS, WIN_ENDGAME_ART

# -----------------------------
# Utility helpers
# -----------------------------

USE_COLOR = sys.stdout.isatty()
SAVE_DIR = os.path.dirname(os.path.abspath(__file__))
LEGACY_SAVE_FILE = os.path.join(SAVE_DIR, "savegame.json")
SAVE_SLOT_TEMPLATE = os.path.join(SAVE_DIR, "savegame_slot{}.json")
SCORES_FILE = os.path.join(SAVE_DIR, "scores.json")
MAX_SAVE_SLOTS = 3
TOTAL_QUESTS = 6

MINIMAP_LABEL_WIDTH = 4
RETURN_ENCOUNTER_CHANCE = 0.20
WANDERING_ENEMY_POOL = ("Corrupted Shade", "Wildling Brute", "Arcane Wisp")
ENEMY_LEVEL_VARIANCE = 1
ENEMY_HEALTH_MULT_PER_LEVEL = 0.15
ENEMY_DAMAGE_MULT_PER_LEVEL = 0.10
ENEMY_DEFENSE_MULT_PER_LEVEL = 0.07
RARITY_TABLE = (
    ("Common", 0.50, 1.0),
    ("Uncommon", 0.30, 1.1),
    ("Rare", 0.15, 1.25),
    ("Epic", 0.04, 1.5),
    ("Legendary", 0.01, 1.75),
)
RARITY_ORDER = [name for name, _, _ in RARITY_TABLE]
RARITY_MULTIPLIERS = {name: multiplier for name, _, multiplier in RARITY_TABLE}
UPGRADE_COST_MULTIPLIERS = {
    "Common": 0.50,
    "Uncommon": 1.00,
    "Rare": 1.50,
    "Epic": 2.00,
}
SPELL_DEFS = {
    "echo bolt": {
        "mana_cost": 10,
        "base_damage": 5,
        "effect_type": "damage",
        "target": "single",
    },
    "fireball": {
        "mana_cost": 10,
        "base_damage": 8,
        "effect_type": "damage",
        "target": "single",
    },
    "lightning bolt": {
        "mana_cost": 10,
        "base_damage": 12,
        "effect_type": "damage",
        "target": "single",
    },
}
CLASS_DEFS = {
    "Ranger": {
        "buff": {"strength": 2},
        "weapon": "Rusty Dagger",
        "intro": (
            "As a Ranger, you possess adept strength in combat, a vital skill in these fractured lands."
        ),
    },
    "Wizard": {
        "buff": {"magic": 2},
        "weapon": "Apprentice Staff",
        "intro": (
            "As a Wizard, you possess potent magical abilities, a rare gift in a world scarred by wild energies."
        ),
    },
    "Elf": {
        "buff": {"agility": 2},
        "weapon": "Primitive Bow",
        "intro": (
            "As an Elf, your agility skills may come in handy, allowing you to navigate the perilous echoes "
            "of Aethelgard."
        ),
    },
}
UI_RULE = "-" * 60
COMBAT_LOG_LIMIT = 8
CANTRIP_ACTIVE = True
MINIMAP_LAYOUT = {
    "Shattered Library": {"abbr": "SL", "pos": (0, 0)},
    "Silverwood Plaza": {"abbr": "SP", "pos": (8, 0)},
    "Chasm of Whispers": {"abbr": "CW", "pos": (16, 0)},
    "Voidscar Hollow": {"abbr": "VH", "pos": (24, 0)},
    "Darkened Corridor": {"abbr": "DC", "pos": (0, 2)},
    "Crumbling Archway": {"abbr": "CA", "pos": (0, 4)},
    "Whispering Ruins": {"abbr": "WR", "pos": (0, 6)},
    "Sunken Archives": {"abbr": "SA", "pos": (0, 8)},
    "Heartstone Depths": {"abbr": "HD", "pos": (0, 10)},
    "Shimmering Pass": {"abbr": "SM", "pos": (8, 10)},
    "Aetherium Spires": {"abbr": "AS", "pos": (16, 10)},
    "Sky-Whisper Plateau": {"abbr": "SW", "pos": (24, 10)},
    "Veridian Glowlands": {"abbr": "VG", "pos": (32, 10)},
    "The Chronos Nexus": {"abbr": "CN", "pos": (40, 10)},
    "The Temporal Breach Apex": {"abbr": "TA", "pos": (40, 8)},
    "Mistwood Path": {"abbr": "MP", "pos": (8, 6)},
    "The Wayfarer's Respite": {"abbr": "WY", "pos": (8, 8)},
    "Ironclad Camp": {"abbr": "IC", "pos": (16, 6)},
    "Barren Peaks": {"abbr": "BP", "pos": (16, 4)},
    "Blighted Outpost": {"abbr": "BO", "pos": (24, 4)},
    "The Emberforge": {"abbr": "EF", "pos": (24, 2)},
}
MINIMAP_EDGES = [
    ("Shattered Library", "Silverwood Plaza"),
    ("Shattered Library", "Darkened Corridor"),
    ("Darkened Corridor", "Crumbling Archway"),
    ("Crumbling Archway", "Whispering Ruins"),
    ("Whispering Ruins", "Mistwood Path"),
    ("Mistwood Path", "Ironclad Camp"),
    ("Silverwood Plaza", "Mistwood Path"),
    ("Mistwood Path", "The Wayfarer's Respite"),
    ("Whispering Ruins", "Sunken Archives"),
    ("Sunken Archives", "Heartstone Depths"),
    ("Heartstone Depths", "Shimmering Pass"),
    ("Shimmering Pass", "Aetherium Spires"),
    ("Aetherium Spires", "Sky-Whisper Plateau"),
    ("Sky-Whisper Plateau", "Veridian Glowlands"),
    ("Veridian Glowlands", "The Chronos Nexus"),
    ("The Chronos Nexus", "The Temporal Breach Apex"),
    ("Sky-Whisper Plateau", "Blighted Outpost"),
    ("Silverwood Plaza", "Chasm of Whispers"),
    ("Chasm of Whispers", "Voidscar Hollow"),
    ("Ironclad Camp", "Barren Peaks"),
    ("Barren Peaks", "Blighted Outpost"),
    ("Blighted Outpost", "The Emberforge"),
]


def clear_screen():
    """Clear the terminal screen for a fresh scene."""
    print("\033[2J\033[H", end="")


def pause(seconds=0.6):
    """Small pacing delay to avoid overwhelming the player with text."""
    time.sleep(seconds)


def color_text(text, color_code):
    """Wrap text in ANSI colors when enabled; otherwise return plain text."""
    if not USE_COLOR:
        return text
    return f"\033[{color_code}m{text}\033[0m"


def headline(text):
    """Format a header line for emphasis."""
    return color_text(text, "1;36")


def npc_name(text):
    """Format NPC names differently to distinguish dialogue."""
    return color_text(text, "1;33")


def danger(text):
    """Format danger text (combat cues, warnings)."""
    return color_text(text, "1;31")


def good(text):
    """Format positive feedback (healing, rewards)."""
    return color_text(text, "1;32")


def slow_print(lines, delay=0.3):
    """Print a list of lines with a slight delay between them."""
    for line in lines:
        print(line)
        pause(delay)


def normalize_name(text):
    """Normalize user input for matching items and NPCs."""
    return text.strip().lower()


def safe_input(prompt):
    """Read input safely; exit cleanly if the input stream closes."""
    try:
        return input(prompt)
    except EOFError:
        print("\nInput stream closed. Exiting Echoes of Aethelgard.")
        raise SystemExit(0)


def clamp(value, minimum, maximum):
    """Clamp a numeric value between minimum and maximum bounds."""
    return max(minimum, min(maximum, value))


# -----------------------------
# Core data classes
# -----------------------------


class Item:
    """Represents any interactive object the player can carry or equip."""

    def __init__(
        self,
        name,
        description,
        item_type,
        effect=None,
        weapon_type=None,
        gold_value=0,
        major=False,
        value=None,
        rarity=None,
    ):
        self.name = name
        self.description = description
        self.item_type = item_type  # weapon, armor, consumable, quest_item
        self.weapon_type = weapon_type
        self.base_effect = deepcopy(effect or {})
        self.effect = deepcopy(self.base_effect)
        if value is not None and gold_value == 0:
            gold_value = value
        self.base_gold_value = gold_value
        self.gold_value = gold_value
        self.value = gold_value
        self.major = major
        self.rarity = rarity

    def describe(self):
        """Return a readable description of the item."""
        return f"{self.name}: {self.description}"


class Enemy:
    """Represents a hostile creature with combat stats."""

    def __init__(
        self,
        name,
        description,
        health,
        damage,
        defense,
        agility,
        exp_reward,
        loot=None,
        bonus_loot=None,
        magic_resistance=0.0,
    ):
        self.name = name
        self.description = description
        self.base_health = health
        self.base_damage = damage
        self.base_defense = defense
        self.magic_resistance = float(magic_resistance)
        self.base_exp_reward = exp_reward
        self.level = 1
        self.max_health = health
        self.health = health
        self.damage = damage
        self.defense = defense
        self.agility = agility
        self.exp_reward = exp_reward
        self.loot = loot or []
        self.bonus_loot = bonus_loot or []
        self.scaled = False

    def apply_level(self, level, health_mult, damage_mult, defense_mult, preserve_health=False):
        """Scale stats to the specified level."""
        level = max(1, int(level))
        ratio = None
        if preserve_health and self.max_health:
            ratio = self.health / self.max_health
        self.level = level
        self.max_health = max(1, int(round(self.base_health * (1 + (level - 1) * health_mult))))
        self.damage = max(0, int(round(self.base_damage * (1 + (level - 1) * damage_mult))))
        self.defense = max(0, int(round(self.base_defense * (1 + (level - 1) * defense_mult))))
        self.exp_reward = max(1, int(round(self.base_exp_reward * (1 + (level - 1) * 0.10))))
        if ratio is not None:
            scaled_health = int(round(self.max_health * ratio))
            self.health = max(0, min(self.max_health, scaled_health))
        else:
            self.health = self.max_health
        self.scaled = True

    def is_alive(self):
        """Check whether the enemy is still alive."""
        return self.health > 0


class NPC:
    """Represents a non-player character with dialogue and quests."""

    def __init__(self, name, description, faction, dialogue):
        self.name = name
        self.description = description
        self.faction = faction
        self.dialogue = dialogue


class Location:
    """Represents a place in the world with exits and interactive content."""

    def __init__(self, name, description, exits=None, items=None, enemies=None, npcs=None, events=None, art=None):
        self.name = name
        self.description = description
        self.exits = exits or {}
        self.items = items or []
        self.enemies = enemies or []
        self.npcs = npcs or []
        self.events = events or []
        self.art = art or ""


class Quest:
    """Tracks quest objectives and completion state."""

    def __init__(self, quest_id, name, description, requirements, rewards):
        self.quest_id = quest_id
        self.name = name
        self.description = description
        self.requirements = requirements
        self.rewards = rewards
        self.status = "active"  # active or completed


class Player:
    """Holds player stats, inventory, quests, and progression."""

    def __init__(self, name, location):
        self.name = name
        self.max_health = 100
        self.health = 100
        self.max_mana = 50
        self.mana = 50
        self.strength = 8
        self.magic = 7
        self.agility = 6
        self.class_name = "Ranger"
        self.spellbooks_read_count = 0
        self.current_active_spell = "echo bolt"
        self.inventory = []
        self.equipped_weapon = None
        self.equipped_armor = None
        self.current_location = location
        self.experience = 0
        self.level = 1
        self.attribute_points = 0
        self.quests = []
        self.gold = 30
        self.total_gold_earned = 0
        self.travel_steps = 0
        self.flags = {}
        self.enemies_killed = 0
        self.damage_done = 0
        self.damage_received = 0
        self.total_xp_earned = 0
        self.faction_affinity = {
            "Remnants of Aethelgard": 0,
            "Shadow Weavers": 0,
            "Ironclad Nomads": 0,
        }
        self.visited_locations = set()

    def attack_power(self):
        """Calculate melee damage bonus from strength and weapon."""
        weapon_bonus = self.equipped_weapon.effect.get("damage", 0) if self.equipped_weapon else 0
        return self.strength + weapon_bonus

    def defense(self):
        """Calculate defense bonus from armor."""
        armor_bonus = self.equipped_armor.effect.get("defense", 0) if self.equipped_armor else 0
        return armor_bonus

    def gain_experience(self, amount):
        """Grant experience and handle level-ups."""
        self.experience += amount
        self.total_xp_earned += amount
        print(good(f"You gain {amount} experience."))
        while self.experience >= self.level * 100:
            self.experience -= self.level * 100
            self.level += 1
            self.attribute_points += 1
            self.max_health += 10
            self.max_mana += 5
            self.health = self.max_health
            self.mana = self.max_mana
            print(headline("You feel the ley lines surge within you. Level up!"))
            print("You gain 1 attribute point, +10 max health, +5 max mana.")
            self.spend_attribute_points()

    def spend_attribute_points(self):
        """Prompt the player to allocate earned attribute points."""
        while self.attribute_points > 0:
            print(f"Attribute points remaining: {self.attribute_points}")
            choice = safe_input("Spend on (strength, magic, agility), 'help', or 'skip': ").strip().lower()
            if choice == "strength":
                self.strength += 1
                self.attribute_points -= 1
                print(good("Strength increased."))
            elif choice == "magic":
                self.magic += 1
                self.attribute_points -= 1
                print(good("Magic increased."))
            elif choice == "agility":
                self.agility += 1
                self.attribute_points -= 1
                print(good("Agility increased."))
            elif choice == "help":
                print("Strength increases melee damage with weapons.")
                print("Magic increases spell damage and powers magical effects.")
                print("Agility improves hit chance, dodge chance, and fleeing success.")
            elif choice == "skip":
                break
            else:
                print("Not a valid choice.")


# -----------------------------
# Main game class
# -----------------------------


class Game:
    """Main game controller: builds the world, handles input, and runs the loop."""

    def __init__(self):
        self.item_catalog = self.build_item_catalog()
        self.enemy_catalog = self.build_enemy_catalog()
        self.world = self.build_world()
        self.merchant_inventory = self.build_merchant_inventory()
        self.base_location_descriptions = {
            name: location.description for name, location in self.world.items()
        }
        self.player = None
        self.previous_location = None
        self.running = True
        self.triggered_events = set()
        self.needs_redraw = True
        self.force_show_art = False
        self.pending_encounter_message = None
        self.pending_post_redraw_messages = []
        self.pending_post_combat_messages = []
        self.just_moved = False
        self.horde_active = False
        self.horde_delay_turns = 0
        self.infected_locations = set()
        self.horde_pending = {}
        self.wandering_enemy_pool = list(WANDERING_ENEMY_POOL)
        self.score_saved = False
        self.combat_log = []
        self.current_save_slot = None

    def build_item_catalog(self):
        """Define item templates used to populate the world."""
        catalog = {}
        for name, data in ITEM_DEFS.items():
            catalog[name] = Item(
                name,
                data["description"],
                data["item_type"],
                data.get("effect", {}),
                weapon_type=data.get("weapon_type"),
                gold_value=data.get("gold_value", 0),
                major=data.get("major", False),
            )
        return catalog

    def build_enemy_catalog(self):
        """Define enemy templates for the world."""
        catalog = {}
        for name, data in ENEMY_DEFS.items():
            enemy = Enemy(
                name,
                data["description"],
                health=data["health"],
                damage=data["damage"],
                defense=data["defense"],
                agility=data["agility"],
                exp_reward=data["exp_reward"],
                loot=data.get("loot", []),
                bonus_loot=data.get("bonus_loot", []),
                magic_resistance=data.get("magic_resistance", 0.0),
            )
            catalog[name] = enemy
        return catalog

    def build_world(self):
        """Construct the starting game world with locations and content."""
        locations = {}
        for name, data in LOCATION_DEFS.items():
            exits = deepcopy(data.get("exits", {}))
            items = [self.clone_item(item_name) for item_name in data.get("items", [])]
            enemies = [self.clone_enemy(enemy_name) for enemy_name in data.get("enemies", [])]
            npcs = [
                NPC(npc["name"], npc["description"], npc["faction"], npc["dialogue"])
                for npc in data.get("npcs", [])
            ]
            events = deepcopy(data.get("events", []))
            art = data.get("art", "")
            locations[name] = Location(
                name,
                data["description"],
                exits=exits,
                items=items,
                enemies=enemies,
                npcs=npcs,
                events=events,
                art=art,
            )
        return locations

    def build_merchant_inventory(self):
        """Create the merchant's starting stock."""
        consumables = [
            "Ley-Touched Tonic",
            "Ley-Touched Tonic",
            "Ley-Touched Tonic",
            "Mana Bloom",
        ]
        gear_candidates = [
            name
            for name, item in self.item_catalog.items()
            if item.item_type in ("weapon", "armor")
            and name not in ("Warrior's Sword", "Shadow-Kissed Dagger")
        ]
        selection_count = min(len(gear_candidates), random.randint(3, 4))
        gear_names = random.sample(gear_candidates, selection_count) if gear_candidates else []
        stock = []
        for name in consumables + gear_names:
            item = self.clone_item(name)
            if item.item_type != "quest_item":
                stock.append(item)
        return stock

    def clone_item(self, name, rarity=None):
        """Return a fresh copy of an item template."""
        item = deepcopy(self.item_catalog[name])
        return self.assign_item_rarity(item, rarity=rarity)

    def clone_enemy(self, name):
        """Return a fresh copy of an enemy template."""
        return deepcopy(self.enemy_catalog[name])

    def safe_clone_item(self, name, rarity=None):
        """Clone an item if it exists in the catalog; otherwise return None."""
        if name not in self.item_catalog:
            print(danger(f"Save data referenced unknown item '{name}'. Skipping."))
            return None
        item = deepcopy(self.item_catalog[name])
        return self.assign_item_rarity(item, rarity=rarity)

    def safe_clone_enemy(self, name):
        """Clone an enemy if it exists in the catalog; otherwise return None."""
        if name not in self.enemy_catalog:
            print(danger(f"Save data referenced unknown enemy '{name}'. Skipping."))
            return None
        return self.clone_enemy(name)

    def restock_merchant_if_needed(self):
        """Restock merchant wares after enough travel steps."""
        if not self.player:
            return
        self.player.travel_steps += 1
        if self.player.travel_steps >= 5:
            self.player.travel_steps = 0
            self.merchant_inventory = self.build_merchant_inventory()

    def sanitize_merchant_inventory(self):
        """Ensure merchant inventory contains no quest items."""
        self.merchant_inventory = [
            item for item in self.merchant_inventory if item.item_type != "quest_item"
        ]

    def scale_enemy_for_player(self, enemy, preserve_health=False, level=None):
        """Scale an enemy to a level relative to the player."""
        if enemy.name == "The Chronos Tyrant":
            level = max(1, self.player.level + 1)
        if enemy.scaled and level is None:
            return
        if level is None:
            variance = random.randint(-ENEMY_LEVEL_VARIANCE, ENEMY_LEVEL_VARIANCE)
            level = max(1, self.player.level + variance)
        enemy.apply_level(
            level,
            ENEMY_HEALTH_MULT_PER_LEVEL,
            ENEMY_DAMAGE_MULT_PER_LEVEL,
            ENEMY_DEFENSE_MULT_PER_LEVEL,
            preserve_health=preserve_health,
        )

    def add_gold(self, amount):
        """Increase gold and track lifetime earnings."""
        if amount <= 0:
            return
        self.player.gold += amount
        self.player.total_gold_earned += amount

    def roll_rarity(self):
        """Roll for an item rarity tier."""
        roll = random.random()
        cumulative = 0.0
        for name, chance, _ in RARITY_TABLE:
            cumulative += chance
            if roll <= cumulative:
                return name
        return "Common"

    def scale_item_effect(self, base_effect, multiplier):
        """Scale core combat stats by rarity multiplier."""
        scaled = {}
        for key, value in base_effect.items():
            if key in ("damage", "defense"):
                scaled_value = int(round(value * multiplier))
                if value > 0:
                    scaled_value = max(1, scaled_value)
                scaled[key] = scaled_value
            elif key in ("magic", "mana_cost_reduction_percent", "life_steal_percent"):
                scaled_value = value * multiplier
                if value > 0:
                    scaled_value = max(0.1, scaled_value)
                scaled[key] = scaled_value
            else:
                scaled[key] = value
        return scaled

    def assign_item_rarity(self, item, rarity=None):
        """Assign rarity and scale base stats for eligible items."""
        if item.item_type in ("consumable", "quest_item"):
            item.rarity = None
            item.effect = deepcopy(item.base_effect)
            item.gold_value = item.base_gold_value
            item.value = item.gold_value
            return item
        if not rarity:
            rarity = self.roll_rarity()
        multiplier = RARITY_MULTIPLIERS.get(rarity, 1.0)
        item.rarity = rarity
        item.effect = self.scale_item_effect(item.base_effect, multiplier)
        item.gold_value = max(1, int(round(item.base_gold_value * multiplier)))
        item.value = item.gold_value
        return item

    def get_next_rarity(self, rarity):
        """Return the next rarity tier for upgrades."""
        current = rarity or "Common"
        if current not in RARITY_ORDER:
            return None
        index = RARITY_ORDER.index(current)
        if index + 1 >= len(RARITY_ORDER):
            return None
        return RARITY_ORDER[index + 1]

    def is_upgradeable_item(self, item):
        """Return True if the item can be upgraded."""
        if item.item_type in ("consumable", "quest_item"):
            return False
        current = item.rarity or "Common"
        return current != "Legendary"

    def upgrade_cost(self, item):
        """Calculate the upgrade cost based on current rarity."""
        current = item.rarity or "Common"
        multiplier = UPGRADE_COST_MULTIPLIERS.get(current)
        if not multiplier:
            return None
        return max(1, int(round(item.gold_value * multiplier)))

    def title_screen(self):
        """Display the game title screen with ASCII art."""
        clear_screen()
        title_art = r"""
+----------------------------------------------------+
|            ECHOES OF AETHELGARD                    |
+----------------------------------------------------+
                                               _
                 ___                          (_)
               _/XXX\
_             /XXXXXX\_                               
X\__    __   /X XXXX XX\                          _   
    \__/  \_/__       \ \                       _/X\_ 
  \  ___   \/  \_      \ \               __   _/      
 ___/   \__/   \ \__     \\__           /  \_//  _ _ 
/  __    \  /     \ \_   _//_\___     _/    //         
__/_______\________\__\_/________\_ _/_____/_________
"""
        slow_print([title_art], delay=0.1)

    def show_lore(self):
        """Display the game lore introduction."""
        clear_screen()
        self.print_section_header("Lore")
        slow_print(
            [
                "You are a Wayfinder, born with the rare ability to sense residual magic.",
                "Aethelgard lies shattered, its history fractured like the land itself.",
                "Will you restore balance... or exploit the chaos?",
                "",
            ],
            delay=0.35,
        )
        safe_input("Press Enter to return to the menu...")

    def choose_class(self):
        """Prompt the player to choose a class."""
        while True:
            clear_screen()
            self.print_section_header("Choose Your Class")
            print("1) Ranger (+2 Strength, Common Rusty Dagger)")
            print("2) Wizard (+2 Magic, Common Apprentice Staff)")
            print("3) Elf (+2 Agility, Common Primitive Bow)")
            choice = safe_input("Class (1-3 or name): ").strip().lower()
            mapping = {
                "1": "Ranger",
                "ranger": "Ranger",
                "2": "Wizard",
                "wizard": "Wizard",
                "3": "Elf",
                "elf": "Elf",
            }
            selected = mapping.get(choice)
            if selected:
                return selected
            print("Not a valid choice.")
            pause(0.5)

    def start_menu(self):
        """Prompt the player for a start menu choice."""
        while True:
            self.title_screen()
            print("1) New Game")
            print("2) Continue Game")
            print("3) View Scores")
            print("4) Read Lore")
            print("5) Quit")
            choice = safe_input("Choose an option: ").strip().lower()
            mapping = {
                "1": "new",
                "new": "new",
                "new game": "new",
                "2": "continue",
                "continue": "continue",
                "continue game": "continue",
                "3": "scores",
                "scores": "scores",
                "score": "scores",
                "4": "lore",
                "lore": "lore",
                "5": "quit",
                "quit": "quit",
                "exit": "quit",
            }
            selection = mapping.get(choice)
            if selection:
                return selection
            print("Not a valid choice.")
            pause(0.5)

    def start_new_game(self, slot=None):
        """Create a new player and begin at the Whispering Ruins."""
        class_name = self.choose_class()
        class_info = CLASS_DEFS[class_name]
        clear_screen()
        name = safe_input("Name your Wayfinder: ").strip()
        if not name:
            name = "Wayfinder"
        self.player = Player(name, "Whispering Ruins")
        self.player.class_name = class_name
        if slot is not None:
            self.current_save_slot = slot
        for stat, bonus in class_info["buff"].items():
            setattr(self.player, stat, getattr(self.player, stat) + bonus)
        starting_weapon = self.clone_item(class_info["weapon"], "Common")
        self.player.inventory.append(starting_weapon)
        self.player.equipped_weapon = starting_weapon
        self.previous_location = self.player.current_location
        self.pending_post_redraw_messages.append(class_info["intro"])
        self.update_lost_scroll_state()
        self.update_breach_boss_state()
        self.just_moved = True
        self.needs_redraw = True
        if slot is not None:
            self.save_game(quiet=True)

    def main_loop(self):
        """Main game loop: display location, handle input, update state."""
        while self.running:
            try:
                if self.needs_redraw:
                    self.needs_redraw = False
                    self.display_location()
                    location = self.world[self.player.current_location]
                    if self.just_moved and location.enemies:
                        encounter_name = location.enemies[0].name
                        lower_name = encounter_name.lower()
                        if lower_name.startswith(("the ", "a ", "an ")):
                            threat_name = encounter_name
                        else:
                            threat_name = f"a {encounter_name}"
                        danger_rule = danger("!" * 56)
                        print(danger_rule)
                        print(danger(f"You sense danger... {threat_name} approaches!"))
                        if encounter_name == "The Chronos Tyrant":
                            print(color_text(location.enemies[0].description, "2;37"))
                        print(danger_rule)
                        if encounter_name == "The Chronos Tyrant":
                            print()
                            pause(5.0)
                            safe_input("Press Enter to continue ")
                    self.just_moved = False
                    self.check_for_combat()
                    if not self.running:
                        break
                    if self.needs_redraw:
                        continue
                command = safe_input(color_text("\n> ", "1;37"))
                self.process_command(command)
            except KeyboardInterrupt:
                print()
                self.confirm_quit()

    # -----------------------------
    # Display and status helpers
    # -----------------------------

    def display_location(self):
        """Show the player's current location, items, NPCs, and exits."""
        location = self.world[self.player.current_location]
        clear_screen()
        self.print_status_bar()
        if location.art:
            print(location.art)
            pause(0.2)
        self.force_show_art = False
        self.print_divider()
        print(headline(location.name))
        self.print_divider()
        description = location.description
        if location.name == "Shattered Library" and self.horde_active:
            base_description = self.base_location_descriptions.get(location.name, location.description)
            description = (
                f"{base_description} A swirling, unstable portal now pulses between the shelves, "
                "casting long shadows across the fractured stacks."
            )
        elif location.name == "The Temporal Breach Apex" and self.horde_active:
            description = danger(
                "The Apex is collapsing into violent rifts. The air screams with tearing time, and "
                "every breath tastes of ash and panic. You must get out now."
            )
        slow_print([description], delay=0.2)
        if location.name == "Shattered Library" and self.horde_active:
            print(
                good(
                    "The portal in the library is the only escape. Enter it before the horde reaches the stacks."
                )
            )
        self.trigger_events(location)
        if self.pending_encounter_message:
            print(danger(self.pending_encounter_message))
            self.pending_encounter_message = None
        self.player.visited_locations.add(location.name)
        if location.name == "The Temporal Breach Apex":
            self.update_breach_boss_state()
        if location.name == "Heartstone Depths":
            self.handle_heartstone()

        self.print_divider()
        if location.items:
            item_names = self.format_item_list(location.items)
            print(good(f"Items here: {item_names}"))
        if location.npcs:
            npc_names = ", ".join(npc.name for npc in location.npcs)
            print(npc_name(f"You see someone: {npc_names}"))

        self.print_divider()
        print(f"Exits: {self.format_exits(location)}")
        self.print_minimap()
        self.print_divider()
        print(self.inventory_summary())
        if self.pending_post_redraw_messages:
            for message in self.pending_post_redraw_messages:
                print(message)
            self.pending_post_redraw_messages = []

    def display_status(self, enemy=None):
        """Display health and mana bars for player and enemy."""
        hp = color_text(self.format_bar_value(self.player.health, self.player.max_health), "1;31")
        mp = color_text(self.format_bar_value(self.player.mana, self.player.max_mana), "1;34")
        print(f"Your Health: {hp} | Mana: {mp}")
        if enemy:
            enemy_hp = color_text(self.format_bar_value(enemy.health, enemy.max_health), "1;31")
            print(f"{enemy.name} Health: {enemy_hp}")

    def format_bar_value(self, current, maximum):
        """Format a current/max pair as integers for display."""
        return f"{int(round(current))}/{int(round(maximum))}"

    def print_status_bar(self):
        """Render the compact status bar for the top of the screen."""
        hp = color_text(self.format_bar_value(self.player.health, self.player.max_health), "1;31")
        mp = color_text(self.format_bar_value(self.player.mana, self.player.max_mana), "1;34")
        gold = color_text(str(self.player.gold), "1;33")
        location = color_text(self.player.current_location, "1;36")
        level = color_text(str(self.player.level), "1;35")
        xp_required = self.player.level * 100
        xp = color_text(f"{self.player.experience}/{xp_required}", "2;37")
        print(f"HP {hp} | MP {mp} | Lvl {level} | XP {xp} | Gold {gold} | Loc {location}")
        self.print_divider()

    def add_combat_log(self, message):
        """Store a combat message for the refreshed combat view."""
        if not message:
            return
        self.combat_log.append(message)
        if len(self.combat_log) > COMBAT_LOG_LIMIT:
            self.combat_log = self.combat_log[-COMBAT_LOG_LIMIT:]

    def render_combat_screen(self, enemy):
        """Render the combat HUD with the latest messages."""
        clear_screen()
        self.print_status_bar()
        enemy_hp = color_text(self.format_bar_value(enemy.health, enemy.max_health), "1;31")
        print(f"{enemy.name} Health: {enemy_hp}")
        if self.combat_log:
            self.print_divider()
            for line in self.combat_log[-COMBAT_LOG_LIMIT:]:
                print(line)

    def compute_score(self, result=None):
        """Calculate the final score for the current run."""
        damage_score = (self.player.damage_done + 1) // 2
        score = (self.player.total_gold_earned * 5) + damage_score + self.player.total_xp_earned
        if result and result.upper() == "LOSS":
            score = score // 2
        return score

    def load_scores(self):
        """Load prior run scores from disk."""
        if not os.path.exists(SCORES_FILE):
            return []
        try:
            with open(SCORES_FILE, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(data, list):
            return []
        return data

    def save_scores(self, scores):
        """Persist run scores to disk."""
        try:
            with open(SCORES_FILE, "w", encoding="utf-8") as handle:
                json.dump(scores, handle, indent=2)
        except OSError as exc:
            print(danger(f"Failed to save scores: {exc}"))

    def record_score(self, result):
        """Record the current run's score once."""
        if self.score_saved:
            return
        entry = {
            "played_at": datetime.now().isoformat(timespec="seconds"),
            "player": self.player.name,
            "score": self.compute_score(result),
            "level": self.player.level,
            "xp": self.player.experience,
            "total_gold_earned": self.player.total_gold_earned,
            "result": result,
            "class_name": self.player.class_name,
        }
        scores = self.load_scores()
        scores.append(entry)
        self.save_scores(scores)
        self.score_saved = True

    def show_scores(self):
        """Display a list of high scores."""
        clear_screen()
        self.print_section_header("Scores")
        scores = self.load_scores()
        if not scores:
            print("No scores recorded yet.")
            safe_input("Press Enter to return to the menu...")
            return
        scores.sort(key=lambda entry: entry.get("score", 0), reverse=True)
        for idx, entry in enumerate(scores, 1):
            score = entry.get("score", 0)
            name = entry.get("player", "Wayfinder")
            class_name = entry.get("class_name", "Ranger")
            level = entry.get("level", "?")
            result = entry.get("result", "Unknown")
            played = entry.get("played_at", "Unknown date")
            if played != "Unknown date":
                try:
                    played_date = datetime.fromisoformat(played)
                    played = f"{played_date.strftime('%B')} {played_date.day}, {played_date.year}"
                except ValueError:
                    played = "Unknown date"
            print(f"{idx}) {score} | {name} | {class_name} | Lvl {level} | {result} | {played}")
        safe_input("Press Enter to return to the menu...")

    def print_endgame_summary(self, title, subtitle=None, accent="1;36"):
        """Display a styled endgame summary."""
        rule = color_text("=" * 60, accent)
        print(rule)
        print(color_text(title.center(60), accent))
        print(rule)
        if subtitle:
            print(color_text(subtitle, "1;37"))
        result = "WIN" if title.upper() == "ESCAPE" else "LOSS"
        score = self.compute_score(result)
        print(color_text(f"Score: {score}", "1;32"))
        print(color_text("Final Stats", "1;33"))
        xp_required = self.player.level * 100
        print(f"Wayfinder: {self.player.name}")
        print(f"Level: {self.player.level} | XP: {self.player.experience}/{xp_required}")
        print(f"Total gold earned: {self.player.total_gold_earned}")
        print(f"Enemies killed:    {self.player.enemies_killed}")
        print(f"Damage dealt:      {self.player.damage_done}")
        print(f"Damage received:   {self.player.damage_received}")
        self.record_score(result)
        print(color_text("a game by Tim Dibert", "2;37"))

    def inventory_summary(self, limit=5):
        """Summarize inventory in a compact, subdued line."""
        if not self.player.inventory:
            text = "Inventory: (empty)"
            return color_text(text, "2;37")
        order, counts = self.summarize_items_with_counts(self.player.inventory)
        dim_color = "2;37"
        dim_label = color_text("Inventory: ", dim_color)
        dim_sep = color_text(", ", dim_color)
        if len(order) > limit:
            parts = []
            for item in order[:limit]:
                count = counts[self.item_key(item)]
                name = self.format_item_name(item, dim=True)
                if count > 1:
                    name = f"{name}{color_text(f' (x{count})', dim_color)}"
                type_tag = self.format_item_type_tag(item, dim=True)
                if type_tag:
                    name = f"{name} {type_tag}"
                parts.append(name)
            shown = dim_sep.join(parts)
            dim_more = color_text(f" (+{len(order) - limit} more)", dim_color)
            return f"{dim_label}{shown}{dim_more}"
        else:
            parts = []
            for item in order:
                count = counts[self.item_key(item)]
                name = self.format_item_name(item, dim=True)
                if count > 1:
                    name = f"{name}{color_text(f' (x{count})', dim_color)}"
                type_tag = self.format_item_type_tag(item, dim=True)
                if type_tag:
                    name = f"{name} {type_tag}"
                parts.append(name)
            shown = dim_sep.join(parts)
            return f"{dim_label}{shown}"

    def summarize_description(self, text, max_len=90):
        """Return a short, single-sentence summary."""
        summary = " ".join(text.split())
        for sep in (".", "!", "?"):
            index = summary.find(sep)
            if index != -1 and index + 1 < len(summary):
                summary = summary[: index + 1]
                break
        if len(summary) > max_len:
            summary = summary[: max_len - 3].rstrip() + "..."
        return summary

    def format_direction_label(self, direction, destination, capitalize=False):
        """Format direction labels, dimming already-visited destinations."""
        label = direction.capitalize() if capitalize else direction
        if destination in self.player.visited_locations:
            return color_text(label, "2;37")
        return label

    def is_exit_locked(self, destination, current_location=None):
        """Return True if an exit is not yet available."""
        if destination == "Heartstone Depths":
            return not self.player.flags.get("heartstone_unlocked")
        if destination == "Barren Peaks" and current_location == "Ironclad Camp":
            return self.get_quest("clear_path") is None
        if destination == "Voidscar Hollow" and current_location == "Chasm of Whispers":
            return self.get_quest("void_shards") is None
        if destination == "The Temporal Breach Apex" and current_location == "The Chronos Nexus":
            return self.count_completed_quests() < 6
        return False

    def available_exits(self, location):
        """Return exits that are currently available to the player."""
        return {
            direction: destination
            for direction, destination in location.exits.items()
            if not self.is_exit_locked(destination, location.name)
        }

    def format_exits(self, location):
        """Format exit directions with visited locations subdued."""
        parts = []
        for direction, destination in self.available_exits(location).items():
            parts.append(self.format_direction_label(direction, destination))
        return ", ".join(parts)

    def print_direction_previews(self, location):
        """Show brief sightlines for each exit."""
        for direction, destination in self.available_exits(location).items():
            dest_location = self.world.get(destination)
            if not dest_location:
                continue
            summary = self.summarize_description(dest_location.description)
            direction_label = self.format_direction_label(direction, destination, capitalize=True)
            details = color_text(f": {dest_location.name} - {summary}", "2;37")
            print(f"{direction_label}{details}")

    def get_minimap_visibility(self):
        """Return visited and adjacent locations for minimap discovery."""
        visited = set(self.player.visited_locations)
        visited.add(self.player.current_location)
        adjacent = set()
        for loc_name in visited:
            location = self.world.get(loc_name)
            if not location:
                continue
            for destination in location.exits.values():
                if destination not in visited:
                    adjacent.add(destination)
        return visited, adjacent

    def get_quest_ready_locations(self):
        """Return locations with NPCs ready to turn in a quest."""
        ready = set()
        quest = self.get_quest("echo_crystal")
        if quest and quest.status != "completed" and self.player_has_item("Echo Crystal"):
            ready.add("Whispering Ruins")
        quest = self.get_quest("lost_scroll")
        if quest and quest.status != "completed" and self.player_has_item("Scholar's Lost Scroll"):
            ready.add("Whispering Ruins")
        quest = self.get_quest("clear_path")
        if quest and quest.status != "completed" and self.player.flags.get("defeated_wildling"):
            ready.add("Ironclad Camp")
        quest = self.get_quest("blighted_outpost")
        if quest and quest.status != "completed":
            if not self.location_has_enemy("Blighted Outpost", "Stone-Hide Golem"):
                ready.add("Ironclad Camp")
        quest = self.get_quest("void_shards")
        if quest and quest.status != "completed" and self.count_inventory_items("Void Shard") >= 3:
            ready.add("Chasm of Whispers")
        return ready

    def print_minimap(self, show_known=False):
        """Render a small, directional map as the player explores."""
        visited, adjacent = self.get_minimap_visibility()
        infected = set(self.infected_locations) if self.horde_active else set()
        visible = visited | adjacent | infected
        width = max(data["pos"][0] + MINIMAP_LABEL_WIDTH for data in MINIMAP_LAYOUT.values())
        height = max(data["pos"][1] for data in MINIMAP_LAYOUT.values()) + 1
        grid = [[" " for _ in range(width)] for _ in range(height)]
        dim_edges = set()
        for start, end in MINIMAP_EDGES:
            if start in visited and end in adjacent:
                dim_edges.add((start, end))
            elif end in visited and start in adjacent:
                dim_edges.add((start, end))

        def place_text(x, y, text):
            for offset, char in enumerate(text):
                if 0 <= x + offset < width and 0 <= y < height:
                    grid[y][x + offset] = char

        for start, end in MINIMAP_EDGES:
            if start not in visible or end not in visible:
                continue
            x1, y1 = MINIMAP_LAYOUT[start]["pos"]
            x2, y2 = MINIMAP_LAYOUT[end]["pos"]
            dim_edge = (start, end) in dim_edges
            if y1 == y2:
                left = min(x1, x2) + MINIMAP_LABEL_WIDTH
                right = max(x1, x2)
                for x in range(left, right):
                    grid[y1][x] = "." if dim_edge else "-"
            elif x1 == x2:
                column = x1 + 1
                top = min(y1, y2) + 1
                bottom = max(y1, y2)
                for y in range(top, bottom):
                    grid[y][column] = ":" if dim_edge else "|"

        blocked_positions = set()
        for loc_name, location in self.world.items():
            if loc_name not in visible:
                continue
            for direction, destination in location.exits.items():
                if destination not in visible:
                    continue
                if not self.is_exit_locked(destination, loc_name):
                    continue
                if loc_name not in MINIMAP_LAYOUT or destination not in MINIMAP_LAYOUT:
                    continue
                x1, y1 = MINIMAP_LAYOUT[loc_name]["pos"]
                x2, y2 = MINIMAP_LAYOUT[destination]["pos"]
                if y1 == y2:
                    if x2 > x1:
                        block_x = x1 + MINIMAP_LABEL_WIDTH
                    else:
                        block_x = x1 - 1
                    block_y = y1
                elif x1 == x2:
                    block_x = x1 + 1
                    block_y = y1 + 1 if y2 > y1 else y1 - 1
                else:
                    continue
                if 0 <= block_y < height and 0 <= block_x < width:
                    blocked_positions.add((block_x, block_y))

        for block_x, block_y in blocked_positions:
            grid[block_y][block_x] = "x"

        current_abbr = MINIMAP_LAYOUT.get(self.player.current_location, {}).get("abbr")
        infected_abbrs = {
            MINIMAP_LAYOUT[name]["abbr"]
            for name in infected
            if name in MINIMAP_LAYOUT and name != self.player.current_location
        }
        escape_abbr = MINIMAP_LAYOUT.get("Shattered Library", {}).get("abbr")
        ready_locations = self.get_quest_ready_locations()
        ready_abbrs = {
            MINIMAP_LAYOUT[name]["abbr"]
            for name in ready_locations
            if name in MINIMAP_LAYOUT and name != self.player.current_location
        }
        npc_abbrs = set()
        for name in visited:
            if name == self.player.current_location:
                continue
            location = self.world.get(name)
            if location and location.npcs:
                abbr = MINIMAP_LAYOUT.get(name, {}).get("abbr")
                if abbr:
                    npc_abbrs.add(abbr)
        npc_abbrs -= ready_abbrs
        for name, data in MINIMAP_LAYOUT.items():
            x, y = data["pos"]
            abbr = data["abbr"]
            if name == self.player.current_location:
                label = f"<{abbr}>"
            elif name in infected:
                label = f"[{abbr}]"
            elif name in visited:
                label = f"[{abbr}]"
            elif name in adjacent:
                label = "[??]"
            else:
                label = " " * MINIMAP_LABEL_WIDTH
            place_text(x, y, label)

        self.print_section_header("Mini-map")
        for row in grid:
            row_text = "".join(row).rstrip()
            if "[??]" in row_text:
                row_text = row_text.replace("[??]", color_text("[??]", "2;37"))
            if "." in row_text:
                row_text = row_text.replace(".", color_text(".", "2;37"))
            if ":" in row_text:
                row_text = row_text.replace(":", color_text(":", "2;37"))
            if "x" in row_text:
                row_text = row_text.replace("x", color_text("x", "1;31"))
            if current_abbr:
                current_color = "1;31" if self.player.current_location in infected else "1;34"
                row_text = row_text.replace(
                    f"<{current_abbr}>", color_text(f"<{current_abbr}>", current_color)
                )
            for abbr in ready_abbrs:
                row_text = row_text.replace(f"[{abbr}]", color_text(f"[{abbr}]", "1;32"))
            for abbr in npc_abbrs:
                row_text = row_text.replace(f"[{abbr}]", color_text(f"[{abbr}]", "1;33"))
            for abbr in infected_abbrs:
                row_text = row_text.replace(f"[{abbr}]", color_text(f"[{abbr}]", "1;31"))
            if self.horde_active and escape_abbr:
                row_text = row_text.replace(f"[{escape_abbr}]", color_text(f"[{escape_abbr}]", "1;32"))
            print(row_text)
        if show_known:
            known = [name for name in MINIMAP_LAYOUT if name in visited]
            if known:
                legend = " | ".join(f"{MINIMAP_LAYOUT[name]['abbr']} {name}" for name in known)
                print(color_text(f"Known: {legend}", "2;37"))

    def format_item_list(self, items):
        """Format item names, collapsing duplicates with counts."""
        order, counts = self.summarize_items_with_counts(items)
        parts = []
        for item in order:
            count = counts[self.item_key(item)]
            name = self.format_item_name(item)
            if count > 1:
                parts.append(f"{name} (x{count})")
            else:
                parts.append(name)
        return ", ".join(parts)

    def format_consumable_options(self):
        """Return a consumable options line, or None if none exist."""
        consumables = [item for item in self.player.inventory if item.item_type == "consumable"]
        if not consumables:
            return None
        options = self.format_item_list(consumables)
        return f"Consumables: {options}"

    def wait_for_continue(self):
        """Pause so the player can read the current output."""
        safe_input("Press Enter to continue...")

    def print_divider(self):
        """Print a thin divider rule for section separation."""
        print(color_text(UI_RULE, "2;37"))

    def print_section_header(self, title):
        """Print a titled section with divider rules."""
        self.print_divider()
        print(headline(title))
        self.print_divider()

    def format_currency(self, amount):
        """Format gold values consistently."""
        return f"{amount} gold"

    def item_key(self, item):
        """Return a hashable key for item stacking."""
        return (item.name, item.rarity)

    def format_item_name(self, item, dim=False):
        """Format item names with rarity tags when applicable."""
        if item.rarity:
            name = f"[{item.rarity}] {item.name}"
            color_map = {
                "Common": "37",
                "Uncommon": "32",
                "Rare": "34",
                "Epic": "35",
                "Legendary": "33",
            }
            color = color_map.get(item.rarity)
            if color:
                style = "2" if dim else "1"
                return color_text(name, f"{style};{color}")
            if dim:
                return color_text(name, "2;37")
            return name
        if dim:
            return color_text(item.name, "2;37")
        return item.name

    def format_item_type_tag(self, item, dim=False):
        """Return a colored tag for item types shown in inventory."""
        if item.item_type == "consumable":
            style = "2;32" if dim else "1;32"
            return color_text("[Consumable]", style)
        return ""

    def parse_item_query(self, item_name):
        """Normalize item queries and extract any rarity tag."""
        normalized = normalize_name(item_name).replace("[", "").replace("]", "")
        rarity = None
        for name in RARITY_MULTIPLIERS:
            tier = name.lower()
            if tier in normalized:
                rarity = name
                normalized = normalized.replace(tier, "").strip()
                break
        return normalized, rarity

    def summarize_items_with_counts(self, items):
        """Return ordered item stacks and counts."""
        counts = {}
        order = []
        for item in items:
            key = self.item_key(item)
            if key not in counts:
                counts[key] = 0
                order.append(item)
            counts[key] += 1
        return order, counts

    def serialize_item(self, item):
        """Serialize an item for save data."""
        data = {"name": item.name}
        if item.rarity:
            data["rarity"] = item.rarity
        return data

    def serialize_enemy(self, enemy):
        """Serialize an enemy for save data."""
        data = {"name": enemy.name, "health": enemy.health}
        if getattr(enemy, "scaled", False):
            data["level"] = enemy.level
        return data

    def deserialize_item(self, entry):
        """Deserialize an item from save data."""
        if isinstance(entry, dict):
            name = entry.get("name")
            rarity = entry.get("rarity")
        else:
            name = entry
            rarity = None
        if not name:
            return None
        return self.safe_clone_item(name, rarity=rarity)

    # -----------------------------
    # Command handling
    # -----------------------------

    def process_command(self, command):
        """Parse input and route to the appropriate handler."""
        if not command.strip():
            return
        command = command.strip()
        tokens = command.split()
        verb = tokens[0].lower()
        args = tokens[1:]

        if self.horde_active and self.player.current_location == "The Temporal Breach Apex":
            movement_verbs = {
                "north",
                "south",
                "east",
                "west",
                "n",
                "s",
                "e",
                "w",
                "up",
                "down",
                "left",
                "right",
            }
            if verb in ("go", "move") and args:
                pass
            elif verb in movement_verbs:
                pass
            elif verb in ("save", "quit", "exit", "load"):
                pass
            else:
                print(danger("No time for that. You must run!"))
                return

        if verb in ("go", "move") and args:
            self.move_player(self.normalize_direction(args[0].lower()))
        elif verb in ("north", "south", "east", "west", "n", "s", "e", "w", "up", "down", "left", "right"):
            self.move_player(self.normalize_direction(verb))
        elif verb == "look":
            self.force_show_art = True
            self.display_location()
            self.needs_redraw = False
        elif verb == "help":
            self.print_help()
            self.wait_for_continue()
            self.needs_redraw = True
        elif verb == "take" and args:
            if " ".join(args).lower() in ("all", "everything"):
                self.take_all_items()
            else:
                self.take_item(" ".join(args))
        elif verb == "drop" and args:
            self.drop_item(" ".join(args))
        elif verb == "inventory" or verb == "inv":
            self.show_inventory()
            self.needs_redraw = False
        elif verb == "equip" and args:
            self.equip_item(" ".join(args))
        elif verb == "equip":
            print("Equip what?")
        elif verb == "use" and args:
            self.use_item(" ".join(args))
        elif verb == "use":
            print("Use what?")
            options = self.format_consumable_options()
            if options:
                print(options)
            else:
                print("You have no consumables.")
        elif verb == "talk" and args:
            if args[0].lower() == "to":
                args = args[1:]
            if not args:
                print("Talk to whom?")
            else:
                self.talk_to_npc(" ".join(args))
                self.wait_for_continue()
                self.needs_redraw = True
        elif verb == "quests":
            self.show_quests()
            self.needs_redraw = False
        elif verb == "stats":
            self.show_stats()
            self.needs_redraw = False
        elif verb == "map":
            self.print_minimap(show_known=True)
            self.needs_redraw = False
        elif verb == "read" and args:
            query = " ".join(args).strip().lower()
            if query in ("book", "spellbook", "dark spellbook", "tome", "dark tome"):
                self.use_item("Dark Spellbook")
            else:
                print("You can only read spellbooks for now.")
        elif verb in ("examine", "inspect", "info") and args:
            self.examine_item(" ".join(args))
            self.needs_redraw = False
        elif verb == "save":
            self.save_game_prompt()
        elif verb == "load":
            if self.load_game_prompt():
                self.needs_redraw = True
        elif verb == "enter" and args:
            if "portal" in args:
                self.enter_portal()
            else:
                print("Enter what?")
        elif verb == "portal":
            self.enter_portal()
        elif verb == "quit" or verb == "exit":
            self.confirm_quit()
        else:
            print("Command not recognized. Type 'help' for a list of actions.")

        # Horde advances only on successful movement.

    def confirm_quit(self):
        """Ask whether to save before quitting."""
        if not self.player:
            self.running = False
            return
        try:
            choice = safe_input("Save before quitting? (yes/no): ").strip().lower()
        except KeyboardInterrupt:
            print()
            self.running = False
            return
        if choice in ("yes", "y"):
            self.save_game_prompt()
            self.running = False
        elif choice in ("no", "n"):
            self.running = False
        else:
            print("Continuing your journey.")

    def print_help(self):
        """Display available commands for exploration and progression."""
        self.print_section_header("Commands")
        print("go/move <direction> | north/south/east/west")
        print("look | take <item> | drop <item>")
        print("use <item> | equip <item> | inventory")
        print("examine <item> | talk <npc> | quests | stats | map")
        print("save | load | quit")

    def normalize_direction(self, direction):
        """Convert shorthand directions to full words."""
        mapping = {
            "n": "north",
            "s": "south",
            "e": "east",
            "w": "west",
            "up": "north",
            "down": "south",
            "left": "west",
            "right": "east",
        }
        return mapping.get(direction, direction)

    def resolve_item(self, item_name, items):
        """Find an item by exact or partial match, returning matches if ambiguous."""
        normalized, rarity = self.parse_item_query(item_name)
        if not normalized:
            return None, None
        exact_matches = [
            item
            for item in items
            if normalize_name(item.name) == normalized and (not rarity or item.rarity == rarity)
        ]
        if exact_matches:
            unique_keys = {self.item_key(item) for item in exact_matches}
            if len(unique_keys) == 1:
                return exact_matches[0], []
            return None, exact_matches
        partial_matches = [
            item
            for item in items
            if normalized in normalize_name(item.name) and (not rarity or item.rarity == rarity)
        ]
        if partial_matches:
            unique_keys = {self.item_key(item) for item in partial_matches}
            if len(unique_keys) == 1:
                return partial_matches[0], []
        if len(partial_matches) == 1:
            return partial_matches[0], []
        if partial_matches:
            return None, partial_matches
        return None, None

    def resolve_npc(self, npc_name, npcs):
        """Find an NPC by exact or partial match, returning matches if ambiguous."""
        normalized = normalize_name(npc_name)
        exact_matches = [npc for npc in npcs if normalize_name(npc.name) == normalized]
        if exact_matches:
            return exact_matches[0], []
        partial_matches = [npc for npc in npcs if normalized in normalize_name(npc.name)]
        if len(partial_matches) == 1:
            return partial_matches[0], []
        if partial_matches:
            return None, partial_matches
        return None, None

    def examine_item(self, item_name):
        """Inspect an item in the inventory or the current location."""
        location = self.world[self.player.current_location]
        item, matches = self.resolve_item(item_name, self.player.inventory)
        if not item:
            item, matches = self.resolve_item(item_name, location.items)
        if item:
            print(headline(self.format_item_name(item)))
            print(item.description)
            if item.effect:
                print(f"Effects: {item.effect}")
            print(f"Type: {item.item_type}")
            return
        if matches:
            options = self.format_item_list(matches)
            print(f"Which item did you mean? {options}")
        else:
            print("You don't see that item here.")

    # -----------------------------
    # Movement and location events
    # -----------------------------

    def move_player(self, direction):
        """Move the player if the chosen exit exists."""
        location = self.world[self.player.current_location]
        available = self.available_exits(location)
        if direction in available:
            destination = available[direction]
            skip_horde_spread = False
            if self.horde_active and destination in self.infected_locations:
                damage = max(1, int(math.ceil(self.player.max_health / 3)))
                self.player.health = max(0, self.player.health - damage)
                message = (
                    "The horde lashes out as you push through. Claws rake your skin, leaving "
                    f"bloody lacerations. You take {damage} damage."
                )
                if self.player.health <= 0:
                    print(danger(message))
                    self.game_over()
                    return
                self.pending_post_redraw_messages.append(danger(message))
                skip_horde_spread = True
            self.previous_location = self.player.current_location
            was_visited = destination in self.player.visited_locations
            self.player.current_location = destination
            if destination == "The Temporal Breach Apex":
                if not self.player.flags.get("apex_first_entry"):
                    self.player.flags["apex_first_entry"] = True
                    self.player.health = self.player.max_health
                    self.player.mana = self.player.max_mana
            if location.name == "The Chronos Nexus" and destination == "The Temporal Breach Apex":
                self.save_game()
            if self.player.health < self.player.max_health:
                regen = max(1, int(self.player.max_health * 0.02))
                self.player.health = min(self.player.max_health, self.player.health + regen)
            self.restock_merchant_if_needed()
            self.maybe_spawn_return_encounter(self.world[destination], was_visited)
            if not skip_horde_spread:
                self.spread_horde()
            if self.horde_active and self.previous_location == "The Temporal Breach Apex":
                self.pending_post_redraw_messages.append(
                    good(
                        "Brak gave me a chance to get out of there and make it to the portal before the horde "
                        "swallows Aethelgard. His sacrifice will not be forgotten."
                    )
                )
            if (
                self.horde_active
                and self.previous_location == "The Temporal Breach Apex"
                and not self.player.flags.get("portal_warning_given")
            ):
                escape_message = good(
                    "A new pulse blooms in the Shattered Library, a raw portal clawing at the air. "
                    "Its light flickers like a heartbeat on the verge of collapse. Reach it before "
                    "the horde swallows the path and the last escape seals."
                )
                if self.world[destination].enemies:
                    self.pending_post_combat_messages.append(escape_message)
                else:
                    self.pending_post_redraw_messages.append(escape_message)
            self.just_moved = True
            self.needs_redraw = True
        elif direction in location.exits and self.is_exit_locked(location.exits[direction], location.name):
            destination = location.exits[direction]
            if destination == "Barren Peaks" and location.name == "Ironclad Camp":
                print("I should talk to Brak before going this way.")
            elif destination == "Voidscar Hollow" and location.name == "Chasm of Whispers":
                print("I should talk with Nyx before going this way.")
            elif destination == "The Temporal Breach Apex" and location.name == "The Chronos Nexus":
                print("I can't help but feeling I need to go back and see what else needs done first.")
            else:
                print("A sealed passage blocks your way. Something deeper must call you first.")
        else:
            print("You cannot travel that way.")

    def trigger_events(self, location):
        """Fire one-time or repeatable events tied to a location."""
        for event in location.events:
            if event["once"] and event["id"] in self.triggered_events:
                continue
            print(color_text(event["text"], "1;35"))
            if event["once"]:
                self.triggered_events.add(event["id"])

    def maybe_spawn_return_encounter(self, location, was_visited):
        """Possibly spawn an enemy when returning to a known location."""
        if not was_visited:
            return
        if location.enemies:
            return
        if random.random() > RETURN_ENCOUNTER_CHANCE:
            return
        enemy_name = random.choice(self.wandering_enemy_pool)
        location.enemies.append(self.clone_enemy(enemy_name))
        self.pending_encounter_message = "A lurking threat stirs as you return."

    # -----------------------------
    # Inventory and items
    # -----------------------------

    def take_item(self, item_name):
        """Pick up an item from the current location."""
        location = self.world[self.player.current_location]
        item, matches = self.resolve_item(item_name, location.items)
        if item:
            location.items.remove(item)
            self.player.inventory.append(item)
            if item.major:
                self.show_item_art(item)
            self.pending_post_redraw_messages.append(good(f"You take the {self.format_item_name(item)}."))
            equip_message = self.auto_equip_armor(item)
            if equip_message:
                self.pending_post_redraw_messages.append(equip_message)
            self.apply_passive_item_effect(item)
            self.needs_redraw = True
            return
        if matches:
            options = self.format_item_list(matches)
            print(f"Which item did you mean? {options}")
            return
        print("That item is not here.")

    def take_all_items(self):
        """Pick up all items from the current location."""
        location = self.world[self.player.current_location]
        if not location.items:
            print("There is nothing here to take.")
            return
        items_to_take = list(location.items)
        location.items.clear()
        equip_message = None
        for item in items_to_take:
            self.player.inventory.append(item)
            if item.major:
                self.show_item_art(item)
            if not equip_message:
                equip_message = self.auto_equip_armor(item)
            self.apply_passive_item_effect(item)
        order, counts = self.summarize_items_with_counts(items_to_take)
        parts = []
        for item in order:
            count = counts[self.item_key(item)]
            name = self.format_item_name(item)
            if count > 1:
                parts.append(f"{name} (x{count})")
            else:
                parts.append(name)
        summary = ", ".join(parts)
        self.pending_post_redraw_messages.append(good(f"You take: {summary}."))
        if equip_message:
            self.pending_post_redraw_messages.append(equip_message)
        self.needs_redraw = True

    def auto_equip_armor(self, item):
        """Equip armor automatically if none is currently worn."""
        if item.item_type != "armor":
            return None
        if self.player.equipped_armor:
            return None
        self.player.equipped_armor = item
        defense = item.effect.get("defense", 0)
        return good(
            f"You put on the {self.format_item_name(item)}, gaining {defense} defense points."
        )

    def drop_item(self, item_name):
        """Drop an item into the current location."""
        item, matches = self.resolve_item(item_name, self.player.inventory)
        if item:
            if self.player.equipped_weapon == item:
                self.player.equipped_weapon = None
            if self.player.equipped_armor == item:
                self.player.equipped_armor = None
            self.player.inventory.remove(item)
            self.world[self.player.current_location].items.append(item)
            print(f"You drop the {self.format_item_name(item)}.")
            self.needs_redraw = True
            return
        if matches:
            order, counts = self.summarize_items_with_counts(matches)
            print("Which item did you mean?")
            for index, match in enumerate(order, 1):
                key = self.item_key(match)
                count_tag = f" (x{counts[key]})" if counts[key] > 1 else ""
                print(f"{index}) {self.format_item_name(match)}{count_tag}")
            choice = safe_input("Equip which item? (number or 'back'): ").strip().lower()
            if not choice or choice == "back":
                return
            if choice.isdigit():
                selection = int(choice)
                if 1 <= selection <= len(order):
                    item = order[selection - 1]
                    if item.item_type == "weapon":
                        self.player.equipped_weapon = item
                        print(good(f"You equip the {self.format_item_name(item)}."))
                        return
                    if item.item_type == "armor":
                        self.player.equipped_armor = item
                        print(good(f"You equip the {self.format_item_name(item)}."))
                        return
                    print("You can only equip weapons or armor.")
                    return
            print("Please choose a valid number.")
            return
        print("You don't have that item.")

    def show_inventory(self):
        """List the player's inventory."""
        if not self.player.inventory:
            print("Your inventory is empty.")
            return
        self.print_section_header("Inventory")
        order, counts = self.summarize_items_with_counts(self.player.inventory)
        equipped_weapon = self.player.equipped_weapon
        equipped_armor = self.player.equipped_armor
        for item in order:
            key = self.item_key(item)
            equip_tags = []
            if equipped_weapon and self.item_key(equipped_weapon) == key:
                equip_tags.append("equipped weapon")
            if equipped_armor and self.item_key(equipped_armor) == key:
                equip_tags.append("equipped armor")
            count_tag = f" (x{counts[key]})" if counts[key] > 1 else ""
            equip_tag = f" ({', '.join(equip_tags)})" if equip_tags else ""
            name = self.format_item_name(item)
            type_tag = self.format_item_type_tag(item, dim=False)
            type_suffix = f" {type_tag}" if type_tag else ""
            print(f"- {name}{count_tag}{equip_tag}{type_suffix}")
            stats_tag = self.format_merchant_item_stats(item)
            if stats_tag:
                print(f"        {stats_tag}")

    def equip_item(self, item_name):
        """Equip a weapon or armor from the inventory."""
        item, matches = self.resolve_item(item_name, self.player.inventory)
        if item:
            if item.item_type == "weapon":
                self.player.equipped_weapon = item
                print(good(f"You equip the {self.format_item_name(item)}."))
                return
            if item.item_type == "armor":
                self.player.equipped_armor = item
                print(good(f"You equip the {self.format_item_name(item)}."))
                return
            print("You can only equip weapons or armor.")
            return
        if matches:
            options = self.format_item_list(matches)
            print(f"Which item did you mean? {options}")
            return
        print("You don't have that item.")

    def use_item(self, item_name, in_combat=False):
        """Use a consumable item and apply its effects."""
        item, matches = self.resolve_item(item_name, self.player.inventory)
        if item:
            if item.item_type != "consumable":
                if in_combat:
                    return False, ["That item cannot be used right now."]
                print("That item cannot be used right now.")
                return False
            if item.name == "Dark Spellbook" and self.player.current_active_spell == "lightning bolt":
                message = (
                    "I've already seen too much. Better to avoid any furtherance into dark spells "
                    "before it corrupts the mind."
                )
                if in_combat:
                    return False, [message]
                print(message)
                return False
            messages = self.apply_item_effect(item)
            if item.name == "Dark Spellbook":
                messages.extend(self.handle_dark_spellbook_use())
            self.player.inventory.remove(item)
            use_line = good(f"You use the {self.format_item_name(item)}.")
            if in_combat:
                if self.player.health <= 0:
                    self.game_over()
                return True, messages + [use_line]
            if self.player.health <= 0:
                for message in messages:
                    print(message)
                print(use_line)
                self.game_over()
                return True
            self.pending_post_redraw_messages.extend(messages)
            self.pending_post_redraw_messages.append(use_line)
            self.needs_redraw = True
            return True
        if matches:
            options = self.format_item_list(matches)
            if in_combat:
                return False, [f"Which item did you mean? {options}"]
            print(f"Which item did you mean? {options}")
            return False
        if in_combat:
            return False, ["You don't have that item."]
        print("You don't have that item.")
        return False

    def apply_passive_item_effect(self, item):
        """Apply passive effects for relics once, preventing stacking exploits."""
        if item.item_type != "quest_item" or not item.effect:
            return
        flag_key = f"passive_bonus_{item.name}"
        if self.player.flags.get(flag_key):
            return
        if "health" in item.effect:
            amount = item.effect["health"]
            if amount >= 0:
                self.player.health = min(self.player.max_health, self.player.health + amount)
                print(good("Warmth floods through your body."))
            else:
                self.player.health = max(0, self.player.health + amount)
                print(danger("The relic's power bites back."))
        if "mana" in item.effect:
            amount = item.effect["mana"]
            if amount >= 0:
                self.player.mana = min(self.player.max_mana, self.player.mana + amount)
                print(good("A clear, cool current fills your senses."))
        if "magic" in item.effect:
            self.player.magic += item.effect["magic"]
            print(good("Arcane power stirs within you."))
        if "strength" in item.effect:
            self.player.strength += item.effect["strength"]
        if "agility" in item.effect:
            self.player.agility += item.effect["agility"]
        self.player.flags[flag_key] = True
        if self.player.health <= 0:
            self.game_over()

    def apply_item_effect(self, item):
        """Apply item effects to the player (health, mana, or stats)."""
        messages = []
        before = {
            "health": self.player.health,
            "mana": self.player.mana,
            "magic": self.player.magic,
            "strength": self.player.strength,
            "agility": self.player.agility,
        }
        if "health" in item.effect:
            amount = item.effect["health"]
            if amount >= 0:
                self.player.health = min(self.player.max_health, self.player.health + amount)
                messages.append(good("Warmth floods through your body."))
            else:
                self.player.health = max(0, self.player.health + amount)
                messages.append(danger("The magic bites back, leaving you weakened."))
        if "mana" in item.effect:
            amount = item.effect["mana"]
            if amount >= 0:
                self.player.mana = min(self.player.max_mana, self.player.mana + amount)
                messages.append(good("Arcane clarity returns to your senses."))
        if "magic" in item.effect:
            self.player.magic += item.effect["magic"]
            messages.append(good("A surge of magic sharpens your focus."))
        if "strength" in item.effect:
            self.player.strength += item.effect["strength"]
        if "agility" in item.effect:
            self.player.agility += item.effect["agility"]
        changes = []
        for stat, label in (
            ("health", "Health"),
            ("mana", "Mana"),
            ("magic", "Magic"),
            ("strength", "Strength"),
            ("agility", "Agility"),
        ):
            if stat in item.effect:
                current = self.player.__dict__[stat]
                delta = current - before[stat]
                if delta != 0:
                    sign = "+" if delta > 0 else ""
                    if stat in ("health", "mana"):
                        maximum = self.player.max_health if stat == "health" else self.player.max_mana
                        changes.append(
                            f"{label} {sign}{delta} ({int(round(current))}/{int(round(maximum))})"
                        )
                    else:
                        changes.append(f"{label} {sign}{delta} ({current})")
        if changes:
            messages.append(color_text(f"Effect: {', '.join(changes)}", "2;37"))
        return messages

    def handle_dark_spellbook_use(self):
        """Unlock spells as Dark Spellbooks are consumed."""
        messages = []
        self.player.spellbooks_read_count += 1
        if self.player.current_active_spell == "echo bolt":
            needed_for_next = 3 - self.player.spellbooks_read_count
        elif self.player.current_active_spell == "fireball":
            needed_for_next = 6 - self.player.spellbooks_read_count
        else:
            needed_for_next = 0
        if needed_for_next == 2:
            messages.append(
                "You feel the currents of forbidden knowledge stir, promising greater revelations with further study."
            )
        elif needed_for_next == 1:
            messages.append(
                "Another fragment of secrets embeds into your consciousness. One more tome might unlock its true potential."
            )
        if self.player.spellbooks_read_count == 3 and self.player.current_active_spell != "fireball":
            self.player.current_active_spell = "fireball"
            self.player.magic += 2
            messages.append(
                good(
                    "You decipher the tome's secrets and learn the 'Fireball' spell! "
                    "Your magical power grows stronger!"
                )
            )
        elif self.player.spellbooks_read_count == 6 and self.player.current_active_spell != "lightning bolt":
            self.player.current_active_spell = "lightning bolt"
            self.player.magic += 2
            messages.append(
                good(
                    "The tome's dark knowledge grants you mastery over the 'Lightning Bolt' spell! "
                    "Your magical power grows even stronger!"
                )
            )
        elif self.player.current_active_spell == "lightning bolt":
            messages.append(
                danger("The tome's secrets are exhausted, but its dark energies still take their toll.")
            )
        return messages

    def show_item_art(self, item):
        """Display ASCII art for major discoveries."""
        return

    # -----------------------------
    # NPCs and quests
    # -----------------------------

    def talk_to_npc(self, npc_query):
        """Initiate dialogue and handle quest interactions."""
        location = self.world[self.player.current_location]
        npc, matches = self.resolve_npc(npc_query, location.npcs)
        if npc:
            if self.horde_active:
                print(npc_name(f"{npc.name}: Go, Wayfinder! The horde approaches!"))
                return
            print(npc_name(f"{npc.name}: {npc.dialogue}"))
            if npc.name == "Ilyra":
                self.handle_ilyra()
            elif npc.name == "Brak":
                self.handle_brak()
            elif npc.name == "Nyx":
                self.handle_nyx()
            elif npc.name == "Kaelen Stonehand":
                self.handle_kaelen()
            elif npc.name == "Borin Stonefist":
                self.handle_borin()
            return
        if matches:
            options = ", ".join(match.name for match in matches)
            print(f"Who did you want to speak with? {options}")
        else:
            print("No one by that name is here.")

    def notify_first_quest(self):
        """Show the quest log tip when the first quest is accepted."""
        if self.player.flags.get("quest_tip_shown"):
            return
        if len(self.player.quests) == 1:
            print(color_text("Tip: Use the 'quests' command to track your active quests.", "2;37"))
            self.player.flags["quest_tip_shown"] = True

    def handle_ilyra(self):
        """Handle Remnant scholar quest and choices."""
        quest = self.get_quest("echo_crystal")
        if not quest:
            choice = safe_input("Accept her request to recover an Echo Crystal? (yes/no): ").strip().lower()
            if choice == "yes":
                new_quest = Quest(
                    "echo_crystal",
                    "Echoes in the Library",
                    "Retrieve the Echo Crystal from the Shattered Library.",
                    {"item": "Echo Crystal"},
                    {"exp": 60, "gold": 20},
                )
                self.player.quests.append(new_quest)
                print(good("Quest accepted: Echoes in the Library."))
                self.notify_first_quest()
            else:
                print("Ilyra nods, her eyes shadowed with disappointment.")
            return

        if quest.status != "completed":
            if self.player_has_item("Echo Crystal"):
                print(npc_name("Ilyra: You found it. Will you share its truth with the Remnants?"))
                print("1) Give the Echo Crystal to Ilyra.")
                print("2) Keep it for yourself.")
                choice = safe_input("Choose 1 or 2: ").strip()
                if choice == "1":
                    self.remove_item_from_inventory("Echo Crystal")
                    quest.status = "completed"
                    self.player.faction_affinity["Remnants of Aethelgard"] += 1
                    self.player.gain_experience(quest.rewards["exp"])
                    self.add_gold(quest.rewards["gold"])
                    print(good("Ilyra cradles the crystal, whispering a prayer."))
                    print(good("You gain the Remnants' trust."))
                    self.check_heartstone_unlock()
                elif choice == "2":
                    quest.status = "completed"
                    self.player.faction_affinity["Shadow Weavers"] += 1
                    self.player.gain_experience(quest.rewards["exp"] // 2)
                    self.player.flags["kept_echo_crystal"] = True
                    print(danger("You tuck the crystal away, its whispers now yours alone."))
                    print(danger("The Shadow Weavers' influence stirs within you."))
                    self.check_heartstone_unlock()
                else:
                    print("Ilyra waits for a clearer answer.")
            else:
                print("Ilyra: The Shattered Library still holds what we need. Be cautious.")
            return

        scroll_quest = self.get_quest("lost_scroll")
        if not scroll_quest:
            choice = safe_input(
                "Ilyra asks you to recover her lost scroll from the Sunken Archives. Accept? (yes/no): "
            ).strip().lower()
            if choice == "yes":
                new_quest = Quest(
                    "lost_scroll",
                    "The Scholar's Lost Scroll",
                    "Retrieve the lost scroll from the Sunken Archives beneath the Whispering Ruins.",
                    {"item": "Scholar's Lost Scroll"},
                    {"magic": 1, "item": "Mana Bloom", "faction": "Remnants of Aethelgard"},
                )
                self.player.quests.append(new_quest)
                self.update_lost_scroll_state()
                print(good("Quest accepted: The Scholar's Lost Scroll."))
                self.notify_first_quest()
            else:
                print("Ilyra presses the request no further, but her concern lingers.")
            return

        if scroll_quest.status == "completed":
            print("Ilyra: The Ley Line Conflux will no longer hide from us. Thank you, Wayfinder.")
            return

        if self.player_has_item("Scholar's Lost Scroll"):
            self.remove_item_from_inventory("Scholar's Lost Scroll")
            scroll_quest.status = "completed"
            self.player.magic += 1
            self.player.faction_affinity["Remnants of Aethelgard"] += 1
            reward_item = self.clone_item("Mana Bloom")
            self.player.inventory.append(reward_item)
            if reward_item.major:
                self.show_item_art(reward_item)
            print(good("Ilyra unseals the scroll, eyes widening as the ink stirs."))
            print(
                good(
                    "It speaks of the Ley Line Conflux, a nexus bound by rival mages whose ritual sparked the Sundering."
                )
            )
            print(good("You gain insight and the Remnants' deeper trust."))
            self.check_heartstone_unlock()
        else:
            print("Ilyra: The Sunken Archives are treacherous. The scroll must still be there.")

    def handle_brak(self):
        """Handle Ironclad scout quest and rewards."""
        quest = self.get_quest("clear_path")
        if not quest:
            choice = safe_input(
                "Brak asks you to clear the monsters in the Barren Peaks to the north. Accept? (yes/no): "
            ).strip().lower()
            if choice == "yes":
                new_quest = Quest(
                    "clear_path",
                    "Clear the Barren Peaks",
                    "Defeat the Wildling Brute prowling the Barren Peaks north of Ironclad Camp.",
                    {"defeat": "Wildling Brute"},
                    {"exp": 50, "item": "Ironclad Mail"},
                )
                self.player.quests.append(new_quest)
                print(good("Quest accepted: Clear the Barren Peaks."))
                self.notify_first_quest()
            else:
                print("Brak grunts, unimpressed.")
            return

        if quest.status != "completed":
            if self.player.flags.get("defeated_wildling"):
                quest.status = "completed"
                self.player.faction_affinity["Ironclad Nomads"] += 1
                self.player.gain_experience(quest.rewards["exp"])
                reward_item = self.clone_item(quest.rewards["item"])
                self.player.inventory.append(reward_item)
                if reward_item.major:
                    self.show_item_art(reward_item)
                print(good("Brak hands you Ironclad Mail."))
                equip_message = self.auto_equip_armor(reward_item)
                if equip_message:
                    print(equip_message)
                self.check_heartstone_unlock()
            else:
                print("Brak: The brute still prowls the peaks. Finish it.")
            return

        outpost_quest = self.get_quest("blighted_outpost")
        if not outpost_quest:
            choice = safe_input(
                "Brak growls about the Blighted Outpost east of the Barren Peaks. Clear it out? (yes/no): "
            ).strip().lower()
            if choice == "yes":
                new_quest = Quest(
                    "blighted_outpost",
                    "The Blighted Outpost",
                    "Clear the Stone-Hide Golems from the Blighted Outpost east of the Barren Peaks.",
                    {"defeat": "Stone-Hide Golem"},
                    {"exp": 80, "item": "Ironclad Plate Armor", "health": 15},
                )
                self.player.quests.append(new_quest)
                print(good("Quest accepted: The Blighted Outpost."))
                self.notify_first_quest()
            else:
                print("Brak spits into the fire, unimpressed.")
            return

        if outpost_quest.status == "completed":
            print("Brak: The peaks sing quieter now. You did well, Wayfinder.")
            return

        if not self.location_has_enemy("Blighted Outpost", "Stone-Hide Golem"):
            outpost_quest.status = "completed"
            self.player.faction_affinity["Ironclad Nomads"] += 1
            self.player.gain_experience(outpost_quest.rewards["exp"])
            reward_item = self.clone_item(outpost_quest.rewards["item"])
            self.player.inventory.append(reward_item)
            if reward_item.major:
                self.show_item_art(reward_item)
            equip_message = self.auto_equip_armor(reward_item)
            if equip_message:
                print(equip_message)
            self.player.max_health += outpost_quest.rewards["health"]
            self.player.health = self.player.max_health
            print(good("Brak clasps your forearm and hands over Ironclad Plate Armor."))
            print(good("Your body feels tougher after the ordeal."))
            self.check_heartstone_unlock()
        else:
            print("Brak: The outpost still crawls with stone-hide beasts. Finish the job.")

    def handle_nyx(self):
        """Handle Shadow Weaver quest and rewards."""
        quest = self.get_quest("void_shards")
        if not quest:
            if self.player.flags.get("kept_echo_crystal"):
                print(
                    npc_name(
                        "Nyx: The echo you kept drew me here. The void has tasted you already. "
                        "Its shards lie to the east."
                    )
                )
            choice = safe_input(
                "Nyx offers a pact: gather three Void Shards to the east. Accept? (yes/no): "
            ).strip().lower()
            if choice == "yes":
                new_quest = Quest(
                    "void_shards",
                    "Whispers of the Void",
                    "Collect three Void Shards from the corrupted creatures in the Voidscar Hollow east of the Chasm of Whispers.",
                    {"item": "Void Shard", "count": 3},
                    {"exp": 90, "item": "Shadow-Kissed Dagger"},
                )
                self.player.quests.append(new_quest)
                print(good("Quest accepted: Whispers of the Void."))
                self.notify_first_quest()
            else:
                print("Nyx fades back into the chasm's shadow.")
            return

        if quest.status == "completed":
            print("Nyx: The void sings through you now. Do not waste its favor.")
            return

        if self.count_inventory_items("Void Shard") >= 3:
            choice = safe_input("Nyx extends a gloved hand for the shards. Give them? (yes/no): ").strip().lower()
            if choice != "yes":
                print("Nyx: Then keep their whispers, for now.")
                return
            self.remove_items_from_inventory("Void Shard", 3)
            quest.status = "completed"
            self.player.faction_affinity["Shadow Weavers"] += 1
            self.player.gain_experience(quest.rewards["exp"])
            reward_item = self.clone_item(quest.rewards["item"])
            self.player.inventory.append(reward_item)
            if reward_item.major:
                self.show_item_art(reward_item)
            print(danger("Nyx smiles, voice like smoke: 'The Sundering was an opportunity, not a tragedy.'"))
            print(danger("She promises the Shadow Weavers will seize its chaos for ultimate power."))
            self.check_heartstone_unlock()
        else:
            print("Nyx: The void still hungers. The shards are to the east.")

    def handle_kaelen(self):
        """Handle trading with Kaelen Stonehand."""
        self.sanitize_merchant_inventory()
        print(npc_name("Kaelen: Steel and salt are all that keep you breathing out here."))
        print(npc_name("Kaelen: Rumor says the cliffs sing at night. I don't wait around to listen."))
        while True:
            print(color_text(f"Your gold: {self.format_currency(self.player.gold)}", "2;37"))
            choice = safe_input("Trade (buy/sell/leave): ").strip().lower()
            if choice in ("leave", "exit", "no"):
                print("Kaelen nods once, already watching the road.")
                return
            if choice == "buy":
                self.trade_buy()
            elif choice == "sell":
                self.trade_sell()
            else:
                print("Kaelen: Say it straight. Buy, sell, or leave.")

    def trade_buy(self):
        """Buy items from the merchant."""
        self.sanitize_merchant_inventory()
        if not self.merchant_inventory:
            print("Kaelen: I'm out of stock for now.")
            return
        while True:
            self.print_section_header("Kaelen's Stock")
            print(color_text(f"Your gold: {self.format_currency(self.player.gold)}", "2;37"))
            order, counts = self.summarize_items_with_counts(self.merchant_inventory)
            for index, item in enumerate(order, 1):
                key = self.item_key(item)
                count_tag = f" (x{counts[key]})" if counts[key] > 1 else ""
                print(
                    f"{index}) {self.format_item_name(item)}{count_tag} - {self.format_currency(item.gold_value)}"
                )
                stats_tag = self.format_merchant_item_stats(item)
                if stats_tag:
                    print(f"        {stats_tag}")
            choice = safe_input("Buy which item? (number/name or 'back'): ").strip().lower()
            if not choice or choice == "back":
                return
            item = None
            if choice.isdigit():
                selection = int(choice)
                if 1 <= selection <= len(order):
                    item = order[selection - 1]
            if not item:
                item, matches = self.resolve_item(choice, self.merchant_inventory)
                if matches:
                    options = self.format_item_list(matches)
                    print(f"Which item did you mean? {options}")
                    continue
            if not item:
                print("Kaelen: I don't carry that.")
                continue
            price = item.gold_value
            if self.player.gold < price:
                print("Kaelen: You can't afford that.")
                continue
            self.player.gold -= price
            self.merchant_inventory.remove(item)
            self.player.inventory.append(item)
            if item.major:
                self.show_item_art(item)
            self.apply_passive_item_effect(item)
            print(good(f"You buy {self.format_item_name(item)} for {self.format_currency(price)}."))
            equip_message = self.auto_equip_armor(item)
            if equip_message:
                print(equip_message)

    def format_merchant_item_stats(self, item):
        """Format weapon/armor stats with comparisons to equipped gear."""
        if item.item_type == "weapon":
            item_damage = item.effect.get("damage", 0)
            equipped_damage = self.player.equipped_weapon.effect.get("damage", 0) if self.player.equipped_weapon else 0
            delta = item_damage - equipped_damage
            if delta == 0:
                return f" (Damage {item_damage})"
            sign = "+" if delta > 0 else ""
            diff_text = f"{sign}{delta} damage"
            if delta > 0:
                diff_text = color_text(f"({diff_text})", "1;32")
            else:
                diff_text = color_text(f"({diff_text})", "1;31")
            return f" (Damage {item_damage} {diff_text})"
        if item.item_type == "armor":
            item_defense = item.effect.get("defense", 0)
            equipped_defense = self.player.equipped_armor.effect.get("defense", 0) if self.player.equipped_armor else 0
            delta = item_defense - equipped_defense
            if delta == 0:
                return f" (Defense {item_defense})"
            sign = "+" if delta > 0 else ""
            diff_text = f"{sign}{delta} defense"
            if delta > 0:
                diff_text = color_text(f"({diff_text})", "1;32")
            else:
                diff_text = color_text(f"({diff_text})", "1;31")
            return f" (Defense {item_defense} {diff_text})"
        return ""

    def format_upgrade_preview(self, item, next_rarity):
        """Format projected stat gains for the next rarity tier."""
        if not next_rarity or item.item_type not in ("weapon", "armor"):
            return ""
        multiplier = RARITY_MULTIPLIERS.get(next_rarity)
        if multiplier is None:
            return ""
        upgraded = self.scale_item_effect(item.base_effect, multiplier)

        def format_value(value, is_percent):
            if is_percent:
                if abs(value - round(value)) < 0.0001:
                    return f"{int(round(value))}%"
                return f"{value:.1f}%"
            if abs(value - round(value)) < 0.0001:
                return str(int(round(value)))
            return f"{value:.1f}"
        fields = (
            ("damage", "Damage", False),
            ("defense", "Defense", False),
            ("magic", "Magic", False),
            ("mana_cost_reduction_percent", "Mana Cost Reduction", True),
            ("life_steal_percent", "Life Steal", True),
        )
        changes = []
        for key, label, is_percent in fields:
            if key not in item.effect and key not in upgraded:
                continue
            current = item.effect.get(key, 0)
            future = upgraded.get(key, 0)
            if abs(current - future) < 0.0001:
                continue
            changes.append(
                f"{label} {format_value(current, is_percent)} -> {format_value(future, is_percent)}"
            )
        if not changes:
            return ""
        return f"(Upgrade: {', '.join(changes)})"

    def trade_sell(self):
        """Sell items to the merchant."""
        if not self.player.inventory:
            print("Kaelen: You've got nothing worth weighing.")
            return
        while True:
            self.print_section_header("Your Goods")
            print(color_text(f"Your gold: {self.format_currency(self.player.gold)}", "2;37"))
            saleable = [item for item in self.player.inventory if item.item_type != "quest_item"]
            if not saleable:
                print("Kaelen: You've got nothing I'd trade for.")
                return
            order, counts = self.summarize_items_with_counts(saleable)
            equipped_weapon = self.player.equipped_weapon
            equipped_armor = self.player.equipped_armor
            equipped_keys = set()
            if equipped_weapon:
                equipped_keys.add(self.item_key(equipped_weapon))
            if equipped_armor:
                equipped_keys.add(self.item_key(equipped_armor))
            for index, item in enumerate(order, 1):
                key = self.item_key(item)
                count_tag = f" (x{counts[key]})" if counts[key] > 1 else ""
                equip_tag = " (equipped)" if key in equipped_keys else ""
                sell_price = int(item.gold_value * 0.75)
                print(
                    f"{index}) {self.format_item_name(item)}{count_tag}{equip_tag} - "
                    f"{self.format_currency(sell_price)}"
                )
                stats_tag = self.format_merchant_item_stats(item)
                if stats_tag:
                    print(f"        {stats_tag}")
            choice = safe_input("Sell which item? (number/name or 'back'): ").strip().lower()
            if not choice or choice == "back":
                return
            item = None
            if choice.isdigit():
                selection = int(choice)
                if 1 <= selection <= len(order):
                    item = order[selection - 1]
            if not item:
                item, matches = self.resolve_item(choice, self.player.inventory)
                if matches:
                    options = self.format_item_list(matches)
                    print(f"Which item did you mean? {options}")
                    continue
            if not item:
                normalized_choice = normalize_name(choice)
                quest_item = next(
                    (owned for owned in self.player.inventory if normalize_name(owned.name) == normalized_choice),
                    None,
                )
                if quest_item and quest_item.item_type == "quest_item":
                    print("Kaelen: I don't buy quest relics.")
                else:
                    print("Kaelen: I don't see that in your pack.")
                continue
            sell_price = int(item.gold_value * 0.75)
            if self.player.equipped_weapon == item:
                self.player.equipped_weapon = None
            if self.player.equipped_armor == item:
                self.player.equipped_armor = None
            self.player.inventory.remove(item)
            self.merchant_inventory.append(item)
            self.add_gold(sell_price)
            print(good(f"You sell {self.format_item_name(item)} for {self.format_currency(sell_price)}."))

    def handle_borin(self):
        """Handle upgrades with Borin Stonefist."""
        print(npc_name("Borin: The forge will tell me what your steel can become."))
        print(npc_name("Borin: Bring coin and patience, and I'll bring the fire."))
        while True:
            print(color_text(f"Your gold: {self.format_currency(self.player.gold)}", "2;37"))
            choice = safe_input("Forge (upgrade/leave): ").strip().lower()
            if choice in ("leave", "exit", "no"):
                print("Borin grunts and returns to the anvil.")
                return
            if choice in ("upgrade", "yes"):
                self.forge_upgrade()
            else:
                print("Borin: Speak plain. Upgrade or leave.")

    def forge_upgrade(self):
        """Upgrade a weapon or armor to the next rarity tier."""
        while True:
            eligible = [item for item in self.player.inventory if self.is_upgradeable_item(item)]
            if not eligible:
                print("Borin: Nothing here worth the heat.")
                return
            self.print_section_header("Emberforge Upgrades")
            print(color_text(f"Your gold: {self.format_currency(self.player.gold)}", "2;37"))
            order, counts = self.summarize_items_with_counts(eligible)
            equipped_weapon = self.player.equipped_weapon
            equipped_armor = self.player.equipped_armor
            equipped_keys = set()
            if equipped_weapon:
                equipped_keys.add(self.item_key(equipped_weapon))
            if equipped_armor:
                equipped_keys.add(self.item_key(equipped_armor))
            for index, item in enumerate(order, 1):
                key = self.item_key(item)
                count_tag = f" (x{counts[key]})" if counts[key] > 1 else ""
                equip_tag = " (equipped)" if key in equipped_keys else ""
                next_rarity = self.get_next_rarity(item.rarity)
                cost = self.upgrade_cost(item)
                if next_rarity and cost is not None:
                    print(
                        f"{index}) {self.format_item_name(item)}{count_tag}{equip_tag} -> {next_rarity} "
                        f"for {self.format_currency(cost)}"
                    )
                    preview = self.format_upgrade_preview(item, next_rarity)
                    if preview:
                        print(f"        {preview}")
            choice = safe_input("Upgrade which item? (number/name or 'back'): ").strip().lower()
            if not choice or choice == "back":
                return
            item = None
            if choice.isdigit():
                selection = int(choice)
                if 1 <= selection <= len(order):
                    item = order[selection - 1]
            if not item:
                item, matches = self.resolve_item(choice, eligible)
                if matches:
                    options = self.format_item_list(matches)
                    print(f"Which item did you mean? {options}")
                    continue
            if not item:
                print("Borin: I don't see that in your pack.")
                continue
            next_rarity = self.get_next_rarity(item.rarity)
            if not next_rarity:
                print("Borin: That piece can't be tempered further.")
                continue
            cost = self.upgrade_cost(item)
            if cost is None:
                print("Borin: That won't take the hammer.")
                continue
            if self.player.gold < cost:
                print("Borin: Come back with heavier coin.")
                continue
            self.player.gold -= cost
            self.assign_item_rarity(item, rarity=next_rarity)
            print(good(f"Borin hammers away, and your {item.name} now shines with {next_rarity} power!"))

    def count_completed_quests(self):
        """Count quests marked as completed."""
        return sum(1 for quest in self.player.quests if quest.status == "completed")

    def check_heartstone_unlock(self, announce=True):
        """Unlock the Heartstone quest after completing enough tasks."""
        if self.get_quest("echoing_heartbeat"):
            return
        if self.count_completed_quests() < 2:
            return
        new_quest = Quest(
            "echoing_heartbeat",
            "The Echoing Heartbeat",
            "Follow the pulsing call beneath the Whispering Ruins to the hidden Heartstone.",
            {"location": "Heartstone Depths"},
            {"choice": "stabilize/exploit/destroy"},
        )
        self.player.quests.append(new_quest)
        self.player.flags["heartstone_unlocked"] = True
        if announce:
            print(headline("A Distant Pulse"))
            print("A deep heartbeat rolls through the ruins, calling you downward.")

    def update_lost_scroll_state(self):
        """Gate Sunken Archives content behind the lost scroll quest."""
        location = self.world.get("Sunken Archives")
        if not location:
            return
        quest = self.get_quest("lost_scroll")
        if not quest:
            location.items = [item for item in location.items if item.name != "Scholar's Lost Scroll"]
            location.enemies = [enemy for enemy in location.enemies if enemy.name != "Drowned Archivist"]
            return
        if quest.status == "completed":
            return
        if not any(enemy.name == "Drowned Archivist" for enemy in location.enemies):
            location.enemies.append(self.clone_enemy("Drowned Archivist"))
        if (
            not self.player_has_item("Scholar's Lost Scroll")
            and not any(item.name == "Scholar's Lost Scroll" for item in location.items)
        ):
            location.items.append(self.clone_item("Scholar's Lost Scroll"))

    def update_breach_boss_state(self):
        """Ensure the Chronos Tyrant is present until defeated."""
        location = self.world.get("The Temporal Breach Apex")
        if not location:
            return
        if self.player.flags.get("chronos_tyrant_defeated"):
            location.enemies = [enemy for enemy in location.enemies if enemy.name != "The Chronos Tyrant"]
            return
        if not any(enemy.name == "The Chronos Tyrant" for enemy in location.enemies):
            location.enemies.append(self.clone_enemy("The Chronos Tyrant"))

    def handle_chronos_tyrant_defeat(self):
        """Trigger the horde after defeating the Chronos Tyrant."""
        if self.player.flags.get("chronos_tyrant_defeated"):
            return
        self.player.flags["chronos_tyrant_defeated"] = True
        print(
            danger(
                "As the Chronos Tyrant begins to crumble into a pile of temporal dust,, a guttural, "
                "echoing scream tears through the Apex."
            )
        )
        print(
            danger(
                "'You have undone the threads! Now, witness the unraveling!' it shrieks, its voice a "
                "chorus of countless dying moments."
            )
        )
        print(
            npc_name(
                "Brak Stonehand, his face grim and scarred, bursts into the Apex, his heavy axe already drawn."
            )
        )
        print(
            danger(
                "The very air shatters, and from the newly formed chasms, a cacophony of screeches erupts! "
                "A tide of grotesque creatures, their eyes burning with hunger, surges towards you."
            )
        )
        camp = self.world.get("Ironclad Camp")
        if camp:
            camp.npcs = [npc for npc in camp.npcs if npc.name != "Brak"]
        print(
            npc_name(
                "Brak: Wayfinder! There's no time! The Tyrant's death has torn open the veil completely! "
                "A raw portal has just bloomed in the Shattered Library – it's your only way out! You "
                "must reach it before these things swallow the path and seal your last escape!"
            )
        )
        print(npc_name("Brak: Go! I'll hold them back as long as I can! Don't look back, Wayfinder! Run!"))
        self.player.flags["portal_warning_given"] = True
        self.horde_active = True
        self.horde_delay_turns = 1
        self.infected_locations = {"The Temporal Breach Apex"}
        self.horde_pending = {}

    def spread_horde(self):
        """Expand the horde's infection across connected locations."""
        if not self.horde_active:
            return
        if self.horde_delay_turns > 0:
            self.horde_delay_turns -= 1
            return
        if self.horde_pending:
            for destination in list(self.horde_pending):
                turns = self.horde_pending[destination] - 1
                if turns <= 0:
                    self.infected_locations.add(destination)
                    del self.horde_pending[destination]
                else:
                    self.horde_pending[destination] = turns
        new_infected = set(self.infected_locations)
        for loc_name in self.infected_locations:
            location = self.world.get(loc_name)
            if not location:
                continue
            for destination in location.exits.values():
                if destination in self.infected_locations:
                    continue
                if loc_name == "Mistwood Path" and destination == "Silverwood Plaza":
                    self.horde_pending.setdefault(destination, 2)
                    continue
                new_infected.add(destination)
                if destination in self.horde_pending:
                    del self.horde_pending[destination]
        self.infected_locations = new_infected

    def enter_portal(self):
        """Escape through the Shattered Library portal if the horde is active."""
        if not self.horde_active:
            print("There is no portal to enter.")
            return
        if self.player.current_location != "Shattered Library":
            print("You see no portal here.")
            return
        clear_screen()
        print(headline("The Last Threshold"))
        print(
            "You dive through the unstable portal as the horde howls behind you. Light fractures, "
            "time stutters, and the shattered world fades into a single, breathless silence."
        )
        print("For now, the echoes of Aethelgard are behind you.")
        print(WIN_ENDGAME_ART)
        self.print_endgame_summary("ESCAPE", accent="1;32")
        self.running = False

    def handle_heartstone(self):
        """Resolve the Heartstone choice and outcomes."""
        quest = self.get_quest("echoing_heartbeat")
        if not quest or quest.status == "completed":
            return
        print(headline("The Heartstone"))
        print(
            "The relic throbs with unstable power. You sense three paths: soothe it, seize it, or shatter it."
        )
        print("1) Stabilize the Heartstone and align it with the ley lines.")
        print("2) Exploit its power and claim it for yourself.")
        print("3) Destroy it, ending its pulse forever.")
        choice = safe_input("Choose 1, 2, or 3 (or press Enter to wait): ").strip()
        if choice == "1":
            quest.status = "completed"
            self.player.flags["heartstone_outcome"] = "stabilized"
            reward_item = self.clone_item("Stabilized Heartstone")
            self.player.inventory.append(reward_item)
            self.apply_passive_item_effect(reward_item)
            print(good("The chamber calms, and the Heartstone settles into a steady rhythm."))
            print(good("You carry a harmonic fragment of its power."))
        elif choice == "2":
            quest.status = "completed"
            self.player.flags["heartstone_outcome"] = "exploited"
            reward_item = self.clone_item("Heartstone Core")
            self.player.inventory.append(reward_item)
            self.apply_passive_item_effect(reward_item)
            print(danger("You wrench the Heartstone free. The world shudders, and power floods your veins."))
        elif choice == "3":
            quest.status = "completed"
            self.player.flags["heartstone_outcome"] = "destroyed"
            self.player.max_health += 20
            self.player.health = self.player.max_health
            print(good("The Heartstone cracks. Silence follows, and your body hardens against the loss."))
        else:
            print("The Heartstone continues its slow, waiting beat.")

    def get_quest(self, quest_id):
        """Return a quest by ID if the player has it."""
        for quest in self.player.quests:
            if quest.quest_id == quest_id:
                return quest
        return None

    def show_quests(self):
        """Display the quest log."""
        if not self.player.quests:
            print("You have no active quests.")
            return
        self.print_section_header("Quest Log")
        for quest in self.player.quests:
            status = quest.status.capitalize()
            print(f"- {quest.name} [{status}]: {quest.description}")

    def print_combat_help(self):
        """Display available commands during combat."""
        self.print_section_header("Combat Commands")
        print("attack | cast | use <item> | flee")
        print("help | inventory | stats")

    # -----------------------------
    # Combat system
    # -----------------------------

    def check_for_combat(self):
        """Initiate combat when enemies are present in the current location."""
        location = self.world[self.player.current_location]
        if not location.enemies:
            return
        while location.enemies and self.running:
            enemy = location.enemies[0]
            self.scale_enemy_for_player(enemy, preserve_health=True)
            result = self.combat(enemy)
            if result == "fled":
                self.needs_redraw = True
                return
            if result == "defeated":
                location.enemies.remove(enemy)
                self.player.enemies_killed += 1
                self.player.gain_experience(enemy.exp_reward)
                self.handle_enemy_loot(enemy)
                if enemy.name == "Wildling Brute":
                    self.player.flags["defeated_wildling"] = True
                if enemy.name == "The Chronos Tyrant":
                    self.handle_chronos_tyrant_defeat()
                if self.pending_post_combat_messages:
                    for message in self.pending_post_combat_messages:
                        print(message)
                    self.pending_post_combat_messages = []
                self.wait_for_continue()
                self.needs_redraw = True
                continue
            if result == "dead":
                return

    def combat(self, enemy):
        """Turn-based combat loop against a single enemy."""
        self.combat_log = []
        clear_screen()
        self.print_status_bar()
        combat_art = r"""
+------------------+
|   COMBAT CALLS   |
+------------------+
      \      /
       \    /
        \  /
         \/
         /\
        /  \
       /____\
"""
        print(combat_art)
        pause(0.2)
        lower_name = enemy.name.lower()
        article = "" if lower_name.startswith(("the ", "a ", "an ")) else "A "
        self.add_combat_log(danger(f"{article}{enemy.name} (Lv {enemy.level}) attacks! {enemy.description}"))
        self.add_combat_log(danger("A low, guttural growl echoes from the shadows."))
        pause(0.4)

        while enemy.is_alive() and self.player.health > 0 and self.running:
            self.render_combat_screen(enemy)
            action = safe_input("Action (attack, cast, use item, flee): ").strip().lower()
            if not action:
                for message in self.player_attack(enemy):
                    self.add_combat_log(message)
            elif action in ("help", "?"):
                self.print_combat_help()
                self.wait_for_continue()
                continue
            elif action in ("inventory", "inv"):
                self.show_inventory()
                self.wait_for_continue()
                continue
            elif action == "stats":
                self.show_stats()
                self.wait_for_continue()
                continue
            elif action == "attack":
                for message in self.player_attack(enemy):
                    self.add_combat_log(message)
            elif action == "cast":
                for message in self.player_cast(enemy):
                    self.add_combat_log(message)
            elif action in ("use item", "use"):
                options = self.format_consumable_options()
                if options:
                    self.add_combat_log(options)
                    self.render_combat_screen(enemy)
                else:
                    self.add_combat_log("You have no consumables.")
                    self.render_combat_screen(enemy)
                    continue
                item_name = safe_input("Use which item? ").strip()
                if not item_name:
                    self.add_combat_log("Use what?")
                    options = self.format_consumable_options()
                    if options:
                        self.add_combat_log(options)
                    else:
                        self.add_combat_log("You have no consumables.")
                    continue
                success, messages = self.use_item(item_name, in_combat=True)
                for message in messages:
                    self.add_combat_log(message)
                if not success:
                    continue
            elif action.startswith("use "):
                success, messages = self.use_item(action.replace("use ", "", 1), in_combat=True)
                for message in messages:
                    self.add_combat_log(message)
                if not success:
                    continue
            elif action == "flee":
                if self.attempt_flee(enemy):
                    self.add_combat_log(good("You escape the fight."))
                    self.render_combat_screen(enemy)
                    pause(0.4)
                    if self.previous_location:
                        self.player.current_location = self.previous_location
                    return "fled"
            else:
                self.add_combat_log("You hesitate, losing precious time.")

            if self.player.health <= 0 or not self.running:
                if self.player.health <= 0 and self.running:
                    self.game_over()
                return "dead"

            if enemy.is_alive():
                for message in self.enemy_attack(enemy):
                    self.add_combat_log(message)

            if self.player.health <= 0:
                self.game_over()
                return "dead"
        if not enemy.is_alive():
            self.render_combat_screen(enemy)
            return "defeated"
        return "dead"

    def player_attack(self, enemy):
        """Resolve a player melee attack."""
        messages = []
        hit_chance = clamp(70 + (self.player.agility * 2) - (enemy.agility * 3), 5, 95)
        roll = random.randint(1, 100)
        if roll <= hit_chance:
            base_damage = self.player.attack_power() + random.randint(0, 4)
            damage = max(0, base_damage - enemy.defense)
            enemy.health = max(0, enemy.health - damage)
            self.player.damage_done += damage
            weapon = self.player.equipped_weapon
            weapon_name = weapon.name if weapon else "fists"
            weapon_type = weapon.weapon_type if weapon else "melee"
            if weapon_type == "ranged_bow":
                messages.append(good(f"You loose an arrow, striking the {enemy.name} for {damage} damage!"))
            elif weapon_type == "magic_staff" and CANTRIP_ACTIVE:
                messages.append(
                    good(f"You channel a quick cantrip, striking the {enemy.name} for {damage} damage!")
                )
            else:
                messages.append(
                    good(f"You swing your {weapon_name}, striking the {enemy.name} for {damage} damage!")
                )
            steal_message = self.apply_life_steal(damage)
            if steal_message:
                messages.append(steal_message)
            weapon = self.player.equipped_weapon
            if weapon and weapon.effect.get("curse_chance"):
                curse_chance = weapon.effect.get("curse_chance", 0)
                curse_damage = weapon.effect.get("curse_damage", 0)
                if random.randint(1, 100) <= curse_chance:
                    self.player.health = max(0, self.player.health - curse_damage)
                    self.player.damage_received += curse_damage
                    messages.append(danger("The shadow within your blade bites back."))
                    if self.player.health <= 0:
                        self.game_over()
        else:
            weapon = self.player.equipped_weapon
            weapon_type = weapon.weapon_type if weapon else "melee"
            if weapon_type == "ranged_bow":
                messages.append("Your arrow sails wide, missing the target.")
            elif weapon_type == "magic_staff" and CANTRIP_ACTIVE:
                messages.append("Your cantrip fizzles past the target.")
            else:
                messages.append("You swing wide, missing the target.")
        return messages

    def player_cast(self, enemy):
        """Resolve a player spell cast."""
        spell_name = (self.player.current_active_spell or "echo bolt").lower()
        spell_data = SPELL_DEFS.get(spell_name)
        if not spell_data:
            spell_name = "echo bolt"
            spell_data = SPELL_DEFS[spell_name]
            self.player.current_active_spell = spell_name
        mana_cost = spell_data["mana_cost"]
        weapon = self.player.equipped_weapon
        is_staff = bool(weapon) and (
            weapon.weapon_type == "magic_staff" or "mana_cost_reduction_percent" in weapon.effect
        )
        if is_staff:
            reduction_percent = weapon.effect.get("mana_cost_reduction_percent", 0)
            if reduction_percent:
                reduction = int(math.ceil(mana_cost * reduction_percent / 100))
                reduction = max(1, reduction)
                mana_cost = max(1, int(mana_cost - reduction))
        if self.player.mana < mana_cost:
            return ["You lack the mana to cast a spell."]
        self.player.mana -= mana_cost
        magic_bonus = weapon.effect.get("magic", 0) if weapon else 0
        raw_damage = spell_data["base_damage"] + ((self.player.magic + magic_bonus) * 2)
        resistance = max(0.0, min(1.0, getattr(enemy, "magic_resistance", 0.0)))
        effective_resistance = resistance / 2 if is_staff else resistance
        damage = int(round(raw_damage * (1 - effective_resistance)))
        damage = max(0, damage)
        enemy.health = max(0, enemy.health - damage)
        self.player.damage_done += damage
        messages = []
        if effective_resistance > 0:
            if is_staff and resistance > 0:
                messages.append(danger("Your staff cuts through some of the resistance."))
            else:
                messages.append(danger("The spell is dulled by resistance."))
        spell_title = " ".join(part.capitalize() for part in spell_name.split())
        messages.append(good(f"You cast {spell_title} for {damage} damage."))
        steal_message = self.apply_life_steal(damage)
        if steal_message:
            messages.append(steal_message)
        return messages

    def enemy_attack(self, enemy):
        """Resolve the enemy's attack."""
        hit_chance = clamp(70 + (enemy.agility * 2) - (self.player.agility * 1), 5, 95)
        roll = random.randint(1, 100)
        if roll <= hit_chance:
            base_damage = enemy.damage + random.randint(0, 4)
            damage = max(1, base_damage - self.player.defense())
            self.player.health = max(0, self.player.health - damage)
            self.player.damage_received += damage
            return [danger(f"{enemy.name} hits you for {damage} damage.")]
        else:
            return [f"{enemy.name} misses, its strike cutting only air."]

    def apply_life_steal(self, damage):
        """Restore health based on weapon life-steal effects."""
        if damage <= 0:
            return None
        weapon = self.player.equipped_weapon
        if not weapon:
            return None
        percent = weapon.effect.get("life_steal_percent", 0)
        if percent <= 0:
            return None
        heal = int(math.ceil(damage * percent / 100))
        heal = max(1, heal)
        if heal <= 0:
            return None
        before = self.player.health
        self.player.health = min(self.player.max_health, self.player.health + heal)
        actual = self.player.health - before
        if actual <= 0:
            return None
        return good(f"You siphon {actual} health.")

    def attempt_flee(self, enemy):
        """Attempt to flee from combat."""
        chance = clamp(50 + (self.player.agility * 2) - (enemy.agility * 4), 5, 95)
        roll = random.randint(1, 100)
        return roll <= chance

    def handle_enemy_loot(self, enemy):
        """Drop items from defeated enemies."""
        level = max(1, getattr(enemy, "level", 1))
        base_gold = random.randint(4, 8)
        gold_amount = max(1, int(round(base_gold * (1 + (level - 1) * 0.15))))
        self.add_gold(gold_amount)
        print(good(f"You collect {self.format_currency(gold_amount)}."))
        drops = []
        equip_messages = []
        if enemy.loot:
            loot_name = random.choice(enemy.loot)
            loot_item = self.clone_item(loot_name)
            drops.append(loot_item)
        for entry in getattr(enemy, "bonus_loot", []):
            if isinstance(entry, dict):
                loot_name = entry.get("name")
                chance = entry.get("chance", 0)
            else:
                loot_name, chance = entry
            if loot_name and random.random() <= chance:
                loot_item = self.clone_item(loot_name)
                drops.append(loot_item)
        for loot_item in drops:
            if loot_item.item_type == "armor" and not self.player.equipped_armor:
                self.player.inventory.append(loot_item)
                equip_message = self.auto_equip_armor(loot_item)
                if equip_message:
                    equip_messages.append(equip_message)
            else:
                self.world[self.player.current_location].items.append(loot_item)
            print(good(f"The {enemy.name} drops {self.format_item_name(loot_item)}."))
            if loot_item.major:
                self.show_item_art(loot_item)
        for message in equip_messages:
            print(message)

    # -----------------------------
    # Player status and stats
    # -----------------------------

    def show_stats(self):
        """Show player stats and faction affinity."""
        self.print_section_header(f"{self.player.name} - Wayfinder")
        print(f"Level: {self.player.level} | XP: {self.player.experience}/{self.player.level * 100}")
        hp = color_text(self.format_bar_value(self.player.health, self.player.max_health), "1;31")
        mp = color_text(self.format_bar_value(self.player.mana, self.player.max_mana), "1;34")
        print(f"Health: {hp}")
        print(f"Mana: {mp}")
        print(f"Strength: {self.player.strength} | Magic: {self.player.magic} | Agility: {self.player.agility}")
        weapon_bonus = self.player.equipped_weapon.effect.get("damage", 0) if self.player.equipped_weapon else 0
        armor_bonus = self.player.equipped_armor.effect.get("defense", 0) if self.player.equipped_armor else 0
        print(f"Weapon Damage Bonus: +{weapon_bonus} | Armor Defense Bonus: +{armor_bonus}")
        print(f"Gold: {self.player.gold}")
        print("Faction Affinity:")
        for faction, score in self.player.faction_affinity.items():
            print(f"- {faction}: {score}")

    def player_has_item(self, item_name):
        """Check if the player has an item in their inventory."""
        return any(normalize_name(item.name) == normalize_name(item_name) for item in self.player.inventory)

    def remove_item_from_inventory(self, item_name):
        """Remove an item from inventory by name."""
        for item in self.player.inventory:
            if normalize_name(item.name) == normalize_name(item_name):
                self.player.inventory.remove(item)
                return

    def count_inventory_items(self, item_name):
        """Count matching items in inventory by name."""
        return sum(
            1 for item in self.player.inventory if normalize_name(item.name) == normalize_name(item_name)
        )

    def remove_items_from_inventory(self, item_name, count):
        """Remove multiple items from inventory by name."""
        removed = 0
        for item in list(self.player.inventory):
            if removed >= count:
                break
            if normalize_name(item.name) == normalize_name(item_name):
                self.player.inventory.remove(item)
                removed += 1
        return removed

    def location_has_enemy(self, location_name, enemy_name):
        """Check if a location still contains a specific enemy."""
        location = self.world.get(location_name)
        if not location:
            return False
        return any(enemy.name == enemy_name for enemy in location.enemies)

    # -----------------------------
    # Save and load
    # -----------------------------

    def get_save_path(self, slot):
        """Return the save file path for a slot."""
        return SAVE_SLOT_TEMPLATE.format(slot)

    def migrate_legacy_save(self):
        """Move the legacy save file into slot 1 if needed."""
        slot_path = self.get_save_path(1)
        if os.path.exists(slot_path):
            return
        if os.path.exists(LEGACY_SAVE_FILE):
            try:
                os.replace(LEGACY_SAVE_FILE, slot_path)
            except OSError:
                return

    def load_save_summary(self, path):
        """Load a compact summary for a save file."""
        try:
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return None
        player = data.get("player", {})
        name = player.get("name", "Wayfinder")
        class_name = player.get("class_name", "Ranger")
        level = player.get("level", 1)
        quests = player.get("quests", [])
        completed = sum(1 for quest in quests if quest.get("status") == "completed")
        return {
            "name": name,
            "class_name": class_name,
            "level": level,
            "completed": completed,
        }

    def list_save_slots(self):
        """Return slot info for the save menu."""
        self.migrate_legacy_save()
        slots = []
        for slot in range(1, MAX_SAVE_SLOTS + 1):
            path = self.get_save_path(slot)
            summary = self.load_save_summary(path) if os.path.exists(path) else None
            slots.append({"slot": slot, "path": path, "summary": summary})
        return slots

    def format_slot_line(self, slot_info):
        """Format a save slot line for menus."""
        slot = slot_info["slot"]
        summary = slot_info["summary"]
        if not summary:
            return f"Slot {slot} - [Empty]"
        name = summary["name"]
        level = summary["level"]
        class_name = summary["class_name"]
        completed = summary["completed"]
        return (
            f"Slot {slot} - {name} - Level {level} {class_name} - "
            f"{completed}/{TOTAL_QUESTS} quests completed"
        )

    def prompt_save_slot(self):
        """Prompt the player to choose a save slot."""
        while True:
            self.print_section_header("Save Slots")
            slots = self.list_save_slots()
            for slot_info in slots:
                print(self.format_slot_line(slot_info))
            choice = safe_input("Save to slot (1-3 or 'back'): ").strip().lower()
            if not choice or choice == "back":
                return None
            if not choice.isdigit():
                print("Please choose a slot number.")
                continue
            slot = int(choice)
            if slot < 1 or slot > MAX_SAVE_SLOTS:
                print("Please choose a valid slot.")
                continue
            slot_info = slots[slot - 1]
            if slot_info["summary"]:
                confirm = safe_input(f"Overwrite Slot {slot}? (yes/no): ").strip().lower()
                if confirm not in ("yes", "y"):
                    continue
            return slot

    def prompt_load_slot(self):
        """Prompt the player to choose a load slot."""
        while True:
            self.print_section_header("Load Slots")
            slots = self.list_save_slots()
            for slot_info in slots:
                print(self.format_slot_line(slot_info))
            choice = safe_input("Load which slot? (1-3 or 'back'): ").strip().lower()
            if not choice or choice == "back":
                return None
            if not choice.isdigit():
                print("Please choose a slot number.")
                continue
            slot = int(choice)
            if slot < 1 or slot > MAX_SAVE_SLOTS:
                print("Please choose a valid slot.")
                continue
            slot_info = slots[slot - 1]
            if not slot_info["summary"]:
                print("That slot is empty.")
                continue
            return slot

    def delete_save_slot(self, slot):
        """Delete a save slot file."""
        path = self.get_save_path(slot)
        try:
            os.remove(path)
            return True
        except OSError:
            return False

    def prompt_delete_slot(self):
        """Prompt the player to delete a save slot."""
        while True:
            self.print_section_header("Delete Save Slot")
            slots = self.list_save_slots()
            for slot_info in slots:
                print(self.format_slot_line(slot_info))
            choice = safe_input("Delete which slot? (1-3 or 'back'): ").strip().lower()
            if not choice or choice == "back":
                return None
            if not choice.isdigit():
                print("Please choose a slot number.")
                continue
            slot = int(choice)
            if slot < 1 or slot > MAX_SAVE_SLOTS:
                print("Please choose a valid slot.")
                continue
            slot_info = slots[slot - 1]
            if not slot_info["summary"]:
                print("That slot is already empty.")
                continue
            confirm = safe_input(f"Delete Slot {slot}? (yes/no): ").strip().lower()
            if confirm in ("yes", "y"):
                if self.delete_save_slot(slot):
                    print(good(f"Slot {slot} deleted."))
                    return slot
                print("Could not delete that slot.")
            else:
                continue

    def select_next_available_slot(self):
        """Return the next available save slot."""
        slots = self.list_save_slots()
        for slot_info in slots:
            if not slot_info["summary"]:
                return slot_info["slot"]
        return None

    def start_new_game_flow(self):
        """Start a new game in the next available slot."""
        slot = self.select_next_available_slot()
        if slot is None:
            clear_screen()
            print("All save slots are full. You must delete a slot to start a new game.")
            choice = safe_input("Delete a slot now? (yes/no): ").strip().lower()
            if choice in ("yes", "y"):
                deleted = self.prompt_delete_slot()
                if deleted is None:
                    return False
                slot = self.select_next_available_slot()
                if slot is None:
                    return False
            else:
                return False
        self.start_new_game(slot=slot)
        return True

    def continue_game_flow(self):
        """Continue a game from a chosen slot."""
        slots = self.list_save_slots()
        if not any(slot_info["summary"] for slot_info in slots):
            clear_screen()
            print("No saved games available.")
            pause(0.6)
            return False
        slot = self.prompt_load_slot()
        if slot is None:
            return False
        return self.load_game(slot)

    def save_game_prompt(self):
        """Prompt for a save slot and save the game."""
        slot = self.prompt_save_slot()
        if slot is None:
            return False
        self.current_save_slot = slot
        return self.save_game()

    def load_game_prompt(self):
        """Prompt for a load slot and load the game."""
        slot = self.prompt_load_slot()
        if slot is None:
            return False
        return self.load_game(slot)

    def save_game(self, quiet=False):
        """Save player and world state to a JSON file."""
        slot = self.current_save_slot
        if slot is None:
            print("No save slot selected.")
            return False
        data = {
            "player": {
                "name": self.player.name,
                "max_health": self.player.max_health,
                "health": self.player.health,
                "max_mana": self.player.max_mana,
                "mana": self.player.mana,
                "strength": self.player.strength,
                "magic": self.player.magic,
                "agility": self.player.agility,
                "class_name": self.player.class_name,
                "spellbooks_read_count": self.player.spellbooks_read_count,
                "current_active_spell": self.player.current_active_spell,
                "inventory": [self.serialize_item(item) for item in self.player.inventory],
                "equipped_weapon": self.serialize_item(self.player.equipped_weapon)
                if self.player.equipped_weapon
                else None,
                "equipped_armor": self.serialize_item(self.player.equipped_armor)
                if self.player.equipped_armor
                else None,
                "current_location": self.player.current_location,
                "experience": self.player.experience,
                "level": self.player.level,
                "attribute_points": self.player.attribute_points,
                "gold": self.player.gold,
                "total_gold_earned": self.player.total_gold_earned,
                "travel_steps": self.player.travel_steps,
                "flags": self.player.flags,
                "enemies_killed": self.player.enemies_killed,
                "damage_done": self.player.damage_done,
                "damage_received": self.player.damage_received,
                "total_xp_earned": self.player.total_xp_earned,
                "faction_affinity": self.player.faction_affinity,
                "visited_locations": list(self.player.visited_locations),
                "quests": [
                    {
                        "quest_id": quest.quest_id,
                        "name": quest.name,
                        "description": quest.description,
                        "requirements": quest.requirements,
                        "rewards": quest.rewards,
                        "status": quest.status,
                    }
                    for quest in self.player.quests
                ],
            },
            "world": {
                name: {
                    "items": [self.serialize_item(item) for item in loc.items],
                    "enemies": [self.serialize_enemy(enemy) for enemy in loc.enemies],
                }
                for name, loc in self.world.items()
            },
            "merchant_inventory": [self.serialize_item(item) for item in self.merchant_inventory],
            "triggered_events": list(self.triggered_events),
            "horde_active": self.horde_active,
            "infected_locations": list(self.infected_locations),
            "horde_delay_turns": self.horde_delay_turns,
            "horde_pending": self.horde_pending,
        }
        try:
            with open(self.get_save_path(slot), "w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=2)
            if not quiet:
                print(good(f"Game saved to Slot {slot}."))
        except OSError as exc:
            print(danger(f"Failed to save game: {exc}"))
            return False
        return True

    def load_game(self, slot):
        """Load player and world state from a JSON file."""
        path = self.get_save_path(slot)
        if not os.path.exists(path):
            print("No save file found in that slot.")
            return False
        try:
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError) as exc:
            print(danger(f"Failed to load save file: {exc}"))
            return False

        player_data = data.get("player")
        if not player_data:
            print(danger("Save file missing player data."))
            return False

        location_name = player_data.get("current_location", "Whispering Ruins")
        if location_name not in self.world:
            location_name = "Whispering Ruins"

        self.player = Player(player_data.get("name", "Wayfinder"), location_name)
        self.current_save_slot = slot
        self.player.max_health = player_data.get("max_health", self.player.max_health)
        self.player.health = player_data.get("health", self.player.health)
        self.player.max_mana = player_data.get("max_mana", self.player.max_mana)
        self.player.mana = player_data.get("mana", self.player.mana)
        self.player.strength = player_data.get("strength", self.player.strength)
        self.player.magic = player_data.get("magic", self.player.magic)
        self.player.agility = player_data.get("agility", self.player.agility)
        self.player.class_name = player_data.get("class_name", self.player.class_name)
        self.player.spellbooks_read_count = player_data.get(
            "spellbooks_read_count", self.player.spellbooks_read_count
        )
        self.player.current_active_spell = player_data.get(
            "current_active_spell", self.player.current_active_spell
        )
        self.player.experience = player_data.get("experience", self.player.experience)
        self.player.level = player_data.get("level", self.player.level)
        self.player.attribute_points = player_data.get("attribute_points", self.player.attribute_points)
        self.player.gold = player_data.get("gold", self.player.gold)
        saved_total_gold = player_data.get("total_gold_earned")
        if saved_total_gold is None:
            saved_total_gold = max(self.player.gold, 0)
        self.player.total_gold_earned = saved_total_gold
        self.player.travel_steps = player_data.get("travel_steps", self.player.travel_steps)
        self.player.flags = player_data.get("flags", {}) or {}
        self.player.enemies_killed = player_data.get("enemies_killed", self.player.enemies_killed)
        self.player.damage_done = player_data.get("damage_done", self.player.damage_done)
        self.player.damage_received = player_data.get("damage_received", self.player.damage_received)
        saved_total_xp = player_data.get("total_xp_earned")
        if saved_total_xp is None:
            level = max(1, int(self.player.level))
            base_xp = (level - 1) * level * 50
            saved_total_xp = base_xp + self.player.experience
        self.player.total_xp_earned = saved_total_xp
        self.player.faction_affinity = {
            "Remnants of Aethelgard": 0,
            "Shadow Weavers": 0,
            "Ironclad Nomads": 0,
        }
        self.player.faction_affinity.update(player_data.get("faction_affinity", {}))
        visited_locations = set(player_data.get("visited_locations", []))
        event_lookup = {}
        for name, loc in self.world.items():
            for event in loc.events:
                event_lookup[event["id"]] = name
        for event_id in data.get("triggered_events", []):
            location_name = event_lookup.get(event_id)
            if location_name:
                visited_locations.add(location_name)
        visited_locations.add(location_name)
        self.player.visited_locations = visited_locations

        # Restore inventory and equipment using item templates.
        self.player.inventory = []
        for entry in player_data.get("inventory", []):
            item = self.deserialize_item(entry)
            if item:
                self.player.inventory.append(item)
        equipped_weapon_data = player_data.get("equipped_weapon")
        equipped_armor_data = player_data.get("equipped_armor")
        if equipped_weapon_data:
            if isinstance(equipped_weapon_data, dict):
                self.player.equipped_weapon = self.find_inventory_item(
                    equipped_weapon_data.get("name"),
                    equipped_weapon_data.get("rarity"),
                )
            else:
                self.player.equipped_weapon = self.find_inventory_item(equipped_weapon_data)
        if equipped_armor_data:
            if isinstance(equipped_armor_data, dict):
                self.player.equipped_armor = self.find_inventory_item(
                    equipped_armor_data.get("name"),
                    equipped_armor_data.get("rarity"),
                )
            else:
                self.player.equipped_armor = self.find_inventory_item(equipped_armor_data)

        # Restore quests.
        self.player.quests = []
        for quest_data in player_data.get("quests", []):
            quest = Quest(
                quest_data.get("quest_id", "unknown"),
                quest_data.get("name", "Unknown Quest"),
                quest_data.get("description", ""),
                quest_data.get("requirements", {}),
                quest_data.get("rewards", {}),
            )
            quest.status = quest_data.get("status", "active")
            self.player.quests.append(quest)

        # Restore world items and enemies.
        world_data = data.get("world", {})
        for name, loc in self.world.items():
            if name not in world_data:
                continue
            loc_data = world_data.get(name, {})
            loc.items = []
            for entry in loc_data.get("items", []):
                item = self.deserialize_item(entry)
                if item:
                    loc.items.append(item)
            loc.enemies = []
            for enemy_data in loc_data.get("enemies", []):
                enemy_name = enemy_data.get("name")
                if not enemy_name:
                    continue
                enemy = self.safe_clone_enemy(enemy_name)
                if not enemy:
                    continue
                saved_level = enemy_data.get("level")
                if saved_level is not None:
                    self.scale_enemy_for_player(enemy, preserve_health=False, level=saved_level)
                    saved_health = enemy_data.get("health", enemy.max_health)
                    enemy.health = max(0, min(enemy.max_health, saved_health))
                else:
                    saved_health = enemy_data.get("health", enemy.max_health)
                    enemy.health = max(0, min(enemy.max_health, saved_health))
                loc.enemies.append(enemy)

        self.merchant_inventory = []
        for entry in data.get("merchant_inventory", []):
            item = self.deserialize_item(entry)
            if item:
                self.merchant_inventory.append(item)
        if not self.merchant_inventory:
            self.merchant_inventory = self.build_merchant_inventory()
        self.sanitize_merchant_inventory()

        self.triggered_events = set(data.get("triggered_events", []))
        self.horde_active = data.get("horde_active", False)
        self.infected_locations = set(data.get("infected_locations", []))
        self.horde_delay_turns = data.get("horde_delay_turns", 0)
        self.horde_pending = data.get("horde_pending", {})
        if self.horde_active and not self.infected_locations:
            self.infected_locations = {"The Temporal Breach Apex"}
        self.previous_location = self.player.current_location
        self.needs_redraw = True
        self.check_heartstone_unlock(announce=False)
        self.update_lost_scroll_state()
        self.update_breach_boss_state()
        print(good("Game loaded."))
        return True

    def find_inventory_item(self, item_name, rarity=None):
        """Find an item in inventory by name and optional rarity."""
        for item in self.player.inventory:
            if item.name == item_name and (rarity is None or item.rarity == rarity):
                return item
        return None

    # -----------------------------
    # Game over
    # -----------------------------

    def game_over(self):
        """End the game with a dramatic game over screen."""
        clear_screen()
        over_art = r"""
+-------------------+
|     GAME OVER     |
+-------------------+
           ^^                   @@@@@@@@@
      ^^       ^^            @@@@@@@@@@@@@@@
                           @@@@@@@@@@@@@@@@@@              ^^
                          @@@@@@@@@@@@@@@@@@@@
~~~~ ~~ ~~~~~ ~~~~~~~~ ~~ &&&&&&&&&&&&&&&&&&&& ~~~~~~~ ~~~~~~~~~~~ ~~~
~         ~~   ~  ~       ~~~~~~~~~~~~~~~~~~~~ ~       ~~     ~~ ~
  ~      ~~      ~~ ~~ ~~  ~~~~~~~~~~~~~ ~~~~  ~     ~~~    ~ ~~~  ~ ~~ 
  ~  ~~     ~         ~      ~~~~~~  ~~ ~~~       ~~ ~ ~~  ~~ ~ 
~  ~       ~ ~      ~           ~~ ~~~~~~  ~      ~~  ~             ~~
      ~             ~        ~      ~      ~~   ~    
"""
        print(over_art)
        print(danger("The echoes fade, and the world grows silent."))
        self.print_endgame_summary("FALLEN", accent="1;31")
        self.running = False


# -----------------------------
# Entry point
# -----------------------------


def main():
    """Run the game."""
    game = Game()
    try:
        while True:
            selection = game.start_menu()
            if selection == "new":
                if game.start_new_game_flow():
                    break
                continue
            if selection == "continue":
                if game.continue_game_flow():
                    break
                continue
            if selection == "scores":
                game.show_scores()
                continue
            if selection == "lore":
                game.show_lore()
                continue
            if selection == "quit":
                return

        game.main_loop()
    except KeyboardInterrupt:
        print("\nExiting Echoes of Aethelgard.")
        sys.exit(0)


if __name__ == "__main__":
    main()
