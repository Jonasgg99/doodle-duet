// Word lists by language and difficulty (easy, medium, hard). The game's word setting picks
// which lists are used; a word's level doesn't change its points.
export const WORDS = {
  en: {
    easy: [
      "cat", "dog", "house", "tree", "sun", "moon", "car", "fish", "apple", "banana",
      "ball", "boat", "flower", "star", "cloud", "bird", "cake", "hat", "shoe", "book",
      "chair", "cup", "key", "egg", "snake", "pizza", "heart", "bed", "door", "clock",
      "rain", "snowman", "glasses", "ghost", "spoon", "bread", "bee", "candle", "kite", "mouse",
      "pig", "duck", "rainbow", "pencil", "phone", "sock", "bottle", "ladder", "tent", "cheese",
    ],
    medium: [
      "bicycle", "lighthouse", "giraffe", "volcano", "castle", "octopus", "umbrella", "penguin", "rocket", "guitar",
      "dinosaur", "mermaid", "camera", "hamburger", "spider web", "ice cream", "toothbrush", "sandcastle", "skateboard", "windmill",
      "crown", "dragon", "anchor", "cactus", "igloo", "parachute", "robot", "scarecrow", "treasure", "waterfall",
      "fireworks", "hedgehog", "jellyfish", "kangaroo", "lightning", "microphone", "pirate", "popcorn", "saxophone", "sloth",
      "submarine", "tractor", "unicorn", "vampire", "wizard", "beehive", "campfire", "ferris wheel", "hot air balloon", "tornado",
    ],
    hard: [
      "sleepwalking", "homesick", "procrastination", "jealousy", "gravity", "echo", "deja vu", "traffic jam", "time travel", "nightmare",
      "brain freeze", "hangover", "photosynthesis", "inflation", "wifi", "allergy", "first date", "sunburn", "hiccups", "midlife crisis",
      "awkward silence", "black friday", "evolution", "reflection", "shadow", "silence", "democracy", "karaoke", "yoga", "camouflage",
      "earthquake", "eclipse", "hide and seek", "jet lag", "lullaby", "marathon", "meditation", "recycling", "sarcasm", "selfie",
      "snooze button", "spoiler", "stage fright", "teleport", "tickle", "wedding", "winter sleep", "zombie apocalypse", "group chat", "wanderlust",
    ],
  },
  no: {
    easy: [
      "katt", "hund", "hus", "tre", "sol", "måne", "bil", "fisk", "eple", "banan",
      "ball", "båt", "blomst", "stjerne", "sky", "fugl", "kake", "hatt", "sko", "bok",
      "stol", "kopp", "nøkkel", "egg", "slange", "pizza", "hjerte", "seng", "dør", "klokke",
      "regn", "snømann", "briller", "spøkelse", "skje", "brød", "bie", "lys", "drage", "mus",
      "gris", "and", "regnbue", "blyant", "telefon", "sokk", "flaske", "stige", "telt", "ost",
    ],
    medium: [
      "sykkel", "fyrtårn", "sjiraff", "vulkan", "slott", "blekksprut", "paraply", "pingvin", "rakett", "gitar",
      "dinosaur", "havfrue", "kamera", "hamburger", "spindelvev", "iskrem", "tannbørste", "sandslott", "skateboard", "vindmølle",
      "krone", "lindorm", "anker", "kaktus", "iglo", "fallskjerm", "robot", "fugleskremsel", "skatt", "foss",
      "fyrverkeri", "pinnsvin", "manet", "kenguru", "lyn", "mikrofon", "pirat", "popkorn", "saksofon", "dovendyr",
      "ubåt", "traktor", "enhjørning", "vampyr", "trollmann", "bikube", "bål", "pariserhjul", "luftballong", "tornado",
      "elg", "troll", "vaffel", "brunost", "ski",
    ],
    hard: [
      "søvngjengeri", "hjemlengsel", "utsettelse", "sjalusi", "tyngdekraft", "ekko", "deja vu", "trafikkork", "tidsreise", "mareritt",
      "hjernefrys", "fyllesyke", "fotosyntese", "inflasjon", "wifi", "allergi", "første date", "solbrent", "hikke", "midtlivskrise",
      "pinlig stillhet", "black friday", "evolusjon", "speilbilde", "skygge", "stillhet", "demokrati", "karaoke", "yoga", "kamuflasje",
      "jordskjelv", "solformørkelse", "gjemsel", "jetlag", "vuggesang", "maraton", "meditasjon", "resirkulering", "sarkasme", "selfie",
      "slumreknapp", "spoiler", "sceneskrekk", "teleportering", "kiling", "bryllup", "dvale", "zombieapokalypse", "gruppechat", "utferdstrang",
      "koselig", "friluftsliv", "dugnad", "matpakke", "russetid",
    ],
  },
};

// Adult words (Jonas, 2026-11-08: "include dirty words in the word lists"), mixed into the
// lists above by how hard they are to draw. Delete this block to make the game clean again.
const ADULT = {
  en: {
    easy: ["bra", "boobs", "butt", "thong", "condom", "naked", "whip", "handcuffs", "nipple", "penis", "lube", "dildo", "vibrator", "blindfold", "horny", "hickey"],
    medium: [
      "lingerie", "stripper", "pole dance", "lap dance", "skinny dipping", "strip poker", "booty call", "quickie", "threesome", "spanking",
      "foreplay", "doggy style", "cowgirl", "missionary", "boner", "french kiss", "make out", "sex toy", "strip club", "safe word",
    ],
    hard: [
      "one night stand", "walk of shame", "morning wood", "sixty nine", "orgasm", "bondage", "nudist beach",
      "wet dream", "shower sex", "naughty nurse", "dirty talk", "mile high club", "body shots", "chastity belt",
    ],
  },
  no: {
    easy: ["bh", "pupper", "rumpe", "string", "kondom", "naken", "pisk", "håndjern", "brystvorte", "penis", "glidemiddel", "dildo", "vibrator", "sugemerke", "kåt"],
    medium: [
      "reizeundertøy", "stripper", "stangdans", "fangdans", "nakenbading", "strippepoker", "ligg", "trekant", "ris på rumpa", "forspill",
      "doggy", "rytterstilling", "misjonærstilling", "ståpikk", "tungekyss", "klining", "sexleketøy", "strippeklubb", "safeord", "bind for øynene",
    ],
    hard: [
      "engangsligg", "sekstini", "orgasme", "bondage", "nakenstrand", "våt drøm", "dusjsex",
      "frekk sykepleier", "skittenprat", "pornoblad", "bryllupsnatt", "kyskhetsbelte", "trusetyv",
    ],
  },
};
for (const [lang, levels] of Object.entries(ADULT)) for (const [level, words] of Object.entries(levels)) WORDS[lang][level].push(...words);

export const LANG_NAMES = { en: "English", no: "Norsk" };
