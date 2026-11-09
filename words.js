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
      "tooth", "hand", "foot", "eye", "nose", "ear", "mouth", "baby", "king", "queen",
      "cow", "horse", "sheep", "frog", "turtle", "rabbit", "lion", "elephant", "owl", "butterfly",
      "worm", "snail", "crab", "shark", "whale", "carrot", "grapes", "cherry", "pear", "lemon",
      "strawberry", "watermelon", "corn", "mushroom", "cookie", "donut", "lollipop", "sandwich", "hot dog", "fork",
      "knife", "plate", "lamp", "window", "table", "sofa", "toilet", "bathtub", "pillow", "train",
      "bus", "airplane", "truck", "helicopter", "drum", "balloon", "gift", "sword", "hammer", "tie",
      "shirt", "dress", "scarf", "glove", "ring", "bell", "leaf", "mountain", "island", "bone",
      "spider", "ant",
    ],
    medium: [
      "bicycle", "lighthouse", "giraffe", "volcano", "castle", "octopus", "umbrella", "penguin", "rocket", "guitar",
      "dinosaur", "mermaid", "camera", "hamburger", "spider web", "ice cream", "toothbrush", "sandcastle", "skateboard", "windmill",
      "crown", "dragon", "anchor", "cactus", "igloo", "parachute", "robot", "scarecrow", "treasure", "waterfall",
      "fireworks", "hedgehog", "jellyfish", "kangaroo", "lightning", "microphone", "pirate", "popcorn", "saxophone", "sloth",
      "submarine", "tractor", "unicorn", "vampire", "wizard", "beehive", "campfire", "ferris wheel", "hot air balloon", "tornado",
      "astronaut", "ballerina", "barbecue", "bow and arrow", "bridge", "bulldozer", "carousel", "chess", "cowboy", "crocodile",
      "detective", "diamond", "dolphin", "elevator", "fire truck", "flamingo", "fountain", "goldfish", "gorilla", "hammock",
      "helmet", "hourglass", "ice skates", "jungle", "knight", "ladybug", "lawn mower", "magnet", "magician", "map",
      "mummy", "ninja", "palm tree", "panda", "peacock", "piano", "pyramid", "rollercoaster", "sailboat", "satellite",
      "scissors", "seahorse", "shipwreck", "skeleton", "snow globe", "spaceship", "squirrel", "stethoscope", "sushi", "swing",
      "telescope", "toaster", "trampoline", "tuxedo", "vacuum cleaner", "violin", "walrus", "werewolf", "wheelbarrow", "zebra",
      "bunk bed", "cupcake", "fishing rod", "haunted house", "mailbox", "snorkel", "sombrero", "taco", "mosquito", "bat",
      "alien", "superhero", "treehouse", "chimney", "ski jump", "water slide",
    ],
    hard: [
      "sleepwalking", "homesick", "procrastination", "jealousy", "gravity", "echo", "deja vu", "traffic jam", "time travel", "nightmare",
      "brain freeze", "hangover", "photosynthesis", "inflation", "wifi", "allergy", "first date", "sunburn", "hiccups", "midlife crisis",
      "awkward silence", "black friday", "evolution", "reflection", "shadow", "silence", "democracy", "karaoke", "yoga", "camouflage",
      "earthquake", "eclipse", "hide and seek", "jet lag", "lullaby", "marathon", "meditation", "recycling", "sarcasm", "selfie",
      "snooze button", "spoiler", "stage fright", "teleport", "tickle", "wedding", "winter sleep", "zombie apocalypse", "group chat", "wanderlust",
      "anxiety", "nostalgia", "gossip", "freedom", "luck", "heatwave", "global warming", "social media", "bucket list", "comfort zone",
      "peer pressure", "road trip", "power nap", "bad hair day", "ghosting", "binge watching", "online dating", "small talk", "inside joke", "mood swing",
      "double date", "honeymoon", "breakup", "friend zone", "self care", "overthinking", "daydream", "goosebumps", "butterflies in stomach", "monday morning",
      "rush hour", "fake news", "time zone", "bedtime story", "pillow fight", "sleepover", "surprise party", "white lie", "regret", "temptation",
      "hypnosis", "telepathy", "multitasking", "photobomb", "brainstorm", "shortcut", "loophole", "influencer", "autocorrect", "password",
      "screen time", "dad joke", "midnight snack", "comfort food", "sugar rush", "food coma", "personal space", "karma", "chain reaction", "domino effect",
      "butterfly effect", "parallel universe", "black hole", "big bang",
    ],
  },
  no: {
    easy: [
      "katt", "hund", "hus", "tre", "sol", "måne", "bil", "fisk", "eple", "banan",
      "ball", "båt", "blomst", "stjerne", "sky", "fugl", "kake", "hatt", "sko", "bok",
      "stol", "kopp", "nøkkel", "egg", "slange", "pizza", "hjerte", "seng", "dør", "klokke",
      "regn", "snømann", "briller", "spøkelse", "skje", "brød", "bie", "lys", "drage", "mus",
      "gris", "and", "regnbue", "blyant", "telefon", "sokk", "flaske", "stige", "telt", "ost",
      "tann", "hånd", "fot", "øye", "nese", "øre", "munn", "baby", "konge", "dronning",
      "ku", "hest", "sau", "frosk", "skilpadde", "kanin", "løve", "elefant", "ugle", "sommerfugl",
      "meitemark", "snegle", "krabbe", "hai", "hval", "gulrot", "druer", "kirsebær", "pære", "sitron",
      "jordbær", "vannmelon", "mais", "sopp", "kjeks", "smultring", "kjærlighet på pinne", "smørbrød", "pølse", "gaffel",
      "kniv", "tallerken", "lampe", "vindu", "bord", "sofa", "toalett", "badekar", "pute", "tog",
      "buss", "fly", "lastebil", "helikopter", "tromme", "ballong", "gave", "sverd", "hammer", "slips",
      "skjorte", "kjole", "skjerf", "vott", "ring", "bjelle", "blad", "fjell", "øy", "bein",
      "edderkopp", "maur",
    ],
    medium: [
      "sykkel", "fyrtårn", "sjiraff", "vulkan", "slott", "blekksprut", "paraply", "pingvin", "rakett", "gitar",
      "dinosaur", "havfrue", "kamera", "hamburger", "spindelvev", "iskrem", "tannbørste", "sandslott", "skateboard", "vindmølle",
      "krone", "lindorm", "anker", "kaktus", "iglo", "fallskjerm", "robot", "fugleskremsel", "skatt", "foss",
      "fyrverkeri", "pinnsvin", "manet", "kenguru", "lyn", "mikrofon", "pirat", "popkorn", "saksofon", "dovendyr",
      "ubåt", "traktor", "enhjørning", "vampyr", "trollmann", "bikube", "bål", "pariserhjul", "luftballong", "tornado",
      "elg", "troll", "vaffel", "brunost", "ski",
      "astronaut", "ballerina", "grill", "pil og bue", "bro", "bulldoser", "karusell", "sjakk", "cowboy", "krokodille",
      "detektiv", "diamant", "delfin", "heis", "brannbil", "flamingo", "fontene", "gullfisk", "gorilla", "hengekøye",
      "hjelm", "timeglass", "skøyter", "jungel", "ridder", "marihøne", "gressklipper", "magnet", "tryllekunstner", "kart",
      "mumie", "ninja", "palme", "panda", "påfugl", "piano", "pyramide", "seilbåt", "satellitt", "saks",
      "sjøhest", "skipsvrak", "skjelett", "snøkule", "romskip", "ekorn", "stetoskop", "sushi", "huske", "teleskop",
      "brødrister", "trampoline", "smoking", "støvsuger", "fiolin", "hvalross", "varulv", "trillebår", "sebra", "køyeseng",
      "muffins", "fiskestang", "spøkelseshus", "postkasse", "snorkel", "sombrero", "taco", "mygg", "flaggermus", "romvesen",
      "superhelt", "trehytte", "pipe", "hoppbakke", "vannsklie", "kvikk lunsj",
    ],
    hard: [
      "søvngjengeri", "hjemlengsel", "utsettelse", "sjalusi", "tyngdekraft", "ekko", "deja vu", "trafikkork", "tidsreise", "mareritt",
      "hjernefrys", "fyllesyke", "fotosyntese", "inflasjon", "wifi", "allergi", "første date", "solbrent", "hikke", "midtlivskrise",
      "pinlig stillhet", "black friday", "evolusjon", "speilbilde", "skygge", "stillhet", "demokrati", "karaoke", "yoga", "kamuflasje",
      "jordskjelv", "solformørkelse", "gjemsel", "jetlag", "vuggesang", "maraton", "meditasjon", "resirkulering", "sarkasme", "selfie",
      "slumreknapp", "spoiler", "sceneskrekk", "teleportering", "kiling", "bryllup", "dvale", "zombieapokalypse", "gruppechat", "utferdstrang",
      "koselig", "friluftsliv", "dugnad", "matpakke", "russetid",
      "angst", "nostalgi", "sladder", "frihet", "flaks", "hetebølge", "global oppvarming", "sosiale medier", "komfortsone", "gruppepress",
      "biltur", "dårlig hårdag", "ghosting", "nettdating", "småprat", "intern spøk", "humørsvingning", "dobbeldate", "hvetebrødsdager", "slå opp",
      "friendzone", "egenomsorg", "overtenking", "dagdrøm", "gåsehud", "sommerfugler i magen", "mandagsmorgen", "rushtid", "falske nyheter", "tidssone",
      "godnatthistorie", "putekrig", "overnatting", "overraskelsesfest", "hvit løgn", "anger", "fristelse", "hypnose", "telepati", "idémyldring",
      "snarvei", "smutthull", "influenser", "autokorrektur", "passord", "skjermtid", "pappavits", "nattmat", "trøstemat", "sukkerrus",
      "matkoma", "karma", "kjedereaksjon", "dominoeffekt", "sommerfugleffekten", "parallelt univers", "sort hull", "big bang", "nordlys", "harryhandel",
      "janteloven", "fredagstaco", "påskekrim", "hyttetur", "skippertak", "lørdagsgodt", "syttende mai",
    ],
  },
};

// Adult words (Jonas, 2026-11-08: "include dirty words in the word lists"), mixed into the
// lists above by how hard they are to draw. Delete this block to make the game clean again.
const ADULT = {
  en: {
    easy: ["bra", "boobs", "butt", "thong", "condom", "naked", "whip", "handcuffs", "nipple", "penis", "lube", "dildo", "vibrator", "blindfold", "horny", "hickey",
      "panties", "boxers", "bikini", "kiss", "tongue", "hot tub", "sexy"],
    medium: [
      "lingerie", "stripper", "pole dance", "lap dance", "skinny dipping", "strip poker", "booty call", "quickie", "threesome", "spanking",
      "foreplay", "doggy style", "cowgirl", "missionary", "boner", "french kiss", "make out", "sex toy", "strip club", "safe word",
      "massage", "body paint", "nude selfie", "sexting", "roleplay", "striptease", "whipped cream", "kama sutra", "peep show", "bachelor party",
    ],
    hard: [
      "one night stand", "walk of shame", "morning wood", "sixty nine", "orgasm", "bondage", "nudist beach",
      "wet dream", "shower sex", "naughty nurse", "dirty talk", "mile high club", "body shots", "chastity belt",
      "friends with benefits", "netflix and chill", "morning after", "afterglow", "dominatrix", "sugar daddy",
    ],
  },
  no: {
    easy: ["bh", "pupper", "rumpe", "string", "kondom", "naken", "pisk", "håndjern", "brystvorte", "penis", "glidemiddel", "dildo", "vibrator", "sugemerke", "kåt",
      "truse", "bokser", "bikini", "kyss", "tunge", "boblebad", "sexy"],
    medium: [
      "reizeundertøy", "stripper", "stangdans", "fangdans", "nakenbading", "strippepoker", "ligg", "trekant", "ris på rumpa", "forspill",
      "doggy", "rytterstilling", "misjonærstilling", "ståpikk", "tungekyss", "klining", "sexleketøy", "strippeklubb", "safeord", "bind for øynene",
      "massasje", "kroppsmaling", "nakenbilde", "sexting", "rollespill", "striptease", "krem", "kama sutra", "utdrikningslag",
    ],
    hard: [
      "engangsligg", "sekstini", "orgasme", "bondage", "nakenstrand", "våt drøm", "dusjsex",
      "frekk sykepleier", "skittenprat", "pornoblad", "bryllupsnatt", "kyskhetsbelte", "trusetyv",
      "venner med fordeler", "netflix og chill", "dagen derpå", "etterglød", "dominatrise", "sugardaddy",
    ],
  },
};
for (const [lang, levels] of Object.entries(ADULT)) for (const [level, words] of Object.entries(levels)) WORDS[lang][level].push(...words);

// Doctor Who creatures with a look you can draw (Jonas, 2026-11-09), under their English names in
// both languages: the best known in medium, the rest in hard.
const WHO = {
  medium: ["dalek", "cyberman", "weeping angel"],
  hard: ["sontaran", "silurian", "ood", "adipose", "zygon", "slitheen", "judoon", "auton", "ice warrior", "davros", "sycorax"],
};
for (const lang of Object.keys(WORDS)) for (const [level, words] of Object.entries(WHO)) WORDS[lang][level].push(...words);

export const LANG_NAMES = { en: "English", no: "Norsk" };
