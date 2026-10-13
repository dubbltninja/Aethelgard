"""Data definitions for Echoes of Aethelgard."""

WIN_ENDGAME_ART = r"""
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

ITEM_DEFS = {
    "Rusty Dagger": {
        "description": "A pitted blade with a faint echo of old magic.",
        "item_type": "weapon",
        "effect": {"damage": 4},
        "weapon_type": "melee",
        "gold_value": 8,
    },
    "Amulet of Echoes": {
        "description": "A faintly glowing amulet tied to the Great Sundering. Enhances magical affinity.",
        "item_type": "quest_item",
        "effect": {"magic": 1},
        "gold_value": 60,
        "major": True,
    },
    "Ley-Touched Tonic": {
        "description": "A swirling vial that smells like rain on stone. Restores health and mana.",
        "item_type": "consumable",
        "effect": {"health": 25, "mana": 15},
        "gold_value": 12,
    },
    "Ironclad Mail": {
        "description": "Patchwork armor of riveted plates, worn by the nomads. Provides solid protection.",
        "item_type": "armor",
        "effect": {"defense": 4},
        "gold_value": 40,
        "major": True,
    },
    "Echo Crystal": {
        "description": "A crystal that seems to hold voices from the past.",
        "item_type": "quest_item",
        "effect": {},
        "gold_value": 70,
        "major": True,
    },
    "Dark Spellbook": {
        "description": (
            "A charred tome of corrupted secrets. Reading its forbidden pages unlocks new magical "
            "abilities, but at a cost to your vitality."
        ),
        "item_type": "consumable",
        "effect": {"health": -15},
        "gold_value": 8,
        "major": True,
    },
    "Mana Bloom": {
        "description": "A rare blossom steeped in ley mist. It brings cool clarity.",
        "item_type": "consumable",
        "effect": {"health": 10, "mana": 30},
        "gold_value": 25,
        "major": True,
    },
    "Scholar's Lost Scroll": {
        "description": "A waterlogged scroll sealed with Remnant wax. The ink still holds secrets.",
        "item_type": "quest_item",
        "effect": {},
        "gold_value": 45,
        "major": True,
    },
    "Void Shard": {
        "description": "A shard of condensed shadow that promises power.",
        "item_type": "quest_item",
        "effect": {},
        "gold_value": 20,
    },
    "Shadow-Kissed Dagger": {
        "description": "A dagger forged in voidlight. Each strike hungers for its wielder.",
        "item_type": "weapon",
        "effect": {"damage": 7, "curse_chance": 20, "curse_damage": 3},
        "weapon_type": "melee",
        "gold_value": 75,
        "major": True,
    },
    "Ironclad Plate Armor": {
        "description": "A heavy cuirass of layered steel. Strong against blades, weak to magic.",
        "item_type": "armor",
        "effect": {"defense": 6},
        "gold_value": 65,
        "major": True,
    },
    "Stabilized Heartstone": {
        "description": "A calm core that hums with the ley lines.",
        "item_type": "quest_item",
        "effect": {"magic": 1, "mana": 15},
        "gold_value": 90,
        "major": True,
    },
    "Heartstone Core": {
        "description": "A stolen heartbeat of the world. Power surges, but each pulse hurts.",
        "item_type": "quest_item",
        "effect": {"magic": 2, "mana": 25, "health": -15},
        "gold_value": 100,
        "major": True,
    },
    "Chronal Dust": {
        "description": "Fine grains that glitter with frozen time. It sharpens the mind.",
        "item_type": "consumable",
        "effect": {"mana": 25},
        "gold_value": 18,
    },
    "Glow Moss": {
        "description": "Bioluminescent moss steeped in swamp magic. It soothes wounds.",
        "item_type": "consumable",
        "effect": {"health": 20, "mana": 5},
        "gold_value": 10,
    },
    "Aetherium Shard": {
        "description": "A sliver from a humming spire, warm with raw energy.",
        "item_type": "quest_item",
        "effect": {},
        "gold_value": 28,
    },
    "Sky-Whisper Talisman": {
        "description": "A weathered charm that steadies breath in high winds.",
        "item_type": "quest_item",
        "effect": {"agility": 1},
        "gold_value": 32,
        "major": True,
    },
    "Chronos Lens": {
        "description": "A cracked lens that focuses time's echo.",
        "item_type": "quest_item",
        "effect": {"magic": 2, "mana": 10},
        "gold_value": 120,
        "major": True,
    },
    "Traveler's Sword": {
        "description": "A serviceable blade for long roads and sudden fights.",
        "item_type": "weapon",
        "effect": {"damage": 5},
        "weapon_type": "melee",
        "gold_value": 20,
    },
    "Primitive Bow": {
        "description": "A simple hunting bow, crudely fashioned but effective for a quick shot.",
        "item_type": "weapon",
        "effect": {"damage": 4},
        "weapon_type": "ranged_bow",
        "gold_value": 15,
    },
    "Elven Bow": {
        "description": (
            "An elegantly carved bow, light as a feather and perfectly balanced, "
            "whispering ancient forest secrets."
        ),
        "item_type": "weapon",
        "effect": {"damage": 8, "agility": 1},
        "weapon_type": "ranged_bow",
        "gold_value": 70,
    },
    "Apprentice Staff": {
        "description": "A basic wooden staff, suitable for channeling nascent magical energies.",
        "item_type": "weapon",
        "effect": {"damage": 2, "magic": 1, "mana_cost_reduction_percent": 10},
        "weapon_type": "magic_staff",
        "gold_value": 30,
    },
    "Necromancer Staff": {
        "description": (
            "A staff of dark, polished bone, pulsating with forbidden power and a faint, "
            "chilling aura."
        ),
        "item_type": "weapon",
        "effect": {"damage": 4, "magic": 3, "mana_cost_reduction_percent": 20, "life_steal_percent": 5},
        "weapon_type": "magic_staff",
        "gold_value": 100,
    },
    "Warrior's Sword": {
        "description": "A balanced blade favored by veteran fighters.",
        "item_type": "weapon",
        "effect": {"damage": 7},
        "weapon_type": "melee",
        "gold_value": 40,
    },
    "Wildling Hide Armor": {
        "description": (
            "Crude but tough armor made from Mistwood hides. "
            "Smells faintly of damp earth."
        ),
        "item_type": "armor",
        "effect": {"defense": 2},
        "gold_value": 25,
    },
    "Glyphbound Lantern": {
        "description": "A lantern etched with warding glyphs that sharpen focus.",
        "item_type": "quest_item",
        "effect": {"magic": 1},
        "gold_value": 30,
    },
}

ENEMY_DEFS = {
    "Corrupted Shade": {
        "description": "A smeared silhouette of a once-noble mage, warped by wild magic.",
        "health": 30,
        "damage": 8,
        "defense": 2,
        "agility": 4,
        "exp_reward": 35,
        "magic_resistance": 0.0,
        "loot": ["Dark Spellbook"],
    },
    "Wildling Brute": {
        "description": "A hulking creature grown from twisted roots and bone.",
        "health": 45,
        "damage": 10,
        "defense": 3,
        "agility": 3,
        "exp_reward": 40,
        "magic_resistance": 0.0,
        "loot": ["Ley-Touched Tonic"],
        "bonus_loot": [{"name": "Wildling Hide Armor", "chance": 0.50}],
    },
    "Arcane Wisp": {
        "description": "A floating knot of feral magic crackling with unstable energy.",
        "health": 25,
        "damage": 6,
        "defense": 1,
        "agility": 6,
        "exp_reward": 30,
        "magic_resistance": 0.0,
        "loot": ["Ley-Touched Tonic"],
    },
    "Drowned Archivist": {
        "description": "A sodden scholar bound to drowned pages, still guarding secrets.",
        "health": 35,
        "damage": 7,
        "defense": 2,
        "agility": 4,
        "exp_reward": 45,
        "magic_resistance": 0.0,
        "loot": ["Mana Bloom"],
    },
    "Void-Touched Stalker": {
        "description": "A predator born of corrupted ley echoes, eyes like cold stars.",
        "health": 40,
        "damage": 9,
        "defense": 2,
        "agility": 6,
        "exp_reward": 55,
        "magic_resistance": 0.0,
        "loot": ["Void Shard"],
        "bonus_loot": [{"name": "Warrior's Sword", "chance": 0.25}],
    },
    "Stone-Hide Golem": {
        "description": "A hulking construct of slate and iron. Magic skitters off its hide.",
        "health": 50,
        "damage": 12,
        "defense": 5,
        "agility": 2,
        "exp_reward": 85,
        "magic_resistance": 0.8,
        "loot": [],
    },
    "Shimmering Phantom": {
        "description": "A mirage given teeth, flickering between moments.",
        "health": 32,
        "damage": 7,
        "defense": 2,
        "agility": 7,
        "exp_reward": 45,
        "magic_resistance": 0.0,
        "loot": ["Chronal Dust"],
    },
    "Aetherial Weaver": {
        "description": "A luminous entity spinning strands of raw magic between the spires.",
        "health": 38,
        "damage": 8,
        "defense": 3,
        "agility": 5,
        "exp_reward": 55,
        "magic_resistance": 0.0,
        "loot": ["Aetherium Shard"],
    },
    "Sky-Whisper Sentinel": {
        "description": "A wind-hardened guardian that strikes with cutting gusts.",
        "health": 42,
        "damage": 9,
        "defense": 3,
        "agility": 5,
        "exp_reward": 60,
        "magic_resistance": 0.0,
        "loot": ["Sky-Whisper Talisman"],
    },
    "Glowfen Mireling": {
        "description": "An amphibious creature wreathed in eerie green light.",
        "health": 36,
        "damage": 7,
        "defense": 2,
        "agility": 4,
        "exp_reward": 50,
        "magic_resistance": 0.0,
        "loot": ["Glow Moss"],
    },
    "Temporal Aberration": {
        "description": "A warped being that flickers between past and future strikes.",
        "health": 55,
        "damage": 12,
        "defense": 4,
        "agility": 6,
        "exp_reward": 85,
        "magic_resistance": 0.0,
        "loot": ["Chronal Dust"],
    },
    "The Chronos Tyrant": {
        "description": (
            "A towering, amorphous figure of rippling time. Skeletal limbs and crystalline shards "
            "surface and vanish within its shifting mass."
        ),
        "health": 126,
        "damage": 14,
        "defense": 5,
        "agility": 4,
        "exp_reward": 180,
        "magic_resistance": 0.3,
        "loot": [],
    },
}

LOCATION_DEFS = {
    "Whispering Ruins": {
        "description": (
            "The air smells of ozone and decay, and a chill wind carries faint whispers. Twisted trees "
            "reach into a twilight sky, their branches dotted with glowing crystals. Broken stone tablets "
            "litter the ground, etched with worn sigils."
        ),
        "exits": {"north": "Crumbling Archway", "east": "Mistwood Path", "south": "Sunken Archives"},
        "items": ["Amulet of Echoes"],
        "enemies": [],
        "npcs": [
            {
                "name": "Ilyra",
                "description": "A Remnant scholar wrapped in faded robes, eyes bright with purpose.",
                "faction": "Remnants of Aethelgard",
                "dialogue": (
                    "The whispers here are louder each day. The past is trying to speak. Will you help me listen?"
                ),
            }
        ],
        "events": [
            {
                "id": "ruins_echo",
                "text": "A low, resonant hum vibrates under your skin, as if the stones are breathing.",
                "once": True,
            }
        ],
        "art": r"""
 (')) ^v^  _           (`)_
(__)_) ,--j j-------, (__)_)
      /_.-.___.-.__/ \
    ,8| [_],-.[_] | oOo
,,,oO8|_o8_|_|_8o_|&888o,,,hjw
""",
    },
    "Sunken Archives": {
        "description": (
            "Half-buried vaults dip beneath brackish water, with shelves sagging under soaked tomes. "
            "A slow drip marks time, and the ley lines glow through the flood."
        ),
        "exits": {"north": "Whispering Ruins", "south": "Heartstone Depths"},
        "items": [],
        "enemies": [],
        "npcs": [],
        "events": [
            {
                "id": "archives_murmur",
                "text": "A submerged page unfurls, whispering of the Ley Line Conflux.",
                "once": True,
            }
        ],
        "art": r"""
   ~~~~~~~~~~
  /________/|
  | []  [] ||
  |__~~__|/
""",
    },
    "Heartstone Depths": {
        "description": (
            "The ground opens into a chamber of raw, pulsing magic. A massive Heartstone sits at the "
            "center, each beat sending ripples through the air."
        ),
        "exits": {"north": "Sunken Archives", "east": "Shimmering Pass"},
        "items": [],
        "enemies": [],
        "npcs": [],
        "events": [
            {
                "id": "heartstone_thrum",
                "text": "The Heartstone answers your presence with a tremor that shakes dust from the ceiling.",
                "once": True,
            }
        ],
        "art": r"""
   .--.
  ( <> )
   '--'
""",
    },
    "Shimmering Pass": {
        "description": (
            "A narrow, winding path cuts between jagged, crystal-laced rock. Residual magic shimmers in "
            "the air, bending distance and tricking the eye."
        ),
        "exits": {"west": "Heartstone Depths", "east": "Aetherium Spires"},
        "items": ["Chronal Dust"],
        "enemies": ["Shimmering Phantom"],
        "npcs": [],
        "events": [
            {
                "id": "pass_shimmer",
                "text": "Light fractures into false paths, then snaps back into focus.",
                "once": True,
            }
        ],
        "art": r"""
  /\  /\  /\
 /  \/  \/  \
 \__/ /\ \__/
""",
    },
    "Aetherium Spires": {
        "description": (
            "Colossal crystalline spires rise in a wide basin and hum with raw energy. Ethereal creatures "
            "drift between them, trailing pale light."
        ),
        "exits": {"west": "Shimmering Pass", "east": "Sky-Whisper Plateau"},
        "items": ["Aetherium Shard"],
        "enemies": ["Aetherial Weaver"],
        "npcs": [],
        "events": [
            {
                "id": "spires_hum",
                "text": "The spires throb in unison, a slow heartbeat of raw arcana.",
                "once": True,
            }
        ],
        "art": r"""
   ||   ||
   ||   ||
  /||\ /||\
""",
    },
    "Sky-Whisper Plateau": {
        "description": (
            "A windswept, high shelf opens to wide views of the fractured land. Weathered stone markers "
            "stand like sentries, and a hard climb leads north to the Blighted Outpost."
        ),
        "exits": {"west": "Aetherium Spires", "east": "Veridian Glowlands", "north": "Blighted Outpost"},
        "items": ["Sky-Whisper Talisman"],
        "enemies": ["Sky-Whisper Sentinel"],
        "npcs": [],
        "events": [
            {
                "id": "plateau_gale",
                "text": "The wind murmurs in broken syllables, as if the sky itself is speaking.",
                "once": True,
            }
        ],
        "art": r"""
   _/\_
 _/    \_
/        \
""",
    },
    "Veridian Glowlands": {
        "description": (
            "A swampy basin packed with bioluminescent flora. The soil glows green, and humid air clings "
            "as amphibious shapes slip through the reeds."
        ),
        "exits": {"west": "Sky-Whisper Plateau", "east": "The Chronos Nexus"},
        "items": ["Glow Moss"],
        "enemies": ["Glowfen Mireling"],
        "npcs": [],
        "events": [
            {
                "id": "glowlands_pulse",
                "text": "The glow brightens in waves, like the basin is breathing.",
                "once": True,
            }
        ],
        "art": r"""
  ~~~  ~~~
 /\/\ /\/\
  ||    ||
""",
    },
    "The Chronos Nexus": {
        "description": (
            "A ruined observatory sits beneath a shattered dome. Time buckles here, and echoes of past "
            "and future flicker across cracked stone."
        ),
        "exits": {"west": "Veridian Glowlands", "north": "The Temporal Breach Apex"},
        "items": ["Chronos Lens"],
        "enemies": ["Temporal Aberration"],
        "npcs": [],
        "events": [
            {
                "id": "nexus_echo",
                "text": "A future voice overlaps your own, warning of a choice already made.",
                "once": True,
            }
        ],
        "art": r"""
   ___
  / _ \
 | |_| |
  \___/
""",
    },
    "The Temporal Breach Apex": {
        "description": (
            "Reality tears here in violent seams. Impossible angles fold into one another, and the air "
            "hums with distant, unsettling screams."
        ),
        "exits": {"south": "The Chronos Nexus"},
        "items": [],
        "enemies": ["The Chronos Tyrant"],
        "npcs": [],
        "events": [
            {
                "id": "apex_rend",
                "text": "The breach flashes, and the world stutters as if deciding what to become.",
                "once": True,
            }
        ],
        "art": r"""
   /\  /\
  /  \/  \
 /  /\ \  \
 \_/  \_\_/
""",
    },
    "Crumbling Archway": {
        "description": (
            "A monumental arch of cracked marble towers over you. The stone is warm, as if it remembers "
            "a brighter age. Vines twitch with borrowed life."
        ),
        "exits": {"south": "Whispering Ruins", "north": "Darkened Corridor"},
        "items": [],
        "enemies": [],
        "npcs": [],
        "events": [
            {
                "id": "archway_whisper",
                "text": "A whisper slips through the archway: 'Wayfinder... follow.'",
                "once": True,
            }
        ],
        "art": r"""
    _________
   /         \
  /  /~~~\    \
 |  |     |    |
 |  |     |    |
 |  |_____|    |
  \___________/
""",
    },
    "Darkened Corridor": {
        "description": (
            "The corridor is slick with moisture, and faint fungi cling to the ceiling. Every footstep "
            "sends ripples of pale light across the stones. A growl echoes ahead."
        ),
        "exits": {"south": "Crumbling Archway", "north": "Shattered Library"},
        "items": [],
        "enemies": ["Corrupted Shade"],
        "npcs": [],
        "events": [],
        "art": r"""
|====================|
|  []          []    |
|                    |
|      ______        |
|_____/______\_______|
""",
    },
    "Shattered Library": {
        "description": (
            "Collapsed shelves form jagged ridges of splintered wood and stone. Dust motes swirl in "
            "a dim glow, and you can almost hear pages turning on their own."
        ),
        "exits": {"south": "Darkened Corridor", "east": "Silverwood Plaza"},
        "items": ["Echo Crystal"],
        "enemies": ["Arcane Wisp"],
        "npcs": [],
        "events": [
            {
                "id": "library_shiver",
                "text": "A cold gust rattles the shelves, and you smell old ink and rain.",
                "once": True,
            }
        ],
        "art": r"""
  ___________________
 |__|__|__|__|__|__|_|
 |__|__|__|__|__|__|_|
 |__|__|__|__|__|__|_|
 |___________________|
""",
    },
    "Silverwood Plaza": {
        "description": (
            "Once the heart of Silverwood, this plaza is now a cratered ring of marble. Broken fountains "
            "seep shimmering mist, and the air tastes of copper."
        ),
        "exits": {"west": "Shattered Library", "south": "Mistwood Path", "east": "Chasm of Whispers"},
        "items": [],
        "enemies": ["Arcane Wisp"],
        "npcs": [],
        "events": [
            {
                "id": "plaza_surge",
                "text": "Wild magic surges. A chorus of distant bells rings out, then fades.",
                "once": True,
            }
        ],
        "art": r"""
     .-.
   _(   )_
  (___.___)
     / \
    /___\
""",
    },
    "Chasm of Whispers": {
        "description": (
            "A jagged rift splits the earth, breathing air as cold as the void. Murmurs rise from below, "
            "promising power to those who listen."
        ),
        "exits": {"west": "Silverwood Plaza", "east": "Voidscar Hollow"},
        "items": [],
        "enemies": [],
        "npcs": [
            {
                "name": "Nyx",
                "description": "A shadow-wrapped figure whose eyes burn with quiet starlight.",
                "faction": "Shadow Weavers",
                "dialogue": (
                    "The void remembers you. Its shards wait in the hollow to the east, "
                    "where the corruption thickens."
                ),
            }
        ],
        "events": [
            {
                "id": "chasm_hum",
                "text": "A low hum rises from the abyss, vibrating with hungry intent.",
                "once": True,
            }
        ],
        "art": r"""
  ||        ||
  ||        ||
__||________||__
""",
    },
    "Voidscar Hollow": {
        "description": (
            "Beyond the chasm, the land collapses into a hollow of obsidian scree and bruised crystal. "
            "Corrupted creatures stalk the dim glow, their outlines fraying into smoke."
        ),
        "exits": {"west": "Chasm of Whispers"},
        "items": [],
        "enemies": ["Void-Touched Stalker", "Void-Touched Stalker", "Void-Touched Stalker"],
        "npcs": [],
        "events": [
            {
                "id": "voidscar_thrum",
                "text": "The air tastes of ash and frost. Something in the hollow hisses your name.",
                "once": True,
            }
        ],
        "art": r"""
   __     __
  /  \___/  \
 /           \
 \__       __/
    \_____/
""",
    },
    "Mistwood Path": {
        "description": (
            "A winding trail threads through fog-laden trees. The bark glows faintly, and the air smells "
            "of crushed herbs. Shadows drift between the trunks."
        ),
        "exits": {
            "west": "Whispering Ruins",
            "east": "Ironclad Camp",
            "north": "Silverwood Plaza",
            "south": "The Wayfarer's Respite",
        },
        "items": ["Ley-Touched Tonic"],
        "enemies": [],
        "npcs": [],
        "events": [],
        "art": r"""
  &&&   &&&   &&&
 &&&&& &&&&& &&&&&
  ||     ||     ||
  ||     ||     ||
""",
    },
    "The Wayfarer's Respite": {
        "description": (
            "A rare pocket of calm between mana-scarred cliffs. A silver-tinged stream winds through "
            "smooth stones, and a distant hum never quite fades."
        ),
        "exits": {"north": "Mistwood Path"},
        "items": [],
        "enemies": [],
        "npcs": [
            {
                "name": "Kaelen Stonehand",
                "description": "A broad-shouldered trader with weathered hands and a sharper gaze.",
                "faction": "Wayfarer's Respite",
                "dialogue": "Hells of a road out there. I trade fair, and I don't waste words. Need supplies?",
            }
        ],
        "events": [
            {
                "id": "respite_breath",
                "text": "The stream's soft rush quiets the chaos in your thoughts.",
                "once": True,
            }
        ],
        "art": r"""
    _/\_
   /    \
  /______\
   ~~~~~~
""",
    },
    "Ironclad Camp": {
        "description": (
            "Canvas tents and scrap-metal barricades form a rough circle. Smoke and hot iron fill the air, "
            "punctuated by the clatter of tools."
        ),
        "exits": {"west": "Mistwood Path", "north": "Barren Peaks"},
        "items": [],
        "enemies": [],
        "npcs": [
            {
                "name": "Brak",
                "description": "A scarred Ironclad scout sharpening a chipped axe.",
                "faction": "Ironclad Nomads",
                "dialogue": "Magic twists the wilds. We survive by steel and stubbornness. Prove your worth, Wayfinder.",
            }
        ],
        "events": [
            {
                "id": "camp_clamor",
                "text": "Hammer strikes ring out like a steady heartbeat.",
                "once": True,
            }
        ],
        "art": r"""
     /\
    /  \
   /____\
   | /\ |
   |/  \|
""",
    },
    "Barren Peaks": {
        "description": (
            "Razor-edged ridges scrape the sky as the wind howls through broken stone. Higher up, the air "
            "tastes of dust and iron."
        ),
        "exits": {"south": "Ironclad Camp", "east": "Blighted Outpost"},
        "items": [],
        "enemies": ["Wildling Brute"],
        "npcs": [],
        "events": [
            {
                "id": "peaks_gale",
                "text": "A cutting gale whips through the peaks, carrying flecks of stone.",
                "once": True,
            }
        ],
        "art": r"""
    /\    /\
   /  \  /  \
  /    \/    \
""",
    },
    "Blighted Outpost": {
        "description": (
            "Splintered palisades jut from the rock like broken teeth. The ground is scarred with drag "
            "marks and heavy footprints."
        ),
        "exits": {"west": "Barren Peaks", "south": "Sky-Whisper Plateau", "north": "The Emberforge"},
        "items": [],
        "enemies": ["Stone-Hide Golem", "Stone-Hide Golem"],
        "npcs": [],
        "events": [
            {
                "id": "outpost_ash",
                "text": "Stone scrapes stone as something massive shifts in the dark.",
                "once": True,
            }
        ],
        "art": r"""
 [--] [--]
   |___|
  /_____\
""",
    },
    "The Emberforge": {
        "description": (
            "A sheltered canyon opens into a warm cavern, its walls veined with ember-bright stone. "
            "Heat breathes up from below, and a hammer rings through the glow."
        ),
        "exits": {"south": "Blighted Outpost"},
        "items": [],
        "enemies": [],
        "npcs": [
            {
                "name": "Borin Stonefist",
                "description": "A gruff blacksmith with soot-darkened arms and a steady, appraising gaze.",
                "faction": "Ironclad Nomads",
                "dialogue": (
                    "Steel sings louder than fear. Pay the cost, and I'll make your edge worth the road."
                ),
            }
        ],
        "events": [
            {
                "id": "emberforge_heat",
                "text": "The forge heat wraps around you like a heavy cloak.",
                "once": True,
            }
        ],
        "art": r"""
   (  )
  (    )
   )  (
  /____\
""",
    },
}
