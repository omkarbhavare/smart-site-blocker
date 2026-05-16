/**
 * utils/storage.js
 * -----------------
 * Chrome storage helpers for Smart Site Blocker.
 * All reads/writes use chrome.storage.sync for cross-device persistence.
 * Provides typed async accessors for all settings and data collections.
 *
 * PROTECTED DEFAULTS:
 *  - DEFAULT_KEYWORDS and DEFAULT_REGEX_RULES are never shown in the UI.
 *  - They are always enforced at runtime regardless of user edits.
 *  - They cannot be removed, exported, or overwritten by import/reset.
 */

/** @private — never exposed to the UI or export */
const DEFAULT_KEYWORDS = [
  // Adult / Porn
  'porn','porno','pornography','xxx','xxxx','sex','sexvideo','sextape','sexclip',
  'adult','adultvideo','adultcontent','hentai','ecchi','ahegao','nsfw','lewd','r34',
  'xnxx','xhamster','xvideos','xmaster','pornhub','phub','redtube','youporn','tube8',
  'spankbang','spankwire','brazzers','bangbros','naughtyamerica',
  'onlyfans','fansly','manyvids','clips4sale','chaturbate','bongacams','cam4',
  'myfreecams','stripchat','livejasmin','porntrex','porndig','porndoe','pornone',
  'motherless','empflix','tnaflix','txxx','beeg','drtuber','nuvid','hclips','hdzog',
  'vjav','javhd','javfree','rule34','e621','gelbooru','danbooru','sexmex','analdin',
  'anyporn','perverzija','4tube','fuq','fux','slutload','nudevista','pornmd','pornsos',
  'eporner','upornia','goodporn','hotmovs','sexu','netfapx','nudography','freeones',
  'babepedia','nudostar','thothub','simpcity','aznude','mrdeepfakes','deepnude','nudify',
  // Adult OTT (Indian)
  'ullu','ullutv','ullu originals','ullu app','kooku','kookuapp','kooku originals',
  'altbalaji','alt balaji','primeflix','primeshots','primeplay','nuefliks','besharams',
  'hotx','hotxvip','hotshots','rabbitmovies','voovi','xtramood','fugiapp','cineprime',
  'orvibo','gupchup','msspicy','hunters originals','feelit','hotmx','yessma','mojflix',
  'woworiginals','boltoriginals','bindaas','flizmovies','lovestream','aaonxt',
  'triflicks','crabflix','neonx','digimovieplex','bigmoviezoo','chapai','hitprime',
  'showx','xprime','admirefilms','cinemadosti','hootzy','boomflix','lookentertainment',
  'atprime','reelstreet','uncutadda','hottyapp',
  // Adult OTT (International)
  'adulttime','mofos','realitykings','teamskeet','babesnetwork','devilsfilm',
  'elegantangel','kink','pornpros','puretaboo','vixenmedia','blacked','tushy','deeper',
  'slayed','metart','suicidegirls','abbywinters','scoreland','hegre',
  // Betting / Gambling / Fantasy
  'betting','sportsbet','sportsbetting','bet365','bet9ja','betway','betwinner',
  'betfair','betsson','bwin','betmgm','fanduel','draftkings','pointsbet','unibet',
  '888sport','888casino','888poker','williamhill','ladbrokes','coral','paddy power',
  'bovada','mybookie','betonline','1xbet','22bet','melbet','parimatch','mostbet',
  'linebet','pin-up bet','dafabet','fun88','sbobet','maxbet','m88','onlinecasino',
  'casino online','live casino','poker online','roulette online','blackjack online',
  'slotgames','slot machine','pokies','jackpot','megajackpot','spinwin','casinobet',
  'casinoslot','casinoking','royalcasino','royalpanda','leovegas','casumo','rizk',
  'videoslots','guts casino','bitstarz','bitsler','roobet','stake.com','bc.game',
  'rollbit','crypto gambling','crypto casino','crash game','dream11','my11circle',
  'myteam11','ballebaazi','howzat','fantasy cricket','fantasy sports','ipl betting',
  'cricket betting','match betting','ipl','cricket prediction','match prediction',
  'toss prediction','satta','sattamatka','matka','kalyan matka','milan matka',
  'lottery online','lotto','scratchcard','bingo online','keno online',
  'esports betting','csgo betting','dota betting','odds','spread betting',
  'arbitrage betting',
  // Additional Indian / South Asian Gambling
  'play10cric','10cric','purewin','betbarter','wolf777','silverexch','skyexchange',
  'diamondexch','laser247','world777','fairplay','megapari','casinodays','lilibet',
  'jeetwin','rajabets','baazi247','cricbaba','betshah','bluechip','lotus365','yolo247',
  'indibet','bettilt','helabet','1win','glory casino','betvisa','mostplay','odds96',
  'satsport247','iccwin','crickex','b9casino','bajilive','krikya','marvelbet','baji999',
  'mcwcasino','nagad88','betjili','jeetbuzz','khiladiadda',
  // Cricket / Prediction
  'cricbuzz','cricinfo','espncricinfo','livecricket',
  // Piracy / Torrents
  'torrent','torrenting','thepiratebay','piratebay','tpb','1337x','yts','yify',
  'rarbg','eztv','zooqle','nyaa','animebytes','bakabt','kickasstorrent','torrentz',
  'torrentz2','limetorrents','torlock','idope','magnetdl','rutracker','nnm-club',
  // Piracy / Movie Download
  'filmyzilla','filmywap','filmyhit','filmymeet','moviesda','movierulz','moviesflix',
  'movieverse','tamilrockers','tamilblasters','tamilyogi','tamilmv','isaimini',
  'isaidub','isaihub','jalshamoviez','bolly4u','bollyflix','hdmovies','downloadhub',
  'downloadmasti','kuttymovies','khatrimaza','katmoviehd','skymovieshd','worldfree4u',
  '9xmovies','9xrockers','7starhd','300mbmovies','extramovies','coolmoviez','mp4moviez',
  'mp4mania','ssrmovies','rdxhd','rdxnet','pagalworld','djpunjab','mrjatt','gomovies',
  'gostream','123movies','fmovies','putlocker','solarmovie','yesmovies','watchseries',
  'openload','streamango','vidlox','afdah','couchtuner','projectfreetv','popcorntime',
  'megashare','zmovies',
  // Warez / Software Piracy
  'warez','nulled','keygen','serialkey','licensecrack','patchcrack','modapk','apkmod',
  'crackpc','getintopc','igetintopc','oceanofgames','fitgirl repacks','skidrowcrack',
  'cpy crack','codex crack','steamunlocked','skidrow',
  // Generic
  'movie download','movies download','free movie download','hd movie download',
  'full movie download','bollywood download','hollywood download','web series download',
  'ott leak','leaked movie'
];

/** @private — never exposed to the UI or export */
const DEFAULT_REGEX_RULES = [
  // Adult / Porn Sites
  '/(porn|porno|pornography|xxx|xxxx|sex|sexvideo|sextape|sexclip|adult|adultvideo|adultcontent|hentai|ecchi|ahegao|nsfw|lewd|r34)/i',
  '/(xnxx|xhamster|xvideos|xmaster|pornhub|phub|redtube|youporn|tube8|spankbang|spankwire|brazzers|bangbros|naughtyamerica)/i',
  '/(onlyfans|fansly|manyvids|clips4sale|chaturbate|bongacams|cam4|myfreecams|stripchat|livejasmin)/i',
  '/(porntrex|porndig|porndoe|pornone|motherless|empflix|tnaflix|txxx|beeg|drtuber|nuvid|hclips|hdzog)/i',
  '/(vjav|javhd|javfree|rule34|e621|gelbooru|danbooru|sexmex|analdin|anyporn|perverzija|4tube|fuq|fux|slutload)/i',
  '/(nudevista|pornmd|pornsos|eporner|upornia|goodporn|hotmovs|sexu|netfapx|nudography|freeones|babepedia)/i',
  '/(nudostar|thothub|simpcity|aznude|mrdeepfakes|deepnude|nudify)/i',
  // Adult OTT Platforms (Indian)
  '/(ullu|ullutv|kooku|altbalaji|primeflix|primeshots|primeplay|nuefliks|besharams)/i',
  '/(hotx|hotxvip|hotshots|rabbitmovies|voovi|xtramood|fugiapp|cineprime|orvibo|gupchup)/i',
  '/(msspicy|hunters|feelit|hotmx|yessma|mojflix|woworiginals|boltoriginals|bindaas|flizmovies)/i',
  '/(lovestream|aaonxt|triflicks|crabflix|neonx|digimovieplex|bigmoviezoo|chapai|hitprime|showx)/i',
  '/(xprime|admirefilms|cinemadosti|hootzy|boomflix|lookentertainment|atprime|reelstreet|uncutadda|hottyapp)/i',
  // Adult OTT Platforms (International)
  '/(adulttime|mofos|realitykings|teamskeet|babesnetwork|devilsfilm|elegantangel|kink|pornpros|puretaboo)/i',
  '/(vixenmedia|blacked|tushy|deeper|slayed|metart|suicidegirls|abbywinters|scoreland|hegre)/i',
  // Betting / Gambling / Fantasy
  '/(bet|betting|gambl|sportsbet|sportsbetting)/i',
  '/(bet365|bet9ja|betway|betwinner|betfair|betsson|bwin|betmgm|fanduel|draftkings|pointsbet)/i',
  '/(unibet|888sport|888casino|888poker|williamhill|ladbrokes|coral|paddypower)/i',
  '/(bovada|mybookie|betonline|1xbet|22bet|melbet|parimatch|mostbet|linebet|pinupbet)/i',
  '/(dafabet|fun88|sbobet|maxbet|m88|onlinecasino|livecasino|slotgames|slotmachine|pokies)/i',
  '/(jackpot|megajackpot|spinwin|casinobet|casinoslot|royalcasino|royalpanda|leovegas)/i',
  '/(casumo|rizk|videoslots|gutscasino|bitstarz|bitsler|roobet|rollbit|cryptogambling|crashgame)/i',
  '/(dream11|my11circle|myteam11|ballebaazi|howzat|fantasycricket|fantasysports)/i',
  '/(satta|sattamatka|matka|kalyanmatka|milanmatka|lotteryon|scratchcard|bingoonline|kenoonline)/i',
  '/(esportsbetting|csgobetting|dotabetting|spreadbetting|arbitragebetting)/i',
  // Additional Indian / South Asian Gambling
  '/(play10cric|10cric|purewin|betbarter|wolf777|silverexch|skyexchange|diamondexch)/i',
  '/(laser247|world777|fairplay|megapari|casinodays|lilibet|jeetwin|rajabets|baazi247)/i',
  '/(cricbaba|betshah|bluechip|lotus365|yolo247|indibet|bettilt|helabet|1win|glorycasino)/i',
  '/(betvisa|mostplay|odds96|satsport247|iccwin|crickex|b9casino|bajilive|krikya|marvelbet)/i',
  '/(baji999|mcwcasino|nagad88|betjili|jeetbuzz|khiladiadda)/i',
  // Cricket / IPL / Match Prediction
  '/(cricket|ipl|live.?match|cricbuzz|cricinfo|cricketprediction|matchprediction|tossprediction|iplbetting)/i',
  // Piracy / Torrents
  '/(torrent|torrenting|thepiratebay|piratebay|1337x|yts|yify|rarbg|eztv|zooqle)/i',
  '/(nyaa|animebytes|bakabt|kickasstorrent|torrentz|torrentz2|limetorrents|torlock|idope|magnetdl)/i',
  '/(rutracker|nnmclub)/i',
  // Piracy / Movie Download Sites
  '/(filmyzilla|filmywap|filmyhit|filmymeet|moviesda|movierulz|moviesflix|movieverse)/i',
  '/(tamilrockers|tamilblasters|tamilyogi|tamilmv|isaimini|isaidub|isaihub)/i',
  '/(jalshamoviez|bolly4u|bollyflix|hdmovies|downloadhub|downloadmasti)/i',
  '/(kuttymovies|khatrimaza|katmoviehd|skymovieshd|worldfree4u|9xmovies|9xrockers)/i',
  '/(7starhd|300mbmovies|extramovies|coolmoviez|mp4moviez|mp4mania|ssrmovies|rdxhd|rdxnet)/i',
  '/(pagalworld|djpunjab|mrjatt|gomovies|gostream|123movies|fmovies|putlocker|solarmovie)/i',
  '/(yesmovies|watchseries|openload|streamango|vidlox|afdah|couchtuner|projectfreetv)/i',
  '/(popcorntime|megashare|zmovies)/i',
  // Movie Downloading (Generic)
  '/(movie.*download|download.*movie|free.*movie.*download|full.*movie.*download)/i',
  '/(bollywood.*download|hollywood.*download|web.*series.*download|ott.*leak|leaked.*movie)/i',
  // Warez / Software Piracy
  '/(warez|nulled|keygen|serialkey|licensecrack|patchcrack|modapk|apkmod|crackpc)/i',
  '/(getintopc|igetintopc|oceanofgames|fitgirlrepacks|skidrowcrack|cpycrack|codexcrack|steamunlocked|skidrow)/i',
];

/** Default extension settings */
const DEFAULT_SETTINGS = {
  enabled: true,
  threshold: 40,
  fuzzyEnabled: true,
  deepScanEnabled: true
};

/**
 * Generic wrapper for chrome.storage.sync.get.
 * @param {string|string[]} keys
 * @returns {Promise<Object>}
 */
const storageGet = (keys) =>
  new Promise((resolve) => chrome.storage.sync.get(keys, resolve));

/**
 * Generic wrapper for chrome.storage.sync.set.
 * @param {Object} items
 * @returns {Promise<void>}
 */
const storageSet = (items) =>
  new Promise((resolve) => chrome.storage.sync.set(items, resolve));

/**
 * Initialize storage with defaults on first install.
 * Safe to call multiple times — only sets values that are not already present.
 * Protected keywords/regex are never written to storage; enforced at runtime only.
 * @returns {Promise<void>}
 */
export async function initializeDefaults() {
  const existing = await storageGet([
    'keywords', 'regexRules', 'whitelist', 'blacklist',
    'settings', 'blockedCount'
  ]);

  const toSet = {};
  if (!existing.keywords)    toSet.keywords    = [];  // user starts with empty custom list
  if (!existing.regexRules)  toSet.regexRules  = [];  // user starts with empty custom list
  if (!existing.whitelist)   toSet.whitelist   = [];
  if (!existing.blacklist)   toSet.blacklist   = [];
  if (!existing.settings)    toSet.settings    = DEFAULT_SETTINGS;
  if (existing.blockedCount === undefined) toSet.blockedCount = 0;

  if (Object.keys(toSet).length > 0) {
    await storageSet(toSet);
  }
}

/**
 * Get the list of user-defined blocked keywords (excludes protected defaults).
 * This is what the UI shows and edits.
 * @returns {Promise<string[]>}
 */
export async function getKeywords() {
  const { keywords = [] } = await storageGet('keywords');
  return keywords;
}

/**
 * Get the full effective keyword list (user list merged with protected defaults).
 * Use ONLY in the blocking engine — never expose this to the UI or export.
 * @returns {Promise<string[]>}
 */
export async function getEffectiveKeywords() {
  const userKeywords = await getKeywords();
  const combined = new Set([...DEFAULT_KEYWORDS, ...userKeywords]);
  return Array.from(combined);
}

/**
 * Save the list of user-defined blocked keywords.
 * Protected defaults are never stored or overwritten.
 * @param {string[]} keywords
 * @returns {Promise<void>}
 */
export async function saveKeywords(keywords) {
  await storageSet({ keywords });
}

/**
 * Get the list of user-defined regex rule strings (excludes protected defaults).
 * This is what the UI shows and edits.
 * @returns {Promise<string[]>}
 */
export async function getRegexRules() {
  const { regexRules = [] } = await storageGet('regexRules');
  return regexRules;
}

/**
 * Get the full effective regex rule list (user rules merged with protected defaults).
 * Use ONLY in the blocking engine — never expose this to the UI or export.
 * @returns {Promise<string[]>}
 */
export async function getEffectiveRegexRules() {
  const userRules = await getRegexRules();
  const combined = new Set([...DEFAULT_REGEX_RULES, ...userRules]);
  return Array.from(combined);
}

/**
 * Save the list of user-defined regex rule strings.
 * Protected defaults are never stored or overwritten.
 * @param {string[]} rules
 * @returns {Promise<void>}
 */
export async function saveRegexRules(rules) {
  await storageSet({ regexRules: rules });
}

/**
 * Get the whitelist (domains that are never blocked).
 * @returns {Promise<string[]>}
 */
export async function getWhitelist() {
  const { whitelist = [] } = await storageGet('whitelist');
  return whitelist;
}

/**
 * Save the whitelist.
 * @param {string[]} list
 * @returns {Promise<void>}
 */
export async function saveWhitelist(list) {
  await storageSet({ whitelist: list });
}

/**
 * Get the blacklist (domains that are always blocked).
 * @returns {Promise<string[]>}
 */
export async function getBlacklist() {
  const { blacklist = [] } = await storageGet('blacklist');
  return blacklist;
}

/**
 * Save the blacklist.
 * @param {string[]} list
 * @returns {Promise<void>}
 */
export async function saveBlacklist(list) {
  await storageSet({ blacklist: list });
}

/**
 * Get the current extension settings.
 * @returns {Promise<{ enabled: boolean, threshold: number, fuzzyEnabled: boolean, deepScanEnabled: boolean }>}
 */
export async function getSettings() {
  const { settings = DEFAULT_SETTINGS } = await storageGet('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

/**
 * Save extension settings (merged with existing).
 * @param {Partial<{ enabled: boolean, threshold: number, fuzzyEnabled: boolean, deepScanEnabled: boolean }>} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  const current = await getSettings();
  await storageSet({ settings: { ...current, ...settings } });
}

/**
 * Increment the running count of blocked sites.
 * @returns {Promise<void>}
 */
export async function incrementBlockedCount() {
  const { blockedCount = 0 } = await storageGet('blockedCount');
  await storageSet({ blockedCount: blockedCount + 1 });
}

/**
 * Get the total number of sites blocked since install.
 * @returns {Promise<number>}
 */
export async function getBlockedCount() {
  const { blockedCount = 0 } = await storageGet('blockedCount');
  return blockedCount;
}

/**
 * Reset all storage to defaults.
 * Protected keywords/regex are not stored — they always apply at runtime.
 * User custom keywords/regex are cleared back to empty.
 * @returns {Promise<void>}
 */
export async function resetToDefaults() {
  await storageSet({
    keywords: [],       // clear user additions; protected defaults always apply silently
    regexRules: [],     // clear user additions; protected defaults always apply silently
    whitelist: [],
    blacklist: [],
    settings: DEFAULT_SETTINGS,
    blockedCount: 0
  });
}

/**
 * Export all settings as a plain object for download.
 * Protected defaults are intentionally excluded from export.
 * @returns {Promise<Object>}
 */
export async function exportAllSettings() {
  const data = await storageGet([
    'keywords', 'regexRules', 'whitelist', 'blacklist', 'settings'
  ]);
  return data;
}

/**
 * Import settings from a plain object (e.g., from JSON file upload).
 * Protected defaults cannot be overwritten via import.
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function importAllSettings(data) {
  const toSet = {};
  if (Array.isArray(data.keywords))   toSet.keywords   = data.keywords;
  if (Array.isArray(data.regexRules)) toSet.regexRules = data.regexRules;
  if (Array.isArray(data.whitelist))  toSet.whitelist  = data.whitelist;
  if (Array.isArray(data.blacklist))  toSet.blacklist  = data.blacklist;
  if (data.settings && typeof data.settings === 'object') {
    toSet.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  }
  await storageSet(toSet);
}
